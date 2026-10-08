"""Optional LLM planner. All proposed assignments are validated locally."""
from __future__ import annotations

import json
import os
from urllib import request as urlrequest
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.error import HTTPError

from .allocation_common import compatible, requests_overlap, score, metrics
from .models import AllocationResult, Assignment


class LLMUnavailable(Exception):
    """A planner cannot provide a safe, usable allocation."""


# Provider names identify services; adapter names identify compatible wire protocols.
# Additional OpenAI-compatible services can use the generic identifier and an explicit URL.
PROVIDER_ADAPTERS = {
    'ollama': 'ollama',
    'openai_compatible': 'openai_compatible',
    'openai': 'openai_compatible',
    'azure_openai': 'openai_compatible',  # Only Azure endpoints exposing the standard /v1 API.
    'groq': 'openai_compatible',
    'openrouter': 'openai_compatible',
    'together': 'openai_compatible',
    'lmstudio': 'openai_compatible',
    'vllm': 'openai_compatible',
}


def _provider() -> str:
    return os.getenv('LLM_PROVIDER', 'ollama').strip().lower()


def _adapter() -> str:
    try:
        return PROVIDER_ADAPTERS[_provider()]
    except KeyError as exc:
        raise LLMUnavailable('Unsupported LLM_PROVIDER') from exc


def configured() -> bool:
    """Enable LLM routing only for explicit opt-in and a registered provider."""
    return (os.getenv('LLM_ENABLED', '').strip().lower() in ('1', 'true', 'yes')
            and bool(os.getenv('LLM_MODEL', '').strip())
            and _provider() in PROVIDER_ADAPTERS)


def _endpoint() -> str:
    adapter = _adapter()
    base = os.getenv('LLM_BASE_URL', 'http://127.0.0.1:11434' if adapter == 'ollama' else '').strip().rstrip('/')
    parsed = urlparse(base)
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise LLMUnavailable('Invalid LLM endpoint configuration')
    local = parsed.hostname in {'localhost', '127.0.0.1', '::1'}
    if parsed.scheme != 'https' and not (local and parsed.scheme == 'http'):
        raise LLMUnavailable('Remote LLM endpoints must use HTTPS')
    if adapter == 'ollama':
        if not local or parsed.path not in ('', '/'):
            raise LLMUnavailable('Ollama endpoint must be local')
        return base + '/api/chat'
    if not local and not os.getenv('LLM_API_KEY', '').strip():
        raise LLMUnavailable('Remote provider requires LLM_API_KEY')
    # Explicit /v1 endpoints are supported, including services hosted under an API prefix.
    if parsed.path.rstrip('/').endswith('/chat/completions'):
        return base
    return base + '/chat/completions' if parsed.path.rstrip('/').endswith('/v1') else base + '/v1/chat/completions'


