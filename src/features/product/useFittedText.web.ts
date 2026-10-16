import { useLayoutEffect, useRef, useState } from 'react';
import type { Text } from 'react-native';
import type { FittedTextOptions } from './useFittedText';

/** Fit the loaded font to the actual row width, with a readable size floor. */
export function useFittedText({ enabled, text, size, minimum, tracking }: FittedTextOptions) {
  const ref = useRef<Text>(null);
  const [fit, setFit] = useState({ fontSize: size, letterSpacing: undefined as number | undefined });
  useLayoutEffect(() => {
    if (!enabled || !ref.current) return;
    const element = ref.current as unknown as HTMLElement;
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return;
    let frame = 0, alive = true;
    const update = () => {
      if (!alive) return;
      const width = element.clientWidth - 1;
      if (width <= 0) return;
      const style = getComputedStyle(element);
      const display = style.textTransform === 'uppercase' ? text.toUpperCase() : text;
      const letters = Array.from(display).length;
      const measured = (fontSize: number) => {
        context.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
        return context.measureText(display).width;
      };
      let low = minimum, high = size;
      if (measured(high) + tracking * letters > width) {
        for (let i = 0; i < 12; i++) {
          const middle = (low + high) / 2;
          if (measured(middle) + tracking * letters <= width) low = middle;
          else high = middle;
        }
        high = low;
      }
      const fontSize = Math.max(minimum, Math.floor(high * 10) / 10);
      const letterSpacing = Math.min(tracking, Math.max(0, (width - measured(fontSize)) / Math.max(1, letters)));
      setFit(previous => previous.fontSize === fontSize && previous.letterSpacing === letterSpacing ? previous : { fontSize, letterSpacing });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    document.fonts.ready.then(schedule);
    document.fonts.addEventListener('loadingdone', schedule);
    update();
    return () => { alive = false; cancelAnimationFrame(frame); observer.disconnect(); document.fonts.removeEventListener('loadingdone', schedule); };
  }, [enabled, text, size, minimum, tracking]);
  return { ref, fontSize: enabled ? Math.max(minimum, Math.min(size, fit.fontSize)) : size, letterSpacing: enabled ? fit.letterSpacing : undefined };
}
