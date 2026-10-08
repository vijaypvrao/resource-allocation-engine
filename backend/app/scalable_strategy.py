"""Bounded-memory, sparse-neighbour heuristic for oversized allocation workloads.

This path favors predictable memory use over global optimality. A bounded nearby
candidate search is used instead of an N x M cost/constraint matrix.
"""
from __future__ import annotations
from bisect import bisect_left
from collections import defaultdict
import numpy as np
from scipy.spatial import cKDTree
from .allocation_common import compatible, score, metrics
from .models import AllocationResult, Assignment

MAX_NEIGHBORS = 128


def scalable_allocate(resources, requests, distance_weight=1.0, priority_weight=2.0,
                      assignment_mode="one_to_one", max_neighbors=MAX_NEIGHBORS):
    """Return feasible allocations using O(R + Q + Q*K) working memory.

    K is a bounded search width. This is a heuristic, not a claim of optimum
    or complete matching: candidates outside the search width may be missed.
    """
    if not resources or not requests:
        return AllocationResult("scalable_heuristic", [], [q.id for q in requests],
                                metrics([], requests, "scalable_heuristic", assignment_mode=assignment_mode))
    grouped = defaultdict(list)
    for index, resource in enumerate(resources):
        grouped[resource.capabilities].append(index)
    candidate_cache = {}
    used = set()
    bookings = defaultdict(list)
    assignments = []
    order = sorted(range(len(requests)), key=lambda i: (-requests[i].priority, requests[i].start, requests[i].id))
    for req_index in order:
        req = requests[req_index]
        key = req.requirements
        if key not in candidate_cache:
            eligible = [idx for skills, indices in grouped.items() if key <= skills for idx in indices]
            if eligible:
                coordinates = np.array([(resources[idx].location.lat, resources[idx].location.lng) for idx in eligible], dtype=np.float64)
                candidate_cache[key] = (eligible, cKDTree(coordinates))
            else:
                candidate_cache[key] = ([], None)
        eligible, tree = candidate_cache[key]
        if tree is None:
            continue
        count = min(len(eligible), max_neighbors)
        _, near = tree.query([req.location.lat, req.location.lng], k=count)
        near = np.atleast_1d(near)
        best = None
        for near_idx in near:
            resource_index = eligible[int(near_idx)]
            resource = resources[resource_index]
            if resource_index in used or not compatible(resource, req):
                continue
            if assignment_mode == "one_to_many":
                schedules = bookings[resource_index]
                slot = bisect_left(schedules, (req.start, req.end))
                if slot > 0 and schedules[slot - 1][1] > req.start:
                    continue
                if slot < len(schedules) and schedules[slot][0] < req.end:
                    continue
            candidate_score, reasons, dist = score(resource, req, distance_weight, priority_weight)
            if best is None or candidate_score > best[0]:
                best = (candidate_score, reasons, dist, resource_index)
        if best is None:
            continue
        s, reasons, dist, selected = best
        assignments.append(Assignment(req.id, resources[selected].id, round(s, 2), round(dist, 2),
                                      reasons + ["bounded-neighbour scalable allocation; global optimum not guaranteed"]))
        if assignment_mode == "one_to_one":
            used.add(selected)
        else:
            schedules = bookings[selected]
            schedules.insert(bisect_left(schedules, (req.start, req.end)), (req.start, req.end))
    assigned = {a.request_id for a in assignments}
    result_metrics = metrics(assignments, requests, "scalable_heuristic", assignment_mode=assignment_mode)
    result_metrics.update({"optimality_guaranteed": False, "candidate_search_limit": max_neighbors,
                           "strategy_note": "Sparse nearest-candidate heuristic; no dense matrix"})
    return AllocationResult("scalable_heuristic", assignments,
                            [q.id for q in requests if q.id not in assigned], result_metrics)
