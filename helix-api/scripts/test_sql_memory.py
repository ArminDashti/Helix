import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import django
from django.conf import settings

if not settings.configured:
    settings.configure(MARKDOWN_FILES_DIR=tempfile.mkdtemp())
    django.setup()

from api import sql_memory

sql_memory.save_example("sales total last month", "SELECT SUM(amount) FROM sales WHERE d >= '2026-09-01'")
sql_memory.save_example("sales total last month", "SELECT SUM(amount) FROM sales WHERE d >= '2026-09-01'")  # dedup
sql_memory.save_example("top 5 customers by revenue", "SELECT TOP 5 c.id FROM customers c ORDER BY c.revenue DESC")

assert len(sql_memory._load()) == 2, "dedup failed"

hits = sql_memory.similar_examples("what were the sales total last month")
assert hits and hits[0]["sql"].startswith("SELECT SUM(amount)"), "similarity miss"
assert not sql_memory.similar_examples("gibberish zzz qqq"), "junk matched"

assert not sql_memory.save_example("", "") or True  # no crash on empty
sql_memory.save_example("", "SELECT 1")  # ignored
assert len(sql_memory._load()) == 2, "empty ask stored"

print("sql_memory self-check OK")
