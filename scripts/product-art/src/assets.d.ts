declare module '*.svg?raw' { const source: string; export default source; }
declare module '*.css';
declare module 'react-dom/client' {
  export function createRoot(container: Element | DocumentFragment): { render(children: import('react').ReactNode): void; unmount(): void };
}
