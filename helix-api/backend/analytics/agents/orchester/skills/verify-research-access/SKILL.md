---
name: verify-research-access
description: Before researcher runs, decide whether the operator's data-access policy can support the goals.
---

# verify-research-access

Use during inspect (before routing to researcher) and again if goals change after operator answers.

## Inputs

- `goals`, operator prompt, and `actor` from the user message (`is_admin`, `allowed_tables`, `data_access_plain`, `username`).

## Procedure

1. Admins: skip table allowlist checks; still block asks that need disallowed operations (writes, DDL, secrets).
2. Non-admins with empty `allowed_tables` and empty `data_access_plain`: fail with a short message that data access is not configured — do not start researcher.
3. Infer which catalog areas the goals need (sales, inventory, HR, purchases, shared master data). Map to schema families without listing every table in the operator message.
4. Compare needed areas to `allowed_tables` and `data_access_plain`. If the goals clearly require tables the operator cannot read, choose one:
   - `fail`: explain in plain business language what kind of data is missing (no schema/table/column names).
   - `needs_input`: one short question only if a narrower ask could still succeed within policy.
5. If access is plausible but tight, add one sentence to `goals` telling researcher to stay within the operator's allowed scope (researcher still gets actor JSON).
6. Never ask the operator to confirm permission to run SQL or to name connection details.

## Constraints

- You do not run SQL. Researcher enforces object-level allowlists at execute time; this skill stops hopeless runs early.
- Denial messages must not expose database architecture (no schema/table/column lists, no catalog dumps).
