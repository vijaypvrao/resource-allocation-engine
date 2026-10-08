from dataclasses import asdict
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .allocator import greedy, hungarian, determine_winner
from .storage import load_data, save_data, ensure_store
from .models import Location, Resource, Request
from typing import Literal

app = FastAPI(title="Resource Allocation Engine", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class LocationIn(BaseModel): lat: float; lng: float
class ResourceIn(BaseModel):
    id: str; name: str; lat: float; lng: float; capabilities: list[str]; available_from: datetime; available_until: datetime
class RequestIn(BaseModel):
    id: str; title: str; lat: float; lng: float; requirements: list[str]; start: datetime; end: datetime; priority: int = 1

class AllocationIn(BaseModel):
    resource_ids: list[str] | None = None
    request_ids: list[str] | None = None
    distance_weight: float = 1.0
    priority_weight: float = 2.0
    assignment_mode: Literal["one_to_one", "one_to_many"] = "one_to_one"

def parse_resources(items):
    return [Resource(x.id, x.name, Location(x.lat,x.lng), frozenset(x.capabilities), x.available_from, x.available_until) for x in items]
def parse_requests(items):
    return [Request(x.id, x.title, Location(x.lat,x.lng), frozenset(x.requirements), x.start, x.end, x.priority) for x in items]
def serialize_result(result):
    return {"algorithm": result.algorithm, "assignments": [asdict(x) for x in result.assignments], "unassigned_request_ids": result.unassigned_request_ids, "metrics": result.metrics}

@app.get("/api/health")
def health(): return {"status":"ok"}

@app.get("/api/scenario")
def scenario():
    resources, requests = load_data()
    return {"resources":[asdict(r) for r in resources], "requests":[asdict(q) for q in requests]}

@app.post("/api/resources")
def add_resource(body: ResourceIn):
    resources, requests = load_data()
    if any(r.id == body.id for r in resources):
        raise HTTPException(409, "Resource ID already exists")
    if body.available_from >= body.available_until:
        raise HTTPException(400, "available_from must be before available_until")
    resources.append(Resource(body.id, body.name, Location(body.lat, body.lng), frozenset(body.capabilities), body.available_from, body.available_until))
    save_data(resources, requests)
    return {"status": "created", "resource": asdict(resources[-1])}

@app.post("/api/requests")
def add_request(body: RequestIn):
    resources, requests = load_data()
    if any(q.id == body.id for q in requests):
        raise HTTPException(409, "Request ID already exists")
    if body.start >= body.end:
        raise HTTPException(400, "start must be before end")
    if not 1 <= body.priority <= 5:
        raise HTTPException(400, "priority must be between 1 and 5")
    requests.append(Request(body.id, body.title, Location(body.lat, body.lng), frozenset(body.requirements), body.start, body.end, body.priority))
    save_data(resources, requests)
    return {"status": "created", "request": asdict(requests[-1])}

@app.delete("/api/resources/{resource_id}")
def delete_resource(resource_id: str):
    resources, requests = load_data()
    kept = [r for r in resources if r.id != resource_id]
    if len(kept) == len(resources):
        raise HTTPException(404, "Resource not found")
    save_data(kept, requests)
    return {"status": "deleted", "id": resource_id}

@app.delete("/api/requests/{request_id}")
def delete_request(request_id: str):
    resources, requests = load_data()
    kept = [q for q in requests if q.id != request_id]
    if len(kept) == len(requests):
        raise HTTPException(404, "Request not found")
    save_data(resources, kept)
    return {"status": "deleted", "id": request_id}

@app.post("/api/allocate")
def allocate(body: AllocationIn):
    all_resources, all_requests = load_data()
    resource_ids = set(body.resource_ids) if body.resource_ids is not None else {r.id for r in all_resources}
    request_ids = set(body.request_ids) if body.request_ids is not None else {q.id for q in all_requests}
    resources = [r for r in all_resources if r.id in resource_ids]
    requests = [q for q in all_requests if q.id in request_ids]
    if not resources and requests: raise HTTPException(400, "Select at least one resource")
    if not requests: raise HTTPException(400, "Select at least one request")
    results = [
      greedy(
          resources,
          requests,
          body.distance_weight,
          body.priority_weight,
          body.assignment_mode
      ),
      hungarian(
          resources,
          requests,
          body.distance_weight,
          body.priority_weight,
          body.assignment_mode
      )
    ]

    serialized_results = [
        serialize_result(r)
        for r in results
    ]

    greedy_result = next(
        r for r in results
        if r.algorithm == "greedy"
    )

    optimized_result = next(
        r for r in results
        if r.algorithm in {"hungarian", "global_optimization"}
    )

    winner = determine_winner(
        greedy_result.metrics,
        optimized_result.metrics
    )

    print("\n========== ALLOCATION DEBUG ==========")
    print("Assignment mode:", body.assignment_mode)
    print("GREEDY METRICS:", greedy_result.metrics)
    print("OPTIMIZED METRICS:", optimized_result.metrics)
    print("WINNER:", winner)
    print("======================================\n")


    return {
        "resources": [
            asdict(r)
            for r in all_resources
        ],

        "requests": [
            asdict(q)
            for q in all_requests
        ],

        "selected_resource_ids": list(
            resource_ids
        ),

        "selected_request_ids": list(
            request_ids
        ),

        "results": serialized_results,

        "winner": winner
    }

ensure_store()
