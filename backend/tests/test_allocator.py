from datetime import datetime, timedelta
from app.allocator import greedy, hungarian
from app.models import Location, Resource, Request

def make_data():
    t = datetime(2026,1,1,9)
    resources = [
        Resource("A", "A", Location(0,0), frozenset({"x"}), t, t+timedelta(hours=8)),
        Resource("B", "B", Location(0,10), frozenset({"x"}), t, t+timedelta(hours=8)),
    ]
    requests = [
        Request("r1", "r1", Location(0,9), frozenset({"x"}), t+timedelta(hours=1), t+timedelta(hours=2), 1),
        Request("r2", "r2", Location(0,1), frozenset({"x"}), t+timedelta(hours=3), t+timedelta(hours=4), 1),
    ]
    return resources, requests

def test_hard_capability_constraint():
    r, q = make_data()
    q[0] = Request("r1", "r1", Location(0,9), frozenset({"missing"}), q[0].start, q[0].end, 1)
    result = hungarian(r,q)
    assert "r1" in result.unassigned_request_ids

def test_hungarian_can_beat_greedy_on_batch_objective():
    r, q = make_data()
    greedy_result = greedy(r,q)
    hungarian_result = hungarian(r,q)
    assert hungarian_result.metrics["total_distance_km"] <= greedy_result.metrics["total_distance_km"]

def test_each_resource_used_at_most_once():
    r,q = make_data()
    for result in (greedy(r,q), hungarian(r,q)):
        ids = [a.resource_id for a in result.assignments]
        assert len(ids) == len(set(ids))
