"""Shared pipeline plumbing: step events, tools, SQL dispatch, result packaging, run lifecycle."""

from __future__ import annotations

import json
import time as _agent_time
import uuid
from typing import Any, Iterator

from . import logs_store
from . import markdown_store as store
from . import token_usage
from .chart_payload import build_echarts_option, build_grid
from .config_loader import get_provider, provider_label, web_search_enabled
from .demo import VALID_CHART_TYPES, _normalize_report_type
from .jalali_dates import calendar_hint_for_prompt
from .llm_client import require_llm
from .pipeline_graph import (
    agent_display_name,
    get_pipeline_graph_for_mode,
)
from .sql_execute import _sql_error_message, execute_select
from .web_search import search_web

DATA_GATHERER_MAX_ROWS = 500
MAX_STEP_LOG_ENTRIES = 30
FAILURE_STEP_SNAPSHOT = 20
def max_tool_turns() -> int:
    from .config_loader import get_researcher_settings

    return int(get_researcher_settings()["max_turns"])


SEARCH_WEB_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "search_web",
        "description": (
            "Search the public web for facts outside the connected database "
            "(benchmarks, news, industry rates). Pass 1–3 short queries."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "queries": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "1–3 search queries",
                },
                "objective": {
                    "type": "string",
                    "description": "Why these queries matter for the user prompt",
                },
            },
            "required": ["queries"],
        },
    },
}


def web_search_allowed(ctx: dict[str, Any]) -> bool:
    if not web_search_enabled():
        return False
    return ctx.get("enable_web_search") is not False


def active_tools(names: tuple[str, ...] | None = None) -> list[dict[str, Any]]:
    blocked = set() if web_search_enabled() else {"search_web"}
    pool = [EXECUTE_SELECT_TOOL, SEARCH_WEB_TOOL]
    out: list[dict[str, Any]] = []
    for tool in pool:
        fn = tool.get("function") if isinstance(tool, dict) else None
        tool_name = str((fn or {}).get("name") or "")
        if tool_name in blocked:
            continue
        if names is not None and tool_name not in names:
            continue
        out.append(tool)
    return out


def _normalize_web_search_queries(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    queries: list[str] = []
    for item in raw:
        text = str(item or "").strip()
        if text and text not in queries:
            queries.append(text)
        if len(queries) >= 3:
            break
    return queries


EXECUTE_SELECT_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "execute_select",
        "description": (
            "Run one cheap SELECT (or CTE+SELECT) against the allowlisted database. "
            "Always include TOP/FETCH. Prefer catalog.schema.table names from the prompt."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "sql": {
                    "type": "string",
                    "description": "Single SELECT (or WITH … SELECT) statement",
                },
            },
            "required": ["sql"],
        },
    },
}


def _append_step_log(
    ctx: dict[str, Any],
    *,
    agent_id: str,
    node_id: str = "",
    status: str,
    message: str,
) -> None:
    log = ctx.setdefault("step_log", [])
    log.append(
        {
            "agent_id": agent_id or "",
            "node_id": node_id or "",
            "status": status or "",
            "message": message or "",
            "at": _agent_time.time(),
        }
    )
    if len(log) > MAX_STEP_LOG_ENTRIES:
        ctx["step_log"] = log[-MAX_STEP_LOG_ENTRIES:]


