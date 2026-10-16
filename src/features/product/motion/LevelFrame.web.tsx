import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { LevelId } from '../content';
import { useThemeColors } from '../ProductTheme';
import { loadGraphics } from './rustEngine.web';

const surface: CSSProperties = { position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' };

/** Layout reports actual dimensions. Rust moves the anchors; SVG is never scaled vertically. */
export function LevelFrame({ level, expanded, width: _width }: { level: LevelId; expanded: boolean; width: number }) {
  const colors = useThemeColors(), root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let disposed = false, size = { width: 0, height: 0 };
    let paint: ((root: HTMLElement, width: number, height: number, level: string) => void) | undefined;
    const observer = new ResizeObserver(([entry]) => {
      size = entry.contentRect;
      paint?.(element, size.width, size.height, level);
    });
    observer.observe(element);
    void loadGraphics().then(module => {
      if (disposed) return;
      paint = module.level_panel_geometry;
      paint(element, size.width, size.height, level);
    });
    return () => { disposed = true; observer.disconnect(); };
  }, [level]);
  return <>
    <div ref={root} aria-hidden data-level-frame={level} style={surface}>
      <svg width="100%" height="100%" style={surface}>
        <path data-level-contour fill={colors.background} fillOpacity=".7" />
      </svg>
    </div>
    <svg aria-hidden data-level-outline={level} width="100%" height="100%" style={{ ...surface, zIndex: 3 }}>
      <path data-level-contour fill="none" stroke={colors.accent} strokeWidth={expanded ? .75 : .25} vectorEffect="non-scaling-stroke" />
    </svg>
  </>;
}
