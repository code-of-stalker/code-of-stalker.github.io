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

async function signUp(name) {
  const id = randomUUID();
  await db.query('insert into auth.users (id) values ($1)', [id]);
  await rows(id, 'aal1', 'insert into public.profiles (id, name, public_key) values ($1, $2, $3)', [id, name, key()]);
  await rows(id, 'aal1', 'insert into public.identity_keys (user_id, iv, wrapped_private_key) values ($1, $2, $3)', [id, b64(randomBytes(12)), b64(randomBytes(140))]);
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
  for (const name of ['yana', 'guide', 'admin', 'walker', 'stranger', 'guide2']) await signUp(name);
  await db.query('insert into public.main_admins (user_id) values ($1)', [people.yana]);
});

describe('accounts', () => {
  it('a person creates only their own profile', async () => {
    const id = randomUUID();
    await db.query('insert into auth.users (id) values ($1)', [id]);
    await fails(rows(people.walker, 'aal1', 'insert into public.profiles (id, name, public_key) values ($1, $2, $3)', [id, 'fake', key()]), /row-level security/);
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
  it('anon reaches only the device unlock and the ping', async () => {
    await fails(rows(null, null, 'select public.my_status()'), /permission denied/);
    await fails(rows(null, null, 'select * from public.profiles'), /permission denied/);
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
