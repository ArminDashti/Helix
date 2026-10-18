"""Repair double-encoded text: UTF-8 bytes mis-decoded as cp1252, then saved as UTF-8.

Find maximal runs of suspicious chars (U+0080-U+00FF), try run.encode("cp1252").decode("utf-8"),
and replace the run when it round-trips to valid UTF-8. Legit Persian/Arabic/CJK chars are
untouched (they are outside U+0080-U+00FF).

Usage: python scripts/fix_mojibake.py [--dry-run]
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTS = {".py", ".md", ".json", ".yaml", ".yml", ".js", ".jsx", ".ts", ".tsx", ".html", ".txt"}
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build"}

# Suspect = any char cp1252 can encode to a non-ASCII byte (covers U+00A0-U+00FF
# plus € ‚ „ … † ‰ Š ‹ Œ ' " • – — ™ › œ Ÿ etc.). Legit Persian is not cp1252-encodable,
# so it never joins a run; legit punctuation that fails the UTF-8 re-decode is kept as-is.


def is_suspect(ch: str) -> bool:
    if 0x80 <= ord(ch) <= 0x9F:  # C1 controls — never legit here, mojibake of cp1252-undef bytes
        return True
    try:
        data = ch.encode("cp1252")
    except UnicodeEncodeError:
        return False
    return len(data) == 1 and data[0] >= 0x80


def repair_text(text: str) -> tuple[str, int]:
    out, fixes, i, n = [], 0, 0, len(text)
    while i < n:
        if is_suspect(text[i]):
            j = i
            while j < n and is_suspect(text[j]):
                j += 1
            run = text[i:j]
            try:
                data = bytearray()
                for ch in run:
                    try:
                        data += ch.encode("cp1252")
                    except UnicodeEncodeError:
                        data += ch.encode("latin-1")  # C1 controls 0x81/0x8D/0x8F/0x90/0x9D
                out.append(data.decode("utf-8"))
                fixes += 1
                i = j
                continue
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass
            out.append(run)
            i = j
        else:
            out.append(text[i])
            i += 1
    return "".join(out), fixes


def main() -> int:
    dry = "--dry-run" in sys.argv
    files_changed = 0
    total_fixes = 0
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in EXTS:
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if not any(is_suspect(c) for c in text):
            continue
        fixed, fixes = repair_text(text)
        if fixes == 0:
            continue
        rel = path.relative_to(ROOT)
        if dry:
            print(f"WOULD FIX {rel} ({fixes} runs)")
        else:
            path.write_text(fixed, encoding="utf-8", newline="")
            print(f"FIXED {rel} ({fixes} runs)")
        files_changed += 1
        total_fixes += fixes
    print(f"{files_changed} files, {total_fixes} runs {'(dry run)' if dry else ''}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
