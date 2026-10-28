import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');const file=u.pathname==='/'?path.join(here,'index.html'):path.resolve(root,'public','.'+decodeURIComponent(u.pathname));if(file!==path.join(here,'index.html')&&!file.startsWith(path.join(root,'public')+path.sep))throw Error('Outside public');const data=await readFile(file);res.writeHead(200,{'content-type':types[path.extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(9014,'127.0.0.1',()=>console.log('Awakening preview: http://127.0.0.1:9014'));
