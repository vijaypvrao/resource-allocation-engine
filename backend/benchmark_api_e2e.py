"""Offline FastAPI/storage load test. Runs locally without a server or network.

Usage: python benchmark_api_e2e.py --sizes 1000 5000 20000
Includes storage serialization, storage read, API allocation, and JSON response.
"""
import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from time import perf_counter
from unittest.mock import patch

from fastapi.testclient import TestClient
from app import storage
from app.main import app
from benchmark_realistic import build_case


def run_case(n: int, scenario: str, seed: int) -> dict:
    resources, requests = build_case(n, scenario, seed)
    mode = 'one_to_one'
    if scenario == 'one_to_many_conflicts':
        resources = resources[:max(1, n // 4)]
        mode = 'one_to_many'
    with tempfile.TemporaryDirectory(prefix='rae_api_bench_') as tmp:
        with patch.object(storage, 'DATA_FILE', Path(tmp) / 'store.json'):
            t = perf_counter()
            storage.save_data(resources, requests)
            write_seconds = perf_counter() - t
            store_bytes = storage.DATA_FILE.stat().st_size
            with TestClient(app) as client:
                t = perf_counter()
                scenario_response = client.get('/api/scenario')
                scenario_seconds = perf_counter() - t
                assert scenario_response.status_code == 200, scenario_response.text[:300]
                scenario_bytes = len(scenario_response.content)
                t = perf_counter()
                response = client.post('/api/allocate', json={'assignment_mode': mode, 'use_llm': False})
                allocation_api_seconds = perf_counter() - t
                assert response.status_code == 200, response.text[:300]
                result = response.json()
                assert result['allocation_routing']['large_workload'] is (len(resources) > 2000 or len(requests) > 2000 or len(resources) * len(requests) > 2000000)
                assert len(result['results']) == (1 if result['allocation_routing']['large_workload'] else 2)
                data = result['results'][0]
                # Check response-assignment IDs and feasibility independently.
                resource_map = {r.id: r for r in resources}
                request_map = {q.id: q for q in requests}
                seen = set()
                per_resource = {}
                for a in data['assignments']:
                    qid = a['request_id']; rid = a['resource_id']
                    assert qid not in seen
                    seen.add(qid)
                    r = resource_map[rid]; q = request_map[qid]
                    assert q.requirements <= r.capabilities
                    assert r.available_from <= q.start and q.end <= r.available_until
                    booked = per_resource.setdefault(rid, [])
                    if mode == 'one_to_one':
                        assert not booked
                    else:
                        assert all(q.end <= start or end <= q.start for start, end in booked)
                    booked.append((q.start, q.end))
                unassigned = set(data['unassigned_request_ids'])
                assert len(unassigned) + len(seen) == len(requests)
                assert not unassigned & seen
                allocation_bytes = len(response.content)
                assert len(result['resources']) == len(resources)
                assert len(result['requests']) == len(requests)
                # Be explicit: the response includes full input datasets, not only selected IDs.
    peak_rss_mib = None
    try:
        import resource
        peak_rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        peak_rss_mib = round(peak_rss / (1024**2 if sys.platform == 'darwin' else 1024), 1)
    except ImportError:
        pass  # resource is unavailable on Windows; timing/response metrics remain valid.
    return {'scenario': scenario, 'resources': len(resources), 'requests': len(requests),
            'assigned': len(seen), 'coverage_pct': round(100 * len(seen) / len(requests), 2),
            'persist_seconds': round(write_seconds, 3), 'scenario_api_seconds': round(scenario_seconds, 3),
            'allocate_api_seconds': round(allocation_api_seconds, 3),
            'store_mib': round(store_bytes / 1048576, 2),
            'scenario_response_mib': round(scenario_bytes / 1048576, 2),
            'allocation_response_mib': round(allocation_bytes / 1048576, 2),
            'process_peak_rss_mib': peak_rss_mib, 'constraints_valid': True}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sizes', nargs='+', type=int, default=[5000, 20000])
    parser.add_argument('--scenarios', nargs='+', default=['geographic_and_skills'],
                        choices=['geographic_and_skills', 'capability_and_availability', 'one_to_many_conflicts'])
    parser.add_argument('--seed', type=int, default=71)
    args = parser.parse_args()
    # Force offline local mode, irrespective of the user's shell configuration.
    os.environ['LLM_ENABLED'] = 'false'
    for scenario in args.scenarios:
        for n in args.sizes:
            print(json.dumps(run_case(n, scenario, args.seed)), flush=True)

if __name__ == '__main__':
    main()
