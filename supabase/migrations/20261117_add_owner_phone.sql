-- 应用层账号隔离：已有空间归属 136，新建空间由应用写入当前手机号。
alter table public.spaces
  add column if not exists owner_phone text;

update public.spaces
set owner_phone = '13610392041'
where owner_phone is null;

create index if not exists spaces_owner_phone_idx
  on public.spaces (owner_phone);

alter table public.spaces
  alter column owner_phone set not null;
