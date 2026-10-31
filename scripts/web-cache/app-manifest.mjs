import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const name = 'Code Of Stalker';
// GitHub Pages sets WATCHER_SITE_URL; the ChatGPT Sites build keeps its own address.
const siteUrl = (process.env.WATCHER_SITE_URL || 'https://watcher-observation-qtas5.cold-breezy.chatgpt.site').replace(/\/+$/, '');
async function copyBrandAsset(root, filename, label) {
  const bytes = await fs.readFile(new URL(`../../assets/branding/${filename}`, import.meta.url));
  const digest = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const target = `branding/${label}-${digest}${path.extname(filename)}`;
  await fs.mkdir(path.join(root, 'branding'), { recursive: true });
  await fs.writeFile(path.join(root, target), bytes);
  return '/' + target;
}

export async function prepareAppManifest(root, html) {
  const [favicon, appleIcon, icon192, icon512, preview] = await Promise.all([
    copyBrandAsset(root, 'architecture-eye-32.png', 'architecture-eye-32'),
    copyBrandAsset(root, 'architecture-eye-180.png', 'architecture-eye-180'),
    copyBrandAsset(root, 'architecture-eye-192.png', 'architecture-eye-192'),
    copyBrandAsset(root, 'architecture-eye-512.png', 'architecture-eye-512'),
    copyBrandAsset(root, 'step-2-preview.jpg', 'step-2-preview'),
  ]);
  const manifest = {
    id: '/', name, short_name: name, lang: 'ru',
    start_url: '/', scope: '/', display: 'standalone',
    background_color: '#000000', theme_color: '#000000',
    icons: [
      { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
  await fs.copyFile(new URL('../../assets/branding/architecture-eye-1024.png', import.meta.url), path.join(root, 'watcher-app-icon.png'));
  await fs.writeFile(path.join(root, 'watcher.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  const tags = [
    `<title>${name}</title>`,
    '<link id="watcher-app-manifest" rel="manifest" href="/watcher.webmanifest">',
    `<link id="watcher-app-favicon" rel="icon" type="image/png" sizes="32x32" href="${favicon}">`,
    `<link id="watcher-app-icon" rel="apple-touch-icon" sizes="180x180" href="${appleIcon}">`,
    '<meta id="watcher-app-capable" name="apple-mobile-web-app-capable" content="yes">',
    `<meta id="watcher-app-title" name="apple-mobile-web-app-title" content="${name}">`,
    '<meta id="watcher-app-theme" name="theme-color" content="#000000">',
    `<meta id="watcher-app-og-title" property="og:title" content="${name}">`,
    `<meta id="watcher-app-og-site" property="og:site_name" content="${name}">`,
    '<meta id="watcher-app-og-type" property="og:type" content="website">',
    '<meta id="watcher-app-og-locale" property="og:locale" content="ru_RU">',
    `<meta id="watcher-app-og-url" property="og:url" content="${siteUrl}/">`,
    `<meta id="watcher-app-og-image" property="og:image" content="${siteUrl}${preview}">`,
    '<meta id="watcher-app-og-image-type" property="og:image:type" content="image/jpeg">',
    '<meta id="watcher-app-og-image-width" property="og:image:width" content="1200">',
    '<meta id="watcher-app-og-image-height" property="og:image:height" content="858">',
    '<meta id="watcher-app-og-image-alt" property="og:image:alt" content="Иллюстрация второго шага архитектуры наблюдения">',
    '<meta id="watcher-app-twitter-card" name="twitter:card" content="summary_large_image">',
    `<meta id="watcher-app-twitter-title" name="twitter:title" content="${name}">`,
    `<meta id="watcher-app-twitter-image" name="twitter:image" content="${siteUrl}${preview}">`,
    '<meta id="watcher-app-twitter-image-alt" name="twitter:image:alt" content="Иллюстрация второго шага архитектуры наблюдения">',
  ].join('\n');
  html = html.replace(/<(?:link|meta)\b[^>]*\bid="watcher-app-[^"]+"[^>]*>\s*/g, '');
  html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/gi, '')
    .replace(/<link\b[^>]*\brel="(?:shortcut )?icon"[^>]*>\s*/gi, '');
  return /<head\b[^>]*>/i.test(html) ? html.replace(/(<head\b[^>]*>)\s*/i, '$1\n' + tags + '\n')
    : html.replace(/<html\b[^>]*>/i, '$&<head>\n' + tags + '\n</head>');
}
