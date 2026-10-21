"""Researcher SQL path: one plain-English ask → bounded SELECT (eval / isolated runs).

The live pipeline runs the same tools inside ``node_researcher``; this module is for evals and
tests that exercise SQL generation without the full orchester graph.
"""

from __future__ import annotations

from typing import Any

from . import markdown_store as store
from . import sql_memory
from .pipeline_run import EXECUTE_SELECT_TOOL
from .researcher_turn_loop import run_researcher_loop
from .sql_expert_tools import SQL_EXPERT_TOOLS

_TOOL_LINE = (
    "\n\n## Tools\n"
    "1. Call describe_table(schema.table) when column names or types are uncertain.\n"
    "2. Call sample_rows(schema.table, limit) when you need example status codes or date shapes.\n"
    "3. Call execute_select with one bounded SELECT for the answer.\n"
    "If execute_select errors, read the error and rewrite (up to three attempts).\n"
    "Do not put sys.* or INFORMATION_SCHEMA.* in execute_select SQL — use describe_table instead.\n"
    "After a successful execute_select, reply with JSON only: "
    '{"ok":true,"notes":"grain and filter used"} '
    'or {"ok":false,"reason":"why no query could run"}.\n'
)


def _fail(ctx: dict[str, Any], reason: str) -> dict[str, Any]:
    ctx["last_error"] = reason
    return {"ok": False, "reason": reason}


def run_sql_request(request: str, ctx: dict[str, Any]) -> dict[str, Any]:
    """Run the researcher SQL skill loop for one plain-English data ask."""
    from .pipeline_langgraph import _llm
    from .researcher_turn_loop import detect_prompt_language

    ask = str(request or "").strip()
    if not ask:
        return _fail(ctx, "researcher needs a plain-English data ask")

    ctx.setdefault("prompt_language", detect_prompt_language(ask))

    examples = sql_memory.similar_examples(ask)
    example_block = ""
    if examples:
        shown = "\n".join(f"- Ask: {e['request']}\n  SQL: {e['sql']}" for e in examples)
        example_block = (
            "\n\n## Similar past requests (reuse what worked)\n"
            f"{shown}\n"
        )

    system = store.assemble_agent_prompt("researcher") + _TOOL_LINE + example_block
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"Data request (plain English):\n{ask}"},
    ]
    tools = SQL_EXPERT_TOOLS + [EXECUTE_SELECT_TOOL]

    outcome = run_researcher_loop(ctx, messages, tools, llm=_llm, mode="eval")
    if outcome.terminal == "error":
        return _fail(ctx, f"researcher LLM failed: {outcome.message}")
    if outcome.terminal == "fail":
        return _fail(ctx, outcome.message or str(outcome.parsed.get("reason") or "researcher failed"))
    if outcome.terminal == "partial":
        fetch = ctx.get("sql_fetch") if isinstance(ctx.get("sql_fetch"), dict) else None
        if fetch and (fetch.get("rows") or []):
            return {
                "ok": True,
                "sql": fetch.get("sql"),
                "columns": fetch.get("columns"),
                "row_count": len(fetch.get("rows") or []),
                "preview": (fetch.get("rows") or [])[:20],
                "notes": "partial",
            }
        return _fail(ctx, outcome.message or ctx.get("last_error") or "researcher partial without rows")

    fetch = ctx.get("sql_fetch") if isinstance(ctx.get("sql_fetch"), dict) else None
    if not fetch or not (fetch.get("rows") or []):
        return _fail(ctx, str(ctx.get("last_error") or "researcher produced no query"))

    parsed = outcome.parsed
    result = {
        "ok": True,
        "sql": fetch.get("sql"),
        "columns": fetch.get("columns"),
        "row_count": len(fetch.get("rows") or []),
        "preview": (fetch.get("rows") or [])[:20],
        "notes": str(parsed.get("notes") or ""),
    }
    sql_text = str(fetch.get("sql") or "").strip()
    if sql_text:
        sql_memory.save_example(ask, sql_text)
    return result
