#!/bin/bash
# OpenClaw Gateway start script (Colima + Tailscale)
# Usage:
#   bash ~/openclaw/start-gateway.sh
#   bash ~/openclaw/start-gateway.sh --restart
#   bash ~/openclaw/start-gateway.sh --rebuild
#
# Architecture:
#   tailscale-openclaw  — Tailscale sidecar
#   openclaw-gateway    — shares sidecar's network namespace

set -euo pipefail

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
export DOCKER_HOST="${DOCKER_HOST:-unix://$HOME/.colima/default/docker.sock}"

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
        "$SCRIPT_DIR"
        "$HOME/openclaw"
    )

    for candidate in "${candidates[@]}"; do
        [ -n "$candidate" ] || continue
        if [ -f "$candidate/start-gateway.sh" ] || [ -f "$candidate/openclaw.mjs" ] || [ -f "$candidate/Dockerfile" ]; then
            printf '%s
' "$candidate"
            return 0
        fi
    done

    printf '%s\n' "${requested:-${stored_root:-$SCRIPT_DIR}}"
}

OPENCLAW_LOCAL_IMAGE="openclaw-local:voice-reply-fix"
OPENCLAW_ROOT="$(resolve_openclaw_root)"
OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
OPENCLAW_WORKSPACE_DIR="${OPENCLAW_WORKSPACE_DIR:-$OPENCLAW_ROOT}"
IMAGE_BACKUP="${OPENCLAW_IMAGE_BACKUP:-$HOME/openclaw-image-backup.tar}"
TAILSCALE_CONTAINER="tailscale-openclaw"
GATEWAY_CONTAINER="openclaw-gateway"
TAILSCALE_IMAGE="tailscale/tailscale:latest"
TAILSCALE_SOCKET="/tmp/tailscaled.sock"
TAILSCALE_AUTHKEY="${TAILSCALE_AUTHKEY:-${TAILSCALE_KEY:-}}"
TAILSCALE_HOSTNAME="${TAILSCALE_HOSTNAME:-openclaw-live}"
TAILSCALE_PORT="${TAILSCALE_PORT:-18789}"
REBUILD_IMAGE=false
FORCE_RESTART=false
TAILSCALE_RECREATED=false

usage() {
    cat <<'EOF'
Usage: bash ~/openclaw/start-gateway.sh [--restart] [--rebuild]

  --restart  Force the gateway container to be recreated even if healthy
  --rebuild  Rebuild the image, refresh the tar backup, and recreate the gateway
EOF
}

for arg in "$@"; do
    case "$arg" in
        --restart)
            FORCE_RESTART=true
            ;;
        --rebuild)
            REBUILD_IMAGE=true
            FORCE_RESTART=true
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown argument: $arg" >&2
            usage >&2
            exit 1
            ;;
    esac
done

# Source secrets from .env (never hardcode keys in scripts)
if [ -f "$OPENCLAW_ROOT/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$OPENCLAW_ROOT/.env"
    set +a
fi

run_with_timeout() {
    local seconds="$1"
    shift
    perl -e 'alarm shift; exec @ARGV' "$seconds" "$@"
}

container_exists() {
    docker inspect "$1" >/dev/null 2>&1
}

container_running() {
    [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || echo false)" = "true" ]
}

container_status() {
    docker inspect -f '{{.State.Status}}' "$1" 2>/dev/null || echo missing
}

gateway_health_status() {
    docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
        "$GATEWAY_CONTAINER" 2>/dev/null || echo missing
}

gateway_internal_healthy() {
    container_running "$GATEWAY_CONTAINER" &&
        docker exec "$GATEWAY_CONTAINER" \
            node -e "const c=new AbortController(); const t=setTimeout(()=>c.abort(), 3000); fetch('http://127.0.0.1:${TAILSCALE_PORT}/healthz',{signal:c.signal}).then((r)=>{clearTimeout(t); process.exit(r.ok?0:1)}).catch(()=>{clearTimeout(t); process.exit(1)})" \
            >/dev/null 2>&1
}

gateway_proxy_healthy() {
    curl -m 4 -fsS "http://127.0.0.1:${TAILSCALE_PORT}/healthz" >/dev/null 2>&1
}

gateway_http_healthy() {
    gateway_internal_healthy && gateway_proxy_healthy
}

gateway_healthy() {
    if ! container_exists "$GATEWAY_CONTAINER"; then
        return 1
    fi

    case "$(gateway_health_status)" in
        healthy)
            return 0
            ;;
        running|starting)
            if gateway_http_healthy; then
                return 0
            fi
            return 1
            ;;
        *)
            return 1
            ;;
    esac
}

