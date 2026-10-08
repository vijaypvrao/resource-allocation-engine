from __future__ import annotations
from math import asin, cos, radians, sin, sqrt
from typing import Iterable
import numpy as np
from scipy.optimize import linear_sum_assignment, milp, LinearConstraint, Bounds
from scipy.sparse import coo_matrix
from .models import Assignment, AllocationResult, Request, Resource

IMPOSSIBLE = 1e9

def haversine_km(a, b) -> float:
    lat1, lon1, lat2, lon2 = map(radians, [a.lat, a.lng, b.lat, b.lng])
    dlat, dlon = lat2-lat1, lon2-lon1
    h = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
    return 6371.0 * 2 * asin(sqrt(h))

def compatible(resource: Resource, request: Request) -> bool:
    return (request.requirements <= resource.capabilities and
            resource.available_from <= request.start and
            resource.available_until >= request.end)

def score(resource: Resource, request: Request, distance_weight=1.0, priority_weight=2.0) -> tuple[float, list[str], float]:
    d = haversine_km(resource.location, request.location)
    priority_bonus = priority_weight * request.priority
    capability_bonus = 2.0 * len(request.requirements)
    total = priority_bonus + capability_bonus - distance_weight * d
    reasons = [f"{d:.1f} km travel distance", f"priority {request.priority}", "all required capabilities matched"]
    return total, reasons, d

def metrics(
    assignments: list[Assignment],
    requests: Iterable[Request],
    algorithm: str,
    total_requests: int | None = None,
    assignment_mode: str = "one_to_one"
) -> dict:

    reqs = list(requests)

    count = (
        total_requests
        if total_requests is not None
        else len(reqs)
    )

    distances = [
        a.distance_km
        for a in assignments
    ]

    scores = [
        a.score
        for a in assignments
    ]

    return {
        "algorithm": algorithm,
        "assignment_mode": assignment_mode,

        "total_requests": count,

        "assigned": len(assignments),

        "unassigned": (
            count - len(assignments)
        ),

        "coverage_pct": round(
            100 * len(assignments) / count,
            1
        ) if count else 100.0,

        "avg_distance_km": round(
            float(np.mean(distances)),
            2
        ) if distances else 0.0,

        "total_distance_km": round(
            float(np.sum(distances)),
            2
        ) if distances else 0.0,

        "avg_score": round(
            float(np.mean(scores)),
            2
        ) if scores else 0.0,

        "total_score": round(
            float(np.sum(scores)),
            2
        ) if scores else 0.0,
    }

def greedy(
    resources: list[Resource],
    requests: list[Request],
    distance_weight=1.0,
    priority_weight=2.0,
    assignment_mode="one_to_one"
) -> AllocationResult:

    available = {r.id: r for r in resources}
    assignments = []

    ordered = sorted(requests, key=lambda x: (-x.priority, x.start))

    for req in ordered:

        candidates = [
            (
                score(r, req, distance_weight, priority_weight),
                r
            )
            for r in (
                available.values()
                if assignment_mode == "one_to_one"
                else resources
            )
            if compatible(r, req)
        ]

        if not candidates:
            continue

        (best_score, reasons, dist), res = max(
            candidates,
            key=lambda x: x[0][0]
        )

        explanation = list(reasons)

        if assignment_mode == "one_to_many":
            explanation.append("resource reusable under one-to-many mode")

        assignments.append(
            Assignment(
                req.id,
                res.id,
                round(best_score, 2),
                round(dist, 2),
                explanation
            )
        )

        if assignment_mode == "one_to_one":
            del available[res.id]

    assigned_ids = {a.request_id for a in assignments}

    unassigned = [
        r.id
        for r in requests
        if r.id not in assigned_ids
    ]

    return AllocationResult(
        "greedy",
        assignments,
        unassigned,
        metrics(
            assignments,
            requests,
            "greedy",
            assignment_mode=assignment_mode
        )
    )

