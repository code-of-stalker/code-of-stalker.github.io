import { BackendError } from './backend';
import type { AuthStore, Backend, BackendFactory, ChatSummary, DirectoryEntry, KeyRow, Member, MessageRow, Place, StaffRole, Status, TotpEnrollment } from './backend';
import * as c from './crypto';
import type { Bytes } from './crypto';

const DEVICE_KEY = 'intensive.device.v1';
type StoredDevice = { v: 1; deviceId: string; salt: string; sealed: c.Sealed };
type DeviceContents = { entropy: string; store: Record<string, string> };

function readDevice(): StoredDevice | null {
  try {
    const raw = globalThis.localStorage?.getItem(DEVICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDevice;
    return parsed?.v === 1 && typeof parsed.deviceId === 'string' && typeof parsed.salt === 'string' && parsed.sealed ? parsed : null;
  } catch { return null; }
}
export const hasDevice = () => readDevice() !== null;
export function wipeDevice() {
  try { globalThis.localStorage?.removeItem(DEVICE_KEY); } catch { /* Storage may be blocked; nothing to wipe then. */ }
}

/** Auth tokens live in memory; every change is resealed into the device vault. */
class MemoryStore implements AuthStore {
  readonly items = new Map<string, string>();
  onChange: (() => void) | null = null;
  getItem(key: string) { return this.items.get(key) ?? null; }
  setItem(key: string, value: string) { this.items.set(key, value); this.onChange?.(); }
  removeItem(key: string) { this.items.delete(key); this.onChange?.(); }
}

export type DecodedMessage = {
  id: number; senderId: string; senderRole: Place; createdAt: string;
  /** null when the message cannot be decrypted on this account. */
  text: string | null;
};

type ChatCipher = { current: number; ciphers: Map<number, CryptoKey>; raw: Bytes };

export const shortCode = (id: string) => id.replace(/-/g, '').slice(0, 8).toUpperCase().replace(/(.{4})/, '$1-');

export class IntensiveSession {
  readonly backend: Backend;
  readonly factory: BackendFactory;
  private entropy: Bytes;
  private readonly store: MemoryStore;
  private device: { id: string; salt: string; key: CryptoKey } | null = null;
  private identityKey: CryptoKey | null = null;
  private saving: Promise<void> = Promise.resolve();
  private readonly chatCiphers = new Map<string, ChatCipher>();
  status: Status | null = null;

  constructor(factory: BackendFactory, entropy: Bytes, store = new MemoryStore()) {
    this.factory = factory;
    this.entropy = entropy;
    this.store = store;
    this.backend = factory.connect(store);
  }

  get id() { return this.status?.id ?? ''; }
  get sealed() { return this.device !== null; }
  secret(): Bytes { return this.entropy; }

  // ---------------------------------------------------------- accounts

  static async create(factory: BackendFactory, entropy: Bytes): Promise<IntensiveSession> {
    const session = new IntensiveSession(factory, entropy);
    const { email, password } = await c.accountCredentials(entropy);
    await session.backend.signUp(email, password);
    await session.refresh();
    return session;
  }

  /** null when no account answers to this phrase. */
  static async restore(factory: BackendFactory, entropy: Bytes): Promise<IntensiveSession | null> {
    const session = new IntensiveSession(factory, entropy);
    const { email, password } = await c.accountCredentials(entropy);
    if (await session.backend.signIn(email, password) === 'not-found') return null;
    await session.refresh();
    return session;
  }

  async createProfile(name: string) {
    const identity = await c.createIdentity(this.entropy);
    await this.backend.createProfile(this.id, name.trim(), identity.publicKey, identity.wrapped);
    this.identityKey = identity.privateKey;
    await this.refresh();
  }

  async refresh(): Promise<Status> {
    this.status = await this.backend.status();
    return this.status;
  }

  // ---------------------------------------------------------- device and PIN

  /** Seals the phrase on this device under a new PIN, replacing any earlier seal. */
  async sealDevice(pin: string) {
    const salt = c.randomBytes(16);
    const secret = await c.pinSecret(pin, salt);
    const deviceId = globalThis.crypto.randomUUID();
    const pepper = c.fromBase64(await this.backend.registerDevice(deviceId, await c.pinVerifier(secret)));
    const previous = this.device;
    this.device = { id: deviceId, salt: c.toBase64(salt), key: await c.vaultKey(secret, pepper) };
    secret.fill(0); pepper.fill(0);
    this.store.onChange = () => { void this.persist(); };
    await this.persist();
    if (previous) await this.backend.forgetDevice(previous.id).catch(() => {});
  }

  private persist(): Promise<void> {
    const device = this.device;
    if (!device) return this.saving;
    this.saving = this.saving.then(async () => {
      const contents: DeviceContents = { entropy: c.toBase64(this.entropy), store: Object.fromEntries(this.store.items) };
      const sealed = await c.seal(device.key, c.encodeText(JSON.stringify(contents)), `device|${device.id}`);
      try {
        globalThis.localStorage.setItem(DEVICE_KEY, JSON.stringify({ v: 1, deviceId: device.id, salt: device.salt, sealed } satisfies StoredDevice));
      } catch { /* Private windows may refuse storage; the session still works until closed. */ }
    }).catch(() => {});
    return this.saving;
  }

  static async unlock(factory: BackendFactory, pin: string): Promise<
    { status: 'ok'; session: IntensiveSession } | { status: 'wrong'; left: number } | { status: 'wiped' }
  > {
    const stored = readDevice();
    if (!stored) return { status: 'wiped' };
    const salt = c.fromBase64(stored.salt);
    const secret = await c.pinSecret(pin, salt);
    const result = await factory.unlockDevice(stored.deviceId, await c.pinVerifier(secret));
    if (result.status === 'wrong') { secret.fill(0); return { status: 'wrong', left: result.left }; }
    if (result.status !== 'ok') { secret.fill(0); wipeDevice(); return { status: 'wiped' }; }
    const key = await c.vaultKey(secret, c.fromBase64(result.pepper));
    secret.fill(0);
    const contents = JSON.parse(c.decodeText(await c.unseal(key, stored.sealed, `device|${stored.deviceId}`))) as DeviceContents;
    const store = new MemoryStore();
    for (const [name, value] of Object.entries(contents.store ?? {})) store.items.set(name, value);
    const session = new IntensiveSession(factory, c.fromBase64(contents.entropy), store);
    session.device = { id: stored.deviceId, salt: stored.salt, key };
    store.onChange = () => { void session.persist(); };
    if (!await session.backend.resume()) {
      const { email, password } = await c.accountCredentials(session.entropy);
      if (await session.backend.signIn(email, password) === 'not-found') { wipeDevice(); return { status: 'wiped' }; }
    }
    await session.persist();
    await session.refresh();
    return { status: 'ok', session };
  }

  /** Removes the account from this device; the 12 words bring it back. */
  async forgetDevice() {
    if (this.device) await this.backend.forgetDevice(this.device.id).catch(() => {});
    await this.backend.signOut().catch(() => {});
    wipeDevice();
    this.lock();
  }

  /** Drops every secret from memory; the device vault stays. */
  lock() {
    this.store.onChange = null;
    this.backend.close();
    this.entropy = new Uint8Array(16);
    this.identityKey = null;
    this.chatCiphers.clear();
    this.device = null;
  }

  // ---------------------------------------------------------- TOTP

  enrollTotp(): Promise<TotpEnrollment> { return this.backend.enrollTotp(); }
  async verifyTotp(code: string, factorId?: string) {
    await this.backend.verifyTotp(code, factorId);
    await this.refresh();
  }

  /** Staff, and walkers who turned it on, must pass the TOTP step first. */
  get needsTotpStep() { return !!this.status && (this.status.needsTotp || this.status.hasTotp) && this.status.aal !== 'aal2'; }

  async openIdentity() {
    if (this.identityKey) return;
    const wrapped = await this.backend.identity();
    if (!wrapped) throw new BackendError('not-found', 'No identity key');
    this.identityKey = await c.openIdentity(this.entropy, wrapped);
  }

  // ---------------------------------------------------------- chats

  myChats(): Promise<ChatSummary[]> { return this.backend.myChats(); }
  members(chatId: string): Promise<Member[]> { return this.backend.members(chatId); }

  /** The chat key for this account, creating the first key or sharing it with members who lack it. */
  async chatCipher(chatId: string): Promise<ChatCipher | null> {
    const cached = this.chatCiphers.get(chatId);
    if (cached) return cached;
    await this.openIdentity();
    const [members, initialKeys] = await Promise.all([this.backend.members(chatId), this.backend.keys(chatId)]);
    let keys = initialKeys;
    if (!keys.length) {
      const raw = c.newChatKey();
      try { await this.backend.addKeys(await this.wrapFor(chatId, 1, raw, members)); }
      catch { /* Another member created the key at the same moment; use theirs. */ }
      keys = await this.backend.keys(chatId);
    }
    const ciphers = new Map<number, CryptoKey>();
    let current = 0, raw: Bytes | null = null;
    for (const row of keys.filter(k => k.memberId === this.id).sort((a, b) => a.version - b.version)) {
      try {
        const opened = await c.unwrapChatKey(row, this.identityKey!, { chatId, version: row.version, memberId: this.id });
        ciphers.set(row.version, await c.chatCipher(opened));
        current = row.version; raw = opened;
      } catch {
        // A wrap that does not open is dropped, so another member can wrap it again.
        await this.backend.dropOwnKey(chatId, row.version).catch(() => {});
      }
    }
    if (!raw) return null;
    const missing = members.filter(m => !keys.some(k => k.memberId === m.userId && k.version === current));
    for (const member of missing) {
      try { await this.backend.addKeys(await this.wrapFor(chatId, current, raw, [member])); }
      catch { /* Someone else shared it first. */ }
    }
    const cipher = { current, ciphers, raw };
    this.chatCiphers.set(chatId, cipher);
    return cipher;
  }

  private async wrapFor(chatId: string, version: number, raw: Bytes, members: Member[]): Promise<KeyRow[]> {
    return Promise.all(members.map(async member => ({
      chatId, version, memberId: member.userId,
      ...await c.wrapChatKey(raw, member.publicKey, { chatId, version, memberId: member.userId }),
    })));
  }

  /** Re-runs key sharing after membership changed. */
  async shareChat(chatId: string) {
    this.chatCiphers.delete(chatId);
    await this.chatCipher(chatId);
  }

  async decode(chatId: string, row: MessageRow): Promise<DecodedMessage> {
    const cipher = this.chatCiphers.get(chatId)?.ciphers.get(row.keyVersion);
    let text: string | null = null;
    if (cipher) try { text = await c.decryptMessage(cipher, chatId, row.iv, row.body); } catch { text = null; }
    return { id: row.id, senderId: row.senderId, senderRole: row.senderRole, createdAt: row.createdAt, text };
  }

  async messages(chatId: string, afterId?: number): Promise<DecodedMessage[]> {
    const rows = await this.backend.messages(chatId, afterId);
    return Promise.all(rows.map(row => this.decode(chatId, row)));
  }

  async send(chatId: string, text: string): Promise<DecodedMessage> {
    const cipher = await this.chatCipher(chatId);
    if (!cipher) throw new BackendError('denied', 'No chat key yet');
    const sealed = await c.encryptMessage(cipher.ciphers.get(cipher.current)!, chatId, text);
    return this.decode(chatId, await this.backend.send(chatId, cipher.current, sealed.iv, sealed.body));
  }

  // ---------------------------------------------------------- main admin

  directory(): Promise<DirectoryEntry[]> { return this.backend.directory(); }
  setRole(userId: string, role: StaffRole, enabled: boolean) { return this.backend.setRole(userId, role, enabled); }

  async assignGuide(walkerId: string, guideId: string | null) {
    const chatId = await this.backend.assignGuide(walkerId, guideId);
    await this.shareChat(chatId);
    return chatId;
  }

  async assignAdmin(guideId: string, adminId: string | null, directory: DirectoryEntry[]) {
    await this.backend.assignAdmin(guideId, adminId);
    for (const entry of directory) if (entry.chatId && entry.guideId === guideId) await this.shareChat(entry.chatId).catch(() => {});
  }
}
