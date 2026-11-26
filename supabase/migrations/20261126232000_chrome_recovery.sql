begin;

create table app_private.workspace_recovery (
  user_id uuid primary key,
  ticket_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz
);
revoke all on app_private.workspace_recovery from public, anon, authenticated;

-- A recovery link only works for its original Auth account. Applying the
-- browser's snapshot and consuming the link share one transaction.
create function public.recover_workspace_modules(ticket text, snapshots jsonb default null)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  recovery app_private.workspace_recovery%rowtype;
  expected integer;
  saved integer;
begin
  if length(ticket) is distinct from 64 or app_private.account_phone() is null then
    return 'invalid';
  end if;

  select * into recovery from app_private.workspace_recovery r
  where r.user_id = auth.uid()
    and r.ticket_hash = encode(sha256(convert_to(ticket, 'UTF8')), 'hex')
    and r.expires_at > now()
  for update;

  if not found then return 'invalid'; end if;
  if recovery.used_at is not null then return 'used'; end if;
  if snapshots is null then return 'ready'; end if;

  begin
    with owned as materialized (
      select incoming.space_id, incoming.module, incoming.data
      from jsonb_to_recordset(snapshots) as incoming(space_id text, module text, data jsonb)
      join public.spaces s on s.id = incoming.space_id and s.owner_user_id = recovery.user_id
      where incoming.module in ('operations', 'projects', 'todos')
    ), inserted as (
      insert into public.workspace_module_state (space_id, module, revision, data)
      select space_id, module, 1, data from owned
      on conflict (space_id, module) do nothing
      returning 1
    )
    select (select count(*) from owned), (select count(*) from inserted) into expected, saved;
    if saved <> expected then
      raise sqlstate 'PZ001';
    end if;
  exception when sqlstate 'PZ001' then
    return 'conflict';
  end;

  update app_private.workspace_recovery set used_at = now() where user_id = recovery.user_id;
  return 'completed';
end;
$$;
revoke all on function public.recover_workspace_modules(text, jsonb) from public, anon;
grant execute on function public.recover_workspace_modules(text, jsonb) to authenticated;

commit;
