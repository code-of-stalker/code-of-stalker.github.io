import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BackendError } from './backend';
import type { AuthStore, Backend, BackendFactory, ChatSummary, DirectoryEntry, Invite, InviteState, KeyRow, Member, MessageRow, Place, StaffRole, Status, Storage, UnlockResult } from './backend';

type Config = { url: string; publishableKey: string };
type Raw = Record<string, unknown>;

function fail(error: { message?: string; code?: string; status?: number } | null | undefined): never {
  const message = error?.message ?? 'unknown error';
  if (/fetch|network|Failed to fetch|timeout/i.test(message)) throw new BackendError('network', message);
  if (error?.status === 429 || /rate limit/i.test(message)) throw new BackendError('rate-limit', message);
  if (/storage full/i.test(message)) throw new BackendError('storage-full', message);
  const invite = /invite (wrong|expired|used up|revoked)/i.exec(message)?.[1]?.toLowerCase() as Exclude<InviteState, 'ok'> | undefined;
  if (invite) throw new BackendError('invite', message, invite);
  if (/name taken by staff/i.test(message)) throw new BackendError('name-taken', message);
  if (error?.code === '42501' || /permission|row-level security|not a member|main admin only|totp session/i.test(message)) throw new BackendError('denied', message);
  if (error?.code === '22023' || error?.code === '23505' || /invalid/i.test(message)) throw new BackendError('invalid', message);
  throw new BackendError('unknown', message);
}

const optional = (value: unknown) => value == null ? null : String(value);
const message = (row: Raw): MessageRow => ({
  id: Number(row.id), chatId: String(row.chat_id), senderId: String(row.sender_id), senderRole: row.sender_role as Place,
  kind: row.kind === 'voice' ? 'voice' : 'text',
  keyVersion: Number(row.key_version), iv: optional(row.iv), body: optional(row.body), createdAt: String(row.created_at),
  editedAt: optional(row.edited_at), deletedAt: optional(row.deleted_at),
});

