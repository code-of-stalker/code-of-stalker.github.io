import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { prepareWebCache } from './prepare-web-cache.mjs';
import { packageFamilyPreview } from '../graphics/product-engine/preview/voice-family/package.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.join(root, 'sites', 'watcher');
const manifestPath = path.join(project, '.openai', 'hosting.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
if (manifest.project_id !== 'appgprj_6acce501d4988191938370d0410d080b') throw new Error('Site identity mismatch');
const output = path.join(project, 'dist');
// Verify the exact owned output before replacing compiled assets, never the checkout.
if (await fs.realpath(project) !== project || output !== path.resolve(root, 'sites/watcher/dist')) throw new Error('Unexpected Site output');
try { if ((await fs.lstat(output)).isSymbolicLink()) throw new Error('Site output must not be a symlink'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await fs.access(path.join(root, '.expo-rust-web-export/index.html'));
await fs.rm(output, { recursive: true, force: true });
await fs.cp(path.join(root, '.expo-rust-web-export'), output, { recursive: true });
manifest.static = { directory: 'dist', not_found_handling: 'single-page-application' };
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

// Preserve the engine bytes while fitting Sites' 25 MiB per-file limit.
const packageDir = path.join(output, 'graphics/pkg');
const wasmPath = path.join(packageDir, 'watcher_graphics_bg.wasm');
const binary = await fs.readFile(wasmPath);
const digest = crypto.createHash('sha256').update(binary).digest('hex');
const chunkSize = 16 * 1024 * 1024, parts = [];
for (let start = 0, index = 0; start < binary.length; start += chunkSize, index++) {
  const data = binary.subarray(start, Math.min(start + chunkSize, binary.length));
  const name = `watcher_graphics_bg.${digest.slice(0, 12)}.part${index}.bin`;
  await fs.writeFile(path.join(packageDir, name), data);
  parts.push({ name, size: data.length });
}
const restored = Buffer.concat(await Promise.all(parts.map(part => fs.readFile(path.join(packageDir, part.name)))));
if (!binary.equals(restored) || !WebAssembly.validate(restored)) throw new Error('Engine reconstruction failed');
const gluePath = path.join(packageDir, 'watcher_graphics.js');
let glue = await fs.readFile(gluePath, 'utf8');
const fetchLine = 'module_or_path = fetch(module_or_path);';
if (glue.split(fetchLine).length !== 2) throw new Error('Unexpected wasm-bindgen loader');
glue = glue.replace(fetchLine, `module_or_path = (async () => {
            const parts = ${JSON.stringify(parts)};
            const buffers = await Promise.all(parts.map(async part => {
                const response = await fetch(new URL(part.name, import.meta.url));
                if (!response.ok) throw new Error('Failed to load graphics engine: ' + response.status);
                const bytes = new Uint8Array(await response.arrayBuffer());
                if (bytes.byteLength !== part.size) throw new Error('Incomplete graphics engine asset');
                return bytes;
            }));
            const bytes = new Uint8Array(buffers.reduce((size, part) => size + part.length, 0));
            let offset = 0;
            for (const part of buffers) { bytes.set(part, offset); offset += part.length; }
            return bytes;
        })();`);
await fs.writeFile(gluePath, glue);
await fs.unlink(wasmPath);
const htmlPath = path.join(output, 'index.html');
let html = await fs.readFile(htmlPath, 'utf8');
html = html.replace('<html lang="en">', '<html lang="ru">');
await fs.writeFile(htmlPath, html);
// Recompute after engine splitting and HTML changes: deployment has its own snapshot.
const release = await prepareWebCache(output);
await packageFamilyPreview(output);
const reports = path.join(root, '.local-preview/sites-watcher');
await fs.mkdir(reports, { recursive: true });
await fs.writeFile(path.join(reports, 'engine-verification.json'), JSON.stringify({ originalBytes: binary.length, sha256: digest, parts, exactReconstruction: true, wasmValid: true }, null, 2));
await fs.writeFile(path.join(project, 'README.md'), '# Дневник Сталкера — веб-версия\n\nStatic Expo export from the parent Watcher application.\nThe native/mobile application stays in the parent checkout.\n\n## Update\n\nFrom the parent checkout:\n\n    npm run export:web\n    npm run prepare:site\n\nUse the existing Site project in .openai/hosting.json and the Sites source workflow to publish.\nEach export creates a verified graphics/engine cache snapshot. Updates are checked on launch, resume, reconnect and every minute while visible, and applied when no recording, draft, overlay or storage operation is active. Each open client retains a consistent runtime until reload. Open /update once to migrate from the older worker.\nDiary records and audio remain in their separate browser-local encrypted database.\n');
await fs.writeFile(path.join(project, '.gitignore'), '.sites-runtime/\n.sites-checkout/\n');
// The precache hashes exact bytes. Git must not rewrite exported text line endings.
await fs.writeFile(path.join(project, '.gitattributes'), 'dist/** -text\n');
console.log(JSON.stringify({ project_id: manifest.project_id, cacheVersion: release.version, cacheAssets: release.assets.length, cacheBytes: release.bytes }));
