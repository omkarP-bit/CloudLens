-- supabase/migrations/00003_budgets.sql

CREATE TABLE public.budgets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES public.aws_accounts(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  scope_type      TEXT NOT NULL CHECK (scope_type IN ('account', 'service', 'tag', 'region')),
  scope_value     TEXT,                                      -- e.g. 'EC2', 'us-east-1', 'team=backend'
  period          TEXT NOT NULL CHECK (period IN ('DAILY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY')),
  limit_amount    NUMERIC(14, 4) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USD',
  alert_thresholds NUMERIC[] NOT NULL DEFAULT '{50, 80, 100}', -- percentage thresholds
  alert_channels  JSONB NOT NULL DEFAULT '{"email": true, "slack": false, "webhook": null}',
  is_template     BOOLEAN NOT NULL DEFAULT false,
  template_name   TEXT,
  aws_budget_id   TEXT,                                      -- synced AWS Budget ID
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.budget_actuals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id   UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,                                 -- first day of the period
  actual      NUMERIC(14, 4) NOT NULL,
  forecasted  NUMERIC(14, 4),
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budget_actuals_budget_id ON public.budget_actuals(budget_id);
