from datetime import datetime, timedelta
from app.models import Location, Request, Resource
from app.scalable_strategy import scalable_allocate
from app import main

START = datetime(2026, 10, 8, 9)

def make(n, incompatible=False):
    resources = [Resource(f't{i}', f't{i}', Location(12.9 + i * 0.00001, 77.5),
                 frozenset({'electrical'}), START, START + timedelta(hours=9)) for i in range(n)]
    requests = [Request(f'r{i}', f'r{i}', Location(12.9 + i * 0.00001, 77.5),
                frozenset({'plumbing'} if incompatible else {'electrical'}),
                START + timedelta(hours=1), START + timedelta(hours=2), 3) for i in range(n)]
    return resources, requests

def test_sparse_allocation_uniqueness():
    res, req = make(150)
    result = scalable_allocate(res, req)
    assert len(set(a.resource_id for a in result.assignments)) == len(result.assignments)
    assert len(result.assignments) + len(result.unassigned_request_ids) == len(req)
    assert result.metrics['optimality_guaranteed'] is False

def test_sparse_hard_constraints():
    res, req = make(100, incompatible=True)
    result = scalable_allocate(res, req)
    assert not result.assignments
    assert result.metrics['unassigned'] == 100

def test_route_large_skips_llm(monkeypatch):
    resources, requests = make(2001)
    monkeypatch.setattr(main, 'load_data', lambda: (resources, requests))
    monkeypatch.setattr(main.llm_strategy, 'configured', lambda: True)
    monkeypatch.setattr(main.llm_strategy, 'plan', lambda *args: (_ for _ in ()).throw(AssertionError('LLM must not run')))
    payload = main.allocate(main.AllocationIn())
    assert payload['allocation_routing']['large_workload']
    assert payload['results'][0]['algorithm'] == 'scalable_heuristic'
    assert payload['llm_status']['attempted'] is False
    assert payload['llm_status']['fallback_reason']
