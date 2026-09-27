-- Tracks whether the user finished the "Sou Criador / Sou Aluno" onboarding
-- choice, independent of whether they already have an account or an
-- enrollment yet (a brand new Student may have zero courses at first).
alter table public.profiles add column onboarding_completed boolean not null default false;
