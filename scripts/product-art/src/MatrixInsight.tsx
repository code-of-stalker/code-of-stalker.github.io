import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { mountMatrixMotion } from './laboratory/components/matrix/matrixMotion';

// Original Laboratory sphere, two orbiting rings and the two revealed circles.
export function MatrixInsight({ active, decoderVisible }: { active: boolean; decoderVisible: boolean }) {
  const svg = useRef<SVGSVGElement>(null), decoder = useRef<HTMLButtonElement>(null);
  const motion = useRef<ReturnType<typeof mountMatrixMotion> | null>(null);
  const id = useId().replace(/[^a-z0-9-]/gi, '');
  useLayoutEffect(() => {
    const node = decoder.current;
    if (!node) return;
    const lines = [...node.querySelectorAll<HTMLElement>('.mx-decoder-line')];
    let disposed = false;
    function fit() {
      if (disposed || !node) return;
      const width = node.clientWidth;
      if (!width) return;
      lines.forEach((line, index) => {
        const maximum = index ? 30 : 22;
        line.style.fontSize = `${maximum}px`; line.style.letterSpacing = '2.2px';
        const scale = Math.min(1, (width - 1) / line.scrollWidth);
        line.style.fontSize = `${maximum * scale}px`;
        line.style.letterSpacing = `${2.2 * scale}px`;
      });
    }
    const observer = new ResizeObserver(fit);
    observer.observe(node); fit();
    void document.fonts.ready.then(fit);
    return () => { disposed = true; observer.disconnect(); };
  }, []);
  useEffect(() => {
    if (!svg.current || !decoder.current) return;
    const current = mountMatrixMotion(svg.current, decoder.current, id, { waitForDecoder: true }); motion.current = current;
    return () => { current.dispose(); motion.current = null; };
  }, [id]);
  useEffect(() => { motion.current?.setPaused(!active); }, [active]);
  useEffect(() => { motion.current?.setDecoderVisible(decoderVisible); }, [decoderVisible]);
  return <div style={{ width: '100%', height: '100%', color: '#f5dd07' }}>
    <svg ref={svg} style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '264 / 62' }} aria-label="Сфера и два круга" />
    <button ref={decoder} className="mx-insight mx-decoder" type="button" aria-label="Остальные похожи. Но они не ты." style={{ visibility: 'hidden', opacity: 0 }}>
      <span className="mx-insight-content" aria-hidden="true">
        {['ОСТАЛЬНЫЕ ПОХОЖИ.', 'НО ОНИ НЕ ТЫ.'].map(line => <span key={line} className="mx-decoder-line">
          {line.split(' ').map((word, index) => <span key={index}>{index ? ' ' : ''}<span className="mx-code-word">
            {[...word].map((char, i) => <span key={i} className="mx-code-glyph" data-character={char} data-locked="true"><span className="mx-code-symbol">{char}</span></span>)}
          </span></span>)}
        </span>)}
      </span>
      <span className="mx-decoder-scan" aria-hidden="true" /><span className="mx-decoder-terminal" aria-hidden="true" />
    </button>
  </div>;
}
