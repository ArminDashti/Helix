---
name: orchestrate-pipeline
description: Inspect the human prompt, set goals, route Human → researcher → orchester,
  validate and package the result
---

# orchestrate-pipeline

1. Read the human prompt, mode, language, and report_type. Block writes, DDL, code generation, and off-product asks.
2. Set `goals`: one or two plain sentences for what the final answer must deliver.
3. Send the run to researcher with the goals and prompt.
4. Validate researcher's `what_was_done` and `text_report` against `goals`. Every number must come from the `sql_fetch` preview.
5. Pass: package `{ text_report, grid, echarts_option }` from the same `sql_fetch`. Null whatever `mode` does not require.
6. Gap: retry researcher once with a short hint, or stop with the gap list.
7. Researcher failure: retry that worker once with a hint, ask the operator one short question, or stop with the agent's message.

## Constraints

1. Route only: researcher → validate → package. Never write SQL yourself.
2. Only you talk to the operator. Researcher may ask through you when blocked on an ambiguity.
3. Ask at most three short questions before the run starts, and one when a worker is blocked.
4. Package from `sql_fetch` and researcher's `text_report` only. Never invent numbers.
