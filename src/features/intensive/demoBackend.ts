/**
 * Development-only stand-in for the Supabase project: an in-memory server with
 * the same rules as supabase/intensive-schema.sql and a few seeded people, so
 * the screens can be tried before the real project exists. Never used on the site.
 */
import { BackendError } from './backend';
import type { AuthStore, Backend, BackendFactory, DirectoryEntry, KeyRow, Member, MessageRow, Place, StaffRole, UnlockResult } from './backend';
import * as c from './crypto';
import type { Bytes } from './crypto';
import { newPhrase } from './phrase';

type User = {
  id: string; email: string; password: string; createdAt: string;
  name?: string; publicKey?: string; identity?: { iv: string; data: string };
  roles: Set<StaffRole>; main: boolean; totp?: { id: string; verified: boolean };
};
type Chat = { id: string; walkerId: string; guideId: string | null; createdAt: string };
type Device = { id: string; userId: string; verifier: string; pepper: string; failures: number };
export type DemoPersona = { name: string; label: string; entropy: Bytes };

const wait = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));
const denied = (message = 'permission denied') => new BackendError('denied', message);
const SESSION = 'demo-session';

class DemoServer {
  users = new Map<string, User>();
  chats = new Map<string, Chat>();
  guideAdmins = new Map<string, string>();
  blocked = new Set<string>();
  keys: KeyRow[] = [];
  messages: MessageRow[] = [];
  devices = new Map<string, Device>();
  listeners = new Map<string, Set<(row: MessageRow) => void>>();
  personas: DemoPersona[] = [];
  privateKeys = new Map<string, CryptoKey>();
  private nextMessage = 1;
  ready: Promise<void>;

  constructor() { this.ready = this.seed(); }

  chatRole(chatId: string, uid: string | null): Place | null {
    const chat = this.chats.get(chatId);
    if (!chat || !uid) return null;
    if (chat.walkerId === uid) return 'walker';
    if (chat.guideId === uid) return 'guide';
    if (chat.guideId && this.guideAdmins.get(chat.guideId) === uid) return 'admin';
    if (this.users.get(uid)?.main) return 'main';
    return null;
  }
  isStaff(uid: string) { const u = this.users.get(uid); return !!u && (u.main || u.roles.size > 0); }
  mfaOk(uid: string, aal: string) { const u = this.users.get(uid); return aal === 'aal2' || !(this.isStaff(uid) || u?.totp?.verified); }
  /** The two restrictive policies of the schema: the TOTP step and blocking. */
  allowed(uid: string, aal: string) { return this.mfaOk(uid, aal) && !this.blocked.has(uid); }

  /** The walker's first message after the team's last answer. */
  waitingSince(chatId: string): string | null {
    const rows = this.messages.filter(m => m.chatId === chatId);
    const answered = rows.findLastIndex(m => m.senderRole !== 'walker');
    return rows.slice(answered + 1).find(m => m.senderRole === 'walker')?.createdAt ?? null;
  }

  members(chatId: string): Member[] {
    return [...this.users.values()]
      .filter(u => u.publicKey && this.chatRole(chatId, u.id))
      .map(u => ({ userId: u.id, name: u.name!, place: this.chatRole(chatId, u.id)!, publicKey: u.publicKey! }));
  }

  insertMessage(chatId: string, senderId: string, keyVersion: number, iv: string, body: string): MessageRow {
    const row: MessageRow = { id: this.nextMessage++, chatId, senderId, senderRole: this.chatRole(chatId, senderId) ?? 'walker', keyVersion, iv, body, createdAt: new Date().toISOString() };
    this.messages.push(row);
    for (const listener of this.listeners.get(chatId) ?? []) setTimeout(() => listener(row), 30);
    return row;
  }

  private async addPerson(name: string, label: string, roles: StaffRole[], main: boolean, minutesAgo: number) {
    const { entropy } = newPhrase();
    const { email, password } = await c.accountCredentials(entropy);
    const identity = await c.createIdentity(entropy);
    const id = globalThis.crypto.randomUUID();
    this.users.set(id, {
      id, email, password, name, publicKey: identity.publicKey, identity: identity.wrapped,
      roles: new Set(roles), main, createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
      totp: roles.length || main ? { id: globalThis.crypto.randomUUID(), verified: true } : undefined,
    });
    this.privateKeys.set(id, identity.privateKey);
    this.personas.push({ name, label, entropy });
    return id;
  }

