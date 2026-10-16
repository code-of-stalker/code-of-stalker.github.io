declare module '*.css';
declare module '*.svg?raw' { const markup:string; export default markup; }
declare module 'react-dom/client' {
  import type {ReactNode} from 'react';
  export function createRoot(container:Element|DocumentFragment):{render(children:ReactNode):void;unmount():void};
}