def hungarian(
    resources,
    requests,
    distance_weight=1.0,
    priority_weight=2.0,
    assignment_mode="one_to_one"
) -> AllocationResult:

    if not resources or not requests:

        return AllocationResult(
            "hungarian",
            [],
            [r.id for r in requests],
            metrics(
                [],
                requests,
                "hungarian",
                assignment_mode=assignment_mode
            )
        )

    if assignment_mode == "one_to_many":
        return _global_one_to_many(
            resources,
            requests,
            distance_weight,
            priority_weight
        )

    request_count = len(requests)
    resource_count = len(resources)

    # ---------------------------------------------------------
    # Add one dummy/unassigned column per request.
    #
    # A dummy assignment has score 0.
    # ---------------------------------------------------------

    dummy_count = request_count

    cost = np.zeros(
        (
            request_count,
            resource_count + dummy_count
        ),
        dtype=float
    )

    details = {}

    # ---------------------------------------------------------
    # Real resource assignments
    # ---------------------------------------------------------

    for i, req in enumerate(requests):

        for j, res in enumerate(resources):

            if not compatible(res, req):

                cost[i, j] = IMPOSSIBLE

                continue

            s, reasons, dist = score(
                res,
                req,
                distance_weight,
                priority_weight
            )

            # Hungarian minimizes cost,
            # therefore maximize score by using -score.
            cost[i, j] = -s

            details[(i, j)] = (
                s,
                reasons,
                dist
            )

    # ---------------------------------------------------------
    # Dummy columns remain cost = 0.
    #
    # Therefore:
    #
    # score +5  -> cost -5 -> selected
    # score -5  -> cost +5 -> dummy selected
    # ---------------------------------------------------------

    rows, cols = linear_sum_assignment(cost)

    assignments = []
    assigned_rows = set()

    for i, j in zip(rows, cols):

        # Dummy column = request remains unassigned
        if j >= resource_count:
            continue

        # Incompatible pairing
        if cost[i, j] >= IMPOSSIBLE / 2:
            continue

        s, reasons, dist = details[(i, j)]

        assignments.append(
            Assignment(
                requests[i].id,
                resources[j].id,
                round(float(s), 2),
                round(float(dist), 2),
                reasons + [
                    "chosen by global batch optimization"
                ]
            )
        )

        assigned_rows.add(i)

    unassigned = [
        requests[i].id
        for i in range(request_count)
        if i not in assigned_rows
    ]

    return AllocationResult(
        "hungarian",
        assignments,
        unassigned,
        metrics(
            assignments,
            requests,
            "hungarian",
            assignment_mode=assignment_mode
        )
    )


