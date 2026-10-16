import { useEffect, useId, useRef } from 'react';

// Geometry and timing copied from architecture-focus.html (2026-10-08), art('basic').
export function BasicCover({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const root = useRef<SVGSVGElement>(null);
  const id = `basic-${useId().replace(/\W/g, '')}`;
  useEffect(() => {
    const svg = root.current;
    if (!svg) return;
    const one = (s: string) => svg.querySelector(s)!;
    const attr = (el: Element, key: string, v: number | string) => el.setAttribute(key, typeof v === 'number' ? v.toFixed(3) : v);
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const ease = (a: number, b: number, t: number) => { const q = clamp((t - a) / (b - a)); return q * q * (3 - 2 * q); };
    const win = (t: number, a: number, b: number, c: number, d: number) => ease(a, b, t) * (1 - ease(c, d, t));
    const mix = (a: number, b: number, t: number) => a + (b - a) * t;
    let frame = 0, last = 0, seconds = 0;
    const draw = (t: number) => {
      const q = win(t, .1, .44, .8, .98), power = win(t, .045, .16, .82, .99), p = clamp((t - .4) / .36), glow = .75;
      attr(one('.af-traveller'), 'transform', `translate(${mix(43, 91, q)} ${mix(126, 105, q) - Math.sin(q * Math.PI) * 18})`);
      attr(one('.af-traveller'), 'opacity', power * (.4 + glow * .6));
      attr(one('.af-step-fill'), 'opacity', q * .1); attr(one('.af-floor-light'), 'opacity', q * .22 * glow);
      attr(one('.af-step-wave'), 'rx', 6 + p * 28); attr(one('.af-step-wave'), 'ry', 3 + p * 9);
      attr(one('.af-step-wave'), 'opacity', p > 0 && p < 1 ? (1 - p) * .48 : 0);
      svg.dataset.phase = t.toFixed(3);
    };
    const tick = (now: number) => {
      if (!active || reducedMotion) return;
      if (last && !document.hidden) seconds += Math.min(.05, (now - last) / 1000);
      last = now; draw((seconds % 8) / 8); frame = requestAnimationFrame(tick);
    };
    draw(reducedMotion ? .55 : 0);
    if (active && !reducedMotion) frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, reducedMotion]);
  return <svg ref={root} className="af-art" viewBox="28 5 218 150" aria-hidden="true">
    <defs><radialGradient id={id}><stop stopColor="#FFF7BA" stopOpacity=".7"/><stop offset=".2" stopColor="#E7E100" stopOpacity=".2"/><stop offset="1" stopColor="#E7E100" stopOpacity="0"/></radialGradient></defs>
    <path d="M38 144L183 20M216 37L99 148" className="af-dim" strokeDasharray="1 6"/>
    {[3, 2, 1, 0].map(i => { const x = 88 + i * 29, y = 118 - i * 25; return <g key={i} opacity={.88 - i * .16}>
      <path d={`M${x - 33} ${y - 5}L${x} ${y - 20}L${x + 39} ${y - 4}L${x + 6} ${y + 11}Z`} className="af-surface"/>
      <path d={`M${x - 33} ${y - 5}V${y + 3}L${x + 6} ${y + 19}L${x + 39} ${y + 4}V${y - 4}M${x + 6} ${y + 11}V${y + 19}`}/>
      <path d={`M${x - 25} ${y - 5}L${x} ${y - 16}L${x + 30} ${y - 4}`} className="af-hairline af-mid"/>
    </g>; })}
    <path className="af-step-fill" d="M55 113L88 98 127 114 94 129Z" fill="currentColor" opacity="0" stroke="none"/>
    <ellipse cx="91" cy="116" rx="28" ry="9" className="af-solid af-bloom af-floor-light" opacity="0"/>
    <ellipse className="af-step-wave" cx="91" cy="113" rx="6" ry="3" opacity="0"/>
    <g className="af-traveller" opacity="0"><circle r="17" fill={`url(#${id})`} stroke="none"/><circle r="6" className="af-solid af-warm af-bloom" opacity=".45"/><path d="M-6 0H6M0-3V3" className="af-warm" opacity=".3" strokeWidth=".65"/><circle r="1.6" className="af-solid af-warm"/></g>
  </svg>;
}
