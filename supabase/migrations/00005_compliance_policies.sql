-- supabase/migrations/00005_compliance_policies.sql

CREATE TABLE public.compliance_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id      UUID REFERENCES public.aws_accounts(id),  -- NULL = applies to all accounts
  name            TEXT NOT NULL,
  description     TEXT,
  is_builtin      BOOLEAN NOT NULL DEFAULT false,            -- true = shipped with platform
  enabled         BOOLEAN NOT NULL DEFAULT true,
  framework       TEXT,                                      -- 'CIS', 'HIPAA', 'PCI-DSS', 'custom'
  rule_definition JSONB NOT NULL,                            -- JSON rule DSL
  action          TEXT NOT NULL CHECK (action IN ('ALLOW', 'DENY', 'WARN')),
  severity        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.compliance_findings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id   UUID NOT NULL REFERENCES public.compliance_policies(id),
  account_id  UUID NOT NULL REFERENCES public.aws_accounts(id),
  resource_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  region      TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL', 'WARN', 'SKIPPED')),
  detail      TEXT,
  scanned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
