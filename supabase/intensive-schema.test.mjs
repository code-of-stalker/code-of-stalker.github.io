// Runs supabase/intensive-schema.sql on an in-process Postgres (PGlite) with a
// minimal stand-in for Supabase's auth schema and roles, then checks who may
// read and write what. Run: node --test supabase/intensive-schema.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { before, describe, it } from 'node:test';

const schema = await readFile(new URL('./intensive-schema.sql', import.meta.url), 'utf8');

// Supabase provides these; the stand-in keeps the same names and semantics.
const supabaseStandIn = `
  create role anon nologin;
  create role authenticated nologin;
  create schema extensions;
  create schema auth;
  create table auth.users (id uuid primary key);
  create type auth.factor_status as enum ('unverified', 'verified');
  create table auth.mfa_factors (id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade, status auth.factor_status not null);
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
  create publication supabase_realtime;
`;

let db;
const people = {};
const b64 = bytes => Buffer.from(bytes).toString('base64');
const key = () => b64(randomBytes(65));

/** Runs `work` as a signed-in person (or anon when `who` is null) in one transaction. */
async function as(who, aal, work) {
  return db.transaction(async tx => {
    if (who) {
      await tx.query(`set local role authenticated`);
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: who, role: 'authenticated', aal })]);
    } else {
      await tx.query(`set local role anon`);
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'anon' })]);
    }
    return work(tx);
  });
}
const rows = async (who, aal, sql, params = []) => as(who, aal, tx => tx.query(sql, params)).then(r => r.rows);
const fails = async (promise, pattern) => assert.rejects(promise, pattern);

// The test door: a code made by the project owner in the SQL editor, typed loosely.
const DOOR = 'TESTDOOR2345', typedDoor = ' testdoor-2345 ';
/** An account that signed up but has no profile yet. */
async function account() {
  const id = randomUUID();
  await db.query('insert into auth.users (id) values ($1)', [id]);
  return id;
}
const createProfile = (id, invite, name) => rows(id, 'aal1', 'select public.create_profile($1, $2, $3, $4, $5)',
  [invite, name, key(), b64(randomBytes(12)), b64(randomBytes(140))]);
async function signUp(name) {
  const id = await account();
  await createProfile(id, typedDoor, name);
  people[name] = id;
  return id;
}
const sendAs = (who, aal, chat) => rows(who, aal,
  'insert into public.messages (chat_id, iv, body) values ($1, $2, $3) returning sender_id, sender_role',
  [chat, b64(randomBytes(12)), b64(randomBytes(40))]);

before(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(supabaseStandIn);
  await db.exec(schema);
  await db.exec(schema); // A second run must succeed: Art may paste an updated file.
  await db.query("insert into public.invite_codes (code, max_uses, expires_at) values ($1, 100, now() + interval '1 day')", [DOOR]);
  for (const name of ['yana', 'guide', 'admin', 'walker', 'stranger', 'guide2']) await signUp(name);
  await db.query('insert into public.main_admins (user_id) values ($1)', [people.yana]);
});

