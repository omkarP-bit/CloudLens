-- supabase/migrations/00004_audit_logs.sql

-- Audit log is APPEND-ONLY. RLS blocks UPDATE and DELETE for all roles.
CREATE TABLE public.audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id),           -- NULL for system actions
  account_id      UUID REFERENCES public.aws_accounts(id),
  action          TEXT NOT NULL,                             -- e.g. 'EC2:StopInstances'
  resource_type   TEXT,                                      -- 'EC2', 'RDS', etc.
  resource_id     TEXT,                                      -- AWS resource ARN or ID
  region          TEXT,
  policy_result   TEXT CHECK (policy_result IN ('ALLOW', 'DENY', 'WARN')),
  policy_reason   TEXT,
  request_ip      TEXT,
  user_agent      TEXT,
  metadata        JSONB DEFAULT '{}',                        -- extra context, never raw secrets
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index for fast lookups by user
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
