import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { panelSvg, panelSvgSize, type PanelSource } from './panelArtworkGeometry';
import { loadGraphics } from './rustEngine.web';

/** Rust fits every path in actual CSS coordinates before the resized frame paints. */
export function PanelArtwork({ source, color, style, flipY=false }: { source: PanelSource; color?: string; style?: StyleProp<ViewStyle>; flipY?:boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const {uri}=source;
  const markup = useMemo(() => {
    const sourceSvg = panelSvg({uri}), size = panelSvgSize(sourceSvg);
    const svg = sourceSvg.replace(/<svg\b[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" fill="none" style="position:absolute;inset:0;overflow:visible;pointer-events:none">')
      .replace(/<path\b[^>]*>/g, tag => tag.replace(/vector-effect="[^"]+"/g,'').replace('<path ', '<path data-panel-contour vector-effect="non-scaling-stroke" '));
    return { svg: color ? svg.replaceAll('#F5DD07', color) : svg, size };
  }, [uri, color]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    // React owns the host; the geometry adapter owns its SVG. Parent rerenders
    // must not replace fitted paths with the original authored markup.
    element.innerHTML = markup.svg;
    let disposed = false, size = { width: 0, height: 0 };
    const paths = [...element.querySelectorAll('[data-panel-contour]')].map(path => ({ path, source: path.getAttribute('d')! }));
    paths.forEach(({path,source}) => path.setAttribute('data-panel-source',source));
    let fit: ((path: string, fromWidth: number, fromHeight: number, width: number, height: number) => string) | undefined;
    const paint = () => {
      if (!fit || !(size.width > 0 && size.height > 0)) return;
      for (const { path, source } of paths) path.setAttribute('d', fit(source, markup.size.width, markup.size.height, size.width, size.height));
      element.style.visibility = 'visible';
    };
    const observer = new ResizeObserver(([entry]) => { size = entry.contentRect; paint(); });
    observer.observe(element);
    void loadGraphics().then(module => { if (!disposed) { fit = module.panel_geometry; paint(); } }).catch(error => console.error('Panel geometry:', error));
    return () => { disposed = true; observer.disconnect(); };
  }, [markup]);
  return <div ref={root} aria-hidden data-panel-artwork style={{ position: 'absolute', inset: 0, pointerEvents: 'none', visibility: 'hidden', ...StyleSheet.flatten(style), ...(flipY?{transform:'scaleY(-1)'}:{}) } as React.CSSProperties} />;
}
