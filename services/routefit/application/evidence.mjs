export const evidenceRoutes=[
 {method:'POST',pattern:/^\/api\/ops\/v1\/uploads$/,operation:'opsUpload',schema:'UploadTicket',input:'EvidenceUploadRequest',kind:'create',permission:'ops:evidence:create'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/uploads\/([^/]+)\/actions\/complete$/,operation:'opsCompleteUpload',schema:'EvidenceFile',input:'EmptyCommand',kind:'complete',permission:'ops:evidence:create',version:true},
 {method:'GET',pattern:/^\/api\/ops\/v1\/evidence-files\/([^/]+)\/download-url$/,operation:'opsEvidenceDownload',schema:'DownloadLink',kind:'download',permission:'ops:evidence:read'}
];
