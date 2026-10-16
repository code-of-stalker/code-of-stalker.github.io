import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'file:///C:/Code%20Of%20Stalker/Liquid_Prnc_Glass-main/node_modules/typescript/lib/typescript.js';
const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''));
const code = fs.readFileSync(path.join(base, 'PrinceParallel.tsx'), 'utf8');
const file = 'C:/Code Of Stalker/Liquid_Prnc_Glass-main/src/__parallel_export_check__.tsx';
const options = { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
  strict: true, skipLibCheck: true, noEmit: true, lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'] };
const host = ts.createCompilerHost(options), original = host.getSourceFile;
host.getSourceFile = (name, version, error, create) => name.replaceAll('\\', '/') === file ? ts.createSourceFile(file, code, ts.ScriptTarget.ES2023, true, ts.ScriptKind.TSX) : original(name, version, error, create);
const errors = ts.getPreEmitDiagnostics(ts.createProgram([file], options, host)).filter(d => d.category === ts.DiagnosticCategory.Error).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
assert.deepEqual(errors, []);
console.log('Downloaded TSX passes strict standalone typecheck.');
