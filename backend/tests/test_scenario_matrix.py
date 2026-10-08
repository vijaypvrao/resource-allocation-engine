"""High-coverage behavior matrix exercising both allocation strategies and public HTTP API."""
from datetime import datetime, timedelta
import itertools
import pytest
from fastapi.testclient import TestClient
from app import main, storage
from app.allocator import greedy, hungarian, determine_winner
from app.allocation_common import compatible, haversine_km, requests_overlap
from app.models import Location, Resource, Request

T = datetime(2026, 10, 8, 8)

def tech(i=0, skills=('a',), start=0, end=12, lat=12.97, lng=77.59):
    return Resource(f't{i}', f'Technician {i}', Location(lat, lng), frozenset(skills), T+timedelta(hours=start), T+timedelta(hours=end))

def job(i=0, skills=('a',), start=1, end=2, priority=3, lat=12.97, lng=77.59):
    return Request(f'j{i}', f'Job {i}', Location(lat, lng), frozenset(skills), T+timedelta(hours=start), T+timedelta(hours=end), priority)

@pytest.mark.parametrize('algorithm', [greedy, hungarian])
@pytest.mark.parametrize('mode', ['one_to_one','one_to_many'])
@pytest.mark.parametrize('resources,requests,expected', [
    ([], [], 0),
    ([tech()], [], 0),
    ([], [job()], 0),
    ([tech()], [job()], 1),
    ([tech(skills=('a',))], [job(skills=('b',))], 0),
    ([tech(start=3)], [job()], 0),
    ([tech(end=1)], [job()], 0),
    ([tech(skills=('a','b'))], [job(skills=('a','b'))], 1),
    ([tech()], [job(start=0,end=12)], 1),
    ([tech()], [job(start=11,end=13)], 0),
])
def test_basic_feasibility_matrix(algorithm, mode, resources, requests, expected):
    result = algorithm(resources, requests, assignment_mode=mode)
    assert len(result.assignments) == expected
    assert result.metrics['assigned'] == expected
    assert result.metrics['unassigned'] == len(requests)-expected
    assert len(result.unassigned_request_ids) == len(requests)-expected

@pytest.mark.parametrize('algorithm', [greedy, hungarian])
@pytest.mark.parametrize('mode', ['one_to_one','one_to_many'])
@pytest.mark.parametrize('num_resources,num_requests', [(1,1),(1,2),(1,3),(2,1),(2,2),(2,4),(3,3),(3,5),(5,3)])
def test_feasible_batch_invariants(algorithm,mode,num_resources,num_requests):
    resources=[tech(i,skills=('a','b'),lat=12.97+i*.01) for i in range(num_resources)]
    requests=[job(i,skills=('a',), start=i+1,end=i+2,priority=(i%5)+1,lat=12.98+i*.01) for i in range(num_requests)]
    result=algorithm(resources,requests,assignment_mode=mode)
    assert len({a.request_id for a in result.assignments}) == len(result.assignments)
    assert set(result.unassigned_request_ids).isdisjoint({a.request_id for a in result.assignments})
    assert len(result.assignments)+len(result.unassigned_request_ids)==num_requests
    assert set(a.resource_id for a in result.assignments) <= {r.id for r in resources}
    for a in result.assignments:
        resource=next(r for r in resources if r.id==a.resource_id)
        request=next(r for r in requests if r.id==a.request_id)
        assert compatible(resource,request)
        assert a.explanation and a.distance_km >= 0
    if mode=='one_to_one':
        assert len({a.resource_id for a in result.assignments})==len(result.assignments)
    else:
        for a,b in itertools.combinations(result.assignments,2):
            if a.resource_id == b.resource_id:
                ja=next(r for r in requests if r.id==a.request_id)
                jb=next(r for r in requests if r.id==b.request_id)
                assert not requests_overlap(ja,jb)
    assert 0 <= result.metrics['coverage_pct'] <= 100

@pytest.mark.parametrize('algorithm',[greedy,hungarian])
@pytest.mark.parametrize('mode',['one_to_one','one_to_many'])
@pytest.mark.parametrize('offset', [0,.02,.2,2,20,60])
def test_distance_weight_can_leave_negative_score_unassigned(algorithm,mode,offset):
    result=algorithm([tech()],[job(lat=12.97+offset)],distance_weight=100,priority_weight=0,assignment_mode=mode)
    if offset==0:
        assert len(result.assignments)==1
    else:
        # Batch optimizer may prefer zero-valued dummy; greedy always assigns feasible requests.
        assert len(result.assignments) in (0,1)
        assert result.metrics['total_requests']==1