describe('accounts', () => {
  it('nobody writes a profile or a key row directly', async () => {
    const id = await account();
    await fails(rows(id, 'aal1', 'insert into public.profiles (id, name, public_key) values ($1, $2, $3)', [id, 'fake', key()]), /permission denied/);
    await fails(rows(id, 'aal1', 'insert into public.identity_keys (user_id, iv, wrapped_private_key) values ($1, $2, $3)',
      [id, b64(randomBytes(12)), b64(randomBytes(140))]), /permission denied/);
  });
  it('a walker sees only their own profile before assignment', async () => {
    const seen = await rows(people.walker, 'aal1', 'select id from public.profiles');
    assert.deepEqual(seen.map(r => r.id), [people.walker]);
  });
  it('the private key wrap is visible to its owner only', async () => {
    assert.equal((await rows(people.stranger, 'aal1', 'select * from public.identity_keys')).length, 1);
    assert.equal((await rows(people.walker, 'aal1', 'select * from public.identity_keys where user_id = $1', [people.yana])).length, 0);
  });
  it('a person renames themself but cannot swap their public key', async () => {
    await rows(people.stranger, 'aal1', "update public.profiles set name = 'Странник' where id = $1", [people.stranger]);
    await fails(rows(people.stranger, 'aal1', 'update public.profiles set public_key = $2 where id = $1', [people.stranger, key()]), /permission denied/);
  });
  it('nobody grants themself a role or the main admin seat', async () => {
    await fails(rows(people.stranger, 'aal2', "insert into public.staff_roles (user_id, role) values ($1, 'guide')", [people.stranger]), /permission denied/);
    await fails(rows(people.stranger, 'aal2', 'insert into public.main_admins (user_id) values ($1)', [people.stranger]), /permission denied/);
    await fails(rows(people.stranger, 'aal2', 'insert into public.chats (walker_id, guide_id) values ($1, $1)', [people.stranger]), /permission denied/);
  });
  it('admin functions refuse everyone but the main admin', async () => {
    await fails(rows(people.stranger, 'aal2', 'select * from public.admin_directory()'), /main admin only/);
    await fails(rows(people.stranger, 'aal2', "select public.admin_set_role($1, 'guide', true)", [people.stranger]), /main admin only/);
    await fails(rows(people.stranger, 'aal2', 'select public.admin_assign_guide($1, $2)', [people.walker, people.stranger]), /main admin only/);
  });
  it('anon reaches only the device unlock, the invite check and the ping', async () => {
    await fails(rows(null, null, 'select public.my_status()'), /permission denied/);
    await fails(rows(null, null, 'select * from public.profiles'), /permission denied/);
    await fails(rows(null, null, "select public.create_profile('x', 'x', 'x', 'x', 'x')"), /permission denied/);
    await fails(rows(null, null, 'select * from public.admin_invites()'), /permission denied/);
    assert.equal((await rows(null, null, 'select public.ping() as one'))[0].one, 1);
  });
});

