---
name: shopper
description: Research purchases with durable markdown logging of searches, source links, price checks, constraints, and recommendations.
metadata: { "openclaw": { "requires": { "bins": ["node"] } } }
---

# shopper

Use this skill when the user invokes `/shopper` or asks you to shop, compare products, find prices, source vendors, evaluate deals, choose between options, or track availability.

The goal is not just to answer in chat. The goal is to leave a durable research trail that can be reopened later without relying on Telegram history.

## Mandatory Work Log

Every shopper run must write to a markdown log before the final answer.

Default log:

```bash
node {baseDir}/log-shopper-event.mjs start --goal "<user goal>"
```

The helper appends to:

```text
$OPENCLAW_STATE_DIR/workspace/skills/shopper/shopper-log.md
```

or, if `OPENCLAW_STATE_DIR` is not set:

```text
$HOME/.openclaw/workspace/skills/shopper/shopper-log.md
```

At minimum, record:

- the user's goal, budget, location/ship-to region, timing, must-haves, and deal breakers
- every search query or marketplace query before or immediately after running it
- every opened product/source URL, seller, observed price, shipping/return notes, and timestamp
- useful environment links and paths consulted, such as browser pages, local files, screenshots, wishlists, or previous logs
- why options were rejected
- the final recommendation, with the winning link(s) and remaining uncertainty

Do not put secret values in the log. If an env var, cookie, account, token, password, recovery phrase, or API key matters, log the variable or file name only, not its value.

## Logging Commands

Use these commands as the run progresses:

```bash
node {baseDir}/log-shopper-event.mjs search --query "best compact laser printer duplex scanner" --notes "Initial broad scan"
node {baseDir}/log-shopper-event.mjs source --url "https://example.com/item" --title "Example item" --price "$199" --seller "Example" --notes "Good warranty; slow shipping"
node {baseDir}/log-shopper-event.mjs env-link --path "$HOME/.openclaw/workspace/skills/shopper/shopper-log.md" --notes "Prior shopper log checked"
node {baseDir}/log-shopper-event.mjs decision --title "Shortlist" --notes "Rejected Item A because returns are poor; Item B remains best"
node {baseDir}/log-shopper-event.mjs final --title "Recommendation" --url "https://example.com/buy" --price "$199" --notes "Best fit for constraints"
```

If a command fails, create the markdown log manually at the same default path and continue. The final answer must include the log path.

## Research Rules

- Ask a clarifying question only when the missing fact changes the purchase materially. Otherwise make a conservative assumption and record it.
- Use current sources for prices, availability, model numbers, return windows, coupons, and shipping dates.
- Prefer primary sellers/manufacturers and reputable retailers over SEO listicles.
- Preserve exact URLs in the log. Use canonical product URLs when possible.
- Compare total cost, not sticker price: shipping, tax clues, coupon requirements, subscriptions, warranty, accessories, and return fees matter.
- Treat marketplace ratings carefully. Prefer recent reviews, verified purchase patterns, warranty reports, and repeated complaint themes.
- Never purchase, subscribe, bid, message a seller, or enter payment details without explicit user confirmation.
- When account login is required, use the browser/session already available to OpenClaw if possible. Do not ask the user to paste credentials into chat.

## Final Answer Shape

Be concise. Include:

- best option and why
- price and seller observed
- one or two credible alternatives when useful
- risks or uncertainties
- markdown log path

If no recommendation is safe yet, say what is missing and what was logged.
