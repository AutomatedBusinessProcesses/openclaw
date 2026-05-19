---
name: prompt-log
description: Search the durable prompt-only Telegram log when the user asks what they said, asked, decided, requested, or discussed yesterday/earlier/in Telegram. Use for remembering prior user prompts without relying on Telegram chat history or bot outputs.
---

# Prompt Log

Use this skill when the user asks about prior Telegram prompts or decisions they mentioned before.

## Location

Prompt-only Telegram logs live in the active agent workspace:

`logs/telegram-prompts/`

Each day has:

- `YYYY-MM-DD.md` - readable prompt ledger
- `YYYY-MM-DD.jsonl` - structured prompt records

These logs contain inbound user prompts only. Bot outputs are intentionally not logged here.

## Search

Start with fast text search:

```bash
rg -i "keyword|phrase|topic" logs/telegram-prompts
```

For a date-oriented question:

```bash
ls logs/telegram-prompts
sed -n '1,220p' logs/telegram-prompts/YYYY-MM-DD.md
```

For structured filtering:

```bash
jq -r 'select(.text | test("keyword"; "i")) | [.timestamp, .chatType, .senderName, .text] | @tsv' logs/telegram-prompts/*.jsonl
```

## Answering Rules

- Use prompt logs as evidence of what the user asked or said.
- Do not claim the bot said something unless you searched session logs or another bot-output source.
- If logs are missing for a date, say that directly and fall back to available context.
