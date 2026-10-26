/* tslint:disable */
/* eslint-disable */

export class ElementTimeline {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    active(value: boolean): void;
    static create(root: HTMLElement): ElementTimeline;
    dispose(): void;
    frame(at: number): boolean;
    initial(values: Float64Array): void;
    initial_height(value: number): void;
    loop(width: number, speed: number): void;
    loop_width(): number;
    moving(): boolean;
    reset_clock(): void;
    /**
     * Original Laboratory scanner on a text/layout surface, with no GPU pass.
     */
    scan_reveal(duration: number, delay: number): void;
    /**
     * Gesture input only changes the target. The shared Rust clock retains
     * position/velocity between touch events and owns every displayed frame.
     */
    spring_scale(value: number, snap: boolean): void;
    target(values: Float64Array, duration: number, delay: number, curve: Float64Array): void;
    target_height(value: number, duration: number): void;
    target_height_curve(value: number, duration: number, curve: Float64Array): void;
}

export class ProductRenderer {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    active(id: number, active: boolean, reduced: boolean): void;
    add(scan: boolean): number;
    add_observer(): number;
    add_rain(): number;
    add_raster(kind: string): number;
    add_vector(root: Element, kind: string, card: boolean): number;
    backend(): string;
    /**
     * Representative optical load; the bridge supplies only delivery time.
     */
    benchmark(id: number, at: number): void;
    commits(id: number): number;
    static create(canvas: HTMLCanvasElement, force_gl: boolean): Promise<ProductRenderer>;
    dispose(): void;
    frame(now: number): boolean;
    /**
     * Counters describe allocations/submissions, never GPU execution time.
     */
    metrics(id: number): Float64Array;
    moving(id: number): boolean;
    /**
     * Presentation palette changes preserve timelines, geometry and allocation.
     */
    palette(code: number): void;
    pointer(id: number, x: number, y: number, down: boolean): void;
    present_to(id: number, canvas: HTMLCanvasElement): boolean;
    quality(density: number, cost: number, fps: number): void;
    quality_pending(): boolean;
    rect(id: number): Float64Array;
    remove(id: number): void;
    replay_scan(id: number): void;
    reset_clock(): void;
    resize(id: number, w: number, h: number, path: string, orbs: boolean): void;
    restore(state: ProductState): void;
    reveal(id: number): number;
    snapshot(): ProductState;
    vector_audio(id: number, low: number, mid: number, high: number, contour: Float64Array, reacting: boolean, progress: number, locked: boolean, playback: boolean): void;
    vector_decoder(id: number, visible: boolean): void;
    vector_interact(id: number, action: string, x: number, y: number): void;
    vector_pointer_down(id: number, at: number, w: number, h: number, delay: number): void;
    vector_pointer_move(id: number, at: number, dx: number, dy: number): void;
    vector_pointer_up(id: number, at: number, inside: boolean): boolean;
}

/**
 * Opaque CPU state. Surface recovery moves the live clocks/envelopes/gestures;
 * JavaScript neither reconstructs intermediate frames nor serializes keyframes.
 */
export class ProductState {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
}

export class SvgTimeline {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    active(value: boolean, reduced: boolean): void;
    audio(low: number, mid: number, high: number, contour: Float64Array, reacting: boolean, lock_progress: number, locked: boolean, playback: boolean): void;
    static create(root: Element, kind: string, card: boolean): SvgTimeline;
    decoder_visible(value: boolean): void;
    dispose(): void;
    draws(): number;
    frame(now: number): boolean;
    interact(action: string, x: number, y: number): void;
    pointer_down(at: number, width: number, height: number, delay: number): void;
    pointer_move(at: number, dx: number, dy: number): void;
    pointer_up(at: number, inside: boolean): boolean;
    reading_palette(code: number): void;
    reset_clock(): void;
    resize(width: number, height: number): void;
    time(): number;
}

export class TextTimeline {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    active(active: boolean, reduced: boolean): void;
    static create(root: HTMLElement, text: string, effect: number): TextTimeline;
    dispose(): void;
    frame(at: number): boolean;
    reset_clock(): void;
    resize(): void;
}

export function graphics_diagnostics(): void;

export function level_panel_geometry(root: HTMLElement, width: number, height: number, level: string): void;

export function panel_geometry(path: string, from_width: number, from_height: number, width: number, height: number): string;

