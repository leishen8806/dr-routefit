export const bookingRoutes=[
 {method:'POST',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)\/carrier-bookings$/,operation:'createBooking',schema:'Booking',input:'BookingRequest',kind:'create',permission:'bookings:create',version:true},
 {method:'GET',pattern:/^\/api\/ops\/v1\/carrier-bookings\/([^/]+)$/,operation:'getBooking',schema:'Booking',kind:'detail',permission:'bookings:read'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/carrier-bookings\/([^/]+)\/actions\/request$/,operation:'bookingRequest',schema:'Booking',input:'Reason',kind:'request',permission:'bookings:request',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/carrier-bookings\/([^/]+)\/actions\/confirm$/,operation:'bookingConfirm',schema:'Booking',input:'BookingConfirm',kind:'confirm',permission:'bookings:confirm',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/carrier-bookings\/([^/]+)\/actions\/verify-delivery$/,operation:'bookingVerifyDelivery',schema:'Booking',input:'EvidenceAction',kind:'verify-delivery',permission:'bookings:verify-delivery',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/carrier-bookings\/([^/]+)\/actions\/request-cancel$/,operation:'bookingRequestCancel',schema:'Booking',input:'Reason',kind:'request-cancel',permission:'bookings:request-cancel',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/carrier-bookings\/([^/]+)\/actions\/confirm-cancel$/,operation:'bookingConfirmCancel',schema:'Booking',input:'EvidenceAction',kind:'confirm-cancel',permission:'bookings:confirm-cancel',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/carrier-bookings\/([^/]+)\/events$/,operation:'carrierEvent',schema:'Booking',input:'CarrierEvent',kind:'event',permission:'bookings:event',version:true}
];
