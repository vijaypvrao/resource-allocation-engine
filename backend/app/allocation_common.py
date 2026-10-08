"""Shared scoring, constraints, and metrics for allocation strategies."""
from __future__ import annotations
from math import asin, cos, radians, sin, sqrt
from typing import Iterable
import numpy as np
from .models import Assignment, Request, Resource

def haversine_km(a, b) -> float:
    lat1, lon1, lat2, lon2 = map(radians, [a.lat, a.lng, b.lat, b.lng])
    dlat, dlon = lat2-lat1, lon2-lon1
    h = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
    return 6371.0 * 2 * asin(sqrt(h))

def compatible(resource: Resource, request: Request) -> bool:
    return (request.requirements <= resource.capabilities and
            resource.available_from <= request.start and
            resource.available_until >= request.end)
            
def requests_overlap(request_a: Request, request_b: Request) -> bool:
    """
    Return True when two requests overlap in time.

    Requests that end exactly when another starts do NOT overlap.
    Example:
        09:00-10:00 and 10:00-11:00 -> no overlap
    """
    return (
        request_a.start < request_b.end
        and request_b.start < request_a.end
    )


def resource_can_take_request(
    resource: Resource,
    request: Request,
    assigned_requests: list[Request],
) -> bool:
    """
    Check whether a resource can take a request while respecting
    both static compatibility and existing schedule constraints.
    """

    if not compatible(resource, request):
        return False

    return all(
        not requests_overlap(request, assigned_request)
        for assigned_request in assigned_requests
    )            

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

