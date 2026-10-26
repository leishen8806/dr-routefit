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
        expected_status = 'LOCAL_IMPLEMENTED_NOT_DEPLOYED' if path.startswith('/api/ops/v1/pricing/') or operation['operationId'] in {'getSession','logout','listOrderCustomers','listOrders','createOrder','getOrder','orderTimeline','editOrderDraft','orderCancel','serviceAreas','createServiceArea','publishServiceArea','retireServiceArea','recordOrderIntakeEvidence','checkOrderIntake','orderSubmit','returnOrderToDraft','createQuote','getQuote','confirmQuote','createAllocationReversal','getAllocationReversal','reviewAllocationReversal','approveAllocationReversal','postAllocationReversal','customerServiceRequest','customerServiceRequests','customerServiceRequestDetail','opsServiceRequests','decideServiceRequest','prepaymentAccounts','reportPrepaymentReceipt','getPrepaymentReceipt','verifyPrepaymentReceipt','createPrepaymentAllocation','getPrepaymentAllocation','orderPaymentAdmission','reviewPrepaymentAllocation','approvePrepaymentAllocation','postPrepaymentAllocation','financeReceipts','getFinanceReceipt','ledgerItems','getFinanceLedgerItem','financeDocuments','draftFinanceDocument','financeDocument','documentSubmit','documentReview','documentApprove','documentReject','documentPost','customerSession','customerOrders','customerOrder','customerTimeline','customerReceipts','customerLedgerItems','customerQuote','customerConfirmQuote','customerCreateOrder','customerSubmitOrder','dispatchBoard','listVehicles','dispatchCandidates','checkPromise','createPromise','promiseHistory','createLoadReview','createAssignment','revokeAssignment','reassignAssignment','driverAssignments','driverAssignment','driverOrder','driverAccept','driverReject','driverDepart','recordRecipientAuthorization','driverRecipientAuthorization','createTransfer','confirmTransfer','transferDiscrepancy','driverConfirmTransfer','listExceptions','createException','exceptionAssign','exceptionResolve','exceptionClose','listPartners','createPartner','partnerVerify','partnerSuspend','partnerReinstate','partnerExit','createBooking','getBooking','bookingRequest','bookingConfirm','bookingVerifyDelivery','bookingRequestCancel','bookingConfirmCancel','carrierEvent','opsUpload','opsCompleteUpload','opsEvidenceDownload'} else 'DESIGNED_NOT_DEPLOYED'
        if operation['operationId'] in {'driverLocations','driverSync','driverDelivery','driverUpload','driverCompleteUpload','driverEvidenceDownload','customerUpload','customerCompleteUpload','customerEvidenceDownload','reportReceipt','confirmReceipt','customerReceiptReport','ledgerReport','customerReport','moneyOverview','createReturn','returnAuthorize','returnReceive','returnInspect','returnClose','opsSnapshot','publicTracking','warehouseQueue','financeTasks','holdFinanceTask','readFinanceTask','listInbound','acceptInbound','listOutbound','acceptOutbound','reserveStock','stockRelease','stockConsume','customerInventory','customerInboundNotices','createInboundNotices','getInboundNotices','getOutboundRequests','customerOutboundRequests','createOutboundRequests','sendNotification','notificationStatus','retryNotification','accessGrants','createAccessGrant','revokeAccessGrant','bankTransactions','registerBankTransaction','cashHandovers','countCash','driverCashReport','driverHandover','driverHandovers','driverIncome','driverWithdrawal','driverWithdrawals','getFinanceCashHandover','settlementRules','createSettlementRule','previewSettlementRule','activateSettlementRule','financeStatements','generateStatement','financeStatement','statementReview','statementApprove','statementIssue','customerStatements','customerStatement','customerAcknowledgeStatement','customerSettlementAccounts','requestCustomerRefund','customerFinanceRequests','opsSettlementAccounts','driverSettlementAccounts','warehouseImportOrder','warehouseImportStatus','warehouseDispatchRequest','externalImportOrder','externalImportStatus','externalDispatchRequest','wmsStockEvent','customerMembers','inviteCustomerMember','customerMemberSuspend','customerMemberRevoke','merchantLedger','merchantStatements','merchantSettlementRequest','merchantSettlements','merchantSettlementAccounts','partnerLedger','partnerStatements','partnerSettlementRequest','partnerSettlements','partnerSettlementAccounts','exportFinance','getFinanceExport'}: expected_status = 'LOCAL_IMPLEMENTED_NOT_DEPLOYED'
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
operation_examples = 0
for path, methods in spec['paths'].items():
    for operation in methods.values():
        if operation['x-implementation-status'] != 'LOCAL_IMPLEMENTED_NOT_DEPLOYED':
            continue
        bodies = [operation.get('requestBody', {})] + list(operation['responses'].values())
        for body in bodies:
            media = body.get('content', {}).get('application/json', {})
            for name, example in media.get('examples', {}).items():
                schema = {**media['schema'], '$schema': spec['jsonSchemaDialect'], 'components': {'schemas': schemas}}
                errors = list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(example['value']))
                assert not errors, f"invalid operation example: {operation['operationId']}/{name}"
                operation_examples += 1
summary = {'openapi': spec['openapi'], 'paths': len(spec['paths']), 'operations': operation_count, 'schemas': len(schemas), 'fixturesPassed': len(results), 'operationExamplesPassed': operation_examples, 'scope': 'contract syntax, schema fixtures, operation examples, route metadata; no backend or KESS network tested'}
print(json.dumps(summary, ensure_ascii=False, indent=2))
