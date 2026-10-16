import * as THREE from 'three'
import { createBackgroundBlurKernel, getBackgroundBlurLayout, maxGaussianRadius } from './backgroundBlur'

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const fragmentShader = `
precision highp float;
uniform sampler2D uInput;
uniform float uFirstPass;
uniform float uDecodeSourceTexture;
uniform float uFrameAspect;
uniform float uSourceAspect;
uniform vec2 uDirection;
uniform int uRadius;
uniform float uWeights[${maxGaussianRadius + 1}];
varying vec2 vUv;

vec3 sampleInput(vec2 uv) {
  if (uFirstPass < 0.5) {
    return texture2D(uInput, clamp(uv, vec2(0.0), vec2(1.0))).rgb;
  }

  vec2 scale = vec2(1.0);
  float sourceAspect = max(uSourceAspect, 0.01);
  if (uFrameAspect > sourceAspect) {
    scale.y = sourceAspect / uFrameAspect;
  } else {
    scale.x = uFrameAspect / sourceAspect;
  }
  vec2 sourceUv = (uv - 0.5) * scale + 0.5;
  vec4 texel = texture2D(uInput, clamp(sourceUv, vec2(0.001), vec2(0.999)));
  return uDecodeSourceTexture > 0.5 ? sRGBTransferEOTF(texel).rgb : texel.rgb;
}

void main() {
  vec3 color = sampleInput(vUv) * uWeights[0];
  for (int i = 1; i <= ${maxGaussianRadius}; i++) {
    if (i > uRadius) break;
    vec2 offset = uDirection * float(i);
    color += (sampleInput(vUv + offset) + sampleInput(vUv - offset)) * uWeights[i];
  }
  // Both intermediate textures remain linear. Only the final glass pass encodes output.
  gl_FragColor = vec4(color, 1.0);
}
`

export class BackgroundBlurPass {
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private readonly geometry = new THREE.PlaneGeometry(2, 2)
  private readonly scene = new THREE.Scene()
  private readonly material: THREE.ShaderMaterial
  private readonly horizontal: THREE.WebGLRenderTarget
  private readonly vertical: THREE.WebGLRenderTarget
  private horizontalKernel = createBackgroundBlurKernel(0)
  private verticalKernel = createBackgroundBlurKernel(0)
  private spacingX = 1
  private spacingY = 1
  private configuration = ''
  private dirty = true
  updates = 0
  get size() { return [this.vertical.width, this.vertical.height] }

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly source: THREE.Texture, decodeSource: boolean) {
    const targetOptions = {
      type: renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType,
      colorSpace: THREE.LinearSRGBColorSpace,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    }
    this.horizontal = new THREE.WebGLRenderTarget(1, 1, targetOptions)
    this.vertical = new THREE.WebGLRenderTarget(1, 1, targetOptions)
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uInput: { value: source },
        uFirstPass: { value: 1 },
        uDecodeSourceTexture: { value: decodeSource ? 1 : 0 },
        uFrameAspect: { value: 1 },
        uSourceAspect: { value: 1 },
        uDirection: { value: new THREE.Vector2() },
        uRadius: { value: 0 },
        uWeights: { value: this.horizontalKernel.weights },
      },
    })
    this.scene.add(new THREE.Mesh(this.geometry, this.material))
  }

  get texture() {
    return this.vertical.texture
  }

  configure(width: number, height: number, pixelRatio: number, sourceAspect: number, blurRadius: number) {
    const configuration = [width, height, pixelRatio, sourceAspect, blurRadius].join(':')
    if (configuration === this.configuration) return

    this.configuration = configuration
    const layout = getBackgroundBlurLayout(width, height, pixelRatio, blurRadius)
    this.horizontal.setSize(layout.width, layout.height)
    this.vertical.setSize(layout.width, layout.height)
    this.spacingX = layout.spacingX
    this.spacingY = layout.spacingY
    this.horizontalKernel = createBackgroundBlurKernel(layout.radiusX / this.spacingX)
    this.verticalKernel = createBackgroundBlurKernel(layout.radiusY / this.spacingY)
    this.material.uniforms.uFrameAspect.value = width / Math.max(height, 1)
    this.material.uniforms.uSourceAspect.value = sourceAspect
    this.invalidate()
  }

  invalidate() {
    this.dirty = true
  }

  render() {
    if (!this.dirty) return

    const previousTarget = this.renderer.getRenderTarget()
    const uniforms = this.material.uniforms
    try {
      uniforms.uInput.value = this.source
      uniforms.uFirstPass.value = 1
      uniforms.uDirection.value.set(this.spacingX / this.horizontal.width, 0)
      uniforms.uRadius.value = this.horizontalKernel.radius
      uniforms.uWeights.value = this.horizontalKernel.weights
      this.renderer.setRenderTarget(this.horizontal)
      this.renderer.render(this.scene, this.camera)

      uniforms.uInput.value = this.horizontal.texture
      uniforms.uFirstPass.value = 0
      uniforms.uDirection.value.set(0, this.spacingY / this.vertical.height)
      uniforms.uRadius.value = this.verticalKernel.radius
      uniforms.uWeights.value = this.verticalKernel.weights
      this.renderer.setRenderTarget(this.vertical)
      this.renderer.render(this.scene, this.camera)
      this.dirty = false
      this.updates += 1
    } finally {
      this.renderer.setRenderTarget(previousTarget)
    }
  }

  dispose() {
    this.horizontal.dispose()
    this.vertical.dispose()
    this.geometry.dispose()
    this.material.dispose()
  }
}
