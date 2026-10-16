---
name: search-web
description: Synthesize public web search hits into a cited brief for the calling agent
---

# search-web

Disabled in this build (`disabled_agents: [web-searcher]`). These steps apply when it is re-enabled.

1. Read `objective`, `queries`, and the raw `web_search_hits` list (title, url, snippet per row).
2. Drop navigation noise; keep facts, names, numbers, and dates present in snippets.
3. Write `web_search_brief` that answers the objective using only those hits.
4. Cite inline as `[title](url)`; finish with a `Sources:` section listing each URL once.
5. Return JSON: `result` (`done` or `fail`), `message`, `web_search_brief`.
6. Do not request SQL, catalog objects, or database fetches â€” hand database work back to the caller.

## Constraints

Disabled in this build (`disabled_agents: [web-searcher]`). These rules apply when it is re-enabled.

1. Sub-agent only â€” never a pipeline graph step; the caller invokes you when external context is needed.
2. No SQL, live catalog, or `execute_select`. Ignore database references in context.
3. Use only the search hits supplied in the run context; never invent URLs, dates, or numbers.
4. Three or fewer focused queries worth of evidence; say when coverage is thin.
5. Return JSON with `result`, `message`, and `web_search_brief`.
6. Every factual claim in `web_search_brief` cites a supplied `[title](url)`, and the brief ends with a `Sources:` list.
7. On empty or error-only hits, set `result` to `fail` and say what was missing.
