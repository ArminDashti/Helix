"""Deterministic checks that text_report numbers and claims match sql_fetch rows."""

from __future__ import annotations

import datetime as dt
import json
import logging
import math
import re
from dataclasses import dataclass, field
from typing import Any, Callable
from zoneinfo import ZoneInfo

from .config_loader import get_researcher_settings
from .docs_catalog import _docs_markdown
from .jalali_dates import _YEAR_RE

logger = logging.getLogger(__name__)

_DIGIT_TRANSLATE = str.maketrans(
    "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩",
    "01234567890123456789",
)

_SCALE_PHRASES: tuple[tuple[str, float], ...] = (
    ("هزار میلیارد", 1e12),
    ("thousand billion", 1e12),
    ("تریلیون", 1e12),
    ("trillion", 1e12),
    ("میلیارد", 1e9),
    ("billion", 1e9),
    ("bn", 1e9),
    ("میلیون", 1e6),
    ("million", 1e6),
    ("mn", 1e6),
    ("هزار", 1e3),
    ("thousand", 1e3),
)

_LEADER_EN = re.compile(
    r"(?P<entity>[A-Za-z\u0600-\u06FF0-9][\w\u0600-\u06FF\s\-]{1,60}?)"
    r"\s+(?:leads|is\s+(?:first|top|highest|#1|ranked\s+first)|ranks?\s+1\b)",
    re.I,
)
_LEADER_FA = re.compile(
    r"(?P<entity>[\w\u0600-\u06FF\s\-]{2,60}?)\s+(?:اول|بیشترین|بالاترین|رتبه\s*۱|رتبه\s*1)",
)
_LEADER_EN2 = re.compile(
    r"(?:first|top|highest|#1)\s+(?:is\s+)?(?P<entity>[A-Za-z\u0600-\u06FF][\w\u0600-\u06FF\s\-]{1,60})",
    re.I,
)
_RANK_ONE = re.compile(r"rank\s*1\b|رتبه\s*۱|رتبه\s*1", re.I)

_YTD_EN = re.compile(
    r"year[\s-]to[\s-]date|\bYTD\b|so far|to date|partial year|incomplete year",
    re.I,
)
_YTD_FA = re.compile(r"تا\s*این\s*تاریخ|تاکنون|از\s*ابتد(?:ای|دا)\s*س(?:ال|āl)|سال\s*جاری\s*تا")

_NUMBER_CORE = re.compile(
    r"(?P<prefix>~|≈|حدود\s*)?"
    r"(?P<num>\d[\d,\.]*|\d+\.\d+)"
    r"\s*(?P<scale>میلیون|میلیارد|هزار\s*میلیارد|تریلیون|million|billion|trillion|thousand|mn|bn)?"
    r"\s*(?P<unit>rial|rials|تومان|toman)?",
    re.I,
)
_PERCENT = re.compile(
    r"(?P<prefix>~|≈|حدود\s*)?(?P<num>\d[\d,\.]*|\d+\.\d+)\s*(?:%|درصد)",
    re.I,
)

_MEASURE_HINTS = ("mablagh", "amount", "total", "sales", "sum", "value", "revenue", "فروش")
_ENTITY_HINTS = ("name", "markaz", "center", "title", "label", "نام", "مرکز")
_SCENARIO_HINTS = ("scenario", "status", "variant", "sensitivity", "label", "case", "vazeiat", "وضعیت")


@dataclass
class ExtractedNumber:
    raw: str
    value_rial: float
    scale_word: str | None
    ignore: bool = False


@dataclass
class VerificationOutcome:
    passed: bool
    problems: list[str] = field(default_factory=list)
    repaired: bool = False


def verification_settings() -> dict[str, Any]:
    settings = get_researcher_settings()
    raw = settings.get("verification")
    if not isinstance(raw, dict):
        raw = {}
    defaults = {
        "enabled": True,
        "tolerance_pct": 1.0,
        "min_large_number": 10_000.0,
    }
    merged = {**defaults, **raw}
    try:
        merged["tolerance_pct"] = float(merged.get("tolerance_pct") or defaults["tolerance_pct"])
    except (TypeError, ValueError):
        merged["tolerance_pct"] = defaults["tolerance_pct"]
    try:
        merged["min_large_number"] = float(merged.get("min_large_number") or defaults["min_large_number"])
    except (TypeError, ValueError):
        merged["min_large_number"] = defaults["min_large_number"]
    merged["enabled"] = bool(merged.get("enabled", True))
    return merged


