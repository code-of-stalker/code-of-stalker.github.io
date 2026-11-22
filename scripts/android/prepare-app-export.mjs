// Turn a plain `expo export --platform web` into the web content of the Android app.
//
// The shell (android-app/) serves this folder from the APK at
// https://appassets.androidplatform.net/, so every file is already on the device.
// Compared with the site (scripts/prepare-web-cache.mjs) the page keeps the same
// Content-Security-Policy, frame guard and manifest tags, but gets no release
// service worker, update probe or self-heal: a new version is a new APK.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareAppManifest } from '../web-cache/app-manifest.mjs';
import { secureShell } from '../web-cache/shell-security.mjs';

// Files only the site's release cache uses; an app export must never carry them.
const siteOnly = ['graphics-cache-updates.js', 'graphics-cache-worker.js', 'graphics-cache-manifest.json', 'graphics-cache-version.json', '404.html'];

export async function prepareAppExport(outputDirectory) {
  const root = await fs.realpath(path.resolve(outputDirectory));
  const htmlPath = path.join(root, 'index.html');
  let html = await fs.readFile(htmlPath, 'utf8');
  if (!html.includes('</body>')) throw new Error('Export has no HTML body');
  html = html.replace(/<script id="watcher-graphics-cache"[^>]*><\/script>/g, '');
  html = await secureShell(await prepareAppManifest(root, html));
  if (/serviceWorker|graphics-cache-updates/.test(html)) throw new Error('App shell must not register the site release worker');
  await fs.writeFile(htmlPath, html);
  for (const name of siteOnly) await fs.rm(path.join(root, name), { force: true });
  await fs.rm(path.join(root, 'graphics-cache-assets'), { recursive: true, force: true });
  let files = 0, bytes = 0;
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Export must not contain symbolic links: ${full}`);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) { files++; bytes += (await fs.stat(full)).size; }
    }
  }
  await visit(root);
  return { files, bytes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await prepareAppExport(process.argv[2] ?? '.expo-android-export')));
}
