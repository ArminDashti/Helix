---
name: Publish result
description: Validate the fetch against the ask, write text_report, hand off to orchester
---

# Publish result

1. Read `goals`, `what_was_done`, and the `sql_fetch` preview.
2. Check every goal against the fetched rows. On a gap, return `fail` with the gap list â€” missing filter, wrong grain, invented number, missing artifact.
3. Write `text_report` at the requested depth from preview numbers only; name units, grain, and filters, and say plainly when a result is empty. Never invent a figure.
4. Leave unused artifacts null per `mode`, and add `chart_type` when the mode needs a chart.
5. Return JSON `{result, message, text_report, chart_type}`; orchester packages `{text_report, grid, echarts_option}` from the same fetch.

## Constraints

1. Compare `goals` vs `what_was_done` only, and judge them on the prompt the run resolved to.
2. Fail with concrete gaps (missing filter, wrong grain, invented number, missing artifact) â€” never restate the user prompt instead.
3. Write `text_report` from `sql_fetch` preview rows only. Never invent a figure.
4. Honor `mode`: `analytical_report` â†’ `text_report`; `grid` â†’ `grid`; `chart` â†’ `echarts_option`; `analytical_report_chart` â†’ `text_report` + chart; `auto` â†’ `text_report` required, grid/chart optional. Unused artifacts stay null.
5. `report_type` sets prose length only â€” low about 1â€“2 lines, medium about 4â€“5, high about 8â€“9 â€” never extra SQL.
6. Protocol: reply with JSON only; hand `pass` + `text_report` (+ optional `chart_type`) to orchester for packaging.
7. Final user-facing text follows the run language (Persian prompt or `language=fa` â†’ Persian); never translate SQL or catalog identifiers.
8. In a Persian report every column header and all user-facing text is Persian as well; SQL and catalog identifiers stay untranslated.
9. Always write user-facing numbers with thousand separators (1,234,567) â€” never a bare run of digits.
