-- is_account_member() and has_active_enrollment() are invoked from inside
-- RLS USING/WITH CHECK expressions on courses/lessons/videos/invitations/
-- enrollments/lesson_progress. Postgres requires the querying role to hold
-- EXECUTE on any function referenced by a policy, even a SECURITY DEFINER
-- one -- SECURITY DEFINER only changes the privileges *while it runs*, it
-- does not waive the caller's EXECUTE check to invoke it in the first place.
-- 0010 revoked EXECUTE from `authenticated` to silence a lint about them
-- being callable directly over the REST API, which broke RLS for every real
-- signed-in user. Anonymous callers still can't reach them (every table's
-- RLS denies anon by default), so this only restores what authenticated
-- users always needed.
grant execute on function public.is_account_member(uuid) to authenticated;
grant execute on function public.has_active_enrollment(uuid) to authenticated;
