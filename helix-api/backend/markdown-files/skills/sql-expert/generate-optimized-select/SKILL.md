---
name: Generate Optimized Select
description: Turn a plain-English data ask from another agent into one safe, bounded,
  index-friendly SELECT, then return the rows and metadata. Read-only.
---

# generate-optimized-select

Input: `request` (plain English from the calling agent), optional `period`, `grain`, `limit`, `language`.
Output: `{ sql, row_count, columns, rows_preview, notes }` or `{ error, reason }`.

## Allowed schemas

Query ONLY these schemas: `Sales`, `Warehouse`, `dbo`, `global`, `Purchase`, `HumanResource`.

- Always schema-qualify every table and view, e.g. `Sales.Orders`, `dbo.Customers`. Never use an unqualified object name.
- Never reference any other schema, in FROM, JOIN, subqueries, CTEs, or EXISTS clauses. This holds even if the live catalog shows the object.
- If the answer needs a table outside these schemas, do not query it. Return `{ error, reason }` saying which table/schema is needed and that it is outside the allowed schemas.

## Procedure

1. Parse the ask. Name the grain (what one output row means), the measure (what is counted or summed), the period, and the filter. If any of these is missing and cannot be inferred from the catalog, return `{ error, reason }` naming the missing piece. Do not guess wide. Orchester decides the next step.
2. Introspect before writing. Read the live catalog for candidate tables, their keys, indexes, and date column types. Read the table Overview in the knowledge notes. Use only objects and columns that exist.
3. Pick the cheapest shape: the driving table, a selective filter, then lookups, then aggregate, then `TOP`/`FETCH`. Prefer a key or an explicit date range on the raw column.
4. Run the pre-flight checklist below. If any check fails, fix the SQL before running it.
5. Call `execute_select` once. Read `row_count`, the columns, and the preview.
6. If the result is empty, implausible, or errored, change exactly one thing (filter, period, or join key) and run one revision. Never resend identical SQL.
7. Return the result object. Include `notes` that state the grain, the filter that kept the query cheap, and any row cap that applied.

## Pre-flight checklist (must pass before execute)

- Single statement, `SELECT` or `WITH ... SELECT` only. No DML, DDL, `EXEC`, `MERGE`, `;`-separated batches, or temp-table writes.
- Every object is schema-qualified and belongs to an allowed schema (Sales, Warehouse, dbo, global, Purchase, HumanResource).
- Row limit present: `TOP (n)` (SQL Server), `FETCH FIRST n ROWS ONLY`, or `LIMIT n` (SQLite/Postgres). `n` is at most the server row cap. Aggregations that return few groups still get a limit.
- No `SELECT *`. List only the columns the answer needs.
- At least one selective predicate on an indexed or key column, or an explicit date range. A query with no selective predicate on a large table is rejected. Narrow it first.
- Sargable predicates only: raw column compared to a literal, `=`, range, `BETWEEN`, `IN (...)`. No function, `CAST`, `CONVERT`, arithmetic, or `LIKE '%...'` on the filtered column.
- Date filters use `col >= start AND col < next_start` on the raw column. Not `YEAR(col) = ...`, not `DATE(col) = ...`.
- Aggregate in SQL (`SUM`, `COUNT`, `GROUP BY`, window functions for top-N). Do not pull detail rows to total in code.
- Joins use declared keys. Joins are `INNER` or `LEFT` on keys. Never `CROSS JOIN` or a join with no key condition.
- Use `EXISTS` instead of `IN (SELECT ...)` on large tables.
- No `DISTINCT` or `ORDER BY` on an unbounded set without `TOP`/`LIMIT`. `ORDER BY` is allowed only with a limit.
- No nested views or user-defined functions in the filter path unless the catalog shows they are indexed.

## Rejected query patterns

Refuse these and explain why in `reason`:

- Full scan of a large table with no filter ("give me all rows").
- `SELECT *` or unbounded `SELECT` without `TOP`/`LIMIT`/`FETCH`.
- Cross or Cartesian joins.
- Functions on the filter column, leading-wildcard `LIKE`, or `OR` chains that cross indexed columns.
- Any write, DDL, stored procedure call, or multi-statement batch.
- Any object not in the live catalog.

## Retries

- One query per question. A retry must change one specific thing: a narrower filter, a corrected object or column, or an added join key.
- On a SQL error, rewrite once using `last_error`. Do not invent objects.
- After a second failure, return `{ error, reason }` and stop.

## Language

- When `language` is `fa` or the ask is in Persian, alias user-facing output columns to Persian labels (`AS <label>`). Catalog identifiers stay as-is.

## Constraints

- Read-only, and only through `execute_select`. No other connection or path.
- Never return credentials, connection strings, or raw schema dumps to the caller.
- Never run a query that was rejected by the checklist.
- Do not call `submit_result`. Return the result object to the calling agent.
