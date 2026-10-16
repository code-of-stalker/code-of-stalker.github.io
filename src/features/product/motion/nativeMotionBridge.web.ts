// Browser presentation adapter for the few platform Animated.Value surfaces.
// Every numeric interpolation and transition still runs in the Rust kernel.
type Kernel = { insert(id: number, value: number): void; remove(id: number): void; frame(at: number): Float64Array; frame_text(at: number): string; frame_reading(at: number): Float64Array; frame_reading_focus(at: number): string; active(value: boolean): void; moving(): boolean };
const readings = new Map<number, (values: number[]) => void>();
const focuses = new Map<number, (values: number[]) => void>();
const texts = new Map<number, (text: string, opacity: number, scale: number) => void>();
let core: Kernel | undefined, counter = 0, job = 0;
const queued: [string, unknown[]][] = [], listeners = new Map<number, (value: number, finished: boolean) => void>();
export const nextMotionId = () => ++counter;
const tick = (at: number) => { job = 0; if (!core || document.hidden) return; const values = core.frame(at); for (let i = 0; i < values.length; i += 3) listeners.get(values[i])?.(values[i + 1], values[i + 2] === 1); if (texts.size) for (const [id, text, opacity, scale] of JSON.parse(core.frame_text(at)) as [number, string, number, number][]) texts.get(id)?.(text, opacity, scale); const layouts = core.frame_reading(at); for (let i = 0; i < layouts.length; i += 19) readings.get(layouts[i])?.(Array.from(layouts.slice(i + 1, i + 19))); for (const [id, flags] of JSON.parse(core.frame_reading_focus(at)) as [number, number[]][]) focuses.get(id)?.(flags); if (core.moving()) job = requestAnimationFrame(tick); };
const schedule = () => { if (!job && core && !document.hidden) job = requestAnimationFrame(tick); };
let loading: Promise<void> | undefined;
function load() { return loading ??= (async () => {
  const module = await (Function('url', 'return import(url)') as (url: string) => Promise<{ default(options: object): Promise<void>; NativeKernel: { create(): Kernel } }>)('/graphics/native-kernel/watcher_native_bridge.js');
  await module.default({ module_or_path: '/graphics/native-kernel/watcher_native_bridge_bg.wasm' }); core = module.NativeKernel.create();
  for (const [method, args] of queued.splice(0)) invoke(method, args);
  document.addEventListener('visibilitychange', () => { core!.active(!document.hidden); if (document.hidden) { cancelAnimationFrame(job); job = 0; } else schedule(); }); schedule();
})().catch(error => { console.error('Rust motion kernel:', error); }); }
function invoke(method: string, args: unknown[]) { const fn = (core as unknown as Record<string, (...args: unknown[]) => void>)[method]; fn.apply(core, args); }
export function motionCommand(method: string, ...args: unknown[]) { if (core) { invoke(method, args); schedule(); } else { queued.push([method, args]); void load(); } }
export function subscribeMotion(id: number, callback: (value: number, finished: boolean) => void) { listeners.set(id, callback); return () => { listeners.delete(id); motionCommand('remove', id); }; }
export function subscribeRustText(id: number, callback: (text: string, opacity: number, scale: number) => void) { texts.set(id, callback); return () => { texts.delete(id); motionCommand('remove', id); }; }
export function subscribeReading(id: number, callback: (values: number[]) => void) { readings.set(id, callback); return () => { readings.delete(id); motionCommand('remove', id); }; }
export function subscribeReadingFocus(id: number, callback: (values: number[]) => void) { focuses.set(id, callback); return () => { focuses.delete(id); motionCommand('remove', id); }; }
