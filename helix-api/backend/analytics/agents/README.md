# Helix agents

Three agents: orchester, sql-expert, researcher. Shared schema reference plus the LangGraph runtime.

## Status

Agents are defined in markdown and synced into the runtime store (`markdown-files/`) on boot. Runtime is LangGraph (`api/pipeline_langgraph.py`).

## Layout

| Path | Purpose |
|------|---------|
| `_shared/schema/tables.md` | Database reference docs (the live catalog comes from Settings) |
| `orchester/` | Human-facing supervisor: inspect prompt, goals, validation, packaging |
| `sql-expert/` | Only agent that writes and runs SQL: one bounded read-only SELECT |
| `researcher/` | Processes the fetched rows against the goals and writes the result |
| `registry.md` | Pipeline index |

## Contract: one skill per agent

Every agent declares exactly one skill in its `AGENT.md` frontmatter and in the runtime assignment map:

| Agent | Skill |
|-------|-------|
| `orchester` | `orchestrate-pipeline` |
| `sql-expert` | `generate-optimized-select` |
| `researcher` | `process-data` |

`markdown_store.agent_asset_issues()` reports any agent that drifts from that contract, and `api.tests` fails on it.

## Pipeline

```text
Human → orchester → sql-expert → researcher → orchester → Human
```

## Protocol

- Agent messages are JSON objects carried in pipeline state; each hop emits an SSE step event to the UI.
- Only orchester and researcher can ask the operator. sql-expert never does.
- Researcher calls `ask_sql_expert` (sql-expert) for extra data. Failures travel back upstream through the orchester inbox.
- The database target and its schema come from Settings, never from a hardcoded catalog.
- Keep rule and skill text short: it is concatenated into the agent's system prompt on every call.

## Models

Set `openrouter.agents.<id>.model` in `helix.config.example.yaml` / local `helix.config.yaml`. Never hardcode models in `AGENT.md`.