def _step_event(
    ctx: dict[str, Any],
    *,
    agent_id: str,
    node_id: str = "",
    status: str,
    message: str,
    result: str | None = None,
    detail: dict[str, Any] | None = None,
) -> dict[str, Any]:
    _append_step_log(
        ctx,
        agent_id=agent_id,
        node_id=node_id,
        status=status,
        message=message,
    )
    started = ctx.get("pipeline_started")
    elapsed = None
    if isinstance(started, (int, float)):
        elapsed = round(_agent_time.time() - started, 2)
    payload: dict[str, Any] = {
        "event": "step",
        "agent_id": agent_id,
        "status": status,
        "message": message,
        "at": _agent_time.time(),
    }
    if elapsed is not None:
        payload["elapsed_s"] = elapsed
    if node_id:
        payload["node_id"] = node_id
    if result is not None:
        payload["result"] = result
    run_id = ctx.get("run_id")
    if run_id:
        payload["run_id"] = run_id
    fetch = ctx.get("sql_fetch") if isinstance(ctx.get("sql_fetch"), dict) else None
    if fetch and fetch.get("sql"):
        payload["sql"] = str(fetch.get("sql"))[:2000]
        payload["row_count"] = len(fetch.get("rows") or [])
    # Live token meter: every step carries the run's running total so the UI can show what the run
    # has cost so far, not only what it cost when it finished.
    usage = token_usage.snapshot(ctx)
    if usage.get("calls"):
        payload["token_usage"] = usage
    rag = ctx.get("rag")
    if isinstance(rag, dict) and rag.get("docs"):
        payload["rag"] = rag
    if isinstance(detail, dict) and detail:
        payload["detail"] = detail
    prompt_lang = ctx.get("prompt_language")
    if prompt_lang:
        payload["prompt_language"] = prompt_lang
    return payload


def _failure_duration_s(ctx: dict[str, Any]) -> float | None:
    started = ctx.get("pipeline_started")
    if not isinstance(started, (int, float)):
        return None
    return round(_agent_time.time() - started, 2)


def _failure_detail(message: str, ctx: dict[str, Any]) -> str:
    last_error = str(ctx.get("last_error") or "").strip()
    trimmed = (message or "").strip()
    if last_error and last_error != trimmed:
        return last_error
    return ""


def _failure_steps(ctx: dict[str, Any]) -> list[dict[str, str]]:
    step_log = ctx.get("step_log")
    if not isinstance(step_log, list):
        return []
    return step_log[-FAILURE_STEP_SNAPSHOT:]


def _ui_text(language: str, en: str, fa: str) -> str:
    return fa if language == "fa" else en


def _result_language(ctx: dict[str, Any]) -> str:
    # Report language follows the app locale only; a Persian prompt must not
    # switch it (English app → English report, even for Persian requests).
    return "fa" if (ctx.get("language") or "en") == "fa" else "en"


