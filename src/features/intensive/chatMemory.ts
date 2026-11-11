/**
 * Per-device chat state that is not a secret: the last message id read in each chat.
 * Drafts and decrypted previews stay in memory only and leave it when the session locks.
 */
const SEEN_KEY = 'intensive.seen.v1';

/** `editedAt` tells a stored preview from the text after an edit. */
type Preview = { messageId: number; editedAt: string | null; senderId: string; senderRole: string; text: string | null; report?: boolean };

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

export const previewFor = (chatId: string, messageId: number, editedAt: string | null = null) => {
  const preview = previews.get(chatId);
  const same = (a: string | null, b: string | null) => a === b || (!!a && !!b && Date.parse(a) === Date.parse(b));
  return preview?.messageId === messageId && same(preview.editedAt, editedAt) ? preview : undefined;
};
export const keepPreview = (chatId: string, preview: Preview) => { previews.set(chatId, preview); };

const FOLD_KEY = 'intensive.reportFolded.v1';

/** Whether the walker folded the daily report plate on this device (the diary keeps its own). */
export function reportFolded() {
  try { return globalThis.localStorage?.getItem(FOLD_KEY) === '1'; } catch { return false; }
}

export function keepReportFolded(folded: boolean) {
  try { globalThis.localStorage?.setItem(FOLD_KEY, folded ? '1' : '0'); } catch { /* Storage may be blocked; the plate then opens unfolded. */ }
}

/** Drops plaintext held for the open session. */
export function clearChatMemory() {
  drafts.clear();
  previews.clear();
}