function connect(config: Config, store: AuthStore): Backend {
  const client: SupabaseClient = createClient(config.url, config.publishableKey, {
    auth: { storage: store, storageKey: 'intensive-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  const rpc = async <T>(name: string, args?: Raw): Promise<T> => {
    const { data, error } = await client.rpc(name, args);
    if (error) fail(error);
    return data as T;
  };
  async function syncRealtime() {
    const { data } = await client.auth.getSession();
    // supabase-js passes refreshed and signed-in tokens to Realtime, but not the
    // aal2 token from a TOTP check, so hand it over explicitly.
    if (data.session) await client.realtime.setAuth(data.session.access_token);
  }
  return {
    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) fail(error);
      if (!data.session) throw new BackendError('invalid', 'Sign-up returned no session: turn off "Confirm email" in Supabase Auth settings.');
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (!error) return 'ok';
      if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) return 'not-found';
      fail(error);
    },
    async resume() {
      const { data } = await client.auth.getSession();
      if (!data.session) return false;
      const { error } = await client.auth.getUser();
      return !error;
    },
    async signOut() { await client.auth.signOut({ scope: 'local' }); },
    close() {
      // A locked session must not keep rotating refresh tokens it can no longer save.
      void client.auth.stopAutoRefresh();
      void client.removeAllChannels();
    },
    async status() {
      const raw = await rpc<Raw>('my_status');
      return {
        id: String(raw.id), name: optional(raw.name), hasProfile: !!raw.has_profile,
        roles: (raw.roles as StaffRole[]) ?? [], mainAdmin: !!raw.main_admin,
        aal: raw.aal === 'aal2' ? 'aal2' : 'aal1', hasTotp: !!raw.has_totp, needsTotp: !!raw.needs_totp,
        blocked: !!raw.blocked,
      } satisfies Status;
    },
    async createProfile(_id, name, publicKey, wrapped, invite) {
      // The server takes the account from the session and checks the code under a lock.
      await rpc('create_profile', { invite, name, public_key: publicKey, key_iv: wrapped.iv, wrapped_key: wrapped.data });
    },
    async renameProfile(id, name) {
      const { data, error } = await client.from('profiles').update({ name }).eq('id', id).select('id');
      if (error) fail(error);
      // Row security turns a forbidden update into one that changes nothing.
      if (!data?.length) throw new BackendError('denied', 'The name was not changed');
    },
    async identity() {
      const { data, error } = await client.from('identity_keys').select('iv, wrapped_private_key').maybeSingle();
      if (error) fail(error);
      return data ? { iv: String(data.iv), data: String(data.wrapped_private_key) } : null;
    },
    registerDevice: (deviceId, verifier) => rpc<string>('register_device', { device: deviceId, verifier }),
    async forgetDevice(deviceId) { await rpc('forget_device', { device: deviceId }); },
    async enrollTotp() {
      // An abandoned enrollment leaves an unverified factor behind; clear it first.
      const listed = await client.auth.mfa.listFactors();
      if (listed.error) fail(listed.error);
      for (const factor of listed.data.all) {
        if (factor.factor_type === 'totp' && factor.status !== 'verified') await client.auth.mfa.unenroll({ factorId: factor.id });
      }
      const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', issuer: 'Code Of Stalker', friendlyName: 'Интенсив' });
      if (error) fail(error);
      // GoTrue returns a data URI with raw SVG markup; '#' and '<' inside it break
      // an <img> source, so the markup is re-encoded.
      const svg = data.totp.qr_code;
      const markup = svg.startsWith('data:') ? svg.slice(svg.indexOf(',') + 1) : svg;
      const qr = markup.trimStart().startsWith('<') ? `data:image/svg+xml;utf8,${encodeURIComponent(markup)}` : svg;
      return { factorId: data.id, qr, secret: data.totp.secret };
    },
    async verifyTotp(code, factorId) {
      let id = factorId;
      if (!id) {
        const listed = await client.auth.mfa.listFactors();
        if (listed.error) fail(listed.error);
        id = listed.data.totp[0]?.id;
        if (!id) throw new BackendError('not-found', 'No verified TOTP factor');
      }
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId: id, code });
      if (error) {
        if (/invalid|expired|code/i.test(error.message) && error.status !== 429) throw new BackendError('invalid', error.message);
        fail(error);
      }
      await syncRealtime();
    },
    async myChats() {
      const rows = await rpc<Raw[]>('my_chats');
      return rows.map((row): ChatSummary => ({
        chatId: String(row.chat_id), walkerId: String(row.walker_id), walkerName: String(row.walker_name),
        guideId: optional(row.guide_id), guideName: optional(row.guide_name),
        adminId: optional(row.admin_id), adminName: optional(row.admin_name),
        myRole: row.my_role as Place, lastMessageId: row.last_message_id == null ? null : Number(row.last_message_id),
        lastMessageAt: optional(row.last_message_at), lastEditedAt: optional(row.last_edited_at),
      }));
    },
    async members(chatId) {
      const rows = await rpc<Raw[]>('chat_members', { chat: chatId });
      return rows.map((row): Member => ({ userId: String(row.user_id), name: String(row.name), place: row.place as Place, publicKey: String(row.public_key) }));
    },
    async keys(chatId) {
      const { data, error } = await client.from('chat_keys').select('*').eq('chat_id', chatId);
      if (error) fail(error);
      return data.map((row: Raw): KeyRow => ({
        chatId: String(row.chat_id), version: Number(row.version), memberId: String(row.member_id),
        ephemeralKey: String(row.ephemeral_key), iv: String(row.iv), wrappedKey: String(row.wrapped_key), createdBy: String(row.created_by),
      }));
    },
    async addKeys(rows) {
      const { error } = await client.from('chat_keys').insert(rows.map(row => ({
        chat_id: row.chatId, version: row.version, member_id: row.memberId,
        ephemeral_key: row.ephemeralKey, iv: row.iv, wrapped_key: row.wrappedKey,
      })));
      if (error) fail(error);
    },
    async dropOwnKey(chatId, version) {
      const { data } = await client.auth.getSession();
      const { error } = await client.from('chat_keys').delete().eq('chat_id', chatId).eq('version', version).eq('member_id', data.session?.user.id ?? '');
      if (error) fail(error);
    },
    async messages(chatId, afterId) {
      let query = client.from('messages').select('*').eq('chat_id', chatId).is('deleted_at', null).order('id', { ascending: true }).limit(1000);
      if (afterId !== undefined) query = query.gt('id', afterId);
      const { data, error } = await query;
      if (error) fail(error);
      return data.map(message);
    },
    async changes(chatId, since) {
      const { data, error } = await client.from('messages').select('*').eq('chat_id', chatId)
        .or(`edited_at.gt."${since}",deleted_at.gt."${since}"`).order('id', { ascending: true }).limit(1000);
      if (error) fail(error);
      return data.map(message);
    },
    async send(chatId, keyVersion, iv, body) {
      const { data, error } = await client.from('messages').insert({ chat_id: chatId, key_version: keyVersion, iv, body }).select('*').single();
      if (error) fail(error);
      return message(data);
    },
    async sendVoice(chatId, keyVersion, iv, body, audioIv, audioBody) {
      return message(await rpc<Raw>('send_voice', { chat: chatId, version: keyVersion, sealed_iv: iv, sealed_body: body, audio_iv: audioIv, audio_body: audioBody }));
    },
    async media(messageId) {
      const { data, error } = await client.from('message_media').select('iv, body').eq('message_id', messageId).maybeSingle();
      if (error) fail(error);
      return data ? { iv: String(data.iv), body: String(data.body) } : null;
    },
    async edit(messageId, keyVersion, iv, body) {
      return message(await rpc<Raw>('edit_message', { message: messageId, version: keyVersion, sealed_iv: iv, sealed_body: body }));
    },
    async remove(messageId) {
      return message(await rpc<Raw>('delete_message', { message: messageId }));
    },
    watch(chatId, onRow, onDown) {
      const channel = client.channel(`intensive-chat-${chatId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
          payload => onRow(message(payload.new as Raw)))
        // Edits and deletes arrive as updates; nothing is ever deleted outright.
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
          payload => onRow(message(payload.new as Raw)))
        .subscribe(state => { if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') onDown(); });
      return () => { void client.removeChannel(channel); };
    },
    async directory() {
      const rows = await rpc<Raw[]>('admin_directory');
      return rows.map((row): DirectoryEntry => ({
        userId: String(row.user_id), name: String(row.name), createdAt: String(row.created_at),
        roles: (row.roles as StaffRole[]) ?? [], mainAdmin: !!row.main_admin,
        chatId: optional(row.chat_id), guideId: optional(row.guide_id), adminId: optional(row.admin_id),
        blocked: !!row.blocked, lastMessageAt: optional(row.last_message_at), waitingSince: optional(row.waiting_since),
      }));
    },
    async setRole(userId, role, enabled) { await rpc('admin_set_role', { target: userId, kind: role, enabled }); },
    assignGuide: (walkerId, guideId) => rpc<string>('admin_assign_guide', { walker: walkerId, guide: guideId }),
    async assignAdmin(guideId, adminId) { await rpc('admin_assign_admin', { guide: guideId, admin: adminId }); },
    async setBlocked(userId, blocked) { await rpc('admin_block', { target: userId, blocked }); },
    async invites() {
      const rows = await rpc<Raw[]>('admin_invites');
      return rows.map((row): Invite => ({
        id: String(row.id), code: String(row.code), maxUses: Number(row.max_uses), used: Number(row.used),
        expiresAt: String(row.expires_at), revokedAt: optional(row.revoked_at), createdAt: String(row.created_at),
      }));
    },
    createInvite: (uses, days) => rpc<string>('admin_create_invite', { uses, days }),
    async revokeInvite(id) { await rpc('admin_revoke_invite', { invite: id }); },
    async storage(): Promise<Storage> {
      const [row] = await rpc<Raw[]>('admin_storage');
      return { usedBytes: Number(row.used_bytes), totalBytes: Number(row.total_bytes), voiceStopBytes: Number(row.voice_stop_bytes) };
    },
  };
}

export function supabaseBackend(config: Config): BackendFactory {
  // Device unlocking happens before any session exists; this client never stores one.
  let anon: SupabaseClient | null = null;
  const anonClient = () => anon ??= createClient(config.url, config.publishableKey, {
    auth: { storageKey: 'intensive-anon', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    demo: false,
    async unlockDevice(deviceId, verifier) {
      const { data, error } = await anonClient().rpc('unlock_device', { device: deviceId, verifier });
      if (error) fail(error);
      return data as UnlockResult;
    },
    async checkInvite(code) {
      const { data, error } = await anonClient().rpc('check_invite', { invite: code });
      if (error) fail(error);
      return data as InviteState;
    },
    connect: store => connect(config, store),
  };
}
