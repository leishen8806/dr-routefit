export const caseRoutes=[
 {method:'POST',pattern:/^\/api\/customer\/v1\/service-requests$/,operation:'customerServiceRequest',kind:'create',schema:'ServiceCase',input:'ServiceRequest',permission:'portal:cases:create'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/service-requests$/,operation:'opsServiceRequestCreate',kind:'ops-create',schema:'ServiceCase',input:'OpsServiceRequest',permission:'cases:create'},
 {method:'GET',pattern:/^\/api\/customer\/v1\/service-requests$/,operation:'customerServiceRequests',kind:'customer-list',schema:'ServiceCasePage',permission:'portal:cases:read'},
 {method:'GET',pattern:/^\/api\/customer\/v1\/service-requests\/([^/]+)$/,operation:'customerServiceRequestDetail',kind:'detail',schema:'ServiceCase',permission:'portal:cases:read'},
 {method:'GET',pattern:/^\/api\/ops\/v1\/service-requests$/,operation:'opsServiceRequests',kind:'ops-list',schema:'ServiceCasePage',permission:'cases:read'},
 {method:'GET',pattern:/^\/api\/ops\/v1\/service-requests\/([^/]+)$/,operation:'opsServiceRequestDetail',kind:'detail',schema:'ServiceCase',permission:'cases:read'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/service-requests\/([^/]+)\/actions\/decide$/,operation:'decideServiceRequest',kind:'decide',schema:'ServiceCase',input:'CaseDecision',permission:'cases:decide',version:true}
];
