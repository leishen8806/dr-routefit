import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {basename} from 'node:path';

export function pgCliConnection(connectionString){
 const url=new URL(connectionString),password=decodeURIComponent(url.password),username=decodeURIComponent(url.username);
 url.username=username;
 url.password='';
 return {url:url.href,password};
}

export async function sha256File(file){
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(file))hash.update(chunk);
 return hash.digest('hex');
}

export async function verifyBackupChecksum(file,checksumFile){
 const text=await readFile(checksumFile,'utf8');
 const line=text.trim();
 const match=line.match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
 if(!match||basename(match[2])!==basename(file))throw Error('backup checksum file is invalid');
 const actual=await sha256File(file);
 if(actual.toLowerCase()!==match[1].toLowerCase())throw Error('backup checksum mismatch');
 return actual;
}
