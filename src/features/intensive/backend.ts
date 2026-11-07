/** The server contract of the Intensive chat; see supabase/intensive-schema.sql. */
export type Place = 'walker' | 'guide' | 'admin' | 'main';
export type StaffRole = 'guide' | 'admin';

export type Status = {
  id: string;
  name: string | null;
  hasProfile: boolean;
  roles: StaffRole[];
  mainAdmin: boolean;
  aal: 'aal1' | 'aal2';
  hasTotp: boolean;
  needsTotp: boolean;
  /** Closed by the main admin: the server returns no data until unblocked. */
  blocked: boolean;
};

export type ChatSummary = {
  chatId: string; walkerId: string; walkerName: string;
  guideId: string | null; guideName: string | null;
  adminId: string | null; adminName: string | null;
  myRole: Place; lastMessageId: number | null; lastMessageAt: string | null;
  /** When the last message was edited, so a stored preview knows it is stale. */
  lastEditedAt: string | null;
};

export type Member = { userId: string; name: string; place: Place; publicKey: string };

export type KeyRow = {
  chatId: string; version: number; memberId: string;
  ephemeralKey: string; iv: string; wrappedKey: string; createdBy?: string;
};

export type MessageKind = 'text' | 'voice';

/** A deleted message keeps its row without content (`iv` and `body` are null). */
export type MessageRow = {
  id: number; chatId: string; senderId: string; senderRole: Place; kind: MessageKind;
  keyVersion: number; iv: string | null; body: string | null; createdAt: string;
  editedAt: string | null; deletedAt: string | null;
};

export type DirectoryEntry = {
  userId: string; name: string; createdAt: string; roles: StaffRole[]; mainAdmin: boolean;
  chatId: string | null; guideId: string | null; adminId: string | null;
  blocked: boolean;
  lastMessageAt: string | null;
  /** The walker's first message after the team's last answer; null when nobody waits. */
  waitingSince: string | null;
};

export type UnlockResult =
  | { status: 'ok'; pepper: string }
  | { status: 'wrong'; left: number }
  | { status: 'wiped' }
  | { status: 'missing' };

export type TotpEnrollment = { factorId: string; qr: string; secret: string };

/** Auth session storage: memory only; the device vault seals it under the PIN. */
export type AuthStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export class BackendError extends Error {
  readonly code: 'network' | 'denied' | 'not-found' | 'invalid' | 'rate-limit' | 'unknown';
  constructor(code: BackendError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

/** One signed-in connection; created after the device opens or a phrase is entered. */
export interface Backend {
  signUp(email: string, password: string): Promise<void>;
  /** 'not-found' when no account has these credentials. */
  signIn(email: string, password: string): Promise<'ok' | 'not-found'>;
  /** True when the stored session is still valid. */
  resume(): Promise<boolean>;
  signOut(): Promise<void>;
  /** Stops token refresh and live channels; the connection is not used again. */
  close(): void;
  status(): Promise<Status>;
  createProfile(id: string, name: string, publicKey: string, wrapped: { iv: string; data: string }): Promise<void>;
  identity(): Promise<{ iv: string; data: string } | null>;
  registerDevice(deviceId: string, verifier: string): Promise<string>;
  forgetDevice(deviceId: string): Promise<void>;
  enrollTotp(): Promise<TotpEnrollment>;
  /** Verifies a code for an enrolled factor; the session becomes aal2. */
  verifyTotp(code: string, factorId?: string): Promise<void>;
  myChats(): Promise<ChatSummary[]>;
  members(chatId: string): Promise<Member[]>;
  keys(chatId: string): Promise<KeyRow[]>;
  /** Inserts all rows or none. */
  addKeys(rows: KeyRow[]): Promise<void>;
  dropOwnKey(chatId: string, version: number): Promise<void>;
  /** Messages that are not deleted, oldest first. */
  messages(chatId: string, afterId?: number): Promise<MessageRow[]>;
  /** Rows edited or deleted after `since` (a server time), deleted ones included. */
  changes(chatId: string, since: string): Promise<MessageRow[]>;
  send(chatId: string, keyVersion: number, iv: string, body: string): Promise<MessageRow>;
  /** Sender only; the sealed audio is stored beside the row. */
  sendVoice(chatId: string, keyVersion: number, iv: string, body: string, audioIv: string, audioBody: string): Promise<MessageRow>;
  /** The sealed audio of a voice message. */
  media(messageId: number): Promise<{ iv: string; body: string } | null>;
  /** Sender only, text messages only. */
  edit(messageId: number, keyVersion: number, iv: string, body: string): Promise<MessageRow>;
  /** Sender only; the row stays without content. */
  remove(messageId: number): Promise<MessageRow>;
  /** Calls back on each new, edited or deleted message; returns an unsubscribe. `onDown` reports a lost live link. */
  watch(chatId: string, onRow: (row: MessageRow) => void, onDown: () => void): () => void;
  directory(): Promise<DirectoryEntry[]>;
  setRole(userId: string, role: StaffRole, enabled: boolean): Promise<void>;
  assignGuide(walkerId: string, guideId: string | null): Promise<string>;
  assignAdmin(guideId: string, adminId: string | null): Promise<void>;
  /** Main admin only; a main admin cannot be blocked. */
  setBlocked(userId: string, blocked: boolean): Promise<void>;
}

export interface BackendFactory {
  readonly demo: boolean;
  /** Called without a session: the device has none until the PIN opens it. */
  unlockDevice(deviceId: string, verifier: string): Promise<UnlockResult>;
  connect(store: AuthStore): Backend;
}
