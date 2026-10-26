export const recipientRoutes=[
 {method:'POST',pattern:/^\/api\/recipient\/v1\/access-challenges$/,operation:'recipientChallenge',schema:'RecipientChallenge',input:'RecipientChallengeRequest',kind:'challenge',permission:'capability:recipient:challenge'},
 {method:'POST',pattern:/^\/api\/recipient\/v1\/sessions$/,operation:'recipientVerify',schema:'RecipientSession',input:'RecipientVerify',kind:'verify',permission:'capability:recipient:verify'},
 {method:'GET',pattern:/^\/api\/recipient\/v1\/delivery$/,operation:'recipientDelivery',schema:'PublicTracking',kind:'delivery',permission:'recipient:delivery:read'},
 {method:'POST',pattern:/^\/api\/recipient\/v1\/service-requests$/,operation:'recipientServiceRequest',schema:'ServiceCase',input:'RecipientServiceRequest',kind:'service-request',permission:'recipient:cases:create'},
 {method:'POST',pattern:/^\/api\/recipient\/v1\/delivery-acknowledgements$/,operation:'recipientAck',schema:'RecipientAckResult',input:'RecipientAcknowledgement',kind:'ack',permission:'recipient:delivery:ack'},
 {method:'POST',pattern:/^\/api\/recipient\/v1\/uploads$/,operation:'recipientUpload',schema:'UploadTicket',input:'EvidenceUploadRequest',kind:'evidence-create',permission:'recipient:evidence:create'},
 {method:'POST',pattern:/^\/api\/recipient\/v1\/uploads\/([^/]+)\/actions\/complete$/,operation:'recipientCompleteUpload',schema:'EvidenceFile',input:'EmptyCommand',kind:'evidence-complete',permission:'recipient:evidence:create',version:true},
 {method:'GET',pattern:/^\/api\/recipient\/v1\/evidence-files\/([^/]+)\/download-url$/,operation:'recipientEvidenceDownload',schema:'DownloadLink',kind:'evidence-download',permission:'recipient:evidence:read'}
];
