"""Local LLM safety and fallback regression tests; no Ollama process required."""
import json
from datetime import datetime, timedelta
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from app import llm_strategy
from app.main import app
from app.models import Location, Resource, Request, AllocationResult

START = datetime(2026, 10, 8, 9)
def fixture():
    resources = [Resource('r1', 'Multiskilled', Location(12, 77), frozenset({'a','b'}), START, START + timedelta(hours=8)), Resource('r2', 'Specialist', Location(12, 77), frozenset({'a'}), START, START + timedelta(hours=8))]
    requests = [Request('q1', 'One', Location(12,77), frozenset({'a'}), START, START + timedelta(hours=1), 3), Request('q2','Two',Location(12,77),frozenset({'b'}), START, START + timedelta(hours=1), 2)]
    return resources, requests

@pytest.mark.parametrize('enabled,model,expected', [('','m',False),('true','',False),('true','m',True),('FALSE','m',False),('1','m',True)])
def test_opt_in(monkeypatch, enabled, model, expected):
    monkeypatch.setenv('LLM_ENABLED', enabled)
    monkeypatch.setenv('LLM_MODEL',model)
    assert llm_strategy.configured() is expected

@pytest.mark.parametrize('url', ['https://example.org','http://example.org:11434','http://127.0.0.1:11434/other','file:///tmp/abc','http://user:pass@localhost:11434'])
def test_nonlocal_endpoints_rejected(monkeypatch,url):
    monkeypatch.setenv('LLM_BASE_URL',url)
    with pytest.raises(llm_strategy.LLMUnavailable): llm_strategy._endpoint()

@pytest.mark.parametrize('mode,items,valid', [
    ('one_to_one',[('r1','q1'),('r2','q2')],False),
    ('one_to_one',[('r2','q1'),('r1','q2')],True),
    ('one_to_one',[('r1','q1'),('r1','q2')],False),
    ('one_to_many',[('r1','q1'),('r1','q2')],False),
    ('one_to_one',[('r1','q1'),('r2','q1')],False),
    ('one_to_one',[('bad','q1')],False),
    ('one_to_one',[('r1','bad')],False),
    ('one_to_one',[],True),
])
def test_proposal_constraints(mode,items,valid):
    resources, requests = fixture()
    obj = {'assignments': [{'resource_id':r,'request_id':q} for r,q in items]}
    if valid:
        result=llm_strategy._validate(obj,resources,requests,1,2,mode)
        assert result.metrics['assigned']==len(items)
        assert result.metrics['unassigned']==len(requests)-len(items)
    else:
        with pytest.raises(llm_strategy.LLMUnavailable): llm_strategy._validate(obj,resources,requests,1,2,mode)

@pytest.mark.parametrize('obj', [None,[],{}, {'assignments':None}, {'assignments':[1]}, {'assignments':[{'resource_id':'r1'}]}, {'assignments':[], 'extra':1}])
def test_invalid_schema(obj):
    r,q=fixture()
    with pytest.raises(llm_strategy.LLMUnavailable): llm_strategy._validate(obj,r,q,1,2,'one_to_one')

def test_one_to_many_adjacent_allowed():
    r,q=fixture()
    q[1] = Request('q2','Two',Location(12,77),frozenset({'b'}),START+timedelta(hours=1),START+timedelta(hours=2),2)
    result=llm_strategy._validate({'assignments':[{'resource_id':'r1','request_id':'q1'},{'resource_id':'r1','request_id':'q2'}]},r,q,1,2,'one_to_many')
    assert len(result.assignments)==2

def test_two_attempt_correction():
    r,q=fixture()
    with patch.object(llm_strategy,'_proposal',side_effect=[{'assignments':[{'resource_id':'r2','request_id':'q2'}]},{'assignments':[{'resource_id':'r2','request_id':'q1'},{'resource_id':'r1','request_id':'q2'}]}]) as mock:
        assert llm_strategy.plan(r,q,1,2,'one_to_one').metrics['assigned']==2
        assert mock.call_count == 2

def test_two_invalid_attempts_fallback():
    r,q=fixture()
    with patch.object(llm_strategy,'_proposal',return_value={'assignments':[{'resource_id':'r2','request_id':'q2'}]}):
        with pytest.raises(llm_strategy.LLMUnavailable): llm_strategy.plan(r,q,1,2,'one_to_one')

def test_api_llm_failure_fallback(monkeypatch):
    monkeypatch.setenv('LLM_ENABLED','true'); monkeypatch.setenv('LLM_MODEL','mock-model')
    with patch('app.main.llm_strategy.plan',side_effect=llm_strategy.LLMUnavailable('offline')):
        response = TestClient(app).post('/api/allocate',json={})
    assert response.status_code == 200
    data=response.json()
    assert [r['algorithm'] for r in data['results']] == ['greedy','hungarian']
    assert data['llm_status']['attempted'] is True
    assert data['llm_status']['fallback_reason']=='offline'

def test_api_llm_success(monkeypatch):
    monkeypatch.setenv('LLM_ENABLED','true'); monkeypatch.setenv('LLM_MODEL','mock-model')
    with patch('app.main.llm_strategy.plan') as mocked:
        mocked.return_value=AllocationResult('llm',[],[],{'algorithm':'llm','assigned':0})
        data=TestClient(app).post('/api/allocate',json={}).json()
    assert len(data['results'])==1
    assert data['results'][0]['algorithm']=='llm'
    assert data['winner'] is None
    assert data['llm_status']['used'] is True