def _global_one_to_many(
    resources: list[Resource],
    requests: list[Request],
    distance_weight=1.0,
    priority_weight=2.0
) -> AllocationResult:

    """
    Global optimization for One-to-Many allocation.

    Rules:
      1. A resource may serve multiple requests.
      2. A resource cannot serve overlapping requests.
      3. A request can be assigned to at most one resource.
      4. Total allocation score is the primary objective.
      5. Coverage is the secondary objective.
      6. Total distance is the tertiary objective.
    """

    # ---------------------------------------------------------
    # Build all feasible request/resource pairs
    # ---------------------------------------------------------

    candidates = []

    for request_index, req in enumerate(requests):

        for resource_index, res in enumerate(resources):

            if not compatible(res, req):
                continue

            s, reasons, dist = score(
                res,
                req,
                distance_weight,
                priority_weight
            )

            candidates.append(
                {
                    "request_index": request_index,
                    "resource_index": resource_index,
                    "request": req,
                    "resource": res,
                    "score": float(s),
                    "distance": float(dist),
                    "reasons": reasons
                }
            )

    # No feasible assignments
    if not candidates:

        return AllocationResult(
            "global_optimization",
            [],
            [req.id for req in requests],
            metrics(
                [],
                requests,
                "global_optimization",
                assignment_mode="one_to_many"
            )
        )

    variable_count = len(candidates)

    # ---------------------------------------------------------
    # x[i] = 1 if candidate i is selected
    # ---------------------------------------------------------

    constraint_rows = []
    constraint_cols = []
    constraint_data = []

    lower_bounds = []
    upper_bounds = []

    row_index = 0

    # ---------------------------------------------------------
    # Constraint 1:
    #
    # Each request can be assigned at most once.
    # ---------------------------------------------------------

    request_candidates = {}

    for i, candidate in enumerate(candidates):

        request_index = candidate["request_index"]

        request_candidates.setdefault(
            request_index,
            []
        ).append(i)

    for request_index in range(len(requests)):

        for candidate_index in request_candidates.get(
            request_index,
            []
        ):

            constraint_rows.append(row_index)
            constraint_cols.append(candidate_index)
            constraint_data.append(1.0)

        lower_bounds.append(0.0)
        upper_bounds.append(1.0)

        row_index += 1

    # ---------------------------------------------------------
    # Constraint 2:
    #
    # Same resource cannot handle overlapping requests.
    # ---------------------------------------------------------

    resource_candidates = {}

    for i, candidate in enumerate(candidates):

        resource_index = candidate["resource_index"]

        resource_candidates.setdefault(
            resource_index,
            []
        ).append(i)

    for resource_index, candidate_indices in resource_candidates.items():

        for pos_a in range(len(candidate_indices)):

            candidate_a = candidates[
                candidate_indices[pos_a]
            ]

            request_a = candidate_a["request"]

            for pos_b in range(
                pos_a + 1,
                len(candidate_indices)
            ):

                candidate_b = candidates[
                    candidate_indices[pos_b]
                ]

                request_b = candidate_b["request"]

                overlap = (
                    request_a.start < request_b.end
                    and
                    request_b.start < request_a.end
                )

                if not overlap:
                    continue

                constraint_rows.extend(
                    [
                        row_index,
                        row_index
                    ]
                )

                constraint_cols.extend(
                    [
                        candidate_indices[pos_a],
                        candidate_indices[pos_b]
                    ]
                )

                constraint_data.extend(
                    [
                        1.0,
                        1.0
                    ]
                )

                lower_bounds.append(0.0)
                upper_bounds.append(1.0)

                row_index += 1

    # ---------------------------------------------------------
    # Build sparse constraint matrix
    # ---------------------------------------------------------

    constraint_matrix = coo_matrix(
        (
            constraint_data,
            (
                constraint_rows,
                constraint_cols
            )
        ),
        shape=(
            row_index,
            variable_count
        )
    ).tocsr()

    # ---------------------------------------------------------
    # Objective
    #
    # Primary: maximize total score.
    #
    # milp() minimizes, so negate the score.
    # ---------------------------------------------------------

    objective = np.array(
        [
            -candidate["score"]
            for candidate in candidates
        ],
        dtype=float
    )

    constraints = LinearConstraint(
        constraint_matrix,
        np.array(lower_bounds),
        np.array(upper_bounds)
    )

    integrality = np.ones(variable_count)

    bounds = Bounds(
        np.zeros(variable_count),
        np.ones(variable_count)
    )

    # ---------------------------------------------------------
    # PHASE 1:
    #
    # Maximize TOTAL SCORE.
    # ---------------------------------------------------------

    phase_one = milp(
        c=objective,
        integrality=integrality,
        bounds=bounds,
        constraints=constraints
    )

    if not phase_one.success:

        return AllocationResult(
            "global_optimization",
            [],
            [req.id for req in requests],
            metrics(
                [],
                requests,
                "global_optimization",
                assignment_mode="one_to_many"
            )
        )

    maximum_score = float(
        -phase_one.fun
    )

    # ---------------------------------------------------------
    # PHASE 2:
    #
    # Keep maximum score fixed and maximize coverage.
    # ---------------------------------------------------------

    score_row = np.array(
        [
            candidate["score"]
            for candidate in candidates
        ],
        dtype=float
    ).reshape(1, -1)

    phase_two_matrix = coo_matrix(
        np.vstack(
            [
                constraint_matrix.toarray(),
                score_row
            ]
        )
    ).tocsr()

    phase_two_lower = np.concatenate(
        [
            np.array(lower_bounds),
            np.array([maximum_score])
        ]
    )

    phase_two_upper = np.concatenate(
        [
            np.array(upper_bounds),
            np.array([maximum_score])
        ]
    )

    phase_two_constraints = LinearConstraint(
        phase_two_matrix,
        phase_two_lower,
        phase_two_upper
    )

    # Maximize number of assignments
    phase_two_objective = np.full(
        variable_count,
        -1.0
    )

    phase_two = milp(
        c=phase_two_objective,
        integrality=integrality,
        bounds=bounds,
        constraints=phase_two_constraints
    )

    if not phase_two.success:

        solution = phase_one.x

    else:

        solution = phase_two.x

    # ---------------------------------------------------------
    # Convert solution to assignments
    # ---------------------------------------------------------

    assignments = []

    for i, value in enumerate(solution):

        if value < 0.5:
            continue

        candidate = candidates[i]

        assignments.append(
            Assignment(
                candidate["request"].id,
                candidate["resource"].id,
                round(candidate["score"], 2),
                round(candidate["distance"], 2),
                candidate["reasons"] + [
                    "selected by global "
                    "constraint-aware optimization",
                    "resource reusable for "
                    "non-overlapping requests"
                ]
            )
        )

    assigned_ids = {
        assignment.request_id
        for assignment in assignments
    }

    unassigned = [
        request.id
        for request in requests
        if request.id not in assigned_ids
    ]

    return AllocationResult(
        "global_optimization",
        assignments,
        unassigned,
        metrics(
            assignments,
            requests,
            "global_optimization",
            assignment_mode="one_to_many"
        )
    )


