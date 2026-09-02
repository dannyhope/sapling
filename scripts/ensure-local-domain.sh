#!/usr/bin/env bash
# Ensure Sapling's committed local hostname is mapped to loopback.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOSTS_FILE="${DANNIFY_HOSTS_FILE:-/etc/hosts}"
DOMAIN="$(tr -d '[:space:]' < "$ROOT/.local-domain")"
MARKER="# dannify-local-domain:${DOMAIN}"

if [[ ! "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.local$ ]]; then
	printf 'error: invalid hostname in .local-domain: %s\n' "$DOMAIN" >&2
	exit 1
fi

if awk -v domain="$DOMAIN" '
	$1 !~ /^#/ {
		for (i = 2; i <= NF && $i !~ /^#/; i++)
			if ($i == domain && $1 != "127.0.0.1") exit 1
	}
' "$HOSTS_FILE"; then
	:
else
	printf 'error: %s has a conflicting hosts entry\n' "$DOMAIN" >&2
	exit 1
fi

if awk -v marker="$MARKER" -v domain="$DOMAIN" '
	index($0, marker) && $1 == "127.0.0.1" {
		for (i = 2; i <= NF && $i !~ /^#/; i++) if ($i == domain) found = 1
	}
	END { exit found ? 0 : 1 }
' "$HOSTS_FILE"; then
	printf '%s already resolves to 127.0.0.1\n' "$DOMAIN"
	exit 0
fi

TEMP_FILE="$(mktemp "${TMPDIR:-/tmp}/sapling-hosts.XXXXXX")"
trap 'rm -f "$TEMP_FILE"' EXIT
awk -v marker="$MARKER" 'index($0, marker) == 0 { print }' "$HOSTS_FILE" >"$TEMP_FILE"
printf '127.0.0.1\t%s\t%s\n' "$DOMAIN" "$MARKER" >>"$TEMP_FILE"

if [[ "$HOSTS_FILE" == "/etc/hosts" && "$EUID" -ne 0 ]]; then
	/usr/bin/osascript - "$SCRIPT_DIR/ensure-local-domain.sh" <<'APPLESCRIPT'
on run argv
	do shell script quoted form of item 1 of argv with administrator privileges
end run
APPLESCRIPT
else
	/usr/bin/install -m 644 "$TEMP_FILE" "$HOSTS_FILE"
fi

if [[ "$HOSTS_FILE" == "/etc/hosts" ]]; then
	/usr/bin/dscacheutil -flushcache
	/usr/bin/killall -HUP mDNSResponder >/dev/null 2>&1 || true
fi
printf 'Added %s -> 127.0.0.1 to %s\n' "$DOMAIN" "$HOSTS_FILE"
