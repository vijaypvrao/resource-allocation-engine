"""Reproducible deterministic-scale smoke benchmark (not a concurrency test)."""
from __future__ import annotations
import argparse
from datetime import datetime, timedelta
from time import perf_counter
import tracemalloc
from app.models import Resource, Request, Location
from app.scalable_strategy import scalable_allocate

def run(n, mode):
    start = datetime(2026, 10, 8, 9)
    resources = [Resource(f't{i}', f'Tech {i}', Location(12.5 + (i % 1000) * 0.0001, 77.5 + (i // 1000) * 0.0001),
                 frozenset({'electrical'}), start, start + timedelta(hours=8)) for i in range(n)]
    requests = [Request(f'r{i}', f'Job {i}', Location(12.5 + (i % 1000) * 0.0001, 77.5 + (i // 1000) * 0.0001),
                frozenset({'electrical'}), start + timedelta(hours=1), start + timedelta(hours=2), 3) for i in range(n)]
    tracemalloc.start()
    t0 = perf_counter()
    result = scalable_allocate(resources, requests, assignment_mode=mode)
    elapsed = perf_counter()-t0
    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    print(f'{n} resources, {n} requests | {mode} | assigned={len(result.assignments)} '
          f'({result.metrics["coverage_pct"]}%) | elapsed={elapsed:.2f}s | traced_peak={peak/1024**2:.1f} MiB')
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--sizes', nargs='+', type=int, default=[100, 1000, 10000])
    parser.add_argument('--mode', choices=['one_to_one', 'one_to_many'], default='one_to_one')
    args = parser.parse_args()
    for size in args.sizes:
        run(size, args.mode)
