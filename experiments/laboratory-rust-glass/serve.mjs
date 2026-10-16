import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.json':'application/json'};
http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let filename=path.resolve(root,'.'+pathname);
    if(filename!==root&&!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    if((await stat(filename)).isDirectory())filename=path.join(filename,'index.html');
    const data=await readFile(filename);res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404).end('Not found');}
}).listen(7488,'0.0.0.0',()=>console.log('Laboratory Rust comparison: http://localhost:7488'));
