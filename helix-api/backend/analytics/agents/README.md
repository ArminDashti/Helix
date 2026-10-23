# Helix analytics agents

Two pipeline agents: **orchester** and **researcher**. Shared schema reference plus the LangGraph runtime.

## Layout

| Path | Role |
| --- | --- |
| `orchester/` | Human-facing inspect, goals, validate, package |
| `researcher/` | Only agent that writes and runs SQL; processes rows into the report |
| `_shared/` | Shared references (e.g. `tables.md`) |

## Skills (source of truth)

| Agent | Skills |
| --- | --- |
| `orchester` | `orchestrate-pipeline`, `verify-research-access`, `sanitize-response-privacy` |
| `Researcher` (`researcher`) | `generate-optimized-select`, `process-data` |

Runtime copies live under `backend/markdown-files/` (seed-if-empty). Edit both when changing prompts.

## Flow

Human → orchester → researcher → orchester → Human

- Only orchester and researcher can ask the operator.
- Failures travel back upstream through the orchester inbox.

