export const exceptionRoutes=[
 {method:'POST',pattern:/^\/api\/ops\/v1\/orders\/([0-9a-f-]+)\/incident-transfers$/,operation:'createRescuePlan',schema:'RescuePlan',input:'RescueRequest',kind:'rescue-create',permission:'incident:dispatch',version:true},
 {method:'GET',pattern:/^\/api\/ops\/v1\/exceptions$/,operation:'listExceptions',schema:'ExceptionPage',kind:'list',permission:'exceptions:read'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/exceptions$/,operation:'createException',schema:'Exception',input:'ExceptionRequest',kind:'create',permission:'exceptions:create'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/exceptions\/([^/]+)\/actions\/assign$/,operation:'exceptionAssign',schema:'Exception',input:'AssignOwner',kind:'assign',permission:'exceptions:assign',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/exceptions\/([^/]+)\/actions\/resolve$/,operation:'exceptionResolve',schema:'Exception',input:'EvidenceAction',kind:'resolve',permission:'exceptions:resolve',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/exceptions\/([^/]+)\/actions\/close$/,operation:'exceptionClose',schema:'Exception',input:'EvidenceAction',kind:'close',permission:'exceptions:close',version:true}
];
