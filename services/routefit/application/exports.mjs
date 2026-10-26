export const exportRoutes=[
 {method:'POST',pattern:/^\/api\/ops\/v1\/finance\/exports$/,operation:'exportFinance',kind:'create',schema:'ExportJob',input:'ExportRequest',permission:'finance:export'},
 {method:'GET',pattern:/^\/api\/ops\/v1\/finance\/exports\/([^/]+)$/,operation:'getFinanceExport',kind:'get',schema:'ExportJob',permission:'finance:export'}
];
