import { silentBands, type VoiceSpectrum } from './spectrum';

export type VoiceSignal = {
  read(): VoiceSpectrum;
  subscribe(listener: () => void): () => void;
};
/** Live visual samples are not application state: route them straight to the
 * graphics adapter. The recorder still owns capture and publishes its lifecycle. */
export function createVoiceSignal(): VoiceSignal & { publish(sample: VoiceSpectrum): void } {
  let sample = silentBands;
  const listeners = new Set<() => void>();
  return {
    read: () => sample,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    publish(next) { sample = next; for (const listener of listeners) listener(); },
  };
}
