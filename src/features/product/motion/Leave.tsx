import { useEffect, useRef, type PropsWithChildren } from 'react';

export function Leave({ children, leaving, onGone }: PropsWithChildren<{ leaving: boolean; onGone(): void }>) {
  const latest = useRef(onGone);
  useEffect(() => { latest.current = onGone; });
  useEffect(() => { if (leaving) latest.current(); }, [leaving]);
  return <>{children}</>;
}
