# Graph Report - Helix  (2026-10-22)

## Corpus Check
- 181 files · ~421,899 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2348 nodes · 5682 edges · 99 communities (86 shown, 13 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `08a41ff7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Database catalog
- markdown_store.py
- sqlite.py
- views.py
- client.js
- pipeline_graph.py
- ResultsPage.jsx
- Layout.jsx
- redeploy-stack.ps1
- tables/INDEX.md
- pipelineFlow.js
- save_config
- dependencies
- pipeline_langgraph.py
- llm_client.py
- pipeline_run.py
- App.jsx
- tests.py
- config_loader.py
- LogsPage.jsx
- SettingsPage.jsx
- sample_database.py
- OperatorQuestionTests
- AgentAssetContractTests
- select_rag_context
- AnalysisPage.jsx
- report_verifier.py
- LiveSyncContext.jsx
- results_store.py
- RunProgressModal.jsx
- helix.mjs
- mcp_config.py
- run_store.py
- ResearcherAssumptionsTests
- sqlserver.py
- logs_store.py
- Testing Playground for Settings/API
- ThreeAgentPipelineTests
- generate-optimized-select
- generate-optimized-select
- ResultShareMenu.jsx
- _SqlServerConnection
- get_openrouter_token
- Helix Evaluation Test Set — Plan
- langgraph_events
- get_active_provider_settings
- ensure_config_exists
- DbExplorerObjectKindTests
- _seed_connector_defaults
- chart_payload.py
- demo.py
- fix_mojibake.py
- GitNexus — Code Intelligence
- process-data
- Helix analytics agents
- db_dialects/__init__.py
- sql_execute.py
- researcher
- process-data
- useI18n
- researcher
- 0001_initial.py
- Helix base instruction
- Helix product scope
- build-admin-guide-pdf.mjs
- GitNexus — Code Intelligence
- _rewrite_unresolvable_hostname_to_localhost
- postgresql.py
- Project Experience Log
- Orchester
- Orchester
- Helix API
- Database catalog
- main
- orchestrate-pipeline
- Agent registry
- asgi.py
- settings.py
- wsgi.py
- orchestrate-pipeline
- entrypoint.sh
- vite.config.js
- TablePermission
- run_researcher_loop
- calendar_hint_for_prompt
- org.py
- helix-cli/package.json

## God Nodes (most connected - your core abstractions)
1. `Database catalog` - 491 edges
2. `useI18n()` - 93 edges
3. `requestJson()` - 66 edges
4. `save_config()` - 51 edges
5. `_error()` - 48 edges
6. `load_config()` - 45 edges
7. `_json_body()` - 36 edges
8. `failMessage()` - 33 edges
9. `run_researcher_loop()` - 29 edges
10. `update_openrouter_settings()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `run_case()` --calls--> `_run_orchester()`  [INFERRED]
  evals/run_evals.py → helix-api/backend/api/pipeline_run.py
- `run_case()` --calls--> `execute_select()`  [INFERRED]
  evals/run_evals.py → helix-api/backend/api/sql_execute.py
- `run_case()` --calls--> `run_sql_request()`  [INFERRED]
  evals/run_evals.py → helix-api/backend/api/researcher_query.py
- `TablePermissionInline` --uses--> `TablePermission`  [INFERRED]
  helix-api/backend/api/admin.py → helix-api/backend/api/models.py
- `run_sql_request()` --indirect_call--> `_llm()`  [INFERRED]
  helix-api/backend/api/researcher_query.py → helix-api/backend/api/pipeline_langgraph.py

## Import Cycles
- None detected.

## Communities (99 total, 13 thin omitted)

### Community 0 - "Database catalog"
Cohesion: 0.00
Nodes (491): AssetAccounting.ForoshAmval, AssetAccounting.ForoshAmvalSatr, AssetAccounting.vForoshAmval, AssetAccounting.vForoshAmvalSatr, BI.vwDimSalesDocumentType, BI.vwDimSalesKind, BI.vwFactSales, BI.vwFactSalesTarget (+483 more)

### Community 1 - "markdown_store.py"
Cohesion: 0.06
Nodes (102): parse_table_name(), _docs_markdown(), _ensure_table_section(), _escape_md_cell(), filter_tables_reference(), format_live_catalog_for_prompt(), get_table_docs(), list_docs_tables() (+94 more)

### Community 2 - "sqlite.py"
Cohesion: 0.21
Nodes (19): cell_value(), _looks_like_id_column(), prefer_id_order_column(), Any, Shared SQL introspection helpers for all database engines., Pick a default ORDER BY column: PK, then *Id / id, then lowest ordinal., validate_order_column(), validate_where() (+11 more)

### Community 3 - "views.py"
Cohesion: 0.10
Nodes (86): csrf_exempt, database_to_connection_string(), issue_session(), Signed session tokens for Helix config users., read_session(), create_feedback_issue(), get_latest_release(), _github_request() (+78 more)

### Community 4 - "client.js"
Cohesion: 0.06
Nodes (73): answerRun(), API_BASE, ApiError, apiFetch(), apiUrl(), AUTH_STORAGE_KEY, authHeaders(), configureSqlServerMcp() (+65 more)

### Community 5 - "pipeline_graph.py"
Cohesion: 0.09
Nodes (60): is_sub_agent(), _agent_count(), circuit_open_edge(), _collect_agent_ids(), compile_pipeline_flow(), _compile_stages(), _default_edge_id(), default_pipeline_flow() (+52 more)

### Community 6 - "ResultsPage.jsx"
Cohesion: 0.10
Nodes (47): deleteResult(), fetchBranding(), fetchResult(), fetchResults(), formatDateTime(), formatDurationSeconds(), formatNumber(), pad2() (+39 more)

### Community 7 - "Layout.jsx"
Cohesion: 0.10
Nodes (27): fetchCurrentUser(), fetchHealth(), getAuthToken(), subscribeApiErrors(), ErrorModal(), applyTheme(), formatLinkStatus(), isConnectedStatus() (+19 more)

### Community 8 - "redeploy-stack.ps1"
Cohesion: 0.23
Nodes (8): Clear-DeadLocalProxyEnv(), Ensure-Network(), Invoke-ComposeUp(), Remove-NamedVolumes(), Test-DeadLocalProxy(), Warn-StaleVolumes(), Write-Step(), Write-WarnMsg()

### Community 9 - "tables/INDEX.md"
Cohesion: 0.04
Nodes (35): Alphabetical (schema-table), By sales flow, Naming tip, Quick find, Sales tables index, Columns, Sales.DarkhastFaktor, Table overview (+27 more)

### Community 10 - "pipelineFlow.js"
Cohesion: 0.10
Nodes (42): AgentArrangeDesigner(), StageRow(), AgentGraphDesigner(), AgentGraphDesignerInner(), BranchNode(), graphToFlowNodes(), LoopGroupNode(), nodeTypes (+34 more)

### Community 11 - "save_config"
Cohesion: 0.14
Nodes (18): get_llm_base_url(), get_openrouter_settings(), get_provider(), _normalize_base_url(), provider_default_base_url(), Vendor endpoint of a connector that owns one; '' means the user supplies it., Chat/models host: the stored URL, else the connector's own endpoint., save_config() (+10 more)

### Community 12 - "dependencies"
Cohesion: 0.05
Nodes (43): echarts, echarts-for-react, dependencies, echarts, echarts-for-react, html2canvas, html2pdf.js, jspdf (+35 more)

### Community 13 - "pipeline_langgraph.py"
Cohesion: 0.15
Nodes (40): _ask_operator(), build_pipeline_graph(), _emit(), _entry_node(), _go(), _inspect_prompt(), _llm(), node_orchester() (+32 more)

### Community 14 - "llm_client.py"
Cohesion: 0.09
Nodes (40): catalog_tables(), _match_tables_from_text(), Any, Orchester review of plain-language per-user data access., Map admin-selected table names to exact catalog entries., Ask the orchester LLM to accept/reject a plain-language data-access policy.…, resolve_allowed_tables_from_catalog(), review_data_access_policy() (+32 more)

### Community 15 - "pipeline_run.py"
Cohesion: 0.13
Nodes (37): agent_display_name(), _append_step_log(), _apply_answers(), _assistant_message_for_history(), _effective_mode(), _error_event(), _failure_detail(), _failure_duration_s() (+29 more)

### Community 16 - "App.jsx"
Cohesion: 0.15
Nodes (30): fetchAgents(), fetchSkills(), DataGrid(), FlashMessage(), IconButton(), PageHeader(), PipelineDesigner(), StackedNames() (+22 more)

### Community 17 - "tests.py"
Cohesion: 0.08
Nodes (13): _finalize_database(), Bring back seed pipeline agents hidden by deleted_agents (one-time)., Normalize settings. Sample SQLite is only used when the engine is sqlite., restore_seed_pipeline_agents(), DataFileImportTests, DocsCatalogPromptTests, LogsCollectionTests, OrgUserAuthTests (+5 more)

### Community 18 - "config_loader.py"
Cohesion: 0.10
Nodes (51): is_builtin_agent(), is_phase_agent(), is_pipeline_agent(), Canonical agent pipeline metadata., Kept for callers; phase-only roster is empty — always False., True for graph-eligible agents (orchester, researcher)., Map graph instance id (e.g. researcher__2) to roster agent id., resolve_agent_definition_id() (+43 more)

### Community 19 - "LogsPage.jsx"
Cohesion: 0.22
Nodes (13): deleteLog(), agentDefinitionId(), CopyButton(), copyText(), DetailField(), formatDuration(), hasText(), kindLabel() (+5 more)

### Community 20 - "SettingsPage.jsx"
Cohesion: 0.09
Nodes (32): fetchDbExplorerColumns(), fetchDbExplorerTables(), fetchLatestRelease(), sendFeedback(), LlmChatTester(), ModelCombobox(), modelId(), modelName() (+24 more)

### Community 21 - "sample_database.py"
Cohesion: 0.10
Nodes (52): BinaryIO, _build_sqlite_from_tables(), _column_type(), _decode_text(), import_uploaded_file(), imports_dir(), _is_float(), _is_int() (+44 more)

### Community 22 - "OperatorQuestionTests"
Cohesion: 0.12
Nodes (9): OperatorQuestionTests, PausedRunStoreTests, _PauseSpoolMixin, Keep parked-run spool files out of the machine's real temp dir., A parked run must be answerable from a request that did not park it., A run can stop and ask the operator; the answer resumes the node that asked., Fake LLM. ``answers`` maps agent id to responses consumed in call order.…, First user turn of a node's prompt (the pipeline brief). (+1 more)

### Community 23 - "AgentAssetContractTests"
Cohesion: 0.19
Nodes (6): AgentAssetContractTests, One skill per agent, catalog-agnostic text, no retired agents., Locate the web UI i18n directory, in-repo or via the Docker /host mount., Strip SQL schema allowlist lines where ``Warehouse`` is a schema name, not…, Remove schema allowlist blocks and legacy product wording from assembled…, The data target is whatever Settings points at, so the wording stays generic.…

### Community 24 - "select_rag_context"
Cohesion: 0.10
Nodes (28): _entry(), _fit(), _hits(), prompt_terms(), Any, Lexical retrieval over the RAG knowledge store (``markdown-files/rag/``). This…, Pack the knowledge documents that match ``prompt`` into a token budget. Returns…, Lowercased content words of a prompt, deduplicated in first-seen order. (+20 more)

### Community 25 - "AnalysisPage.jsx"
Cohesion: 0.08
Nodes (38): App(), GridColumnInput(), I18nProvider(), applyLocale(), isLocale(), LOCALE_STORAGE_KEY, localeToDir(), localeToHtmlLang() (+30 more)

### Community 26 - "report_verifier.py"
Cohesion: 0.10
Nodes (38): append_verification_warning(), _column_name(), _documentation_corpus(), _entities_from_rows(), extract_numbers_from_report(), ExtractedNumber, gregorian_to_jalali(), _is_numeric() (+30 more)

### Community 27 - "LiveSyncContext.jsx"
Cohesion: 0.17
Nodes (14): deleteReference(), apiUrl(), fetchStateVersion(), LiveSyncContext, LiveSyncProvider(), allResourcesFromPath(), anyListeners, emitLiveChange() (+6 more)

### Community 28 - "results_store.py"
Cohesion: 0.26
Nodes (19): _coerce_count(), _coerce_duration_s(), _coerce_rag(), _coerce_usage(), create_result(), delete_result(), _empty(), get_result() (+11 more)

### Community 29 - "RunProgressModal.jsx"
Cohesion: 0.70
Nodes (4): agentLabel(), formatElapsed(), RunProgressModal(), statusBadge()

### Community 30 - "helix.mjs"
Cohesion: 0.14
Nodes (44): API_DIR, APP_DIR, applyPort(), cleanEnv(), CLI_DIR, cmdPort(), cmdRebuild(), cmdRun() (+36 more)

### Community 31 - "mcp_config.py"
Cohesion: 0.24
Nodes (22): delete_server(), ensure_sql_server(), import_servers(), list_servers(), mcp_config_path(), Any, Path, MCP server configuration helpers. Reads / writes Cursor's ``mcp.json``: list… (+14 more)

### Community 32 - "run_store.py"
Cohesion: 0.25
Nodes (17): _fresh(), pause_run(), peek_paused(), pop_paused(), _prune_locked(), Any, Path, Registry of pipeline runs parked on an operator question. A paused run keeps… (+9 more)

### Community 33 - "ResearcherAssumptionsTests"
Cohesion: 0.18
Nodes (7): format_assumptions_section(), merge_assumptions_into_text_report(), normalize_researcher_assumptions(), Normalize researcher assumptions JSON to a stable list of dicts., Build the user-facing Assumptions section (guessed rules only)., Append a formatted assumptions block when the model omitted it from prose., ResearcherAssumptionsTests

### Community 34 - "sqlserver.py"
Cohesion: 0.18
Nodes (20): AppConfig, ApiConfig, bracket(), connect(), default_schema(), fqn(), _level1_type(), list_columns() (+12 more)

### Community 35 - "logs_store.py"
Cohesion: 0.31
Nodes (14): append_error(), classify_error_kind(), delete_log(), _empty(), get_log(), list_logs(), _load(), logs_path() (+6 more)

### Community 36 - "Testing Playground for Settings/API"
Cohesion: 0.13
Nodes (14): Components to Add:, Files to Modify:, Implementation Plan, Key Components:, Notes, Overview, Phase 1: Core Infrastructure, Phase 2: Testing Features (+6 more)

### Community 37 - "ThreeAgentPipelineTests"
Cohesion: 0.14
Nodes (6): _dispatch_tool(), _prompt_hard_block(), Run one tool and return its result as JSON., Non-streaming entry (tests); drains tool-loop events., _run_orchester(), ThreeAgentPipelineTests

### Community 38 - "generate-optimized-select"
Cohesion: 0.20
Nodes (9): Allowed schemas, Business rules (disclose every guess), Constraints, generate-optimized-select, Language, Pre-flight checklist (must pass before execute), Procedure, Rejected query patterns (+1 more)

### Community 39 - "generate-optimized-select"
Cohesion: 0.20
Nodes (9): Allowed schemas, Business rules (disclose every guess), Constraints, generate-optimized-select, Language, Pre-flight checklist (must pass before execute), Procedure, Rejected query patterns (+1 more)

### Community 40 - "ResultShareMenu.jsx"
Cohesion: 0.40
Nodes (8): BRAND_DOT, canNativeShare(), CHANNEL_LABEL_KEYS, ResultShareMenu(), buildShareBody(), buildShareSubject(), resultDetailUrl(), resultShareChannels()

### Community 42 - "get_openrouter_token"
Cohesion: 0.29
Nodes (7): _catalog_with_auto(), fetch_openrouter_models(), get_openrouter_token(), API keys saved from Settings, one per connector id., LLM API key saved for the active connector in Settings, then its env fallback., Fetch the LLM model catalog from {base_url}/models (cached ~10 minutes).…, _stored_tokens()

### Community 43 - "Helix Evaluation Test Set — Plan"
Cohesion: 0.25
Nodes (7): 1. Collect questions (~1 hour), 2. Record expected answers as RESULTS, not SQL, 3. Runner script (`evals/run_evals.py`), 4. Use it on every change, 5. Keep it growing, Helix Evaluation Test Set — Plan, Tips

### Community 44 - "langgraph_events"
Cohesion: 0.25
Nodes (8): get_compiled_graph(), langgraph_events(), Run the two-worker graph; yield step events; set ctx['_orchester_outcome'].…, run_langgraph_pipeline(), _park_pending(), _question_event(), SSE payload asking the operator to answer; the run waits for the answer request., Hand a run that asked a question to the run store; returns the run id.

### Community 45 - "get_active_provider_settings"
Cohesion: 0.33
Nodes (4): get_active_provider_settings(), get_connectors(), The active connector plus the catalog the Settings form builds its pickers from., Connector descriptors for the Settings form. Never carries a secret.

### Community 46 - "ensure_config_exists"
Cohesion: 0.83
Nodes (4): _config_path(), ensure_config_exists(), _example_path(), Path

### Community 48 - "_seed_connector_defaults"
Cohesion: 0.50
Nodes (4): provider_default_token_env(), Env var an unset connector falls back to when no key is stored in config., Carry the app-owned LLM settings over to the connector being selected. Only…, _seed_connector_defaults()

### Community 49 - "chart_payload.py"
Cohesion: 0.52
Nodes (6): _as_number(), build_echarts_option(), build_grid(), _is_number(), Any, Build ECharts options and grids from fetched SQL rows.

### Community 50 - "demo.py"
Cohesion: 0.44
Nodes (8): _chart_option(), get_demo_result(), _grid_payload(), _normalize_mode(), _normalize_report_type(), Any, Demo result payload mirroring the frontend preview., _text_report()

### Community 51 - "fix_mojibake.py"
Cohesion: 0.70
Nodes (4): is_suspect(), main(), Repair double-encoded text: UTF-8 bytes mis-decoded as cp1252, then saved as…, repair_text()

### Community 52 - "GitNexus — Code Intelligence"
Cohesion: 0.22
Nodes (8): Always Do, CLI, GitNexus — Code Intelligence, lean-ctx, Learned User Preferences, Learned Workspace Facts, Never Do, Resources

### Community 53 - "process-data"
Cohesion: 0.50
Nodes (3): Constraints, Example shape (Persian locale), process-data

### Community 54 - "Helix analytics agents"
Cohesion: 0.40
Nodes (4): Flow, Helix analytics agents, Layout, Skills (source of truth)

### Community 56 - "db_dialects/__init__.py"
Cohesion: 0.31
Nodes (14): get_database_engine(), parse_table_name(), connect(), get_dialect(), list_columns(), list_objects(), list_tables(), parse_table_name_for_engine() (+6 more)

### Community 57 - "sql_execute.py"
Cohesion: 0.20
Nodes (16): BaseException, get_sql_settings(), normalize_engine(), _allowlisted_names(), _dbg(), _ensure_sqlserver_top(), _exception_text(), execute_select() (+8 more)

### Community 58 - "researcher"
Cohesion: 0.29
Nodes (6): Inputs, Notes, Outputs, researcher, Role, Tools

### Community 59 - "process-data"
Cohesion: 0.50
Nodes (3): Constraints, Example shape (Persian locale), process-data

### Community 60 - "useI18n"
Cohesion: 0.12
Nodes (22): fetchDocsTable(), saveDocsColumn(), saveDocsTableOverview(), ADMIN_GUIDE_PDF, AdminGuideDownloadCard(), AgentScopedMarkdownPage(), ColumnDocsModal(), ItemAssignmentPicker() (+14 more)

### Community 61 - "researcher"
Cohesion: 0.29
Nodes (6): Inputs, Notes, Outputs, researcher, Role, Tools

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

### Community 71 - "postgresql.py"
Cohesion: 0.37
Nodes (13): connect(), default_schema(), fqn(), list_columns(), list_objects(), list_tables(), Any, quote_ident() (+5 more)

### Community 75 - "Project Experience Log"
Cohesion: 0.33
Nodes (5): A:, A:, Project Experience Log, Q: Why did Helix API report "pyodbc is not installed" even though it was in requirements.txt?, Q: Why did POST /api/chat return HTTP 400 with "pyodbc.Error returned a result with an exception set"?

### Community 76 - "Orchester"
Cohesion: 0.25
Nodes (7): Flow, Inputs, Notes, Orchester, Outputs, Role, Tools and limits

### Community 78 - "Orchester"
Cohesion: 0.25
Nodes (7): Flow, Inputs, Notes, Orchester, Outputs, Role, Tools and limits

### Community 79 - "Helix API"
Cohesion: 0.15
Nodes (10): Agent pipeline, Docker, Helix API, Run locally, Admin guide PDF (Persian), Helix Web UI, Pages, Run locally (+2 more)

### Community 81 - "Database catalog"
Cohesion: 0.22
Nodes (8): Catalog, Conventions (Sales, Warehouse, Purchase, HumanResource), Database catalog, Global.MarkazPakhsh, HumanResource.Foroshandeh, Purchase.TaminKonandeh, Query speed, Warehouse.Kala

### Community 115 - "TablePermission"
Cohesion: 0.25
Nodes (8): HelixUserAdmin, TablePermissionAdmin, TablePermissionInline, Meta, Grant a user access to a specific schema or table of the warehouse., TablePermission, register, UserAdmin

### Community 126 - "run_researcher_loop"
Cohesion: 0.06
Nodes (57): load_cases(), main(), Any, Path, _rows_equal(), run_case(), _schemas_in_sql(), _setup_django() (+49 more)

### Community 130 - "calendar_hint_for_prompt"
Cohesion: 0.24
Nodes (10): date, calendar_hint_for_prompt(), _first_jalali_month_year(), _first_jalali_year(), jalali_month_gregorian_bounds(), jalali_to_gregorian(), Jalali (Iranian) calendar helpers for SQL prompts., Convert a Jalali date to Gregorian (year, month, day). (+2 more)

### Community 131 - "org.py"
Cohesion: 0.31
Nodes (18): authenticate_user(), create_user(), delete_user(), _ensure_armin_admin(), ensure_org(), get_user(), _is_armin(), list_users() (+10 more)

### Community 132 - "helix-cli/package.json"
Cohesion: 0.20
Nodes (9): bin, helix, description, engines, node, name, private, type (+1 more)

## Knowledge Gaps
- **701 isolated node(s):** `Migration`, `Meta`, `_FlowCompiler`, `entrypoint.sh script`, `name` (+696 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useI18n()` connect `useI18n` to `client.js`, `ResultsPage.jsx`, `Layout.jsx`, `ResultShareMenu.jsx`, `pipelineFlow.js`, `App.jsx`, `LogsPage.jsx`, `SettingsPage.jsx`, `AnalysisPage.jsx`, `RunProgressModal.jsx`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `Migration`, `Meta`, `_FlowCompiler` to the rest of the system?**
  _701 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Database catalog` be split into smaller, more focused modules?**
  _Cohesion score 0.0040650406504065045 - nodes in this community are weakly interconnected._
- **Should `markdown_store.py` be split into smaller, more focused modules?**
  _Cohesion score 0.056064690026954175 - nodes in this community are weakly interconnected._
- **Should `views.py` be split into smaller, more focused modules?**
  _Cohesion score 0.10214504596527069 - nodes in this community are weakly interconnected._
- **Should `client.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05502392344497608 - nodes in this community are weakly interconnected._
- **Should `pipeline_graph.py` be split into smaller, more focused modules?**
  _Cohesion score 0.08581349206349206 - nodes in this community are weakly interconnected._