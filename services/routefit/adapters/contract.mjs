import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {ApiError} from '../domain/errors.mjs';
export const specification=JSON.parse(readFileSync(new URL('../../../contracts/openapi.json',import.meta.url),'utf8'));
const ajv=new Ajv2020({allErrors:true,strict:false,coerceTypes:false,useDefaults:false,removeAdditional:false});addFormats(ajv);
const validators=new Map();
export function validate(name,value){
 if(!validators.has(name))validators.set(name,ajv.compile({$ref:'#/components/schemas/'+name,components:{schemas:specification.components.schemas}}));
 const fn=validators.get(name);
 if(!fn(value))throw new ApiError(422,'VALIDATION_FAILED','请求字段、类型或范围不符合契约',fn.errors.slice(0,20).map(e=>({path:e.instancePath||'/',code:e.keyword.toUpperCase(),message:e.message})));
 return value;
}
