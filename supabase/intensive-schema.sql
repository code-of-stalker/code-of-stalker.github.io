-- Code Of Stalker · Интенсив: the chat of a walker (идущий), their guide (проводник)
-- and that guide's admin (админ проводника), plus the main admin.
--
-- Paste the whole file into Supabase Dashboard → SQL Editor → Run. It can be run
-- again after an update: tables are kept, functions and policies are replaced.
--
-- Security model (the repository is public, so nothing here relies on the client):
-- * Every table has row level security. Direct writes are limited to a person's
--   own profile, own key rows and own messages; roles and assignments change only
--   through the admin_* functions, which check the main admin and a TOTP session.
--   Editing, deleting and voice messages go through edit_message, delete_message
--   and send_voice, which accept only the sender, still a member of the chat.
-- * Messages and chat keys are end-to-end encrypted in the browser; the database
--   holds only ciphertext and public keys.
-- * Guides, admins, the main admin and anyone who enabled TOTP get no data
--   without an aal2 (TOTP-verified) session: a restrictive policy on every table.
-- * The PIN of each device is checked here: five wrong PINs delete the device's
--   pepper, and the device can no longer open its sealed phrase.
-- * A blocked account gets no data at all (a second restrictive policy) until the
--   main admin unblocks it; its history stays.
-- * The main admin is set by the project owner in this SQL editor only:
--     insert into public.main_admins (user_id) values ('<account id from the app>');

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------- tables

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- ECDH P-256 public key, raw point, base64.
  public_key text not null check (char_length(public_key) between 40 and 200),
  created_at timestamptz not null default now()
);

-- The identity private key, encrypted with a key derived from the 12 words.
create table if not exists public.identity_keys (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  iv text not null check (char_length(iv) between 12 and 40),
  wrapped_private_key text not null check (char_length(wrapped_private_key) between 40 and 1000)
);

create table if not exists public.main_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade
);

create table if not exists public.staff_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('guide', 'admin')),
  primary key (user_id, role)
);

-- One admin per guide.
create table if not exists public.guide_admins (
  guide_id uuid primary key references public.profiles (id) on delete cascade,
  admin_id uuid not null references public.profiles (id) on delete cascade,
  check (guide_id <> admin_id)
);

-- One chat per walker; the guide may change and the history stays.
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  walker_id uuid not null unique references public.profiles (id) on delete cascade,
  guide_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (guide_id is null or guide_id <> walker_id)
);

