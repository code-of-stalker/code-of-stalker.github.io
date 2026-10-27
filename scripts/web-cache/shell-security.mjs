import crypto from 'node:crypto';
import fs from 'node:fs/promises';

// Runs before the deferred router bundle. expo-router parses the query with
// decode-uri-component 0.2, which needs minutes for a few kilobytes of
// malformed percent escapes, so such an address is trimmed first. A copy
// framed by another site stays hidden: no app button can sit under its page.
export const shellGuard = "(function(){var l=location;if(window.top!==window.self){document.documentElement.setAttribute('style','display:none!important');return}"
  + "try{decodeURIComponent(l.pathname)}catch(e){history.replaceState(null,'','/')}"
  + "try{decodeURIComponent(l.search+l.hash)}catch(e){history.replaceState(null,'',l.pathname)}})();";

const hash = text => `'sha256-${crypto.createHash('sha256').update(text).digest('base64')}'`;

/** The diary editor's srcdoc frame inherits this policy and runs one fixed inline script. */
export async function diaryEditorScript() {
  const source = await fs.readFile(new URL('../../src/features/product/diary/text-editor-runtime.generated.ts', import.meta.url), 'utf8');
  const literal = source.match(/^export const diaryTextEditorScript = (".*");$/m);
  if (!literal) throw new Error('Diary editor script not found');
  return JSON.parse(literal[1]);
}

export function contentSecurityPolicy(inlineScripts) {
  return [
    "default-src 'self'",
    // Graphics runtimes load through Function('url', 'return import(url)'), so
    // eval stays allowed; it also covers WebAssembly compilation.
    `script-src 'self' 'unsafe-eval' ${inlineScripts.map(hash).join(' ')}`,
    // React Native Web writes inline styles and style elements.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    // Diary text, recordings and keys never leave this origin.
    "connect-src 'self' blob:",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "manifest-src 'self'",
  ].join('; ');
}

/** GitHub Pages cannot send headers, so the policy and guard lead the shell's head. */
export async function secureShell(html) {
  html = html.replace(/<meta\b[^>]*\bid="watcher-csp"[^>]*>\s*/g, '')
    .replace(/<script id="watcher-shell-guard">[\s\S]*?<\/script>\s*/g, '');
  if (!/<head\b[^>]*>/i.test(html)) throw new Error('Export has no HTML head');
  const policy = contentSecurityPolicy([shellGuard, await diaryEditorScript()]);
  const tags = `<meta id="watcher-csp" http-equiv="Content-Security-Policy" content="${policy}">\n<script id="watcher-shell-guard">${shellGuard}</script>`;
  return html.replace(/(<head\b[^>]*>)\s*/i, `$1\n${tags}\n`);
}
