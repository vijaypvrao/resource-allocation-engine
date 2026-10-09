"""Offline, reproducible allocator load benchmark. Run from the backend directory.

Example: python benchmark_load.py --sizes 5000 20000 200000 --scenario matched --output load-results.json
Does not start the API, call an LLM, or modify application storage.
"""
from __future__ import annotations

import argparse
import json
import platform
import sys
from datetime import datetime, timedelta
from pathlib import Path
from time import perf_counter

from app.models import Location, Request, Resource
from app.scalable_strategy import scalable_allocate
from benchmark_realistic import build_case, peak_process_rss_mib, validate_result

SCENARIOS = ('matched', 'geographic_and_skills', 'capability_and_availability', 'one_to_many_conflicts')


def make_case(size: int, scenario: str, seed: int):
    if scenario != 'matched':
        resources, requests = build_case(size, scenario, seed)
        if scenario == 'one_to_many_conflicts':
            resources = resources[:max(1, size // 4)]
            return resources, requests, 'one_to_many'
        return resources, requests, 'one_to_one'

    # Same synthetic matched-location one-to-one pattern as the previous scale benchmark.
    base = datetime(2026, 10, 8, 9)
    resources = [Resource(f't{i}', f'Tech {i}',
                          Location(12.5 + (i % 1000) * .0001, 77.5 + (i // 1000) * .0001),
                          frozenset({'electrical'}), base, base + timedelta(hours=8))
                 for i in range(size)]
    requests = [Request(f'r{i}', f'Job {i}',
                        Location(12.5 + (i % 1000) * .0001, 77.5 + (i // 1000) * .0001),
                        frozenset({'electrical'}), base + timedelta(hours=1),
                        base + timedelta(hours=2), 3)
                for i in range(size)]
    return resources, requests, 'one_to_one'


def run(size: int, scenario: str, seed: int, neighbors: int):
    started = perf_counter()
    resources, requests, mode = make_case(size, scenario, seed)
    generation_seconds = perf_counter() - started
    started = perf_counter()
    result = scalable_allocate(resources, requests, assignment_mode=mode, max_neighbors=neighbors)
    allocation_seconds = perf_counter() - started
    started = perf_counter()
    validate_result(resources, requests, result, mode)
    validation_seconds = perf_counter() - started
    record = {
        'scenario': scenario, 'seed': seed, 'resources': len(resources), 'requests': len(requests),
        'assignment_mode': mode, 'algorithm': result.algorithm, 'max_neighbors': neighbors,
        'assigned': len(result.assignments), 'unassigned': len(result.unassigned_request_ids),
        'coverage_pct': round(100 * len(result.assignments) / len(requests), 2),
        'generation_seconds': round(generation_seconds, 3),
        'allocation_seconds': round(allocation_seconds, 3),
        'validation_seconds': round(validation_seconds, 3),
        'total_seconds': round(generation_seconds + allocation_seconds + validation_seconds, 3),
        'peak_process_rss_mib': peak_process_rss_mib(),
        'constraints_valid': True, 'optimality_guaranteed': False,
        'python': sys.version.split()[0], 'os': platform.platform(),
    }
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sizes', nargs='+', type=int, default=[5000, 20000, 200000])
    parser.add_argument('--scenario', choices=SCENARIOS, default='matched')
    parser.add_argument('--seed', type=int, default=71)
    parser.add_argument('--neighbors', type=int, default=128)
    parser.add_argument('--output', type=Path, default=Path('load-results.json'))
    args = parser.parse_args()
    if any(s <= 0 for s in args.sizes) or args.neighbors <= 0:
        parser.error('sizes and neighbors must be positive')
    records = []
    for size in args.sizes:
        print(f'Running {args.scenario}: {size:,} requests...', flush=True)
        record = run(size, args.scenario, args.seed, args.neighbors)
        records.append(record)
        print(json.dumps(record, ensure_ascii=False), flush=True)
        # Write after each case so a later failure does not lose earlier results.
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(records, indent=2) + '\n', encoding='utf-8')
    print(f'Results saved to {args.output.resolve()}', flush=True)


if __name__ == '__main__':
    main()
