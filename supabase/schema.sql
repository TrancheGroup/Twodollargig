-- Run only in a dedicated TwoDollarGig Supabase project.
create extension if not exists pgcrypto;

create table if not exists public.gig_pro_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null default 'inactive',
  access_until timestamptz not null default 'epoch',
  last_event_created bigint not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.gig_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default '' check (length(label) <= 90),
  kind text not null check(kind in ('shift','week')),
  platform text not null,
  work_date date not null,
  gross numeric(14,2) not null check(gross>=0),
  hours numeric(12,2) not null check(hours>=0),
  miles numeric(12,2) not null check(miles>=0),
  gas_mode text not null check(gas_mode in ('perMile','total')),
  gas_per_mile numeric(10,4) not null check(gas_per_mile>=0),
  gas_total numeric(14,2) not null check(gas_total>=0),
  wear_per_mile numeric(10,4) not null check(wear_per_mile>=0),
  other_expenses numeric(14,2) not null check(other_expenses>=0),
  net_hourly numeric(14,4),
  net_earnings numeric(14,4) not null,
  created_at timestamptz not null default now()
);
create index if not exists gig_entries_user_created_idx on public.gig_entries(user_id,created_at desc);

alter table public.gig_pro_entitlements enable row level security;
alter table public.gig_entries enable row level security;
revoke all on public.gig_pro_entitlements from anon,authenticated;
revoke all on public.gig_entries from anon,authenticated;
grant select on public.gig_pro_entitlements to authenticated;
grant select,insert,delete on public.gig_entries to authenticated;
-- The Stripe webhook uses the service_role key server-side; regular users cannot edit entitlements.
create policy "User reads own subscription" on public.gig_pro_entitlements
  for select to authenticated using ((select auth.uid())=user_id);
create policy "Paid user reads own entries" on public.gig_entries
  for select to authenticated
  using (
    (select auth.uid())=user_id AND EXISTS (
      select 1 from public.gig_pro_entitlements p
      where p.user_id=(select auth.uid())
        and p.status in ('active','trialing','canceled')
        and p.access_until > now()
    )
  );
create policy "Paid user saves own entries" on public.gig_entries
  for insert to authenticated
  with check (
    (select auth.uid())=user_id AND EXISTS (
      select 1 from public.gig_pro_entitlements p
      where p.user_id=(select auth.uid())
        and p.status in ('active','trialing','canceled')
        and p.access_until > now()
    )
  );
create policy "Paid user deletes own entries" on public.gig_entries
  for delete to authenticated
  using (
    (select auth.uid())=user_id AND EXISTS (
      select 1 from public.gig_pro_entitlements p
      where p.user_id=(select auth.uid())
        and p.status in ('active','trialing','canceled')
        and p.access_until > now()
    )
  );
-- Security test: with anon key both tables return no rows.
-- With user A JWT, user B's entries and entitlement must remain invisible.
