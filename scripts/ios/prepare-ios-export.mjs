// Turn a plain `expo export --platform web` into the web content of the iOS app.
//
// The shell (ios-app/) serves this folder from the app bundle at codeofstalker://localhost/
// through a WKURLSchemeHandler, so every file is already on the device. The page gets the
// same treatment as the Android app (same CSP, no site release worker, update probe or
// self-heal: a new version is a new app build), minus Android's script cache worker:
// WKWebView runs no service worker for a custom scheme.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareAppExport } from '../android/prepare-app-export.mjs';

export async function prepareIosExport(outputDirectory) {
  const htmlPath = path.join(outputDirectory, 'index.html');
  // A folder already prepared for Android carries the script cache registration: drop it.
  const before = await fs.readFile(htmlPath, 'utf8');
  const cleaned = before.replace(/<script src="\/app-script-cache-register\.js"[^>]*><\/script>/g, '');
  if (cleaned !== before) await fs.writeFile(htmlPath, cleaned);
  const result = await prepareAppExport(outputDirectory, { scriptCache: false });
  const html = await fs.readFile(htmlPath, 'utf8');
  if (/serviceWorker|app-script-cache|graphics-cache-updates/.test(html)) throw new Error('The iOS page must not register any worker');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await prepareIosExport(process.argv[2] ?? '.expo-ios-export')));
}
