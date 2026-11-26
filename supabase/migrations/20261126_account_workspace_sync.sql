begin;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

-- Match the confirmed Auth identity to existing workspace ownership. Auth
-- metadata supplied by the browser is deliberately not used for ownership.
create function app_private.account_phone()
returns text
language sql stable security definer
set search_path = ''
as $$
  select substring(u.phone from '(1[0-9]{10})$')
  from auth.users u
  where u.id = (select auth.uid())
    and u.phone_confirmed_at is not null
    and u.phone ~ '^([+]?[8]6)?1[0-9]{10}$'
$$;
revoke all on function app_private.account_phone() from public;
grant execute on function app_private.account_phone() to authenticated;

-- Bind existing records once. Future ownership checks use the immutable Auth
-- account ID so a different account cannot inherit data by reusing a phone.
alter table public.spaces add column owner_user_id uuid;
alter table public.spaces alter column owner_user_id set default auth.uid();
update public.spaces s
set owner_user_id = u.id
from auth.users u
where s.owner_phone = substring(u.phone from '(1[0-9]{10})$')
  and u.phone_confirmed_at is not null
  and u.phone ~ '^([+]?[8]6)?1[0-9]{10}$';
do $$
begin
  if exists (select 1 from public.spaces where owner_user_id is null) then
    raise exception 'Provision a confirmed Supabase Auth user for every existing space owner before applying this migration';
  end if;
end
$$;
alter table public.spaces alter column owner_user_id set not null;
create index spaces_owner_user_id_idx on public.spaces (owner_user_id);

-- Restrictive policies also constrain any permissive policies on the old tables.
alter table public.spaces enable row level security;
create policy "space authenticated access" on public.spaces
  for all to authenticated using (true) with check (true);
create policy "space owner boundary" on public.spaces as restrictive
  for all to authenticated
  using (owner_user_id = (select auth.uid()) and (select app_private.account_phone()) is not null)
  with check (owner_user_id = (select auth.uid()) and (select app_private.account_phone()) is not null);

alter table public.requirements enable row level security;
create policy "requirement authenticated access" on public.requirements
  for all to authenticated using (true) with check (true);
create policy "requirement space boundary" on public.requirements as restrictive
  for all to authenticated
  using (exists (select 1 from public.spaces s where s.id = requirements.space_id))
  with check (exists (select 1 from public.spaces s where s.id = requirements.space_id));

alter table public.competitors enable row level security;
create policy "competitor authenticated access" on public.competitors
  for all to authenticated using (true) with check (true);
create policy "competitor space boundary" on public.competitors as restrictive
  for all to authenticated
  using (exists (select 1 from public.spaces s where s.id = competitors.space_id))
  with check (exists (select 1 from public.spaces s where s.id = competitors.space_id));

alter table public.retros enable row level security;
create policy "retro authenticated access" on public.retros
  for all to authenticated using (true) with check (true);
create policy "retro requirement boundary" on public.retros as restrictive
  for all to authenticated
  using (exists (select 1 from public.requirements r where r.id = retros.req_id))
  with check (exists (select 1 from public.requirements r where r.id = retros.req_id));

revoke all on public.spaces, public.requirements, public.competitors, public.retros from anon, public;
revoke update on public.spaces from authenticated;
grant select, insert, delete on public.spaces to authenticated;
grant update (name) on public.spaces to authenticated;
grant select, insert, update, delete on public.requirements, public.competitors, public.retros to authenticated;

create table public.workspace_module_state (
  space_id text not null references public.spaces(id) on delete cascade,
  module text not null check (module in ('operations', 'projects', 'todos')),
  revision integer not null check (revision > 0),
  data jsonb not null,
  primary key (space_id, module)
);
alter table public.workspace_module_state enable row level security;
revoke all on public.workspace_module_state from anon, public;
grant select, insert, update on public.workspace_module_state to authenticated;
create policy "module space boundary" on public.workspace_module_state
  for all to authenticated
  using (exists (select 1 from public.spaces s where s.id = workspace_module_state.space_id))
  with check (exists (select 1 from public.spaces s where s.id = workspace_module_state.space_id));

create table public.workspace_files (
  id text primary key,
  space_id text not null references public.spaces(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  original_name text not null,
  mime_type text not null,
  size bigint not null check (size >= 0),
  created_at bigint not null,
  check (id ~ '^[a-zA-Z0-9_-]+$')
);
create index workspace_files_scope_idx on public.workspace_files (space_id, entity_type, entity_id);
alter table public.workspace_files enable row level security;
revoke all on public.workspace_files from anon, public;
grant select, insert, delete on public.workspace_files to authenticated;
create policy "file space boundary" on public.workspace_files
  for all to authenticated
  using (exists (select 1 from public.spaces s where s.id = workspace_files.space_id))
  with check (exists (select 1 from public.spaces s where s.id = workspace_files.space_id));

insert into storage.buckets (id, name, public)
values ('workspace-files-private', 'workspace-files-private', false)
on conflict (id) do update set public = false;

create policy "private workspace object access" on storage.objects
  for all to authenticated
  using (bucket_id = 'workspace-files-private')
  with check (bucket_id = 'workspace-files-private');

create function app_private.owns_workspace(workspace_id text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.spaces s
    where s.id = workspace_id
      and s.owner_user_id = (select auth.uid())
      and (select app_private.account_phone()) is not null
  )
$$;
revoke all on function app_private.owns_workspace(text) from public;
grant usage on schema app_private to anon;
grant execute on function app_private.owns_workspace(text) to anon, authenticated;

-- An unrelated broad storage policy must not expose this bucket. The first
-- path segment is the owned space, and the second is the file ID.
create policy "private workspace object boundary" on storage.objects as restrictive
  for all to public
  using (bucket_id <> 'workspace-files-private' or app_private.owns_workspace((storage.foldername(name))[1]))
  with check (bucket_id <> 'workspace-files-private' or app_private.owns_workspace((storage.foldername(name))[1]));

commit;
