---
name: shared-research
description: Use the Shared Research bridge for durable research files, reports, shopping/project markdown, IDE bridge handoffs, source logs, contact logs, and other user-approved cross-account context. Use whenever creating or reading persistent research artifacts for OpenClaw on AJ's Mac.
---

# Shared Research

This Mac's only intentional AJ <-> OpenClaw bridge is:

```text
/Users/aj/Shared Research/OpenClaw/
```

Use it for durable, non-secret research artifacts:

- shopping research and comparison notes
- listing/contact/email logs
- source links and search logs
- generated reports
- IDE bridge requests and staged answers
- redacted handoff documents

Do not use AJ private home folders as context. If something is needed, ask for it to be staged into Shared Research or create an IDE bridge request.

## Default Paths

- Shopper: `/Users/aj/Shared Research/OpenClaw/Shopper/`
- Computer parts: `/Users/aj/Shared Research/OpenClaw/Computer Parts/`
- Reports: `/Users/aj/Shared Research/OpenClaw/Reports/`
- IDE bridge inbox: `/Users/aj/Shared Research/OpenClaw/IDE Bridge/inbox/`
- IDE bridge outbox: `/Users/aj/Shared Research/OpenClaw/IDE Bridge/outbox/`

## Secret Rule

Never store raw secrets here:

- passwords
- API keys or tokens
- recovery phrases
- cookies/session data
- browser profiles
- unredacted `.env` files

If a secret matters, write only the variable name, account label, or redacted file reference.
