// Builds the live prototype: one self-contained page that opens straight from
// disk, with the built renderer, Art's strip and the fonts inlined.
//   node graphics/sphere-everywhere/prototype/build.mjs <out>/index.html
// Run the scene's build script first so public/graphics/sphere-everywhere is fresh.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const pub = path.join(root, 'public/graphics/sphere-everywhere');
const out = process.argv[2];
if (!out) throw new Error('usage: node build.mjs <out>/index.html');
const b64 = file => readFileSync(file).toString('base64');
const glue = readFileSync(path.join(pub, 'pkg/watcher_sphere_everywhere.js'), 'utf8')
  .replace('export class SphereEverywhere', 'class SphereEverywhere')
  .replace(/^export \{ initSync, __wbg_init as default \};\s*$/m, '');
if (/^export /m.test(glue)) throw new Error('the wasm-bindgen glue changed: an export is left');
const fill = {
  __DISKET__: b64(path.join(root, 'assets/product/fonts/Disket-Mono-Regular.ttf')),
  __TEKTUR__: b64(path.join(root, 'assets/product/fonts/Tektur-Medium.ttf')),
  __WASM__: b64(path.join(pub, 'pkg/watcher_sphere_everywhere_bg.wasm')),
  __STRIP__: b64(path.join(pub, 'assets/strip.webp')),
  __GLUE__: glue,
};
let page = readFileSync(path.join(here, 'template.html'), 'utf8');
for (const [key, value] of Object.entries(fill)) page = page.split(key).join(value);
const split = page.indexOf('</style>') + '</style>'.length;
writeFileSync(out, `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${page.slice(0, split)}
</head>
<body>${page.slice(split)}</body>
</html>
`);
console.log(`${out}: ${page.length} bytes`);