wait_for_gateway_health() {
    local attempts="${1:-180}"
    local last_status="missing"

    for _ in $(seq 1 "$attempts"); do
        if gateway_http_healthy; then
            return 0
        fi
        last_status="$(gateway_health_status)"
        case "$last_status" in
            healthy)
                return 0
                ;;
            unhealthy|exited|dead)
                echo "Gateway health check failed with status: $last_status"
                return 1
                ;;
        esac
        sleep 2
    done

    echo "Gateway health check timed out (last status: $last_status)."
    return 1
}

tailscale_has_ip() {
    docker exec "$TAILSCALE_CONTAINER" tailscale --socket="$TAILSCALE_SOCKET" ip -4 >/dev/null 2>&1
}

tailscale_sidecar_healthy() {
    container_running "$TAILSCALE_CONTAINER" && tailscale_has_ip
}

run_tailscale_up() {
    local timeout_seconds="${1:-0}"
    local -a cmd=(
        docker
        exec
        "$TAILSCALE_CONTAINER"
        tailscale
        --socket="$TAILSCALE_SOCKET"
        up
        --hostname="$TAILSCALE_HOSTNAME"
        --ssh
        --accept-dns=false
    )

    if [ -n "${TAILSCALE_AUTHKEY:-}" ]; then
        cmd+=(--auth-key="$TAILSCALE_AUTHKEY")
    fi

    if [ "$timeout_seconds" -gt 0 ]; then
        run_with_timeout "$timeout_seconds" "${cmd[@]}"
    else
        "${cmd[@]}"
    fi
}

tailscale_fast_heal() {
    if ! container_running "$TAILSCALE_CONTAINER"; then
        return 1
    fi

    echo "Tailscale sidecar running but unhealthy. Attempting a timed fast-path heal..."
    docker exec "$TAILSCALE_CONTAINER" tailscale --socket="$TAILSCALE_SOCKET" down >/dev/null 2>&1 || true

    if ! run_tailscale_up 10 >/dev/null 2>&1; then
        echo "Timed Tailscale heal did not complete successfully."
        return 1
    fi

    sleep 2
    tailscale_has_ip
}

recreate_tailscale_sidecar() {
    echo "Starting Tailscale sidecar..."
    TAILSCALE_RECREATED=true
    docker stop "$TAILSCALE_CONTAINER" >/dev/null 2>&1 || true
    docker rm "$TAILSCALE_CONTAINER" >/dev/null 2>&1 || true

    docker run -d \
        --name "$TAILSCALE_CONTAINER" \
        --hostname "$TAILSCALE_HOSTNAME" \
        --restart unless-stopped \
        --cap-add NET_ADMIN \
        --cap-add NET_RAW \
        -v tailscale-state:/var/lib/tailscale \
        -p "${TAILSCALE_PORT}:${TAILSCALE_PORT}" \
        --entrypoint tailscaled \
        "$TAILSCALE_IMAGE" \
        --socket="$TAILSCALE_SOCKET" --state=/var/lib/tailscale/tailscaled.state --tun=userspace-networking

    sleep 5

    if ! run_tailscale_up 15; then
        if [ -z "${TAILSCALE_AUTHKEY:-}" ]; then
            echo "Tailscale login incomplete and no auth key is configured." >&2
        else
            echo "Tailscale up did not succeed within the timeout." >&2
        fi
        return 1
    fi

    docker exec "$TAILSCALE_CONTAINER" tailscale --socket="$TAILSCALE_SOCKET" set --ssh >/dev/null 2>&1 || true

    if ! tailscale_has_ip; then
        echo "Tailscale sidecar started but still has no IPv4 address." >&2
        return 1
    fi

    docker exec "$TAILSCALE_CONTAINER" tailscale --socket="$TAILSCALE_SOCKET" funnel --bg "$TAILSCALE_PORT" >/dev/null 2>&1 || true
}

ensure_tailscale_sidecar() {
    if tailscale_sidecar_healthy; then
        echo "Tailscale sidecar already running and healthy."
        return 0
    fi

    if tailscale_fast_heal; then
        echo "Timed Tailscale fast-path heal succeeded."
        return 0
    fi

    echo "Recreating Tailscale sidecar..."
    recreate_tailscale_sidecar
}