def determine_winner(
    greedy_metrics: dict,
    optimized_metrics: dict
) -> dict:

    greedy_score = float(
        greedy_metrics.get("total_score", 0.0)
    )

    optimized_score = float(
        optimized_metrics.get("total_score", 0.0)
    )

    greedy_coverage = float(
        greedy_metrics.get("coverage_pct", 0.0)
    )

    optimized_coverage = float(
        optimized_metrics.get("coverage_pct", 0.0)
    )

    greedy_distance = float(
        greedy_metrics.get(
            "total_distance_km",
            float("inf")
        )
    )

    optimized_distance = float(
        optimized_metrics.get(
            "total_distance_km",
            float("inf")
        )
    )

    optimized_algorithm = optimized_metrics.get(
        "algorithm",
        "optimized"
    )

    if optimized_score > greedy_score:

        winner = optimized_algorithm
        reason = "Higher total allocation score"

    elif greedy_score > optimized_score:

        winner = "greedy"
        reason = "Higher total allocation score"

    elif optimized_coverage > greedy_coverage:

        winner = optimized_algorithm
        reason = (
            "Equal total allocation score, "
            "higher request coverage"
        )

    elif greedy_coverage > optimized_coverage:

        winner = "greedy"
        reason = (
            "Equal total allocation score, "
            "higher request coverage"
        )

    elif optimized_distance < greedy_distance:

        winner = optimized_algorithm
        reason = (
            "Equal score and coverage, "
            "lower total travel distance"
        )

    elif greedy_distance < optimized_distance:

        winner = "greedy"
        reason = (
            "Equal score and coverage, "
            "lower total travel distance"
        )

    else:

        winner = "tie"
        reason = (
            "Both algorithms produced "
            "equivalent allocation results"
        )

    return {
        "winner": winner,
        "reason": reason,

        # Primary decision metric
        "total_score": {
            "greedy": greedy_score,
            "optimized": optimized_score
        },

        # Secondary decision metric
        "coverage": {
            "greedy": greedy_coverage,
            "optimized": optimized_coverage
        },

        # Tertiary decision metric
        "total_distance_km": {
            "greedy": greedy_distance,
            "optimized": optimized_distance
        },

        # Explicitly tell the UI which optimization algorithm is being compared
        "optimized_algorithm": optimized_algorithm,

        # Useful for displaying the decision hierarchy in the UI
        "decision_priority": [
            "total_score",
            "coverage",
            "total_distance_km"
        ]
    }    
