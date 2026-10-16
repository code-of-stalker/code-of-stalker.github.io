/** On this black scene, paint the existing occluder/fades instead of two animated luminance masks. */
export function optimizeObserverMarkup(source: string) {
  const viewport = source.match(/<mask id="maw-id-viewport"[^>]*>([\s\S]*?)<\/mask>/);
  const occlusion = source.match(/<mask id="maw-id-observer-occlusion"[^>]*>([\s\S]*?)<\/mask>/);
  const fade = viewport?.[1].match(/<g class="maw-edge-fade">[\s\S]*?<\/g>/)?.[0];
  const guard = viewport?.[1].match(/<rect[^>]*fill="url\(#maw-id-bottom-guard\)"[^>]*\/>/)?.[0];
  const blocker = occlusion?.[1].match(/<path\b[^>]*\/>/)?.[0];
  if (!viewport || !occlusion || !fade || !guard || !blocker) throw new Error('Observer source structure changed');
  return source.replace(viewport[0], '').replace(occlusion[0], '')
    .replace(' mask="url(#maw-id-viewport)"', '')
    .replace(' mask="url(#maw-id-observer-occlusion)"', '')
    .replace('<g class="maw-other-shift" data-person="other">', `${blocker}<g class="maw-other-shift" data-person="other">`)
    .replace(/<\/svg>\s*$/, `${fade}${guard}</svg>`);
}
