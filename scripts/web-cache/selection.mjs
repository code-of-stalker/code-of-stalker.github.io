// Which release files a device keeps for offline use. Pure functions: the
// build inlines this file into the service worker (without `export`), and the
// unit tests import it directly.

// Every page needs these: the shell, app code and styles, fonts, icons, the
// engine and the small shared UI runtimes (skeleton lists, soft scroll, icon
// motion, Intensive role marks). Scenes and the engine's art load as pages open.
const CORE_GRAPHICS = /^\/graphics\/(?:pkg\/watcher_graphics[^/]*|(?:skeleton|soft-scroll|role-marks|native-kernel)\/.*)$/;
export function isCoreAsset(url) {
  return !url.startsWith('/graphics/') || CORE_GRAPHICS.test(url);
}

// The whole release may download on Wi-Fi or a wired link without Data Saver.
// Mobile data, Data Saver and an unknown link (Safari and Firefox have no
// connection info) keep to the part. Desktop Chrome and Edge report no link
// type at all; a computer on a fast link is not on mobile data in practice.
export function networkAllowsFull(connection, agent) {
  if (!connection || connection.saveData === true) return false;
  if (connection.type) return connection.type === 'wifi' || connection.type === 'ethernet';
  return agent?.mobile === false && connection.effectiveType === '4g';
}

// A file's address without its content hash, so a changed engine asset (new
// hash, new address) still counts as the file the device already kept.
export function assetStem(url) {
  return url.replace(/[.-](?=[0-9a-f]*\d)[0-9a-f]{8,}(?=\.)/gi, '');
}

// The files to put into a new release cache. Full: all of them. Part: the core
// plus every file the device kept from earlier releases (`held`, their
// addresses), so an update on mobile data brings only the changed files of
// what the device already had; unchanged ones are copied locally.
export function selectAssets(assets, { full, held = [] }) {
  if (full) return assets.slice();
  const stems = new Set(held.map(assetStem));
  return assets.filter(asset => isCoreAsset(asset.url) || stems.has(assetStem(asset.url)));
}

// Order for a download: the core first, so a page that opens mid-download
// already has its shell and engine; then smaller files before larger ones.
export function downloadOrder(assets) {
  return assets.slice().sort((a, b) => Number(isCoreAsset(b.url)) - Number(isCoreAsset(a.url)) || a.bytes - b.bytes || a.url.localeCompare(b.url, 'en'));
}
