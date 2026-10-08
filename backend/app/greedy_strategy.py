from __future__ import annotations
from .models import Assignment, AllocationResult
from .allocation_common import compatible, resource_can_take_request, score, metrics

def greedy(
    resources,
    requests,
    distance_weight=1.0,
    priority_weight=2.0,
    assignment_mode="one_to_one"
) -> AllocationResult:

    available = {r.id: r for r in resources}

    # Requests already assigned to each resource.
    # This is important for One-to-Many because a resource
    # can be reused only when its schedule does not overlap.
    assigned_by_resource = {
        r.id: []
        for r in resources
    }

    assignments = []

    # Higher-priority requests get considered first.
    ordered = sorted(
        requests,
        key=lambda x: (-x.priority, x.start)
    )

    for req in ordered:

        if assignment_mode == "one_to_one":
            candidate_resources = available.values()
        else:
            candidate_resources = resources

        candidates = [
            (
                score(
                    r,
                    req,
                    distance_weight,
                    priority_weight
                ),
                r
            )
            for r in candidate_resources
            if resource_can_take_request(
                r,
                req,
                assigned_by_resource[r.id]
            )
        ]

        if not candidates:
            continue

        (best_score, reasons, dist), res = max(
            candidates,
            key=lambda x: x[0][0]
        )

        explanation = list(reasons)

        if assignment_mode == "one_to_many":
            explanation.append(
                "resource reusable for non-overlapping requests"
            )

        assignments.append(
            Assignment(
                req.id,
                res.id,
                round(best_score, 2),
                round(dist, 2),
                explanation
            )
        )

        # Record the request against the resource so future
        # One-to-Many assignments can be checked for overlap.
        assigned_by_resource[res.id].append(req)

        if assignment_mode == "one_to_one":
            del available[res.id]

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

