export type VoiceSpring = { position: number; velocity: number }
export const createVoiceSpring = (): VoiceSpring => ({ position: 0, velocity: 0 })

/** A damped spring integrated in small steps, independent of display frame rate. */
export function stepVoiceSpring(state: VoiceSpring, target: number, dt: number, inertia: number, damping = 1) {
  const elapsed = Math.max(0, Math.min(.1, dt)), steps = Math.max(1, Math.ceil(elapsed / .0045))
  const h = elapsed / steps, omega = 2 / Math.max(.05, inertia)
  for (let i = 0; i < steps; i++) {
    state.velocity += ((target - state.position) * omega * omega - 2 * damping * omega * state.velocity) * h
    state.position += state.velocity * h
    if (state.position < 0) { state.position = 0; state.velocity = Math.max(0, state.velocity) }
    if (state.position > 1.4) { state.position = 1.4; state.velocity = Math.min(0, state.velocity) }
  }
  if (target === 0 && state.position < .0001 && Math.abs(state.velocity) < .0001) { state.position = 0; state.velocity = 0 }
  return state.position
}
