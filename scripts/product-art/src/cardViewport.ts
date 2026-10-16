/** Keep artwork at its width scale, but make the SVG/mask reach the actual card bottom. */
export function cardViewport(width: number, height: number, baseHeight = 200) {
  const logicalHeight = 288 * Math.max(1, height) / Math.max(1, width);
  const y = (baseHeight - logicalHeight) / 2;
  return { x: 0, y, width: 288, height: logicalHeight, bottom: y + logicalHeight, fade: Math.min(logicalHeight * .15, 24) };
}

export function fitCardArtwork(svg: SVGSVGElement) {
  const baseHeight = svg.classList.contains('diary-artwork') ? 130 : svg.closest('[data-illustration="distance"]') ? 200 : 156;
  const bounds = svg.getBoundingClientRect(), view = cardViewport(bounds.width, bounds.height, baseHeight);
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
  svg.querySelectorAll('[data-distance-card-mask],[data-distance-soft-edge],[data-distance-soft-edge] rect').forEach(node => {
    node.setAttribute('x', '0'); node.setAttribute('y', String(view.y));
    node.setAttribute('width', '288'); node.setAttribute('height', String(view.height));
  });
  const edge = svg.querySelector('[data-distance-card-edge]');
  edge?.setAttribute('y1', String(view.bottom - view.fade)); edge?.setAttribute('y2', String(view.bottom));
  svg.dataset.cardBottom = String(view.bottom); svg.dataset.cardFade = String(view.fade);
}
