---
name: goal
description: Show, maintain, and verify explicit OpenClaw goal work orders. Use for /goal, especially hardening, deployment, bridge, security, and reliability goals that need durable acceptance criteria.
---

# Goal

Use this skill when the user invokes `/goal` or asks for a goal work order.

## Default Goal Store

On AJ's Mac, durable goals live in:

```text
/Users/aj/Shared Research/OpenClaw/Goals/
```

Use the Shared Research bridge only. Do not search AJ private folders for goal context.

## Hardening Goal

The active hardening goal is:

```text
/Users/aj/Shared Research/OpenClaw/Goals/2026-05-19-openclaw-hardening.goal.md
```

If the user says `/goal`, `/goal hardening`, or "ensure hardening as a /goal", summarize that goal first unless they clearly named a different goal.

## Behavior

- Treat goal files as operator work orders, not casual notes.
- Lead with current status: `complete`, `blocked`, `pending deploy`, or `needs verification`.
- Show the next required action.
- Include acceptance criteria that remain unmet.
- If a goal requires admin/root approval, say exactly what needs approval; do not pretend it was done.
- Never place sudo helpers or raw secrets in Shared Research.
- Never widen the bridge beyond `/Users/aj/Shared Research/OpenClaw/`.

## Response Shape

```text
GOAL
<goal title>

STATUS
- <current state>

NEXT
- <single next action>

UNMET ACCEPTANCE CRITERIA
- <remaining checks>

FILES
- <goal/report paths>

END
```

## Completion Rule

A hardening goal is not complete until a final verification report exists in:

```text
/Users/aj/Shared Research/OpenClaw/Reports/
```

and the live runtime, gateway health, bridge permissions, sudo/deploy hygiene, and model routing have all been verified.
