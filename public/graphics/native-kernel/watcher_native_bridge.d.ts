/* tslint:disable */
/* eslint-disable */

export class NativeKernel {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    active(value: boolean): void;
    configure_reading_focus(id: number, economy: boolean, enabled: boolean): void;
    static create(): NativeKernel;
    drag_reading(id: number, delta: number, at: number): void;
    frame(at: number): Float64Array;
    frame_reading(at: number): Float64Array;
    frame_reading_focus(at: number): string;
    frame_text(at: number): string;
    insert(id: number, value: number): void;
    mapping(id: number, parent: number, input: Float64Array, output: Float64Array, clamp: boolean): void;
    moving(): boolean;
    observe_reading(id: number, offset: number, at: number): void;
    reading_focus_geometry(id: number, bounds: Float64Array, offset: number, height: number): void;
    register_reading(id: number, values: Float64Array): void;
    register_reading_focus(id: number, count: number): void;
    register_text(id: number, text: string, effect: number): void;
    remove(id: number): void;
    set(id: number, value: number): void;
    stop(id: number): void;
    target(id: number, to: number, duration: number, delay: number, curve: Float64Array, spring: boolean): void;
    text_active(id: number, active: boolean, reduced: boolean): void;
}

export function inflate_runtime(bytes: Uint8Array): Uint8Array;

export function typography(text: string, effect: number, seconds: number, reduced: boolean): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_nativekernel_free: (a: number, b: number) => void;
    readonly inflate_runtime: (a: number, b: number, c: number) => void;
    readonly nativekernel_active: (a: number, b: number) => void;
    readonly nativekernel_configure_reading_focus: (a: number, b: number, c: number, d: number) => void;
    readonly nativekernel_create: () => number;
    readonly nativekernel_drag_reading: (a: number, b: number, c: number, d: number) => void;
    readonly nativekernel_frame: (a: number, b: number, c: number) => void;
    readonly nativekernel_frame_reading: (a: number, b: number, c: number) => void;
    readonly nativekernel_frame_reading_focus: (a: number, b: number, c: number) => void;
    readonly nativekernel_frame_text: (a: number, b: number, c: number) => void;
    readonly nativekernel_insert: (a: number, b: number, c: number) => void;
    readonly nativekernel_mapping: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly nativekernel_moving: (a: number) => number;
    readonly nativekernel_observe_reading: (a: number, b: number, c: number, d: number) => void;
    readonly nativekernel_reading_focus_geometry: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly nativekernel_register_reading: (a: number, b: number, c: number, d: number) => void;
    readonly nativekernel_register_reading_focus: (a: number, b: number, c: number) => void;
    readonly nativekernel_register_text: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly nativekernel_remove: (a: number, b: number) => void;
    readonly nativekernel_set: (a: number, b: number, c: number) => void;
    readonly nativekernel_stop: (a: number, b: number) => void;
    readonly nativekernel_target: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly nativekernel_text_active: (a: number, b: number, c: number, d: number) => void;
    readonly typography: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export3: (a: number, b: number, c: number, d: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
