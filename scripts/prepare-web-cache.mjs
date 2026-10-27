import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { prepareAppManifest } from './web-cache/app-manifest.mjs';
import { secureShell } from './web-cache/shell-security.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const imageOrFont = /\.(?:svg|png|jpe?g|webp|gif|avif|ico|ttf|otf|woff2?)$/i;
// `.z`: zlib-compressed engine inputs (tracks, reading curves) in graphics/pkg/assets.
const graphics = /\.(?:js|wasm|bin|z|svg|png|jpe?g|webp|gif|avif)$/i;
export function isCacheAsset(name) {
  return name === 'index.html' || name === 'graphics-cache-updates.js' || name === 'favicon.ico'
    || name === 'watcher.webmanifest' || name === 'watcher-app-icon.png'
    || name.startsWith('branding/') && imageOrFont.test(name)
    || name.startsWith('graphics/') && graphics.test(name)
    || name.startsWith('assets/') && imageOrFont.test(name)
    || /^_expo\/static\/(?:js\/web\/.*\.js|css\/.*\.css)$/.test(name);
}

export async function prepareWebCache(outputDirectory) {
  const root = await fs.realpath(path.resolve(outputDirectory));
  const htmlPath = path.join(root, 'index.html');
  const template = await fs.readFile(path.join(here, 'web-cache/worker.template.js'), 'utf8');
  const bootstrap = await fs.readFile(path.join(here, 'web-cache/bootstrap.js'), 'utf8');
  let html = await fs.readFile(htmlPath, 'utf8');
  html = await secureShell(await prepareAppManifest(root, html));
  html = html.replace(/<script id="watcher-graphics-cache"[^>]*><\/script>/g, '');
  if (!html.includes('</body>')) throw new Error('Export has no HTML body');
  html = html.replace('</body>', '<script id="watcher-graphics-cache" src="/graphics-cache-updates.js" data-release="__WATCHER_VERSION__" defer></script></body>');
  await fs.writeFile(htmlPath, html);
  await fs.writeFile(path.join(root, 'graphics-cache-updates.js'), bootstrap);
  const assets = [];
  async function visit(directory, prefix = '') {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Export must not contain symbolic links');
      const name = prefix + entry.name;
      if (entry.isDirectory()) await visit(path.join(directory, entry.name), name + '/');
      else if (entry.isFile() && isCacheAsset(name)) {
        const bytes = await fs.readFile(path.join(directory, entry.name));
        const originalUrl = '/' + name.split('/').map(part => encodeURIComponent(part).replace(/%40/g, '@')).join('/');
        const asset = { url: originalUrl, bytes: bytes.length, sha256: sha256(bytes) };
        // Hosts can block node_modules paths, including exported router icons.
        // Download an identical static copy at a portable URL; the worker also
        // serves it under its original application URL without changing bundles.
        if (name.includes('/node_modules/') || name.includes('@')) {
          const alias = `graphics-cache-assets/${sha256(name).slice(0, 16)}-${asset.sha256}${path.extname(name)}`;
          await fs.mkdir(path.join(root, 'graphics-cache-assets'), { recursive: true });
          await fs.writeFile(path.join(root, alias), bytes);
          asset.url = '/' + alias;
          asset.aliases = [originalUrl];
        }
        assets.push(asset);
      }
    }
  }
  await visit(root);
  assets.sort((a, b) => a.url.localeCompare(b.url, 'en'));
  const routes = ['/', '/index.html', '/update', '/launch', '/home', '/diary', '/settings', '/levels', '/practice', '/observation', '/transitions', '/network', '/sdk', '/recovery'];
  const version = sha256(JSON.stringify({ assets, routes, template })).slice(0, 24);
  // Hash the normalized shell template first, then stamp its release. This
  // avoids a circular hash while including every authored shell change.
  html = html.replace('__WATCHER_VERSION__', version);
  await fs.writeFile(htmlPath, html);
  const shell = assets.find(asset => asset.url === '/index.html');
  shell.bytes = Buffer.byteLength(html); shell.sha256 = sha256(html);
  const release = { version, assets, routes, shellHtml: html, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0) };
  await fs.writeFile(path.join(root, 'graphics-cache-worker.js'), template.replace('/* __WATCHER_RELEASE__ */ null', JSON.stringify(release)));
  await fs.writeFile(path.join(root, 'graphics-cache-manifest.json'), JSON.stringify(release, null, 2) + '\n');
  // Network-only small probe; the worker never intercepts this endpoint.
  await fs.writeFile(path.join(root, 'graphics-cache-version.json'), JSON.stringify({ version }) + '\n');
  return release;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const release = await prepareWebCache(process.argv[2] ?? '.expo-rust-web-export');
  console.log(JSON.stringify({ version: release.version, assets: release.assets.length, bytes: release.bytes }));
}
