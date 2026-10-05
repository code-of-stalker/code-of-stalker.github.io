import type { AudioHistoryItem } from './network-types';

export type VoiceHistoryItem = AudioHistoryItem & { direction: 'incoming' | 'outgoing' };

// Times mean when this client confirmed/stored the record, not read receipts.
export function voiceHistory(incoming: readonly AudioHistoryItem[], outgoing: readonly AudioHistoryItem[]): VoiceHistoryItem[] {
  return [
    ...incoming.map(item => ({ ...item, direction: 'incoming' as const })),
    ...outgoing.map(item => ({ ...item, direction: 'outgoing' as const })),
  ].sort((a, b) => b.receivedAt - a.receivedAt || a.eventId.localeCompare(b.eventId));
}
