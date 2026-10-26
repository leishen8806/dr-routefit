export const returnRoutes=[
 {method:'POST',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)\/return-tasks$/,operation:'createReturn',schema:'ReturnTask',input:'ReturnRequest',kind:'create',permission:'returns:create',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/return-tasks\/([^/]+)\/actions\/authorize$/,operation:'returnAuthorize',schema:'ReturnTask',input:'EvidenceAction',kind:'authorize',permission:'returns:authorize',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/return-tasks\/([^/]+)\/actions\/receive$/,operation:'returnReceive',schema:'ReturnTask',input:'ReturnReceipt',kind:'receive',permission:'returns:receive',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/return-tasks\/([^/]+)\/actions\/inspect$/,operation:'returnInspect',schema:'ReturnTask',input:'ReturnInspection',kind:'inspect',permission:'returns:inspect',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/return-tasks\/([^/]+)\/actions\/close$/,operation:'returnClose',schema:'ReturnTask',input:'EvidenceAction',kind:'close',permission:'returns:close',version:true}
];
