---
name: process-data
description: Check the rows sql-expert fetched against the goals, write what_was_done
  and text_report from them, and hand back to orchester
---

# process-data

1. Read `goals`, the prompt, and the `sql_fetch` columns and preview rows that sql-expert returned.
2. Check that the grain and the magnitude of the rows match the goals. If a number is missing, call `ask_sql_expert` once with one plain-English request (measure, period, filter). Never write SQL yourself.
3. Write `what_was_done`: what the rows show and which filter or period they cover.
4. Write `text_report` at the requested depth from preview numbers only. Name units, grain, and filters. Say plainly when a result is empty.
5. Add `chart_type` only when the mode needs a chart.
6. If only the operator can settle an ambiguity (period, grouping, two plausible tables), reply `needs_input` with one short question instead of guessing.
7. Finish with JSON: `{"result":"done|fail|needs_input","what_was_done":"...","text_report":"...","chart_type":"","message":"...","question":""}`.

## Constraints

1. Ground every figure in the `sql_fetch` preview. Never invent a figure or a row.
2. Compute totals, shares, and rankings in SQL through `ask_sql_expert`. Do not add up detail rows in prose.
3. Reach the database only through `ask_sql_expert`. Never another connection or path.
4. Ask the operator only for a real ambiguity in the data ask, never for access or permission.
5. `report_type` sets prose length only: low about 1 to 2 lines, medium about 4 to 5, high about 8 to 9.
6. When the run is Persian (`language=fa` or a Persian prompt), write `text_report` in Persian. Keep SQL and catalog identifiers untranslated.
7. Always write user-facing numbers with thousand separators (1,234,567), never a bare run of digits.
