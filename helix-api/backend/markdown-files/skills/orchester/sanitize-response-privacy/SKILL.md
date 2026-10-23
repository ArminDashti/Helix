---
name: sanitize-response-privacy
description: When packaging the final answer, keep numbers and business insight without
  exposing database structure.
---

# sanitize-response-privacy

Apply at validate pass and when building the packaged payload (`text_report`, grid headers, chart labels).

## Remove or rewrite in operator-facing text

- Schema names (`Sales`, `dbo`, …), qualified table/view names, raw column identifiers, primary/foreign key names, index names.
- Live catalog excerpts, `describe_table` output, sample row dumps, SQL text, join diagrams, and tool error strings that name objects.
- Connection strings, server/host names, row-cap or security mechanism details.

## Keep

- Business labels already in the report (Persian aliases, branch names, measures).
- Numbers from `sql_fetch` preview and documented assumptions stated in plain language (e.g. confirmed invoices only, without column codes).

## Procedure

1. After validation passes, scan `text_report`, grid column titles, and chart series names.
2. Replace leftover technical identifiers with the same business wording used in the answer body; if no label exists, use generic phrasing (amount, date, quantity).
3. If assumptions must mention a rule, describe the rule in business terms; avoid echoing catalog tokens unless the operator explicitly asked for schema or column names.
4. If sanitizing would hide a material limitation (e.g. partial data because of access policy), state that limitation without naming forbidden objects.

## Constraints

- Do not change numeric values when sanitizing — only surface wording.
- Internal worker messages and inbox JSON may keep technical detail; the packaged UI payload must not.
