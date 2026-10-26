export const custodyRoutes=[
 {method:'POST',pattern:/^\/api\/ops\/v1\/custody-transfers$/,operation:'createTransfer',schema:'Transfer',input:'TransferRequest',kind:'create',permission:'custody:create'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/custody-transfers\/([^/]+)\/actions\/confirm$/,operation:'confirmTransfer',schema:'Transfer',input:'EvidenceAction',kind:'confirm',permission:'custody:confirm',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/custody-transfers\/([^/]+)\/actions\/report-discrepancy$/,operation:'transferDiscrepancy',schema:'Transfer',input:'EvidenceAction',kind:'discrepancy',permission:'custody:confirm',version:true},
 {method:'POST',pattern:/^\/api\/driver\/v1\/custody-transfers\/([^/]+)\/actions\/confirm$/,operation:'driverConfirmTransfer',schema:'Transfer',input:'EvidenceAction',kind:'driver-confirm',permission:'driver:custody:confirm',version:true}
];
