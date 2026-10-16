# Graph Report - helix  (2026-10-16)

## Corpus Check
- 210 files · ~434,984 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2412 nodes · 5475 edges · 132 communities (102 shown, 30 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.61)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1b95f99a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Database catalog
- markdown_store.py
- sqlserver.py
- views.py
- client.js
- pipeline_graph.py
- ResultsPage.jsx
- useI18n
- package.json
- tables/INDEX.md
- pipelineFlow.js
- tests.py
- dependencies
- pipeline_langgraph.py
- llm_client.py
- pipeline_run.py
- App.jsx
- SimpleTestCase
- config_loader.py
- LogsPage.jsx
- SettingsPage.jsx
- sample_database.py
- OperatorQuestionTests
- AgentAssetContractTests
- select_rag_context
- AnalysisPage.jsx
- Code Removal (Dead / Orphan Only)
- LiveSyncContext.jsx
- results_store.py
- FourAgentPipelineTests
- helix.mjs
- mcp_config.py
- run_store.py
- get_database_settings
- Template
- logs_store.py
- Testing Playground for Settings/API
- Workflow
- Code Removal (Dead / Orphan Only)
- Refactoring with GitNexus
- Detect Anti-Pattern
- Reuse task procedures
- GitNexus Guide
- Decision cues
- Commands
- Impact Analysis with GitNexus
- Debugging with GitNexus
- Exploring Codebases with GitNexus
- Redeploy and open a PR
- _package_result
- demo.py
- resolve_user_intent
- GitNexus — Code Intelligence
- Variable Naming Conventions
- Helix agents
- armin-dev-policies/SKILL.md
- Anti-pattern reference
- Workflow
- researcher
- web-searcher
- search_web
- researcher
- web-searcher
- Helix base instruction
- Helix product scope
- build-admin-guide-pdf.mjs
- GitNexus — Code Intelligence
- Software Versioning
- Armin Dev Policies
- final-approver
- guardian
- Researcher rules
- final-approver
- guardian
- Researcher rules
- Project Experience Log
- Orchester
- I18nContext.jsx
- Orchester
- Helix API
- Helix Web UI
- Database catalog
- graft
- main
- .agents/rules/ponytail.md
- reuse-task-procedures/INDEX.md
- DbExplorerPage.jsx
- 00-build-result.md
- skills/publish-result/SKILL.md
- 00-guard-prompt.md
- skills/guard-prompt/SKILL.md
- 00-orchester.md
- skills/orchestrate-pipeline/SKILL.md
- registry.md
- skills/gather-data/SKILL.md
- 00-web-search-only.md
- skills/search-web/SKILL.md
- DbExplorerObjectKindTests
- asgi.py
- settings.py
- wsgi.py
- build-result.md
- guard-prompt.md
- rules/orchester.md
- web-search-only.md
- final-approver/publish-result/SKILL.md
- guardian/guard-prompt/SKILL.md
- orchester/orchestrate-pipeline/SKILL.md
- researcher/gather-data/SKILL.md
- web-searcher/search-web/SKILL.md
- entrypoint.sh
- vite.config.js
- LogsCollectionTests
- _build_user_message
- org.py
- helix-cli/package.json
- app-lifecycle-cli/SKILL.md

