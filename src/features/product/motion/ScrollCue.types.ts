export type ScrollCueState = { visible: boolean; progress: number; label: string };

// The cue is 15px tall, 6px from the bottom. Keep the step selector above it
// even on compact screens; changing cue visibility must never shift content.
export const scrollCueFooterInset = 32;
