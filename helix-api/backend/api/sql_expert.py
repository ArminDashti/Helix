"""sql-expert: turn one plain-English data ask into one validated, bounded SELECT and run it.

Other agents never write SQL. They call ``run_sql_request``; this module is the only place the
LLM turns an ask into SQL, and ``execute_select`` (SELECT-only validation, row cap) is the only
way that SQL reaches the database. A failure comes back as ``{"ok": False, "reason": ...}`` for the
caller to report to orchester, which decides the next step.
"""

from __future__ import annotations

import json
from typing import Any

from . import markdown_store as store

# ponytail: one LLM tool turn per query attempt; a second turn is only for the error-driven rewrite.
MAX_TURNS = 3

# What other agents call. The SQL is written by sql-expert, never by the caller.
ASK_SQL_EXPERT_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "ask_sql_expert",
        "description": (
            "Ask sql-expert for data in plain English: what to measure, the period, and the "
            "filter. sql-expert writes one safe read-only SELECT and returns the rows. "
            "Never send SQL. Returns ok:false with a reason when no query could run."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "request": {
                    "type": "string",
                    "description": "The data ask in plain English",
                },
            },
            "required": ["request"],
        },
    },
}

_TOOL_LINE = (
    "\n\n## Tools\n"
    "Call execute_select once with one SELECT. If it errors, rewrite once with a different shape.\n"
    'Then reply with JSON only: {"ok":true,"notes":"grain and filter used"} '
    'or {"ok":false,"reason":"why no query could run"}.\n'
)


def _fail(ctx: dict[str, Any], reason: str) -> dict[str, Any]:
    ctx["last_error"] = reason
    return {"ok": False, "reason": reason}


def run_sql_request(request: str, ctx: dict[str, Any]) -> dict[str, Any]:
    from .pipeline_langgraph import _llm, _parse_json_object
    from .pipeline_run import (
        EXECUTE_SELECT_TOOL,
        _assistant_message_for_history,
        _dispatch_tool,
        _parse_tool_args,
    )

    ask = str(request or "").strip()
    if not ask:
        return _fail(ctx, "sql-expert needs a plain-English request")

    system = store.assemble_agent_prompt("sql-expert") + _TOOL_LINE
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"Data request (plain English):\n{ask}"},
    ]
    tools = [EXECUTE_SELECT_TOOL]
    result: dict[str, Any] | None = None

    for _turn in range(MAX_TURNS):
        try:
            assistant = _llm(ctx, "sql-expert", messages, tools=tools)
        except Exception as exc:  # noqa: BLE001 - reported to orchester, never raised into the run
            return _fail(ctx, f"sql-expert LLM failed: {exc}")

        tool_calls = assistant.get("tool_calls")
        if not isinstance(tool_calls, list) or not tool_calls:
            parsed = _parse_json_object(str(assistant.get("content") or ""))
            if result is not None and parsed.get("ok") is not False:
                result["notes"] = str(parsed.get("notes") or "")
                return result
            return _fail(
                ctx,
                str(parsed.get("reason") or ctx.get("last_error") or "sql-expert produced no query"),
            )

        messages.append(_assistant_message_for_history(assistant))
        for call in tool_calls:
            if not isinstance(call, dict):
                continue
            fn = call.get("function") if isinstance(call.get("function"), dict) else {}
            name = str(fn.get("name") or "").strip()
            if name != "execute_select":
                content = json.dumps({"ok": False, "error": f"{name} is not available here"})
            else:
                content = _dispatch_tool(name, _parse_tool_args(fn.get("arguments")), ctx)
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

    return _fail(ctx, f"sql-expert exceeded {MAX_TURNS} turns without a query result")
