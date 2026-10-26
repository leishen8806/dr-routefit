export const intakeRoutes=[
 {method:'GET',pattern:/^\/api\/ops\/v1\/service-areas$/,operation:'serviceAreas',schema:'ServiceAreaPage',kind:'areas',permission:'areas:read'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/service-areas$/,operation:'createServiceArea',schema:'ServiceArea',input:'ServiceAreaDraft',kind:'area-create',permission:'areas:create'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/service-areas\/([^/]+)\/actions\/publish$/,operation:'publishServiceArea',schema:'ServiceArea',input:'IntakeReason',kind:'area-publish',permission:'areas:publish',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/service-areas\/([^/]+)\/actions\/retire$/,operation:'retireServiceArea',schema:'ServiceArea',input:'IntakeReason',kind:'area-retire',permission:'areas:publish',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)\/intake-evidence$/,operation:'recordOrderIntakeEvidence',schema:'OrderIntakeEvidence',input:'OrderIntakeInput',kind:'intake-evidence',permission:'orders:verify',version:true,order:true},
 {method:'GET',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)\/intake-check$/,operation:'checkOrderIntake',schema:'OrderIntakeCheck',kind:'intake-check',permission:'orders:read',order:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)\/actions\/submit$/,operation:'orderSubmit',schema:'OrderDetail',input:'EmptyCommand',kind:'intake-submit',permission:'orders:submit',version:true,order:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)\/actions\/return-to-draft$/,operation:'returnOrderToDraft',schema:'OrderDetail',input:'IntakeReason',kind:'intake-return',permission:'orders:edit',version:true,order:true}
];