describe('main admin and TOTP', () => {
  it('the main admin needs a TOTP session for data and admin functions', async () => {
    const [{ my_status: status }] = await rows(people.yana, 'aal1', 'select public.my_status()');
    assert.equal(status.main_admin, true);
    assert.equal(status.needs_totp, true);
    assert.equal((await rows(people.yana, 'aal1', 'select * from public.profiles')).length, 0);
    await fails(rows(people.yana, 'aal1', 'select * from public.admin_directory()'), /totp session required/);
    assert.equal((await rows(people.yana, 'aal2', 'select * from public.admin_directory()')).length, 6);
  });
  it('the main admin appoints guides and admins and links them', async () => {
    await rows(people.yana, 'aal2', "select public.admin_set_role($1, 'guide', true)", [people.guide]);
    await rows(people.yana, 'aal2', "select public.admin_set_role($1, 'guide', true)", [people.guide2]);
    await rows(people.yana, 'aal2', "select public.admin_set_role($1, 'admin', true)", [people.admin]);
    await rows(people.yana, 'aal2', 'select public.admin_assign_admin($1, $2)', [people.guide, people.admin]);
    await fails(rows(people.yana, 'aal2', 'select public.admin_assign_admin($1, $2)', [people.guide, people.stranger]), /not an admin/);
    await fails(rows(people.yana, 'aal2', 'select public.admin_assign_guide($1, $2)', [people.walker, people.stranger]), /not a guide/);
    const [{ admin_assign_guide: chat }] = await rows(people.yana, 'aal2', 'select public.admin_assign_guide($1, $2)', [people.walker, people.guide]);
    people.chat = chat;
    assert.ok(chat);
  });
  it('a guide sees nothing until the TOTP step', async () => {
    assert.equal((await rows(people.guide, 'aal1', 'select * from public.chats')).length, 0);
    assert.deepEqual(await rows(people.guide, 'aal1', 'select * from public.my_chats()'), []);
    await fails(rows(people.guide, 'aal1', 'select * from public.chat_members($1)', [people.chat]), /not a member/);
    assert.equal((await rows(people.guide, 'aal2', 'select * from public.chats')).length, 1);
  });
  it('a walker who enabled TOTP is held to it as well', async () => {
    await db.query("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [people.stranger]);
    assert.equal((await rows(people.stranger, 'aal1', 'select * from public.profiles')).length, 0);
    assert.equal((await rows(people.stranger, 'aal2', 'select * from public.profiles')).length, 1);
    await db.query('delete from auth.mfa_factors where user_id = $1', [people.stranger]);
  });
});

describe('chat', () => {
  it('lists the walker, the guide, the admin and the main admin as members', async () => {
    const members = await rows(people.walker, 'aal1', 'select user_id, place from public.chat_members($1) order by place', [people.chat]);
    assert.deepEqual(members.map(m => [m.place, m.user_id]).sort(), [
      ['admin', people.admin], ['guide', people.guide], ['main', people.yana], ['walker', people.walker],
    ].sort());
  });
  it('stamps each message with the sender and their place', async () => {
    assert.deepEqual(await sendAs(people.walker, 'aal1', people.chat), [{ sender_id: people.walker, sender_role: 'walker' }]);
    assert.deepEqual(await sendAs(people.guide, 'aal2', people.chat), [{ sender_id: people.guide, sender_role: 'guide' }]);
    assert.deepEqual(await sendAs(people.admin, 'aal2', people.chat), [{ sender_id: people.admin, sender_role: 'admin' }]);
    assert.deepEqual(await sendAs(people.yana, 'aal2', people.chat), [{ sender_id: people.yana, sender_role: 'main' }]);
  });
  it('a sender cannot pose as someone else', async () => {
    await fails(rows(people.walker, 'aal1', 'insert into public.messages (chat_id, sender_id, iv, body) values ($1, $2, $3, $4)',
      [people.chat, people.guide, b64(randomBytes(12)), b64(randomBytes(40))]), /permission denied/);
  });
  it('strangers neither read nor write the chat', async () => {
    assert.equal((await rows(people.stranger, 'aal1', 'select * from public.messages')).length, 0);
    await fails(sendAs(people.stranger, 'aal1', people.chat), /row-level security/);
    await fails(rows(people.stranger, 'aal1', 'select * from public.chat_members($1)', [people.chat]), /not a member/);
  });
  it('members share the chat key only with members', async () => {
    const insert = (who, member) => rows(who, 'aal2', 'insert into public.chat_keys (chat_id, member_id, ephemeral_key, iv, wrapped_key) values ($1, $2, $3, $4, $5)',
      [people.chat, member, key(), b64(randomBytes(12)), b64(randomBytes(48))]);
    await insert(people.yana, people.walker);
    await fails(insert(people.yana, people.stranger), /row-level security/);
    await fails(insert(people.stranger, people.stranger), /row-level security/);
    assert.equal((await rows(people.stranger, 'aal1', 'select * from public.chat_keys')).length, 0);
  });
  it('a walker sees the names of their chat members only', async () => {
    const seen = await rows(people.walker, 'aal1', 'select id from public.profiles');
    assert.deepEqual(seen.map(r => r.id).sort(), [people.walker, people.guide, people.admin, people.yana].sort());
  });
  it('a new guide takes over with the history; the old guide loses access', async () => {
    await rows(people.yana, 'aal2', 'select public.admin_assign_guide($1, $2)', [people.walker, people.guide2]);
    assert.equal((await rows(people.guide, 'aal2', 'select * from public.messages')).length, 0);
    assert.equal((await rows(people.admin, 'aal2', 'select * from public.messages')).length, 0);
    assert.equal((await rows(people.guide2, 'aal2', 'select * from public.messages')).length, 4);
    const [chat] = await rows(people.guide2, 'aal2', 'select * from public.my_chats()');
    assert.equal(chat.my_role, 'guide');
    assert.equal(chat.walker_name, 'walker');
  });
  it('taking the guide role away clears the guide from chats', async () => {
    await rows(people.yana, 'aal2', "select public.admin_set_role($1, 'guide', false)", [people.guide2]);
    assert.equal((await rows(people.guide2, 'aal2', 'select * from public.messages')).length, 0);
    const [entry] = (await rows(people.yana, 'aal2', 'select * from public.admin_directory()')).filter(r => r.user_id === people.walker);
    assert.equal(entry.guide_id, null);
  });
});

describe('blocking and waiting', () => {
  const entryOf = async id => (await rows(people.yana, 'aal2', 'select * from public.admin_directory()')).find(r => r.user_id === id);
  it('the directory shows since when a walker waits for an answer', async () => {
    assert.equal((await entryOf(people.walker)).waiting_since, null);
    await sendAs(people.walker, 'aal1', people.chat);
    await sendAs(people.walker, 'aal1', people.chat);
    const waiting = await entryOf(people.walker);
    assert.ok(waiting.waiting_since instanceof Date);
    assert.ok(waiting.last_message_at > waiting.waiting_since);
    await sendAs(people.yana, 'aal2', people.chat);
    const answered = await entryOf(people.walker);
    assert.equal(answered.waiting_since, null);
    assert.ok(answered.last_message_at > waiting.last_message_at);
  });
  it('a blocked walker reads and writes nothing until the main admin reopens them', async () => {
    await rows(people.yana, 'aal2', 'select public.admin_block($1, true)', [people.walker]);
    const [{ my_status: status }] = await rows(people.walker, 'aal1', 'select public.my_status()');
    assert.equal(status.blocked, true);
    assert.equal((await entryOf(people.walker)).blocked, true);
    assert.equal((await rows(people.walker, 'aal1', 'select * from public.messages')).length, 0);
    assert.equal((await rows(people.walker, 'aal1', 'select * from public.profiles')).length, 0);
    assert.equal((await rows(people.walker, 'aal1', 'select * from public.chat_keys')).length, 0);
    assert.deepEqual(await rows(people.walker, 'aal1', 'select * from public.my_chats()'), []);
    await fails(rows(people.walker, 'aal1', 'select * from public.chat_members($1)', [people.chat]), /not a member/);
    await fails(sendAs(people.walker, 'aal1', people.chat), /row-level security/);
    await rows(people.yana, 'aal2', 'select public.admin_block($1, false)', [people.walker]);
    assert.ok((await rows(people.walker, 'aal1', 'select * from public.messages')).length > 4);
    assert.equal((await entryOf(people.walker)).blocked, false);
  });
  it('a blocked guide loses their chats while blocked', async () => {
    await rows(people.yana, 'aal2', 'select public.admin_assign_guide($1, $2)', [people.walker, people.guide]);
    await rows(people.yana, 'aal2', 'select public.admin_block($1, true)', [people.guide]);
    assert.equal((await rows(people.guide, 'aal2', 'select * from public.messages')).length, 0);
    assert.deepEqual(await rows(people.guide, 'aal2', 'select * from public.my_chats()'), []);
    await rows(people.yana, 'aal2', 'select public.admin_block($1, false)', [people.guide]);
    assert.equal((await rows(people.guide, 'aal2', 'select * from public.my_chats()')).length, 1);
  });
  it('only the main admin blocks, with a TOTP session, and never a main admin', async () => {
    await fails(rows(people.stranger, 'aal2', 'select public.admin_block($1, true)', [people.walker]), /main admin only/);
    await fails(rows(people.yana, 'aal1', 'select public.admin_block($1, true)', [people.walker]), /totp session required/);
    await fails(rows(people.yana, 'aal2', 'select public.admin_block($1, true)', [people.yana]), /cannot be blocked/);
    await fails(rows(people.walker, 'aal1', 'select * from public.blocked_accounts'), /permission denied/);
    await fails(rows(people.walker, 'aal1', 'insert into public.blocked_accounts (user_id) values ($1)', [people.stranger]), /permission denied/);
  });
});

describe('editing, deleting and voice', () => {
  const sealed = () => [b64(randomBytes(12)), b64(randomBytes(40))];
  const post = async (who, aal) => (await rows(who, aal, 'insert into public.messages (chat_id, iv, body) values ($1, $2, $3) returning id',
    [people.chat, ...sealed()]))[0].id;
  const edit = (who, aal, id) => rows(who, aal, 'select * from public.edit_message($1, 1, $2, $3)', [id, ...sealed()]);
  const remove = (who, aal, id) => rows(who, aal, 'select * from public.delete_message($1)', [id]);
  const voice = (who, aal) => rows(who, aal, 'select * from public.send_voice($1, 1, $2, $3, $4, $5)',
    [people.chat, ...sealed(), b64(randomBytes(12)), b64(randomBytes(3000))]);
  const entryOf = async id => (await rows(people.yana, 'aal2', 'select * from public.admin_directory()')).find(r => r.user_id === id);

  it('the sender edits their own text, and the edit is marked', async () => {
    const id = await post(people.walker, 'aal1');
    const [changed] = await edit(people.walker, 'aal1', id);
    assert.ok(changed.edited_at instanceof Date);
    assert.equal(changed.sender_id, people.walker);
    const [chat] = await rows(people.walker, 'aal1', 'select * from public.my_chats()');
    assert.equal(Number(chat.last_message_id), Number(id));
    assert.ok(chat.last_edited_at instanceof Date);
  });
  it('nobody changes another person\'s message, not even the main admin', async () => {
    const id = await post(people.walker, 'aal1');
    await fails(edit(people.guide, 'aal2', id), /not your message/);
    await fails(edit(people.yana, 'aal2', id), /not your message/);
    await fails(remove(people.yana, 'aal2', id), /not your message/);
    await fails(rows(people.walker, 'aal1', 'update public.messages set body = $2 where id = $1', [id, b64(randomBytes(40))]), /permission denied/);
    await fails(rows(people.walker, 'aal1', 'delete from public.messages where id = $1', [id]), /permission denied/);
  });
  it('a guide edits only with a TOTP session, a blocked sender not at all', async () => {
    const own = await post(people.guide, 'aal2');
    await fails(edit(people.guide, 'aal1', own), /not a member/);
    const id = await post(people.walker, 'aal1');
    await rows(people.yana, 'aal2', 'select public.admin_block($1, true)', [people.walker]);
    await fails(edit(people.walker, 'aal1', id), /not a member/);
    await fails(remove(people.walker, 'aal1', id), /not a member/);
    await rows(people.yana, 'aal2', 'select public.admin_block($1, false)', [people.walker]);
  });
  it('deleting wipes the content and keeps a marked row', async () => {
    const before = await post(people.walker, 'aal1');
    const id = await post(people.walker, 'aal1');
    const [gone] = await remove(people.walker, 'aal1', id);
    assert.ok(gone.deleted_at instanceof Date);
    assert.equal(gone.iv, null);
    assert.equal(gone.body, null);
    await fails(edit(people.walker, 'aal1', id), /not your message/);
    await fails(remove(people.walker, 'aal1', id), /not your message/);
    const [chat] = await rows(people.walker, 'aal1', 'select * from public.my_chats()');
    assert.equal(Number(chat.last_message_id), Number(before));
  });
  it('a deleted answer no longer counts as an answer', async () => {
    await post(people.walker, 'aal1');
    const answer = await post(people.guide, 'aal2');
    assert.equal((await entryOf(people.walker)).waiting_since, null);
    await remove(people.guide, 'aal2', answer);
    assert.ok((await entryOf(people.walker)).waiting_since instanceof Date);
    await post(people.guide, 'aal2');
  });
  it('a voice message carries its audio, readable by members only', async () => {
    const [made] = await voice(people.walker, 'aal1');
    assert.equal(made.kind, 'voice');
    assert.equal(made.sender_id, people.walker);
    assert.equal(made.sender_role, 'walker');
    assert.equal((await rows(people.guide, 'aal2', 'select * from public.message_media where message_id = $1', [made.id])).length, 1);
    assert.equal((await rows(people.guide, 'aal1', 'select * from public.message_media')).length, 0);
    assert.equal((await rows(people.stranger, 'aal1', 'select * from public.message_media')).length, 0);
    await fails(voice(people.stranger, 'aal1'), /not a member/);
    await fails(edit(people.walker, 'aal1', made.id), /only text/);
    await fails(rows(people.walker, 'aal1', "insert into public.messages (chat_id, kind, iv, body) values ($1, 'voice', $2, $3)", [people.chat, ...sealed()]), /permission denied/);
    await fails(rows(people.walker, 'aal1', 'insert into public.message_media (message_id, chat_id, iv, body) values ($1, $2, $3, $4)',
      [made.id, people.chat, ...sealed()]), /permission denied/);
    await remove(people.walker, 'aal1', made.id);
    assert.equal((await db.query('select count(*)::int as n from public.message_media where message_id = $1', [made.id])).rows[0].n, 0);
  });
});

describe('device PIN', () => {
  const verifier = b64(randomBytes(32)), device = randomUUID();
  it('registers a device and returns a pepper once', async () => {
    const [{ register_device: pepper }] = await rows(people.walker, 'aal1', 'select public.register_device($1, $2)', [device, verifier]);
    assert.equal(Buffer.from(pepper, 'base64').length, 32);
    await fails(rows(people.walker, 'aal1', 'select * from public.devices'), /permission denied/);
    await fails(rows(null, null, 'select * from public.devices'), /permission denied/);
  });
  it('a right PIN opens it and resets the count', async () => {
    const wrong = await rows(null, null, 'select public.unlock_device($1, $2) as r', [device, b64(randomBytes(32))]);
    assert.deepEqual(wrong[0].r, { status: 'wrong', left: 4 });
    const right = await rows(null, null, 'select public.unlock_device($1, $2) as r', [device, verifier]);
    assert.equal(right[0].r.status, 'ok');
    const again = await rows(null, null, 'select public.unlock_device($1, $2) as r', [device, 'not base64!']);
    assert.deepEqual(again[0].r, { status: 'wrong', left: 4 });
  });
  it('five wrong PINs in a row delete the device', async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await rows(null, null, 'select public.unlock_device($1, $2) as r', [device, b64(randomBytes(32))]))[0].r);
    assert.deepEqual(results, [{ status: 'wrong', left: 3 }, { status: 'wrong', left: 2 }, { status: 'wrong', left: 1 }, { status: 'wiped' }]);
    const after = await rows(null, null, 'select public.unlock_device($1, $2) as r', [device, verifier]);
    assert.deepEqual(after[0].r, { status: 'missing' });
  });
  it('a device is forgotten only by its owner', async () => {
    const other = randomUUID();
    await rows(people.walker, 'aal1', 'select public.register_device($1, $2)', [other, verifier]);
    await rows(people.stranger, 'aal1', 'select public.forget_device($1)', [other]);
    assert.equal((await rows(null, null, 'select public.unlock_device($1, $2) as r', [other, verifier]))[0].r.status, 'ok');
    await rows(people.walker, 'aal1', 'select public.forget_device($1)', [other]);
    assert.equal((await rows(null, null, 'select public.unlock_device($1, $2) as r', [other, verifier]))[0].r.status, 'missing');
  });
});

