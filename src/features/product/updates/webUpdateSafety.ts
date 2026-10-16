/** Native builds do not use the web release cache. */
export function blockWebUpdate(): () => void { return () => {}; }
export function useWebUpdateBlock(_blocked: boolean): void {}
export function useWebUpdateReady(_ready: boolean): void {}
