"""Shared researcher tool loop: limits, steering, graceful completion, resumable state."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Literal

from .config_loader import get_researcher_settings
from .pipeline_run import _assistant_message_for_history, _parse_tool_args
from .sql_expert_tools import researcher_sql_dispatch

NUDGE_NO_TOOLS = (
    "Use describe_table, sample_rows, or execute_select. "
    "Do not reply with final JSON until execute_select has returned ok:true."
)

NUDGE_NO_TOOLS_PIPELINE = (
    "Use describe_table, sample_rows, or execute_select, then reply with the required JSON. "
    "Do not finish without a successful execute_select."
)

_TABLE_REF_RE = re.compile(
    r"\b(?:FROM|JOIN)\s+\[?([A-Za-z_][A-Za-z0-9_]*)\]?\.\[?([A-Za-z_][A-Za-z0-9_]*)\]?",
    re.IGNORECASE,
)

_PERSIAN_SCRIPT_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F]")


def detect_prompt_language(text: str) -> str:
    return "fa" if _PERSIAN_SCRIPT_RE.search(str(text or "")) else "en"


def prompt_language(ctx: dict[str, Any]) -> str:
    lang = str(ctx.get("prompt_language") or "").strip().lower()
    if lang in ("fa", "en"):
        return lang
    combined = f"{ctx.get('prompt') or ''} {ctx.get('goals') or ''}"
    return detect_prompt_language(combined)


def _steer(ctx: dict[str, Any], en: str, fa: str) -> str:
    return fa if prompt_language(ctx) == "fa" else en


def _tables_in_sql(sql: str) -> set[str]:
    found: set[str] = set()
    for match in _TABLE_REF_RE.finditer(sql or ""):
        found.add(f"{match.group(1)}.{match.group(2)}".lower())
    return found


def _prompt_table_hints(ctx: dict[str, Any]) -> set[str]:
    text = f"{ctx.get('prompt') or ''} {ctx.get('goals') or ''}".lower()
    hints: set[str] = set()
    for token in re.findall(r"[a-z_][a-z0-9_]{2,}", text):
        hints.add(token)
    return hints


@dataclass
class ResearcherCounters:
    raw_model_calls: int = 0
    effective_turns: int = 0
    execute_select_count: int = 0
    warned: bool = False
    seen_tables: set[str] = field(default_factory=set)

    def to_dict(self) -> dict[str, Any]:
        return {
            "raw_model_calls": self.raw_model_calls,
            "effective_turns": self.effective_turns,
            "execute_select_count": self.execute_select_count,
            "warned": self.warned,
            "seen_tables": sorted(self.seen_tables),
        }

    @classmethod
    def from_ctx(cls, ctx: dict[str, Any]) -> ResearcherCounters:
        saved = ctx.get("researcher_state")
        if isinstance(saved, dict) and isinstance(saved.get("counters"), dict):
            raw = saved["counters"]
            seen = raw.get("seen_tables") or []
            return cls(
                raw_model_calls=int(raw.get("raw_model_calls") or 0),
                effective_turns=int(raw.get("effective_turns") or 0),
                execute_select_count=int(raw.get("execute_select_count") or 0),
                warned=bool(raw.get("warned")),
                seen_tables=set(seen) if isinstance(seen, list) else set(),
            )
        return cls()


@dataclass
class ResearcherLoopResult:
    terminal: Literal["done", "partial", "fail", "needs_input", "error"]
    parsed: dict[str, Any] = field(default_factory=dict)
    message: str = ""


def _parse_json_object(text: str) -> dict[str, Any]:
    raw = (text or "").strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        pass
    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        try:
            data = json.loads(raw[start : end + 1])
            return data if isinstance(data, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _tool_payload_ok(content: str) -> bool:
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return False
    return bool(data.get("ok"))


def _tool_payload_error(content: str) -> str:
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return content
    return str(data.get("error") or data.get("reason") or "tool failed")


def _persist_state(
    ctx: dict[str, Any],
    messages: list[dict[str, Any]],
    counters: ResearcherCounters,
    turn_log: list[dict[str, Any]],
) -> None:
    fetch = ctx.get("sql_fetch") if isinstance(ctx.get("sql_fetch"), dict) else None
    last_sql = ""
    if fetch:
        last_sql = str(fetch.get("sql") or "")
    ctx["researcher_state"] = {
        "messages": messages,
        "sql_fetch": fetch,
        "last_sql": last_sql or str(ctx.get("last_sql") or ""),
        "last_error": str(ctx.get("last_error") or ""),
        "counters": counters.to_dict(),
        "turn_log": turn_log,
    }


def _append_turn_log(
    ctx: dict[str, Any],
    entry: dict[str, Any],
) -> list[dict[str, Any]]:
    log = ctx.setdefault("researcher_turn_log", [])
    if not isinstance(log, list):
        log = []
        ctx["researcher_turn_log"] = log
    log.append(entry)
    return log


def _limits_for_run(ctx: dict[str, Any], settings: dict[str, Any]) -> tuple[int, int]:
    max_turns = int(settings["max_turns"])
    extra = int(ctx.pop("_researcher_extension_budget", 0) or 0)
    if extra > 0:
        max_turns += extra
    raw_ceiling = max_turns * 2
    return max_turns, raw_ceiling


def _inject_steering(messages: list[dict[str, Any]], text: str) -> None:
    if text.strip():
        messages.append({"role": "user", "content": text.strip()})


def _drift_detected(ctx: dict[str, Any], counters: ResearcherCounters, sql: str) -> bool:
    if counters.execute_select_count < 1:
        return False
    tables = _tables_in_sql(sql)
    if not tables:
        return False
    hints = _prompt_table_hints(ctx)
    new_tables = tables - counters.seen_tables
    if not new_tables:
        return False
    for full in new_tables:
        name = full.split(".")[-1].lower()
        if name in hints or any(h in name or name in h for h in hints if len(h) > 3):
            return False
    return True


def _finalize_from_rows_pipeline(
    ctx: dict[str, Any],
    messages: list[dict[str, Any]],
    llm: Callable[..., dict[str, Any]],
    report_contract: str,
) -> dict[str, Any]:
    fetch = ctx.get("sql_fetch") if isinstance(ctx.get("sql_fetch"), dict) else {}
    rows = fetch.get("rows") or []
    user = _steer(
        ctx,
        "Write the final answer from these rows. Reply with JSON only "
        '(result done, what_was_done, text_report, message). Use only numbers from preview_rows.',
        "پاسخ نهایی را از این ردیف‌ها بنویس. فقط JSON (result done، what_was_done، text_report، message). "
        "فقط اعداد preview_rows.",
    )
    user += (
        f"\n\ncolumns: {json.dumps(fetch.get('columns') or [], ensure_ascii=False)}"
        f"\npreview_rows: {json.dumps(rows[:20], ensure_ascii=False, default=str)}"
    )
    final_messages = list(messages) + [{"role": "user", "content": user}]
    assistant = llm(ctx, "researcher", final_messages, tools=None)
    return _parse_json_object(str(assistant.get("content") or ""))


def _partial_payload(ctx: dict[str, Any], message: str) -> dict[str, Any]:
    fetch = ctx.get("sql_fetch") if isinstance(ctx.get("sql_fetch"), dict) else None
    last_sql = ""
    if fetch:
        last_sql = str(fetch.get("sql") or "")
    last_sql = last_sql or str(ctx.get("last_sql") or "")
    err = str(ctx.get("last_error") or "")
    missing = _steer(
        ctx,
        "Could not produce a full answer within the turn budget.",
        "نتوانستم در محدودیت نوبت‌ها پاسخ کامل بدهم.",
    )
    text = message or missing
    if last_sql:
        text += f"\n\nLast SQL:\n{last_sql}"
    if err:
        text += f"\n\nLast error:\n{err}"
    return {
        "result": "partial",
        "what_was_done": str(ctx.get("what_was_done") or "Partial research"),
        "text_report": text,
        "message": message or missing,
    }


def run_researcher_loop(
    ctx: dict[str, Any],
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    *,
    llm: Callable[..., dict[str, Any]],
    mode: Literal["pipeline", "eval"] = "pipeline",
    on_turn: Callable[[dict[str, Any]], None] | None = None,
    report_contract: str = "",
) -> ResearcherLoopResult:
    """Run the researcher tool loop until done, partial, or fail."""
    settings = get_researcher_settings()
    max_turns, raw_ceiling = _limits_for_run(ctx, settings)
    max_queries = int(settings["max_queries"])
    warn_at = min(int(settings["warn_at_turn"]), max_turns)

    counters = ResearcherCounters.from_ctx(ctx)
    turn_log: list[dict[str, Any]] = []
    if isinstance(ctx.get("researcher_turn_log"), list):
        turn_log = list(ctx["researcher_turn_log"])

    steering = str(ctx.pop("_researcher_steering", "") or "").strip()
    if steering:
        _inject_steering(messages, steering)

    pending_after_tools: str | None = None
    skip_effective_next = False
    parsed: dict[str, Any] = {}

    while True:
        if pending_after_tools:
            _inject_steering(messages, pending_after_tools)
            pending_after_tools = None

        if counters.effective_turns >= max_turns or counters.raw_model_calls >= raw_ceiling:
            fetch = ctx.get("sql_fetch") if isinstance(ctx.get("sql_fetch"), dict) else None
            rows = (fetch or {}).get("rows") or []
            if rows and mode == "pipeline":
                parsed = _finalize_from_rows_pipeline(ctx, messages, llm, report_contract)
                _persist_state(ctx, messages, counters, turn_log)
                return ResearcherLoopResult(terminal="done", parsed=parsed, message="")
            partial = _partial_payload(ctx, "")
            _persist_state(ctx, messages, counters, turn_log)
            return ResearcherLoopResult(
                terminal="partial",
                parsed=partial,
                message=str(partial.get("message") or ""),
            )

        if not counters.warned and counters.effective_turns >= warn_at:
            counters.warned = True
            left = max(0, max_turns - counters.effective_turns)
            _inject_steering(
                messages,
                _steer(
                    ctx,
                    f"{left} turns left. Write your final answer now.",
                    f"{left} نوبت مانده. همین الان پاسخ نهایی را بنویس.",
                ),
            )

        turn_index = counters.raw_model_calls + 1
        counted = not skip_effective_next
        skip_effective_next = False

        counters.raw_model_calls += 1
        if counted:
            counters.effective_turns += 1

        detail: dict[str, Any] = {
            "turn": turn_index,
            "counted": counted,
            "effective_turns": counters.effective_turns,
            "raw_model_calls": counters.raw_model_calls,
            "steering": steering or None,
        }
        steering = ""

        try:
            assistant = llm(ctx, "researcher", messages, tools=tools)
        except Exception as exc:  # noqa: BLE001
            _persist_state(ctx, messages, counters, turn_log)
            return ResearcherLoopResult(terminal="error", message=str(exc))

        tool_calls = assistant.get("tool_calls")
        if not isinstance(tool_calls, list) or not tool_calls:
            content = str(assistant.get("content") or "")
            parsed = _parse_json_object(content)
            if mode == "eval":
                if parsed.get("ok") is False and parsed.get("reason"):
                    return ResearcherLoopResult(terminal="fail", parsed=parsed, message=str(parsed["reason"]))
                fetch = ctx.get("sql_fetch") if isinstance(ctx.get("sql_fetch"), dict) else None
                if fetch and (fetch.get("rows") or []):
                    _persist_state(ctx, messages, counters, turn_log)
                    return ResearcherLoopResult(terminal="done", parsed=parsed)
                messages.append({"role": "assistant", "content": content})
                messages.append({"role": "user", "content": NUDGE_NO_TOOLS})
                skip_effective_next = True
                detail["nudge"] = True
                _append_turn_log(ctx, detail)
                if on_turn:
                    on_turn(detail)
                continue

            result = str(parsed.get("result") or "").strip().lower()
            if result in ("needs_input", "ask", "question") and str(parsed.get("question") or "").strip():
                _persist_state(ctx, messages, counters, turn_log)
                return ResearcherLoopResult(terminal="needs_input", parsed=parsed)
            if result in ("done", "") and parsed.get("text_report"):
                _persist_state(ctx, messages, counters, turn_log)
                return ResearcherLoopResult(terminal="done", parsed=parsed)
            if result in ("fail", "failed"):
                return ResearcherLoopResult(
                    terminal="fail",
                    parsed=parsed,
                    message=str(parsed.get("message") or ""),
                )
            messages.append({"role": "assistant", "content": content})
            messages.append({"role": "user", "content": NUDGE_NO_TOOLS_PIPELINE})
            skip_effective_next = True
            detail["nudge"] = True
            _append_turn_log(ctx, detail)
            if on_turn:
                on_turn(detail)
            continue

        messages.append(_assistant_message_for_history(assistant))
        tool_results: list[dict[str, Any]] = []
        all_failed = True
        steer_parts: list[str] = []

        for call in tool_calls:
            if not isinstance(call, dict):
                continue
            fn = call.get("function") if isinstance(call.get("function"), dict) else {}
            name = str(fn.get("name") or "").strip()
            args = _parse_tool_args(fn.get("arguments"))
            result_json = researcher_sql_dispatch(name, args, ctx)
            tool_results.append({"name": name, "args": args, "content": result_json})
            if _tool_payload_ok(result_json):
                all_failed = False
            else:
                steer_parts.append(
                    _steer(
                        ctx,
                        f"That query failed: {_tool_payload_error(result_json)}. "
                        "Fix it (use describe_table if needed).",
                        f"این پرس‌وجو خطا داد: {_tool_payload_error(result_json)}. "
                        "اصلاح کن (در صورت نیاز describe_table).",
                    )
                )

            if name == "execute_select":
                try:
                    payload = json.loads(result_json)
                except json.JSONDecodeError:
                    payload = {}
                if payload.get("ok"):
                    counters.execute_select_count += 1
                    sql_text = str(payload.get("sql") or args.get("sql") or "")
                    ctx["last_sql"] = sql_text
                    counters.seen_tables |= _tables_in_sql(sql_text)
                    row_count = int(payload.get("row_count") or 0)
                    if row_count > 0:
                        steer_parts.append(
                            _steer(
                                ctx,
                                "You have rows that may answer the question. Answer now unless something is clearly missing.",
                                "ردیف‌هایی داری که ممکن است جواب باشند. الان پاسخ بده مگر چیز مشخصی کم باشد.",
                            )
                        )
                    if counters.execute_select_count >= max_queries:
                        steer_parts.append(
                            _steer(
                                ctx,
                                f"Stop exploring. Answer the original question: {ctx.get('prompt') or ''}.",
                                f"کاوش را متوقف کن. به سؤال اصلی پاسخ بده: {ctx.get('prompt') or ''}.",
                            )
                        )
                    elif _drift_detected(ctx, counters, sql_text):
                        steer_parts.append(
                            _steer(
                                ctx,
                                f"Stop exploring. Answer the original question: {ctx.get('prompt') or ''}.",
                                f"کاوش را متوقف کن. به سؤال اصلی پاسخ بده: {ctx.get('prompt') or ''}.",
                            )
                        )

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": str(call.get("id") or name or "tool"),
                    "content": result_json,
                }
            )

        if all_failed and tool_results:
            counters.effective_turns = max(0, counters.effective_turns - (1 if counted else 0))

        tool_details: list[dict[str, Any]] = []
        for t in tool_results:
            row_count = None
            if t["name"] == "execute_select" and _tool_payload_ok(t["content"]):
                try:
                    row_count = json.loads(t["content"]).get("row_count")
                except json.JSONDecodeError:
                    row_count = None
            tool_details.append(
                {
                    "name": t["name"],
                    "args": t["args"],
                    "sql": str(t["args"].get("sql") or "") if t["name"] == "execute_select" else "",
                    "error": _tool_payload_error(t["content"]) if not _tool_payload_ok(t["content"]) else "",
                    "row_count": row_count,
                }
            )
        detail["tools"] = tool_details
        if steer_parts:
            pending_after_tools = steer_parts[-1]
            detail["steering"] = pending_after_tools

        _append_turn_log(ctx, detail)
        turn_log.append(detail)
        _persist_state(ctx, messages, counters, turn_log)
        if on_turn:
            on_turn(detail)

    return ResearcherLoopResult(terminal="fail", message="researcher loop ended unexpectedly")
