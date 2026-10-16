---
name: gather-data
description: Resolve the ask, plan one cheap bounded SELECT, run it once, then hand off goals + what_was_done
---

# gather-data

1. Resolve the ask: when `db_intent.found`, gather for the resolved prompt and say so in `what_was_done`; otherwise use the prompt as given.
2. Look up before you write SQL: read the live catalog, the Overview of each candidate table in Table docs, and the retrieved knowledge notes. From them pick the grain (what one row means), the driving table, the join keys, and the single most selective filter on a column the user named.
3. Choose the cheapest shape: filter â†’ join lookups â†’ aggregate â†’ TOP (window function for top-N asks). Keep every predicate sargable, and express a period as an explicit range over the raw date column rather than a computed date expression.
4. Select only what the answer needs. If the ask is a total, a share, or a ranking, let SQL compute it â€” do not pull detail rows to add up in the report.
5. Call `execute_select` once â€” it is the MCP-backed database tool and the only path to the database â€” then read `row_count` and the preview. Check that the grain and the magnitude match the ask before treating the data as final.
6. On error, or on an empty or implausible result, change exactly one thing (predicate, period, or join) and run one revision. Never re-send identical SQL: it cannot return different data on the second try.
7. Set `goals` (the user ask) and `what_was_done` (SQL intent, row outcome, and which filter kept it cheap).
8. Finish with JSON `{goals, what_was_done, message}`; never call `submit_result`.
9. Public web search is offered only when this build enables it; data questions are answered from the database.

## Constraints

### Answer the question, not the table
1. SELECT (or CTE + SELECT) only. No writes, DDL, EXEC, or multi-statement write batches.
2. Use only objects and columns from the live catalog and the retrieved knowledge notes â€” never invent a table. The catalog wins on structure; the notes win on meaning. Read the table's Overview in Table docs (`references/tables.md` â†’ Description) before you use it, and follow what it says.
3. Bound every SELECT with TOP / FETCH / LIMIT inside the server row cap, and select only the columns the answer needs.

### Make the database do the work
4. Push work down: filter the driving table, then join lookups, then aggregate. Never aggregate first and filter rows afterwards.
5. Keep every predicate sargable: compare the raw column to a literal (equality, range, BETWEEN, IN). No function, CAST, or arithmetic on the filtered column, no leading-wildcard LIKE, and no long OR chain that an IN list expresses.
6. Filter on the most selective column the ask justifies: a key, an explicit period range on the date column, or a category named in the ask. A query without a selective filter is the slowest thing you can send.
7. Aggregate in SQL (SUM/COUNT/GROUP BY, window functions for top-N) instead of pulling detail rows the report would summarize, and prefer EXISTS over IN (SELECT â€¦) on large tables.
8. Date and period semantics come from the catalog, not from assumption: check how the column is stored (calendar, precision, timezone) before writing a range filter, and filter the raw column â€” not an expression over it.
9. The data target is the database configured in Settings (engine, host, name, credentials). Never assume a fixed schema, catalog, or table list: introspect first.

### Spend few queries, learn from each
10. One query per question. A retry must change something specific â€” a narrower filter or period, a corrected object, an added join key â€” never the same SQL re-sent.
11. Read the returned row count and error every time before deciding the data is right; a cheap query that answers the ask beats a broad one that needs a second pass.
12. On a SQL error, rewrite once using `last_error`; do not invent objects to work around it.
13. No `SELECT *` when `forbid_select_star` is on.
14. Ask the operator one question when the ask is genuinely ambiguous (period, grouping, two plausible tables) instead of guessing wide.
15. Emit `goals` and `what_was_done` before handoff and finish with JSON.
16. Reach the database only through the MCP-backed tool (`execute_select` / the configured SQL Server MCP) â€” never any other connection or path.

### Persian runs
17. When the run is Persian (language=fa or a Persian ask), alias every user-facing output column to a Persian label (`SELECT â€¦ AS <Persian label>`) so Persian report tables carry Persian headers; the catalog identifiers in the query itself stay untranslated.
