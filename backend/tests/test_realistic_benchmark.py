"""Validate workload generation and constraint checks used by the benchmark."""
import pytest
from benchmark_realistic import build_case, validate_result
from app.scalable_strategy import scalable_allocate


@pytest.mark.parametrize('scenario', [
    'geographic_and_skills', 'capability_and_availability', 'one_to_many_conflicts'
])
def test_realistic_scenarios_keep_hard_constraints(scenario):
    resources, requests = build_case(120, scenario, 71)
    if scenario == 'one_to_many_conflicts':
        resources = resources[:30]
    mode = 'one_to_many' if scenario == 'one_to_many_conflicts' else 'one_to_one'
    result = scalable_allocate(resources, requests, assignment_mode=mode)
    validate_result(resources, requests, result, mode)
    assert result.metrics['optimality_guaranteed'] is False
    if scenario == 'capability_and_availability':
        assert result.unassigned_request_ids
    if scenario == 'one_to_many_conflicts':
        assert len(result.assignments) > len(resources)
