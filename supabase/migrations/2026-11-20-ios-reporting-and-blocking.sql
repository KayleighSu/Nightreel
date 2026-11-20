-- Nightreel iOS launch: account safety and reports.
-- Applied to production on 2026-11-20. This record is for reproducibility.
create table if not exists public.nightreel_blocks (
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id),
 constraint cannot_block_self check(blocker_id<>blocked_id)
);
alter table public.nightreel_blocks enable row level security;
create policy "blocker sees their blocks" on public.nightreel_blocks for select to authenticated using(blocker_id=(select auth.uid()));
create policy "blocker inserts their blocks" on public.nightreel_blocks for insert to authenticated with check(blocker_id=(select auth.uid()) and blocked_id<>(select auth.uid()));
create policy "blocker removes their blocks" on public.nightreel_blocks for delete to authenticated using(blocker_id=(select auth.uid()));
grant select,insert,delete on public.nightreel_blocks to authenticated;

create table if not exists public.nightreel_reports(
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 reported_user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(category in ('profile','message','artwork','other')),
 reason text not null check(length(trim(reason)) between 5 and 1000),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 constraint cannot_report_self check(reporter_id<>reported_user_id)
);
alter table public.nightreel_reports enable row level security;
create policy "reporter creates own report" on public.nightreel_reports for insert to authenticated with check(reporter_id=(select auth.uid()) and reported_user_id<>(select auth.uid()));
create policy "reporter reads own reports" on public.nightreel_reports for select to authenticated using(reporter_id=(select auth.uid()));
grant select,insert on public.nightreel_reports to authenticated;

create or replace function public.block_nightreel_user(p_other_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare v_id uuid:=(select auth.uid());
begin
 if v_id is null or p_other_id is null or p_other_id=v_id then
  raise exception 'Invalid block request';
 end if;
 insert into public.nightreel_blocks(blocker_id,blocked_id) values(v_id,p_other_id)
 on conflict do nothing;
 delete from public.friendships where
  (requester_id=v_id and recipient_id=p_other_id)
  or (requester_id=p_other_id and recipient_id=v_id);
end $$;
revoke all on function public.block_nightreel_user(uuid) from public,anon;
grant execute on function public.block_nightreel_user(uuid) to authenticated;

drop policy if exists "send friend request" on public.friendships;
create policy "send friend request" on public.friendships for insert to authenticated
with check(
 requester_id=(select auth.uid()) and recipient_id<>requester_id and status='pending'
 and not exists(
 select 1 from public.nightreel_blocks b where
 (b.blocker_id=requester_id and b.blocked_id=recipient_id)
 or (b.blocker_id=recipient_id and b.blocked_id=requester_id)
 )
);

create or replace function public.nightreel_reject_blocked_friendships()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.nightreel_blocks b
 where (b.blocker_id=new.requester_id and b.blocked_id=new.recipient_id)
 or (b.blocker_id=new.recipient_id and b.blocked_id=new.requester_id)) then
  raise exception 'This friend request cannot be sent.' using errcode='42501';
 end if;
 return new;
end; $$;
revoke all on function public.nightreel_reject_blocked_friendships() from public,anon,authenticated;
drop trigger if exists nightreel_reject_blocked_friendship on public.friendships;
create trigger nightreel_reject_blocked_friendship before insert or update of status on public.friendships
for each row execute function public.nightreel_reject_blocked_friendships();

create or replace function public.search_nightreel_users(p_query text)
returns table(id uuid,username text,display_name text)
language sql stable security definer set search_path='' as $$
 select p.id,p.username,p.display_name from public.profiles p
 where (select auth.uid()) is not null and length(trim(p_query)) between 2 and 32
 and p.id<>(select auth.uid())
 and (p.username ilike '%'||replace(replace(trim(p_query),'%','\\%'),'_','\\_')||'%' escape '\'
  or p.display_name ilike '%'||replace(replace(trim(p_query),'%','\\%'),'_','\\_')||'%' escape '\')
 and not exists(select 1 from public.nightreel_blocks b
  where (b.blocker_id=(select auth.uid()) and b.blocked_id=p.id)
  or (b.blocked_id=(select auth.uid()) and b.blocker_id=p.id))
 order by p.username limit 20;
$$;