describe('invite codes', () => {
  const check = invite => rows(null, null, 'select public.check_invite($1) as r', [invite]).then(r => r[0].r);
  const make = (code, extra = {}) => db.query(`insert into public.invite_codes (code, max_uses, used, expires_at, revoked_at)
    values ($1, $2, $3, now() + $4::interval, $5) returning id`, [code, extra.max ?? 3, extra.used ?? 0, extra.valid ?? '1 day', extra.revoked ?? null]).then(r => r.rows[0].id);

  it('anon learns before sign-up whether a code opens, typed in any case and with hyphens', async () => {
    assert.equal(await check(typedDoor), 'ok');
    assert.equal(await check('TEST-DOOR-2345'), 'ok');
    assert.equal(await check('TESTDOOR2346'), 'wrong');
    assert.equal(await check(''), 'wrong');
    await make('EXPIREDCODE22', { valid: '-1 minute' });
    await make('USEDUPCODE223', { max: 2, used: 2 });
    await make('REVOKEDCODE22', { revoked: new Date() });
    assert.equal(await check('expiredcode22'), 'expired');
    assert.equal(await check('usedupcode223'), 'used up');
    assert.equal(await check('revokedcode22'), 'revoked');
  });
  it('a profile needs a valid code, and each use counts', async () => {
    await make('ONEUSECODE234', { max: 1 });
    for (const [code, problem] of [['NOSUCHCODE234', /invite wrong/], ['EXPIREDCODE22', /invite expired/],
      ['USEDUPCODE223', /invite used up/], ['REVOKEDCODE22', /invite revoked/]]) {
      const id = await account();
      await fails(createProfile(id, code, 'Гость'), problem);
      assert.equal((await db.query('select count(*)::int as n from public.profiles where id = $1', [id])).rows[0].n, 0);
    }
    const first = await account(), second = await account();
    await createProfile(first, 'one-use-code-234', '  Первый  ');
    assert.equal((await db.query('select name from public.profiles where id = $1', [first])).rows[0].name, 'Первый');
    assert.equal((await rows(first, 'aal1', 'select * from public.identity_keys')).length, 1);
    await fails(createProfile(second, 'ONEUSECODE234', 'Второй'), /invite used up/);
    await fails(createProfile(first, typedDoor, 'Снова'), /profile exists/);
  });
  it('an account without a profile reads nothing and seals no device', async () => {
    const id = await account();
    assert.equal((await rows(id, 'aal1', 'select * from public.profiles')).length, 0);
    assert.deepEqual(await rows(id, 'aal1', 'select * from public.my_chats()'), []);
    await fails(rows(id, 'aal1', 'select public.register_device($1, $2)', [randomUUID(), b64(randomBytes(32))]), /create a profile first/);
  });
  it('the codes table is closed to everyone, the main admin included', async () => {
    await fails(rows(people.walker, 'aal1', 'select * from public.invite_codes'), /permission denied/);
    await fails(rows(people.yana, 'aal2', 'select * from public.invite_codes'), /permission denied/);
    await fails(rows(null, null, 'select * from public.invite_codes'), /permission denied/);
    await fails(rows(people.walker, 'aal1', 'update public.invite_codes set used = 0'), /permission denied/);
  });
  it('only the main admin, with a TOTP session, makes, lists and revokes codes', async () => {
    await fails(rows(people.stranger, 'aal2', 'select public.admin_create_invite()'), /main admin only/);
    await fails(rows(people.yana, 'aal1', 'select public.admin_create_invite()'), /totp session required/);
    await fails(rows(people.guide, 'aal2', 'select * from public.admin_invites()'), /main admin only/);
    const [{ admin_create_invite: code }] = await rows(people.yana, 'aal2', 'select public.admin_create_invite()');
    assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}$/);
    const listed = (await rows(people.yana, 'aal2', 'select * from public.admin_invites()')).find(r => r.code === code.replaceAll('-', ''));
    assert.equal(listed.max_uses, 3);
    assert.equal(listed.used, 0);
    const days = (listed.expires_at - listed.created_at) / 864e5;
    assert.ok(days > 29.9 && days < 30.1, `valid ${days} days`);
    assert.equal(await check(code.toLowerCase()), 'ok');
    await fails(rows(people.stranger, 'aal2', 'select public.admin_revoke_invite($1)', [listed.id]), /main admin only/);
    await rows(people.yana, 'aal2', 'select public.admin_revoke_invite($1)', [listed.id]);
    assert.equal(await check(code), 'revoked');
    const [{ admin_create_invite: five }] = await rows(people.yana, 'aal2', 'select public.admin_create_invite(5, 7)');
    assert.equal((await rows(people.yana, 'aal2', 'select * from public.admin_invites()')).find(r => r.code === five.replaceAll('-', '')).max_uses, 5);
    await fails(rows(people.yana, 'aal2', 'select public.admin_create_invite(0, 30)'), /uses out of range/);
    await fails(rows(people.yana, 'aal2', 'select public.admin_create_invite(3, 0)'), /days out of range/);
  });
});

