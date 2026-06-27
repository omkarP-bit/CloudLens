-- supabase/migrations/00007_scheduled_actions.sql

CREATE TABLE public.scheduled_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES public.aws_accounts(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     TEXT NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('STOP', 'START', 'TERMINATE', 'REBOOT')),
  cron_expression TEXT NOT NULL,                             -- standard cron: '0 20 * * 1-5'
  timezone        TEXT NOT NULL DEFAULT 'UTC',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  last_run_status TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
