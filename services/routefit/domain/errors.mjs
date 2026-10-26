export class ApiError extends Error {
 constructor(status,code,message,fields=[]){super(message);Object.assign(this,{status,code,fields});}
}
export function ensure(ok,status,code,message){if(!ok)throw new ApiError(status,code,message);}
