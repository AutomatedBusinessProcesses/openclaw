---
name: ide
description: Safely request IDE/Codex-side fact checks, code review, or file context without copy-paste and without giving Telegram/OpenClaw broad access to the AJ macOS account. Use when the user says /IDE, /ide, asks for an IDE second opinion, or asks OpenClaw to have the IDE fact-check/correct a Telegram answer.
---

# IDE Bridge

Use this skill to ask the IDE/Codex side for bounded help. This is a bridge request, not permission to browse the operator's computer.

## Hard Boundary

- Never search `/Users/aj`, another user's home directory, browser profiles, downloads, documents, desktop, keychains, mail stores, `.env` files, recovery phrases, or private app data to satisfy `/IDE`.
- Never use host shell, process tools, coding-agent delegation, subagents, or session tools to discover files outside the OpenClaw workspace for this skill.
- Only read files that are inside the OpenClaw workspace or inside the staged shared research bridge:
  `/Users/aj/Shared Research/OpenClaw/`
- Do not follow symlinks or `..` paths out of a staged folder.
- If the needed context is not already staged, create a request for the IDE and stop. Do not improvise by hunting for it.

## Bridge Pattern

1. Convert the user's request into a concise IDE work order.
2. Write the work order to the OpenClaw workspace bridge inbox if file tools are available:
   `/Users/aj/Shared Research/OpenClaw/IDE Bridge/inbox/<timestamp>-<slug>.md`
3. Tell the user the request is queued and list exactly what context is needed.
4. Wait for a matching IDE response or staged artifact in:
   `/Users/aj/Shared Research/OpenClaw/IDE Bridge/outbox/`
5. Use only that response or explicitly staged files to correct/fact-check the Telegram answer.

## Shared Research Folder

The no-friction context path is the dedicated staged folder, not broad home-directory access:

`/Users/aj/Shared Research/OpenClaw/`

- Keep private folders such as `Desktop`, `Documents`, `Downloads`, `Library`, secrets, and normal project trees at `700` unless intentionally shared.
- Put only approved context in a research/staging folder.
- Prefer `750` with a specific ACL for the `ABPclaw` user. Use `755` only when local machine-wide read access is intentional.
- Keep secrets, recovery phrases, raw `.env` files, login cookies, and browser profiles out of the shared folder unless the user explicitly stages a redacted version for that exact task.

## Request Format

Use this shape for bridge requests:

```text
IDE REQUEST
Goal:
- <what the IDE should check or correct>

Context already available:
- <workspace/staged files only>

Context needed:
- <small exact list, if not staged yet>

Boundaries:
- Do not use private AJ home files unless AJ/Codex explicitly stages them.
- Return concise corrections, citations/paths, and any patch/work order needed.
```

## If The Bridge Is Not Ready

Say that the IDE bridge request has been prepared but cannot be completed until the IDE/Codex side processes it or the user stages the requested files. Do not claim the IDE was consulted unless an actual outbox/staged response was read.
