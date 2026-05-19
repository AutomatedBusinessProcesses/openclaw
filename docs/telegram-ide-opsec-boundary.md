# Telegram IDE Bridge OPSEC Boundary

Date: 2026-05-18

## Issue

The `/IDE` path was only a prototype, not a committed working skill. When OpenClaw could not find a real IDE skill, it could still fall back into generic local tool behavior. That created a bad failure mode: Telegram-originated prompts could attempt to discover host-readable AJ files instead of asking the IDE through a controlled bridge.

## What Actually Happened

The macOS account boundary was weaker than assumed:

- `ABPclaw` is not an admin user and cannot read AJ private folders that are mode `700`.
- Some AJ folders were mode `755` or otherwise local-user readable/traversable.
- Therefore, a process running as `ABPclaw` could read intentionally or accidentally world/staff-readable AJ paths.
- The earlier Telegram hardening set `tools.fs.workspaceOnly=true`, but that only constrained OpenClaw file tools. It did not block host shell, process, session, or subagent tools that could route around the file-tool boundary.

## Source Fix

Telegram-originated dispatch now applies a stronger local access boundary:

- File tools are forced to workspace-only.
- If the target agent is not fully sandboxed with `agents.*.sandbox.mode="all"`, Telegram runs deny local execution and cross-session tooling:
  - `bash`
  - `exec`
  - `process`
  - `agents_list`
  - `sessions_list`
  - `sessions_history`
  - `sessions_spawn`
  - `sessions_send`
  - `sessions_yield`
  - `subagents`
- Fully sandboxed Telegram agents may retain local execution tools because the sandbox, not macOS home permissions, becomes the containment boundary.

## Intended Bridge Model

The IDE bridge must be staged and explicit:

1. OpenClaw writes a concise IDE work order into its workspace bridge inbox.
2. Codex/IDE reads that work order from the AJ side.
3. Codex/IDE chooses what to inspect.
4. Codex/IDE writes a bounded answer or staged context into the bridge outbox.
5. OpenClaw reads only the staged/outbox result and continues.

OpenClaw must not discover arbitrary AJ files to satisfy `/IDE`.

## Recommended Filesystem Layout

Keep the normal AJ account private:

- `Desktop`, `Documents`, `Downloads`, `Library`, secrets, browser profiles, and normal private project folders: `700`.
- Dedicated research/staging folder: `750` with a specific ACL for `ABPclaw`, or `755` only when machine-wide local read access is intentional.
- No symlinks from the staged folder into private folders.
- No raw secrets, recovery phrases, login cookies, browser profiles, or unredacted `.env` files in the staged folder unless explicitly staged for that exact task.

## Skill Fix

A real `ide` skill now exists at `skills/ide/SKILL.md`. It defines `/IDE` as a bridge request, not a local file-discovery instruction.

## Deployment Note

The source fix must be deployed to the live `ABPclaw` runtime and the Telegram gateway restarted before this boundary is effective in production.
