"""Read-only facts about the host running helix-api."""

from __future__ import annotations

import os
import platform
import shutil
import socket
import time
from pathlib import Path
from typing import Any

import django
from django.conf import settings

_PROCESS_START = time.monotonic()


def collect_server_info(database_engine: str) -> dict[str, Any]:
    base_dir = Path(settings.BASE_DIR)
    data_dir = base_dir / "data"
    disk_root = data_dir if data_dir.is_dir() else base_dir
    disk_block: dict[str, Any] | None = None
    try:
        usage = shutil.disk_usage(disk_root)
        disk_block = {
            "path": str(disk_root),
            "total_bytes": usage.total,
            "used_bytes": usage.used,
            "free_bytes": usage.free,
        }
    except OSError:
        pass

    config_path = getattr(settings, "HELIX_CONFIG_PATH", None)
    markdown_dir = getattr(settings, "MARKDOWN_FILES_DIR", None)

    return {
        "hostname": socket.gethostname(),
        "platform": {
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "machine": platform.machine(),
        },
        "python_version": platform.python_version(),
        "django_version": django.get_version(),
        "cpu_count": os.cpu_count(),
        "timezone": getattr(settings, "TIME_ZONE", "UTC"),
        "debug": bool(getattr(settings, "DEBUG", False)),
        "docker": Path("/.dockerenv").is_file(),
        "database_engine": database_engine,
        "api_uptime_seconds": max(0, int(time.monotonic() - _PROCESS_START)),
        "paths": {
            "base_dir": str(base_dir),
            "data_dir": str(data_dir),
            "config_path": str(config_path) if config_path else "",
            "config_exists": bool(config_path and Path(config_path).is_file()),
            "markdown_files_dir": str(markdown_dir) if markdown_dir else "",
        },
        "disk": disk_block,
    }
