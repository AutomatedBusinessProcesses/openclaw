#!/bin/bash
# Direct host gateway control path for OpenClaw when Docker/Colima is unavailable.

set -euo pipefail

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OPENCLAW_PATHS_FILE="${OPENCLAW_PATHS_FILE:-$HOME/.openclaw/paths.json}"

paths_file_value() {
    local key="$1"
    [ -f "$OPENCLAW_PATHS_FILE" ] || return 1
    python3 - "$OPENCLAW_PATHS_FILE" "$key" <<'PY' 2>/dev/null
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
key = sys.argv[2]
try:
    data = json.loads(path.read_text(encoding="utf-8"))
except Exception:
    raise SystemExit(1)

value = data.get(key, "")
if isinstance(value, str) and value:
    print(value)
else:
    raise SystemExit(1)
PY
}

resolve_openclaw_root() {
    local candidate
    local requested="${OPENCLAW_ROOT:-}"
    local stored_root
    stored_root="$(paths_file_value openclawRoot || true)"
    local candidates=(
        "$requested"
        "$stored_root"
        "$SCRIPT_DIR/../openclaw"
        "$HOME/openclaw"
    )

    for candidate in "${candidates[@]}"; do
        [ -n "$candidate" ] || continue
        if [ -f "$candidate/openclaw.mjs" ]; then
            printf '%s
' "$candidate"
            return 0
        fi
    done

    printf '%s\n' "${requested:-${stored_root:-$HOME/openclaw}}"
}

