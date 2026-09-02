#!/usr/bin/env bash
# Print the preferred free development port, falling back when it is busy.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
preferred="$(tr -d '[:space:]' < "$ROOT/.dev-port")"
candidate="$preferred"

while lsof -nP -iTCP:"$candidate" -sTCP:LISTEN >/dev/null 2>&1; do
	candidate=$((candidate + 1))
done

if [[ "$candidate" != "$preferred" ]]; then
	printf 'Port %s in use — using %s instead\n' "$preferred" "$candidate" >&2
fi
printf '%s\n' "$candidate"
