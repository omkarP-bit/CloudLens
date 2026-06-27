-- supabase/migrations/00002_aws_accounts.sql

CREATE TABLE public.aws_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alias               TEXT NOT NULL,                         -- human label, e.g. "Prod Account"
  aws_account_id      TEXT NOT NULL,                         -- 12-digit AWS account ID (plaintext)
  role_arn            TEXT NOT NULL,                         -- ARN plaintext (not sensitive)

  -- ENCRYPTED FIELDS (AES-256-GCM ciphertext stored as TEXT)
  -- Decrypted only inside the API server, never in the DB or client
  encrypted_access_key_id      TEXT,                         -- AWS Access Key ID (encrypted)
  encrypted_secret_access_key  TEXT,                         -- AWS Secret Access Key (encrypted)
  encrypted_session_token      TEXT,                         -- STS session token if applicable (encrypted)
  encryption_key_id            TEXT NOT NULL,                -- KMS key ID used to encrypt this row's DEK
  encrypted_dek                TEXT NOT NULL,                -- Encrypted Data Encryption Key (envelope encryption)

  credential_type     TEXT NOT NULL DEFAULT 'iam_user'
                        CHECK (credential_type IN ('iam_user', 'sts_assume_role', 'sts_session')),
  regions             TEXT[] NOT NULL DEFAULT '{}',          -- allowed regions for this account
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'active', 'invalid', 'expired')),
  last_validated_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_aws_accounts_user_id ON public.aws_accounts(user_id);
