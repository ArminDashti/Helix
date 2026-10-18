# Agent registry

Pipeline (LangGraph):

```text
Human → orchester → sql-expert → researcher → orchester → Human
```

| # | Id | Skill | Talks to the human | When to use |
|---|----|-------|--------------------|-------------|
| 1 | `orchester` | `orchestrate-pipeline` | Yes (ask up to 3 questions, or one per blocked worker) | Inspect the prompt, set goals, route the run, validate the result, package it for the UI |
| 2 | `sql-expert` | `generate-optimized-select` | No | Turn a plain-English data ask into one read-only, bounded SELECT and return the rows |
| 3 | `researcher` | `process-data` | Yes (one question when only the operator can settle an ambiguity) | Process the rows against the goals, write the result, ask sql-expert for one more number when needed |

Interaction is two-way: a worker that fails or is blocked reports upstream, and orchester decides a retry (once), a question, or stop. Researcher can call sql-expert for more data.

One skill per agent; nothing else is assigned.

**Models:** `openrouter.agents.<id>.model` in `helix.config.yaml`. Never hardcode models in `AGENT.md`.
