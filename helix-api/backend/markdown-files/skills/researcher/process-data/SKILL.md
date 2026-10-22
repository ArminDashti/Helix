---
name: process-data
description: After execute_select, check sql_fetch against the goals and write what_was_done
  and text_report from the preview
---

# process-data

1. Read `goals`, the prompt, and the `sql_fetch` columns and preview rows from your last `execute_select`.
2. Check that the grain and the magnitude of the rows match the goals. If a number is missing, run another bounded `execute_select` (do not total detail rows in prose).
3. Build `assumptions`: one object per business rule that affects the answer — `{ "item", "value_used", "source": "documented"|"guessed", "impact" }`. Use `documented` only when `tables.md` or retrieved knowledge states the rule; otherwise `guessed`. List status filters, returns handling, amount column and VAT, date range, currency unit, and inferred column meanings.
4. Write `what_was_done`: what the rows show and which filter or period they cover (facts only).
5. Write `text_report` at the requested depth from preview numbers only. Lead with the direct answer, then optional one-line alternatives when you ran a second aggregate. End with **Assumptions** (English) or **فرضیات** (Persian when `language=fa`): bullet only `source: guessed` items (`- item: value_used — impact`). Do not repeat documented rules there. Close with one short line inviting the user to confirm or correct the assumptions.
6. Add `chart_type` only when the mode needs a chart.
7. If only the operator can settle an ambiguity (period, grouping, two plausible tables), reply `needs_input` with one short question instead of guessing.
8. Finish with JSON: `{"result":"done|fail|needs_input","what_was_done":"...","text_report":"...","assumptions":[...],"chart_type":"","message":"...","question":""}`.

## Example shape (Persian locale)

Main answer in Persian; Assumptions heading **فرضیات**; closing line in Persian inviting correction.

## Constraints

1. Ground every figure in the `sql_fetch` preview. Never invent a figure or a row.
2. Compute totals, shares, and rankings in SQL with `execute_select`. Do not add up detail rows in prose.
3. Reach the database only through `describe_table`, `sample_rows`, and `execute_select`.
4. Ask the operator only for a real ambiguity in the data ask, never for access or permission.
5. `report_type` sets prose length only: low about 1 to 2 lines, balanced about 4 to 5, high about 8 to 9.
6. When the run is Persian (`language=fa`), write `text_report` in Persian. Keep SQL and catalog identifiers untranslated. `language` is the app locale, never inferred from the prompt.
7. Always write user-facing numbers with thousand separators (1,234,567), never a bare run of digits.
8. Never present a confident total without separating documented facts from guessed business rules.
