import {ApiError} from '../domain/errors.mjs';

export function parseJson(bytes){
 try{
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  const value=JSON.parse(text),objects=[];
  // JSON.parse validates syntax; this scan preserves keys that JSON.parse would overwrite.
  for(const match of text.matchAll(/"(?:[^"\\]|\\.)*"(\s*:)?|[{}\[\]]/g)){
   const token=match[0];
   if(token==='{')objects.push(new Set());
   else if(token==='[')objects.push(null);
   else if(token==='}'||token===']')objects.pop();
   else if(match[1]){
    const key=JSON.parse(token.slice(0,-match[1].length)),keys=objects.at(-1);
    if(keys.has(key))throw Error('Duplicate JSON key');
    keys.add(key);
   }
  }
  return value;
 }catch{throw new ApiError(400,'INVALID_JSON','请求须为有效UTF-8 JSON，且同一对象内不得有重复字段');}
}
