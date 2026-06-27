-- supabase/migrations/00008_rls_policies.sql

-- Enable RLS on all tables
ALTER TABLE public.user_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aws_accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_actuals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_policies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_findings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_cache            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_actions     ENABLE ROW LEVEL SECURITY;

-- ── user_profiles ──────────────────────────────────────────────────────────
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- ── aws_accounts ────────────────────────────────────────────────────────────
CREATE POLICY "Users see own accounts"
  ON public.aws_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own accounts"
  ON public.aws_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own accounts"
  ON public.aws_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own accounts"
  ON public.aws_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- ── budgets ─────────────────────────────────────────────────────────────────
CREATE POLICY "Users manage own budgets"
  ON public.budgets FOR ALL
  USING (auth.uid() = user_id);

-- ── budget_actuals ──────────────────────────────────────────────────────────
CREATE POLICY "Users see actuals for own budgets"
  ON public.budget_actuals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_id AND b.user_id = auth.uid()
    )
  );

-- ── audit_logs: READ only, no UPDATE or DELETE ever ─────────────────────────
CREATE POLICY "Users see own audit logs"
  ON public.audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- No UPDATE or DELETE policy = blocked for all users (append-only)

-- ── compliance_policies ─────────────────────────────────────────────────────
CREATE POLICY "Users manage own policies or see builtins"
  ON public.compliance_policies FOR SELECT
  USING (auth.uid() = user_id OR is_builtin = true);

CREATE POLICY "Users insert own policies"
  ON public.compliance_policies FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_builtin = false);

CREATE POLICY "Users update own policies"
  ON public.compliance_policies FOR UPDATE
  USING (auth.uid() = user_id AND is_builtin = false);

-- ── cost_cache ──────────────────────────────────────────────────────────────
CREATE POLICY "Users see cost cache for own accounts"
  ON public.cost_cache FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.aws_accounts a
      WHERE a.id = account_id AND a.user_id = auth.uid()
    )
  );

-- ── scheduled_actions ───────────────────────────────────────────────────────
CREATE POLICY "Users manage own scheduled actions"
  ON public.scheduled_actions FOR ALL
  USING (auth.uid() = user_id);