  /** Sends as a seeded person, encrypting with the chat key they hold. */
  async sendAs(chatId: string, senderId: string, text: string, minutesAgo = 0) {
    const row = this.keys.find(k => k.chatId === chatId && k.memberId === senderId);
    if (!row) return;
    const raw = await c.unwrapChatKey(row, this.privateKeys.get(senderId)!, { chatId, version: row.version, memberId: senderId });
    const sealed = await c.encryptMessage(await c.chatCipher(raw), chatId, text);
    const message = this.insertMessage(chatId, senderId, row.version, sealed.iv, sealed.body);
    if (minutesAgo) message.createdAt = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  }

  async shareKey(chatId: string, raw: Bytes) {
    for (const member of this.members(chatId)) {
      if (this.keys.some(k => k.chatId === chatId && k.memberId === member.userId)) continue;
      this.keys.push({ chatId, version: 1, memberId: member.userId, ...await c.wrapChatKey(raw, member.publicKey, { chatId, version: 1, memberId: member.userId }) });
    }
  }

  private async seed() {
    const yana = await this.addPerson('Яна', 'ГЛАВНЫЙ АДМИН, ПРОВОДНИК', ['guide', 'admin'], true, 9000);
    const mira = await this.addPerson('Мира', 'ПРОВОДНИК', ['guide'], false, 8000);
    const oleg = await this.addPerson('Олег', 'АДМИН ПРОВОДНИКА', ['admin'], false, 7000);
    const alex = await this.addPerson('Алекс', 'ИДУЩИЙ С ПРОВОДНИКОМ', [], false, 3000);
    const dina = await this.addPerson('Дина', 'ИДУЩАЯ С ПРОВОДНИКОМ', [], false, 2500);
    await this.addPerson('Ника', 'ИДУЩИЙ, ЖДЁТ НАЗНАЧЕНИЯ', [], false, 40);
    const timur = await this.addPerson('Тимур', 'ИДУЩИЙ, ДОСТУП ЗАКРЫТ', [], false, 5000);
    void yana;
    this.guideAdmins.set(mira, oleg);
    this.blocked.add(timur);
    const chat = async (walkerId: string, minutesAgo: number) => {
      const id = globalThis.crypto.randomUUID();
      this.chats.set(id, { id, walkerId, guideId: mira, createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString() });
      await this.shareKey(id, c.newChatKey());
      return id;
    };
    const alexChat = await chat(alex, 2900);
    await this.sendAs(alexChat, alex, 'Добрый вечер. День третий: пока шёл до работы, замечал звуки. Насчитал девять разных.', 190);
    await this.sendAs(alexChat, mira, 'Хорошо. Завтра не считай, а отмечай, откуда пришёл каждый звук.', 150);
    await this.sendAs(alexChat, oleg, 'Присоединяюсь. Алекс, запиши это в дневник после прогулки.', 120);
    await this.sendAs(alexChat, alex, 'Принято.', 95);
    const dinaChat = await chat(dina, 2400);
    await this.sendAs(dinaChat, dina, 'Сегодня смотрела на тени в обед. Они короче, чем я думала.', 600);
    await this.sendAs(dinaChat, mira, 'Отлично. Вечером сравни с тенями на закате.', 540);
  }
}

let server: DemoServer | null = null;
const demoServer = () => (server ??= new DemoServer());

