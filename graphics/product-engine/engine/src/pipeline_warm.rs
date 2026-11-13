//! Render pipelines compile off the browser's GPU main thread.
//!
//! Chrome compiles a synchronous `createRenderPipeline` on the GPU process main
//! thread (on Windows: Dawn -> D3D12 -> DXC). Until it returns, no frame of the
//! page is composited: on a cold shader cache the glass shader alone froze the
//! browser for about four seconds on every first visit.
//! `createRenderPipelineAsync` compiles on the browser's worker threads, and Dawn
//! keeps each finished pipeline in a per-device cache keyed by its content
//! (shaders, layout and states; the label is not part of the key).
//!
//! [`precompile`] therefore runs a pipeline builder twice:
//! 1. record: on this one device object, `createRenderPipeline` is shadowed by a
//!    function that hands each descriptor wgpu produces to
//!    `createRenderPipelineAsync` and returns an inert stand-in (wgpu only wraps it,
//!    and the recorded objects are dropped unused; dropping a web pipeline is a
//!    no-op in wgpu 30);
//! 2. the shadow is removed and every background compile is awaited;
//! 3. the caller runs the same builder for real: every synchronous create is now a
//!    cache hit and returns at once.
//!
//! The recorded descriptors are exactly the ones wgpu sends in step 3, so the
//! pipelines, and every frame drawn with them, are unchanged. WebGL2 (no WebGPU
//! device) skips the record pass; its programs link as before.
use js_sys::{Array, Function, Object, Promise, Reflect};
use wasm_bindgen::{prelude::*, JsCast};
use wasm_bindgen_futures::JsFuture;

const CREATE: &str = "createRenderPipeline";
const CREATE_ASYNC: &str = "createRenderPipelineAsync";
/// Longest wait for the background compiles. Past it the real build runs anyway
/// and compiles whatever is missing synchronously, as it did before.
const PATIENCE_MS: i32 = 20_000;

/// Removes the shadowing own property even if the builder unwinds.
struct Shadow<'a>(&'a Object);
impl Drop for Shadow<'_> {
    fn drop(&mut self) {
        let _ = Reflect::delete_property(self.0, &JsValue::from_str(CREATE));
    }
}

/// Compiles, in the background, every render pipeline `build` creates on `device`,
/// and resolves once they are all compiled. Whatever `build` returns in the record
/// pass is dropped. The caller then calls the same builder for its real objects.
pub async fn precompile<T>(device: &wgpu::Device, build: impl FnOnce() -> T) {
    let Some(gpu) = device.as_webgpu() else {
        return;
    };
    let gpu: &JsValue = gpu.as_ref();
    let Some(compile) = Reflect::get(gpu, &JsValue::from_str(CREATE_ASYNC))
        .ok()
        .and_then(|f| f.dyn_into::<Function>().ok())
    else {
        return;
    };
    let pending = Array::new();
    let record = {
        let (gpu, pending) = (gpu.clone(), pending.clone());
        Closure::<dyn FnMut(JsValue) -> JsValue>::new(move |descriptor: JsValue| {
            if let Ok(promise) = compile.call1(&gpu, &descriptor) {
                pending.push(&promise);
            }
            Object::new().into()
        })
    };
    let target: &Object = gpu.unchecked_ref();
    if !Reflect::set(target, &JsValue::from_str(CREATE), record.as_ref()).unwrap_or(false) {
        return;
    }
    {
        let _shadow = Shadow(target);
        drop(build());
    }
    drop(record);
    if pending.length() == 0 {
        return;
    }
    // allSettled: a pipeline that fails to compile here is reported by the real,
    // synchronous create inside the caller's error scope, exactly as before.
    let settled = Promise::all_settled(&pending);
    let patience = Promise::new(&mut |resolve, _| {
        let waited = web_sys::window().map(|window| {
            window.set_timeout_with_callback_and_timeout_and_arguments_0(&resolve, PATIENCE_MS)
        });
        if !matches!(waited, Some(Ok(_))) {
            let _ = resolve.call0(&JsValue::UNDEFINED);
        }
    });
    let _ = JsFuture::from(Promise::race(&Array::of2(&settled, &patience))).await;
}
