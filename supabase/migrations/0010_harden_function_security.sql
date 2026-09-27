-- Pin search_path on the trigger helper (fixes function_search_path_mutable).
alter function public.set_updated_at() set search_path = pg_catalog, public;

-- Postgres grants EXECUTE to the PUBLIC pseudo-role by default, which
-- includes anon/authenticated regardless of per-role revokes. Revoke from
-- PUBLIC explicitly, then re-grant only what each role actually needs.
-- Internal helpers and the auth trigger function must never be callable
-- directly over the REST API.
revoke execute on function public.is_account_member(uuid) from public;
revoke execute on function public.has_active_enrollment(uuid) from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.set_updated_at() from public;

-- The remaining RPCs are meant to be called by signed-in clients only; each
-- one enforces its own is_account_member()/ownership check internally.
revoke execute on function public.add_student(uuid, text, text) from public;
revoke execute on function public.create_creator_account(text) from public;
revoke execute on function public.grant_course_access(uuid, uuid) from public;
revoke execute on function public.revoke_course_access(uuid) from public;

grant execute on function public.add_student(uuid, text, text) to authenticated;
grant execute on function public.create_creator_account(text) to authenticated;
grant execute on function public.grant_course_access(uuid, uuid) to authenticated;
grant execute on function public.revoke_course_access(uuid) to authenticated;
