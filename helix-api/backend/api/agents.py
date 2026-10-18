"""Canonical agent pipeline metadata."""

AGENT_PIPELINE = [
    {
        "id": "orchester",
        "name": "Orchester",
        "description": "Inspect the human prompt, set goals, ask the operator, validate the result, package it for the UI",
    },
    {
        "id": "sql-expert",
        "name": "sql-expert",
        "description": "Turn plain-English data asks into one safe read-only SELECT and return the rows",
    },
    {
        "id": "researcher",
        "name": "researcher",
        "description": "Process the SQL rows against the goals and write the result; may ask the operator",
    },
]

AGENT_IDS = [a["id"] for a in AGENT_PIPELINE]
AGENT_BY_ID = {a["id"]: a for a in AGENT_PIPELINE}

# No separate phase-only roster — the three pipeline agents are the runtime graph.
PHASE_AGENT_PIPELINE: list[dict] = []
PHASE_AGENT_IDS: list[str] = []
PHASE_AGENT_BY_ID: dict[str, dict] = {}

# No sub-agents in this build.
SUB_AGENT_PIPELINE: list[dict] = []

SUB_AGENT_IDS = [a["id"] for a in SUB_AGENT_PIPELINE]
SUB_AGENT_BY_ID = {a["id"]: a for a in SUB_AGENT_PIPELINE}

SYNC_AGENT_IDS = AGENT_IDS + SUB_AGENT_IDS
ALL_BUILTIN_AGENT_BY_ID = {**AGENT_BY_ID, **SUB_AGENT_BY_ID}

# Retired agent ids. Saved config that still names them is dropped on load, never routed to.
LEGACY_AGENT_IDS = frozenset(
    {
        "task_validator",
        "solution_strategist",
        "technical_architect",
        "code_builder",
        "sql",
        "sql_fetcher",
        "sql_guardian",
        "response_builder",
        "response_publisher",
        "implementation_auditor",
        "data-gatherer",
        "validator",
        "result-builder",
        "publisher",
        "guardian",
        "final-approver",
        "web-searcher",
    }
)

# Legacy ids whose duties now belong to a live agent. Ids not listed here are dropped outright.
LEGACY_AGENT_RENAMES = {
    "task_validator": "orchester",
    "solution_strategist": "orchester",
    "technical_architect": "orchester",
    "code_builder": "orchester",
    "sql": "sql-expert",
    "sql_fetcher": "sql-expert",
    "sql_guardian": "orchester",
    "response_builder": "researcher",
    "response_publisher": "orchester",
    "implementation_auditor": "orchester",
    "data-gatherer": "sql-expert",
    "validator": "orchester",
    "result-builder": "researcher",
    "publisher": "orchester",
}

_RUNTIME_PIPELINE_AGENT_IDS = frozenset(AGENT_IDS)


def resolve_agent_definition_id(agent_id: str) -> str:
    """Map graph instance id (e.g. researcher__2) to roster agent id."""
    if "__" in agent_id:
        base = agent_id.rsplit("__", 1)[0]
        if base in _RUNTIME_PIPELINE_AGENT_IDS:
            return base
        if base in AGENT_BY_ID or base in LEGACY_AGENT_RENAMES:
            return LEGACY_AGENT_RENAMES.get(base, base)
    if agent_id in _RUNTIME_PIPELINE_AGENT_IDS:
        return agent_id
    return LEGACY_AGENT_RENAMES.get(agent_id, agent_id)


def is_builtin_agent(agent_id: str) -> bool:
    return resolve_agent_definition_id(agent_id) in ALL_BUILTIN_AGENT_BY_ID


def is_sub_agent(agent_id: str) -> bool:
    return resolve_agent_definition_id(agent_id) in SUB_AGENT_BY_ID


def is_phase_agent(agent_id: str) -> bool:
    """Kept for callers; phase-only roster is empty — always False."""
    return False


def is_pipeline_agent(agent_id: str) -> bool:
    """True for graph-eligible agents (orchester, sql-expert, researcher)."""
    rid = resolve_agent_definition_id(agent_id)
    return rid in AGENT_BY_ID