-- The chat key, wrapped for each member with an ephemeral ECDH key.
create table if not exists public.chat_keys (
  chat_id uuid not null references public.chats (id) on delete cascade,
  version int not null default 1 check (version between 1 and 1000),
  member_id uuid not null references public.profiles (id) on delete cascade,
  ephemeral_key text not null check (char_length(ephemeral_key) between 40 and 200),
  iv text not null check (char_length(iv) between 12 and 40),
  wrapped_key text not null check (char_length(wrapped_key) between 40 and 200),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (chat_id, version, member_id)
);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  chat_id uuid not null references public.chats (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Set by a trigger from the sender's place in the chat at the time of sending.
  sender_role text not null default 'walker' check (sender_role in ('walker', 'guide', 'admin', 'main')),
  key_version int not null default 1 check (key_version between 1 and 1000),
  -- A voice message keeps its sealed audio in message_media; only send_voice() makes one.
  kind text not null default 'text',
  iv text check (char_length(iv) between 12 and 40),
  body text check (char_length(body) between 20 and 24000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  -- A deleted message keeps its row without content, so open chats learn of it.
  deleted_at timestamptz
);
-- Upgrades the table of an earlier version of this file.
alter table public.messages add column if not exists kind text not null default 'text';
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists deleted_at timestamptz;
alter table public.messages alter column iv drop not null, alter column body drop not null;
alter table public.messages drop constraint if exists messages_kind_check,
  add constraint messages_kind_check check (kind in ('text', 'voice'));
alter table public.messages drop constraint if exists messages_content_check,
  add constraint messages_content_check check (
    (deleted_at is null and iv is not null and body is not null)
    or (deleted_at is not null and iv is null and body is null));
create index if not exists messages_chat_id_idx on public.messages (chat_id, id);

-- The sealed audio of a voice message, apart from the row, so chat loads and live
-- events stay light. About 1 MB of audio at most (5 minutes of voice).
create table if not exists public.message_media (
  message_id bigint primary key references public.messages (id) on delete cascade,
  chat_id uuid not null references public.chats (id) on delete cascade,
  iv text not null check (char_length(iv) between 12 and 40),
  body text not null check (char_length(body) between 20 and 1500000)
);

-- Devices that sealed the phrase under a PIN. Reached only through the
-- functions below; no policy lets anyone read it.
create table if not exists public.devices (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  verifier bytea not null check (length(verifier) = 32),
  pepper bytea not null check (length(pepper) = 32),
  failures int not null default 0,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index if not exists devices_user_id_idx on public.devices (user_id);

-- Accounts the main admin closed. Reached only through the functions below.
create table if not exists public.blocked_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  blocked_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.identity_keys enable row level security;
alter table public.main_admins enable row level security;
alter table public.staff_roles enable row level security;
alter table public.guide_admins enable row level security;
alter table public.chats enable row level security;
alter table public.chat_keys enable row level security;
alter table public.messages enable row level security;
alter table public.message_media enable row level security;
alter table public.devices enable row level security;
alter table public.blocked_accounts enable row level security;

-- ---------------------------------------------------------------- private helpers
-- The private schema is not exposed through the API, so these are not callable
-- as RPCs; policies use them.

create or replace function private.is_main_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.main_admins m where m.user_id = uid);
$$;

create or replace function private.is_blocked(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocked_accounts b where b.user_id = uid);
$$;

create or replace function private.is_staff(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_roles r where r.user_id = uid)
      or exists (select 1 from public.main_admins m where m.user_id = uid);
$$;

create or replace function private.has_role(uid uuid, wanted text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_roles r where r.user_id = uid and r.role = wanted);
$$;

create or replace function private.aal2()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- Staff, and anyone who enabled TOTP, must hold a TOTP-verified session.
create or replace function private.mfa_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.aal2() or not (
    private.is_staff(auth.uid())
    or exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status::text = 'verified')
  );
$$;

-- A person's place in a chat: walker, guide, admin (of the guide), main, or null.
create or replace function private.chat_role(chat uuid, uid uuid default auth.uid())
returns text language sql stable security definer set search_path = '' as $$
  select case
    when c.walker_id = uid then 'walker'
    when c.guide_id = uid then 'guide'
    when exists (select 1 from public.guide_admins ga where ga.guide_id = c.guide_id and ga.admin_id = uid) then 'admin'
    when exists (select 1 from public.main_admins m where m.user_id = uid) then 'main'
  end
  from public.chats c where c.id = chat and uid is not null;
$$;

