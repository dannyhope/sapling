#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/ensure-local-domain.sh"
PORT="$("$SCRIPT_DIR/resolve-dev-port.sh")"
exec python3 "$SCRIPT_DIR/dev-server.py" "$PORT"
