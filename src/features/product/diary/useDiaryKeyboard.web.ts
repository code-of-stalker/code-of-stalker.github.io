import { useEffect, useRef, useState } from 'react';
import { useVisibleViewport } from '../motion/useVisibleViewport';

/** iOS browser keyboards resize the visual viewport, not the page's layout. */
export function useDiaryKeyboard() {
  const viewportSize = useVisibleViewport();
  const restingHeight = useRef(typeof window === 'undefined' ? 0 : window.innerHeight);
  const [keyboard, setKeyboard] = useState({ bottomInset: 0, visible: false });
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const editing = document.activeElement?.matches('textarea,input,[contenteditable="true"],iframe[data-testid="diary-editor"]');
        if (!editing) restingHeight.current = innerHeight;
        // Pinch zoom is not a keyboard opening.
        const visible = !!editing && viewport.scale < 1.05 && restingHeight.current - viewport.height > 120;
        const bottomInset = visible ? Math.max(0, innerHeight - viewport.height - viewport.offsetTop) : 0;
        setKeyboard(previous => previous.visible === visible && Math.abs(previous.bottomInset - bottomInset) < 1 ? previous : { visible, bottomInset });
      });
    };
    viewport.addEventListener('resize', update); viewport.addEventListener('scroll', update);
    document.addEventListener('focusin', update); document.addEventListener('focusout', update); update();
    return () => { cancelAnimationFrame(frame); viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update); document.removeEventListener('focusin', update); document.removeEventListener('focusout', update); };
  }, []);
  return { ...keyboard, viewportHeight: viewportSize.height };
}
