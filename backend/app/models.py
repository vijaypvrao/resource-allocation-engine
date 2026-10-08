from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from typing import List

@dataclass(frozen=True)
class Location:
    lat: float
    lng: float

@dataclass(frozen=True)
class Resource:
    id: str
    name: str
    location: Location
    capabilities: frozenset[str]
    available_from: datetime
    available_until: datetime

@dataclass(frozen=True)
class Request:
    id: str
    title: str
    location: Location
    requirements: frozenset[str]
    start: datetime
    end: datetime
    priority: int = 1

@dataclass
class Assignment:
    request_id: str
    resource_id: str
    score: float
    distance_km: float
    explanation: List[str] = field(default_factory=list)

@dataclass
class AllocationResult:
    algorithm: str
    assignments: List[Assignment]
    unassigned_request_ids: List[str]
    metrics: dict
