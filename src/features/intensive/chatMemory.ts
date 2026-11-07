/**
 * Per-device chat state that is not a secret: the last message id read in each chat.
 * Drafts and decrypted previews stay in memory only and leave it when the session locks.
 */
const SEEN_KEY = 'intensive.seen.v1';

type Preview = { messageId: number; senderId: string; senderRole: string; text: string | null };

const drafts = new Map<string, string>();
const previews = new Map<string, Preview>();

function readAll(): Record<string, number> {
  try {
    const raw = globalThis.localStorage?.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as Record<string, number> : {};
  } catch { return {}; }
}

export function seenId(chatId: string): number | undefined {
  const value = readAll()[chatId];
  return typeof value === 'number' ? value : undefined;
}

export function markSeen(chatId: string, messageId: number) {
  const all = readAll();
  if ((all[chatId] ?? 0) >= messageId) return;
  all[chatId] = messageId;
  try { globalThis.localStorage?.setItem(SEEN_KEY, JSON.stringify(all)); } catch { /* Storage may be blocked; unread marks then reset. */ }
}

export function forgetSeen() {
  try { globalThis.localStorage?.removeItem(SEEN_KEY); } catch { /* Nothing stored then. */ }
}

export const draftFor = (chatId: string) => drafts.get(chatId) ?? '';
export function keepDraft(chatId: string, text: string) {
  if (text) drafts.set(chatId, text); else drafts.delete(chatId);
}

export const previewFor = (chatId: string, messageId: number) => {
  const preview = previews.get(chatId);
  return preview?.messageId === messageId ? preview : undefined;
};
export const keepPreview = (chatId: string, preview: Preview) => { previews.set(chatId, preview); };

/** Drops plaintext held for the open session. */
export function clearChatMemory() {
  drafts.clear();
  previews.clear();
}
