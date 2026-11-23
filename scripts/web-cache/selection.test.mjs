import test from 'node:test';
import assert from 'node:assert/strict';
import { isCoreAsset, networkAllowsFull, assetStem, selectAssets, downloadOrder } from './selection.mjs';

test('the core is the shell, app code, fonts, icons, engine and shared UI runtimes', () => {
  for (const url of ['/index.html', '/graphics-cache-updates.js', '/favicon.ico', '/watcher.webmanifest', '/branding/exit-door-32-abc.png',
    '/_expo/static/js/web/entry-0a86.js', '/_expo/static/css/app.css', '/assets/assets/product/fonts/Disket-Mono-Bold.6c12.ttf',
    '/assets/assets/product/diary/info.008d.svg', '/graphics-cache-assets/1234-abcd.png',
    '/graphics/pkg/watcher_graphics.js', '/graphics/pkg/watcher_graphics_bg.wasm', '/graphics/pkg/watcher_graphics_bg.1a2b3c4d5e6f.part0.bin',
    '/graphics/skeleton/runtime.js', '/graphics/soft-scroll/pkg/watcher_soft_scroll_bg.wasm', '/graphics/role-marks/pkg/watcher_role_marks.js',
    '/graphics/native-kernel/watcher_native_bridge_bg.wasm']) assert.equal(isCoreAsset(url), true, url);
  for (const url of ['/graphics/pkg/assets/gallery-atlas.ee4a094dbbc9.png', '/graphics/pkg/assets/insight.5cd3d1e53c3b.tracks.xml.z',
    '/graphics/voice-surface/runtime.js', '/graphics/voice-surface/pkg/voice_surface_bg.wasm', '/graphics/cloud-drift/assets/sky.webp',
    '/graphics/gallery.webp', '/graphics/pkg-other/x.js']) assert.equal(isCoreAsset(url), false, url);
});

test('only Wi-Fi or a wired link without Data Saver allows the full download', () => {
  assert.equal(networkAllowsFull({ type: 'wifi', effectiveType: '4g', saveData: false }), true);
  assert.equal(networkAllowsFull({ type: 'ethernet', effectiveType: '4g' }), true);
  assert.equal(networkAllowsFull({ type: 'wifi', saveData: true }), false, 'Data Saver');
  for (const type of ['cellular', 'bluetooth', 'wimax', 'other', 'mixed', 'none', 'unknown']) assert.equal(networkAllowsFull({ type, effectiveType: '4g' }), false, type);
  // Safari and Firefox expose no connection info: unknown keeps to the part.
  assert.equal(networkAllowsFull(undefined), false);
  assert.equal(networkAllowsFull(null, { mobile: false }), false);
  // Desktop Chrome and Edge report no link type.
  assert.equal(networkAllowsFull({ effectiveType: '4g', saveData: false }, { mobile: false }), true);
  assert.equal(networkAllowsFull({ effectiveType: '3g' }, { mobile: false }), false, 'slow desktop link');
  assert.equal(networkAllowsFull({ effectiveType: '4g', saveData: true }, { mobile: false }), false, 'desktop Data Saver');
  assert.equal(networkAllowsFull({ effectiveType: '4g' }, { mobile: true }), false, 'phone without link type');
  assert.equal(networkAllowsFull({ effectiveType: '4g' }), false, 'no device info');
});

test('a stem drops content hashes, so a changed hashed file is the same file', () => {
  assert.equal(assetStem('/graphics/pkg/assets/gallery-atlas.ee4a094dbbc9.png'), '/graphics/pkg/assets/gallery-atlas.png');
  assert.equal(assetStem('/graphics/pkg/assets/gallery-atlas.0123456789ab.png'), assetStem('/graphics/pkg/assets/gallery-atlas.ee4a094dbbc9.png'));
  assert.equal(assetStem('/graphics/pkg/assets/reading-book.6a8f1e5f52a0.full.wrc.z'), '/graphics/pkg/assets/reading-book.full.wrc.z');
  assert.notEqual(assetStem('/graphics/pkg/assets/reading-book.4495fb180eb3.soft.wrc.z'), assetStem('/graphics/pkg/assets/reading-book.6a8f1e5f52a0.full.wrc.z'));
  assert.equal(assetStem('/_expo/static/js/web/entry-0a864452f79f6f9625d5581629be18ca.js'), '/_expo/static/js/web/entry.js');
  assert.equal(assetStem('/graphics/voice-surface/pkg/voice_surface_bg.wasm'), '/graphics/voice-surface/pkg/voice_surface_bg.wasm');
  assert.equal(assetStem('/graphics/day-house/runtime.js'), '/graphics/day-house/runtime.js', 'plain words are not hashes');
});

const release = [
  { url: '/index.html', bytes: 10 },
  { url: '/graphics/pkg/watcher_graphics_bg.wasm', bytes: 900 },
  { url: '/_expo/static/js/web/entry-aaaa1111bbbb.js', bytes: 300 },
  { url: '/graphics/pkg/assets/atlas.0123456789ab.png', bytes: 500 },
  { url: '/graphics/scene-a/pkg/scene_a_bg.wasm', bytes: 200 },
  { url: '/graphics/scene-b/pkg/scene_b_bg.wasm', bytes: 400 },
  { url: '/graphics/scene-b/runtime.js', bytes: 5 },
];
const urls = list => list.map(asset => asset.url);

test('full takes the release; the part takes the core and what the device already kept', () => {
  assert.deepEqual(urls(selectAssets(release, { full: true })), urls(release));
  assert.deepEqual(urls(selectAssets(release, { full: false })), ['/index.html', '/graphics/pkg/watcher_graphics_bg.wasm', '/_expo/static/js/web/entry-aaaa1111bbbb.js']);
  // The device viewed scene A and the atlas under an older hash; scene B was never opened.
  const held = ['/graphics/scene-a/pkg/scene_a_bg.wasm', '/graphics/pkg/assets/atlas.fedcba987654.png', '/_expo/static/js/web/entry-cccc2222dddd.js'];
  assert.deepEqual(urls(selectAssets(release, { full: false, held })), ['/index.html', '/graphics/pkg/watcher_graphics_bg.wasm', '/_expo/static/js/web/entry-aaaa1111bbbb.js',
    '/graphics/pkg/assets/atlas.0123456789ab.png', '/graphics/scene-a/pkg/scene_a_bg.wasm']);
  // After a full download on Wi-Fi every file is held, so the part is the whole release.
  assert.deepEqual(urls(selectAssets(release, { full: false, held: urls(release) })), urls(release));
});

test('downloads start with the core, then smaller files', () => {
  assert.deepEqual(urls(downloadOrder(release)), ['/index.html', '/_expo/static/js/web/entry-aaaa1111bbbb.js', '/graphics/pkg/watcher_graphics_bg.wasm',
    '/graphics/scene-b/runtime.js', '/graphics/scene-a/pkg/scene_a_bg.wasm', '/graphics/scene-b/pkg/scene_b_bg.wasm', '/graphics/pkg/assets/atlas.0123456789ab.png']);
  assert.equal(release[0].url, '/index.html', 'the input is not reordered');
});
