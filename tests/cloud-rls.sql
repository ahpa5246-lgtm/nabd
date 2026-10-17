-- Test against local PostgreSQL with mocked Supabase auth.uid() and two users.
-- All fixtures use synthetic users and amounts, never real customer data.
\set ON_ERROR_STOP on

create schema auth;
create table auth.users (id uuid primary key);
create role authenticated nologin;
create role anon nologin;
grant usage on schema public to authenticated,anon;
grant usage on schema auth to authenticated,anon;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant execute on function auth.uid() to authenticated,anon;
insert into auth.users(id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc');

\i supabase/migrations/20261017_secure_multitenant.sql

set role authenticated;
set "request.jwt.claim.sub"='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
insert into public.nabd_workspaces(id,owner_id,name)
 values('11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic Shop A');
select 1/count(*) from public.nabd_memberships where workspace_id='11111111-1111-4111-8111-111111111111';
insert into public.nabd_transactions(id,workspace_id,date,amount,type,category,description,channel,status)
values('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',
 '2026-10-10',190000,'income','Test','Shop A transaction','cash','completed');
select 1/count(*) from public.nabd_transactions where workspace_id='11111111-1111-4111-8111-111111111111';

reset role;
set role authenticated;
set "request.jwt.claim.sub"='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
insert into public.nabd_workspaces(id,owner_id,name)
 values('22222222-2222-4222-8222-222222222222',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Synthetic Shop B');

-- Every user sees their own workspace and nothing from the other.
do $$
begin
  if (select count(*) from public.nabd_workspaces) <> 1 or
     (select count(*) from public.nabd_transactions) <> 0 or
     (select count(*) from public.nabd_transaction_audit) <> 0 then
    raise exception 'Tenant B can read A';
  end if;
end;
$$;

-- A forged INSERT must fail both RLS and created_by equality.
do $$
begin
  begin
    insert into public.nabd_transactions(workspace_id,date,amount,type,category,description,channel,status)
      values('11111111-1111-4111-8111-111111111111','2026-10-11',99,'expense','Test','Intrusion','cash','completed');
    raise exception 'Cross tenant insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.nabd_memberships(workspace_id,user_id,role)
      values('11111111-1111-4111-8111-111111111111',
             'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner');
    raise exception 'Forged owner membership succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.nabd_replace_ledger('11111111-1111-4111-8111-111111111111','[]'::jsonb,0);
    raise exception 'Cross tenant restore succeeded';
  exception when others then
    if sqlerrm='Cross tenant restore succeeded' then raise; end if;
  end;
end;
$$;

-- No cross-tenant UPDATE/DELETE rows should be visible, even with known UUID.
update public.nabd_transactions set amount=1 where id='33333333-3333-4333-8333-333333333333';
delete from public.nabd_transactions where id='33333333-3333-4333-8333-333333333333';

reset role;
set role authenticated;
set "request.jwt.claim.sub"='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$
begin
  if (select count(*) from public.nabd_transactions)<>1 then
    raise exception 'Original transaction was lost to tenant B';
  end if;
  if (select count(*) from public.nabd_transaction_audit)<>1 then
    raise exception 'Insert audit missing';
  end if;
end;
$$;
update public.nabd_transactions set amount=190001 where id='33333333-3333-4333-8333-333333333333';
do $$
begin
  if (select version from public.nabd_transactions where id='33333333-3333-4333-8333-333333333333')<>2 then
    raise exception 'Version failed';
  end if;
  if (select count(*) from public.nabd_transaction_audit)<>2 then
    raise exception 'Update audit missing';
  end if;
end;
$$;
select public.nabd_replace_ledger('11111111-1111-4111-8111-111111111111',
 '[{"date":"2026-10-11","amount":750,"type":"income","category":"Test","description":"Verified atomic restore","channel":"bank","status":"completed"}]'::jsonb,
 -1200);
do $$
begin
  if (select count(*) from public.nabd_transactions)<>1 then
    raise exception 'Restore not atomic';
  end if;
  if (select opening_balance_iqd from public.nabd_workspaces where id='11111111-1111-4111-8111-111111111111')<>-1200 then
    raise exception 'Opening balance restore failed';
  end if;
end;
$$;

-- A read-only staff member can see their workspace but cannot modify it.
reset role;
insert into public.nabd_memberships(workspace_id,user_id,role) values
 ('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc','viewer');
set role authenticated;
set "request.jwt.claim.sub"='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
do $$
begin
  if (select count(*) from public.nabd_transactions)<>1 then
    raise exception 'Viewer cannot read assigned store';
  end if;
  begin
    update public.nabd_transactions set amount=2 where workspace_id='11111111-1111-4111-8111-111111111111';
    if found then raise exception 'Viewer modified transaction'; end if;
  exception when others then
    if sqlerrm='Viewer modified transaction' then raise; end if;
  end;
end;
$$;

reset role;
set role anon;
do $$
begin
  begin
    perform count(*) from public.nabd_transactions;
    raise exception 'Anonymous read unexpectedly granted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
\echo PASS: RLS isolation, cross-tenant write denial, role constraints, audit, atomic restore and anonymous denial.
