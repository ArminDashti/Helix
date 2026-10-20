#!/usr/bin/env python3
"""Run Helix eval cases — see evals/EVAL_PLAN.md."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
API_ROOT = REPO_ROOT / "helix-api" / "backend"
ALLOWED_SCHEMAS = frozenset(
    {"sales", "warehouse", "global", "dbo", "purchase", "humanresource"}
)


def _setup_django() -> None:
    sys.path.insert(0, str(API_ROOT))
    import os

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "helix.settings")
    import django

    django.setup()


def load_cases(path: Path) -> list[dict[str, Any]]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("cases.yaml must be a list of cases")
    return [c for c in raw if isinstance(c, dict) and c.get("id")]


def _schemas_in_sql(sql: str) -> set[str]:
    found: set[str] = set()
    for match in re.finditer(
        r"\b(?:FROM|JOIN)\s+\[?([A-Za-z_][A-Za-z0-9_]*)\]?\.\[?([A-Za-z_][A-Za-z0-9_]*)\]?",
        sql or "",
        re.IGNORECASE,
    ):
        found.add(match.group(1).lower())
    return found


def _rows_equal(a: list[Any], b: list[Any]) -> bool:
    if len(a) != len(b):
        return False
    for left, right in zip(a, b):
        if isinstance(left, dict) and isinstance(right, dict):
            if sorted(left.items()) != sorted(right.items()):
                return False
        elif left != right:
            return False
    return True


def run_case(case: dict[str, Any], *, pipeline: bool) -> dict[str, Any]:
    from api.sql_execute import execute_select
    from api.researcher_query import run_sql_request

    check = str(case.get("check") or "same_rows")
    question = str(case.get("question") or "")
    ctx: dict[str, Any] = {
        "prompt": question,
        "mode": "grid",
        "language": case.get("language") or "en",
        "actor": {"username": "eval", "is_admin": True},
        "artifacts": {},
    }
    outcome: dict[str, Any] = {"id": case["id"], "check": check, "pass": False}

    if pipeline:
        from api.pipeline_run import _run_orchester

        status, message = _run_orchester(ctx)
        outcome["pipeline_status"] = status
        outcome["pipeline_message"] = message[:500]
        if check == "must_refuse":
            outcome["pass"] = status == "fail"
            return outcome
        if check == "must_clarify":
            outcome["pass"] = "question" in (message or "").lower() or ctx.get("paused")
            return outcome
        fetch = ctx.get("sql_fetch") if isinstance(ctx.get("sql_fetch"), dict) else {}
        sql = str(fetch.get("sql") or "")
        rows = fetch.get("rows") or []
    else:
        result = run_sql_request(question, ctx)
        outcome["researcher_sql_ok"] = bool(result.get("ok"))
        if check == "must_refuse":
            outcome["pass"] = not result.get("ok")
            outcome["reason"] = result.get("reason")
            return outcome
        if not result.get("ok"):
            outcome["reason"] = result.get("reason")
            return outcome
        sql = str(result.get("sql") or "")
        rows = result.get("preview") or []

    bad_schemas = _schemas_in_sql(sql) - ALLOWED_SCHEMAS
    if bad_schemas:
        outcome["error"] = f"disallowed schemas in SQL: {sorted(bad_schemas)}"
        return outcome

    expected_sql = case.get("expected_sql")
    if check in ("same_rows", "same_count", "contains_value") and expected_sql:
        try:
            expected_fetch = execute_select(str(expected_sql).strip())
            expected_rows = expected_fetch.get("rows") or []
        except Exception as exc:  # noqa: BLE001
            outcome["error"] = f"expected_sql failed: {exc}"
            return outcome
        if check == "same_count":
            outcome["pass"] = len(rows) == len(expected_rows)
        elif check == "same_rows":
            outcome["pass"] = _rows_equal(list(rows), list(expected_rows))
        else:
            outcome["pass"] = bool(rows)
    elif check == "must_refuse":
        outcome["pass"] = False
    elif check == "must_clarify":
        outcome["pass"] = False
    else:
        outcome["pass"] = bool(sql)

    outcome["sql"] = sql[:2000]
    outcome["row_count"] = len(rows) if isinstance(rows, list) else 0
    return outcome


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Helix eval cases")
    parser.add_argument(
        "--cases",
        type=Path,
        default=REPO_ROOT / "evals" / "cases.yaml",
    )
    parser.add_argument("--pipeline", action="store_true", help="Full orchester pipeline")
    parser.add_argument("--ids", nargs="*", help="Only run these case ids")
    parser.add_argument(
        "--write",
        choices=("latest", "baseline"),
        help="Write JSON summary to evals/",
    )
    args = parser.parse_args()

    _setup_django()
    cases = load_cases(args.cases)
    if args.ids:
        wanted = set(args.ids)
        cases = [c for c in cases if c.get("id") in wanted]

    results = [run_case(c, pipeline=args.pipeline) for c in cases]
    passed = sum(1 for r in results if r.get("pass"))
    summary = {
        "total": len(results),
        "passed": passed,
        "failed": len(results) - passed,
        "results": results,
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))

    if args.write:
        out = REPO_ROOT / "evals" / f"{args.write}.json"
        out.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Wrote {out}", file=sys.stderr)

    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
