-- Creates a profile row automatically for every new auth user, and links any
-- pending student invitation that used the same email (case-insensitive).
-- This is how a Student "activates" access created by a Creator: they sign
-- up with the email the Creator registered them with.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  update public.invitations
  set user_id = new.id,
      status = 'accepted',
      accepted_at = now()
  where invitations.user_id is null
    and lower(invitations.email) = lower(new.email);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
