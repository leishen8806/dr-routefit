// CMP-1708: ops roles / staff routes. Methods, paths, operationIds and permissions mirror contracts/openapi.json.
export const opsRolesStaffRoutes=[
 {method:'POST',pattern:/^\/api\/ops\/v1\/roles\/([^/]+)\/actions\/set-permissions$/,operation:'setRolePermissions',schema:'Role',input:'RoleSetPermissions',kind:'role-set-permissions',permission:'roles:write',version:true},
 {method:'GET',pattern:/^\/api\/ops\/v1\/permission-catalog$/,operation:'getPermissionCatalog',schema:'PermissionCatalog',kind:'permission-catalog',permission:'roles:read'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/staff\/([^/]+)\/actions\/disable$/,operation:'disableStaff',schema:'Staff',input:'StaffStateAction',kind:'disable',permission:'staff:write',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/staff\/([^/]+)\/actions\/enable$/,operation:'enableStaff',schema:'Staff',input:'StaffStateAction',kind:'enable',permission:'staff:write',version:true},
 {method:'PATCH',pattern:/^\/api\/ops\/v1\/staff\/([^/]+)$/,operation:'patchStaff',schema:'Staff',input:'StaffUpdate',kind:'patch',permission:'staff:write',version:true}
];
