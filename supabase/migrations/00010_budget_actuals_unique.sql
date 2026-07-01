-- supabase/migrations/00010_budget_actuals_unique.sql

ALTER TABLE public.budget_actuals
ADD CONSTRAINT budget_actuals_budget_period_unique
UNIQUE (budget_id, period_date);
