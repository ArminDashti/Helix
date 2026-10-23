# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary (equal priority):**

- **Business and data analysts** who ask natural-language questions against a connected warehouse, review grounded answers and charts, and reuse past runs from history.
- **IT and analytics administrators** who connect data sources and LLM providers, manage company users and access policies, maintain table documentation and agent/skill configuration, and operate the deployment.

**Situation:** Operators work inside a browser-based app (English or Persian UI) with live status for LLM, engine, and data source. Analysts need trustworthy answers without writing SQL; admins need control over connectors, access, and agent behavior.

## Product Purpose

Helix turns warehouse questions into **read-only, row-grounded** analysis reports and visualizations through a multi-agent pipeline. Success means analysts get correct, explainable answers (or explicit clarification/refusal) without mutating data; admins can configure connectors, models, and policies so those runs stay safe and auditable.

## Positioning

A **trustworthy analytics agent**, not a generic chat box: generated work is tied to **capped SELECT** execution against the configured database, with orchestration that validates access, sanitizes responses for privacy, and escalates ambiguity to the operator instead of guessing. Neighboring “chat with your data” tools that allow writes, unconstrained SQL, or ungrounded narrative cannot truthfully claim the same safety model.

## Operating Context

- **Monorepo:** `helix-api` (Django REST/SSE) and `helix-webui` (React + Vite).
- **Local stack:** Docker via `scripts/install-local-docker.ps1` — Web UI at http://127.0.0.1:5178/helix/, API at http://127.0.0.1:8173/ (see root `README.md`).
- **Agent pipeline:** Human → orchester → researcher → orchester → Human (`helix-api/backend/analytics/agents/registry.md`). Researcher uses read-only SQL tools; orchester handles goals, validation, packaging, access checks, and response privacy.
- **Core surfaces:** Analysis (prompt + run), Results, Logs, Skills, Agents, Table docs, Data source / DB explorer, Settings (LLM + DB), Admin (users and policies), Help (including Persian admin guide PDF).
- **Languages:** English and Persian (Farsi), including Jalali date scenarios in evaluation planning.
- **Evaluation discipline:** `evals/` — fixed question set; compare **results** not SQL; checks for clarify/refuse and schema allowlists (`evals/EVAL_PLAN.md`).

## Capabilities and Constraints

**Confirmed capabilities:**

- Natural-language analysis with SSE/streaming-style API interaction.
- Configurable LLM connectors (OpenCode Go, OpenRouter, OpenAI-compatible) and warehouse connectors (SQL Server, PostgreSQL; sample SQLite AdventureWorks for local/demo).
- Skills and agents editing; markdown knowledge seeded from analytics agents.
- Company branding hooks (company logo in layout); PWA-oriented copy for install/offline of saved pages.
- Result export/history and failure logs.

**Constraints:**

- **Read-only analytics:** Analysis path is SELECT-oriented; evaluation explicitly includes cases that must refuse writes or out-of-scope schemas.
- **Row caps and grounding:** Reports are expected to reflect fetched rows, not invented aggregates.
- **Two-way pipeline:** Researcher may return `fail` or `needs_input`; orchester may retry once, ask the operator, or stop.
- **App state:** Django metadata in SQLite by default in Docker; analytics DB is separately configured.

**Open product decisions:**

- **Deployment intent:** Undecided whether Helix is positioned primarily as general OSS, primarily single-enterprise internal, or both — do not invent a GTM or customer list until confirmed.

## Brand Commitments

- Product name: **Helix**
- UI tagline: **Analytics agents** (`helix-webui` i18n)
- Creator credit in UI: **Armin Dashti**
- Repository licence: **MIT** (`metadata.json`)
- Do not fabricate testimonials, customers, benchmarks, or pricing.

## Evidence on Hand

| Asset | Location |
| --- | --- |
| Root and app READMEs | `README.md`, `helix-api/README.md`, `helix-webui/README.md` |
| Agent pipeline registry | `helix-api/backend/analytics/agents/registry.md` |
| Eval plan and cases | `evals/EVAL_PLAN.md`, `evals/cases.yaml`, `evals/run_evals.py` |
| Persian admin guide (PDF) | `helix-webui/public/docs/fa/helix-admin-guide.pdf` (source HTML under `helix-webui/docs/guide/fa/`) |
| Sample analytics database | `helix-api` AdventureWorks LT SQLite (downloaded on first API start per API README) |
| Default login convention (local) | Documented in workspace rules for api/webui apps — username `armin` (password not stored here) |

**Not on hand:** Marketing landing copy, customer logos, performance SLAs, or production deployment topology — future Persuade surfaces must not invent these.

## Product Principles

1. **Ground truth in rows** — Answers must be justified by executed read-only queries within policy, not model speculation.
2. **Clarify or refuse** — Ambiguous or unsafe requests should surface questions or explicit refusal, not silent guesses.
3. **Operator in the loop** — Agents may ask humans; orchestration owns validation and packaging before results ship.
4. **Configurable but bounded** — Skills, agents, and connectors are extensible; schema allowlists and privacy sanitization remain non-negotiable for analysis runs.
5. **Bilingual operations** — English and Persian are first-class for operators and eval coverage.

## Accessibility & Inclusion

- Bilingual EN/FA UI; RTL support where Persian content appears (e.g. blockquotes and FA guide).
- No additional accessibility standard recorded as a product requirement yet — treat WCAG-aligned Operate UI as a goal for future `audit`/`harden` work unless the user specifies a mandated standard.