function connect(store: AuthStore): Backend {
  const s = demoServer();
  const session = () => {
    try { return JSON.parse(store.getItem(SESSION) ?? 'null') as { userId: string; aal: 'aal1' | 'aal2' } | null; }
    catch { return null; }
  };
  const me = () => {
    const current = session();
    if (!current || !s.users.has(current.userId)) throw denied('sign in first');
    return { ...current, user: s.users.get(current.userId)! };
  };
  const member = (chatId: string) => {
    const { userId, aal } = me();
    const place = s.chatRole(chatId, userId);
    if (!place || !s.allowed(userId, aal)) throw denied('not a member of this chat');
    return userId;
  };
  const mainAdmin = () => {
    const { user, aal } = me();
    if (!user.main) throw denied('main admin only');
    if (aal !== 'aal2') throw denied('totp session required');
    return user;
  };
  return {
    async signUp(email, password) {
      await s.ready; await wait();
      if ([...s.users.values()].some(u => u.email === email)) throw new BackendError('invalid', 'User already registered');
      const id = globalThis.crypto.randomUUID();
      s.users.set(id, { id, email, password, roles: new Set(), main: false, createdAt: new Date().toISOString() });
      store.setItem(SESSION, JSON.stringify({ userId: id, aal: 'aal1' }));
    },
    async signIn(email, password) {
      await s.ready; await wait();
      const user = [...s.users.values()].find(u => u.email === email && u.password === password);
      if (!user) return 'not-found';
      store.setItem(SESSION, JSON.stringify({ userId: user.id, aal: 'aal1' }));
      return 'ok';
    },
    async resume() { await s.ready; const current = session(); return !!current && s.users.has(current.userId); },
    async signOut() { store.removeItem(SESSION); },
    close() { /* Nothing runs in the background here. */ },
    async status() {
      await wait(60);
      const { user, aal } = me();
      return { id: user.id, name: user.name ?? null, hasProfile: !!user.name, roles: [...user.roles].sort(), mainAdmin: user.main, aal, hasTotp: !!user.totp?.verified, needsTotp: s.isStaff(user.id), blocked: s.blocked.has(user.id) };
    },
    async createProfile(id, name, publicKey, wrapped) {
      await wait();
      const { user } = me();
      if (user.id !== id || user.name) throw denied();
      Object.assign(user, { name, publicKey, identity: wrapped });
    },
    async identity() {
      await wait(60);
      const { user, aal } = me();
      return s.allowed(user.id, aal) ? user.identity ?? null : null;
    },
    async registerDevice(deviceId, verifier) {
      await wait();
      const { user } = me();
      const pepper = c.toBase64(c.randomBytes(32));
      s.devices.set(deviceId, { id: deviceId, userId: user.id, verifier, pepper, failures: 0 });
      return pepper;
    },
    async forgetDevice(deviceId) { const { user } = me(); if (s.devices.get(deviceId)?.userId === user.id) s.devices.delete(deviceId); },
    async enrollTotp() {
      await wait();
      const { user } = me();
      user.totp = { id: globalThis.crypto.randomUUID(), verified: false };
      const cells = Array.from({ length: 21 * 21 }, (_, i) => (i * 7919 + (i >> 3) * 31) % 5 < 2);
      const rects = cells.map((on, i) => on ? `<rect x="${i % 21}" y="${Math.floor(i / 21)}" width="1" height="1"/>` : '').join('');
      const qr = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 25 25"><rect x="-2" y="-2" width="25" height="25" fill="#fff"/><g fill="#000">${rects}</g></svg>`)}`;
      return { factorId: user.totp.id, qr, secret: 'DEMO KEY2 ABCD EFGH IJKL MNOP' };
    },
    async verifyTotp(code, factorId) {
      await wait(200);
      const current = me();
      if (!current.user.totp || (factorId && factorId !== current.user.totp.id)) throw new BackendError('not-found', 'No factor');
      if (!/^\d{6}$/.test(code)) throw new BackendError('invalid', 'Invalid TOTP code entered');
      current.user.totp.verified = true;
      store.setItem(SESSION, JSON.stringify({ userId: current.userId, aal: 'aal2' }));
    },
    async myChats() {
      await wait();
      const { userId, aal } = me();
      if (!s.allowed(userId, aal)) return [];
      return [...s.chats.values()].filter(chat => s.chatRole(chat.id, userId)).map(chat => {
        const last = s.messages.filter(m => m.chatId === chat.id).at(-1);
        const adminId = chat.guideId ? s.guideAdmins.get(chat.guideId) ?? null : null;
        return {
          chatId: chat.id, walkerId: chat.walkerId, walkerName: s.users.get(chat.walkerId)?.name ?? '',
          guideId: chat.guideId, guideName: chat.guideId ? s.users.get(chat.guideId)?.name ?? null : null,
          adminId, adminName: adminId ? s.users.get(adminId)?.name ?? null : null,
          myRole: s.chatRole(chat.id, userId)!, lastMessageId: last?.id ?? null, lastMessageAt: last?.createdAt ?? null,
        };
      }).sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
    },
    async members(chatId) { await wait(60); member(chatId); return s.members(chatId); },
    async keys(chatId) { await wait(60); member(chatId); return s.keys.filter(k => k.chatId === chatId).map(k => ({ ...k })); },
    async addKeys(rows) {
      await wait(60);
      const { userId } = me();
      for (const row of rows) {
        member(row.chatId);
        if (!s.chatRole(row.chatId, row.memberId)) throw denied('new row violates row-level security policy');
        if (s.keys.some(k => k.chatId === row.chatId && k.version === row.version && k.memberId === row.memberId)) throw new BackendError('invalid', 'duplicate key');
      }
      s.keys.push(...rows.map(row => ({ ...row, createdBy: userId })));
    },
    async dropOwnKey(chatId, version) { const { userId } = me(); s.keys = s.keys.filter(k => !(k.chatId === chatId && k.version === version && k.memberId === userId)); },
    async messages(chatId, afterId) { await wait(); member(chatId); return s.messages.filter(m => m.chatId === chatId && (afterId === undefined || m.id > afterId)); },
    async send(chatId, keyVersion, iv, body) {
      await wait();
      const userId = member(chatId);
      const row = s.insertMessage(chatId, userId, keyVersion, iv, body);
      const chat = s.chats.get(chatId)!;
      // A seeded guide answers the walker, so the live update can be seen.
      if (chat.walkerId === userId && chat.guideId && s.privateKeys.has(chat.guideId)) {
        const guide = chat.guideId;
        setTimeout(() => { void s.sendAs(chatId, guide, 'Принято. Наблюдай дальше и пиши, что заметишь.'); }, 1800);
      }
      return row;
    },
    watch(chatId, onRow) {
      const set = s.listeners.get(chatId) ?? new Set();
      s.listeners.set(chatId, set);
      set.add(onRow);
      return () => { set.delete(onRow); };
    },
    async directory() {
      await wait();
      mainAdmin();
      return [...s.users.values()].filter(u => u.name).map((u): DirectoryEntry => {
        const chat = [...s.chats.values()].find(ch => ch.walkerId === u.id);
        return {
          userId: u.id, name: u.name!, createdAt: u.createdAt, roles: [...u.roles].sort(), mainAdmin: u.main,
          chatId: chat?.id ?? null, guideId: chat?.guideId ?? null, adminId: s.guideAdmins.get(u.id) ?? null,
          blocked: s.blocked.has(u.id),
          lastMessageAt: chat ? s.messages.filter(m => m.chatId === chat.id).at(-1)?.createdAt ?? null : null,
          waitingSince: chat ? s.waitingSince(chat.id) : null,
        };
      }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async setRole(userId, role, enabled) {
      await wait();
      mainAdmin();
      const user = s.users.get(userId);
      if (!user) throw new BackendError('invalid', 'no such account');
      if (enabled) { user.roles.add(role); return; }
      user.roles.delete(role);
      if (role === 'guide') {
        for (const chat of s.chats.values()) if (chat.guideId === userId) chat.guideId = null;
        s.guideAdmins.delete(userId);
      } else {
        for (const [guide, admin] of s.guideAdmins) if (admin === userId) s.guideAdmins.delete(guide);
      }
    },
    async assignGuide(walkerId, guideId) {
      await wait();
      mainAdmin();
      if (guideId && (guideId === walkerId || !s.users.get(guideId)?.roles.has('guide'))) throw new BackendError('invalid', 'not a guide');
      let chat = [...s.chats.values()].find(ch => ch.walkerId === walkerId);
      if (!chat) { chat = { id: globalThis.crypto.randomUUID(), walkerId, guideId, createdAt: new Date().toISOString() }; s.chats.set(chat.id, chat); }
      chat.guideId = guideId;
      return chat.id;
    },
    async assignAdmin(guideId, adminId) {
      await wait();
      mainAdmin();
      if (!s.users.get(guideId)?.roles.has('guide')) throw new BackendError('invalid', 'not a guide');
      if (!adminId) { s.guideAdmins.delete(guideId); return; }
      if (adminId === guideId || !s.users.get(adminId)?.roles.has('admin')) throw new BackendError('invalid', 'not an admin');
      s.guideAdmins.set(guideId, adminId);
    },
    async setBlocked(userId, blocked) {
      await wait();
      mainAdmin();
      const user = s.users.get(userId);
      if (!user) throw new BackendError('invalid', 'no such account');
      if (user.main) throw new BackendError('invalid', 'a main admin cannot be blocked');
      if (blocked) s.blocked.add(userId); else s.blocked.delete(userId);
    },
  };
}

export const demoBackend: BackendFactory & { personas(): Promise<DemoPersona[]> } = {
  demo: true,
  async personas() { const s = demoServer(); await s.ready; return s.personas; },
  async unlockDevice(deviceId, verifier): Promise<UnlockResult> {
    const s = demoServer();
    await s.ready; await wait(200);
    const device = s.devices.get(deviceId);
    if (!device) return { status: 'missing' };
    if (device.verifier === verifier) { device.failures = 0; return { status: 'ok', pepper: device.pepper }; }
    device.failures += 1;
    if (device.failures >= 5) { s.devices.delete(deviceId); return { status: 'wiped' }; }
    return { status: 'wrong', left: 5 - device.failures };
  },
  connect,
};
