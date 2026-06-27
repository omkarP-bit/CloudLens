-- supabase/migrations/00006_cost_cache.sql

CREATE TABLE public.cost_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL REFERENCES public.aws_accounts(id) ON DELETE CASCADE,
  cache_key    TEXT NOT NULL,                                -- e.g. 'monthly:2026-06:by_service'
  data         JSONB NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, cache_key)
);

CREATE INDEX idx_cost_cache_expires ON public.cost_cache(expires_at);
