"""Company human users stored in helix.config.yaml."""

from __future__ import annotations

from typing import Any

from django.contrib.auth.hashers import check_password, make_password

from .config_loader import AGENT_ID_RE, load_config, save_config

USERNAME_RE = AGENT_ID_RE
DEFAULT_ADMIN_PASSWORD = "dopadopa123"


def _seed_admin() -> dict[str, Any]:
    return {
        "id": "armin",
        "username": "armin",
        "display_name": "Armin",
        "is_admin": True,
        "password_hash": make_password(DEFAULT_ADMIN_PASSWORD),
    }


def user_wire(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": user["id"],
        "username": user["username"],
        "display_name": user["display_name"],
        "is_admin": bool(user.get("is_admin")),
        "data_access_plain": str(user.get("data_access_plain") or ""),
        "allowed_tables": list(user.get("allowed_tables") or []),
    }


def ensure_org() -> dict[str, Any]:
    data = load_config()
    changed = False
    if "departments" in data:
        del data["departments"]
        changed = True
    changed = _strip_department_fields(data) or changed

    raw_users = data.get("users")
    if not isinstance(raw_users, list):
        users = []
        changed = True
    else:
        users = _normalize_users(raw_users)
        if users != raw_users:
            changed = True
    if _ensure_armin_admin(users):
        changed = True
    data["users"] = users

    if changed:
        save_config(data)
        return load_config()
    return data


def _strip_department_fields(data: dict[str, Any]) -> bool:
    changed = False
    custom = data.get("custom_agents")
    if isinstance(custom, list):
        for entry in custom:
            if isinstance(entry, dict) and "department_id" in entry:
                del entry["department_id"]
                changed = True
    profiles = data.get("agent_profiles")
    if isinstance(profiles, dict):
        for profile in profiles.values():
            if isinstance(profile, dict) and "department_id" in profile:
                del profile["department_id"]
                changed = True
    return changed


