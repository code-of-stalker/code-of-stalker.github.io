import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(process.argv[2]);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'};
http.createServer(async (request,response) => {
  try {
    const url = new URL(request.url,'http://localhost');
    let file = path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(file!==root && !file.startsWith(root+path.sep)) {response.writeHead(403).end();return;}
    if(!path.extname(file))file=path.join(root,'index.html');
    const bytes=await fs.readFile(file);
    response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
  } catch {response.writeHead(404).end();}
}).listen(8980,'127.0.0.1',()=>console.log('Site preview: http://127.0.0.1:8980'));
