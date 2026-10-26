import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.join(project, 'output/motion/man-in-clouds');
const mime = { '.html':'text/html; charset=utf-8', '.mjs':'text/javascript', '.js':'text/javascript', '.wasm':'application/wasm', '.png':'image/png', '.svg':'image/svg+xml', '.mp4':'video/mp4', '.webm':'video/webm' };
http.createServer(async (request,response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(root,name);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    if (['.mp4','.webm'].includes(path.extname(file))) {
      const {size}=await fs.stat(file);
      const range=request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      const start=range?Number(range[1]):0;
      const end=range&&range[2]?Math.min(Number(range[2]),size-1):size-1;
      if(start>end||start>=size){response.writeHead(416,{'Content-Range':`bytes */${size}`}).end();return;}
      const headers={'Content-Type':mime[path.extname(file)],'Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'no-store'};
      if(range)headers['Content-Range']=`bytes ${start}-${end}/${size}`;
      response.writeHead(range?206:200,headers);
      if(request.method==='HEAD'){response.end();return;}
      createReadStream(file,{start,end}).pipe(response);
      return;
    }
    const data = await fs.readFile(file);
    response.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    response.end(data);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(8976,'127.0.0.1',()=>console.log('Cloud motion: http://127.0.0.1:8976'));
