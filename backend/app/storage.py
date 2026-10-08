from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime
from .data import seed_data
from .models import Location, Resource, Request

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "store.json"


def _resource_to_dict(r: Resource):
    return {
        "id": r.id, "name": r.name,
        "location": {"lat": r.location.lat, "lng": r.location.lng},
        "capabilities": sorted(r.capabilities),
        "available_from": r.available_from.isoformat(),
        "available_until": r.available_until.isoformat(),
    }


def _request_to_dict(r: Request):
    return {
        "id": r.id, "title": r.title,
        "location": {"lat": r.location.lat, "lng": r.location.lng},
        "requirements": sorted(r.requirements),
        "start": r.start.isoformat(), "end": r.end.isoformat(),
        "priority": r.priority,
    }


def _resource_from_dict(x):
    return Resource(x["id"], x["name"], Location(x["location"]["lat"], x["location"]["lng"]),
                    frozenset(x["capabilities"]), datetime.fromisoformat(x["available_from"]),
                    datetime.fromisoformat(x["available_until"]))


def _request_from_dict(x):
    return Request(x["id"], x["title"], Location(x["location"]["lat"], x["location"]["lng"]),
                   frozenset(x["requirements"]), datetime.fromisoformat(x["start"]),
                   datetime.fromisoformat(x["end"]), x.get("priority", 1))


def ensure_store():
    if DATA_FILE.exists():
        return
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    resources, requests = seed_data()
    save_data(resources, requests)


def load_data() -> tuple[list[Resource], list[Request]]:
    ensure_store()
    raw = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    return [_resource_from_dict(x) for x in raw.get("resources", [])], [_request_from_dict(x) for x in raw.get("requests", [])]


def save_data(resources: list[Resource], requests: list[Request]):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {"resources": [_resource_to_dict(r) for r in resources],
               "requests": [_request_to_dict(r) for r in requests]}
    DATA_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
