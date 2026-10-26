export const orderRoutes=[
 {method:'GET',pattern:/^\/api\/ops\/v1\/session$/,operation:'getSession',schema:'Session',kind:'session',permission:'session:read'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/session\/actions\/logout$/,operation:'logout',input:'EmptyCommand',kind:'logout',permission:'session:logout'},
 {method:'GET',pattern:/^\/api\/ops\/v1\/customers$/,operation:'listOrderCustomers',schema:'OrderCustomerPage',kind:'customers',permission:'orders:read'},
 {method:'GET',pattern:/^\/api\/ops\/v1\/orders$/,operation:'listOrders',schema:'OrderSummaryPage',kind:'orders',permission:'orders:read'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/orders$/,operation:'createOrder',schema:'OrderDetail',input:'OrderDraft',kind:'order-create',permission:'orders:create'},
 {method:'GET',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)$/,operation:'getOrder',schema:'OrderDetail',kind:'order',permission:'orders:read'},
 {method:'GET',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)\/timeline$/,operation:'orderTimeline',schema:'TimelineEventPage',kind:'timeline',permission:'orders:read'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)\/actions\/cancel$/,operation:'orderCancel',schema:'OrderDetail',input:'EvidenceAction',kind:'order-cancel',version:true,permission:'orders:cancel'},
 {method:'PATCH',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)$/,operation:'editOrderDraft',schema:'OrderDetail',input:'OrderDraft',kind:'order-edit',version:true,permission:'orders:edit'}
];
