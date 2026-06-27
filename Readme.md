<div align="center">

# ☁️ CloudLens — AWS FinOps Platform

**A unified AWS cost, compliance, and control platform.**
Connect your AWS accounts. See everything. Control everything. Secure by default.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E)](https://supabase.com)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green)](https://nodejs.org/)
[![npm](https://img.shields.io/badge/npm-@yourorg%2Ffinops--sdk-red)](https://npmjs.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Live Demo](#) · [Documentation](#) · [npm Library](#npm-library) · [Report Bug](issues) · [Request Feature](issues)

---

</div>

## Table of Contents

- [What is CloudLens?](#what-is-cloudlens)
- [Why We Built It This Way](#why-we-built-it-this-way)
- [Features](#features)
  - [Core Features](#core-features)
  - [Advanced Features](#advanced-features)
- [How It Works](#how-it-works)
  - [System Architecture](#system-architecture)
  - [Credential & Encryption Flow](#credential--encryption-flow)
  - [Data Flow](#data-flow)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development Setup](#local-development-setup)
  - [Environment Variables](#environment-variables)
- [npm Library](#npm-library)
- [Security Model](#security-model)
- [Architecture Decision Records (ADRs)](#architecture-decision-records-adrs)
  - [ADR-001: Supabase as the Sole Database Layer](#adr-001-supabase-as-the-sole-database-layer)
  - [ADR-002: Application-Layer Encryption Before DB Write](#adr-002-application-layer-encryption-before-db-write)
  - [ADR-003: AWS KMS for Envelope Encryption](#adr-003-aws-kms-for-envelope-encryption)
  - [ADR-004: Fastify over Express](#adr-004-fastify-over-express)
  - [ADR-005: No ORM — Raw SQL Migrations via Supabase CLI](#adr-005-no-orm--raw-sql-migrations-via-supabase-cli)
  - [ADR-006: Monorepo with Turborepo](#adr-006-monorepo-with-turborepo)
  - [ADR-007: Supabase Row-Level Security for Tenant Isolation](#adr-007-supabase-row-level-security-for-tenant-isolation)
  - [ADR-008: STS AssumeRole Preferred over Long-Lived IAM Keys](#adr-008-sts-assumerole-preferred-over-long-lived-iam-keys)
  - [ADR-009: BullMQ for Background Jobs](#adr-009-bullmq-for-background-jobs)
  - [ADR-010: xterm.js + socket.io for Browser Terminal](#adr-010-xtermjs--socketio-for-browser-terminal)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## What is CloudLens?

CloudLens is an open-source **AWS FinOps platform** that gives engineering and finance teams a single control plane over their AWS infrastructure costs, budgets, running services, and compliance posture — without ever leaving their browser.

You connect your AWS account once (via ARN + credentials or STS role). CloudLens does the rest:

- Shows you **what you're spending and why**
- Shows you **what's running across every region**
- Lets you **set budgets and get alerted** before you overspend
- Lets you **stop, start, or terminate resources** safely with compliance guardrails
- Enforces **security policies** on every action
- Gives you a **browser-based AWS CLI** for power users

It ships as two things: a **hosted web dashboard** and a **publishable npm library** (`@yourorg/finops-sdk`) so teams can embed FinOps capabilities directly into their own tooling and CI/CD pipelines.

> **Security first.** AWS credentials are encrypted with AES-256-GCM at the application layer using envelope encryption via AWS KMS — before a single byte reaches the database. Supabase only ever stores ciphertext.

---

## Why We Built It This Way

Most AWS cost tools are either:
- **Too simple** — just a Cost Explorer wrapper with no action capability
- **Too expensive** — enterprise SaaS locked behind $50k/year contracts
- **Too insecure** — storing cloud credentials in plaintext or with weak encryption

CloudLens is designed to close that gap. The architecture answers three questions:

**1. How do we store AWS credentials without ever risking exposure?**
Envelope encryption. Each account's credentials are encrypted with a per-row Data Encryption Key (DEK). That DEK is itself encrypted by AWS KMS. The database holds only ciphertext. A full DB dump is useless without KMS access.

**2. How do we ensure one tenant can never see another tenant's data?**
Supabase Row-Level Security (RLS) enforces `user_id = auth.uid()` at the PostgreSQL level on every table. No matter what query is issued, the DB engine silently filters it. Not middleware. Not application code. The database itself.

**3. How do we make this embeddable, not just a dashboard?**
An npm library (`@yourorg/finops-sdk`) exposes every capability as typed TypeScript methods so teams can pull cost data, evaluate compliance policies, or control resources directly from their own scripts, CI pipelines, or internal tooling.

---

## Features

### Core Features

#### 💰 Cost & Usage Overview
Real-time and historical AWS spend visibility in one dashboard.

- Month-to-date (MTD), yesterday, and projected month-end KPI cards
- Daily cost trend chart (30 / 60 / 90 day toggle)
- Spend breakdown by service, region, and custom tag
- Top-10 cost drivers table with period-over-period change
- Live updates via Supabase Realtime — dashboard refreshes when background sync completes
- Custom date range picker for historical analysis

#### 🖥️ Services Inventory
A real-time view of every AWS resource running across every region.

- Discovers EC2, RDS, ECS, Lambda, S3, ElastiCache across all connected regions simultaneously
- Filter by: service type, region, account, resource state (running / stopped / pending)
- Resource detail drawer with full metadata, tags, and estimated monthly cost
- Regional map visualization showing resource density per AWS region
- Multi-account support — view resources across all connected accounts in one table

#### 📊 Budget Dashboard & Templates
Full budget lifecycle management with alerting.

- Create budgets scoped to: entire account, specific service, AWS region, or resource tag
- Support for Daily, Monthly, Quarterly, and Annual periods
- Configurable alert thresholds (default: 50%, 80%, 100%) with email and Slack delivery
- Budget progress bars with live actuals via Supabase Realtime subscriptions
- **Budget Templates** — save a budget configuration as a reusable template (e.g. "Dev Environment Monthly", "Team: Backend")
- Syncs bidirectionally with native AWS Budgets API

#### ⚙️ Resource Controls
Take action on resources safely — with compliance gates in front of every operation.

- **Stop / Start / Terminate / Reboot** any EC2, RDS, ECS service, or Lambda function
- Pre-action compliance check — every action is evaluated against active policies before execution
- Bulk actions — select multiple resources and apply one action
- **Scheduled Actions** — define cron-based schedules (e.g. "stop all dev EC2s at 8 PM on weekdays")
- Cost savings estimate shown before stopping/terminating a resource
- Every action is immutably written to the audit log in Supabase

#### 🛡️ Compliance Engine
Policy-as-code enforcement with a visual builder and built-in rule library.

- **Policy evaluation** runs before every resource control action — `ALLOW`, `DENY`, or `WARN`
- Built-in policy library:
  - Block terminate/delete on `Environment=Production` tagged resources
  - Block operations outside approved AWS regions
  - Flag public S3 buckets
  - Require MFA for destructive actions (Operator/Admin roles)
  - CIS AWS Foundations Benchmark v1.4 ruleset
- **Custom Policy Builder** — create rules via a form-based UI (no code needed)
- Compliance Scan — scan all resources and generate `PASS / FAIL / WARN` findings
- Compliance score card per framework (CIS, HIPAA, PCI-DSS, custom)
- Immutable audit log: every policy evaluation, API call, and resource action recorded
- Export findings and audit logs as CSV or PDF (stored in Supabase Storage, returned as signed URLs)

#### 🖱️ Cloud Terminal
A full browser-based AWS CLI — the same experience as your local terminal, in a browser tab.

- Built on xterm.js — full terminal emulation with keyboard shortcuts, copy/paste, and window resize
- AWS CLI runs in an isolated Docker container with your account's credentials auto-injected
- Command allowlist/denylist enforced by the compliance engine before execution
- Quick-access command palette for common operations
- All session I/O written to the audit log (credential strings scrubbed before logging)
- Sessions auto-terminate after 15 minutes of inactivity

---

### Advanced Features

| Feature | Description |
|---------|-------------|
| **Multi-Account Aggregation** | Manage AWS Organizations; consolidated billing across all member accounts |
| **Anomaly Detection** | Z-score analysis on daily cost deltas; Slack/email alert on spend spikes |
| **Cost Forecasting** | 30/60/90-day spend projections using historical regression on budget actuals |
| **RI & Savings Plans Advisor** | Recommends Reserved Instance or Savings Plan purchases based on usage patterns |
| **Tagging Governance** | Enforce mandatory tag policies; scan for untagged resources; auto-tag option |
| **Resource Rightsizing** | Flag underutilized EC2/RDS using CloudWatch metrics; suggest smaller instance types |
| **Chargeback Reports** | Allocate costs to teams/projects via tags; export PDF/CSV reports |
| **Drift Detection** | Save infrastructure baseline; alert on deviation from approved state |
| **RBAC** | Fine-grained roles: `viewer`, `analyst`, `operator`, `admin` enforced at DB and API level |
| **Terraform/CDK Export** | Export current AWS resource state as Terraform or CDK code |
| **Slack Bot** | `/finops costs today`, `/finops stop i-0abc123` directly from Slack |
| **SIEM Integration** | Export audit logs to Splunk, Datadog, or any webhook endpoint |

---

## How It Works

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                            │
│                                                                 │
│   React Web App (Vite + shadcn/ui + xterm.js)                  │
│   ├── Supabase JS SDK (auth session, realtime subscriptions)    │
│   └── REST calls → Fastify API (with Bearer token)             │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS + JWT (Supabase Auth token)
┌─────────────────────────▼───────────────────────────────────────┐
│                      FASTIFY API SERVER                         │
│                                                                 │
│  supabaseAuth middleware → verify JWT via supabaseAdmin         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ Cost Explorer│  │ AWS Services │  │ Compliance Engine  │   │
│  │ Controller   │  │ Controller   │  │ Controller         │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘   │
│         │                 │                    │                │
│  ┌──────▼─────────────────▼────────────────────▼───────────┐   │
│  │              Encryption Service Layer                    │   │
│  │  getDecryptedCredentials(accountId)                      │   │
│  │  → fetch encrypted_dek from Supabase                     │   │
│  │  → KMS.Decrypt(encrypted_dek) → DEK in memory           │   │
│  │  → AES-256-GCM decrypt ciphertext → plaintext creds      │   │
│  │  → dek.fill(0) (wipe from memory)                       │   │
│  └──────┬────────────────────────────────────────────────────  │
│         │ plaintext credentials (in-memory only)              │
│  ┌──────▼──────────────────────────────────────────────────┐   │
│  │              AWS SDK v3 Calls                            │   │
│  │  CostExplorer / EC2 / RDS / ECS / Lambda / Budgets …    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  BullMQ Jobs (cost sync, anomaly detection, scheduled actions)  │
└────────┬───────────────────────┬────────────────────────────────┘
         │                       │
┌────────▼──────────┐   ┌────────▼──────────────────────────────┐
│   SUPABASE        │   │   AWS INFRASTRUCTURE                  │
│                   │   │                                        │
│  PostgreSQL DB    │   │  ┌─────────┐  ┌──────┐  ┌─────────┐  │
│  ├─ RLS on all    │   │  │   KMS   │  │ STS  │  │  Cost   │  │
│    tables         │   │  │ CMK key │  │      │  │Explorer │  │
│  Supabase Auth    │   │  └─────────┘  └──────┘  └─────────┘  │
│  Realtime         │   │                                        │
│  Storage          │   │  EC2  RDS  ECS  Lambda  S3  …         │
│  Edge Functions   │   └────────────────────────────────────────┘
└───────────────────┘
```

### Credential & Encryption Flow

Every AWS account connected to CloudLens has its credentials encrypted using **envelope encryption** before they touch the database.

```
SAVE CREDENTIALS
─────────────────────────────────────────────────────────────────
User submits: accessKeyId + secretAccessKey
        │
        ▼
API Server generates a random 256-bit Data Encryption Key (DEK)
        │
        ├─── AES-256-GCM encrypt(accessKeyId,     DEK) → ciphertext_1
        ├─── AES-256-GCM encrypt(secretAccessKey, DEK) → ciphertext_2
        │
        ├─── AWS KMS.GenerateDataKey() → encrypted_dek (KMS wraps the DEK)
        │
        ▼
Supabase INSERT:
  encrypted_access_key_id      = ciphertext_1   ← never plaintext
  encrypted_secret_access_key  = ciphertext_2   ← never plaintext
  encrypted_dek                = encrypted_dek  ← KMS-encrypted
  encryption_key_id            = KMS CMK ARN
        │
        ▼
DEK wiped from memory: dek.fill(0)


RETRIEVE CREDENTIALS (for AWS SDK call)
─────────────────────────────────────────────────────────────────
Supabase SELECT: encrypted_access_key_id, encrypted_secret_access_key, encrypted_dek
        │
        ▼
AWS KMS.Decrypt(encrypted_dek) → DEK (in-memory only)
        │
        ├─── AES-256-GCM decrypt(ciphertext_1, DEK) → accessKeyId
        ├─── AES-256-GCM decrypt(ciphertext_2, DEK) → secretAccessKey
        │
        ▼
AWS SDK call made with plaintext credentials
        │
        ▼
DEK wiped from memory: dek.fill(0)
Plaintext credentials never logged, never returned to client
```

### Data Flow

```
Browser                  API Server              Supabase              AWS
───────                  ──────────              ────────              ───
  │  GET /api/costs/summary  │                       │                  │
  │─────────────────────────►│                       │                  │
  │                          │  SELECT cost_cache    │                  │
  │                          │  WHERE cache_key=...  │                  │
  │                          │  AND expires_at>NOW() │                  │
  │                          │──────────────────────►│                  │
  │                          │  cache HIT → return   │                  │
  │                          │◄──────────────────────│                  │
  │  200 { costs: [...] }    │                       │                  │
  │◄─────────────────────────│                       │                  │
  │                          │                       │                  │
  │  [background BullMQ job every 6h]                │                  │
  │                          │  getDecryptedCreds()  │                  │
  │                          │──────────────────────►│                  │
  │                          │  SELECT encrypted_*   │                  │
  │                          │◄──────────────────────│                  │
  │                          │  KMS.Decrypt(DEK)     │                  │
  │                          │──────────────────────────────────────►  │
  │                          │◄──────────────────────────────────────  │
  │                          │  CostExplorer.getCostAndUsage()          │
  │                          │─────────────────────────────────────────►│
  │                          │◄─────────────────────────────────────────│
  │                          │  UPSERT cost_cache    │                  │
  │                          │──────────────────────►│                  │
  │  Realtime PUSH           │                       │                  │
  │◄─────────────────────────────────────────────────│                  │
  │  (dashboard auto-updates)│                       │                  │
```

---

## Tech Stack

### Frontend

| | Technology | Why |
|--|-----------|-----|
| Framework | React 18 + TypeScript | Industry standard; large ecosystem; excellent type safety |
| Build | Vite | Fastest dev server and build times in class |
| State | Zustand | Minimal boilerplate; scales well for mid-size apps |
| UI | shadcn/ui + Tailwind CSS | Unstyled primitives give full design control; no fighting a component library |
| Charts | Recharts + Apache ECharts | Recharts for simple charts; ECharts for complex region maps |
| Terminal | xterm.js | Same terminal emulator used by VS Code |
| Realtime | `@supabase/supabase-js` | Native Postgres change subscriptions; no extra WebSocket infrastructure |
| Data Fetching | TanStack Query | Stale-while-revalidate caching; deduplication; background refetch |
| Auth | Supabase JS SDK | Session management, OAuth flows, MFA handled out of the box |

### Backend

| | Technology | Why |
|--|-----------|-----|
| Runtime | Node.js 20 + TypeScript | Native ESM; fast startup; strong AWS SDK support |
| Framework | Fastify | 2× throughput vs Express on equivalent hardware; schema-first validation |
| Database | Supabase (PostgreSQL) | See ADR-001 |
| Auth verification | `supabaseAdmin.auth.getUser()` | Server-side JWT verification; no custom auth logic |
| AWS SDK | AWS SDK v3 | Modular; tree-shakeable; supports STS + all required services |
| Encryption | AES-256-GCM + AWS KMS | See ADR-002 and ADR-003 |
| Job Queue | BullMQ (Redis) | See ADR-009 |
| Terminal | socket.io + xterm.js | See ADR-010 |
| Validation | Zod | Runtime schema validation with TypeScript inference |

### Infrastructure

| | Technology |
|--|-----------|
| Monorepo | Turborepo + pnpm workspaces |
| Containers | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| IaC | Terraform |
| Secrets | AWS Secrets Manager |

---

## Project Structure

```
finops-platform/
├── apps/
│   ├── web/                        # React dashboard
│   │   └── src/
│   │       ├── components/         # common/, layout/, charts/, terminal/
│   │       ├── pages/              # Dashboard, Services, Budgets, Controls, Compliance, Terminal
│   │       ├── lib/supabase.ts     # Browser Supabase client (anon key)
│   │       ├── hooks/              # useAWS, useCost, useBudgets, useTerminal
│   │       └── store/              # Zustand state slices
│   │
│   └── api/                        # Fastify API server
│       └── src/
│           ├── config/
│           │   ├── supabase.ts     # Admin client (service role key — server only)
│           │   └── env.ts          # Zod-validated environment loader
│           ├── services/
│           │   ├── encryption/     # cipher.service.ts, kms.service.ts, field-crypto.ts
│           │   ├── supabase/       # accounts.repo.ts, budgets.repo.ts, audit.repo.ts
│           │   ├── aws/            # cost-explorer, ec2, rds, ecs, lambda, iam, cloudtrail
│           │   ├── compliance/     # policy-engine, validator, audit-log
│           │   └── terminal/       # shell.service.ts, websocket.service.ts
│           ├── middleware/
│           │   ├── supabase-auth.middleware.ts
│           │   ├── rbac.middleware.ts
│           │   └── compliance-guard.middleware.ts
│           └── jobs/               # BullMQ workers: cost-sync, anomaly-detection, scheduled-actions
│
├── packages/
│   ├── finops-sdk/                 # @yourorg/finops-sdk (npm library)
│   ├── ui-components/              # Shared React components
│   └── shared-types/               # Shared TypeScript interfaces
│
├── supabase/                       # Supabase CLI project
│   ├── migrations/                 # Versioned SQL files — the only source of truth for schema
│   │   ├── 00001_init_users.sql
│   │   ├── 00002_aws_accounts.sql
│   │   ├── 00003_budgets.sql
│   │   ├── 00004_audit_logs.sql
│   │   ├── 00005_compliance_policies.sql
│   │   ├── 00006_cost_cache.sql
│   │   ├── 00007_scheduled_actions.sql
│   │   └── 00008_rls_policies.sql
│   ├── seed.sql
│   └── functions/                  # Supabase Edge Functions
│       ├── budget-alert/
│       └── cost-sync-webhook/
│
├── infra/
│   ├── terraform/
│   └── docker/
│
├── turbo.json
├── pnpm-workspace.yaml
└── README.md                       # This file
```

---

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20.x+ | Runtime |
| pnpm | 9.x+ | Package manager |
| Docker | 24.x+ | Local Supabase stack |
| Supabase CLI | Latest | DB migrations and local dev |
| AWS CLI | v2 | (Optional) KMS setup |

```bash
# Install pnpm
npm install -g pnpm

# Install Supabase CLI
npm install -g supabase

# Verify Docker is running
docker info
```

### Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/yourorg/cloudlens.git
cd cloudlens

# 2. Install all workspace dependencies
pnpm install

# 3. Start local Supabase (PostgreSQL + Auth + Storage + Studio)
supabase start
# Supabase Studio available at: http://localhost:54323
# API URL:                       http://localhost:54321
# Anon key and service_role key printed to terminal

# 4. Apply all SQL migrations
supabase db push

# 5. Seed development data
supabase db seed  (or: psql $(supabase db url) < supabase/seed.sql)

# 6. Copy environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# → Fill in values from `supabase status` output and your AWS KMS key

# 7. Start everything
pnpm dev
# Web:  http://localhost:5173
# API:  http://localhost:8000
```

### Environment Variables

**`apps/api/.env`**

```bash
# Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # From: supabase status

# Encryption — AWS KMS
KMS_REGION=us-east-1
KMS_CMK_ARN=arn:aws:kms:us-east-1:123456789012:key/mrk-xxxx

# Jobs
REDIS_URL=redis://localhost:6379

# Server
PORT=8000
NODE_ENV=development
```

**`apps/web/.env`**

```bash
# Supabase (browser-safe — anon key only)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJ...            # From: supabase status

# API
VITE_API_URL=http://localhost:8000
```

> **Security note:** `SUPABASE_SERVICE_ROLE_KEY` bypasses Row-Level Security. It is for the API server only and must never be exposed to the browser or committed to source control.

---

## npm Library

CloudLens ships a standalone npm library so teams can embed FinOps capabilities into their own tooling, CI/CD pipelines, or internal dashboards.

### Install

```bash
npm install @yourorg/finops-sdk
# or
pnpm add @yourorg/finops-sdk
```

### Usage

```typescript
import { FinOpsClient } from '@yourorg/finops-sdk';

const client = new FinOpsClient({
  accountId: '123456789012',
  roleArn:   'arn:aws:iam::123456789012:role/FinOpsRole',
  apiKey:    'your-cloudlens-api-key',
  region:    'us-east-1',
});

// ── Cost & Usage ──────────────────────────────────────
const summary = await client.costs.getSummary({ period: 'MONTHLY' });
console.log(summary.totalMtd);       // "$3,412.88"
console.log(summary.projectedMonthEnd); // "$5,200.00"

const trends = await client.costs.getTrends({ days: 30 });
// [{ date: '2026-06-01', amount: 110.22 }, ...]

const breakdown = await client.costs.getBreakdown({ groupBy: 'SERVICE' });
// [{ name: 'Amazon EC2', amount: 1820.50 }, ...]

// ── Services Inventory ────────────────────────────────
const services = await client.services.list({
  region: 'us-east-1',
  type:   'EC2',
  state:  'running',
});
// [{ id: 'i-0abc123', type: 't3.medium', state: 'running', ... }]

// ── Budgets ───────────────────────────────────────────
const budgets = await client.budgets.list();
const newBudget = await client.budgets.create({
  name:        'Backend Team Monthly',
  scopeType:   'tag',
  scopeValue:  'team=backend',
  period:      'MONTHLY',
  limitAmount: 5000,
  alertThresholds: [50, 80, 100],
});

// ── Compliance Gate ───────────────────────────────────
const check = await client.compliance.evaluateAction({
  type:       'TERMINATE',
  resourceId: 'i-0abc123',
  region:     'us-east-1',
});

if (check.result === 'DENY') {
  console.error('Action blocked:', check.reason);
  // "Blocked: resource tagged Environment=Production"
} else {
  // ── Resource Controls ─────────────────────────────
  await client.controls.stop('EC2', 'i-0abc123');
  // or
  await client.controls.terminate('EC2', 'i-0abc123');
}

// ── Audit Log ─────────────────────────────────────────
const log = await client.compliance.getAuditLog({
  limit: 50,
  from:  '2026-06-01',
});

// ── Terminal Session ──────────────────────────────────
const session = await client.terminal.createSession();
// Connect session.wsUrl with your own xterm.js instance
```

### Available Modules

| Module | Methods |
|--------|---------|
| `client.costs` | `getSummary()`, `getTrends()`, `getBreakdown()`, `getTopServices()` |
| `client.services` | `list()`, `getById()` |
| `client.budgets` | `list()`, `create()`, `update()`, `delete()`, `getTemplates()` |
| `client.controls` | `stop()`, `start()`, `terminate()`, `reboot()`, `schedule()` |
| `client.compliance` | `evaluateAction()`, `getAuditLog()`, `runScan()`, `getPolicies()` |
| `client.terminal` | `createSession()` |

---

## Security Model

| Layer | What We Do |
|-------|-----------|
| **Credentials at rest** | AES-256-GCM ciphertext only — Supabase never holds plaintext |
| **Key management** | AWS KMS Customer Master Key wraps per-row DEKs (envelope encryption) |
| **DEK lifetime** | Generated in memory, used, wiped with `buf.fill(0)` — never persisted as plaintext |
| **Auth** | Supabase Auth issues JWTs; API verifies every request with `supabaseAdmin.auth.getUser()` |
| **Tenant isolation** | Supabase RLS enforces `user_id = auth.uid()` at PostgreSQL level on all 9 tables |
| **Audit log** | `audit_logs` has no RLS UPDATE/DELETE policy — append-only at the database engine |
| **Terminal** | Sandboxed Docker container per session; credentials in env vars, not CLI args |
| **Logs** | Middleware scrubs `AKIA*`, `aws_secret`, `session_token` patterns before any log write |
| **Rate limiting** | 100 req/min per user; 10 req/min for destructive actions (Redis-backed) |
| **Transport** | TLS enforced on all connections; Supabase enforces SSL on PostgreSQL connections |
| **Compliance gate** | Policy engine evaluated before every resource action — `DENY` blocks execution |

---

## Architecture Decision Records (ADRs)

ADRs capture the significant architectural decisions made during this project — what was decided, why, and what was rejected. They are immutable records; once accepted, an ADR is superseded (not edited) if the decision changes.

---

### ADR-001: Supabase as the Sole Database Layer

**Status:** Accepted
**Date:** 2026-01

#### Context

We needed a persistent storage layer for: user accounts, encrypted AWS credentials, budgets, cost cache, audit logs, compliance findings, and scheduled actions. We also needed built-in authentication, tenant isolation, and real-time data push to the browser.

The obvious options were:

- **Self-managed PostgreSQL + Prisma + custom auth** — full control, but significant undifferentiated infrastructure work (auth, realtime, storage all need separate solutions)
- **MongoDB Atlas** — document-native, good managed offering, but lacks native row-level security and transactional integrity for audit logs
- **Supabase** — managed PostgreSQL with built-in Auth, Realtime, Storage, Edge Functions, Row-Level Security, and a local dev Docker stack

#### Decision

Use **Supabase** as the sole database and auth layer. It provides every persistent-storage feature the platform needs:

- PostgreSQL — reliable, transactional, all SQL features available
- Supabase Auth — email/password, OAuth, MFA, magic link, JWT issuance
- Row-Level Security — tenant isolation enforced at the DB engine
- Realtime — Postgres change subscriptions for live dashboard updates
- Storage — S3-compatible bucket for report PDFs and exports
- Edge Functions — lightweight serverless for budget alert webhooks
- Supabase CLI — migration management via versioned SQL files

All of this replaces: a custom auth service, a Redis Pub/Sub realtime layer, an S3 integration, a serverless function platform, and a migration tool — without giving up any PostgreSQL features.

#### Consequences

- **Good:** Dramatic reduction in infrastructure surface area
- **Good:** Auth is production-grade out of the box (OAuth, MFA, email confirmation)
- **Good:** RLS is enforced at the engine — it cannot be bypassed by application bugs
- **Good:** Local dev works with `supabase start` — full Docker stack in one command
- **Trade-off:** Vendor dependency on Supabase Cloud for production; mitigated by using standard PostgreSQL under the hood (self-hostable via Supabase open-source)
- **Rejected:** Prisma ORM — see ADR-005

---

### ADR-002: Application-Layer Encryption Before DB Write

**Status:** Accepted
**Date:** 2026-01

#### Context

Users connect AWS accounts by providing Access Key ID and Secret Access Key (or STS tokens). These credentials can access customer AWS infrastructure and billing. If they were stored in plaintext — or only protected by Supabase's access controls — a database breach, a misconfigured RLS policy, or a compromised Supabase service role key would directly expose every connected customer's AWS account.

We evaluated:

- **Supabase Vault** — Supabase's built-in secrets manager. Stores secrets encrypted at rest in a `vault.secrets` table. Encryption key managed by Supabase.
- **Application-layer encryption** — encrypt in the API server before writing to the DB. Supabase never sees plaintext. Encryption key managed by us (AWS KMS).
- **Plaintext with RLS** — rely entirely on RLS for isolation. Not acceptable for credentials of this sensitivity.

#### Decision

Encrypt AWS credentials **at the application layer** before any Supabase write. Each sensitive field (Access Key ID, Secret Access Key, STS token) is encrypted with AES-256-GCM using a per-row Data Encryption Key (DEK) before `INSERT`. Supabase stores only ciphertext.

Supabase Vault was rejected because:

1. Encryption key management is opaque — the key is controlled by Supabase, not by us
2. A breach of the Supabase Vault key would expose all secrets
3. Our model requires per-row DEKs (different key per account) which Vault's API does not naturally support

With application-layer encryption:
- A full DB dump yields only ciphertext — useless without KMS access
- Key policy is under our control (AWS KMS IAM policies)
- Rotation is possible per-row independently
- The API server is the only component that ever touches plaintext credentials

#### Consequences

- **Good:** DB breach reveals nothing actionable
- **Good:** Supabase team or any DB-level access sees only ciphertext
- **Good:** Per-row key isolation — compromise of one account's credentials doesn't affect others
- **Trade-off:** Every credential read requires a KMS API call (adds ~30–80ms latency); acceptable because credential reads are infrequent and cached in the AWS SDK client per request
- **Trade-off:** Slightly more complex repo code (`cipher.service.ts`, `kms.service.ts`); mitigated by encapsulating all crypto in two files with thorough tests

---

### ADR-003: AWS KMS for Envelope Encryption

**Status:** Accepted
**Date:** 2026-01

#### Context

Having decided on application-layer encryption (ADR-002), we needed to decide where the encryption key itself lives.

Options:

- **Hardcoded key in environment variable** — simple but catastrophic if the env file leaks; no rotation; no audit trail on key use
- **AWS Secrets Manager** — stores the key; better than env var but still means a static key that if retrieved decrypts everything
- **AWS KMS with envelope encryption** — KMS holds a Customer Master Key (CMK); we use `GenerateDataKey` to get a per-row DEK; the DEK encrypts the credential; KMS-encrypted DEK is stored in DB; the CMK never leaves KMS

#### Decision

Use **AWS KMS envelope encryption**:

1. One KMS Customer Master Key (CMK) per environment (dev/staging/prod)
2. On account creation: `KMS.GenerateDataKey()` returns a 256-bit DEK in plaintext (for immediate use) and as KMS-encrypted ciphertext (for storage)
3. The plaintext DEK encrypts the credentials in-memory; then is wiped
4. The KMS-encrypted DEK is stored alongside the ciphertext in Supabase
5. On credential retrieval: `KMS.Decrypt(encrypted_dek)` → DEK → decrypt credentials → wipe DEK

The CMK never leaves KMS. KMS enforces IAM policy — only the API server's IAM role can call `Decrypt`. Every KMS call is logged in AWS CloudTrail automatically.

#### Consequences

- **Good:** CMK never exposed — even if the entire API server is compromised, the CMK stays in KMS
- **Good:** Per-row DEKs — revoking one account's credentials is possible by deleting its `encrypted_dek` row; the KMS key remains intact for all other accounts
- **Good:** CloudTrail gives a full audit log of every decryption event — who, when, from which IP
- **Good:** KMS automatic key rotation can be enabled (annual); old encrypted DEKs remain decryptable during rotation window
- **Trade-off:** AWS KMS cost (~$0.03 per 10,000 API calls) — negligible at this scale
- **Trade-off:** Cold start on first credential use per API instance hits KMS; subsequent uses within request reuse the decrypted value in-memory for that request only

---

### ADR-004: Fastify over Express

**Status:** Accepted
**Date:** 2026-01

#### Context

We needed an HTTP server framework for the Node.js API. Express is the most familiar; Fastify is increasingly standard for new projects. Hono and Elysia were also considered.

Benchmarks (requests/sec, single-core, simple JSON route):
- Express 4: ~15,000 req/sec
- Fastify 4: ~30,000 req/sec
- Hono: ~35,000 req/sec

#### Decision

Use **Fastify**. Reasons:

1. **Performance** — 2× Express throughput on equivalent hardware. The API server handles concurrent multi-region AWS SDK calls per request (high-latency I/O); the framework overhead matters at scale
2. **Schema-first** — Fastify's JSON Schema validation on request/response is built-in; we would have needed Zod middleware on Express to achieve the same
3. **TypeScript** — first-class TypeScript support; decorators and plugin types are well-maintained
4. **Plugin ecosystem** — `@fastify/rate-limit`, `@fastify/cors`, `@fastify/helmet` are maintained by the Fastify core team
5. **Ecosystem maturity** — broadly adopted; not an experiment

Hono was considered but its ecosystem for plugins (rate limiting, WebSockets) is younger.

#### Consequences

- **Good:** Lower infrastructure cost at scale (fewer pods needed for same throughput)
- **Good:** Schema validation is a first-class citizen — invalid request shapes never reach controllers
- **Trade-off:** Steeper learning curve vs Express for developers new to Fastify; mitigated by good documentation and straightforward migration paths

---

### ADR-005: No ORM — Raw SQL Migrations via Supabase CLI

**Status:** Accepted
**Date:** 2026-01

#### Context

We originally scaffolded with Prisma. Prisma is a strong choice for greenfield projects because it generates a typed client from a schema file and handles migrations. We replaced it.

Reasons Prisma was removed:

1. **Supabase RLS** — Prisma has no first-class awareness of Supabase's Row-Level Security policies. RLS must be added in raw SQL. Having schema in `schema.prisma` and RLS in separate SQL files creates two sources of truth for the data model
2. **Supabase CLI migrations** — Supabase CLI generates and applies SQL migrations natively. Running both Prisma Migrate and Supabase CLI in the same project creates conflicting migration state
3. **Supabase-specific SQL** — triggers (for auto-creating user profiles on signup), custom functions (`handle_new_user`), and RLS policies are all native PostgreSQL SQL. Prisma cannot express these; they need to be in migration files anyway
4. **Type generation** — Supabase CLI can generate TypeScript types directly from the database schema: `supabase gen types typescript`. This gives us typed query results without Prisma's generated client

#### Decision

All database schema lives in `supabase/migrations/*.sql` files as **plain SQL**, managed exclusively by the Supabase CLI. Database interactions in the API use the `@supabase/supabase-js` Admin SDK — typed, but without an ORM abstraction layer.

Type safety is achieved via `supabase gen types typescript --local > packages/shared-types/src/db.types.ts`, run in CI on migration changes.

#### Consequences

- **Good:** Single source of truth — the SQL files in `supabase/migrations/` define everything: tables, indexes, triggers, functions, RLS policies
- **Good:** Local dev is `supabase start` + `supabase db push` — no separate migration tool
- **Good:** Full SQL power available — window functions, CTEs, custom aggregates — without fighting ORM abstractions
- **Good:** Generated types from live schema are always in sync
- **Trade-off:** More verbose repository queries (`.from('table').select('...').eq(...)`) vs Prisma's `db.table.findMany(where: {...})`; considered acceptable given the type safety from generated types
- **Rejected:** Drizzle ORM was evaluated as a lighter alternative to Prisma that supports raw SQL alongside typed queries, but the native Supabase SDK already provides typed access without requiring a third dependency

---

### ADR-006: Monorepo with Turborepo

**Status:** Accepted
**Date:** 2026-01

#### Context

The project ships three distinct packages that share code: `apps/web` (React), `apps/api` (Fastify), and `packages/finops-sdk` (npm library). They share TypeScript interfaces (`packages/shared-types`) and React components (`packages/ui-components`).

Options:
- **Three separate repos** — independent versioning, but cross-package changes require PRs across repos and manual version coordination
- **Yarn Workspaces / npm Workspaces** — basic monorepo tooling; no build caching
- **Turborepo + pnpm workspaces** — monorepo with task graph caching and parallel task execution

#### Decision

Use **Turborepo with pnpm workspaces**. Turborepo caches build outputs and only rebuilds packages whose source changed. In CI, a change to `apps/api` does not trigger a rebuild of `packages/finops-sdk` unless `shared-types` changed.

#### Consequences

- **Good:** Single PR for cross-cutting changes (e.g. a new field in `shared-types` surfaces broken usages in both `web` and `api` in the same build)
- **Good:** `pnpm dev` starts all apps in parallel with correct dependency order
- **Good:** Turborepo remote caching (via Vercel or self-hosted) means CI for unchanged packages completes in seconds
- **Trade-off:** Slightly more complex initial setup; mitigated by Turborepo's excellent docs and `create-turbo` scaffolding

---

### ADR-007: Supabase Row-Level Security for Tenant Isolation

**Status:** Accepted
**Date:** 2026-01

#### Context

CloudLens is a multi-tenant application — multiple users store their AWS account credentials and cost data in the same database. We needed to ensure one user's data is never accessible to another.

Options:
- **Application-layer filtering** — every query includes `WHERE user_id = currentUser.id`. Risk: any code path that omits this filter leaks data
- **Separate schema per tenant** — full isolation but operationally complex (schema migrations across N schemas)
- **Supabase Row-Level Security** — PostgreSQL enforces `user_id = auth.uid()` at the engine; cannot be bypassed by any query

#### Decision

Enable **RLS on all 9 tables** and define explicit policies for each operation (SELECT, INSERT, UPDATE, DELETE). The `audit_logs` table has SELECT-only policy — there is no UPDATE or DELETE policy, making it append-only at the database level.

The Supabase `service_role` key (used by the API server) bypasses RLS when needed for administrative operations (e.g. inserting audit log entries across users). This is intentional and controlled.

#### Consequences

- **Good:** Application bugs cannot leak cross-tenant data — the DB engine enforces isolation
- **Good:** `audit_logs` append-only guarantee is enforced at the storage layer, not application code
- **Good:** RLS policies are versioned alongside schema in `00008_rls_policies.sql`
- **Trade-off:** Queries using the `anon` key (browser) always go through RLS; queries using `service_role` (API server) bypass RLS — developers must consciously decide which client to use per operation
- **Mitigation:** Code review rule: `supabaseAdmin` (service role) only used in server-side repository files; web uses `supabase` (anon key) exclusively

---

### ADR-008: STS AssumeRole Preferred over Long-Lived IAM Keys

**Status:** Accepted
**Date:** 2026-01

#### Context

Users can connect their AWS account either with long-lived IAM User Access Keys or by granting CloudLens permission to assume an IAM Role in their account via AWS STS.

#### Decision

Recommend and default to **STS AssumeRole** as the connection method. In this model:

1. User creates an IAM Role in their AWS account with a trust policy allowing CloudLens's AWS account to assume it
2. User provides only the Role ARN (not a key)
3. CloudLens's API server calls `STS.AssumeRole(roleArn)` to get short-lived credentials (1-hour TTL)
4. Short-lived credentials are used for the API call; they expire automatically

Long-lived IAM User keys are still supported (for users who cannot create cross-account roles), but:
- They are flagged in the UI with a warning
- They trigger a 90-day rotation reminder
- They are encrypted with AES-256-GCM + KMS before storage (ADR-002)

#### Consequences

- **Good:** No long-lived secrets stored for AssumeRole users — the only stored value is the Role ARN, which is not sensitive
- **Good:** STS credentials expire in 1 hour; even if intercepted they have a very short window
- **Good:** IAM Role trust policies can be revoked instantly in the user's account, immediately cutting off CloudLens access without any changes on our side
- **Trade-off:** Requires users to create a cross-account IAM role — slightly more setup friction; mitigated by providing a CloudFormation / Terraform template that creates the role with the minimum required permissions

---

### ADR-009: BullMQ for Background Jobs

**Status:** Accepted
**Date:** 2026-01

#### Context

Several operations cannot block the HTTP request:
- Cost data sync from AWS Cost Explorer (slow; rate-limited by AWS)
- Anomaly detection on daily cost deltas
- Scheduled resource actions (cron-based stop/start)
- Budget actual sync

Options:
- **Setinterval / setTimeout in process** — no persistence; crashes lose queued jobs
- **Supabase Edge Functions on a timer** — viable for lightweight webhooks but cold-start latency and limited compute for heavy AWS SDK operations
- **BullMQ (Redis-backed)** — persistent job queue; retries; delayed jobs; cron scheduling; dead-letter queue; worker concurrency

#### Decision

Use **BullMQ** with a Redis backend for all background processing.

#### Consequences

- **Good:** Jobs survive API server restarts (persisted in Redis)
- **Good:** Built-in retry with exponential backoff for AWS API rate limit errors
- **Good:** `cron` job type for scheduled actions (`0 20 * * 1-5` = weekdays at 8 PM)
- **Good:** BullMQ Board (open-source UI) for visibility into job queues in dev
- **Trade-off:** Redis is another dependency; mitigated by using Redis Cloud (managed) in production and the existing Docker Compose Redis in development

---

### ADR-010: xterm.js + socket.io for Browser Terminal

**Status:** Accepted
**Date:** 2026-01

#### Context

The Cloud Terminal feature requires a fully functional terminal emulator in the browser that streams I/O to a server-side AWS CLI process in real time.

Options:
- **REST polling** — client posts command, polls for output. Poor UX; high latency; no streaming
- **Server-Sent Events (SSE)** — server → client streaming only; cannot stream bidirectional I/O
- **WebSocket** — full duplex; standard for terminal applications
- **socket.io** — WebSocket with fallbacks, rooms, reconnection handling

Terminal emulator options:
- **`<textarea>`** — no ANSI color support; no cursor control; not a real terminal
- **xterm.js** — battle-tested terminal emulator in the browser; used by VS Code, GitHub Codespaces, AWS CloudShell, and Google Cloud Shell

#### Decision

Use **xterm.js** for terminal rendering in the browser and **socket.io** for the bidirectional I/O channel. Server-side, a sandboxed Docker container runs AWS CLI with session credentials injected as environment variables. The socket.io server pipes `stdin`/`stdout`/`stderr` of the CLI subprocess to the WebSocket channel.

#### Consequences

- **Good:** Full terminal emulation — ANSI colors, cursor movement, interactive commands (e.g. `aws configure` prompts) all work
- **Good:** Familiar, proven stack (same as VS Code's terminal backend)
- **Good:** Credentials injected via environment variables, never via command arguments (which would appear in `ps aux` output)
- **Good:** socket.io handles reconnection — brief network drops don't kill the session
- **Trade-off:** Each terminal session needs a Docker container; container lifecycle management adds operational complexity; mitigated by hard session timeout (15 min idle) and container pool sizing in Kubernetes

---

## Deployment

### Development

```bash
supabase start     # local Supabase stack
pnpm dev           # all apps in parallel
```

### Production — Recommended Stack

```
Vercel            → apps/web (React static build)
Railway / Render  → apps/api (Fastify Docker container)
Supabase Cloud    → Database, Auth, Storage, Edge Functions (Pro plan with PITR)
Redis Cloud       → BullMQ job queue + rate limiting
AWS KMS           → Encryption key management
```

### Production — Kubernetes (EKS)

```bash
kubectl apply -f infra/k8s/
# Deploys: finops-web, finops-api (HPA 2–10 replicas), Redis
# Supabase Cloud is external — not self-hosted on K8s
```

### CI/CD

Every push to `main`:
1. `pnpm lint && pnpm typecheck` — ESLint + TypeScript
2. `pnpm test` — Vitest unit tests + MSW mocks
3. `supabase db push --linked` — apply any new migrations to staging Supabase project
4. Build and push Docker image for `apps/api`
5. Deploy web to Vercel (automatic on push)

Every tag `v*.*.*`:
1. All above
2. `pnpm publish --filter @yourorg/finops-sdk` — publish npm library

---

## Roadmap

- [x] Core cost & usage dashboard
- [x] Services inventory
- [x] Budget management
- [x] Resource controls (stop/start/terminate)
- [x] Compliance engine
- [x] Browser terminal
- [x] npm library (`@yourorg/finops-sdk`)
- [ ] Anomaly detection & spend alerts
- [ ] Cost forecasting (30/60/90 day)
- [ ] Rightsizing advisor
- [ ] Tagging governance
- [ ] Chargeback & showback reports
- [ ] AWS Organizations multi-account
- [ ] Slack bot
- [ ] Terraform/CDK export
- [ ] SIEM integration (Splunk / Datadog)

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

```bash
# Run tests
pnpm test

# Run a specific package
pnpm --filter @yourorg/finops-sdk test

# Add a new Supabase migration
supabase migration new <descriptive-name>
# Edit supabase/migrations/<timestamp>_<name>.sql
supabase db push
```

---

## License

MIT © 2026 Your Organization

---

<div align="center">

Built with ☁️ by engineers who were tired of surprise AWS bills.

**[⭐ Star this repo](https://github.com/yourorg/cloudlens)** if CloudLens helps your team.

</div>