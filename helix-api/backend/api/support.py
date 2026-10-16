"""GitHub-backed app support: latest release lookup and feedback issues."""

from __future__ import annotations

import json
import os
import urllib.request
from typing import Any

GITHUB_REPO = "ArminDashti/Helix"
GITHUB_API = "https://api.github.com"
_TIMEOUT_SECONDS = 10


def _github_request(path: str, method: str = "GET", payload: dict[str, Any] | None = None) -> dict[str, Any]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "helix-api",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.environ.get("GITHUB_PAT_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(f"{GITHUB_API}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=_TIMEOUT_SECONDS) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_latest_release() -> dict[str, str]:
    release = _github_request(f"/repos/{GITHUB_REPO}/releases/latest")
    return {
        "latest_version": str(release.get("tag_name", "")).lstrip("v"),
        "release_url": str(release.get("html_url", "")),
    }


def create_feedback_issue(message: str, email: str) -> str:
    body = message if not email else f"{message}\n\nContact: {email}"
    issue = _github_request(
        f"/repos/{GITHUB_REPO}/issues",
        method="POST",
        payload={"title": f"Feedback: {message[:60]}", "body": body, "labels": ["feedback"]},
    )
    return str(issue.get("html_url", ""))
