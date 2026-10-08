from __future__ import annotations
import numpy as np
from scipy.optimize import linear_sum_assignment
from .models import Assignment, AllocationResult
from .allocation_common import compatible, score, metrics
from .global_strategy import global_one_to_many
IMPOSSIBLE = 1e9

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
        return global_one_to_many(
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