create or replace function private.can_see_profile(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target = auth.uid()
      or private.is_main_admin(auth.uid())
      or exists (
        select 1 from public.chats c
        where private.chat_role(c.id, auth.uid()) is not null
          and private.chat_role(c.id, target) is not null);
$$;

create or replace function private.require_main_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_main_admin(auth.uid()) then
    raise exception 'main admin only' using errcode = '42501';
  end if;
  if not private.aal2() then
    raise exception 'totp session required' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.require_member(chat uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare place text := private.chat_role(chat, auth.uid());
begin
  if place is null or not private.mfa_ok() or private.is_blocked(auth.uid()) then
    raise exception 'not a member of this chat' using errcode = '42501';
  end if;
  return place;
end;
$$;

-- ---------------------------------------------------------------- policies

do $$
declare t text;
begin
  foreach t in array array['profiles', 'identity_keys', 'main_admins', 'staff_roles',
    'guide_admins', 'chats', 'chat_keys', 'messages', 'message_media', 'devices', 'blocked_accounts'] loop
    execute format('drop policy if exists mfa_required on public.%I', t);
    execute format('create policy mfa_required on public.%I as restrictive for all to authenticated
      using (private.mfa_ok()) with check (private.mfa_ok())', t);
    execute format('drop policy if exists not_blocked on public.%I', t);
    execute format('create policy not_blocked on public.%I as restrictive for all to authenticated
      using (not private.is_blocked(auth.uid())) with check (not private.is_blocked(auth.uid()))', t);
  end loop;
end;
$$;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (private.can_see_profile(id));
drop policy if exists profiles_create on public.profiles;
create policy profiles_create on public.profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists profiles_rename on public.profiles;
create policy profiles_rename on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists identity_keys_own on public.identity_keys;
create policy identity_keys_own on public.identity_keys for select to authenticated
  using (user_id = auth.uid());
drop policy if exists identity_keys_create on public.identity_keys;
create policy identity_keys_create on public.identity_keys for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists main_admins_read on public.main_admins;
create policy main_admins_read on public.main_admins for select to authenticated
  using (user_id = auth.uid() or private.is_main_admin(auth.uid()));

drop policy if exists staff_roles_read on public.staff_roles;
create policy staff_roles_read on public.staff_roles for select to authenticated
  using (user_id = auth.uid() or private.is_main_admin(auth.uid()));

drop policy if exists guide_admins_read on public.guide_admins;
create policy guide_admins_read on public.guide_admins for select to authenticated
  using (guide_id = auth.uid() or admin_id = auth.uid() or private.is_main_admin(auth.uid()));

drop policy if exists chats_read on public.chats;
create policy chats_read on public.chats for select to authenticated
  using (private.chat_role(id, auth.uid()) is not null);

drop policy if exists chat_keys_read on public.chat_keys;
create policy chat_keys_read on public.chat_keys for select to authenticated
  using (private.chat_role(chat_id, auth.uid()) is not null);
drop policy if exists chat_keys_share on public.chat_keys;
create policy chat_keys_share on public.chat_keys for insert to authenticated
  with check (created_by = auth.uid()
    and private.chat_role(chat_id, auth.uid()) is not null
    and private.chat_role(chat_id, member_id) is not null);
-- A member may drop a wrap addressed to them that does not open, so another
-- member can wrap the key again.
drop policy if exists chat_keys_drop_own on public.chat_keys;
create policy chat_keys_drop_own on public.chat_keys for delete to authenticated
  using (member_id = auth.uid());

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated
  using (private.chat_role(chat_id, auth.uid()) is not null);
drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and private.chat_role(chat_id, auth.uid()) is not null);

drop policy if exists message_media_read on public.message_media;
create policy message_media_read on public.message_media for select to authenticated
  using (private.chat_role(chat_id, auth.uid()) is not null);

-- The sender, role and time come from the server, not from the client.
create or replace function private.stamp_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.sender_id := auth.uid();
  new.sender_role := coalesce(private.chat_role(new.chat_id, auth.uid()), 'walker');
  new.created_at := now();
  new.edited_at := null;
  new.deleted_at := null;
  return new;
end;
$$;
drop trigger if exists stamp_message on public.messages;
create trigger stamp_message before insert on public.messages
  for each row execute function private.stamp_message();

create or replace function private.stamp_chat_key()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.created_by := auth.uid();
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists stamp_chat_key on public.chat_keys;
create trigger stamp_chat_key before insert on public.chat_keys
  for each row execute function private.stamp_chat_key();

-- ---------------------------------------------------------------- grants

revoke all on public.profiles, public.identity_keys, public.main_admins, public.staff_roles,
  public.guide_admins, public.chats, public.chat_keys, public.messages, public.message_media,
  public.devices, public.blocked_accounts
  from anon, authenticated, public;
grant select, insert (id, name, public_key), update (name) on public.profiles to authenticated;
grant select, insert (user_id, iv, wrapped_private_key) on public.identity_keys to authenticated;
grant select on public.main_admins, public.staff_roles, public.guide_admins, public.chats to authenticated;
grant select, delete, insert (chat_id, version, member_id, ephemeral_key, iv, wrapped_key) on public.chat_keys to authenticated;
grant select, insert (chat_id, key_version, iv, body) on public.messages to authenticated;
grant select on public.message_media to authenticated;

-- ---------------------------------------------------------------- functions (RPC)

-- Who am I, and what must happen before data opens. Works at aal1.
create or replace function public.my_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', auth.uid(),
    'name', (select p.name from public.profiles p where p.id = auth.uid()),
    'has_profile', exists (select 1 from public.profiles p where p.id = auth.uid()),
    'roles', coalesce((select jsonb_agg(r.role order by r.role) from public.staff_roles r where r.user_id = auth.uid()), '[]'::jsonb),
    'main_admin', private.is_main_admin(auth.uid()),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'),
    'has_totp', exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status::text = 'verified'),
    'needs_totp', private.is_staff(auth.uid()),
    'blocked', private.is_blocked(auth.uid()));
$$;

-- Seal a device: the client sends a PIN verifier, the server keeps it with a
-- fresh pepper and returns the pepper once.
create or replace function public.register_device(device uuid, verifier text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  check_bytes bytea := decode(verifier, 'base64');
  fresh bytea := extensions.gen_random_bytes(32);
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if length(check_bytes) <> 32 then raise exception 'bad verifier' using errcode = '22023'; end if;
  insert into public.devices (id, user_id, verifier, pepper) values (device, me, check_bytes, fresh);
  -- Keep the ten most recent devices of a person.
  delete from public.devices d where d.user_id = me and d.id in (
    select x.id from public.devices x where x.user_id = me
    order by coalesce(x.used_at, x.created_at) desc offset 10);
  return encode(fresh, 'base64');
end;
$$;

-- Open a device with its PIN. Callable without a session: the device has none
-- until it opens. Five wrong PINs in a row delete the device.
create or replace function public.unlock_device(device uuid, verifier text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  row_ public.devices%rowtype;
  given bytea;
begin
  select * into row_ from public.devices d where d.id = device for update;
  if not found then return jsonb_build_object('status', 'missing'); end if;
  begin
    given := decode(verifier, 'base64');
  exception when others then
    given := null;
  end;
  if given is not null and given = row_.verifier then
    update public.devices set failures = 0, used_at = now() where id = device;
    return jsonb_build_object('status', 'ok', 'pepper', encode(row_.pepper, 'base64'));
  end if;
  if row_.failures + 1 >= 5 then
    delete from public.devices where id = device;
    return jsonb_build_object('status', 'wiped');
  end if;
  update public.devices set failures = row_.failures + 1 where id = device;
  return jsonb_build_object('status', 'wrong', 'left', 5 - (row_.failures + 1));
end;
$$;

create or replace function public.forget_device(device uuid)
returns void language sql volatile security definer set search_path = '' as $$
  delete from public.devices d where d.id = device and d.user_id = auth.uid();
$$;

-- The chats this person belongs to, newest activity first. Dropped first, as its
-- columns grew.
drop function if exists public.my_chats();
create function public.my_chats()
returns table (chat_id uuid, walker_id uuid, walker_name text, guide_id uuid, guide_name text,
  admin_id uuid, admin_name text, my_role text, last_message_id bigint, last_message_at timestamptz,
  last_edited_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.mfa_ok() or private.is_blocked(auth.uid()) then return; end if;
  return query
    select c.id, c.walker_id, w.name, c.guide_id, g.name, ga.admin_id, a.name,
      private.chat_role(c.id, auth.uid()), m.id, m.created_at, m.edited_at
    from public.chats c
    join public.profiles w on w.id = c.walker_id
    left join public.profiles g on g.id = c.guide_id
    left join public.guide_admins ga on ga.guide_id = c.guide_id
    left join public.profiles a on a.id = ga.admin_id
    left join lateral (select x.id, x.created_at, x.edited_at from public.messages x
      where x.chat_id = c.id and x.deleted_at is null order by x.id desc limit 1) m on true
    where private.chat_role(c.id, auth.uid()) is not null
    order by coalesce(m.created_at, c.created_at) desc;
end;
$$;

-- Everyone in a chat with their public keys: the walker, the guide, the guide's
-- admin and the main admins.
create or replace function public.chat_members(chat uuid)
returns table (user_id uuid, name text, place text, public_key text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_member(chat);
  return query
    select p.id, p.name, private.chat_role(chat, p.id), p.public_key
    from public.profiles p
    where p.id in (
      select c.walker_id from public.chats c where c.id = chat
      union select c.guide_id from public.chats c where c.id = chat
      union select ga.admin_id from public.chats c join public.guide_admins ga on ga.guide_id = c.guide_id where c.id = chat
      union select m.user_id from public.main_admins m);
end;
$$;

-- The main admin's view of every account. Message times only, never content:
-- `waiting_since` is the first walker message after the last answer from the
-- staff, null when nothing waits. Dropped first, as its columns grew.
drop function if exists public.admin_directory();
create function public.admin_directory()
returns table (user_id uuid, name text, created_at timestamptz, roles text[], main_admin boolean,
  chat_id uuid, guide_id uuid, admin_id uuid, blocked boolean, last_message_at timestamptz, waiting_since timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_main_admin();
  return query
    select p.id, p.name, p.created_at,
      coalesce(array(select r.role from public.staff_roles r where r.user_id = p.id order by r.role), '{}'),
      private.is_main_admin(p.id), c.id, c.guide_id,
      (select ga.admin_id from public.guide_admins ga where ga.guide_id = p.id),
      private.is_blocked(p.id),
      (select max(m.created_at) from public.messages m where m.chat_id = c.id and m.deleted_at is null),
      (select min(m.created_at) from public.messages m
        where m.chat_id = c.id and m.sender_role = 'walker' and m.deleted_at is null
          and m.id > coalesce((select max(s.id) from public.messages s
            where s.chat_id = c.id and s.sender_role <> 'walker' and s.deleted_at is null), 0))
    from public.profiles p
    left join public.chats c on c.walker_id = p.id
    order by p.created_at desc;
end;
$$;

-- Close or reopen an account. A main admin cannot be blocked.
create or replace function public.admin_block(target uuid, blocked boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_main_admin();
  if not exists (select 1 from public.profiles p where p.id = target) then
    raise exception 'no such account' using errcode = '22023';
  end if;
  if private.is_main_admin(target) then
    raise exception 'a main admin cannot be blocked' using errcode = '22023';
  end if;
  if blocked then
    insert into public.blocked_accounts (user_id) values (target) on conflict do nothing;
  else
    delete from public.blocked_accounts b where b.user_id = target;
  end if;
end;
$$;

create or replace function public.admin_set_role(target uuid, kind text, enabled boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_main_admin();
  if kind not in ('guide', 'admin') then raise exception 'unknown role' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles p where p.id = target) then
    raise exception 'no such account' using errcode = '22023';
  end if;
  if enabled then
    insert into public.staff_roles (user_id, role) values (target, kind) on conflict do nothing;
  else
    delete from public.staff_roles r where r.user_id = target and r.role = kind;
    if kind = 'guide' then
      update public.chats set guide_id = null where guide_id = target;
      delete from public.guide_admins where guide_id = target;
    else
      delete from public.guide_admins where admin_id = target;
    end if;
  end if;
end;
$$;

-- Give a walker a guide (or none). Creates the walker's chat on first use and
-- returns its id; the main admin's client then shares the chat key.
create or replace function public.admin_assign_guide(walker uuid, guide uuid)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare chat uuid;
begin
  perform private.require_main_admin();
  if not exists (select 1 from public.profiles p where p.id = walker) then
    raise exception 'no such account' using errcode = '22023';
  end if;
  if guide is not null and (guide = walker or not private.has_role(guide, 'guide')) then
    raise exception 'not a guide' using errcode = '22023';
  end if;
  insert into public.chats (walker_id, guide_id) values (walker, guide)
    on conflict (walker_id) do update set guide_id = excluded.guide_id
    returning id into chat;
  return chat;
end;
$$;

create or replace function public.admin_assign_admin(guide uuid, admin uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_main_admin();
  if not private.has_role(guide, 'guide') then raise exception 'not a guide' using errcode = '22023'; end if;
  if admin is null then
    delete from public.guide_admins where guide_id = guide;
    return;
  end if;
  if admin = guide or not private.has_role(admin, 'admin') then
    raise exception 'not an admin' using errcode = '22023';
  end if;
  insert into public.guide_admins (guide_id, admin_id) values (guide, admin)
    on conflict (guide_id) do update set admin_id = excluded.admin_id;
end;
$$;

-- A voice message: the sealed description as a message row, the sealed audio beside it.
create or replace function public.send_voice(chat uuid, version int, sealed_iv text, sealed_body text, audio_iv text, audio_body text)
returns public.messages language plpgsql volatile security definer set search_path = '' as $$
declare made public.messages;
begin
  perform private.require_member(chat);
  insert into public.messages (chat_id, key_version, kind, iv, body)
    values (chat, version, 'voice', sealed_iv, sealed_body) returning * into made;
  insert into public.message_media (message_id, chat_id, iv, body) values (made.id, chat, audio_iv, audio_body);
  return made;
end;
$$;

-- The sender, still a member of the chat, may change or delete their own message.
create or replace function private.own_message(message bigint)
returns public.messages language plpgsql volatile security definer set search_path = '' as $$
declare found_row public.messages;
begin
  select * into found_row from public.messages m where m.id = message for update;
  if not found or found_row.sender_id is distinct from auth.uid() or found_row.deleted_at is not null then
    raise exception 'not your message' using errcode = '42501';
  end if;
  perform private.require_member(found_row.chat_id);
  return found_row;
end;
$$;

create or replace function public.edit_message(message bigint, version int, sealed_iv text, sealed_body text)
returns public.messages language plpgsql volatile security definer set search_path = '' as $$
declare changed public.messages;
begin
  if (private.own_message(message)).kind <> 'text' then
    raise exception 'only text can be edited' using errcode = '22023';
  end if;
  update public.messages m set key_version = version, iv = sealed_iv, body = sealed_body, edited_at = now()
    where m.id = message returning * into changed;
  return changed;
end;
$$;

create or replace function public.delete_message(message bigint)
returns public.messages language plpgsql volatile security definer set search_path = '' as $$
declare changed public.messages;
begin
  perform private.own_message(message);
  delete from public.message_media mm where mm.message_id = message;
  update public.messages m set iv = null, body = null, deleted_at = now()
    where m.id = message returning * into changed;
  return changed;
end;
$$;

-- A daily request keeps the free project awake.
create or replace function public.ping()
returns int language sql stable set search_path = '' as $$ select 1; $$;

revoke all on function public.my_status(), public.register_device(uuid, text),
  public.unlock_device(uuid, text), public.forget_device(uuid), public.my_chats(),
  public.chat_members(uuid), public.admin_directory(), public.admin_set_role(uuid, text, boolean),
  public.admin_assign_guide(uuid, uuid), public.admin_assign_admin(uuid, uuid),
  public.admin_block(uuid, boolean), public.send_voice(uuid, int, text, text, text, text),
  public.edit_message(bigint, int, text, text), public.delete_message(bigint), public.ping()
  from public, anon, authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
grant execute on function public.my_status(), public.register_device(uuid, text),
  public.unlock_device(uuid, text), public.forget_device(uuid), public.my_chats(),
  public.chat_members(uuid), public.admin_directory(), public.admin_set_role(uuid, text, boolean),
  public.admin_assign_guide(uuid, uuid), public.admin_assign_admin(uuid, uuid),
  public.admin_block(uuid, boolean), public.send_voice(uuid, int, text, text, text, text),
  public.edit_message(bigint, int, text, text), public.delete_message(bigint), public.ping()
  to authenticated;
grant execute on function public.unlock_device(uuid, text), public.ping() to anon;

-- ---------------------------------------------------------------- realtime

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
