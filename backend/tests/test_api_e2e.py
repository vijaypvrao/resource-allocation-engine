"""End-to-end HTTP API scenarios against an isolated persisted store."""
from datetime import datetime
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app import main
from app import storage

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, 'DATA_FILE', tmp_path / 'store.json')
    storage.save_data([], [])
    monkeypatch.setattr(main, 'load_data', storage.load_data)
    monkeypatch.setattr(main, 'save_data', storage.save_data)
    return TestClient(app)

def resource(id='tech1', skills=None):
    return dict(id=id, name=id, lat=12.97, lng=77.59, capabilities=skills or ['electrical'],
                available_from='2026-10-08T09:00:00', available_until='2026-10-08T18:00:00')

def request(id='job1', skills=None, start='2026-10-08T10:00:00', end='2026-10-08T11:00:00', priority=3):
    return dict(id=id, title=id, lat=12.98, lng=77.60, requirements=skills or ['electrical'],
                start=start, end=end, priority=priority)

def test_full_lifecycle_and_algorithms(client):
    assert client.get('/api/health').json()['status'] == 'ok'
    assert client.post('/api/resources', json=resource()).status_code == 200
    assert client.post('/api/requests', json=request()).status_code == 200
    scenario = client.get('/api/scenario').json()
    assert len(scenario['resources']) == len(scenario['requests']) == 1
    for mode in ('one_to_one', 'one_to_many'):
        response = client.post('/api/allocate', json={'assignment_mode':mode})
        assert response.status_code == 200, response.text
        payload = response.json()
        assert len(payload['results']) == 2
        assert payload['winner'] is not None
        for result in payload['results']:
            assert result['metrics']['coverage_pct'] == 100
            assert len(result['assignments']) == 1
            assert result['assignments'][0]['resource_id'] == 'tech1'
            assert result['assignments'][0]['explanation']
    assert client.delete('/api/resources/tech1').status_code == 200
    assert client.delete('/api/requests/job1').status_code == 200
    assert client.get('/api/scenario').json() == {'resources':[], 'requests':[]}

def test_crud_validation_and_missing_objects(client):
    assert client.post('/api/resources', json=resource()).status_code == 200
    assert client.post('/api/resources', json=resource()).status_code == 409
    assert client.post('/api/resources', json={**resource('bad'), 'available_until':'2026-10-08T08:00:00'}).status_code == 400
    assert client.post('/api/requests', json=request()).status_code == 200
    assert client.post('/api/requests', json=request()).status_code == 409
    assert client.post('/api/requests', json=request('bad',priority=6)).status_code == 400
    assert client.post('/api/requests', json=request('bad',end='2026-10-08T09:00:00')).status_code == 400
    assert client.delete('/api/resources/missing').status_code == 404
    assert client.delete('/api/requests/missing').status_code == 404
    assert client.post('/api/allocate', json={'request_ids':[]}).status_code == 400
    assert client.post('/api/allocate', json={'resource_ids':[]}).status_code == 400

def test_hard_constraints_and_filters(client):
    client.post('/api/resources', json=resource())
    client.post('/api/requests', json=request('incompatible', ['plumbing']))
    client.post('/api/requests', json=request('outside', start='2026-10-08T19:00:00', end='2026-10-08T20:00:00'))
    client.post('/api/requests', json=request('valid'))
    results = client.post('/api/allocate', json={}).json()['results']
    for item in results:
        assert len(item['assignments']) == 1
        assert sorted(item['unassigned_request_ids']) == ['incompatible', 'outside']
    filtered = client.post('/api/allocate', json={'request_ids':['valid'], 'resource_ids':['tech1']}).json()
    assert all(r['metrics']['total_requests'] == 1 for r in filtered['results'])

def test_reuse_nonoverlapping_vs_overlapping(client):
    client.post('/api/resources',json=resource())
    for item in [request('a'), request('b',start='2026-10-08T11:00:00',end='2026-10-08T12:00:00'), request('c',start='2026-10-08T10:30:00',end='2026-10-08T11:30:00')]:
        client.post('/api/requests',json=item)
    for mode, count in [('one_to_one', 1), ('one_to_many', 2)]:
        for result in client.post('/api/allocate',json={'assignment_mode':mode}).json()['results']:
            assert len(result['assignments']) == count
            assert len(set(a['request_id'] for a in result['assignments'])) == count
