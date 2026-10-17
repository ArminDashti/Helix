"""Chat completion client for the configured LLM provider."""

from __future__ import annotations

import json
import socket
import urllib.error
import urllib.request
from typing import Any

from .config_loader import (
    DEFAULT_LLM_MODEL,
    PROVIDER_OPENCODE_GO,
    get_agent_model,
    get_llm_base_url,
    get_llm_headers,
    get_llm_timeout_seconds,
    get_openrouter_settings,
    get_openrouter_token,
    get_provider,
    new_llm_session_id,
    provider_default_model,
)

_OPENROUTER_AUTO_MODEL = DEFAULT_LLM_MODEL

# OpenCode Go serves some models (Claude Haiku 5.5, Qwen3.x, MiniMax) only on the Anthropic
# Messages protocol; sending them OpenAI /chat/completions returns 400 ModelProtocolUnsupported.
_ANTHROPIC_MESSAGES_URL = "https://opencode.ai/inference/go/anthropic/v1/messages"
_ANTHROPIC_VERSION = "2023-06-01"
_ANTHROPIC_PROTOCOL_PREFIXES = ("claude-", "minimax-", "qwen3.")
# ponytail: one output cap for every Anthropic-protocol model; upgrade to the per-model
# maxTokens from the models endpoint if long reports get cut short.
_ANTHROPIC_MAX_TOKENS = 16384


def require_llm() -> tuple[str, str, str]:
    """Return (provider, token, base_url) or raise if the selected LLM cannot be used."""
    provider = get_provider()
    token = get_openrouter_token()
    if not token:
        raise ValueError("API key is not set")
    base_url = get_llm_base_url()
    if not base_url:
        raise ValueError("Base URL is not set")
    return provider, token, base_url


def complete_chat(
    agent_id: str,
    user_message: str,
    system_prompt: str,
    *,
    session_id: str | None = None,
) -> str:
    provider, token, base_url = require_llm()
    message = _chat_completions_request(
        agent_id=agent_id,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        token=token,
        base_url=base_url,
        provider=provider,
        session_id=session_id,
    )
    text = message.get("content") if isinstance(message, dict) else ""
    if isinstance(text, list):
        text = json.dumps(text)
    text = text if isinstance(text, str) else ("" if text is None else str(text))
    if not text.strip() and not message.get("tool_calls"):
        raise ValueError("LLM returned an empty message")
    return text