export function panel_reveal(root: HTMLElement, progress: number, reduced: boolean): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_elementtimeline_free: (a: number, b: number) => void;
    readonly __wbg_productrenderer_free: (a: number, b: number) => void;
    readonly __wbg_productstate_free: (a: number, b: number) => void;
    readonly __wbg_svgtimeline_free: (a: number, b: number) => void;
    readonly __wbg_texttimeline_free: (a: number, b: number) => void;
    readonly elementtimeline_active: (a: number, b: number) => void;
    readonly elementtimeline_create: (a: number) => number;
    readonly elementtimeline_dispose: (a: number) => void;
    readonly elementtimeline_frame: (a: number, b: number) => number;
    readonly elementtimeline_initial: (a: number, b: number, c: number) => void;
    readonly elementtimeline_initial_height: (a: number, b: number) => void;
    readonly elementtimeline_loop: (a: number, b: number, c: number) => void;
    readonly elementtimeline_loop_width: (a: number) => number;
    readonly elementtimeline_moving: (a: number) => number;
    readonly elementtimeline_reset_clock: (a: number) => void;
    readonly elementtimeline_scan_reveal: (a: number, b: number, c: number) => void;
    readonly elementtimeline_spring_scale: (a: number, b: number, c: number) => void;
    readonly elementtimeline_target: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly elementtimeline_target_height: (a: number, b: number, c: number) => void;
    readonly elementtimeline_target_height_curve: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly graphics_diagnostics: () => void;
    readonly level_panel_geometry: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly panel_geometry: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly panel_reveal: (a: number, b: number, c: number) => void;
    readonly productrenderer_active: (a: number, b: number, c: number, d: number) => void;
    readonly productrenderer_add: (a: number, b: number) => number;
    readonly productrenderer_add_observer: (a: number) => number;
    readonly productrenderer_add_rain: (a: number) => number;
    readonly productrenderer_add_raster: (a: number, b: number, c: number, d: number) => void;
    readonly productrenderer_add_vector: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly productrenderer_backend: (a: number, b: number) => void;
    readonly productrenderer_benchmark: (a: number, b: number, c: number) => void;
    readonly productrenderer_commits: (a: number, b: number) => number;
    readonly productrenderer_create: (a: number, b: number) => number;
    readonly productrenderer_dispose: (a: number) => void;
    readonly productrenderer_frame: (a: number, b: number, c: number) => void;
    readonly productrenderer_metrics: (a: number, b: number, c: number) => void;
    readonly productrenderer_moving: (a: number, b: number) => number;
    readonly productrenderer_palette: (a: number, b: number) => void;
    readonly productrenderer_pointer: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly productrenderer_present_to: (a: number, b: number, c: number, d: number) => void;
    readonly productrenderer_quality: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly productrenderer_quality_pending: (a: number) => number;
    readonly productrenderer_rect: (a: number, b: number, c: number) => void;
    readonly productrenderer_remove: (a: number, b: number) => void;
    readonly productrenderer_replay_scan: (a: number, b: number) => void;
    readonly productrenderer_reset_clock: (a: number) => void;
    readonly productrenderer_resize: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly productrenderer_restore: (a: number, b: number, c: number) => void;
    readonly productrenderer_reveal: (a: number, b: number) => number;
    readonly productrenderer_snapshot: (a: number) => number;
    readonly productrenderer_vector_audio: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly productrenderer_vector_decoder: (a: number, b: number, c: number) => void;
    readonly productrenderer_vector_interact: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly productrenderer_vector_pointer_down: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly productrenderer_vector_pointer_move: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly productrenderer_vector_pointer_up: (a: number, b: number, c: number, d: number) => number;
    readonly svgtimeline_active: (a: number, b: number, c: number) => void;
    readonly svgtimeline_audio: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
    readonly svgtimeline_create: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly svgtimeline_decoder_visible: (a: number, b: number) => void;
    readonly svgtimeline_dispose: (a: number) => void;
    readonly svgtimeline_draws: (a: number) => number;
    readonly svgtimeline_frame: (a: number, b: number) => number;
    readonly svgtimeline_interact: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly svgtimeline_pointer_down: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly svgtimeline_pointer_move: (a: number, b: number, c: number, d: number) => void;
    readonly svgtimeline_pointer_up: (a: number, b: number, c: number) => number;
    readonly svgtimeline_reading_palette: (a: number, b: number) => void;
    readonly svgtimeline_reset_clock: (a: number) => void;
    readonly svgtimeline_resize: (a: number, b: number, c: number) => void;
    readonly svgtimeline_time: (a: number) => number;
    readonly texttimeline_active: (a: number, b: number, c: number) => void;
    readonly texttimeline_create: (a: number, b: number, c: number, d: number) => number;
    readonly texttimeline_dispose: (a: number) => void;
    readonly texttimeline_frame: (a: number, b: number) => number;
    readonly texttimeline_reset_clock: (a: number) => void;
    readonly texttimeline_resize: (a: number) => void;
    readonly __wasm_bindgen_func_elem_2092: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_2092_77: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_2092_78: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_7966: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_7987: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_2096: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number) => void;
    readonly __wbindgen_export4: (a: number, b: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export5: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
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