def _normalize_users(raw: list[Any]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        username = str(entry.get("username") or "").strip().lower()
        user_id = str(entry.get("id") or username).strip()
        if not USERNAME_RE.match(username) or user_id in seen:
            continue
        seen.add(user_id)
        display = str(entry.get("display_name") or "").strip() or username
        plain = str(entry.get("data_access_plain") or "").strip()
        tables_raw = entry.get("allowed_tables")
        tables: list[str] = []
        if isinstance(tables_raw, list):
            for item in tables_raw:
                name = str(item or "").strip()
                if name and name not in tables:
                    tables.append(name)
        item: dict[str, Any] = {
            "id": user_id,
            "username": username,
            "display_name": display[:80],
            "is_admin": bool(entry.get("is_admin")),
            "data_access_plain": plain[:2000],
            "allowed_tables": tables,
        }
        password_hash = str(entry.get("password_hash") or "").strip()
        if password_hash:
            item["password_hash"] = password_hash
        result.append(item)
    return result


def _is_armin(user: dict[str, Any]) -> bool:
    return str(user.get("id") or "") == "armin" or str(user.get("username") or "") == "armin"


def _ensure_armin_admin(users: list[dict[str, Any]]) -> bool:
    """Keep the default armin account present and admin."""
    for user in users:
        if _is_armin(user):
            changed = False
            if not user.get("is_admin"):
                user["is_admin"] = True
                changed = True
            if user.get("username") != "armin":
                user["username"] = "armin"
                changed = True
            if user.get("id") != "armin":
                user["id"] = "armin"
                changed = True
            if "department_ids" in user:
                del user["department_ids"]
                changed = True
            if not user.get("password_hash"):
                user["password_hash"] = make_password(DEFAULT_ADMIN_PASSWORD)
                changed = True
            return changed
    users.insert(0, _seed_admin())
    return True


def _validate_password(plain: str) -> str:
    cleaned = (plain or "").strip()
    if len(cleaned) < 8:
        raise ValueError("password must be at least 8 characters")
    return cleaned


def list_users() -> list[dict[str, Any]]:
    data = ensure_org()
    return _normalize_users(data.get("users") or [])


def list_users_wire() -> list[dict[str, Any]]:
    return [user_wire(u) for u in list_users()]


def get_user(user_id: str) -> dict[str, Any]:
    for item in list_users():
        if item["id"] == user_id:
            return item
    raise KeyError(f"Unknown user: {user_id}")


def authenticate_user(username: str, password: str) -> dict[str, Any] | None:
    cleaned_username = (username or "").strip().lower()
    if not cleaned_username:
        return None
    for user in list_users():
        if user["username"] != cleaned_username and user["id"] != cleaned_username:
            continue
        stored = str(user.get("password_hash") or "")
        if stored and check_password(password or "", stored):
            return user
    return None


def create_user(
    username: str,
    display_name: str,
    *,
    password: str,
    is_admin: bool = False,
    data_access_plain: str = "",
    allowed_tables: list[str] | None = None,
) -> dict[str, Any]:
    cleaned_username = (username or "").strip().lower()
    if not USERNAME_RE.match(cleaned_username):
        raise ValueError(
            "username must be lowercase letters, digits, or underscores, starting with a letter"
        )
    cleaned_display = (display_name or "").strip() or cleaned_username
    if len(cleaned_display) > 80:
        raise ValueError("display_name must be at most 80 characters")
    cleaned_password = _validate_password(password)
    data = ensure_org()
    users = _normalize_users(data.get("users") or [])
    if any(u["username"] == cleaned_username for u in users):
        raise ValueError(f"User already exists: {cleaned_username}")
    item = {
        "id": cleaned_username,
        "username": cleaned_username,
        "display_name": cleaned_display,
        "is_admin": bool(is_admin),
        "data_access_plain": str(data_access_plain or "").strip()[:2000],
        "allowed_tables": [
            str(t).strip() for t in (allowed_tables or []) if str(t).strip()
        ],
        "password_hash": make_password(cleaned_password),
    }
    users.append(item)
    data["users"] = users
    save_config(data)
    return user_wire(item)


def update_user(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    data = ensure_org()
    users = _normalize_users(data.get("users") or [])
    current = None
    for item in users:
        if item["id"] == user_id:
            current = item
            break
    if current is None:
        raise KeyError(f"Unknown user: {user_id}")

    if "password" in payload and payload["password"] is not None:
        current["password_hash"] = make_password(_validate_password(str(payload["password"])))

    if "username" in payload and payload["username"] is not None:
        cleaned_username = str(payload["username"]).strip().lower()
        if not USERNAME_RE.match(cleaned_username):
            raise ValueError(
                "username must be lowercase letters, digits, or underscores, starting with a letter"
            )
        if any(u["username"] == cleaned_username and u["id"] != user_id for u in users):
            raise ValueError(f"User already exists: {cleaned_username}")
        if _is_armin(current) and cleaned_username != "armin":
            raise ValueError("Cannot rename the default admin armin")
        current["username"] = cleaned_username

    if "display_name" in payload and payload["display_name"] is not None:
        cleaned_display = str(payload["display_name"]).strip()
        if not cleaned_display:
            raise ValueError("display_name must be a non-empty string")
        if len(cleaned_display) > 80:
            raise ValueError("display_name must be at most 80 characters")
        current["display_name"] = cleaned_display

    if "is_admin" in payload and payload["is_admin"] is not None:
        next_admin = bool(payload["is_admin"])
        if _is_armin(current) and not next_admin:
            raise ValueError("armin is always admin")
        if not next_admin:
            admin_count = sum(1 for u in users if u["is_admin"] and u["id"] != user_id)
            if admin_count < 1:
                raise ValueError("Cannot remove the last admin")
        current["is_admin"] = next_admin

    if "data_access_plain" in payload and payload["data_access_plain"] is not None:
        current["data_access_plain"] = str(payload["data_access_plain"] or "").strip()[:2000]
    if "allowed_tables" in payload and payload["allowed_tables"] is not None:
        tables: list[str] = []
        raw = payload["allowed_tables"]
        if isinstance(raw, list):
            for item in raw:
                name = str(item or "").strip()
                if name and name not in tables:
                    tables.append(name)
        current["allowed_tables"] = tables

    data["users"] = users
    save_config(data)
    return user_wire(current)


def delete_user(user_id: str) -> None:
    data = ensure_org()
    users = _normalize_users(data.get("users") or [])
    target = next((u for u in users if u["id"] == user_id), None)
    if target is None:
        raise KeyError(f"Unknown user: {user_id}")
    if _is_armin(target):
        raise ValueError("Cannot delete the default admin armin")
    remaining = [u for u in users if u["id"] != user_id]
    if target["is_admin"] and not any(u["is_admin"] for u in remaining):
        raise ValueError("Cannot delete the last admin")
    data["users"] = remaining
    save_config(data)