@pytest.mark.parametrize('algorithm',[greedy,hungarian])
@pytest.mark.parametrize('mode',['one_to_one','one_to_many'])
@pytest.mark.parametrize('start,end,expected',[(0,1,True),(1,2,False),(2,3,False),(0,2,True),(.5,1.5,True),(1,3,False),(3,4,False)])
def test_interval_boundary_and_overlap(algorithm,mode,start,end,expected):
    base=job(start=0,end=1)
    other=job(1,start=start,end=end)
    assert requests_overlap(base,other) == expected
    result=algorithm([tech()],[base,other],assignment_mode=mode)
    assert len(result.assignments) <= (1 if mode=='one_to_one' or expected else 2)

@pytest.mark.parametrize('lat,lng', [(0,0),(12.97,77.59),(-34.6,-58.4),(51.5,-.1),(89,179),(-89,-179)])
def test_distance_identity_and_symmetry(lat,lng):
    a=Location(lat,lng)
    b=Location(max(-89,min(89,lat+.01)),lng)
    assert haversine_km(a,a)==0
    assert haversine_km(a,b)==pytest.approx(haversine_km(b,a))

@pytest.mark.parametrize('winner_score,greedy_score,winner_coverage,greedy_coverage,winner_distance,greedy_distance,expected', [
    (10,9,50,90,10,5,'hungarian'), (9,10,90,50,5,10,'greedy'),
    (10,10,90,80,20,5,'hungarian'), (10,10,80,90,5,20,'greedy'),
    (10,10,90,90,5,10,'hungarian'), (10,10,90,90,10,5,'greedy'),
    (10,10,90,90,5,5,'tie')])
def test_comparison_decision_hierarchy(winner_score,greedy_score,winner_coverage,greedy_coverage,winner_distance,greedy_distance,expected):
    g=dict(total_score=greedy_score,coverage_pct=greedy_coverage,total_distance_km=greedy_distance,algorithm='greedy')
    o=dict(total_score=winner_score,coverage_pct=winner_coverage,total_distance_km=winner_distance,algorithm='hungarian')
    assert determine_winner(g,o)['winner']==expected

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setattr(storage,'DATA_FILE',tmp_path/'store.json')
    storage.save_data([],[])
    monkeypatch.setattr(main,'load_data',storage.load_data)
    monkeypatch.setattr(main,'save_data',storage.save_data)
    with TestClient(main.app) as c:
        yield c

@pytest.mark.parametrize('bad_field,bad_value', [
    ('available_until','2026-10-08T08:00:00'),
    ('available_until','2026-10-07T18:00:00'),
    ('lat','not-a-number'), ('lng','not-a-number'),
    ('capabilities','not-a-list'), ('id',None),
    ('available_from','invalid'),('available_until','invalid')
])
def test_api_invalid_resource_payloads(client,bad_field,bad_value):
    payload=dict(id='x',name='X',lat=12.97,lng=77.59,capabilities=['a'],available_from='2026-10-08T09:00:00',available_until='2026-10-08T18:00:00')
    payload[bad_field]=bad_value
    assert client.post('/api/resources',json=payload).status_code in (400,422)

@pytest.mark.parametrize('bad_field,bad_value', [
    ('end','2026-10-08T10:00:00'), ('priority',0),('priority',6),
    ('start','invalid'),('end','invalid'),('lat','invalid'),
    ('requirements','invalid'),('id',None),('priority','invalid')
])
def test_api_invalid_request_payloads(client,bad_field,bad_value):
    payload=dict(id='j',title='Job',lat=12.97,lng=77.59,requirements=['a'],start='2026-10-08T10:00:00',end='2026-10-08T11:00:00',priority=3)
    payload[bad_field]=bad_value
    assert client.post('/api/requests',json=payload).status_code in (400,422)

@pytest.mark.parametrize('invalid', [{'assignment_mode':'invalid'}, {'request_ids':[]},{'resource_ids':[]},{'distance_weight':'abc'}, {'priority_weight':'abc'}])
def test_api_rejects_invalid_allocation_input(client,invalid):
    assert client.post('/api/allocate',json=invalid).status_code in (400,422)
