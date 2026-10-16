/** Expand drawing references without changing paths, masks or placement.
 * Smaller people used nested masks through SVG <use> shadow trees. Drawing the
 * same paths directly avoids that extra rendering route on mobile Chromium.
 * The supplied Laboratory SVG remains the source of every contour.
 */
export function directSvgDrawings(source: string) {
  const drawings = new Map<string, { outer: string; body: string; attributes: string }>();
  const starts = /<g\b([^>]*\bid="(mcw-id-drawing-[^"]+)"[^>]*)>/g;
  let start: RegExpExecArray | null;
  while ((start = starts.exec(source))) {
    const groups = /<\/?g\b[^>]*>/g;
    groups.lastIndex = starts.lastIndex;
    let depth = 1, closing: RegExpExecArray | null;
    while ((closing = groups.exec(source))) {
      depth += closing[0].startsWith('</') ? -1 : 1;
      if (!depth) {
        drawings.set(start[2], { outer: source.slice(start.index, groups.lastIndex), body: source.slice(starts.lastIndex, closing.index),
          attributes: start[1].replace(/\bid="[^"]*"/, '') });
        starts.lastIndex = groups.lastIndex;
        break;
      }
    }
    if (depth) throw new Error('Unclosed Laboratory drawing');
  }
  let output = source.replace(/<use\b([^>]*)\/>/g, (original, attributes: string) => {
    const reference = /\bhref="#(mcw-id-drawing-[^"]+)"/.exec(attributes);
    if (!reference) return original;
    const drawing = drawings.get(reference[1]);
    if (!drawing) throw new Error('Missing Laboratory drawing');
    return `<g data-vector-drawing="${reference[1]}" ${attributes.replace(/\bhref="[^"]*"/, '')} ${drawing.attributes}>${drawing.body}</g>`;
  });
  // Definitions were used only for the expanded references, so avoid keeping a
  // second hidden copy of the same detailed vector geometry in the document.
  for (const drawing of drawings.values()) output = output.replace(drawing.outer, '');
  return output;
}
