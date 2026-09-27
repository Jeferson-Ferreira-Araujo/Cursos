-- Adds (or updates) a student on the Creator's roster by email. If that
-- email already belongs to an existing auth user, the invitation links to
-- them immediately; otherwise it links automatically the moment they sign
-- up (see handle_new_user). Runs as security definer only to allow the
-- narrow, read-only lookup against auth.users by email -- it never exposes
-- auth admin capabilities to the client.
create function public.add_student(p_account_id uuid, p_email text, p_full_name text default '')
returns public.invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_existing_user_id uuid;
  v_invitation public.invitations;
begin
  if not public.is_account_member(p_account_id) then
    raise exception 'Not authorized for this account';
  end if;

  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email';
  end if;

  select id into v_existing_user_id from auth.users where lower(email) = v_email limit 1;

  insert into public.invitations (account_id, email, full_name, user_id, invited_by, status, accepted_at)
  values (
    p_account_id,
    v_email,
    coalesce(nullif(trim(p_full_name), ''), ''),
    v_existing_user_id,
    auth.uid(),
    case when v_existing_user_id is not null then 'accepted' else 'pending' end,
    case when v_existing_user_id is not null then now() else null end
  )
  on conflict (account_id, email) do update
    set full_name = case when excluded.full_name <> '' then excluded.full_name else public.invitations.full_name end,
        user_id = coalesce(public.invitations.user_id, excluded.user_id),
        status = case when coalesce(public.invitations.user_id, excluded.user_id) is not null then 'accepted' else public.invitations.status end
  returning * into v_invitation;

  return v_invitation;
end;
$$;

-- Grants (or re-activates) a student's access to a course.
create function public.grant_course_access(p_course_id uuid, p_invitation_id uuid)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_enrollment public.enrollments;
begin
  select account_id into v_account_id from public.courses where id = p_course_id;

  if v_account_id is null or not public.is_account_member(v_account_id) then
    raise exception 'Not authorized for this course';
  end if;

  if not exists (select 1 from public.invitations where id = p_invitation_id and account_id = v_account_id) then
    raise exception 'Invitation does not belong to this account';
  end if;

  insert into public.enrollments (account_id, course_id, invitation_id, status, granted_by, revoked_at)
  values (v_account_id, p_course_id, p_invitation_id, 'active', auth.uid(), null)
  on conflict (course_id, invitation_id) do update
    set status = 'active', granted_by = auth.uid(), revoked_at = null
  returning * into v_enrollment;

  return v_enrollment;
end;
$$;

-- Revokes a student's access to a course. This is enforced at the data
-- layer (RLS reads has_active_enrollment), not just hidden in the UI.
create function public.revoke_course_access(p_enrollment_id uuid)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_enrollment public.enrollments;
begin
  select account_id into v_account_id from public.enrollments where id = p_enrollment_id;

  if v_account_id is null or not public.is_account_member(v_account_id) then
    raise exception 'Not authorized for this enrollment';
  end if;

  update public.enrollments
  set status = 'revoked', revoked_at = now()
  where id = p_enrollment_id
  returning * into v_enrollment;

  return v_enrollment;
end;
$$;