## God Nodes (most connected - your core abstractions)
1. `Database catalog` - 486 edges
2. `useI18n()` - 84 edges
3. `requestJson()` - 64 edges
4. `save_config()` - 49 edges
5. `_error()` - 44 edges
6. `load_config()` - 40 edges
7. `ensure_dirs()` - 37 edges
8. `_json_body()` - 37 edges
9. `failMessage()` - 37 edges
10. `get_openrouter_settings()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `Ensure-Docker()` --calls--> `docker`  [INFERRED]
  scripts/redeploy-stack.ps1 → package.json
- `Ensure-Volume()` --calls--> `docker`  [INFERRED]
  scripts/redeploy-stack.ps1 → package.json
- `Ensure-Network()` --calls--> `docker`  [INFERRED]
  scripts/redeploy-stack.ps1 → package.json
- `Invoke-ComposeUp()` --calls--> `docker`  [INFERRED]
  scripts/redeploy-stack.ps1 → package.json
- `Remove-NamedVolumes()` --calls--> `docker`  [INFERRED]
  scripts/redeploy-stack.ps1 → package.json

## Import Cycles
- None detected.

## Communities (132 total, 30 thin omitted)

### Community 0 - "Database catalog"
Cohesion: 0.00
Nodes (486): AssetAccounting.ForoshAmval, AssetAccounting.ForoshAmvalSatr, AssetAccounting.vForoshAmval, AssetAccounting.vForoshAmvalSatr, BI.vwDimSalesDocumentType, BI.vwDimSalesKind, BI.vwFactSales, BI.vwFactSalesTarget (+478 more)

### Community 1 - "markdown_store.py"
Cohesion: 0.05
Nodes (121): parse_table_name(), _docs_markdown(), _ensure_table_section(), _escape_md_cell(), filter_tables_reference(), format_live_catalog_for_prompt(), get_table_docs(), list_docs_tables() (+113 more)

### Community 2 - "sqlserver.py"
Cohesion: 0.05
Nodes (75): BaseException, cell_value(), _looks_like_id_column(), parse_table_name(), prefer_id_order_column(), Any, Shared SQL introspection helpers for all database engines., Pick a default ORDER BY column: PK, then *Id / id, then lowest ordinal. (+67 more)

### Community 3 - "views.py"
Cohesion: 0.15
Nodes (66): csrf_exempt, admin_branding(), admin_database(), admin_openrouter(), admin_openrouter_chat_test(), admin_openrouter_models(), admin_pipeline_graph(), admin_provider() (+58 more)

### Community 4 - "client.js"
Cohesion: 0.08
Nodes (52): answerRun(), API_BASE, ApiError, apiFetch(), apiUrl(), configureSqlServerMcp(), createReference(), createUser() (+44 more)

### Community 5 - "pipeline_graph.py"
Cohesion: 0.08
Nodes (60): is_sub_agent(), _agent_count(), circuit_open_edge(), _collect_agent_ids(), compile_pipeline_flow(), _compile_stages(), _default_edge_id(), default_pipeline_flow() (+52 more)

### Community 6 - "ResultsPage.jsx"
Cohesion: 0.07
Nodes (63): fetchBranding(), fetchResult(), fetchResults(), applyTheme(), formatLinkStatus(), isConnectedStatus(), Layout(), readThemePreference() (+55 more)

### Community 7 - "useI18n"
Cohesion: 0.09
Nodes (33): createAgent(), createRule(), createSkill(), fetchDocsTable(), renameSkill(), saveDocsColumn(), saveDocsTableOverview(), testOpenRouterChat() (+25 more)

### Community 8 - "package.json"
Cohesion: 0.05
Nodes (45): author, bin, helix, description, engines, node, files, keywords (+37 more)

### Community 9 - "tables/INDEX.md"
Cohesion: 0.04
Nodes (35): Alphabetical (schema-table), By sales flow, Naming tip, Quick find, Sales tables index, Columns, Sales.DarkhastFaktor, Table overview (+27 more)

### Community 10 - "pipelineFlow.js"
Cohesion: 0.11
Nodes (43): fetchPipelineBundle(), fetchPipelineGraph(), AgentArrangeDesigner(), AgentGraphDesigner(), AgentGraphDesignerInner(), graphToFlowNodes(), nodeTypes, AgentPicker() (+35 more)

### Community 11 - "tests.py"
Cohesion: 0.11
Nodes (27): _catalog_with_auto(), fetch_openrouter_models(), get_active_provider_settings(), get_agent_model(), get_connectors(), get_llm_base_url(), get_openrouter_settings(), get_provider() (+19 more)

### Community 12 - "dependencies"
Cohesion: 0.05
Nodes (41): echarts, echarts-for-react, dependencies, echarts, echarts-for-react, html2canvas, html2pdf.js, jspdf (+33 more)

### Community 13 - "pipeline_langgraph.py"
Cohesion: 0.14
Nodes (39): Web search is off while the web-searcher sub-agent is disabled. The tool list…, web_search_enabled(), _ask_operator(), build_pipeline_graph(), _clarifying_questions(), _emit(), _entry_node(), get_compiled_graph() (+31 more)

### Community 14 - "llm_client.py"
Cohesion: 0.10
Nodes (37): _catalog_tables(), _match_tables_from_text(), Any, Guardian review of plain-language per-user data access., Ask the guardian LLM to accept/reject a plain-language data-access policy.…, review_data_access_policy(), get_llm_headers(), get_llm_timeout_seconds() (+29 more)

### Community 15 - "pipeline_run.py"
Cohesion: 0.14
Nodes (36): agent_display_name(), _append_step_log(), _apply_answers(), _assistant_message_for_history(), _error_event(), _failure_detail(), _failure_duration_s(), _failure_steps() (+28 more)

### Community 16 - "App.jsx"
Cohesion: 0.21
Nodes (22): fetchAgents(), fetchRules(), fetchSkills(), DataGrid(), FlashMessage(), StackedNames(), useLiveSync(), failMessage() (+14 more)

### Community 17 - "SimpleTestCase"
Cohesion: 0.14
Nodes (5): DocsCatalogPromptTests, PipelineAgentTests, RagKnowledgeStoreTests, ResultsStoreTests, SimpleTestCase

### Community 18 - "config_loader.py"
Cohesion: 0.08
Nodes (62): is_builtin_agent(), is_phase_agent(), is_pipeline_agent(), Canonical agent pipeline metadata., Kept for callers; phase-only roster is empty — always False., True for graph-eligible agents (orchester, guardian, researcher, final-…, Map graph instance id (e.g. guardian__2) to roster agent id., resolve_agent_definition_id() (+54 more)

### Community 19 - "LogsPage.jsx"
Cohesion: 0.20
Nodes (14): fetchLog(), fetchLogs(), agentDefinitionId(), CopyButton(), copyText(), DetailField(), formatDuration(), hasText() (+6 more)

### Community 20 - "SettingsPage.jsx"
Cohesion: 0.09
Nodes (31): ensureSampleTier(), fetchDatabaseSettings(), fetchOpenRouterModels(), fetchOpenRouterSettings(), fetchProviderSettings(), fetchSampleTiers(), saveBranding(), saveDatabaseSettings() (+23 more)

### Community 21 - "sample_database.py"
Cohesion: 0.11
Nodes (37): AppConfig, Connection, ApiConfig, is_user_provided_database(), True when the user configured a real database (not the built-in sample)., ensure_pyodbc_installed(), _has_published_pyodbc_wheel(), Any (+29 more)

### Community 22 - "OperatorQuestionTests"
Cohesion: 0.15
Nodes (9): OperatorQuestionTests, PausedRunStoreTests, _PauseSpoolMixin, Keep parked-run spool files out of the machine's real temp dir., A parked run must be answerable from a request that did not park it., A run can stop and ask the operator; the answer resumes the node that asked., Researcher turns: one SELECT, then the completion JSON., Fake LLM. ``answers`` maps agent id to responses consumed in call order.… (+1 more)

### Community 23 - "AgentAssetContractTests"
Cohesion: 0.22
Nodes (4): AgentAssetContractTests, One rule and one skill per agent, catalog-agnostic text, web search gated by…, Locate the web UI i18n directory, in-repo or via the Docker /host mount., The data target is whatever Settings points at, so the wording stays generic.…

### Community 24 - "select_rag_context"
Cohesion: 0.10
Nodes (28): _entry(), _fit(), _hits(), prompt_terms(), Any, Lexical retrieval over the RAG knowledge store (``markdown-files/rag/``). This…, Pack the knowledge documents that match ``prompt`` into a token budget. Returns…, Lowercased content words of a prompt, deduplicated in first-seen order. (+20 more)

### Community 25 - "AnalysisPage.jsx"
Cohesion: 0.14
Nodes (23): createResult(), fetchHealth(), subscribeApiErrors(), ErrorModal(), agentLabel(), formatElapsed(), RunProgressModal(), statusBadge() (+15 more)

### Community 26 - "Code Removal (Dead / Orphan Only)"
Cohesion: 0.10
Nodes (19): 1. Identify candidate targets, 2. Prove dead/orphan status (required), 3. Confirm no hidden connections, 4. Execute removal, 5. Validate and report, Code Removal (Dead / Orphan Only), Edge cases, Eligibility (all must pass) (+11 more)

### Community 27 - "LiveSyncContext.jsx"
Cohesion: 0.18
Nodes (12): apiUrl(), fetchStateVersion(), LiveSyncContext, LiveSyncProvider(), allResourcesFromPath(), anyListeners, emitLiveChange(), listeners (+4 more)

### Community 28 - "results_store.py"
Cohesion: 0.26
Nodes (19): _coerce_count(), _coerce_duration_s(), _coerce_rag(), _coerce_usage(), create_result(), delete_result(), _empty(), get_result() (+11 more)

### Community 29 - "FourAgentPipelineTests"
Cohesion: 0.13
Nodes (7): _dispatch_tool(), _guardian_hard_block(), _normalize_web_search_queries(), Run one tool. Returns (result_json, done) where done means submit_result…, Non-streaming entry (tests); drains tool-loop events., _run_orchester(), FourAgentPipelineTests

### Community 30 - "helix.mjs"
Cohesion: 0.13
Nodes (45): API_DIR, APP_DIR, applyPort(), cleanEnv(), CLI_DIR, cmdPort(), cmdRebuild(), cmdRun() (+37 more)

### Community 31 - "mcp_config.py"
Cohesion: 0.24
Nodes (22): delete_server(), ensure_sql_server(), import_servers(), list_servers(), mcp_config_path(), Any, Path, MCP server configuration helpers. Reads / writes Cursor's ``mcp.json``: list… (+14 more)

### Community 32 - "run_store.py"
Cohesion: 0.25
Nodes (17): _fresh(), pause_run(), peek_paused(), pop_paused(), _prune_locked(), Any, Path, Registry of pipeline runs parked on an operator question. A paused run keeps… (+9 more)

### Community 33 - "get_database_settings"
Cohesion: 0.21
Nodes (13): connection_string_to_database(), database_to_connection_string(), _explicit_warehouse_engine(), _finalize_database(), get_database_engine(), get_database_settings(), Normalize settings. Sample SQLite is only used when the engine is sqlite., Parse a connection string into database settings. (+5 more)

### Community 34 - "Template"
Cohesion: 0.18
Nodes (10): 🛠️ Changed, 🧠 Learning, Objective, Overview, ⚠️ Risks, Rules, 💡 Suggestions, Template (+2 more)

### Community 35 - "logs_store.py"
Cohesion: 0.31
Nodes (14): append_error(), classify_error_kind(), delete_log(), _empty(), get_log(), list_logs(), _load(), logs_path() (+6 more)

### Community 36 - "Testing Playground for Settings/API"
Cohesion: 0.13
Nodes (14): Components to Add:, Files to Modify:, Implementation Plan, Key Components:, Notes, Overview, Phase 1: Core Infrastructure, Phase 2: Testing Features (+6 more)

### Community 37 - "Workflow"
Cohesion: 0.14
Nodes (13): About Me Section, Examples, Objective, Safety rules, Step 1: Place the page, Step 2: Layout (match helix), Step 3: Write the bio (eloquent, unique), Step 4: Contact email (anti-crawl) (+5 more)

### Community 38 - "Code Removal (Dead / Orphan Only)"
Cohesion: 0.15
Nodes (12): Code Removal (Dead / Orphan Only), Edge cases, Eligibility (all must pass), Example 1 — Remove orphan helper, Example 2 — Refuse connected code, Example 3 — Unused file, Example 4 — Unused-files tree cleanup, Examples (+4 more)

### Community 39 - "Refactoring with GitNexus"
Cohesion: 0.17
Nodes (11): Bind the repository first, Checklists, Example: Rename `validateUser` to `authenticateUser`, Extract Module, Refactoring with GitNexus, Rename Symbol, Risk Rules, Split Function/Service (+3 more)

### Community 40 - "Detect Anti-Pattern"
Cohesion: 0.17
Nodes (12): Additional resources, Detect Anti-Pattern, Examples, Objective, Safety rules, Step 1: Scope, Step 2: Map structure, Step 3: Hunt by category (+4 more)

### Community 41 - "Reuse task procedures"
Cohesion: 0.17
Nodes (11): Layout, Never, Reuse task procedures, Script rules, Step 1: Search the index, Step 2: Decide whether to save it, and how, Step 3: Do the task, the way you will save it, Step 4: Follow a saved guide (+3 more)

### Community 42 - "GitNexus Guide"
Cohesion: 0.18
Nodes (10): Always Start Here, Control & data dependence (`pdg_query`), GitNexus Guide, Graph Schema, Paginating `list_repos`, Resources Reference, Shortest path between two symbols (`trace`), Skills (+2 more)

### Community 43 - "Decision cues"
Cohesion: 0.18
Nodes (10): Architecture, Common mistakes, Consider microservices only when, Decision cues, Eventing, Policy, Prefer Clean / Hexagonal inside modules when, Prefer modular monolith when (+2 more)

### Community 44 - "Commands"
Cohesion: 0.20
Nodes (9): After Indexing, analyze — Build or refresh the index, clean — Delete the index, Commands, GitNexus CLI Commands, list — Show all indexed repos, status — Check index freshness, Troubleshooting (+1 more)

### Community 45 - "Impact Analysis with GitNexus"
Cohesion: 0.20
Nodes (9): Bind the repository first, Checklist, Example: "What breaks if I change validateUser?", Impact Analysis with GitNexus, Risk Assessment, Tools, Understanding Output, When to Use (+1 more)

### Community 46 - "Debugging with GitNexus"
Cohesion: 0.22
Nodes (8): Bind the repository first, Checklist, Debugging Patterns, Debugging with GitNexus, Example: "Payment endpoint returns 500 intermittently", Tools, When to Use, Workflow

### Community 47 - "Exploring Codebases with GitNexus"
Cohesion: 0.22
Nodes (8): Bind the repository first, Checklist, Example: "How does payment processing work?", Exploring Codebases with GitNexus, Resources, Tools, When to Use, Workflow

### Community 48 - "Redeploy and open a PR"
Cohesion: 0.22
Nodes (8): 1. Detect Docker, 2. Rebuild + re-run (keep data), 2b. Non-Docker: close, reinstall, run, 3. Pull Request, 4. Final report, Cheat-sheet, Never, Redeploy and open a PR

### Community 49 - "_package_result"
Cohesion: 0.39
Nodes (8): _as_number(), build_echarts_option(), build_grid(), _is_number(), Any, Build ECharts options and grids from fetched SQL rows., _effective_mode(), _package_result()

### Community 50 - "demo.py"
Cohesion: 0.44
Nodes (8): _chart_option(), get_demo_result(), _grid_payload(), _normalize_mode(), _normalize_report_type(), Any, Demo result payload mirroring the frontend preview., _text_report()

### Community 51 - "resolve_user_intent"
Cohesion: 0.31
Nodes (8): _pick_request_tables(), Any, Resolve user intent by connecting to the configured database. The pipeline…, Rank tables: exact request/intent matches first, then any table., Quote identifier for sqlite/sqlserver/postgres (best-effort, no injection)., Connect to DB and find what the user actually wants. Returns a dict: { "found":…, resolve_user_intent(), _safe_identifier()

### Community 52 - "GitNexus — Code Intelligence"
Cohesion: 0.25
Nodes (7): Always Do, CLI, GitNexus — Code Intelligence, lean-ctx, Learned User Preferences, Never Do, Resources

### Community 53 - "Variable Naming Conventions"
Cohesion: 0.25
Nodes (7): Core Rules & AI Behavior, File & Directory Naming, Language Quicksheet, Naming Patterns, Precision Vocabulary, Suggesting Names, Variable Naming Conventions

### Community 54 - "Helix agents"
Cohesion: 0.25
Nodes (7): Contract: one rule and one skill per agent, Helix agents, Layout, Models, Pipeline, Protocol, Status

### Community 56 - "Anti-pattern reference"
Cohesion: 0.29
Nodes (7): Anti-pattern reference, Coupling & cohesion, Data & concurrency, Distribution, False positives (usually skip), Layering (typical clean/onion/n-tier), Structure

### Community 57 - "Workflow"
Cohesion: 0.29
Nodes (7): 1. Identify candidate targets, 2. Prove dead/orphan status (required), 3. Confirm no hidden connections, 4. Execute removal, 5. Validate and report, Unused-files mode (file-tree cleanup), Workflow

### Community 58 - "researcher"
Cohesion: 0.29
Nodes (6): Inputs, Notes, Outputs, researcher, Role, Tools

### Community 59 - "web-searcher"
Cohesion: 0.29
Nodes (6): Constraints, Inputs, Notes, Outputs, Role, web-searcher

### Community 60 - "search_web"
Cohesion: 0.38
Nodes (6): _ddg_search(), Any, Public web search for the web-searcher sub-agent (no database connection)., Run up to MAX_QUERIES distinct searches and return flat result rows., search_web(), _strip_tags()

### Community 61 - "researcher"
Cohesion: 0.29
Nodes (6): Inputs, Notes, Outputs, researcher, Role, Tools

### Community 62 - "web-searcher"
Cohesion: 0.29
Nodes (6): Constraints, Inputs, Notes, Outputs, Role, web-searcher

### Community 63 - "Helix base instruction"
Cohesion: 0.29
Nodes (6): Hard constraints, Helix base instruction, Output mindset, Pipeline order, Purpose, Where schema knowledge comes from

### Community 64 - "Helix product scope"
Cohesion: 0.29
Nodes (6): Always, Example, Helix product scope, How, Never, When

### Community 65 - "build-admin-guide-pdf.mjs"
Cohesion: 0.29
Nodes (5): __dirname, htmlPath, outDir, outPdf, root

### Community 66 - "GitNexus — Code Intelligence"
Cohesion: 0.33
Nodes (5): Always Do, CLI, GitNexus — Code Intelligence, Never Do, Resources

### Community 67 - "Software Versioning"
Cohesion: 0.33
Nodes (5): ⚠️ Agent Directive, Core Rules, Software Versioning, Version Bump Logic (On Commit/Push), Workflow

### Community 68 - "Armin Dev Policies"
Cohesion: 0.33
Nodes (6): Armin Dev Policies, Default loop (every change), Hard rules, Principles (day-to-day craft), Topics, When

### Community 69 - "final-approver"
Cohesion: 0.33
Nodes (5): final-approver, Inputs, Notes, Outputs, Role

### Community 70 - "guardian"
Cohesion: 0.33
Nodes (5): guardian, Inputs, Notes, Outputs, Role

### Community 71 - "Researcher rules"
Cohesion: 0.33
Nodes (5): Answer the question, not the table, Make the database do the work, Persian runs, Researcher rules, Spend few queries, learn from each

### Community 72 - "final-approver"
Cohesion: 0.33
Nodes (5): final-approver, Inputs, Notes, Outputs, Role

### Community 73 - "guardian"
Cohesion: 0.33
Nodes (5): guardian, Inputs, Notes, Outputs, Role

### Community 74 - "Researcher rules"
Cohesion: 0.33
Nodes (5): Answer the question, not the table, Make the database do the work, Persian runs, Researcher rules, Spend few queries, learn from each

### Community 75 - "Project Experience Log"
Cohesion: 0.33
Nodes (5): A:, A:, Project Experience Log, Q: Why did Helix API report "pyodbc is not installed" even though it was in requirements.txt?, Q: Why did POST /api/chat return HTTP 400 with "pyodbc.Error returned a result with an exception set"?

### Community 76 - "Orchester"
Cohesion: 0.40
Nodes (4): Flow, Notes, Orchester, Role

### Community 77 - "I18nContext.jsx"
Cohesion: 0.20
Nodes (16): App(), I18nContext, I18nProvider(), applyLocale(), isLocale(), LOCALE_STORAGE_KEY, localeToDir(), localeToHtmlLang() (+8 more)

### Community 78 - "Orchester"
Cohesion: 0.40
Nodes (4): Flow, Notes, Orchester, Role

### Community 79 - "Helix API"
Cohesion: 0.40
Nodes (4): Agent pipeline, Docker, Helix API, Run locally

### Community 80 - "Helix Web UI"
Cohesion: 0.40
Nodes (4): Admin guide PDF (Persian), Helix Web UI, Pages, Run locally

### Community 81 - "Database catalog"
Cohesion: 0.50
Nodes (3): Catalog, Database catalog, Query speed

### Community 82 - "graft"
Cohesion: 0.50
Nodes (3): graft, npx, @nanonets/graft

### Community 86 - "DbExplorerPage.jsx"
Cohesion: 0.36
Nodes (7): fetchDbExplorerColumns(), fetchDbExplorerTables(), runDbExplorerQuery(), DbExplorerPage(), LIMITS, OBJECT_KINDS, preferIdOrderColumn()

### Community 130 - "_build_user_message"
Cohesion: 0.17
Nodes (13): date, calendar_hint_for_prompt(), _first_jalali_month_year(), _first_jalali_year(), jalali_month_gregorian_bounds(), jalali_to_gregorian(), Jalali (Iranian) calendar helpers for SQL prompts., Convert a Jalali date to Gregorian (year, month, day). (+5 more)

### Community 131 - "org.py"
Cohesion: 0.37
Nodes (14): create_user(), delete_user(), _ensure_armin_admin(), ensure_org(), get_user(), _is_armin(), list_users(), _normalize_users() (+6 more)

### Community 132 - "helix-cli/package.json"
Cohesion: 0.20
Nodes (9): bin, helix, description, engines, node, name, private, type (+1 more)

### Community 133 - "app-lifecycle-cli/SKILL.md"
Cohesion: 0.25
Nodes (7): Commands, Docker mode (no service, no AppData install), Inputs (infer, don't ask unless unknowable), Native mode, Registration, Rules, Verify, then report alias, mode, paths, port, uninstall

## Knowledge Gaps
- **892 isolated node(s):** `npx`, `@nanonets/graft`, `_FlowCompiler`, `entrypoint.sh script`, `name` (+887 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useI18n()` connect `useI18n` to `client.js`, `ResultsPage.jsx`, `pipelineFlow.js`, `I18nContext.jsx`, `App.jsx`, `LogsPage.jsx`, `SettingsPage.jsx`, `DbExplorerPage.jsx`, `AnalysisPage.jsx`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `save_config()` connect `tests.py` to `get_database_settings`, `org.py`, `pipeline_graph.py`, `config_loader.py`, `sample_database.py`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `npx`, `@nanonets/graft`, `_FlowCompiler` to the rest of the system?**
  _892 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Database catalog` be split into smaller, more focused modules?**
  _Cohesion score 0.004106776180698152 - nodes in this community are weakly interconnected._
- **Should `markdown_store.py` be split into smaller, more focused modules?**
  _Cohesion score 0.05323891948596905 - nodes in this community are weakly interconnected._
- **Should `sqlserver.py` be split into smaller, more focused modules?**
  _Cohesion score 0.054945054945054944 - nodes in this community are weakly interconnected._
- **Should `client.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08270676691729323 - nodes in this community are weakly interconnected._