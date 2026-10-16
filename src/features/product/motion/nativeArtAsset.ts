import { Asset } from 'expo-asset';
let document: Promise<{ uri: string }> | undefined;
/** One immutable offline document, cached by Expo's content hash. */
export function nativeArtAsset() { return document ??= (async () => {
  const asset = Asset.fromModule(require('../../../../assets/product/rust/graphics-runtime.html'));
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Bundled Rust graphics document is unavailable');
  return { uri: asset.localUri };
})(); }
