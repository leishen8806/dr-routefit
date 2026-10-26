export const partnerRoutes=[
 {method:'GET',pattern:/^\/api\/ops\/v1\/carrier-partners$/,operation:'listPartners',schema:'PartnerPage',kind:'list',permission:'partners:read'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/carrier-partners$/,operation:'createPartner',schema:'Partner',input:'PartnerDraft',kind:'create',permission:'partners:create'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/carrier-partners\/([^/]+)\/actions\/verify$/,operation:'partnerVerify',schema:'Partner',input:'EvidenceAction',kind:'verify',permission:'partners:verify',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/carrier-partners\/([^/]+)\/actions\/suspend$/,operation:'partnerSuspend',schema:'Partner',input:'EvidenceAction',kind:'suspend',permission:'partners:suspend',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/carrier-partners\/([^/]+)\/actions\/reinstate$/,operation:'partnerReinstate',schema:'Partner',input:'EvidenceAction',kind:'reinstate',permission:'partners:reinstate',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/carrier-partners\/([^/]+)\/actions\/exit$/,operation:'partnerExit',schema:'Partner',input:'EvidenceAction',kind:'exit',permission:'partners:exit',version:true}
];
