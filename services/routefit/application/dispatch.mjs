export const dispatchRoutes=[
 {method:'GET',pattern:/^\/api\/ops\/v1\/dispatch\/board$/,operation:'dispatchBoard',schema:'DispatchBoard',kind:'board',permission:'dispatch:read'},
 {method:'GET',pattern:/^\/api\/ops\/v1\/vehicles$/,operation:'listVehicles',schema:'VehiclePage',kind:'vehicles',permission:'fleet:read'},
 {method:'GET',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)\/dispatch-candidates$/,operation:'dispatchCandidates',schema:'CandidatePage',kind:'candidates',permission:'dispatch:read'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)\/promise-checks$/,operation:'checkPromise',schema:'PromiseCheck',input:'PromiseCheckRequest',kind:'promise-check',permission:'promise:check',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)\/promises$/,operation:'createPromise',schema:'Promise',input:'PromiseRequest',kind:'promise-create',permission:'promise:create',version:true},
 {method:'GET',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)\/promises$/,operation:'promiseHistory',schema:'PromisePage',kind:'promise-history',permission:'orders:read'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)\/load-reviews$/,operation:'createLoadReview',schema:'LoadReview',input:'LoadReviewRequest',kind:'load-review',permission:'load:review',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)\/assignments$/,operation:'createAssignment',schema:'Assignment',input:'AssignmentRequest',kind:'assignment-create',permission:'dispatch:offer',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/assignments\/([^/]+)\/actions\/revoke$/,operation:'revokeAssignment',schema:'Assignment',input:'EvidenceAction',kind:'assignment-revoke',permission:'dispatch:revoke',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/assignments\/([^/]+)\/actions\/reassign$/,operation:'reassignAssignment',schema:'Assignment',input:'AssignmentRequest',kind:'assignment-reassign',permission:'dispatch:reassign',version:true}
];