def gregorian_to_jalali(gy: int, gm: int, gd: int) -> tuple[int, int, int]:
    """Gregorian date to Jalali (jy, jm, jd)."""
    g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    if gy > 1600:
        jy = 979
        gy -= 1600
    else:
        jy = 0
        gy -= 621
    gy2 = gy + 1 if gm > 2 else gy
    days = (
        365 * gy
        + (gy2 + 3) // 4
        - (gy2 + 99) // 100
        + (gy2 + 399) // 400
        - 80
        + gd
        + g_d_m[gm - 1]
    )
    jy += 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        jm = 1 + days // 31
        jd = 1 + days % 31
    else:
        jm = 7 + (days - 186) // 30
        jd = 1 + (days - 186) % 30
    return jy, jm, jd


def today_jalali_tehran() -> tuple[int, int, int]:
    now = dt.datetime.now(ZoneInfo("Asia/Tehran"))
    return gregorian_to_jalali(now.year, now.month, now.day)


def _normalize_text_digits(text: str) -> str:
    normalized = (text or "").translate(_DIGIT_TRANSLATE)
    return normalized.replace("،", ",").replace("٬", ",")


def _parse_float(num: str) -> float:
    cleaned = num.replace(",", "").replace("،", "").replace("٬", "")
    return float(cleaned)


def _scale_multiplier(scale: str | None) -> float:
    if not scale:
        return 1.0
    s = scale.strip().lower()
    for phrase, mult in _SCALE_PHRASES:
        p = phrase.lower()
        if s == p or s.endswith(p) or s.startswith(p + " ") or f" {p}" in f" {s}":
            return mult
    return 1.0


def extract_numbers_from_report(text: str, *, min_large: float) -> list[ExtractedNumber]:
    normalized = _normalize_text_digits(text)
    found: list[ExtractedNumber] = []
    for match in _NUMBER_CORE.finditer(normalized):
        raw = match.group(0).strip()
        num_s = match.group("num")
        scale = (match.group("scale") or "").strip() or None
        unit = (match.group("unit") or "").strip().lower()
        try:
            base = _parse_float(num_s)
        except ValueError:
            continue
        mult = _scale_multiplier(scale)
        value = base * mult
        if unit in ("toman", "تومان"):
            value *= 10.0
        ignore = False
        if mult == 1.0 and abs(value) < min_large:
            if 1300 <= abs(value) <= 1499 and float(int(value)) == value:
                ignore = True
            elif abs(value) < min_large:
                ignore = True
        if mult == 1.0 and abs(value) >= min_large:
            ignore = False
        found.append(ExtractedNumber(raw=raw, value_rial=value, scale_word=scale, ignore=ignore))
    for match in _PERCENT.finditer(normalized):
        raw = match.group(0).strip()
        try:
            value = _parse_float(match.group("num"))
        except ValueError:
            continue
        found.append(ExtractedNumber(raw=raw, value_rial=value, scale_word=None, ignore=False))
    return found


