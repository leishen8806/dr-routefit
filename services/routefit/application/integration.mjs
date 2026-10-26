export const integrationRoutes=[
 {method:'GET',pattern:/^\/api\/integration\/v1\/ops-snapshot$/,operation:'opsSnapshot',schema:'OpsSnapshot',kind:'ops-snapshot',permission:'ops-snapshot:read'},
 {method:'POST',pattern:/^\/api\/warehouse\/v1\/orders$/,operation:'warehouseImportOrder',schema:'ImportResult',input:'ExternalOrderRequest',kind:'import-create',channel:'WAREHOUSE',service:true,permission:'warehouse:orders:create'},
 {method:'GET',pattern:/^\/api\/warehouse\/v1\/orders\/([^/]+)$/,operation:'warehouseImportStatus',schema:'ImportResult',kind:'import-read',channel:'WAREHOUSE',service:true,permission:'warehouse:orders:read'},
 {method:'POST',pattern:/^\/api\/warehouse\/v1\/orders\/([^/]+)\/actions\/request-dispatch$/,operation:'warehouseDispatchRequest',schema:'ImportResult',input:'DispatchRequest',kind:'dispatch-request',channel:'WAREHOUSE',service:true,permission:'warehouse:orders:dispatch-request',version:true},
 {method:'POST',pattern:/^\/api\/external\/v1\/orders$/,operation:'externalImportOrder',schema:'ImportResult',input:'ExternalOrderRequest',kind:'import-create',channel:'EXTERNAL',service:true,permission:'external:orders:create'},
 {method:'GET',pattern:/^\/api\/external\/v1\/orders\/([^/]+)$/,operation:'externalImportStatus',schema:'ImportResult',kind:'import-read',channel:'EXTERNAL',service:true,permission:'external:orders:read'},
 {method:'POST',pattern:/^\/api\/external\/v1\/orders\/([^/]+)\/actions\/request-dispatch$/,operation:'externalDispatchRequest',schema:'ImportResult',input:'DispatchRequest',kind:'dispatch-request',channel:'EXTERNAL',service:true,permission:'external:orders:dispatch-request',version:true},
 {method:'POST',pattern:/^\/api\/warehouse\/v1\/stock-events$/,operation:'wmsStockEvent',schema:'InventoryRow',input:'WmsStockEvent',kind:'stock-event',channel:'WAREHOUSE',service:true,permission:'warehouse:inventory:write'}
];
