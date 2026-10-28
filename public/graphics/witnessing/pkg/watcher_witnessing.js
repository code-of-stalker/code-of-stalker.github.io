/* @ts-self-types="./watcher_witnessing.d.ts" */

export class Witnessing {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WitnessingFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_witnessing_free(ptr, 0);
    }
    /**
     * @param {number} red
     * @param {number} green
     * @param {number} blue
     */
    backdrop(red, green, blue) {
        wasm.witnessing_backdrop(this.__wbg_ptr, red, green, blue);
    }
    dispose() {
        wasm.witnessing_dispose(this.__wbg_ptr);
    }
    /**
     * @returns {number}
     */
    elapsed() {
        const ret = wasm.witnessing_elapsed(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} milliseconds
     */
    frame(milliseconds) {
        wasm.witnessing_frame(this.__wbg_ptr, milliseconds);
    }
    /**
     * @returns {number}
     */
    frame_count() {
        const ret = wasm.witnessing_frame_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    gpu_error() {
        const ret = wasm.witnessing_gpu_error(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {HTMLImageElement} dark_hand
     * @param {HTMLImageElement} dark_world
     * @param {HTMLImageElement} light_hand
     * @param {HTMLImageElement} light_world
     */
    constructor(canvas, dark_hand, dark_world, light_hand, light_world) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.witnessing_new(retptr, addHeapObject(canvas), addHeapObject(dark_hand), addHeapObject(dark_world), addHeapObject(light_hand), addHeapObject(light_world));
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            this.__wbg_ptr = r0;
            WitnessingFinalization.register(this, this.__wbg_ptr, this);
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} code
     */
    palette(code) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.witnessing_palette(retptr, this.__wbg_ptr, code);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {boolean} value
     */
    pause(value) {
        wasm.witnessing_pause(this.__wbg_ptr, value);
    }
    /**
     * @param {boolean} value
     */
    reduced(value) {
        wasm.witnessing_reduced(this.__wbg_ptr, value);
    }
    /**
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
        wasm.witnessing_resize(this.__wbg_ptr, width, height);
    }
    /**
     * @param {number} seconds
     */
    seek(seconds) {
        wasm.witnessing_seek(this.__wbg_ptr, seconds);
    }
    /**
     * @param {boolean} value
     */
    soft_edges(value) {
        wasm.witnessing_soft_edges(this.__wbg_ptr, value);
    }
    suspend() {
        wasm.witnessing_suspend(this.__wbg_ptr);
    }
}
if (Symbol.dispose) Witnessing.prototype[Symbol.dispose] = Witnessing.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_boolean_get_5b446f51afd21013: function(arg0) {
            const v = getObject(arg0);
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_string_get_0380ccaa2f57f0d9: function(arg0, arg1) {
            const obj = getObject(arg1);
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_41e9ee4f547fc59a: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_activeTexture_11079673eac5c921: function(arg0, arg1) {
            getObject(arg0).activeTexture(arg1 >>> 0);
        },
        __wbg_attachShader_9567ae57af6746d5: function(arg0, arg1, arg2) {
            getObject(arg0).attachShader(getObject(arg1), getObject(arg2));
        },
        __wbg_bindTexture_3cf008f256f3ed99: function(arg0, arg1, arg2) {
            getObject(arg0).bindTexture(arg1 >>> 0, getObject(arg2));
        },
        __wbg_bindVertexArray_f58af0a346185ec5: function(arg0, arg1) {
            getObject(arg0).bindVertexArray(getObject(arg1));
        },
        __wbg_compileShader_c2b53ff3a8851f60: function(arg0, arg1) {
            getObject(arg0).compileShader(getObject(arg1));
        },
        __wbg_createProgram_cbf448e6f18a9402: function(arg0) {
            const ret = getObject(arg0).createProgram();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createShader_6c1a2295587878a5: function(arg0, arg1) {
            const ret = getObject(arg0).createShader(arg1 >>> 0);
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createTexture_5f2583508ebe379b: function(arg0) {
            const ret = getObject(arg0).createTexture();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createVertexArray_b223ea69dd08fcab: function(arg0) {
            const ret = getObject(arg0).createVertexArray();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_deleteProgram_b524b30ad176cdb4: function(arg0, arg1) {
            getObject(arg0).deleteProgram(getObject(arg1));
        },
        __wbg_deleteShader_a70f6cc1918d67eb: function(arg0, arg1) {
            getObject(arg0).deleteShader(getObject(arg1));
        },
        __wbg_deleteTexture_9f42750adb092e4f: function(arg0, arg1) {
            getObject(arg0).deleteTexture(getObject(arg1));
        },
        __wbg_deleteVertexArray_ca9768805d051d49: function(arg0, arg1) {
            getObject(arg0).deleteVertexArray(getObject(arg1));
        },
        __wbg_disable_19fe787eccdf0272: function(arg0, arg1) {
            getObject(arg0).disable(arg1 >>> 0);
        },
        __wbg_drawArrays_08872e02fb57b847: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).drawArrays(arg1 >>> 0, arg2, arg3);
        },
        __wbg_generateMipmap_cd49f6eec9558721: function(arg0, arg1) {
            getObject(arg0).generateMipmap(arg1 >>> 0);
        },
        __wbg_getContext_051324720aa5b7e8: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = getObject(arg0).getContext(getStringFromWasm0(arg1, arg2), getObject(arg3));
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        }, arguments); },
        __wbg_getError_dd9903fdd93a6802: function(arg0) {
            const ret = getObject(arg0).getError();
            return ret;
        },
        __wbg_getProgramInfoLog_3276b294d6d42fe2: function(arg0, arg1, arg2) {
            const ret = getObject(arg1).getProgramInfoLog(getObject(arg2));
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_getProgramParameter_fc7124bb9fb7c675: function(arg0, arg1, arg2) {
            const ret = getObject(arg0).getProgramParameter(getObject(arg1), arg2 >>> 0);
            return addHeapObject(ret);
        },
        __wbg_getShaderInfoLog_7e0cbba353ca95da: function(arg0, arg1, arg2) {
            const ret = getObject(arg1).getShaderInfoLog(getObject(arg2));
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_getShaderParameter_745acf10b8e45e31: function(arg0, arg1, arg2) {
            const ret = getObject(arg0).getShaderParameter(getObject(arg1), arg2 >>> 0);
            return addHeapObject(ret);
        },
        __wbg_getUniformLocation_50ba45dade572703: function(arg0, arg1, arg2, arg3) {
            const ret = getObject(arg0).getUniformLocation(getObject(arg1), getStringFromWasm0(arg2, arg3));
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_height_fc97e1a0c2e7331f: function(arg0) {
            const ret = getObject(arg0).height;
            return ret;
        },
        __wbg_instanceof_WebGl2RenderingContext_64c994c14c0790fb: function(arg0) {
            let result;
            try {
                result = getObject(arg0) instanceof WebGL2RenderingContext;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_isContextLost_fbbab8b921e614b7: function(arg0) {
            const ret = getObject(arg0).isContextLost();
            return ret;
        },
        __wbg_linkProgram_acdc299c43d734a0: function(arg0, arg1) {
            getObject(arg0).linkProgram(getObject(arg1));
        },
        __wbg_naturalHeight_df41ba6a4a6b0d33: function(arg0) {
            const ret = getObject(arg0).naturalHeight;
            return ret;
        },
        __wbg_naturalWidth_c4c567dc88a9ee9a: function(arg0) {
            const ret = getObject(arg0).naturalWidth;
            return ret;
        },
        __wbg_new_617a8cdb8bb1130e: function() {
            const ret = new Object();
            return addHeapObject(ret);
        },
        __wbg_pixelStorei_cb4e43466f5b8703: function(arg0, arg1, arg2) {
            getObject(arg0).pixelStorei(arg1 >>> 0, arg2);
        },
        __wbg_set_145a351398b48c65: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(getObject(arg0), getObject(arg1), getObject(arg2));
            return ret;
        }, arguments); },
        __wbg_set_height_c9789c1c77eaedff: function(arg0, arg1) {
            getObject(arg0).height = arg1 >>> 0;
        },
        __wbg_set_width_b0e1267db4b196b5: function(arg0, arg1) {
            getObject(arg0).width = arg1 >>> 0;
        },
        __wbg_shaderSource_c8812639b47d87b9: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).shaderSource(getObject(arg1), getStringFromWasm0(arg2, arg3));
        },
        __wbg_texImage2D_1dfb26facf36a854: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            getObject(arg0).texImage2D(arg1 >>> 0, arg2, arg3, arg4 >>> 0, arg5 >>> 0, getObject(arg6));
        }, arguments); },
        __wbg_texParameteri_7864076abcdb03e0: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).texParameteri(arg1 >>> 0, arg2 >>> 0, arg3);
        },
        __wbg_uniform1f_b5856e35a43b65a1: function(arg0, arg1, arg2) {
            getObject(arg0).uniform1f(getObject(arg1), arg2);
        },
        __wbg_uniform1i_531b98c4a7177366: function(arg0, arg1, arg2) {
            getObject(arg0).uniform1i(getObject(arg1), arg2);
        },
        __wbg_uniform2f_a92b5bb95dc5b4d9: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform2f(getObject(arg1), arg2, arg3);
        },
        __wbg_uniform3f_1211579ff87ccfad: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniform3f(getObject(arg1), arg2, arg3, arg4);
        },
        __wbg_uniform3fv_055ea5ac38af4fce: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform3fv(getObject(arg1), getArrayF32FromWasm0(arg2, arg3));
        },
        __wbg_uniform4f_8dd8f311e656ca0d: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).uniform4f(getObject(arg1), arg2, arg3, arg4, arg5);
        },
        __wbg_useProgram_e075c2902e420761: function(arg0, arg1) {
            getObject(arg0).useProgram(getObject(arg1));
        },
        __wbg_viewport_16936692526e2ce6: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).viewport(arg1, arg2, arg3, arg4);
        },
        __wbg_width_3d0dce3d9892e35e: function(arg0) {
            const ret = getObject(arg0).width;
            return ret;
        },
        __wbindgen_generic_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
        __wbindgen_object_drop_ref: function(arg0) {
            takeObject(arg0);
        },
    };
    return {
        __proto__: null,
        "./watcher_witnessing_bg.js": import0,
    };
}

const WitnessingFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_witnessing_free(ptr, 1));

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function dropObject(idx) {
    if (idx < 1028) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getObject(idx) { return heap[idx]; }

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        wasm.__wbindgen_export3(addHeapObject(e));
    }
}

let heap = new Array(1024).fill(undefined);
heap.push(undefined, null, true, false);

let heap_next = heap.length;

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('watcher_witnessing_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
