import { useEffect } from 'react';
import { setSoftScroll } from './softScrollDriver.web';
import { useSystemReducedMotion } from './useSystemReducedMotion.web';

/** «Плавность» glides wheel scrolling in Rust; reduced motion keeps it native. */
export function SoftScroll({ enabled }: { enabled: boolean }) {
  const reduced = useSystemReducedMotion();
  useEffect(() => { setSoftScroll(enabled && !reduced); }, [enabled, reduced]);
  useEffect(() => () => setSoftScroll(false), []);
  return null;
}
