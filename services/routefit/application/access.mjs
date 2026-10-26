export const accessRoutes=[
 {method:'GET',pattern:/^\/api\/ops\/v1\/access-grants$/,operation:'accessGrants',schema:'AccessGrantPage',kind:'list',permission:'access:read'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/access-grants$/,operation:'createAccessGrant',schema:'AccessGrant',input:'AccessGrantDraft',kind:'create',permission:'access:grant'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/access-grants\/([^/]+)\/actions\/revoke$/,operation:'revokeAccessGrant',schema:'AccessGrant',input:'Reason',kind:'revoke',permission:'access:revoke',version:true}
];