describe('staff names', () => {
  it('a staff member keeps and respells their own name', async () => {
    await rows(people.yana, 'aal2', "update public.profiles set name = 'Яна Орлова' where id = $1", [people.yana]);
    await rows(people.yana, 'aal2', "update public.profiles set name = 'Яна  Орлова' where id = $1", [people.yana]);
  });
  it('nobody else takes it, whatever the case, spaces, punctuation or Latin look-alikes', async () => {
    // 'ЯHA OPЛOBA' and 'Яна Opлoвa' carry Latin H, A, O, P, B, o, a.
    for (const name of ['яна орлова', 'ЯНА ОРЛОВА.', 'Яна-Орлова', 'ЯHA OPЛOBA', 'Яна Opлoвa', 'Яна Орлoва']) {
      await fails(createProfile(await account(), typedDoor, name), /name taken by staff/, name);
    }
    await fails(rows(people.walker, 'aal1', "update public.profiles set name = 'GUIDE' where id = $1", [people.walker]), /name taken by staff/);
    await fails(rows(people.walker, 'aal1', "update public.profiles set name = ' Admin ' where id = $1", [people.walker]), /name taken by staff/);
  });
  it('other names, and a walker\'s name, stay free', async () => {
    await createProfile(await account(), typedDoor, 'Яна Смирнова');
    await createProfile(await account(), typedDoor, 'walker');
    await rows(people.walker, 'aal1', "update public.profiles set name = 'Путник' where id = $1", [people.walker]);
  });
});