def complete_chat_messages(
    agent_id: str,
    messages: list[dict[str, Any]],
    *,
    tools: list[dict[str, Any]] | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Multi-turn OpenAI-compatible chat; returns the assistant message dict.

    Message may include ``content`` and/or ``tool_calls`` (Cursor-style tool loop).
    ``session_id`` is the caller's conversation: vendors that route on one (OpenCode Go's
    ``x-opencode-session``) key prompt caching and routing off it, so all turns of one pipeline
    run should pass the same value.
    """
    provider, token, base_url = require_llm()
    if not isinstance(messages, list) or not messages:
        raise ValueError("messages must be a non-empty list")
    return _chat_completions_request(
        agent_id=agent_id,
        messages=messages,
        token=token,
        base_url=base_url,
        provider=provider,
        tools=tools,
        session_id=session_id,
    )


def complete_test_chat(
    user_message: str,
    *,
    model: str | None = None,
    system_prompt: str | None = None,
) -> dict[str, Any]:
    """Direct chat completion for Settings tester — returns reply + meta.

    Uses the currently configured provider/token/base_url but allows an
    explicit model override. Raises ValueError on misconfiguration or LLM error.
    """
    import time as _time

    provider, token, base_url = require_llm()
    chosen_model = (model or "").strip()
    if not chosen_model or chosen_model.lower() == "auto":
        if provider == "openrouter":
            chosen_model = _OPENROUTER_AUTO_MODEL
        else:
            chosen_model = provider_default_model(provider)
    sys_prompt = system_prompt if system_prompt is not None else "You are a helpful assistant."
    started = _time.time()

    # A test is its own conversation: its own session id keeps it out of the pipeline's
    # routing/caching bucket.
    payload = _post_chat(
        provider=provider,
        token=token,
        base_url=base_url,
        model=chosen_model,
        messages=[
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_message},
        ],
        session_id=new_llm_session_id(),
    )
    elapsed = round(_time.time() - started, 3)
    choices = payload.get("choices") if isinstance(payload, dict) else None
    if not isinstance(choices, list) or not choices:
        raise ValueError("LLM returned no choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else {}
    content = (message or {}).get("content") if isinstance(message, dict) else ""
    text = content if isinstance(content, str) else json.dumps(content)
    if not str(text).strip():
        raise ValueError("LLM returned an empty message")
    usage = payload.get("usage") if isinstance(payload, dict) else None
    return {
        "reply": str(text),
        "model": chosen_model,
        "provider": provider,
        "base_url": base_url,
        "elapsed_s": elapsed,
        "usage": usage if isinstance(usage, dict) else None,
        "raw": payload,
    }


def _resolve_model(agent_id: str, provider: str) -> str:
    model = get_agent_model(agent_id)
    if not model or model == "auto":
        if provider == "openrouter":
            return _OPENROUTER_AUTO_MODEL
        return provider_default_model(provider)
    return model


def _chat_completions_request(
    *,
    agent_id: str,
    messages: list[dict[str, Any]],
    token: str,
    base_url: str,
    provider: str,
    tools: list[dict[str, Any]] | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    model = _resolve_model(agent_id, provider)
    payload = _post_chat(
        provider=provider,
        token=token,
        base_url=base_url,
        model=model,
        messages=messages,
        tools=tools,
        session_id=session_id,
    )
    choices = payload.get("choices") if isinstance(payload, dict) else None
    if not isinstance(choices, list) or not choices:
        raise ValueError("LLM returned no choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else {}
    if not isinstance(message, dict):
        raise ValueError("LLM returned an empty message")
    content = message.get("content")
    tool_calls = message.get("tool_calls")
    has_tools = isinstance(tool_calls, list) and bool(tool_calls)
    text = content if isinstance(content, str) else (
        "" if content is None else json.dumps(content)
    )
    if not str(text).strip() and not has_tools:
        raise ValueError("LLM returned an empty message")
    return message


def _uses_anthropic_protocol(provider: str, model: str) -> bool:
    return provider == PROVIDER_OPENCODE_GO and model.lower().startswith(
        _ANTHROPIC_PROTOCOL_PREFIXES
    )


def _to_anthropic_body(messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None) -> dict[str, Any]:
    """OpenAI-shaped messages/tools -> Anthropic Messages body (system hoisted, tool calls mapped)."""
    system = "\n\n".join(
        str(m["content"]) for m in messages if m.get("role") == "system" and m.get("content")
    )
    converted: list[dict[str, Any]] = []
    for m in messages:
        role = m.get("role")
        if role == "system":
            continue
        if role == "tool":
            block = {
                "type": "tool_result",
                "tool_use_id": m.get("tool_call_id"),
                "content": m.get("content") or "",
            }
            converted.append({"role": "user", "content": [block]})
        elif role == "assistant" and m.get("tool_calls"):
            blocks = [{"type": "text", "text": m["content"]}] if m.get("content") else []
            for call in m["tool_calls"]:
                fn = call.get("function") or {}
                blocks.append({
                    "type": "tool_use",
                    "id": call.get("id"),
                    "name": fn.get("name"),
                    "input": json.loads(fn.get("arguments") or "{}"),
                })
            converted.append({"role": "assistant", "content": blocks})
        else:
            converted.append({"role": role, "content": m.get("content") or ""})
    body: dict[str, Any] = {"messages": converted, "max_tokens": _ANTHROPIC_MAX_TOKENS}
    if system:
        body["system"] = system
    if tools:
        body["tools"] = [
            {
                "name": fn.get("name"),
                "description": fn.get("description") or "",
                "input_schema": fn.get("parameters") or {"type": "object", "properties": {}},
            }
            for fn in (t.get("function") or {} for t in tools)
        ]
    return body


def _from_anthropic_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Anthropic Messages response -> OpenAI chat.completion shape the callers already parse."""
    blocks = payload.get("content") or []
    message: dict[str, Any] = {
        "role": "assistant",
        "content": "".join(b.get("text", "") for b in blocks if b.get("type") == "text"),
    }
    calls = [
        {
            "id": b.get("id"),
            "type": "function",
            "function": {"name": b.get("name"), "arguments": json.dumps(b.get("input") or {})},
        }
        for b in blocks
        if b.get("type") == "tool_use"
    ]
    if calls:
        message["tool_calls"] = calls
    return {"choices": [{"message": message}], "usage": payload.get("usage")}


def _post_chat(
    *,
    provider: str,
    token: str,
    base_url: str,
    model: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    """POST one chat turn over the protocol the model speaks; returns an OpenAI-shaped payload."""
    anthropic = _uses_anthropic_protocol(provider, model)
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        **get_llm_headers(provider, session_id),
    }
    if anthropic:
        url = _ANTHROPIC_MESSAGES_URL
        request_body: dict[str, Any] = {"model": model, **_to_anthropic_body(messages, tools)}
        headers["x-api-key"] = token
        headers["anthropic-version"] = _ANTHROPIC_VERSION
    else:
        url = f"{base_url}/chat/completions"
        request_body = {"model": model, "messages": messages, "temperature": 0.2}
        if tools:
            request_body["tools"] = tools
            request_body["tool_choice"] = "auto"
        headers["Authorization"] = f"Bearer {token}"
    if provider == "openrouter":
        headers["HTTP-Referer"] = "https://helix.local"
        headers["X-Title"] = str(get_openrouter_settings().get("app_name") or "Helix")
    req = urllib.request.Request(
        url,
        data=json.dumps(request_body).encode("utf-8"),
        method="POST",
        headers=headers,
    )
    timeout_s = get_llm_timeout_seconds()
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:400]
        raise ValueError(f"LLM request failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise ValueError(f"LLM request failed: {exc.reason}") from exc
    except (TimeoutError, socket.timeout) as exc:
        raise ValueError(
            f"LLM request timed out after {timeout_s}s — increase openrouter.timeout_seconds in helix.config.yaml"
        ) from exc
    if anthropic:
        return _from_anthropic_payload(payload)
    return payload


def parse_json_object(text: str) -> dict[str, Any]:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end <= start:
        return {"text": text}
    try:
        data = json.loads(raw[start : end + 1])
    except json.JSONDecodeError:
        return {"text": text}
    return data if isinstance(data, dict) else {"text": text}
