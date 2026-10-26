export const notificationRoutes=[
 {method:'POST',pattern:/^\/api\/ops\/v1\/notifications$/,operation:'sendNotification',schema:'Notification',input:'NotificationRequest',kind:'create',permission:'notifications:send'},
 {method:'GET',pattern:/^\/api\/ops\/v1\/notifications\/([^/]+)$/,operation:'notificationStatus',schema:'Notification',kind:'read',permission:'notifications:read'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/notifications\/([^/]+)\/actions\/retry$/,operation:'retryNotification',schema:'Notification',input:'Reason',kind:'retry',permission:'notifications:send',version:true}
];
