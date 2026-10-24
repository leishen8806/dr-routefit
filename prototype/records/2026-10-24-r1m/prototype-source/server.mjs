import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');let name=decodeURIComponent(url.pathname);if(name==='/'||name==='/prototype'||name==='/prototype/')name='/prototype/index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root)||(!name.startsWith('/prototype/')&&!name.startsWith('/brand/logo/'))||!mime[path.extname(file)]){res.writeHead(403);return res.end('Forbidden');}const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log('DR RouteFit prototype: http://127.0.0.1:4173/prototype/'));
