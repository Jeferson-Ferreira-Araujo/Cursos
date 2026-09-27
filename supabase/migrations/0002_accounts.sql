-- Accounts represent a Creator's tenant ("business"). All content and
-- students belong to exactly one account. This is the multi-tenant boundary.
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now(),
  unique (account_id, user_id)
);

create index account_members_user_id_idx on public.account_members (user_id);

alter table public.accounts enable row level security;
alter table public.account_members enable row level security;

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- Security-definer helper: avoids recursive RLS lookups on account_members
-- and centralizes the "is this user a Creator on this tenant" check.
create function public.is_account_member(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_members am
    where am.account_id = target_account_id
      and am.user_id = auth.uid()
  );
$$;

create policy accounts_select_member
  on public.accounts for select
  using (public.is_account_member(id));

create policy accounts_update_member
  on public.accounts for update
  using (public.is_account_member(id));

create policy account_members_select_self_or_member
  on public.account_members for select
  using (user_id = auth.uid() or public.is_account_member(account_id));

-- Creates an account and makes the calling user its owner in a single,
-- atomic, security-definer transaction (avoids chicken-and-egg RLS issues
-- when a brand new user has no account yet to be a member of).
create function public.create_creator_account(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_account_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.accounts (name) values (nullif(trim(p_name), ''))
  returning id into new_account_id;

  insert into public.account_members (account_id, user_id, role)
  values (new_account_id, auth.uid(), 'owner');

  return new_account_id;
end;
$$;
