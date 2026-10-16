import type { GlassPanel } from './glassPanel'
import type { LiquidGlassSettings } from './settings'

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
const approach = (current: number, target: number, dt: number, time: number) =>
  current + (target - current) * (1 - Math.exp(-dt / time))

// Render-loop state stays outside React so touch and light do not trigger UI renders.
export class GlassMotion {
  pointerX = 0.5
  pointerY = 0.5
  pressure = 0
  lightX = -Math.SQRT1_2
  lightY = Math.SQRT1_2
  scanProgress = 1
  reducedMotion = false
  private targetX = 0.5
  private targetY = 0.5
  private pressed = false
  private scrollImpulse = 0
  private scanElapsed = 0
  private scanning = false

  setPointer(x: number, y: number, pressed: boolean) {
    this.targetX = clamp(x, 0, 1)
    this.targetY = clamp(y, 0, 1)
    if (pressed && !this.pressed && this.pressure < 0.01) {
      this.pointerX = this.targetX
      this.pointerY = this.targetY
    }
    this.pressed = pressed
  }

  releasePointer() {
    this.pressed = false
  }

  addScroll(deltaPixels: number) {
    this.scrollImpulse = clamp(this.scrollImpulse + deltaPixels / 260, -1, 1)
  }

  replayReveal(enabled: boolean) {
    this.scanning = enabled && !this.reducedMotion
    this.scanElapsed = 0
    this.scanProgress = this.scanning ? 0 : 1
  }

  finishReveal() {
    this.scanning = false
    this.scanProgress = 1
  }

  settle(settings: LiquidGlassSettings, panel?: GlassPanel) {
    this.releasePointer()
    this.finishReveal()
    this.pointerX = this.targetX = 0.5
    this.pointerY = this.targetY = 0.5
    this.pressure = 0
    this.scrollImpulse = 0
    const angle = this.getLightAngle(settings, panel)
    this.lightX = Math.cos(angle)
    this.lightY = Math.sin(angle)
  }

  private getLightAngle(settings: LiquidGlassSettings, panel?: GlassPanel) {
    const panelShift = ((panel?.x ?? 0.5) - 0.5) * 0.75 + ((panel?.y ?? 0.5) - 0.5) * 0.4
    const pointerShift = (this.pointerX - 0.5) * 0.35 - (this.pointerY - 0.5) * 0.2
    return settings.rimAngle * Math.PI / 180 +
      (this.reducedMotion ? 0 : panelShift + pointerShift + this.scrollImpulse * 0.65)
  }

  step(deltaSeconds: number, settings: LiquidGlassSettings, panel?: GlassPanel) {
    const elapsed = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0
    const dt = Math.min(elapsed, 1)
    this.pointerX = approach(this.pointerX, this.targetX, dt, settings.touchLag)
    this.pointerY = approach(this.pointerY, this.targetY, dt, settings.touchLag)
    const touchActive = this.pressed && settings.touchEnabled && !this.reducedMotion
    this.pressure = approach(this.pressure, touchActive ? 1 : 0, dt, touchActive ? 0.055 : 0.19)
    if (this.reducedMotion || !settings.touchEnabled) this.pressure = 0
    if (this.pressure < 0.0001) this.pressure = 0

    const angle = this.getLightAngle(settings, panel)
    if (this.reducedMotion) {
      this.lightX = Math.cos(angle)
      this.lightY = Math.sin(angle)
    } else {
      this.lightX = approach(this.lightX, Math.cos(angle), dt, 0.18)
      this.lightY = approach(this.lightY, Math.sin(angle), dt, 0.18)
    }
    this.scrollImpulse *= Math.exp(-dt / 0.42)

    if (!settings.scanEnabled || this.reducedMotion) this.finishReveal()
    if (this.scanning) {
      this.scanElapsed += elapsed
      this.scanProgress = clamp(this.scanElapsed / Math.max(settings.scanDuration, 0.001), 0, 1)
      if (this.scanProgress === 1) this.scanning = false
    }
  }
}
