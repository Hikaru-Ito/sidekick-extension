# AI Page Summary

> Have Claude read the page you're on. Get an overview, the key points, or ask follow-up questions — all in the popup.

## Demo

<video src="../../apps/landing/public/demos/ai-summary.webm" controls muted loop playsinline width="380"></video>

Regenerate with `pnpm record:demos -- --only ai-summary`.

## Overview

Sidekick's AI Summary feature uses the Anthropic Messages API directly from the extension. You bring your own API key (BYOK) — it stays in `chrome.storage.local` on the device and is never sent anywhere besides `api.anthropic.com`.

Three output modes are available:

- **Overview** — a streaming markdown summary, tunable for length and tone.
- **Key Points** — 3–5 emoji-prefixed cards. Useful when you only need the takeaways.
- **Chat** — multi-turn Q&A grounded in the page content.

## How to use

1. Click the Sidekick icon and pick **ページAI要約**.
2. The first time, paste your Anthropic API key into the settings screen. Click _キーをテストして保存_ — it makes a tiny request to verify the key, then persists it locally.
3. Back on the main view, choose model / length / mode and click **このページを要約する**.

Switching modes on the same page within ~5 minutes reuses Anthropic's [prompt cache](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching), so subsequent runs cost ≈10% of the first.

## Settings

| Setting         | Options                           | Default  |
| --------------- | --------------------------------- | -------- |
| Model           | Opus 4.7 / Sonnet 4.6 / Haiku 4.5 | Opus 4.7 |
| Length          | 短く / ふつう / 詳しく            | ふつう   |
| Tone            | 話し言葉 / 中立 / 硬め            | 中立     |
| Output language | 日本語 / English                  | 日本語   |

History keeps the last 20 (URL × mode × model) summaries in `chrome.storage.local`.

## Implementation notes

| Field              | Value                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category           | productivity                                                                                                                                                                       |
| Permissions        | `storage`, `scripting`, `tabs`                                                                                                                                                     |
| Storage area       | `chrome.storage.local` (`feature:ai-summary:settings`, `feature:ai-summary:history`)                                                                                               |
| Content extraction | `chrome.scripting.executeScript` injects a small function that returns the active tab's HTML; Mozilla [Readability](https://github.com/mozilla/readability) parses it in the popup |
| Max page size      | First ~50 000 characters of the extracted main content (well inside 200K context)                                                                                                  |
| Provider           | Anthropic Messages API via `@anthropic-ai/sdk` with `dangerouslyAllowBrowser: true`                                                                                                |
| Default model      | `claude-opus-4-7` with `thinking: { type: 'adaptive' }`                                                                                                                            |
| Streaming          | `client.messages.stream(...)` — text deltas are appended live to the UI                                                                                                            |
| Caching            | `cache_control: { type: 'ephemeral' }` on the page envelope; same page across modes hits the cache                                                                                 |

### Pages that can't be summarized

Chrome restricts `chrome.scripting.executeScript` on certain URLs:

- `chrome://` and `chrome-extension://` pages
- `edge://`, `about:` pages

For these the panel renders a polite "このページは読み取れません" message.

## See also

- Source: `apps/extension/src/features/ai-summary/`
- Landing page: https://hikaru-ito.github.io/sidekick-extension/docs/features/ai-summary
