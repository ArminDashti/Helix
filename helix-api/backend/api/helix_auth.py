"""Signed session tokens for Helix config users."""

from __future__ import annotations

from django.core import signing

SESSION_MAX_AGE = 60 * 60 * 24 * 14  # 14 days
_SIGNER = signing.TimestampSigner(salt="helix-user-session")


def issue_session(user_id: str) -> str:
    return _SIGNER.sign(str(user_id).strip())


def read_session(token: str) -> str:
    return _SIGNER.unsign((token or "").strip(), max_age=SESSION_MAX_AGE)
