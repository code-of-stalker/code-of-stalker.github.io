import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import type { EffectsController } from '../../product/motion/EffectsController';
import { useEffectsController } from '../../product/motion/EffectsQuality';
import { observeMotionVisibility } from '../../product/motion/motion-visibility.web';
import { useSystemReducedMotion } from '../../product/motion/useSystemReducedMotion.web';
import type { Place } from '../backend';
import { roleMarkInk, roleMarkSize, roleMarkStills } from './roleMarks.generated';

type Field = {
  mount(host: Element, role: number, ink: string, size: number, at: number): number; unmount(id: number): void;
  visible(id: number, value: boolean): void; reduced(value: boolean): void; frame(at: number): boolean;
};
type Module = { default(options: { module_or_path: string }): Promise<unknown>; RoleMarks: new () => Field };
const codes: Record<Place, number> = { walker: 0, guide: 1, admin: 2, main: 3 };

/** Lifecycle only: Rust (graphics/role-marks) draws every mark and writes its
 * motion. This mounts hosts, reports visibility and runs the shared clock
 * while any mark is on the page. */
class Driver {
  private ids = new Set<number>();
  private detachJob?: () => void;
  private reducedNow = false;
  constructor(private field: Field) {}
  mount(host: Element, role: Place, ink: string, size: number, controller: EffectsController | null) {
    const id = this.field.mount(host, codes[role], ink, size, performance.now());
    this.ids.add(id);
    this.detachJob ??= this.schedule(controller);
    return id;
  }
  unmount(id: number) {
    if (!this.ids.delete(id)) return;
    this.field.unmount(id);
    if (!this.ids.size) { this.detachJob?.(); this.detachJob = undefined; }
  }
  visible(id: number, value: boolean) { this.field.visible(id, value); }
  reduced(value: boolean) { if (value !== this.reducedNow) { this.reducedNow = value; this.field.reduced(value); } }
  private schedule(controller: EffectsController | null) {
    if (controller) return controller.frameJob(at => { this.field.frame(at); });
    let handle = 0;
    const tick = (at: number) => { this.field.frame(at); handle = requestAnimationFrame(tick); };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }
}
let driver: Promise<Driver> | undefined;
const loadDriver = () => driver ??= (async () => {
  const value = await (Function('url', 'return import(url)') as (url: string) => Promise<Module>)('/graphics/role-marks/pkg/watcher_role_marks.js');
  await value.default({ module_or_path: '/graphics/role-marks/pkg/watcher_role_marks_bg.wasm' });
  return new Driver(new value.RoleMarks());
})().catch(error => { driver = undefined; throw error; });

const stillSource = (role: Place, ink: string) =>
  ({ uri: 'data:image/svg+xml;utf8,' + encodeURIComponent(roleMarkStills[role].replaceAll(roleMarkInk, ink)) });

/** The animated sign of a role next to its name in the chat. */
export function RoleMark({ role, ink, size = roleMarkSize }: { role: Place; ink: string; size?: number }) {
  const controller = useEffectsController(), focused = useIsFocused(), reduced = useSystemReducedMotion();
  const host = useRef<HTMLSpanElement>(null);
  const latest = useRef({ focused, reduced }), sync = useRef<() => void>(() => {});
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => { latest.current = { focused, reduced }; sync.current(); });
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false, id = 0, onScreen = false, stopObserving: (() => void) | undefined, live: Driver | undefined;
    sync.current = () => {
      if (!live || !id) return;
      live.reduced(latest.current.reduced);
      live.visible(id, onScreen && latest.current.focused);
    };
    loadDriver().then(value => {
      if (disposed) return;
      live = value;
      id = value.mount(element, role, ink, size, controller);
      stopObserving = observeMotionVisibility(element, visible => { onScreen = visible; sync.current(); });
      sync.current();
    }).catch(problem => { if (!disposed) { console.warn('Rust role marks:', problem); setFailed(true); } });
    return () => {
      disposed = true; sync.current = () => {};
      stopObserving?.();
      if (live && id) live.unmount(id);
    };
  }, [controller, ink, role, size]);
  const still = useMemo(() => failed ? stillSource(role, ink) : null, [failed, ink, role]);
  return <span aria-hidden data-graphics="rust-role-mark" data-role={role}
    style={{ display: 'block', position: 'relative', width: size, height: size, flexShrink: 0, pointerEvents: 'none' }}>
    <span ref={host} style={{ display: 'block', width: size, height: size }} />
    {still ? <Image source={still} style={{ position: 'absolute', left: 0, top: 0, width: size, height: size }} contentFit="contain" /> : null}
  </span>;
}
