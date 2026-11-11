import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const errorCodes=['400','401','403','404','429','503'];
const writes=new Set(['post','put','patch']);
const clone=value=>JSON.parse(JSON.stringify(value));
const refName=ref=>ref?.split('/').at(-1);

function fail(module,message){throw new Error(`contracts/modules/${module.module}.json: ${message}`);}
function parameters(operation){return operation.parameters??[];}
function hasParameter(operation,name){return parameters(operation).some(parameter=>parameter.name===name);}
function isCollection(path){const segment=path.split('/').filter(Boolean).at(-1)??'';return !segment.startsWith('{')&&!segment.includes('actions')&&segment.endsWith('s');}
function visitSchema(schema,callback){
  if(!schema||typeof schema!=='object')return;
  callback(schema);
  for(const value of Object.values(schema)){
    if(Array.isArray(value))value.forEach(item=>visitSchema(item,callback));
    else if(value&&typeof value==='object')visitSchema(value,callback);
  }
}

export function validateModuleStandards(module,base){
  if(!module?.module||typeof module.module!=='string')throw new Error('module contract requires a string module name');
  if(!module.paths||typeof module.paths!=='object')fail(module,'requires paths');
  for(const [path,methods] of Object.entries(module.paths)){
    if(!path.startsWith('/api/')||path!==path.toLowerCase())fail(module,`${path} must be lowercase and start with /api/`);
    const segments=path.split('/').filter(Boolean);
    if(segments.some(segment=>!segment.startsWith('{')&&!/^[a-z0-9-]+$/.test(segment)))fail(module,`${path} must use lowercase kebab-case segments`);
    for(const [method,operation] of Object.entries(methods)){
      const normalized=method.toLowerCase();
      if(normalized==='delete')fail(module,`${path} must not use DELETE`);
      if(path.includes('/actions/')&&normalized!=='post')fail(module,`${path} action transitions must use POST`);
      if(!operation?.operationId)fail(module,`${path} ${method} requires operationId`);
      for(const key of ['x-permissions','x-stage','x-implementation-status','x-version-resource','x-owner']){
        if(operation[key]===undefined||operation[key]===null||operation[key]==='')fail(module,`${operation.operationId} requires ${key}`);
      }
      if(!Array.isArray(operation['x-permissions']))fail(module,`${operation.operationId} x-permissions must be an array`);
      if(!operation['x-examples']?.success||!operation['x-examples']?.rejected)fail(module,`${operation.operationId} requires success and rejected x-examples`);
      if(writes.has(normalized)&&!hasParameter(operation,'Idempotency-Key'))fail(module,`${operation.operationId} write requires Idempotency-Key`);
      if(['put','patch'].includes(normalized)&&!hasParameter(operation,'If-Match'))fail(module,`${operation.operationId} modification requires If-Match`);
      if(normalized==='get'&&isCollection(path)){
        if(!hasParameter(operation,'limit')||!hasParameter(operation,'cursor'))fail(module,`${operation.operationId} list requires limit and cursor`);
        const schema=operation.responses?.['200']?.content?.['application/json']?.schema;
        if(!schema?.properties?.items||!schema?.properties?.nextCursor)fail(module,`${operation.operationId} list response requires items and nextCursor`);
      }
      const responses=operation.responses??{};
      if(!errorCodes.some(code=>responses[code]))fail(module,`${operation.operationId} requires common error responses`);
      for(const [code,response] of Object.entries(responses)){
        if(/^[45]/.test(code)&&!response?.$ref)fail(module,`${operation.operationId} ${code} must reference a common error response`);
      }
    }
  }
  for(const [name,schema] of Object.entries(module.components?.schemas??{})){
    visitSchema(schema,node=>{
      for(const [key,value] of Object.entries(node.properties??{})){
        if(/(?:amount|money)/i.test(key)&&typeof value==='object'&&value.$ref!=='#/components/schemas/Money')fail(module,`${name}.${key} must reference the Money schema`);
      }
    });
  }
  return true;
}

function removePriorModuleOutput(spec,moduleNames){
  for(const [path,methods] of Object.entries(spec.paths??{})){
    for(const [method,operation] of Object.entries(methods))if(moduleNames.has(operation?.['x-contract-module']))delete methods[method];
    if(Object.keys(methods).length===0)delete spec.paths[path];
  }
  for(const [name,schema] of Object.entries(spec.components?.schemas??{}))if(moduleNames.has(schema?.['x-contract-module']))delete spec.components.schemas[name];
}

export function assembleContract(base,moduleContracts){
  const result=clone(base);
  result.paths??={};result.components??={};result.components.schemas??={};
  removePriorModuleOutput(result,new Set(moduleContracts.map(module=>module.module)));
  for(const module of moduleContracts){
    validateModuleStandards(module,result);
    for(const [path,methods] of Object.entries(module.paths)){
      result.paths[path]??={};
      for(const [method,operation] of Object.entries(methods)){
        if(result.paths[path][method])fail(module,`${method.toUpperCase()} ${path} duplicates an existing operation`);
        result.paths[path][method]={...clone(operation),'x-contract-module':module.module};
      }
    }
    for(const [name,schema] of Object.entries(module.components?.schemas??{})){
      if(result.components.schemas[name])fail(module,`schema ${name} duplicates an existing schema`);
      result.components.schemas[name]={...clone(schema),'x-contract-module':module.module};
    }
  }
  return result;
}

export function loadModuleContracts(directory){
  try{return readdirSync(directory,{withFileTypes:true}).filter(entry=>entry.isFile()&&entry.name.endsWith('.json')).sort((a,b)=>a.name.localeCompare(b.name)).map(entry=>JSON.parse(readFileSync(resolve(directory,entry.name),'utf8')));}
  catch(error){if(error.code==='ENOENT')return [];throw error;}
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const modules=loadModuleContracts(resolve(root,'contracts/modules'));
  const input=JSON.parse(readFileSync(resolve(root,'contracts/openapi.json'),'utf8'));
  const assembled=assembleContract(input,modules);
  if(process.argv.includes('--write'))writeFileSync(resolve(root,'contracts/openapi.json'),`${JSON.stringify(assembled,null,2)}\n`,'utf8');
  process.stdout.write(`${JSON.stringify({modules:modules.map(module=>module.module),paths:Object.keys(assembled.paths).length,mode:process.argv.includes('--write')?'written':'checked'})}\n`);
}
