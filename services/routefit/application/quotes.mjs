export const quoteRoutes=[
 {method:'POST',pattern:/^\/api\/ops\/v1\/orders\/([^/]+)\/quotes$/,operation:'createQuote',schema:'Quote',input:'QuoteRequest',kind:'quote-create',permission:'quotes:create',version:true},
 {method:'GET',pattern:/^\/api\/ops\/v1\/quotes\/([^/]+)$/,operation:'getQuote',schema:'Quote',kind:'quote',permission:'quotes:read'}
];
