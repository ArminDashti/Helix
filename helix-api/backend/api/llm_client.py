"""Chat completion client for the configured LLM provider."""

from __future__ import annotations

import json
import socket
import urllib.error
import urllib.request
from typing import Any

from .config_loader import (
    DEFAULT_LLM_MODEL,
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
    settings = get_openrouter_settings()
    chosen_model = (model or "").strip()
    if not chosen_model or chosen_model.lower() == "auto":
        if provider == "openrouter":
            chosen_model = _OPENROUTER_AUTO_MODEL
        else:
            chosen_model = provider_default_model(provider)
    sys_prompt = system_prompt if system_prompt is not None else "You are a helpful assistant."
    started = _time.time()

    url = f"{base_url}/chat/completions"
    request_body: dict[str, Any] = {
        "model": chosen_model,
        "messages": [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.2,
    }
    body = json.dumps(request_body).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        # A test is its own conversation: its own session id keeps it out of the pipeline's
        # routing/caching bucket.
        **get_llm_headers(provider, new_llm_session_id()),
    }
    if provider == "openrouter":
        app_name = str(settings.get("app_name") or "Helix")
        headers["HTTP-Referer"] = "https://helix.local"
        headers["X-Title"] = app_name
    req = urllib.request.Request(url, data=body, method="POST", headers=headers)
    timeout_s = get_llm_timeout_seconds()
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise ValueError(f"LLM request failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise ValueError(f"LLM request failed: {exc.reason}") from exc
    except TimeoutError as exc:
        raise ValueError(
            f"LLM request timed out after {timeout_s}s — increase openrouter.timeout_seconds in helix.config.yaml"
        ) from exc
    except socket.timeout as exc:
        raise ValueError(
            f"LLM request timed out after {timeout_s}s — increase openrouter.timeout_seconds in helix.config.yaml"
        ) from exc
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
    url = f"{base_url}/chat/completions"
    model = _resolve_model(agent_id, provider)

    request_body: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
    }
    if tools:
        request_body["tools"] = tools
        request_body["tool_choice"] = "auto"
    body = json.dumps(request_body).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        **get_llm_headers(provider, session_id),
    }
    if provider == "openrouter":
        app_name = str(settings.get("app_name") or "Helix")
        headers["HTTP-Referer"] = "https://helix.local"
        headers["X-Title"] = app_name
    req = urllib.request.Request(
        url,
        data=body,
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
    except TimeoutError as exc:
        raise ValueError(
            f"LLM request timed out after {timeout_s}s — increase openrouter.timeout_seconds in helix.config.yaml"
        ) from exc
    except socket.timeout as exc:
        raise ValueError(
            f"LLM request timed out after {timeout_s}s — increase openrouter.timeout_seconds in helix.config.yaml"
        ) from exc

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