describe('limits', () => {
  // Small numbers for a test; running the file again brings the real ones back.
  const setLimits = (...numbers) => db.exec(`create or replace function private.limits()
    returns table (messages_per_minute int, texts_per_day int, voice_mb_per_day int, database_mb int, voice_stop_percent int)
    language sql stable set search_path = '' as $$ select ${numbers.map(Number).join(', ')}; $$;`);
  const sealed = () => [b64(randomBytes(12)), b64(randomBytes(40))];
  const voice = (who, aal, chat, bytes = 3000) => rows(who, aal, 'select * from public.send_voice($1, 1, $2, $3, $4, $5)',
    [chat, ...sealed(), b64(randomBytes(12)), b64(randomBytes(bytes))]);
  let walker, chat;
  before(async () => {
    walker = await signUp('limits walker');
    [{ c: chat }] = await rows(people.yana, 'aal2', 'select public.admin_assign_guide($1, $2) as c', [walker, people.guide]);
  });

  it('the real limits: 30 a minute, 300 texts and 20 MB of voice a day, voice stops at 450 of 500 MB', async () => {
    assert.deepEqual((await db.query('select * from private.limits()')).rows,
      [{ messages_per_minute: 30, texts_per_day: 300, voice_mb_per_day: 20, database_mb: 500, voice_stop_percent: 90 }]);
  });
  it('thirty messages a minute from one person in one chat, deleted ones included; others go on', async () => {
    const first = await rows(walker, 'aal1', 'insert into public.messages (chat_id, iv, body) values ($1, $2, $3) returning id', [chat, ...sealed()]);
    await rows(walker, 'aal1', 'select public.delete_message($1)', [first[0].id]);
    for (let i = 1; i < 30; i++) await sendAs(walker, 'aal1', chat);
    await fails(sendAs(walker, 'aal1', chat), /rate limit: 30 messages a minute/);
    await fails(voice(walker, 'aal1', chat), /rate limit: 30 messages a minute/);
    await sendAs(people.guide, 'aal2', chat);
    await sendAs(people.walker, 'aal1', people.chat);
  });
  it('a day holds only so many texts; voice is counted apart', async () => {
    await setLimits(1000, 35, 20, 500, 90);
    for (let i = 30; i < 35; i++) await sendAs(walker, 'aal1', chat);
    await fails(sendAs(walker, 'aal1', chat), /rate limit: 35 text messages a day/);
    await voice(walker, 'aal1', chat);
    await sendAs(people.guide, 'aal2', chat);
  });
  it('a day holds only so much voice for one person in a chat', async () => {
    await setLimits(1000, 1000, 1, 500, 90);
    await voice(walker, 'aal1', chat, 600000);
    await fails(voice(walker, 'aal1', chat, 600000), /rate limit: 1 MB of voice a day/);
    await sendAs(walker, 'aal1', chat);
    await voice(people.guide, 'aal2', chat, 600000);
  });
  it('a nearly full database takes no new voice, while text goes on', async () => {
    await setLimits(1000, 1000, 20, 1, 90);
    await fails(voice(people.guide, 'aal2', chat), /storage full/);
    await sendAs(people.guide, 'aal2', chat);
    const [gauge] = await rows(people.yana, 'aal2', 'select * from public.admin_storage()');
    assert.ok(Number(gauge.used_bytes) > 900000);
    assert.equal(Number(gauge.total_bytes), 1000000);
    assert.equal(Number(gauge.voice_stop_bytes), 900000);
  });
  it('only the main admin, with a TOTP session, sees the database size', async () => {
    await fails(rows(people.guide, 'aal2', 'select * from public.admin_storage()'), /main admin only/);
    await fails(rows(people.yana, 'aal1', 'select * from public.admin_storage()'), /totp session/);
    await fails(rows(people.guide, 'aal2', 'select * from private.storage()'), /permission denied/);
    await fails(rows(null, null, 'select * from public.admin_storage()'), /permission denied/);
  });
  it('running the file again brings the real limits back and keeps every message', async () => {
    const count = async () => (await db.query('select count(*)::int as n from public.messages')).rows[0].n;
    const before = await count();
    await db.exec(schema);
    assert.equal(await count(), before);
    const [gauge] = await rows(people.yana, 'aal2', 'select * from public.admin_storage()');
    assert.equal(Number(gauge.total_bytes), 500000000);
    assert.equal(Number(gauge.voice_stop_bytes), 450000000);
    await voice(people.guide, 'aal2', chat);
  });
});
