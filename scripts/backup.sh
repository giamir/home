#!/usr/bin/env bash
# Dump the production Neon database to backups/home-<date>.dump (pg_dump custom
# format). Run weekly-ish and before any production db:push.
# Restore with: pg_restore -d "$PROD_DATABASE_URL" --clean --if-exists <dumpfile>
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${PROD_DATABASE_URL:-}" ] && [ -f .env ]; then
	set -a
	# shellcheck source=/dev/null
	source .env
	set +a
fi
: "${PROD_DATABASE_URL:?PROD_DATABASE_URL is not set (add it to .env)}"

# Neon recommends dumping via the direct endpoint, not the connection pooler.
url="${PROD_DATABASE_URL/-pooler./.}"

mkdir -p backups
out="backups/home-$(date +%F-%H%M).dump"
# Dump to a temp file first so an interrupted run never leaves a truncated
# .dump that looks like a good backup.
pg_dump "$url" -Fc -f "$out.tmp"
mv "$out.tmp" "$out"
echo "Wrote $out ($(du -h "$out" | cut -f1))"
