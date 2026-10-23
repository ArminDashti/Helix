"""Read-only introspection tools for researcher SQL (schema allowlist, no user SQL)."""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from . import db_sql
from . import docs_catalog
from .pipeline_run import _dispatch_tool

ALLOWED_SCHEMAS = frozenset(
    {"Sales", "Warehouse", "Global", "dbo", "Purchase", "HumanResource"}
)

DESCRIBE_TABLE_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "describe_table",
        "description": (
            "Return columns, types, and documentation for one allowlisted table or view "
            "(schema.table). Use before guessing column names."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "description": "Fully qualified name, e.g. Warehouse.Kala",
                },
            },
            "required": ["table"],
        },
    },
}

SAMPLE_ROWS_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "sample_rows",
        "description": (
            "Return up to five sample rows from one allowlisted table (schema.table). "
            "Use to see status codes, date formats, or flag values before the final SELECT."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "description": "Fully qualified name, e.g. Global.MarkazPakhsh",
                },
                "limit": {
                    "type": "integer",
                    "description": "Row count 1-5 (default 5)",
                },
            },
            "required": ["table"],
        },
    },
}

SQL_EXPERT_TOOLS: list[dict[str, Any]] = [
    DESCRIBE_TABLE_TOOL,
    SAMPLE_ROWS_TOOL,
]


def _tool_error(message: str) -> str:
    return json.dumps({"ok": False, "error": message}, ensure_ascii=False)


def _tool_ok(payload: dict[str, Any]) -> str:
    return json.dumps({"ok": True, **payload}, ensure_ascii=False, default=str)


def _normalize_schema(schema: str) -> str:
    s = (schema or "").strip()
    if s.lower() == "dbschema":
        return "dbo"
    return s


@lru_cache(maxsize=1)
def _live_full_names() -> frozenset[str]:
    names: set[str] = set()
    try:
        for item in db_sql.list_tables():
            full = str(item.get("full_name") or "").strip()
            if not full:
                sch = str(item.get("schema") or "").strip()
                name = str(item.get("name") or item.get("table") or "").strip()
                full = f"{sch}.{name}" if sch and name else name
            if full:
                names.add(full.lower())
    except Exception:
        return frozenset()
    return frozenset(names)


def validate_allowlisted_table(table: str) -> tuple[str, str]:
    """Parse schema.table and ensure schema is allowlisted and object exists in live catalog."""
    raw = str(table or "").strip()
    if not raw:
        raise ValueError("table is required")
    schema, name = db_sql.parse_table_name(raw)
    schema = _normalize_schema(schema)
    if schema not in ALLOWED_SCHEMAS:
        raise ValueError(
            f"Schema {schema} is not allowlisted "
            f"(allowed: {', '.join(sorted(ALLOWED_SCHEMAS))})"
        )
    full = f"{schema}.{name}"
    live = _live_full_names()
    if live and full.lower() not in live:
        raise ValueError(f"Table {full} was not found in the live catalog")
    return schema, name


def describe_table(table: str) -> dict[str, Any]:
    schema, name = validate_allowlisted_table(table)
    full_name = f"{schema}.{name}"
    docs = docs_catalog.get_table_docs(full_name)
    columns = []
    for col in docs.get("columns") or []:
        if not isinstance(col, dict):
            continue
        columns.append(
            {
                "name": col.get("name"),
                "data_type": col.get("data_type"),
                "nullable": col.get("nullable"),
                "description": (col.get("description") or col.get("sql_description") or "").strip(),
            }
        )
    if not columns:
        try:
            for col in db_sql.list_columns(schema, name):
                if not isinstance(col, dict):
                    continue
                columns.append(
                    {
                        "name": col.get("name"),
                        "data_type": col.get("data_type"),
                        "nullable": col.get("nullable"),
                        "description": "",
                    }
                )
        except Exception:
            columns = []
    return {
        "table": docs.get("full_name") or full_name,
        "kind": docs.get("kind") or "table",
        "overview": (docs.get("overview") or "").strip(),
        "columns": columns,
        "source": docs.get("source") or ("live" if columns and not docs.get("columns") else docs.get("source")),
    }


def sample_rows(table: str, limit: int = 5) -> dict[str, Any]:
    schema, name = validate_allowlisted_table(table)
    row_limit = max(1, min(int(limit or 5), 5))
    fetch_limit = row_limit
    payload = db_sql.select_rows(
        table=f"{schema}.{name}",
        limit=fetch_limit,
        position="top",
    )
    rows = (payload.get("rows") or [])[:row_limit]
    return {
        "table": payload.get("table") or f"{schema}.{name}",
        "limit": row_limit,
        "columns": payload.get("columns") or [],
        "rows": rows,
        "row_count": len(rows),
    }


def researcher_sql_dispatch(name: str, args: dict[str, Any], ctx: dict[str, Any]) -> str:
    """Run one researcher warehouse tool and return JSON for the LLM tool result."""
    tool = str(name or "").strip()
    if tool in ("execute_select", "search_web"):
        payload, _done = _dispatch_tool(tool, args, ctx)
        return payload
    if tool == "describe_table":
        try:
            table = str(args.get("table") or "").strip()
            return _tool_ok(describe_table(table))
        except Exception as exc:  # noqa: BLE001
            ctx["last_error"] = str(exc)
            return _tool_error(str(exc))
    if tool == "sample_rows":
        try:
            table = str(args.get("table") or "").strip()
            limit = args.get("limit", 5)
            return _tool_ok(sample_rows(table, limit=int(limit) if limit is not None else 5))
        except Exception as exc:  # noqa: BLE001
            ctx["last_error"] = str(exc)
            return _tool_error(str(exc))
    return _tool_error(f"Unknown tool: {tool}")
