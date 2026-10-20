---
name: generate-optimized-select
description: Turn the goals and prompt into one safe, bounded, index-friendly SELECT, then use the rows for the report. Read-only.
---

# generate-optimized-select

Input: goals and the operator prompt, optional period, grain, limit, language.
Output: rows in `sql_fetch` via `execute_select`, then `what_was_done` and `text_report` from the preview.

## Allowed schemas

**Hard rule — no exceptions.** Query ONLY these schemas: `Sales`, `Warehouse`, `Global`, `dbo`, `Purchase`, `HumanResource`. Do not touch any other schema even if the live catalog lists it.

- Always schema-qualify every table and view, e.g. `Sales.Orders`, `[dbo].[Customers]`. Never use an unqualified object name.
- Never reference any other schema in `FROM`, `JOIN`, subqueries, nested joins, CTE bodies, or `EXISTS`. CTE *names* are not tables; only base table/view references are gated.
- Never use cross-database or linked-server forms: `OtherDb.schema.table`, three-part names with a database prefix, `OPENQUERY`, `OPENROWSET`, or linked-server paths.
- Never put `sys.*`, `INFORMATION_SCHEMA.*`, or engine metadata views inside `execute_select` SQL. Use the `describe_table` tool for column names and types instead.
- If the answer needs any disallowed object, stop with `result` fail and name the object/schema.

## Procedure

1. Parse the ask. Name the grain (what one output row means), the measure (what is counted or summed), the period, and the filter. If any of these is missing and cannot be inferred from the catalog, return `result` fail naming the missing piece. Do not guess wide.
2. Introspect before writing. Call `describe_table` on each candidate `schema.table`. Read the table Overview in the knowledge notes. When status codes, flags, or date storage is unclear, call `sample_rows` (up to five rows). Use only objects and columns that exist.
3. Pick the cheapest shape: the driving table, a selective filter, then lookups, then aggregate, then `TOP`/`FETCH`. Prefer a key or an explicit date range on the raw column.
4. Run the pre-flight checklist below. If any check fails, fix the SQL before running it.
5. Call `execute_select` with the final bounded SELECT. Read `row_count`, the columns, and the preview.
6. If the result is empty, implausible, or errored, change exactly one thing (filter, period, or join key) and run up to three `execute_select` revisions. Never resend identical SQL.
7. Write `what_was_done` and `text_report` from the preview numbers only, then return `result` done.

## Pre-flight checklist (must pass before execute)

- Single statement, `SELECT` or `WITH ... SELECT` only. No DML, DDL, `EXEC`, `MERGE`, `;`-separated batches, or temp-table writes.
- Every object is schema-qualified and belongs to an allowed schema only (`Sales`, `Warehouse`, `Global`, `dbo`, `Purchase`, `HumanResource`). No `sys`, `INFORMATION_SCHEMA`, other databases, unqualified names, or linked-server/cross-database syntax.
- Row limit present: `TOP (n)` (SQL Server), `FETCH FIRST n ROWS ONLY`, or `LIMIT n` (SQLite/Postgres). `n` is at most the server row cap. Aggregations that return few groups still get a limit.
- No `SELECT *`. List only the columns the answer needs.
- At least one selective predicate on an indexed or key column, or an explicit date range. A query with no selective predicate on a large table is rejected. Narrow it first.
- Sargable predicates only: raw column compared to a literal, `=`, range, `BETWEEN`, `IN (...)`. No function, `CAST`, `CONVERT`, arithmetic, or `LIKE '%...'` on the filtered column.
- Date filters use `col >= start AND col < next_start` on the raw column. Not `YEAR(col) = ...`, not `DATE(col) = ...`.
- Aggregate in SQL (`SUM`, `COUNT`, `GROUP BY`, window functions for top-N). Do not pull detail rows to total in prose.
- Joins use declared keys. Joins are `INNER` or `LEFT` on keys. Never `CROSS JOIN` or a join with no key condition.
- Use `EXISTS` instead of `IN (SELECT ...)` on large tables.
- No `DISTINCT` or `ORDER BY` on an unbounded set without `TOP`/`LIMIT`. `ORDER BY` is allowed only with a limit.
- No nested views or user-defined functions in the filter path unless the catalog shows they are indexed.

## Rejected query patterns

Refuse these and explain why in the fail message:

- Full scan of a large table with no filter ("give me all rows").
- `SELECT *` or unbounded `SELECT` without `TOP`/`LIMIT`/`FETCH`.
- Cross or Cartesian joins.
- Functions on the filter column, leading-wildcard `LIKE`, or `OR` chains that cross indexed columns.
- Any write, DDL, stored procedure call, or multi-statement batch.
- Any object not in the live catalog.
- Any table/view outside the allowed schemas, unqualified names, system catalogs (`sys`, `INFORMATION_SCHEMA`), or cross-database/linked-server syntax.

## Retries

- A retry must change one specific thing: a narrower filter, a corrected object or column, or an added join key.
- On an `execute_select` error, read the tool error text and rewrite (up to three failed attempts). Use `describe_table` if the error is an invalid column or object. Do not invent objects.
- After three failed `execute_select` attempts, return `result` fail and stop.

## Language

- When `language` is `fa`, alias user-facing output columns to Persian labels (`AS <label>`). Catalog identifiers stay as-is. The `language` value is the app locale, not the prompt language.

## Constraints

- Read-only, through `describe_table`, `sample_rows`, and `execute_select` only. No other connection or path.
- Never return credentials, connection strings, or raw schema dumps to the caller.
- Never run a query that was rejected by the checklist.
