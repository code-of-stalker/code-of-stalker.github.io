/** Animated.Value is a platform presentation handle only. Rust owns timing,
 * springs and all numeric range mappings, on both native and web. */
import { Animated as NativeAnimated } from 'react-native';
import { motionCommand, nextMotionId, subscribeMotion } from './nativeMotionBridge';
type Done = (result: { finished: boolean }) => void;
type Curve = ((value: number) => number) & { rustCurve: number[] };
const descriptor = (curve: number[]) => Object.assign((_value: number) => { throw new Error('Easing must execute in Rust'); }, { rustCurve: curve }) as Curve;
export const Easing = {
  linear: descriptor([0, 0]), quad: descriptor([1, 0]), cubic: descriptor([2, 0]), sin: descriptor([3, 0]),
  bezier: (a: number, b: number, c: number, d: number) => descriptor([4, 0, a, b, c, d]),
  in: (curve: Curve) => descriptor([curve.rustCurve[0], 0, ...curve.rustCurve.slice(2)]),
  out: (curve: Curve) => descriptor([curve.rustCurve[0], 1, ...curve.rustCurve.slice(2)]),
  inOut: (curve: Curve) => descriptor([curve.rustCurve[0], 2, ...curve.rustCurve.slice(2)]),
};
export namespace Animated {
  export type CompositeAnimation = NativeAnimated.CompositeAnimation;
  export type AnimatedInterpolation<T extends number | string> = NativeAnimated.AnimatedInterpolation<T>;
  export const View = NativeAnimated.View;
  export const Text = NativeAnimated.Text;
  export const ScrollView = NativeAnimated.ScrollView;
  export class Value extends NativeAnimated.Value {
    readonly rustId = nextMotionId();
    readonly initial: number;
    current: number;
    completion?: Done;
    private mappings = new Map<string, NativeAnimated.AnimatedInterpolation<number | string>>();
    constructor(value: number) {
      super(value); this.initial = this.current = value;
      motionCommand('insert', this.rustId, value);
      subscribeMotion(this.rustId, (next, finished) => { this.current = next; super.setValue(next); if (finished) { const done = this.completion; this.completion = undefined; done?.({ finished: true }); } });
    }
    setValue(value: number) { this.current = value; super.setValue(value); motionCommand('set', this.rustId, value); }
    stopAnimation(callback?: (value: number) => void) { motionCommand('stop', this.rustId); const done = this.completion; this.completion = undefined; done?.({ finished: false }); callback?.(this.current); }
    interpolate<OutputT extends number | string>(config: { inputRange: number[]; outputRange: OutputT[]; extrapolate?: 'extend' | 'identity' | 'clamp'; extrapolateLeft?: 'extend' | 'identity' | 'clamp'; extrapolateRight?: 'extend' | 'identity' | 'clamp'; easing?: (input: number) => number }): NativeAnimated.AnimatedInterpolation<OutputT> {
      const key = JSON.stringify(config), cached = this.mappings.get(key);
      if (cached) return cached as NativeAnimated.AnimatedInterpolation<OutputT>;
      const numeric = config.outputRange.every(value => typeof value === 'number');
      if (!numeric) {
        // String units are presentation syntax; Rust interpolates the numbers.
        const values = config.outputRange.map(value => Number.parseFloat(String(value)));
        const unit = String(config.outputRange[0]).replace(String(values[0]), '');
        if (values.some(value => !Number.isFinite(value))) throw new Error('Unsupported Rust motion string');
        const mapped = new Value(values[0]);
        motionCommand('mapping', mapped.rustId, this.rustId, config.inputRange, values, config.extrapolate === 'clamp');
        const result = NativeAnimated.Value.prototype.interpolate.call(mapped, { inputRange: [0, 1], outputRange: [`0${unit}`, `1${unit}`] }) as NativeAnimated.AnimatedInterpolation<OutputT>;
        this.mappings.set(key, result); return result;
      }
      const mapped = new Value(Number(config.outputRange[0]));
      motionCommand('mapping', mapped.rustId, this.rustId, config.inputRange, config.outputRange, config.extrapolate === 'clamp');
      const result = mapped as unknown as NativeAnimated.AnimatedInterpolation<OutputT>; this.mappings.set(key, result); return result;
    }
  }
  export function timing(value: NativeAnimated.Value, config: NativeAnimated.TimingAnimationConfig): CompositeAnimation {
    return transition(value, config, false);
  }
  export function spring(value: NativeAnimated.Value, config: NativeAnimated.SpringAnimationConfig): CompositeAnimation {
    return transition(value, config, true);
  }
  function transition(value: NativeAnimated.Value, config: NativeAnimated.TimingAnimationConfig | NativeAnimated.SpringAnimationConfig, spring: boolean): CompositeAnimation {
    if (!(value instanceof Value) || typeof config.toValue !== 'number') throw new Error('Rust transition needs a Rust numeric channel');
    const initial = value.current;
    return { start(done?: Done) { value.stopAnimation(); value.completion = done; const options = config as NativeAnimated.TimingAnimationConfig;
      motionCommand('target', value.rustId, config.toValue, options.duration ?? 500, options.delay ?? 0, (options.easing as Curve | undefined)?.rustCurve ?? [4, 0, .42, 0, .58, 1], spring);
    }, stop() { value.stopAnimation(); }, reset() { value.stopAnimation(); value.setValue(initial); } };
  }
  export function sequence(items: CompositeAnimation[]): CompositeAnimation {
    let at = 0, running = false, complete: Done | undefined;
    const next = ({ finished }: { finished: boolean }) => { if (!running) return; if (!finished || at >= items.length) { running = false; complete?.({ finished }); return; } items[at++].start(next); };
    return { start(done?: Done) { at = 0; running = true; complete = done; next({ finished: true }); }, stop() { const was = running; running = false; items[Math.max(0, at - 1)]?.stop(); if (was) complete?.({ finished: false }); }, reset() { items.forEach(item => item.reset()); at = 0; } };
  }
  export function parallel(items: CompositeAnimation[]): CompositeAnimation {
    let remaining = 0, running = false, complete: Done | undefined;
    return { start(done?: Done) { remaining = items.length; running = true; complete = done; if (!remaining) done?.({ finished: true }); items.forEach(item => item.start(({ finished }) => { if (!running) return; if (!finished) { running = false; complete?.({ finished: false }); return; } if (!--remaining) { running = false; complete?.({ finished: true }); } })); }, stop() { const was = running; running = false; items.forEach(item => item.stop()); if (was) complete?.({ finished: false }); }, reset() { items.forEach(item => item.reset()); } };
  }
  export function loop(item: CompositeAnimation): CompositeAnimation {
    let running = false;
    const next = ({ finished }: { finished: boolean }) => { if (running && finished) { item.reset(); item.start(next); } };
    return { start() { running = true; item.reset(); item.start(next); }, stop() { running = false; item.stop(); }, reset() { item.reset(); } };
  }
  export function delay(duration: number): CompositeAnimation { return timing(new Value(0), { toValue: 1, duration, useNativeDriver: false }); }
  export const event: typeof NativeAnimated.event = (mapping, config) => NativeAnimated.event(mapping, { ...config, useNativeDriver: false });
}
