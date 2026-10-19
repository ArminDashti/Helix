"""Past-answer memory for sql-expert: save each question with the SQL that answered it.

A JSON file keyed next to the markdown store holds {request, sql} pairs. On a new ask the
closest matches (difflib similarity, stdlib) come back as few-shot examples for the prompt.
Repeats get faster and more accurate; no external embedding dependency.
"""

from __future__ import annotations

import json
import threading
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from django.conf import settings

# ponytail: O(n) scan per lookup on an in-memory list; fine up to thousands of
# examples. Upgrade to a vector index if the store outgrows one warehouse's ask set.
_MAX_EXAMPLES = 500
_LOCK = threading.Lock()


def _path() -> Path:
    return Path(settings.MARKDOWN_FILES_DIR) / "sql_memory.json"


def _load() -> list[dict[str, str]]:
    try:
        data = json.loads(_path().read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def save_example(request: str, sql: str) -> None:
    """Record a question with the SQL that answered it (deduped, newest last)."""
    ask, query = str(request or "").strip(), str(sql or "").strip()
    if not ask or not query:
        return
    with _LOCK:
        examples = [e for e in _load() if e.get("request") != ask or e.get("sql") != query]
        examples.append({"request": ask, "sql": query})
        if len(examples) > _MAX_EXAMPLES:
            examples = examples[-_MAX_EXAMPLES:]
        tmp = _path().with_suffix(".tmp")
        tmp.write_text(json.dumps(examples, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(_path())


def similar_examples(request: str, k: int = 3) -> list[dict[str, str]]:
    """Return up to k past examples most similar to the ask."""
    ask = str(request or "").strip().lower()
    if not ask:
        return []
    scored = [
        (SequenceMatcher(None, ask, e.get("request", "").lower()).ratio(), e)
        for e in _load()
        if e.get("request") and e.get("sql")
    ]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [e for score, e in scored[:k] if score > 0.3]
