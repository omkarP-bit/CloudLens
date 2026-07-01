-- supabase/migrations/00009_alert_notifications.sql

CREATE TABLE public.alert_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id       UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  threshold       NUMERIC(5,2) NOT NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('email', 'slack', 'webhook')),
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  period_date     DATE NOT NULL
);

CREATE INDEX idx_alert_notif_budget_period ON public.alert_notifications(budget_id, period_date, threshold);

CREATE TABLE public.notification_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id   UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL,
  recipient   TEXT,
  status      TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_msg   TEXT,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_log_budget ON public.notification_log(budget_id);
