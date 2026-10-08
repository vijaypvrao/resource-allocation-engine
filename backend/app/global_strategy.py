from __future__ import annotations
import numpy as np
from scipy.optimize import milp, LinearConstraint, Bounds
from scipy.sparse import coo_matrix
from .models import Assignment, AllocationResult, Resource, Request
from .allocation_common import compatible, requests_overlap, score, metrics

def global_one_to_many(
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

                if not requests_overlap(request_a, request_b):
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


