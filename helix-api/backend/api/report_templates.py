"""Ready-to-use report templates stored in helix.config.yaml."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .config_loader import AGENT_ID_RE, load_config, save_config
from .demo import VALID_CHART_TYPES, VALID_LANGUAGES, VALID_REPORT_TYPES

_MAX_PROMPT_CHARS = 12_000
_MAX_DESC_CHARS = 500
_MAX_NAME_CHARS = 120
_MAX_GRID_COLUMNS = 40
_MAX_CHART_TYPES = 4

_DEFAULT_OUTPUTS = {"chart": True, "grid": False, "research": False}


def _normalize_outputs(raw: Any) -> dict[str, bool]:
    if not isinstance(raw, dict):
        return dict(_DEFAULT_OUTPUTS)
    return {
        "chart": bool(raw.get("chart")),
        "grid": bool(raw.get("grid")),
        "research": bool(raw.get("research")),
    }


def _coerce_chart_types(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return ["bar"]
    out: list[str] = []
    for item in raw:
        key = str(item or "").strip()
        if key in VALID_CHART_TYPES and key not in out:
            out.append(key)
        if len(out) >= _MAX_CHART_TYPES:
            break
    return out or ["bar"]


def _coerce_grid_columns(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        text = str(item or "").strip()
        if not text or text in out:
            continue
        out.append(text[:120])
        if len(out) >= _MAX_GRID_COLUMNS:
            break
    return out


def _normalize_entry(entry: Any) -> dict[str, Any] | None:
    if not isinstance(entry, dict):
        return None
    tid = str(entry.get("id") or "").strip()
    if not tid or not AGENT_ID_RE.match(tid):
        return None
    name = str(entry.get("name") or "").strip() or tid
    if len(name) > _MAX_NAME_CHARS:
        name = name[:_MAX_NAME_CHARS]
    description = str(entry.get("description") or "").strip()[:_MAX_DESC_CHARS]
    prompt = str(entry.get("prompt") or "").strip()
    if not prompt:
        return None
    if len(prompt) > _MAX_PROMPT_CHARS:
        prompt = prompt[:_MAX_PROMPT_CHARS]
    outputs = _normalize_outputs(entry.get("outputs"))
    if not outputs["chart"] and not outputs["grid"] and not outputs["research"]:
        outputs = dict(_DEFAULT_OUTPUTS)
    report_type = str(entry.get("report_type") or "low").strip()
    if report_type not in VALID_REPORT_TYPES:
        report_type = "low"
    language = str(entry.get("language") or "en").strip()
    if language not in VALID_LANGUAGES:
        language = "en"
    chart_types = _coerce_chart_types(entry.get("chart_types"))
    if not outputs["chart"]:
        chart_types = []
    grid_columns = _coerce_grid_columns(entry.get("grid_columns"))
    if not outputs["grid"]:
        grid_columns = []
    return {
        "id": tid,
        "name": name,
        "description": description,
        "prompt": prompt,
        "outputs": outputs,
        "report_type": report_type,
        "chart_types": chart_types,
        "grid_columns": grid_columns,
        "language": language,
        "allow_operator_questions": bool(entry.get("allow_operator_questions")),
        "disabled": bool(entry.get("disabled")),
    }


def _load_raw() -> list[dict[str, Any]]:
    data = load_config()
    raw = data.get("report_templates")
    if not isinstance(raw, list):
        return []
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for entry in raw:
        norm = _normalize_entry(entry)
        if not norm or norm["id"] in seen:
            continue
        seen.add(norm["id"])
        items.append(norm)
    return items


def _persist(items: list[dict[str, Any]]) -> None:
    data = load_config()
    data["report_templates"] = deepcopy(items)
    save_config(data)


def list_templates(*, include_disabled: bool = False) -> list[dict[str, Any]]:
    items = _load_raw()
    if include_disabled:
        return items
    return [t for t in items if not t.get("disabled")]


def get_template(template_id: str) -> dict[str, Any]:
    tid = str(template_id or "").strip()
    for item in _load_raw():
        if item["id"] == tid:
            return deepcopy(item)
    raise KeyError(f"Unknown template: {tid}")


def _validate_new_id(template_id: str) -> str:
    tid = str(template_id or "").strip()
    if not tid:
        raise ValueError("id is required")
    if not AGENT_ID_RE.match(tid):
        raise ValueError(
            "id must be lowercase letters, digits, hyphens, or underscores, starting with a letter"
        )
    return tid


def create_template(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("payload must be an object")
    tid = _validate_new_id(str(payload.get("id") or ""))
    items = _load_raw()
    if any(t["id"] == tid for t in items):
        raise FileExistsError(f"Template already exists: {tid}")
    draft = {**payload, "id": tid}
    norm = _normalize_entry(draft)
    if not norm:
        raise ValueError("prompt is required")
    items.append(norm)
    _persist(items)
    return deepcopy(norm)


def update_template(template_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("payload must be an object")
    tid = str(template_id or "").strip()
    items = _load_raw()
    current = None
    for item in items:
        if item["id"] == tid:
            current = item
            break
    if current is None:
        raise KeyError(f"Unknown template: {tid}")
    merged = {**current, **payload, "id": tid}
    norm = _normalize_entry(merged)
    if not norm:
        raise ValueError("prompt is required")
    for i, item in enumerate(items):
        if item["id"] == tid:
            items[i] = norm
            break
    _persist(items)
    return deepcopy(norm)


def delete_template(template_id: str) -> None:
    tid = str(template_id or "").strip()
    items = _load_raw()
    next_items = [t for t in items if t["id"] != tid]
    if len(next_items) == len(items):
        raise KeyError(f"Unknown template: {tid}")
    _persist(next_items)