def _proposal(resources, requests, distance_weight, priority_weight, assignment_mode, feedback=''):
    candidates = []
    for r in resources:
        for q in requests:
            if compatible(r, q):
                value, _, distance = score(r, q, distance_weight, priority_weight)
                candidates.append({'resource_id': r.id, 'request_id': q.id, 'score': round(value, 2), 'distance_km': round(distance, 2)})
    task = {
        'mode': assignment_mode,
        'requests': [{'id': q.id, 'start': q.start.isoformat(), 'end': q.end.isoformat(), 'priority': q.priority} for q in requests],
        'feasible_pairs': candidates,
        'rules': ['Only choose pairs from feasible_pairs', 'Assign each request at most once', 'In one_to_one assign each resource at most once', 'In one_to_many a resource cannot have overlapping request times', 'Prefer a higher total score; leaving a request unassigned is permitted'],
        'feedback': feedback,
    }
    schema = {'type': 'object', 'properties': {'assignments': {'type': 'array', 'items': {'type': 'object', 'properties': {'resource_id': {'type': 'string'}, 'request_id': {'type': 'string'}}, 'required': ['resource_id', 'request_id'], 'additionalProperties': False}}}, 'required': ['assignments'], 'additionalProperties': False}
    adapter = _adapter()
    messages = [
        {'role': 'system', 'content': 'You are a resource allocation planner. Return ONLY schema-valid JSON. Never invent IDs. Respect all feasibility and scheduling rules.'},
        {'role': 'user', 'content': json.dumps(task)},
    ]
    if adapter == 'ollama':
        payload = {'model': os.environ['LLM_MODEL'].strip(), 'stream': False,
                   'format': schema, 'messages': messages, 'options': {'temperature': 0}}
    else:
        payload = {'model': os.environ['LLM_MODEL'].strip(), 'stream': False,
                   'messages': messages, 'temperature': 0,
                   'response_format': {'type': 'json_object'}}
    try:
        timeout = max(1.0, min(float(os.getenv('LLM_TIMEOUT_SECONDS', '10')), 60.0))
    except ValueError as exc:
        raise LLMUnavailable('Invalid LLM_TIMEOUT_SECONDS') from exc
    headers = {'Content-Type': 'application/json'}
    if adapter == 'openai_compatible' and os.getenv('LLM_API_KEY', '').strip():
        headers['Authorization'] = 'Bearer ' + os.environ['LLM_API_KEY'].strip()
    req = urlrequest.Request(_endpoint(), data=json.dumps(payload).encode(), headers=headers, method='POST')
    try:
        with urlrequest.urlopen(req, timeout=timeout) as response:
            if response.status != 200:
                raise LLMUnavailable(f'LLM HTTP {response.status}')
            raw = response.read(1024 * 1024 + 1)
            if len(raw) > 1024 * 1024:
                raise LLMUnavailable('LLM response too large')
            message = json.loads(raw)
            content = (message['message']['content'] if adapter == 'ollama'
                       else message['choices'][0]['message']['content'])
            return json.loads(content)
    except (URLError, TimeoutError, OSError, ValueError, KeyError, TypeError, IndexError) as exc:
        raise LLMUnavailable('LLM request failed or returned malformed JSON') from exc


def _validate(proposal, resources, requests, distance_weight, priority_weight, assignment_mode):
    if not isinstance(proposal, dict) or set(proposal) != {'assignments'} or not isinstance(proposal['assignments'], list):
        raise LLMUnavailable('Invalid proposal schema')
    resource_by_id = {r.id: r for r in resources}
    request_by_id = {q.id: q for q in requests}
    seen_requests = set()
    scheduled = {}
    assignments = []
    for item in proposal['assignments']:
        if not isinstance(item, dict) or set(item) != {'resource_id', 'request_id'}:
            raise LLMUnavailable('Invalid assignment schema')
        rid, qid = item['resource_id'], item['request_id']
        if not isinstance(rid, str) or not isinstance(qid, str) or rid not in resource_by_id or qid not in request_by_id:
            raise LLMUnavailable('Unknown resource or request')
        if qid in seen_requests:
            raise LLMUnavailable('Request assigned more than once')
        r, q = resource_by_id[rid], request_by_id[qid]
        if not compatible(r, q):
            raise LLMUnavailable('Capability or availability violation')
        existing = scheduled.setdefault(rid, [])
        if assignment_mode == 'one_to_one' and existing:
            raise LLMUnavailable('One-to-one resource reused')
        if any(requests_overlap(q, other) for other in existing):
            raise LLMUnavailable('Overlapping schedule')
        value, reasons, distance = score(r, q, distance_weight, priority_weight)
        assignments.append(Assignment(qid, rid, round(value, 2), round(distance, 2), reasons + ['Suggested by configured LLM; constraints independently validated']))
        existing.append(q)
        seen_requests.add(qid)
    unassigned = [q.id for q in requests if q.id not in seen_requests]
    return AllocationResult('llm', assignments, unassigned, metrics(assignments, requests, 'llm', assignment_mode=assignment_mode))


def plan(resources, requests, distance_weight, priority_weight, assignment_mode):
    """One proposal plus one optional correction attempt; never trust model-calculated metrics."""
    feedback = ''
    for _ in range(2):
        proposal = _proposal(resources, requests, distance_weight, priority_weight, assignment_mode, feedback)
        try:
            return _validate(proposal, resources, requests, distance_weight, priority_weight, assignment_mode)
        except LLMUnavailable as exc:
            feedback = f'Previous proposal rejected: {exc}. Correct the violation.'
    raise LLMUnavailable('LLM produced invalid assignments in both attempts')
