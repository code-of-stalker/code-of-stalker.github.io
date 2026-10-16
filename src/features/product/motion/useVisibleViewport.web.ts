import { useEffect, useState } from 'react';

/** Layout height stays unchanged when WebKit opens or pans above its keyboard. */
export function useVisibleViewport() {
  const read = () => typeof window === 'undefined' ? { height: 0, top: 0 } : {
    height: window.visualViewport?.height ?? window.innerHeight,
    top: window.visualViewport?.offsetTop ?? 0,
  };
  const [viewport, setViewport] = useState(read);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = read();
        setViewport(previous => Math.abs(previous.height - next.height) < .5 && Math.abs(previous.top - next.top) < .5 ? previous : next);
      });
    };
    const visual = window.visualViewport;
    visual?.addEventListener('resize', update); visual?.addEventListener('scroll', update);
    window.addEventListener('resize', update); update();
    return () => { cancelAnimationFrame(frame); visual?.removeEventListener('resize', update); visual?.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, []);
  return viewport;
}
