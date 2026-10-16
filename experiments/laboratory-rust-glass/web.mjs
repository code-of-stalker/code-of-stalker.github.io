import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
const labRequire=createRequire(path.join(process.env.LABORATORY_SOURCE||'C:/Code Of Stalker/Liquid_Prnc_Glass-main','package.json'));
const vite=await import(pathToFileURL(labRequire.resolve('vite')).href);
const config={configFile:false,root,base:'./',resolve:{alias:{react:path.dirname(require.resolve('react/package.json')),'react-dom':path.dirname(require.resolve('react-dom/package.json')),three:path.join(path.dirname(labRequire.resolve('three')),'three.module.js')}},oxc:{jsx:{runtime:'automatic'}},build:{target:'es2020'}};
if(process.argv.includes('--serve')){const server=await vite.createServer({...config,server:{host:'0.0.0.0',port:7488,strictPort:true}});await server.listen();server.printUrls();}
else await vite.build(config);