resolve_openclaw_image() {
    if [ "$REBUILD_IMAGE" = true ]; then
        echo "Explicit --rebuild requested. Building image..."
        docker build --build-arg OPENCLAW_INSTALL_BROWSER=1 -t "$OPENCLAW_LOCAL_IMAGE" "$OPENCLAW_ROOT"
        echo "Refreshing backup tar..."
        docker save -o "$IMAGE_BACKUP" "$OPENCLAW_LOCAL_IMAGE"
        return 0
    fi

    if docker image inspect "$OPENCLAW_LOCAL_IMAGE" >/dev/null 2>&1; then
        echo "Image $OPENCLAW_LOCAL_IMAGE found locally. Skipping build."
        return 0
    fi

    if [ -f "$IMAGE_BACKUP" ]; then
        echo "Image missing. Loading from backup tar..."
        docker load -i "$IMAGE_BACKUP"
        return 0
    fi

    echo "ERROR: No image found and no backup tar at $IMAGE_BACKUP" >&2
    echo "Run: bash $0 --rebuild" >&2
    return 1
}

start_or_resume_existing_gateway() {
    if ! container_exists "$GATEWAY_CONTAINER"; then
        return 1
    fi

    case "$(container_status "$GATEWAY_CONTAINER")" in
        running)
            echo "Gateway container already running. Verifying health..."
            ;;
        paused)
            echo "Gateway container paused. Unpausing..."
            docker unpause "$GATEWAY_CONTAINER" >/dev/null
            ;;
        exited|created)
            echo "Gateway container exists but is not running. Starting it..."
            docker start "$GATEWAY_CONTAINER" >/dev/null
            ;;
        *)
            echo "Gateway container is not reusable in its current state."
            return 1
            ;;
    esac

    wait_for_gateway_health 180
}

recreate_gateway() {
    resolve_openclaw_image

    echo "Creating OpenClaw gateway container..."
    docker stop "$GATEWAY_CONTAINER" >/dev/null 2>&1 || true
    docker rm "$GATEWAY_CONTAINER" >/dev/null 2>&1 || true

    docker run -d \
        --name "$GATEWAY_CONTAINER" \
        --init \
        --restart unless-stopped \
        --memory=3g \
        --memory-swap=3g \
        --log-driver json-file \
        --log-opt max-size=10m \
        --log-opt max-file=3 \
        --network=container:"$TAILSCALE_CONTAINER" \
        -e "HOME=/home/node" \
        -e "TERM=xterm-256color" \
        -e "NODE_OPTIONS=--max-old-space-size=2048" \
        -e "OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN:-}" \
        -e "OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}" \
        -e "TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}" \
        -v "$OPENCLAW_STATE_DIR:/home/node/.openclaw" \
        -v "$OPENCLAW_STATE_DIR/workspace:/home/node/.openclaw/workspace" \
        -v "$OPENCLAW_WORKSPACE_DIR:/home/node/workspace:rw" \
        "$OPENCLAW_LOCAL_IMAGE" \
        node dist/index.js gateway --bind lan --port "$TAILSCALE_PORT"

    wait_for_gateway_health 180
}

ensure_tailscale_sidecar

if [ "$TAILSCALE_RECREATED" = true ] && [ "$FORCE_RESTART" = false ]; then
    echo "Tailscale sidecar was recreated. Forcing gateway recreation so it reattaches to the shared network."
    FORCE_RESTART=true
fi

TS_IP="$(docker exec "$TAILSCALE_CONTAINER" tailscale --socket="$TAILSCALE_SOCKET" ip -4 2>/dev/null | head -1 || echo unknown)"
echo "Tailscale IP: $TS_IP"

if [ "$FORCE_RESTART" = false ] && gateway_healthy; then
    echo "OpenClaw gateway already healthy. Nothing to do."
    echo "Gateway available on Tailscale IP: ${TS_IP}:${TAILSCALE_PORT}"
    exit 0
fi

if [ "$FORCE_RESTART" = false ] && start_or_resume_existing_gateway; then
    echo "OpenClaw gateway is healthy after resume/start."
    echo "Gateway available on Tailscale IP: ${TS_IP}:${TAILSCALE_PORT}"
    exit 0
fi

recreate_gateway

echo "Gateway starting on Tailscale IP: ${TS_IP}:${TAILSCALE_PORT}"
echo "Logs: docker logs -f $GATEWAY_CONTAINER"
