import type { EffectsController } from '../motion/EffectsController';

type Field = {
  attach(element: HTMLElement, at: number): number; settle(id: number, at: number): void; detach(id: number): void;
  reduced(value: boolean): void; gone(id: number, at: number): boolean; frame(at: number): boolean;
};
type Runtime = { field(): Promise<Field> };
let runtime: Promise<Field> | undefined;
/** The skeleton's own small Rust module: it runs long before the graphics engine. */
export const loadSkeletonField = () => runtime ??= (Function('url', 'return import(url)') as (url: string) => Promise<Runtime>)('/graphics/skeleton/runtime.js')
  .then(module => module.field()).catch(error => { runtime = undefined; throw error; });

/** Lifecycle only: Rust writes every skeleton's presence and scan each frame;
 * this schedules the frames on the shared clock and reports hand-overs. */
class Driver {
  private hosts = new Map<number, { settled: boolean; gone(): void }>();
  private detachJob?: () => void;
  constructor(private field: Field) {}
  attach(element: HTMLElement, controller: EffectsController | null, gone: () => void) {
    const id = this.field.attach(element, performance.now());
    this.hosts.set(id, { settled: false, gone });
    if (!this.detachJob) this.detachJob = this.schedule(controller);
    return id;
  }
  settle(id: number) { const host = this.hosts.get(id); if (!host || host.settled) return; host.settled = true; this.field.settle(id, performance.now()); }
  release(id: number) {
    if (!this.hosts.delete(id)) return;
    this.field.detach(id);
    if (!this.hosts.size) { this.detachJob?.(); this.detachJob = undefined; }
  }
  reduced(value: boolean) { this.field.reduced(value); }
  private frame(at: number) {
    this.field.frame(at);
    for (const [id, host] of this.hosts) if (host.settled && this.field.gone(id, at)) { this.release(id); host.gone(); }
  }
  private schedule(controller: EffectsController | null) {
    if (controller) return controller.frameJob(at => this.frame(at));
    let handle = 0;
    const tick = (at: number) => { this.frame(at); handle = requestAnimationFrame(tick); };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }
}
let driver: Promise<Driver> | undefined;
export const skeletonDriver = () => driver ??= loadSkeletonField().then(field => new Driver(field)).catch(error => { driver = undefined; throw error; });
