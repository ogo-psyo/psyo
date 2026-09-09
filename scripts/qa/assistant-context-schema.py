"""Read-only column contract check against the isolated local release fixture.
No cloud connection, no record content, no credentials. This is SQL schema
validation, not a PostgREST/production integration test.
"""
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[2]
files = ["app/api/assistant/route.ts", "lib/server/agent/tools.ts",
         "lib/server/agent/access.ts", "lib/server/agent/runner.ts"]
queries = set()
for file in files:
    source = (root / file).read_text()
    queries.update(re.findall(r"\.from\([\"'](\w+)[\"']\)\s*\.select\(\s*[\"']([\w,*]+)[\"']\s*,?\s*\)", source))
# The tool chooses one of these literal (table, fields, order) tuples at runtime.
source = (root / "lib/server/agent/tools.ts").read_text()
queries.update(re.findall(r'\[\s*"(\w+)",\s*"([\w,]+)",\s*"\w+",?\s*\]', source))
assert len(queries) >= 15, "Expected context projections were not found"
sql = "\\set ON_ERROR_STOP on\nbegin read only;\n" + "\n".join(
    f"EXPLAIN SELECT {fields} FROM public.{table} LIMIT 0;"
    for table, fields in sorted(queries)
) + "\nrollback;\n"
result = subprocess.run(["docker", "exec", "-i", "supabase_db_pso-mvp", "psql",
                         "-U", "postgres", "-d", "pso_release_atomic_test", "-X", "-q"],
                        input=sql, text=True, capture_output=True)
if result.returncode:
    raise SystemExit(result.stderr)
print(f"PASS: {len(queries)} source-derived projections compile in the isolated PostgreSQL fixture (read-only)")
for table, fields in sorted(queries):
    print(f"{table}: {fields}")
