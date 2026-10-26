export const deliveryRoutes=[
 {method:'POST',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)\/recipient-authorizations$/,operation:'recordRecipientAuthorization',schema:'RecipientAuthorization',input:'EvidenceAction',kind:'authorize',permission:'delivery:recipient:verify',version:true},
 {method:'GET',pattern:/^\/api\/driver\/v1\/orders\/([^/]+)\/recipient-authorization$/,operation:'driverRecipientAuthorization',schema:'RecipientAuthorization',kind:'driver-read',permission:'driver:tasks:read'},
 {method:'POST',pattern:/^\/api\/driver\/v1\/orders\/([^/]+)\/delivery-records$/,operation:'driverDelivery',schema:'OrderSummary',input:'DeliveryRequest',kind:'driver-record',permission:'driver:delivery:record',version:true}
];
