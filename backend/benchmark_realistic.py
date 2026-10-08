"""Reproducible offline allocator benchmarks with heterogeneous constraints.

Measures allocator execution only, not HTTP, persistence, or browser rendering.
Usage: python benchmark_realistic.py --sizes 1000 5000 20000
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from datetime import datetime, timedelta
from time import perf_counter

from app.models import Location, Request, Resource
from app.scalable_strategy import scalable_allocate

def peak_process_rss_mib():
    """Peak resident memory on Windows/macOS/Linux, or None if unavailable."""
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes

        class ProcessMemoryCounters(ctypes.Structure):
            _fields_ = [
                ("cb", wintypes.DWORD),
                ("PageFaultCount", wintypes.DWORD),
                ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t),
            ]

        counters = ProcessMemoryCounters()
        counters.cb = ctypes.sizeof(counters)
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        psapi = ctypes.WinDLL("psapi", use_last_error=True)
        kernel32.GetCurrentProcess.restype = wintypes.HANDLE
        psapi.GetProcessMemoryInfo.argtypes = [
            wintypes.HANDLE, ctypes.POINTER(ProcessMemoryCounters), wintypes.DWORD
        ]
        psapi.GetProcessMemoryInfo.restype = wintypes.BOOL
        if psapi.GetProcessMemoryInfo(
            kernel32.GetCurrentProcess(), ctypes.byref(counters), counters.cb
        ):
            return round(counters.PeakWorkingSetSize / (1024 * 1024), 1)
        return None

    import resource
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return round(peak / (1024 * 1024 if sys.platform == "darwin" else 1024), 1)


BASE = datetime(2026, 10, 8, 8)
SKILLS = ('electrical', 'plumbing', 'hvac', 'network')


def build_case(n: int, scenario: str, seed: int):
    rng = random.Random(seed)
    resources = []
    requests = []
    for i in range(n):
        lat = 12.75 + rng.random() * .50
        lon = 77.35 + rng.random() * .50
        skills = {SKILLS[i % len(SKILLS)]}
        if i % 3 == 0:
            skills.add(SKILLS[(i + 1) % len(SKILLS)])
        shift_start = BASE + timedelta(hours=i % 3)
        resources.append(Resource(f't{i}', f'Tech {i}', Location(lat, lon),
                                  frozenset(skills), shift_start, BASE + timedelta(hours=12)))
    for i in range(n):
        lat = 12.75 + rng.random() * .50
        lon = 77.35 + rng.random() * .50
        capability = SKILLS[i % len(SKILLS)]
        if scenario == 'capability_and_availability' and i % 7 == 0:
            capability = 'unsupported'
        if scenario == 'capability_and_availability' and i % 11 == 0:
            start = BASE + timedelta(hours=13)
        elif scenario == 'one_to_many_conflicts':
            start = BASE + timedelta(hours=4 + (i % 5))
        else:
            start = BASE + timedelta(hours=4 + (i % 4))
        requests.append(Request(f'r{i}', f'Job {i}', Location(lat, lon),
                                frozenset({capability}), start, start + timedelta(hours=1),
                                (i % 5) + 1))
    return resources, requests


def validate_result(resources, requests, result, mode):
    resource_map = {r.id: r for r in resources}
    request_map = {r.id: r for r in requests}
    assigned_requests = set()
    assigned_resources = set()
    bookings = {}
    for assignment in result.assignments:
        assert assignment.request_id not in assigned_requests
        assigned_requests.add(assignment.request_id)
        r = resource_map[assignment.resource_id]
        q = request_map[assignment.request_id]
        assert q.requirements <= r.capabilities
        assert r.available_from <= q.start and q.end <= r.available_until
        if mode == 'one_to_one':
            assert r.id not in assigned_resources
            assigned_resources.add(r.id)
        else:
            for old_start, old_end in bookings.get(r.id, []):
                assert q.end <= old_start or old_end <= q.start
            bookings.setdefault(r.id, []).append((q.start, q.end))
    assert len(assigned_requests) + len(result.unassigned_request_ids) == len(requests)
    assert not assigned_requests.intersection(result.unassigned_request_ids)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sizes', nargs='+', type=int, default=[1000, 5000])
    parser.add_argument('--scenarios', nargs='+', choices=['geographic_and_skills',
        'capability_and_availability', 'one_to_many_conflicts'],
        default=['geographic_and_skills', 'capability_and_availability', 'one_to_many_conflicts'])
    parser.add_argument('--seed', type=int, default=71)
    args = parser.parse_args()
    for scenario in args.scenarios:
        for n in args.sizes:
            resources, requests = build_case(n, scenario, args.seed)
            if scenario == 'one_to_many_conflicts':
                resources = resources[:max(1, n // 4)]  # Force repeated use and schedule contention.
            mode = 'one_to_many' if scenario == 'one_to_many_conflicts' else 'one_to_one'
            started = perf_counter()
            result = scalable_allocate(resources, requests, assignment_mode=mode)
            elapsed = perf_counter() - started
            validate_result(resources, requests, result, mode)
            rss_mib = peak_process_rss_mib()
            print(json.dumps({'scenario': scenario, 'resources': len(resources), 'requests': n,
                  'mode': mode, 'assigned': len(result.assignments),
                  'coverage_pct': round(len(result.assignments) * 100/n, 2),
                  'allocator_seconds': round(elapsed, 3), 'process_peak_rss_mib': round(rss_mib, 1),
                  'constraints_valid': True}), flush=True)


if __name__ == '__main__':
    main()
