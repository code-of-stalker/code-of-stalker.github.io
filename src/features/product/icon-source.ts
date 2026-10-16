/** Keep glyph strokes at 0.75 layout pixels, including small 16px controls.
 * Authored panel contours have their own geometry and do not use this helper. */
export const iconStroke = .75;
export const notebookPath = 'M7 3H17a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8 3v18M3 7h4M3 11h4M3 15h4M3 19h4M11 8h5m-5 4h5m-5 4h3';
export const architecturePath = 'M7.5 2H4.5A2.5 2.5 0 0 0 2 4.5v3M16.5 2h3A2.5 2.5 0 0 1 22 4.5v3M2 16.5v3A2.5 2.5 0 0 0 4.5 22h3M22 16.5v3a2.5 2.5 0 0 1-2.5 2.5h-3M3.5 12s3.2-4.5 8.5-4.5 8.5 4.5 8.5 4.5-3.2 4.5-8.5 4.5S3.5 12 3.5 12ZM14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z';
export function iconSource(path: string, color: string, size: number, viewBox = '0 0 24 24', filled = false, linecap: 'round' | 'butt' = 'round') {
  const sourceSize = Number(viewBox.split(' ')[2]);
  const stroke = iconStroke * sourceSize / size;
  return { uri: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}" fill="${filled ? color : 'none'}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="${linecap}" stroke-linejoin="round"><path d="${path}"/></svg>`) };
}