resolve_node_binary() {
    local candidate
    local requested="${OPENCLAW_NODE_BINARY:-}"
    local stored_node
    stored_node="$(paths_file_value nodeBinary || true)"
    local candidates=(
        "$requested"
        "$stored_node"
        "$(command -v node 2>/dev/null || true)"
        "/usr/local/bin/node"
        "/opt/homebrew/bin/node"
    )

    for candidate in "$HOME"/.nvm/versions/node/*/bin/node; do
        [ -x "$candidate" ] && candidates+=("$candidate")
    done

    for candidate in "${candidates[@]}"; do
        [ -n "$candidate" ] || continue
        if [ -x "$candidate" ]; then
            printf '%s\n' "$candidate"
            return 0
        fi
    done

    return 1
}

OPENCLAW_ROOT="$(resolve_openclaw_root)"
RUNTIME_PARENT="${OPENCLAW_RUNTIME_PARENT:-$(getconf DARWIN_USER_TEMP_DIR 2>/dev/null || printf '%s' "$HOME/.openclaw/run/")}"
RUNTIME_DIR="${RUNTIME_PARENT%/}/openclaw-runtime"
PIDFILE="$RUNTIME_DIR/host-gateway.pid"
LOGFILE="${OPENCLAW_HOST_GATEWAY_LOG:-$HOME/Library/Logs/openclaw-host-gateway.log}"
PORT="${OPENCLAW_HOST_GATEWAY_PORT:-18789}"
START_TIMEOUT="${OPENCLAW_HOST_GATEWAY_START_TIMEOUT:-120}"
HOST_GATEWAY_LABEL="${OPENCLAW_HOST_GATEWAY_LABEL:-com.aj.openclaw-host-gateway}"
HOST_GATEWAY_PLIST="${OPENCLAW_HOST_GATEWAY_PLIST:-$HOME/Library/LaunchAgents/$HOST_GATEWAY_LABEL.plist}"
HOST_GATEWAY_LAUNCHER="$RUNTIME_DIR/host-gateway-launch.sh"
LAUNCHCTL_DOMAIN="gui/$(id -u)"
LAUNCHCTL_TARGET="$LAUNCHCTL_DOMAIN/$HOST_GATEWAY_LABEL"

mkdir -p "$RUNTIME_DIR" "$(dirname "$LOGFILE")" "$(dirname "$HOST_GATEWAY_PLIST")"

write_host_gateway_launcher() {
    local node_binary="$1"
    cat > "$HOST_GATEWAY_LAUNCHER" <<EOF
#!/bin/bash
set -euo pipefail
cd "$OPENCLAW_ROOT"
if [ -f "$OPENCLAW_ROOT/.env" ]; then
    set -a
    source "$OPENCLAW_ROOT/.env"
    set +a
fi
export OPENCLAW_SKIP_CANVAS_HOST="\${OPENCLAW_SKIP_CANVAS_HOST:-1}"
export PATH="$(dirname "$node_binary"):\$PATH"
exec -a openclaw-gateway-host "$node_binary" "$OPENCLAW_ROOT/openclaw.mjs" gateway --verbose --allow-unconfigured --bind lan --port "$PORT"
EOF
    chmod 755 "$HOST_GATEWAY_LAUNCHER"
}

write_host_gateway_plist() {
    cat > "$HOST_GATEWAY_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$HOST_GATEWAY_LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$HOST_GATEWAY_LAUNCHER</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>$LOGFILE</string>
    <key>StandardErrorPath</key>
    <string>$LOGFILE</string>
</dict>
</plist>
EOF
}

bootout_host_gateway_job() {
    launchctl bootout "$LAUNCHCTL_DOMAIN" "$HOST_GATEWAY_PLIST" >/dev/null 2>&1 || true
}

usage() {
    cat <<'EOF'
Usage: bash ~/host-gateway-control.sh <start|stop|restart|recover|status|logs>
EOF
}

process_alive() {
    local pid="$1"
    [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1
}

process_command() {
    local pid="$1"
    ps -p "$pid" -o command= 2>/dev/null || true
}

looks_like_host_gateway() {
    local pid="$1"
    local command
    command="$(process_command "$pid")"
    case "$command" in
        openclaw-gateway*|openclaw-gateway-host*|*openclaw.mjs*gateway*)
            return 0
            ;;
    esac
    return 1
}

gateway_health_url() {
    printf 'http://127.0.0.1:%s/healthz' "$PORT"
}

gateway_healthy() {
    curl -m 3 -fsS "$(gateway_health_url)" >/dev/null 2>&1
}

host_gateway_present() {
    current_pid >/dev/null 2>&1
}

host_gateway_healthy() {
    host_gateway_present && gateway_healthy
}

listening_pid() {
    lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1 || true
}

pid_from_file() {
    local pid
    if [ ! -f "$PIDFILE" ]; then
        return 1
    fi

    pid="$(tr -d '[:space:]' < "$PIDFILE" 2>/dev/null || true)"
    if process_alive "$pid" && looks_like_host_gateway "$pid"; then
        printf '%s\n' "$pid"
        return 0
    fi

    rm -f "$PIDFILE"
    return 1
}

current_pid() {
    local pid

    if pid="$(pid_from_file)"; then
        printf '%s\n' "$pid"
        return 0
    fi

    pid="$(listening_pid)"
    if [ -n "$pid" ] && looks_like_host_gateway "$pid"; then
        printf '%s\n' "$pid" > "$PIDFILE"
        printf '%s\n' "$pid"
        return 0
    fi

    return 1
}

gateway_pids() {
    local file_pid listener_pid
    file_pid="$(pid_from_file || true)"
    listener_pid="$(listening_pid)"

    {
        if [ -n "$listener_pid" ] && looks_like_host_gateway "$listener_pid"; then
            printf '%s\n' "$listener_pid"
        fi

        if [ -n "$file_pid" ]; then
            pgrep -P "$file_pid" 2>/dev/null | while read -r child_pid; do
                if [ -n "$child_pid" ] && looks_like_host_gateway "$child_pid"; then
                    printf '%s\n' "$child_pid"
                fi
            done
            printf '%s\n' "$file_pid"
        fi
    } | awk 'NF && !seen[$0]++'
}

process_group_id() {
    ps -p "$1" -o pgid= 2>/dev/null | tr -d '[:space:]'
}

looks_like_gateway_group_member() {
    local pid="$1"
    local command
    command="$(process_command "$pid")"
    case "$command" in
        openclaw|openclaw\ *|openclaw-gateway*|openclaw-gateway-host*|*openclaw.mjs*gateway*)
            return 0
            ;;
    esac
    return 1
}

gateway_group_ids() {
    local pid pgid members member valid

    for pid in $(gateway_pids); do
        pgid="$(process_group_id "$pid")"
        if [ -z "$pgid" ]; then
            continue
        fi

        members="$(ps -g "$pgid" -o pid= 2>/dev/null || true)"
        if [ -z "$members" ]; then
            continue
        fi

        valid=1
        while read -r member; do
            if [ -z "$member" ]; then
                continue
            fi
            if ! looks_like_gateway_group_member "$member"; then
                valid=0
                break
            fi
        done <<EOF
$members
EOF

        if [ "$valid" -eq 1 ]; then
            printf '%s\n' "$pgid"
        fi
    done | awk 'NF && !seen[$0]++'
}

load_env() {
    if [ -f "$OPENCLAW_ROOT/.env" ]; then
        set -a
        # shellcheck disable=SC1091
        source "$OPENCLAW_ROOT/.env"
        set +a
    fi
    export OPENCLAW_SKIP_CANVAS_HOST="${OPENCLAW_SKIP_CANVAS_HOST:-1}"
}

wait_for_health() {
    local attempts="${1:-45}"
    local pid="$2"

    for _ in $(seq 1 "$attempts"); do
        if gateway_healthy; then
            return 0
        fi
        if [ -n "$pid" ] && ! process_alive "$pid"; then
            return 1
        fi
        sleep 1
    done

    return 1
}

stop_pid() {
    local pid="$1"

    if ! process_alive "$pid"; then
        return 0
    fi

    kill "$pid" >/dev/null 2>&1 || true
    for _ in $(seq 1 20); do
        if ! process_alive "$pid"; then
            return 0
        fi
        sleep 0.5
    done

    kill -9 "$pid" >/dev/null 2>&1 || true
}

stop_process_group() {
    local pgid="$1"
    local members pid any_alive

    if [ -z "$pgid" ]; then
        return 1
    fi

    kill -TERM "-$pgid" >/dev/null 2>&1 || true
    for _ in $(seq 1 20); do
        members="$(ps -g "$pgid" -o pid= 2>/dev/null || true)"
        any_alive=0
        for pid in $members; do
            if process_alive "$pid"; then
                any_alive=1
                break
            fi
        done
        if [ "$any_alive" -eq 0 ]; then
            return 0
        fi
        sleep 0.5
    done

    kill -KILL "-$pgid" >/dev/null 2>&1 || true
}

start_gateway() {
    local pid existing_pid node_binary

    if host_gateway_healthy; then
        existing_pid="$(current_pid || true)"
        echo "HOST_GATEWAY: already healthy${existing_pid:+ (PID $existing_pid)}."
        return 0
    fi

    if gateway_healthy; then
        echo "HOST_GATEWAY: another gateway is already healthy on port $PORT. Not starting a direct host gateway."
        return 0
    fi

    existing_pid="$(current_pid || true)"
    if [ -n "$existing_pid" ]; then
        echo "HOST_GATEWAY: existing process $existing_pid is present but unhealthy. Stopping it first..."
        if ! stop_gateway >/dev/null 2>&1; then
            stop_pid "$existing_pid"
        fi
        rm -f "$PIDFILE"
    fi

    if [ ! -f "$OPENCLAW_ROOT/openclaw.mjs" ]; then
        echo "HOST_GATEWAY: missing $OPENCLAW_ROOT/openclaw.mjs" >&2
        return 1
    fi

    node_binary="$(resolve_node_binary || true)"
    if [ -z "$node_binary" ]; then
        echo "HOST_GATEWAY: unable to find a usable node binary for launchd-safe host recovery." >&2
        return 1
    fi

    load_env
    export PATH="$(dirname "$node_binary"):$PATH"

    echo "HOST_GATEWAY: launching direct host gateway..."
    write_host_gateway_launcher "$node_binary"
    write_host_gateway_plist
    bootout_host_gateway_job
    if ! launchctl bootstrap "$LAUNCHCTL_DOMAIN" "$HOST_GATEWAY_PLIST" >/dev/null 2>&1; then
        echo "HOST_GATEWAY: failed to bootstrap $HOST_GATEWAY_LABEL." >&2
        return 1
    fi

    if wait_for_health "$START_TIMEOUT" ""; then
        pid="$(current_pid || true)"
        if [ -n "$pid" ]; then
            printf '%s\n' "$pid" > "$PIDFILE"
        fi
        echo "HOST_GATEWAY: healthy on port $PORT (PID ${pid:-unknown})."
        return 0
    fi

    echo "HOST_GATEWAY: failed to become healthy on port $PORT." >&2
    if ! stop_gateway >/dev/null 2>&1; then
        stop_pid "$pid"
    fi
    rm -f "$PIDFILE"
    tail -n 40 "$LOGFILE" >&2 || true
    return 1
}

stop_gateway() {
    local pids pid pgids pgid
    bootout_host_gateway_job
    pids="$(gateway_pids)"
    if [ -z "$pids" ]; then
        rm -f "$PIDFILE"
        echo "HOST_GATEWAY: no running host gateway found."
        return 0
    fi

    pgids="$(gateway_group_ids)"
    if [ -n "$pgids" ]; then
        echo "HOST_GATEWAY: stopping process group(s) $(printf '%s ' $pgids | sed 's/ $//')..."
        for pgid in $pgids; do
            stop_process_group "$pgid"
        done
    else
        echo "HOST_GATEWAY: stopping PID(s) $(printf '%s ' $pids | sed 's/ $//')..."
        for pid in $pids; do
            stop_pid "$pid"
        done
    fi
    rm -f "$PIDFILE"
    echo "HOST_GATEWAY: stopped."
}

show_status() {
    local pid
    pid="$(current_pid || true)"

    if [ -n "$pid" ] && gateway_healthy; then
        echo "HOST_GATEWAY: healthy${pid:+ (PID $pid)}."
        return 0
    fi

    if [ -n "$pid" ]; then
        echo "HOST_GATEWAY: process $pid is present but health checks are failing."
        return 1
    fi

    if gateway_healthy; then
        echo "HOST_GATEWAY: another gateway is healthy on port $PORT, but no direct host gateway is running."
        return 1
    fi

    echo "HOST_GATEWAY: stopped."
    return 1
}

case "${1:-}" in
    start|recover)
        start_gateway
        ;;
    stop)
        stop_gateway
        ;;
    restart)
        stop_gateway
        start_gateway
        ;;
    status)
        show_status
        ;;
    logs)
        tail -n 120 "$LOGFILE" 2>/dev/null || echo "HOST_GATEWAY: no host gateway log yet."
        ;;
    -h|--help|"")
        usage
        [ "${1:-}" = "" ] && exit 1 || exit 0
        ;;
    *)
        echo "Unknown command: $1" >&2
        usage >&2
        exit 1
        ;;
esac
