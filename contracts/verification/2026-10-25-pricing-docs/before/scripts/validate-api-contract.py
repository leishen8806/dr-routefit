"""Validate the design contract and its fixtures; this does not test a running API."""
import json
import os
import re
import sys
from pathlib import Path

if os.environ.get('ROUTEFIT_VALIDATOR_PATH'):
    sys.path.insert(0, os.environ['ROUTEFIT_VALIDATOR_PATH'])
from jsonschema import Draft202012Validator, FormatChecker
from openapi_spec_validator import validate

root = Path(__file__).resolve().parents[1]
spec = json.loads((root / 'contracts/openapi.json').read_text(encoding='utf-8'))
fixtures = json.loads((root / 'contracts/examples/schema-cases.json').read_text(encoding='utf-8'))
validate(spec)
schemas = spec['components']['schemas']
ids = set()
operation_count = 0
for path, methods in spec['paths'].items():
    for method, operation in methods.items():
        operation_count += 1
        assert operation['operationId'] not in ids, 'duplicate operationId'
        ids.add(operation['operationId'])
        assert operation['x-permissions'] and operation['x-stage']
        expected_status = 'LOCAL_IMPLEMENTED_NOT_DEPLOYED' if path.startswith('/api/ops/v1/pricing/') else 'DESIGNED_NOT_DEPLOYED'
        assert operation['x-implementation-status'] == expected_status
        assert not (path.startswith('/api/integration/') and method != 'get')
        assert not (path.startswith('/api/public/') and method != 'get')
        params = [spec['components']['parameters'][p['$ref'].split('/')[-1]] if '$ref' in p else p for p in operation['parameters']]
        assert set(re.findall(r'{(.*?)}', path)) == {p['name'] for p in params if p['in'] == 'path'}
        if method in ['post', 'patch'] and operation.get('x-idempotency') != 'AUTH_SECRET_EXCEPTION':
            assert any(p['name'] == 'Idempotency-Key' and p['required'] for p in params)
        if method != 'get' and path.startswith('/api/ops/'):
            assert any(p['name'] == 'X-CSRF-Token' and p['required'] for p in params)
        if method != 'get':
            schema = operation.get('requestBody', {}).get('content', {}).get('application/json', {}).get('schema')
            assert schema, f'missing explicit request contract: {path}'

results = []
for case in fixtures:
    schema = {'$schema': spec['jsonSchemaDialect'], '$ref': '#/components/schemas/' + case['schema'], 'components': {'schemas': schemas}}
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = list(validator.iter_errors(case['value']))
    assert bool(errors) != case['valid'], f"unexpected fixture result: {case['id']}"
    results.append(case['id'])
for name in schemas:
    assert any(c['schema'] == name and c['valid'] for c in fixtures), f'no positive fixture: {name}'
    assert any(c['schema'] == name and not c['valid'] for c in fixtures), f'no negative fixture: {name}'
summary = {'openapi': spec['openapi'], 'paths': len(spec['paths']), 'operations': operation_count, 'schemas': len(schemas), 'fixturesPassed': len(results), 'scope': 'contract syntax, schema fixtures, route metadata; no backend or KESS network tested'}
print(json.dumps(summary, ensure_ascii=False, indent=2))
