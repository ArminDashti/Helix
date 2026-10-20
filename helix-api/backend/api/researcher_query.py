"""Researcher SQL path: one plain-English ask → bounded SELECT (eval / isolated runs).

The live pipeline runs the same tools inside ``node_researcher``; this module is for evals and
tests that exercise SQL generation without the full orchester graph.
"""

from __future__ import annotations

import json
from typing import Any

from . import markdown_store as store
from . import sql_memory
from .pipeline_run import EXECUTE_SELECT_TOOL, _assistant_message_for_history, _parse_tool_args
from .sql_expert_tools import SQL_EXPERT_TOOLS, researcher_sql_dispatch

MAX_TURNS = 8

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

_NUDGE_NO_TOOLS = (
    "Use describe_table, sample_rows, or execute_select. "
    "Do not reply with final JSON until execute_select has returned ok:true."
)


def _fail(ctx: dict[str, Any], reason: str) -> dict[str, Any]:
    ctx["last_error"] = reason
    return {"ok": False, "reason": reason}


def run_sql_request(request: str, ctx: dict[str, Any]) -> dict[str, Any]:
    """Run the researcher SQL skill loop for one plain-English data ask."""
    from .pipeline_langgraph import _llm, _parse_json_object

    ask = str(request or "").strip()
    if not ask:
        return _fail(ctx, "researcher needs a plain-English data ask")

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
    result: dict[str, Any] | None = None
    sql_saved = False

    for _turn in range(MAX_TURNS):
        try:
            assistant = _llm(ctx, "researcher", messages, tools=tools)
        except Exception as exc:  # noqa: BLE001
            return _fail(ctx, f"researcher LLM failed: {exc}")

        tool_calls = assistant.get("tool_calls")
        if not isinstance(tool_calls, list) or not tool_calls:
            parsed = _parse_json_object(str(assistant.get("content") or ""))
            if parsed.get("ok") is False and parsed.get("reason"):
                return _fail(ctx, str(parsed.get("reason")))
            if result is not None and parsed.get("ok") is not False:
                result["notes"] = str(parsed.get("notes") or "")
                if not sql_saved and result.get("sql"):
                    sql_memory.save_example(ask, str(result["sql"]))
                    sql_saved = True
                return result
            if _turn + 1 < MAX_TURNS:
                messages.append({"role": "assistant", "content": str(assistant.get("content") or "")})
                messages.append({"role": "user", "content": _NUDGE_NO_TOOLS})
                continue
            return _fail(
                ctx,
                str(parsed.get("reason") or ctx.get("last_error") or "researcher produced no query"),
            )

        messages.append(_assistant_message_for_history(assistant))
        for call in tool_calls:
            if not isinstance(call, dict):
                continue
            fn = call.get("function") if isinstance(call.get("function"), dict) else {}
            name = str(fn.get("name") or "").strip()
            content = researcher_sql_dispatch(name, _parse_tool_args(fn.get("arguments")), ctx)
            if name == "execute_select":
                payload = json.loads(content)
                if payload.get("ok"):
                    result = {
                        "ok": True,
                        "sql": payload.get("sql"),
                        "columns": payload.get("columns"),
                        "row_count": payload.get("row_count"),
                        "preview": payload.get("preview"),
                    }
            messages.append(
                {"role": "tool", "tool_call_id": str(call.get("id") or name), "content": content}
            )

    return _fail(ctx, f"researcher exceeded {MAX_TURNS} turns without a query result")