def test_api_explicit_disable(monkeypatch):
    monkeypatch.setenv('LLM_ENABLED','true'); monkeypatch.setenv('LLM_MODEL','mock-model')
    with patch('app.main.llm_strategy.plan') as mocked:
        data=TestClient(app).post('/api/allocate',json={'use_llm':False}).json()
    mocked.assert_not_called()
    assert data['llm_status']['attempted'] is False


def test_api_without_configuration_uses_local(monkeypatch):
    monkeypatch.delenv('LLM_ENABLED', raising=False)
    monkeypatch.delenv('LLM_MODEL', raising=False)
    with patch('app.main.llm_strategy.plan') as mocked:
        data = TestClient(app).post('/api/allocate', json={}).json()
    mocked.assert_not_called()
    assert [r['algorithm'] for r in data['results']] == ['greedy', 'hungarian']
    assert data['llm_status']['used'] is False


def test_online_provider_https_and_key(monkeypatch):
    monkeypatch.setenv('LLM_PROVIDER', 'openai_compatible')
    monkeypatch.setenv('LLM_BASE_URL', 'https://example.org/v1')
    monkeypatch.setenv('LLM_API_KEY', 'dummy-value')
    assert llm_strategy._endpoint() == 'https://example.org/v1/chat/completions'
    monkeypatch.delenv('LLM_API_KEY')
    with pytest.raises(llm_strategy.LLMUnavailable):
        llm_strategy._endpoint()
    monkeypatch.setenv('LLM_BASE_URL', 'http://example.org/v1')
    with pytest.raises(llm_strategy.LLMUnavailable):
        llm_strategy._endpoint()

@pytest.mark.parametrize('provider,adapter', sorted(llm_strategy.PROVIDER_ADAPTERS.items()))
def test_provider_registry_and_opt_in(monkeypatch, provider, adapter):
    monkeypatch.setenv('LLM_ENABLED', 'true')
    monkeypatch.setenv('LLM_MODEL', 'model-id')
    monkeypatch.setenv('LLM_PROVIDER', provider)
    assert llm_strategy.configured()
    assert llm_strategy._adapter() == adapter


@pytest.mark.parametrize('provider', ['unknown', 'anthropic', 'gemini', ''])
def test_unsupported_provider_uses_deterministic_path(monkeypatch, provider):
    monkeypatch.setenv('LLM_ENABLED', 'true')
    monkeypatch.setenv('LLM_MODEL', 'model-id')
    monkeypatch.setenv('LLM_PROVIDER', provider)
    assert not llm_strategy.configured()
    with pytest.raises(llm_strategy.LLMUnavailable):
        llm_strategy._adapter()


@pytest.mark.parametrize('provider', ['openai', 'groq', 'openrouter', 'together', 'lmstudio', 'vllm', 'azure_openai', 'openai_compatible'])
def test_compatible_provider_endpoint(monkeypatch, provider):
    monkeypatch.setenv('LLM_PROVIDER', provider)
    monkeypatch.setenv('LLM_BASE_URL', 'https://example.org/v1')
    monkeypatch.setenv('LLM_API_KEY', 'test-key')
    assert llm_strategy._endpoint() == 'https://example.org/v1/chat/completions'


def test_named_provider_uses_openai_compatible_wire_format(monkeypatch):
    monkeypatch.setenv('LLM_PROVIDER', 'groq')
    monkeypatch.setenv('LLM_MODEL', 'example-model')
    monkeypatch.setenv('LLM_BASE_URL', 'https://example.org/openai/v1')
    monkeypatch.setenv('LLM_API_KEY', 'test-key')
    resources, requests = fixture()

    class FakeResponse:
        status = 200
        def __enter__(self): return self
        def __exit__(self, *args): return False
        def read(self, _limit):
            content = json.dumps({'assignments': [{'resource_id':'r2', 'request_id':'q1'}, {'resource_id':'r1', 'request_id':'q2'}]})
            return json.dumps({'choices': [{'message': {'content': content}}]}).encode()

    def fake_open(req, timeout):
        assert req.full_url == 'https://example.org/openai/v1/chat/completions'
        assert req.get_header('Authorization') == 'Bearer test-key'
        payload = json.loads(req.data)
        assert payload['model'] == 'example-model'
        assert payload['response_format'] == {'type': 'json_object'}
        return FakeResponse()

    with patch.object(llm_strategy.urlrequest, 'urlopen', side_effect=fake_open):
        result = llm_strategy.plan(resources, requests, 1, 2, 'one_to_one')
    assert result.metrics['assigned'] == 2
    assert result.algorithm == 'llm'


def test_named_provider_requires_key_for_remote_endpoint(monkeypatch):
    monkeypatch.setenv('LLM_PROVIDER', 'openrouter')
    monkeypatch.setenv('LLM_BASE_URL', 'https://example.org/v1')
    monkeypatch.delenv('LLM_API_KEY', raising=False)
    with pytest.raises(llm_strategy.LLMUnavailable, match='LLM_API_KEY'):
        llm_strategy._endpoint()
