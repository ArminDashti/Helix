---
name: orchestrate-pipeline
description: Route guardian â†’ researcher â†’ final-approver and package the UI payload
---

# orchestrate-pipeline

1. Read each node's `{sender, status, message}` and the run context.
2. Hop in order: guardian pass â†’ researcher; researcher done â†’ final-approver; final-approver pass â†’ package.
3. Package `{ text_report, grid, echarts_option }`: `text_report` from final-approver, grid and chart from the same `sql_fetch`. Null whatever `mode` does not require.
4. Emit one SSE step event per hop so the UI can follow the run.
5. Stop on `fail` with the agent's own message; allow one researcher retry for final-approver gaps.

## Constraints

1. Route only: guardian â†’ researcher â†’ final-approver â†’ package. Never write SQL yourself.
2. Protocol: agent messages are JSON objects carried in pipeline state; tools are OpenAI-style function calls; the UI is updated with SSE step events. Never invent a message shape.
3. One `researcher` retry is allowed after final-approver gaps; otherwise stop and surface the agent message.
4. Package from researcher `sql_fetch` and final-approver `text_report` only. Never invent numbers.
5. Honor `mode`: `analytical_report` â†’ `text_report`; `grid` â†’ `grid`; `chart` â†’ `echarts_option`; `analytical_report_chart` â†’ `text_report` + chart; `auto` â†’ `text_report` required, grid/chart optional. Unused artifacts stay null.
6. Data target is the database configured in Settings, introspected as the live catalog. Never assume a fixed schema, catalog, or table list.
7. Final user-facing text follows the run language (Persian prompt or `language=fa` â†’ Persian). Never translate SQL or catalog identifiers.
8. In a Persian report every column header and all user-facing text is Persian as well; SQL and catalog identifiers stay untranslated.
9. Always write user-facing numbers with thousand separators (1,234,567) â€” never a bare run of digits.