def _sse(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def _question_event(ctx: dict[str, Any], pending: dict[str, Any]) -> dict[str, Any]:
    """SSE payload asking the operator to answer; the run waits for the answer request."""
    questions: list[dict[str, str]] = []
    for index, item in enumerate(pending.get("questions") or [], start=1):
        if isinstance(item, dict):
            text = str(item.get("text") or "").strip()
            question_id = str(item.get("id") or f"q{index}")
        else:
            text = str(item or "").strip()
            question_id = f"q{index}"
        if text:
            questions.append({"id": question_id, "text": text})
    return {
        "event": "question",
        "run_id": str(ctx.get("run_id") or ""),
        "agent_id": str(pending.get("agent_id") or ""),
        "node_id": str(pending.get("node") or ""),
        "questions": questions,
        "at": _agent_time.time(),
    }


def _operator_answers_text(ctx: dict[str, Any]) -> str:
    """Operator answers so far, formatted for a prompt ('' when there are none)."""
    answers = ctx.get("clarifications")
    if not isinstance(answers, list) or not answers:
        return ""
    lines = [
        "Operator answers (already given — use them and do not ask these again):"
    ]
    for item in answers:
        if not isinstance(item, dict):
            continue
        question = str(item.get("question") or "").strip()
        answer = str(item.get("answer") or "").strip()
        if question:
            lines.append(f"- Q: {question}\n  A: {answer or '(no answer)'}")
    return "\n".join(lines) if len(lines) > 1 else ""


def _apply_answers(
    ctx: dict[str, Any],
    questions: list[dict[str, Any]],
    answers: dict[str, Any],
) -> None:
    """Record the operator's answers in ctx, where every later prompt picks them up."""
    store = ctx.setdefault("clarifications", [])
    if not isinstance(store, list):
        ctx["clarifications"] = store = []
    for index, item in enumerate(questions or [], start=1):
        question_id = (
            str(item.get("id") or f"q{index}") if isinstance(item, dict) else f"q{index}"
        )
        text = str(item.get("text") if isinstance(item, dict) else item or "").strip()
        answer = str((answers or {}).get(question_id) or "").strip()
        if not answer:
            continue
        store.append({"question": text, "answer": answer})


def _park_pending(ctx: dict[str, Any]) -> str:
    """Hand a run that asked a question to the run store; returns the run id."""
    from . import run_store

    pending = ctx.get("_pending_question")
    if not isinstance(pending, dict):
        pending = {}
    return run_store.pause_run(
        ctx,
        agent_id=str(pending.get("agent_id") or ""),
        node=str(pending.get("node") or ""),
        questions=list(pending.get("questions") or []),
    )


def _sql_from_ctx(ctx: dict[str, Any]) -> str:
    fetch = ctx.get("sql_fetch")
    if isinstance(fetch, dict):
        return str(fetch.get("sql") or "")
    return ""


def _persist_failure(
    message: str,
    *,
    ctx: dict[str, Any],
    agent_id: str | None = None,
    kind: str | None = None,
    path: str = "",
    status_code: int | None = None,
) -> dict[str, Any]:
    from .agents import resolve_agent_definition_id

    raw_id = str(agent_id or "")
    definition_id = resolve_agent_definition_id(raw_id) if raw_id else ""
    return logs_store.append_error(
        kind=kind or logs_store.classify_error_kind(message),
        message=message,
        prompt=str(ctx.get("prompt") or ""),
        mode=str(ctx.get("mode") or ""),
        language=str(ctx.get("language") or "en"),
        agent_id=definition_id or raw_id,
        node_id=raw_id,
        sql=_sql_from_ctx(ctx),
        path=path,
        status_code=status_code,
        run_id=str(ctx.get("run_id") or ""),
        detail=_failure_detail(message, ctx),
        duration_s=_failure_duration_s(ctx),
        steps=_failure_steps(ctx),
        report_type=str(ctx.get("report_type") or ""),
        chart_type=str(ctx.get("chart_type") or ""),
    )


def _error_event(
    message: str,
    *,
    ctx: dict[str, Any],
    agent_id: str | None = None,
    kind: str | None = None,
) -> str:
    item = _persist_failure(message, ctx=ctx, agent_id=agent_id, kind=kind)
    payload: dict[str, Any] = {"event": "error", "error": message}
    if kind:
        payload["kind"] = kind
    if agent_id:
        payload["agent_id"] = agent_id
    if item.get("run_id"):
        payload["run_id"] = item["run_id"]
    if item.get("id"):
        payload["log_id"] = item["id"]
    return _sse(payload)


_DANGEROUS_SNIPPETS = (
    "ignore previous",
    "ignore all instructions",
    "ignore the rules",
    "jailbreak",
    "reveal the system prompt",
    "dump your prompt",
    "api key",
    "api_key",
    "openrouter token",
    "connection string",
    "drop table",
    "truncate table",
    "insert into",
    "delete from",
    "xp_cmdshell",
    "exec(",
    "execute(",
)


def _prompt_hard_block(prompt: str, actor: dict[str, Any]) -> str | None:
    text = prompt or ""
    lowered = text.lower()
    if any(snippet in lowered for snippet in _DANGEROUS_SNIPPETS):
        return "This prompt is not allowed."
    if actor.get("unknown"):
        return "Unknown user; data analysis is blocked."
    admin_only = (
        "change password",
        "create user",
        "delete user",
        "disable security",
        "show token",
        "list api key",
    )
    if not actor.get("is_admin") and any(item in lowered for item in admin_only):
        return "This action needs an admin user."
    return None


def _effective_mode(mode: str) -> str:
    if mode in ("analysis", "research"):
        return "analytical_report"
    if mode == "both":
        return "analytical_report_chart"
    return mode or "auto"


def _report_length_hint(level: str, language: str) -> str:
    key = (level or "balanced").strip().lower()
    if key == "medium":
        key = "balanced"
    if key not in ("low", "balanced", "high"):
        key = "balanced"
    if language == "fa":
        mapping = {
            "low": "طول گزارش: حدود ۱ تا ۲ خط.",
            "balanced": "طول گزارش: حدود ۴ تا ۵ خط.",
            "high": "طول گزارش: حدود ۸ تا ۹ خط.",
        }
    else:
        mapping = {
            "low": "Report length: about 1–2 lines.",
            "balanced": "Report length: about 4–5 lines.",
            "high": "Report length: about 8–9 lines.",
        }
    return mapping[key]


def _normalize_chart_types(ctx: dict[str, Any]) -> list[str]:
    raw = ctx.get("chart_types")
    types: list[str] = []
    if isinstance(raw, list):
        for item in raw:
            value = str(item or "").strip()
            if value in VALID_CHART_TYPES and value not in types:
                types.append(value)
            if len(types) >= 4:
                break
    if not types:
        single = ctx.get("chart_type") or "bar"
        if single not in VALID_CHART_TYPES:
            single = "bar"
        types = [single]
    return types


def _package_result(ctx: dict[str, Any]) -> dict[str, Any]:
    mode = _effective_mode(str(ctx.get("mode") or "auto"))
    language = ctx.get("language") or "en"
    chart_types = _normalize_chart_types(ctx)
    chart_type = chart_types[0]
    fetch = ctx.get("sql_fetch") if isinstance(ctx.get("sql_fetch"), dict) else None
    text_report = ctx.get("text_report")
    if not text_report:
        artifacts = ctx.get("artifacts") or {}
        for key in ("researcher", "orchester"):
            pub = artifacts.get(key) or {}
            text_report = pub.get("text")
            if text_report:
                break
    if not text_report and fetch:
        count = len(fetch.get("rows") or [])
        text_report = (
            f"Query returned {count} rows."
            if language != "fa"
            else f"پرس‌وجو {count} ردیف برگرداند."
        )
    echarts_option = None
    echarts_options: list[dict[str, Any]] = []
    grid = None
    if fetch:
        if mode in ("chart", "analytical_report_chart", "auto", "chart_grid"):
            for ctype in chart_types:
                option = build_echarts_option(
                    fetch, chart_type=ctype, language=language
                )
                if option:
                    echarts_options.append({"chart_type": ctype, "option": option})
            if echarts_options:
                echarts_option = echarts_options[0]["option"]
                chart_type = echarts_options[0]["chart_type"]
        if mode in ("grid", "auto", "analytical_report_chart", "chart_grid"):
            grid = build_grid(fetch, ctx.get("columns"))
        if mode == "analytical_report":
            echarts_option = None
            echarts_options = []
            raw_cols = ctx.get("columns")
            if isinstance(raw_cols, list) and [c for c in raw_cols if str(c).strip()]:
                grid = build_grid(fetch, raw_cols)
            else:
                grid = None
        if mode == "chart":
            text_report = None
        if mode == "chart_grid":
            text_report = None
        if mode == "grid":
            text_report = None
            echarts_option = None
            echarts_options = []
    if mode in ("analytical_report", "analytical_report_chart", "auto") and not text_report:
        raise ValueError("No report text was produced from the query results")
    if mode in ("chart", "analytical_report_chart", "auto", "chart_grid") and not echarts_option and mode != "analytical_report":
        if mode in ("chart", "analytical_report_chart", "chart_grid"):
            raise ValueError("No chart could be built from the query results")
    return {
        "mode": mode,
        "language": language,
        "report_type": ctx.get("report_type"),
        "chart_type": chart_type if echarts_option else None,
        "chart_types": [item["chart_type"] for item in echarts_options] or None,
        "text_report": text_report,
        "echarts_option": echarts_option,
        "echarts_options": echarts_options or None,
        "grid": grid,
        "used_demo": False,
        "token_usage": token_usage.snapshot(ctx),
        "rag": ctx.get("rag") if isinstance(ctx.get("rag"), dict) else None,
        "assumptions": ctx.get("assumptions")
        if isinstance(ctx.get("assumptions"), list)
        else None,
        "verification": ctx.get("verification")
        if isinstance(ctx.get("verification"), dict)
        else None,
        "web_search_brief": str(ctx.get("web_search_brief") or "").strip() or None,
    }


def normalize_researcher_assumptions(raw: Any) -> list[dict[str, str]]:
    """Normalize researcher assumptions JSON to a stable list of dicts."""
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        item = str(entry.get("item") or "").strip()
        if not item:
            continue
        source = str(entry.get("source") or "guessed").strip().lower()
        if source not in ("documented", "guessed"):
            source = "guessed"
        out.append(
            {
                "item": item,
                "value_used": str(entry.get("value_used") or "").strip(),
                "source": source,
                "impact": str(entry.get("impact") or "").strip(),
            }
        )
    return out


def format_assumptions_section(
    assumptions: list[dict[str, str]], *, language: str
) -> str:
    """Build the user-facing Assumptions section (guessed rules only)."""
    guessed = [a for a in assumptions if a.get("source") == "guessed"]
    if not guessed:
        return ""
    heading = "فرضیات" if language == "fa" else "Assumptions"
    closing = (
        "اگر فرضیات بالا درست نیست، بگویید تا دوباره محاسبه کنم."
        if language == "fa"
        else "If any assumption above is wrong, say so and I can recalculate."
    )
    lines = [heading, ""]
    for assumption in guessed:
        item = assumption.get("item") or ""
        value = assumption.get("value_used") or ""
        impact = assumption.get("impact") or ""
        line = f"- {item}: {value}" if value else f"- {item}"
        if impact:
            line = f"{line} — {impact}"
        lines.append(line)
    lines.extend(["", closing])
    return "\n".join(lines)


def merge_assumptions_into_text_report(
    text_report: str,
    assumptions: list[dict[str, str]],
    *,
    language: str,
) -> str:
    """Append a formatted assumptions block when the model omitted it from prose."""
    section = format_assumptions_section(assumptions, language=language)
    if not section:
        return text_report
    marker = "فرضیات" if language == "fa" else "Assumptions"
    if marker in text_report:
        return text_report
    base = (text_report or "").rstrip()
    return f"{base}\n\n{section}" if base else section


def _report_contract(ctx: dict[str, Any]) -> str:
    """Language and length rules for the text_report an agent writes."""
    language = _result_language(ctx)
    report_level = _normalize_report_type(ctx.get("report_type"))
    lang_line = (
        "Write text_report (and message) in Persian (فارسی). Keep SQL identifiers unchanged."
        if language == "fa"
        else "Write text_report (and message) in English. Keep SQL identifiers unchanged."
    )
    assumptions_line = (
        "End text_report with a فرضیات section listing every guessed business rule that affects "
        "the numbers (invoice status codes, returns/credits, amount column and VAT, date range, "
        "currency unit, inferred column meanings). Documented facts belong in the main answer, not "
        "in فرضیات. Finish with one short line inviting the user to confirm or correct."
        if language == "fa"
        else "End text_report with an Assumptions section listing every guessed business rule that "
        "affects the numbers (invoice status codes, returns/credits, amount column and VAT, date "
        "range, currency unit, inferred column meanings). Documented facts belong in the main "
        "answer, not in Assumptions. Finish with one short line inviting the user to confirm or "
        "correct."
    )
    return f"{_report_length_hint(report_level, language)}\n{lang_line}\n{assumptions_line}"


def _build_user_message(ctx: dict[str, Any]) -> str:
    language = ctx.get("language") or "en"
    parts = [
        f"User prompt:\n{ctx.get('prompt') or ''}",
        f"mode={ctx.get('mode') or ''}",
        f"language={language}",
        f"report_type={ctx.get('report_type') or ''}",
        f"chart_type={ctx.get('chart_type') or ''}",
        f"actor={json.dumps(ctx.get('actor') or {}, ensure_ascii=False)}",
    ]
    calendar_hint = calendar_hint_for_prompt(str(ctx.get("prompt") or ""))
    if calendar_hint:
        parts.append(calendar_hint)
    answers = _operator_answers_text(ctx)
    if answers:
        parts.append(answers)
    if web_search_allowed(ctx):
        parts.append("enable_web_search=true")
    brief = str(ctx.get("web_search_brief") or "").strip()
    if brief:
        parts.append(f"web_search_brief:\n{brief}")
    return "\n\n".join(parts)


def _parse_tool_args(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            data = json.loads(raw or "{}")
        except json.JSONDecodeError:
            return {}
        return data if isinstance(data, dict) else {}
    return {}


def _dispatch_tool(
    name: str,
    args: dict[str, Any],
    ctx: dict[str, Any],
) -> tuple[str, bool]:
    """Run one tool. Returns (result_json, done)."""
    if name == "execute_select":
        sql_text = str(args.get("sql") or "").strip()
        if not sql_text:
            return json.dumps({"ok": False, "error": "sql is required"}), False
        try:
            fetch = execute_select(
                sql_text, row_cap=DATA_GATHERER_MAX_ROWS, actor=ctx.get("actor")
            )
        except Exception as exc:  # noqa: BLE001
            err = _sql_error_message(exc)
            ctx["last_error"] = err
            return json.dumps({"ok": False, "error": err}), False
        ctx["sql_fetch"] = fetch
        ctx.pop("last_error", None)
        rows = fetch.get("rows") or []
        return (
            json.dumps(
                {
                    "ok": True,
                    "sql": fetch.get("sql"),
                    "columns": fetch.get("columns"),
                    "row_count": len(rows),
                    "preview": rows[:20],
                },
                ensure_ascii=False,
                default=str,
            ),
            False,
        )

    if name == "search_web":
        if not web_search_allowed(ctx):
            return json.dumps({"ok": False, "error": "web search is disabled"}), False
        queries = _normalize_web_search_queries(args.get("queries"))
        if not queries:
            return json.dumps({"ok": False, "error": "queries required (1–3)"}), False
        if ctx.get("_web_search_invoked"):
            return (
                json.dumps(
                    {
                        "ok": True,
                        "cached": True,
                        "web_search_brief": ctx.get("web_search_brief") or "",
                    },
                    ensure_ascii=False,
                ),
                False,
            )
        hits = search_web(queries)
        ctx["_web_search_invoked"] = True
        brief_lines: list[str] = []
        for hit in hits:
            if hit.get("error"):
                brief_lines.append(f"- error ({hit.get('query')}): {hit.get('error')}")
                continue
            title = hit.get("title") or "result"
            url = hit.get("url") or ""
            snippet = hit.get("snippet") or ""
            if url:
                brief_lines.append(f"- [{title}]({url}): {snippet}")
            else:
                brief_lines.append(f"- {title}: {snippet}")
        objective = str(args.get("objective") or "").strip()
        brief = ""
        if objective:
            brief += f"Objective: {objective}\n"
        brief += "\n".join(brief_lines) if brief_lines else "No web results."
        ctx["web_search_brief"] = brief
        ctx.setdefault("artifacts", {})["web-search"] = {
            "queries": queries,
            "hit_count": len(hits),
            "text": brief,
        }
        return (
            json.dumps(
                {"ok": True, "web_search_brief": brief, "hit_count": len(hits)},
                ensure_ascii=False,
            ),
            False,
        )

    return json.dumps({"ok": False, "error": f"Unknown tool: {name}"}), False


def _assistant_message_for_history(message: dict[str, Any]) -> dict[str, Any]:
    """Normalize assistant message for the next turn (drop null content when tools present)."""
    out: dict[str, Any] = {"role": "assistant"}
    content = message.get("content")
    tool_calls = message.get("tool_calls")
    if content is not None:
        out["content"] = content
    elif not tool_calls:
        out["content"] = ""
    if tool_calls:
        out["tool_calls"] = tool_calls
    return out


def _orchester_events(
    ctx: dict[str, Any],
    *,
    entry: str | None = None,
) -> Iterator[dict[str, Any]]:
    """Yield step events from the LangGraph pipeline (orchester → researcher).

    ``entry`` re-enters the graph at a node instead of at orchester — that is how a run parked on
    an operator question continues where it stopped.
    """
    from .pipeline_langgraph import langgraph_events

    yield from langgraph_events(ctx, entry=entry)


def _run_orchester(ctx: dict[str, Any]) -> tuple[str, str]:
    """Non-streaming entry (tests); drains tool-loop events."""
    for _ in _orchester_events(ctx):
        pass
    outcome = ctx.get("_orchester_outcome")
    if isinstance(outcome, tuple) and len(outcome) == 2:
        return str(outcome[0]), str(outcome[1])
    return "failed", str(ctx.get("last_error") or "Orchester produced no outcome")


def pipeline_events(
    prompt: str,
    mode: str,
    *,
    language: str = "en",
    report_type: str | None = None,
    chart_type: str | None = None,
    chart_types: list[str] | None = None,
    columns: list[str] | None = None,
    allow_operator_questions: bool = True,
    enable_web_search: bool = True,
    actor: dict[str, Any] | None = None,
) -> Iterator[str]:
    from .researcher_turn_loop import detect_prompt_language

    ctx: dict[str, Any] = {
        "prompt": prompt,
        "mode": mode,
        "language": language,
        "prompt_language": detect_prompt_language(prompt),
        "report_type": report_type,
        "chart_type": chart_type,
        "chart_types": chart_types,
        "columns": columns,
        "allow_operator_questions": allow_operator_questions,
        "enable_web_search": enable_web_search,
        "actor": actor or {"username": "guest", "is_admin": False, "is_guest": True},
        "artifacts": {},
        "run_id": uuid.uuid4().hex,
        "pipeline_started": _agent_time.time(),
        "step_log": [],
    }
    try:
        require_llm()
    except ValueError as exc:
        yield _error_event(str(exc), ctx=ctx, kind="llm")
        return

    provider = get_provider()
    provider_name = provider_label(provider)
    _ = get_pipeline_graph_for_mode(mode)

    effective_prompt = str(ctx.get("prompt") or prompt)
    user_message = _ui_text(
        language,
        f"Received prompt ({mode}/{language}) via {provider_name}: {effective_prompt[:120]}",
        f"درخواست دریافت شد ({mode}/{language}) از {provider_name}: {effective_prompt[:120]}",
    )
    yield _sse(
        _step_event(
            ctx,
            agent_id="user",
            status="done",
            message=user_message,
        )
    )

    pipeline_started = _agent_time.time()
    ctx.setdefault("pipeline_started", pipeline_started)

    display = agent_display_name("orchester")
    yield _sse(
        _step_event(
            ctx,
            agent_id="orchester",
            node_id="orchester",
            status="running",
            message=_ui_text(language, f"Running {display}…", f"در حال اجرای {display}…"),
        )
    )

    try:
        for step in _orchester_events(ctx):
            yield _sse(step)
    except Exception as exc:
        err_text = _sql_error_message(exc)
        yield _sse(
            _step_event(
                ctx,
                agent_id="orchester",
                node_id="orchester",
                status="failed",
                message=err_text,
            )
        )
        ctx["last_error"] = err_text
        yield _error_event(err_text, ctx=ctx, agent_id="orchester")
        return

    if ctx.get("_pending_question"):
        # The run asked the operator something. The question event already went out and the run
        # is parked; the answer request continues it from the node that asked.
        return

    yield from _pipeline_tail(ctx)


def result_chunk(payload: dict[str, Any], ctx: dict[str, Any]) -> str:
    """The run's final payload, stamped with how long the run took.

    The start time lives in ctx rather than in a closure so a resumed run still reports the
    duration from when it started, pause included.
    """
    started = ctx.get("pipeline_started")
    duration_s = (
        round(_agent_time.time() - float(started), 2)
        if isinstance(started, (int, float))
        else 0.0
    )
    payload = {**payload, "duration_s": duration_s, "token_usage": token_usage.snapshot(ctx)}
    rag = ctx.get("rag")
    if isinstance(rag, dict):
        payload["rag"] = rag
    return _sse({"event": "result", **payload})


def _pipeline_tail(ctx: dict[str, Any]) -> Iterator[str]:
    """Finish a run: report the outcome, then the packaged result or the failure."""
    outcome = ctx.get("_orchester_outcome")
    if isinstance(outcome, tuple) and len(outcome) == 2:
        status, message = str(outcome[0]), str(outcome[1])
    else:
        status, message = "failed", str(ctx.get("last_error") or "Orchester produced no outcome")

    yield _sse(
        _step_event(
            ctx,
            agent_id="orchester",
            node_id="orchester",
            status="done" if status not in ("failed", "fail") else "failed",
            message=message,
            result=status,
        )
    )

    if status in ("failed", "fail"):
        err_kind = "rejection" if status == "fail" and "not allowed" in message.lower() else None
        yield _error_event(message, ctx=ctx, agent_id="orchester", kind=err_kind)
        return

    if ctx.get("final_payload"):
        yield result_chunk(ctx["final_payload"], ctx)
        return
    try:
        result = _package_result(ctx)
    except Exception as exc:
        yield _error_event(_sql_error_message(exc), ctx=ctx)
        return
    yield result_chunk(result, ctx)


def resume_pipeline_events(run_id: str, answers: dict[str, Any]) -> Iterator[str]:
    """Continue a run that parked on an operator question.

    The answer is folded into ctx, so the resuming node (and every later prompt) sees it; the run
    then continues from the node that asked rather than replaying the agents that already ran.
    """
    from . import run_store

    paused = run_store.pop_paused(run_id)
    if paused is None:
        yield _sse(
            {
                "event": "error",
                "error": (
                    "This question expired — the run was dropped by the server. "
                    "Start the analysis again."
                ),
                "kind": "pause_expired",
                "run_id": str(run_id or ""),
            }
        )
        return

    ctx = paused["ctx"]
    _apply_answers(ctx, list(paused.get("questions") or []), answers or {})
    ctx.pop("_pending_question", None)
    entry = str(paused.get("node") or "")

    try:
        for step in _orchester_events(ctx, entry=entry):
            yield _sse(step)
    except Exception as exc:
        err_text = _sql_error_message(exc)
        ctx["last_error"] = err_text
        yield _sse(
            _step_event(
                ctx,
                agent_id=entry or "orchester",
                node_id=entry or "orchester",
                status="failed",
                message=err_text,
            )
        )
        yield _error_event(err_text, ctx=ctx, agent_id=entry or "orchester")
        return

    if ctx.get("_pending_question"):
        # It needs something else answered: it was parked again by the pipeline and the UI asks.
        return

    yield from _pipeline_tail(ctx)


def run_pipeline_sync(
    prompt: str,
    mode: str,
    *,
    language: str = "en",
    report_type: str | None = None,
    chart_type: str | None = None,
    chart_types: list[str] | None = None,
    columns: list[str] | None = None,
    allow_operator_questions: bool = True,
    enable_web_search: bool = True,
    actor: dict[str, Any] | None = None,
) -> dict[str, Any]:
    result: dict[str, Any] | None = None
    error: str | None = None
    question: str = ""
    for chunk in pipeline_events(
        prompt,
        mode,
        language=language,
        report_type=report_type,
        chart_type=chart_type,
        chart_types=chart_types,
        columns=columns,
        allow_operator_questions=allow_operator_questions,
        enable_web_search=enable_web_search,
        actor=actor,
    ):
        line = chunk.strip()
        if not line.startswith("data:"):
            continue
        payload = json.loads(line[5:].strip())
        if payload.get("event") == "result":
            result = {k: v for k, v in payload.items() if k != "event"}
        if payload.get("event") == "error":
            error = str(payload.get("error") or "Run failed")
        if payload.get("event") == "question":
            first = (payload.get("questions") or [{}])[0]
            question = str(first.get("text") or "") if isinstance(first, dict) else ""
    if error:
        raise ValueError(error)
    if not result and question:
        # Only the streaming endpoint can answer a paused run, so a synchronous caller is told to
        # use it rather than being handed a question it has no way to reply to.
        raise ValueError(
            f"This run is waiting for an answer: {question} — continue it from /api/runs/stream "
            "and /api/runs/<run_id>/answer."
        )
    if not result:
        missing = "Pipeline produced no result"
        _persist_failure(
            missing,
            ctx={
                "prompt": prompt,
                "mode": mode,
                "language": language,
            },
        )
        raise ValueError(missing)
    return result
