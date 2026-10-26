export const publicRoutes=[
 {method:'GET',pattern:/^\/api\/public\/v1\/tracking\/([A-Za-z0-9_-]{22,128})$/,operation:'publicTracking',schema:'PublicTracking',kind:'tracking',permission:'capability:tracking:read'}
];
