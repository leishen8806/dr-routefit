export const policyRoutes=[
 {method:'POST',pattern:/^\/api\/ops\/v1\/pricing\/tariffs\/([^/]+)\/policy-versions$/,operation:'submitPricingPolicy',schema:'PricingPolicyVersion',input:'PricingPolicySubmit',kind:'policy-submit',permission:'pricing:write',version:true},
 {method:'GET',pattern:/^\/api\/ops\/v1\/pricing\/policy-versions\/([^/]+)$/,operation:'getPricingPolicy',schema:'PricingPolicyVersion',kind:'policy',permission:'pricing:read'},
 {method:'POST',pattern:/^\/api\/ops\/v1\/pricing\/policy-versions\/([^/]+)\/actions\/review$/,operation:'reviewPricingPolicy',schema:'PricingPolicyVersion',input:'PricingPolicyDecision',kind:'policy-review',permission:'pricing:review',version:true},
 {method:'POST',pattern:/^\/api\/ops\/v1\/pricing\/policy-versions\/([^/]+)\/actions\/publish$/,operation:'publishPricingPolicy',schema:'PricingPolicyVersion',input:'PricingPolicyDecision',kind:'policy-publish',permission:'pricing:publish',version:true}
];