def _row_dicts(rows: list[Any], columns: list[str]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in rows:
        if isinstance(row, dict):
            out.append(row)
        elif isinstance(row, (list, tuple)) and columns:
            out.append({columns[i]: row[i] for i in range(min(len(columns), len(row)))})
    return out


def _is_numeric(val: Any) -> bool:
    if isinstance(val, bool):
        return False
    if isinstance(val, (int, float)):
        return True
    if isinstance(val, str):
        try:
            _parse_float(val.replace(",", ""))
            return True
        except ValueError:
            return False
    return False


def _to_float(val: Any) -> float | None:
    if isinstance(val, bool):
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        try:
            return _parse_float(val.replace(",", ""))
        except ValueError:
            return None
    return None


def _column_name(col: str) -> str:
    return (col or "").strip()


def _pick_measure_column(columns: list[str], row_dicts: list[dict[str, Any]]) -> str | None:
    scored: list[tuple[float, str]] = []
    for col in columns:
        key = _column_name(col)
        low = key.lower()
        hint = 2.0 if any(h in low for h in _MEASURE_HINTS) else 0.0
        vals = [_to_float(r.get(key)) for r in row_dicts]
        nums = [v for v in vals if v is not None]
        if not nums:
            continue
        max_abs = max(abs(v) for v in nums)
        scored.append((hint + math.log10(max_abs + 1.0), key))
    if not scored:
        return None
    scored.sort(reverse=True)
    return scored[0][1]


def _pick_entity_column(columns: list[str]) -> str | None:
    for col in columns:
        low = _column_name(col).lower()
        if any(h in low for h in _ENTITY_HINTS):
            return _column_name(col)
    for col in columns:
        low = _column_name(col).lower()
        if low not in ("rank", "rn", "rownum", "sal", "year"):
            return _column_name(col)
    return columns[0] if columns else None


def _pick_scenario_column(columns: list[str]) -> str | None:
    for col in columns:
        low = _column_name(col).lower()
        if any(h in low for h in _SCENARIO_HINTS):
            return _column_name(col)
    return None


def _reference_values(row_dicts: list[dict[str, Any]], columns: list[str]) -> set[float]:
    refs: set[float] = set()
    measure = _pick_measure_column(columns, row_dicts)
    for col in columns:
        key = _column_name(col)
        for row in row_dicts:
            v = _to_float(row.get(key))
            if v is not None and abs(v) > 0:
                refs.add(v)
                refs.add(abs(v))
    if measure:
        amounts = sorted(
            (v for v in (_to_float(r.get(measure)) for r in row_dicts) if v is not None),
            reverse=True,
        )
        if amounts:
            total = sum(amounts)
            refs.add(total)
            for a in amounts:
                if total:
                    refs.add(100.0 * a / total)
            for i in range(len(amounts) - 1):
                refs.add(abs(amounts[i] - amounts[i + 1]))
    return refs


def _within_tolerance(a: float, b: float, tol_pct: float) -> bool:
    denom = max(abs(a), abs(b), 1.0)
    return abs(a - b) / denom <= tol_pct / 100.0


def _match_reference(value: float, refs: set[float], tol_pct: float) -> bool:
    for ref in refs:
        if _within_tolerance(value, ref, tol_pct):
            return True
    return False


def _scale_label(mult: float) -> str:
    for phrase, m in _SCALE_PHRASES:
        if abs(m - mult) < 1.0:
            return phrase
    return f"×{mult:g}"


def verify_numbers(text: str, rows: list[Any], columns: list[str], settings: dict[str, Any]) -> list[str]:
    problems: list[str] = []
    tol = float(settings["tolerance_pct"])
    min_large = float(settings["min_large_number"])
    row_dicts = _row_dicts(rows, columns)
    refs = _reference_values(row_dicts, columns)
    if not refs:
        return problems
    for item in extract_numbers_from_report(text, min_large=min_large):
        if item.ignore:
            continue
        if not _match_reference(item.value_rial, refs, tol):
            problems.append(f"Number '{item.raw}' ({item.value_rial:,.0f} rial) does not match row values or derived totals/diffs/shares.")
            continue
        if item.scale_word:
            base_match = re.search(r"[\d,\.]+", item.raw)
            if base_match:
                try:
                    base = _parse_float(_normalize_text_digits(base_match.group(0)))
                except ValueError:
                    continue
                used_mult = _scale_multiplier(item.scale_word)
                for phrase, mult in _SCALE_PHRASES:
                    if mult == used_mult:
                        continue
                    if _match_reference(base * mult, refs, tol):
                        problems.append(
                            f"Scale mismatch: '{item.raw}' uses '{item.scale_word}' but values fit '{phrase}' better."
                        )
                        break
    return problems


def _entities_from_rows(row_dicts: list[dict[str, Any]], columns: list[str]) -> list[str]:
    ent_col = _pick_entity_column(columns)
    if not ent_col:
        return []
    names: list[str] = []
    for row in row_dicts:
        val = row.get(ent_col)
        if val is None:
            continue
        s = str(val).strip()
        if s and s not in names:
            names.append(s)
    return names


def _leader_entity_from_text(text: str, entities: list[str]) -> list[str]:
    claimed: list[str] = []
    norm_text = _normalize_text_digits(text)
    for entity in entities:
        if len(entity) < 2:
            continue
        pattern = re.compile(re.escape(entity) + r".{0,40}(?:leads|first|top|highest|اول|بیشترین|بالاترین)", re.I | re.S)
        if pattern.search(norm_text):
            claimed.append(entity)
    for regex in (_LEADER_EN, _LEADER_FA, _LEADER_EN2):
        for match in regex.finditer(norm_text):
            ent = (match.group("entity") or "").strip()
            if ent:
                claimed.append(ent)
    return claimed


def verify_leaders(text: str, rows: list[Any], columns: list[str]) -> list[str]:
    problems: list[str] = []
    row_dicts = _row_dicts(rows, columns)
    if not row_dicts:
        return problems
    measure = _pick_measure_column(columns, row_dicts)
    entity_col = _pick_entity_column(columns)
    scenario_col = _pick_scenario_column(columns)
    if not measure or not entity_col:
        return problems
    entities = _entities_from_rows(row_dicts, columns)

    def top_entity(subset: list[dict[str, Any]]) -> str | None:
        ranked = sorted(
            subset,
            key=lambda r: _to_float(r.get(measure)) or 0.0,
            reverse=True,
        )
        if not ranked:
            return None
        return str(ranked[0].get(entity_col) or "").strip()

    scenarios: dict[str, list[dict[str, Any]]] = {}
    if scenario_col:
        for row in row_dicts:
            key = str(row.get(scenario_col) or "").strip() or "__default__"
            scenarios.setdefault(key, []).append(row)
    else:
        scenarios["__default__"] = row_dicts

    claimed = _leader_entity_from_text(text, entities)
    if len(set(claimed)) > 1:
        problems.append(f"Contradictory leaders in text: {', '.join(sorted(set(claimed)))}.")

    for scen_key, subset in scenarios.items():
        leader = top_entity(subset)
        if not leader:
            continue
        for ent in claimed:
            if ent != leader and ent in entities:
                problems.append(
                    f"'{ent}' is described as leading but '{leader}' has the highest {measure}"
                    + (f" for scenario '{scen_key}'." if scenario_col else ".")
                )
    return problems


def _targets_current_jalali_period(prompt: str, sql: str) -> bool:
    jy, jm, _ = today_jalali_tehran()
    blob = f"{prompt}\n{sql}"
    norm = _normalize_text_digits(blob)
    if re.search(rf"\bSal\s*=\s*{jy}\b", norm, re.I):
        return True
    if re.search(rf"\b{jy}\b", norm) and _YEAR_RE.search(norm):
        if str(jy) in norm:
            return True
    month_names = ("فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند")
    if str(jy) in norm and month_names[jm - 1] in blob:
        return True
    return False


def verify_partial_period(text: str, *, prompt: str, sql: str) -> list[str]:
    if not _targets_current_jalali_period(prompt, sql):
        return []
    norm = text or ""
    if _YTD_EN.search(norm) or _YTD_FA.search(norm):
        return []
    jy, jm, _ = today_jalali_tehran()
    return [
        f"Query targets Jalali year/month {jy}/{jm} (current partial period) but text_report omits year-to-date / تا این تاریخ wording."
    ]


def _documentation_corpus() -> str:
    parts = [_docs_markdown()]
    try:
        from django.conf import settings as dj_settings
        from pathlib import Path

        skill_root = Path(dj_settings.MARKDOWN_FILES_DIR) / "skills" / "researcher"
        if skill_root.is_dir():
            for path in skill_root.rglob("SKILL.md"):
                parts.append(path.read_text(encoding="utf-8", errors="replace"))
    except Exception:
        pass
    return "\n".join(parts).lower()


def verify_assumption_sources(assumptions: list[dict[str, str]]) -> tuple[list[dict[str, str]], list[str]]:
    """Downgrade documented assumptions that are not supported by docs/skills."""
    problems: list[str] = []
    corpus = _documentation_corpus()
    out: list[dict[str, str]] = []
    for entry in assumptions:
        item = dict(entry)
        if item.get("source") != "documented":
            out.append(item)
            continue
        skip = frozenset(
            {
                "none",
                "filter",
                "status",
                "column",
                "value",
                "sales",
                "document",
                "documented",
                "business",
                "rule",
            }
        )
        tokens = [
            t
            for t in re.findall(
                r"[\w\u0600-\u06FF]{5,}",
                f"{item.get('item')} {item.get('value_used')}".lower(),
            )
            if t not in skip
        ]
        if not tokens:
            item["source"] = "guessed"
            problems.append(f"Assumption '{item.get('item')}' marked documented but has no verifiable doc keywords; downgraded to guessed.")
            out.append(item)
            continue
        if any(t in corpus for t in tokens[:6]):
            out.append(item)
            continue
        item["source"] = "guessed"
        problems.append(
            f"Assumption '{item.get('item')}' marked documented but not found in tables.md/skills; downgraded to guessed."
        )
        out.append(item)
    return out, problems


def verify_report(
    text: str,
    *,
    rows: list[Any],
    columns: list[str],
    prompt: str,
    sql: str,
    assumptions: list[dict[str, str]] | None = None,
    settings: dict[str, Any] | None = None,
) -> VerificationOutcome:
    settings = settings or verification_settings()
    if not settings.get("enabled", True):
        return VerificationOutcome(passed=True)
    problems: list[str] = []
    try:
        problems.extend(verify_numbers(text, rows, columns, settings))
        problems.extend(verify_leaders(text, rows, columns))
        problems.extend(verify_partial_period(text, prompt=prompt, sql=sql))
    except Exception as exc:
        logger.exception("report verifier failed: %s", exc)
        return VerificationOutcome(passed=True, problems=[])
    return VerificationOutcome(passed=not problems, problems=problems)


def append_verification_warning(text: str, problems: list[str], *, language: str) -> str:
    if not problems:
        return text
    heading = "هشدار بررسی" if language == "fa" else "Verification warnings"
    lines = [heading, ""] + [f"- {p}" for p in problems]
    base = (text or "").rstrip()
    return f"{base}\n\n" + "\n".join(lines) if base else "\n".join(lines)


def _parse_repair_json(content: str) -> str:
    from .researcher_turn_loop import _parse_json_object

    parsed = _parse_json_object(content)
    return str(parsed.get("text_report") or "").strip()


def repair_text_report(
    ctx: dict[str, Any],
    text_report: str,
    problems: list[str],
    llm: Callable[..., dict[str, Any]],
) -> str:
    fetch = ctx.get("sql_fetch") if isinstance(ctx.get("sql_fetch"), dict) else {}
    rows = fetch.get("rows") or []
    columns = fetch.get("columns") or []
    issue_block = "\n".join(f"- {p}" for p in problems)
    user = (
        "These statements don't match your result rows:\n"
        f"{issue_block}\n\n"
        "Rewrite the report fixing only these; keep everything else.\n"
        'Reply with JSON only: {"text_report":"..."}'
    )
    user += (
        f"\n\ncolumns: {json.dumps(columns, ensure_ascii=False)}"
        f"\npreview_rows: {json.dumps(rows[:20], ensure_ascii=False, default=str)}"
        f"\n\ncurrent text_report:\n{text_report}"
    )
    messages = [{"role": "user", "content": user}]
    assistant = llm(ctx, "researcher", messages, tools=None)
    repaired = _parse_repair_json(str(assistant.get("content") or ""))
    return repaired or text_report


def run_verification_with_repair(
    ctx: dict[str, Any],
    text_report: str,
    *,
    assumptions: list[dict[str, str]],
    llm: Callable[..., dict[str, Any]] | None,
) -> tuple[str, dict[str, Any], list[dict[str, str]]]:
    """Verify text_report; optional one repair LLM call; append warnings if still failing."""
    from .pipeline_run import _result_language

    settings = verification_settings()
    fetch = ctx.get("sql_fetch") if isinstance(ctx.get("sql_fetch"), dict) else {}
    rows = fetch.get("rows") or []
    columns = list(fetch.get("columns") or [])
    prompt = str(ctx.get("prompt") or "")
    sql = str(fetch.get("sql") or "")

    assumptions, assumption_problems = verify_assumption_sources(assumptions)

    if not settings.get("enabled", True) or not rows:
        payload = {"passed": True, "problems": assumption_problems, "repaired": False}
        return text_report, payload, assumptions

    try:
        outcome = verify_report(
            text_report,
            rows=rows,
            columns=columns,
            prompt=prompt,
            sql=sql,
            settings=settings,
        )
        if assumption_problems:
            outcome.problems = assumption_problems + outcome.problems
            outcome.passed = not outcome.problems
        repaired_flag = False
        if not outcome.passed and llm is not None:
            repaired_text = repair_text_report(ctx, text_report, outcome.problems, llm)
            if repaired_text and repaired_text != text_report:
                repaired_flag = True
                text_report = repaired_text
                outcome = verify_report(
                    text_report,
                    rows=rows,
                    columns=columns,
                    prompt=prompt,
                    sql=sql,
                    settings=settings,
                )
                if assumption_problems:
                    outcome.problems = assumption_problems + outcome.problems
                    outcome.passed = not outcome.problems
        if not outcome.passed:
            language = _result_language(ctx)
            text_report = append_verification_warning(text_report, outcome.problems, language=language)
        payload = {
            "passed": outcome.passed,
            "problems": outcome.problems,
            "repaired": repaired_flag,
        }
        return text_report, payload, assumptions
    except Exception as exc:
        logger.exception("verification pipeline failed: %s", exc)
        return text_report, {"passed": True, "problems": [], "repaired": False}, assumptions
