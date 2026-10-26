export const warehouseRoutes=[
 {method:'GET',pattern:/^\/api\/ops\/v1\/warehouse\/queue$/,operation:'warehouseQueue',schema:'OrderSummaryPage',kind:'queue',permission:'warehouse:read'},
 {method:'GET',pattern:/^\/api\/ops\/v1\/warehouse\/inbound-requests$/,operation:'listInbound',schema:'WarehouseRequestPage',kind:'inbound',permission:'warehouse:read'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/warehouse\/inbound-requests\/([^/]+)\/actions\/accept$/,operation:'acceptInbound',schema:'WarehouseRequest',input:'EvidenceAction',kind:'inbound-accept',permission:'warehouse:accept',version:true},
 {method:'GET',pattern:/^\/api\/ops\/v1\/warehouse\/outbound-requests$/,operation:'listOutbound',schema:'WarehouseRequestPage',kind:'outbound',permission:'warehouse:read'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/warehouse\/outbound-requests\/([^/]+)\/actions\/accept$/,operation:'acceptOutbound',schema:'WarehouseRequest',input:'EvidenceAction',kind:'outbound-accept',permission:'warehouse:accept',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/inventory-reservations$/,operation:'reserveStock',schema:'StockReservation',input:'ReservationRequest',kind:'inventory-reserve',permission:'inventory:reserve'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/inventory-reservations\/([^/]+)\/actions\/release$/,operation:'stockRelease',schema:'StockReservation',input:'EvidenceAction',kind:'inventory-release',permission:'inventory:release',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/inventory-reservations\/([^/]+)\/actions\/consume$/,operation:'stockConsume',schema:'StockReservation',input:'EvidenceAction',kind:'inventory-consume',permission:'inventory:consume',version:true}
];
