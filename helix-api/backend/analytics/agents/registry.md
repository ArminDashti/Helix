# Agent registry

## Pipeline

Human → orchester → researcher → orchester → Human

| Step | Agent | Skills | Asks operator? | Role |
| --- | --- | --- | --- | --- |
| 1 | `orchester` | `orchestrate-pipeline`, `verify-research-access`, `sanitize-response-privacy` | Yes (inspect / unblock) | Goals, routing, validation, packaging, access check, response privacy |
| 2 | `Researcher` | `generate-optimized-select`, `process-data` | Yes (one ambiguity) | Read-only SQL + report from `sql_fetch` |

Interaction is two-way: researcher reports `fail` or `needs_input` upstream, and orchester decides a retry (once), a question, or stop.

