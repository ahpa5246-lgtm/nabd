-- NABD cloud schema v1, apply once to a dedicated Supabase project.
-- No table is publicly readable; signed-out users have ZERO financial access.
begin;

create extension if not exists pgcrypto;

create table if not exists public.nabd_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 100),
  opening_balance_iqd bigint not null default 0 check (abs(opening_balance_iqd) <= 1000000000000),
  currency text not null default 'IQD' check (currency = 'IQD'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nabd_memberships (
  workspace_id uuid not null references public.nabd_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

create table if not exists public.nabd_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.nabd_workspaces(id) on delete cascade,
  date date not null check (date between date '2000-01-01' and date '2100-12-31'),
  amount bigint not null check (amount between 1 and 10000000000),
  type text not null check (type in ('income','expense')),
  category text not null check (char_length(btrim(category)) between 1 and 120),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  channel text not null check (channel in ('cash','zaincash','bank','other')),
  status text not null check (status in ('completed','scheduled')),
  version bigint not null default 1 check (version >= 1),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nabd_transactions_workspace_date
  on public.nabd_transactions(workspace_id,date desc,id);
create index if not exists nabd_memberships_user on public.nabd_memberships(user_id,workspace_id);

create table if not exists public.nabd_transaction_audit (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.nabd_workspaces(id) on delete cascade,
  transaction_id uuid not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  actor_id uuid references auth.users(id) on delete set null,
  happened_at timestamptz not null default now(),
  old_row jsonb,
  new_row jsonb
);
create index if not exists nabd_audit_workspace_time on public.nabd_transaction_audit(workspace_id,happened_at desc);

-- SECURITY DEFINER routines can read memberships without self-referential RLS recursion.
-- Never accept caller-supplied owner/user ids as authority.
create or replace function public.nabd_is_member(w uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.nabd_memberships m
     where m.workspace_id=w and m.user_id=auth.uid()
  );
$$;

create or replace function public.nabd_can_edit(w uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.nabd_memberships m
     where m.workspace_id=w and m.user_id=auth.uid()
       and m.role in ('owner','editor')
  );
$$;

create or replace function public.nabd_is_owner(w uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.nabd_workspaces wks
     where wks.id=w and wks.owner_id=auth.uid()
  );
$$;

create or replace function public.nabd_add_initial_owner()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.nabd_memberships(workspace_id,user_id,role)
    values(new.id,new.owner_id,'owner');
  return new;
end;
$$;
drop trigger if exists nabd_create_owner_membership on public.nabd_workspaces;
create trigger nabd_create_owner_membership
after insert on public.nabd_workspaces for each row execute function public.nabd_add_initial_owner();

create or replace function public.nabd_protect_workspace()
returns trigger language plpgsql set search_path=''
as $$
begin
  if old.owner_id is distinct from new.owner_id or old.currency is distinct from new.currency then
    raise exception 'Workspace owner and currency cannot be reassigned';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists nabd_workspace_protection on public.nabd_workspaces;
create trigger nabd_workspace_protection
before update on public.nabd_workspaces for each row execute function public.nabd_protect_workspace();

create or replace function public.nabd_protect_transaction()
returns trigger language plpgsql set search_path=''
as $$
begin
  if old.workspace_id is distinct from new.workspace_id or
     old.id is distinct from new.id or old.created_by is distinct from new.created_by or
     old.created_at is distinct from new.created_at then
    raise exception 'Transaction identity cannot be moved or changed';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists nabd_transaction_protection on public.nabd_transactions;
create trigger nabd_transaction_protection
before update on public.nabd_transactions for each row execute function public.nabd_protect_transaction();

create or replace function public.nabd_capture_transaction_audit()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.nabd_transaction_audit(workspace_id,transaction_id,operation,actor_id,old_row,new_row)
  values(coalesce(new.workspace_id,old.workspace_id),coalesce(new.id,old.id),tg_op,
         auth.uid(),case when tg_op='INSERT' then null else to_jsonb(old) end,
         case when tg_op='DELETE' then null else to_jsonb(new) end);
  return coalesce(new,old);
end;
$$;
drop trigger if exists nabd_transaction_audit_trigger on public.nabd_transactions;
create trigger nabd_transaction_audit_trigger
after insert or update or delete on public.nabd_transactions
for each row execute function public.nabd_capture_transaction_audit();

alter table public.nabd_workspaces enable row level security;
alter table public.nabd_memberships enable row level security;
alter table public.nabd_transactions enable row level security;
alter table public.nabd_transaction_audit enable row level security;
alter table public.nabd_workspaces force row level security;
alter table public.nabd_memberships force row level security;
alter table public.nabd_transactions force row level security;
alter table public.nabd_transaction_audit force row level security;

drop policy if exists nabd_workspace_read on public.nabd_workspaces;
create policy nabd_workspace_read on public.nabd_workspaces for select to authenticated
  using (public.nabd_is_member(id));
drop policy if exists nabd_workspace_create on public.nabd_workspaces;
create policy nabd_workspace_create on public.nabd_workspaces for insert to authenticated
  with check (auth.uid() is not null and owner_id=auth.uid());
drop policy if exists nabd_workspace_edit on public.nabd_workspaces;
create policy nabd_workspace_edit on public.nabd_workspaces for update to authenticated
  using (public.nabd_is_owner(id)) with check (public.nabd_is_owner(id));

drop policy if exists nabd_membership_read on public.nabd_memberships;
create policy nabd_membership_read on public.nabd_memberships for select to authenticated
  using (public.nabd_is_member(workspace_id));
-- Membership changes are intentionally absent from browser API. Privileged enrollment
-- will require a separately reviewed invitation flow, not an owner-controlled role field.

drop policy if exists nabd_transactions_read on public.nabd_transactions;
create policy nabd_transactions_read on public.nabd_transactions for select to authenticated
  using (public.nabd_is_member(workspace_id));
drop policy if exists nabd_transactions_add on public.nabd_transactions;
create policy nabd_transactions_add on public.nabd_transactions for insert to authenticated
  with check (public.nabd_can_edit(workspace_id) and created_by=auth.uid());
drop policy if exists nabd_transactions_edit on public.nabd_transactions;
create policy nabd_transactions_edit on public.nabd_transactions for update to authenticated
  using (public.nabd_can_edit(workspace_id)) with check (public.nabd_can_edit(workspace_id));
drop policy if exists nabd_transactions_remove on public.nabd_transactions;
create policy nabd_transactions_remove on public.nabd_transactions for delete to authenticated
  using (public.nabd_can_edit(workspace_id));

drop policy if exists nabd_audit_read on public.nabd_transaction_audit;
create policy nabd_audit_read on public.nabd_transaction_audit for select to authenticated
  using (public.nabd_is_member(workspace_id));

-- Explicitly narrow grants. RLS is an additional layer, not a replacement.
revoke all on public.nabd_workspaces,public.nabd_memberships,
  public.nabd_transactions,public.nabd_transaction_audit from public,anon,authenticated;
grant select,insert on public.nabd_workspaces to authenticated;
grant update(name,opening_balance_iqd) on public.nabd_workspaces to authenticated;
grant select on public.nabd_memberships to authenticated;
grant select,delete on public.nabd_transactions to authenticated;
-- The browser cannot forge creation identity, timestamps or edit versions.
grant insert(id,workspace_id,date,amount,type,category,description,channel,status)
  on public.nabd_transactions to authenticated;
grant update(date,amount,type,category,description,channel,status) on public.nabd_transactions to authenticated;
grant select on public.nabd_transaction_audit to authenticated;

revoke all on function public.nabd_is_member(uuid),public.nabd_can_edit(uuid),public.nabd_is_owner(uuid)
  from public,anon;
grant execute on function public.nabd_is_member(uuid),public.nabd_can_edit(uuid),public.nabd_is_owner(uuid) to authenticated;

-- Atomic ledger restore, owner only, capped at 1,000 records to avoid quota abuse.
-- No user ID or role accepted as authority; all identities come from auth.uid().
create or replace function public.nabd_replace_ledger(w uuid, records jsonb, balance bigint)
returns integer language plpgsql security definer set search_path='' as $$
declare
  elem jsonb;
  count_records integer;
begin
  if auth.uid() is null or not public.nabd_is_owner(w) then
    raise exception 'Not authorized to restore ledger';
  end if;
  if records is null or jsonb_typeof(records) <> 'array' or jsonb_array_length(records) > 1000 then
    raise exception 'Expected at most 1000 ledger rows';
  end if;
  if balance is null or abs(balance) > 1000000000000 then
    raise exception 'Opening balance is invalid';
  end if;
  count_records := jsonb_array_length(records);
  -- Validate all rows BEFORE destructive action using a dry table cast pass.
  for elem in select value from jsonb_array_elements(records)
  loop
    if jsonb_typeof(elem) <> 'object' or
       jsonb_typeof(elem->'amount') <> 'number' or
       elem->>'amount' !~ '^[0-9]+$' or
       (elem->>'amount')::bigint not between 1 and 10000000000 or
       (elem->>'date')::date not between date '2000-01-01' and date '2100-12-31' or
       elem->>'type' not in ('income','expense') or
       elem->>'status' not in ('completed','scheduled') or
       elem->>'channel' not in ('cash','zaincash','bank','other') or
       char_length(btrim(elem->>'description')) not between 1 and 500 or
       char_length(btrim(elem->>'category')) not between 1 and 120 then
      raise exception 'Invalid row in backup';
    end if;
  end loop;
  delete from public.nabd_transactions where workspace_id=w;
  insert into public.nabd_transactions(workspace_id,date,amount,type,category,description,channel,status,created_by)
  select w,(value->>'date')::date,(value->>'amount')::bigint,
         value->>'type',value->>'category',value->>'description',
         value->>'channel',value->>'status',auth.uid()
    from jsonb_array_elements(records);
  update public.nabd_workspaces set opening_balance_iqd=balance where id=w;
  return count_records;
end;
$$;
revoke all on function public.nabd_replace_ledger(uuid,jsonb,bigint) from public,anon;
grant execute on function public.nabd_replace_ledger(uuid,jsonb,bigint) to authenticated;

commit;
