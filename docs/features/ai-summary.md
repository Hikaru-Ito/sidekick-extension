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

1. Click the Sidekick icon and pick **ページAI要約**. The popup shows a _launcher_ — page card + three mode buttons.
2. The first time, click ⚙ in the launcher to open the dedicated **settings page** in a new tab. Paste your Anthropic API key, click _キーをテストして保存_ (a tiny ping request verifies it), and pick your default model / length / tone / language.
3. Back on the popup, click one of the three mode buttons. Sidekick opens a **side panel** anchored to the right side of the browser, kicks off the run, and streams the result there.
4. The side panel is much taller than the popup — markdown summaries, key-point cards, and the chat thread all have room to breathe. Mode tabs, model picker, regenerate, and copy live there too.

Switching modes on the same page within ~5 minutes reuses Anthropic's [prompt cache](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching), so subsequent runs cost ≈10% of the first.

### Surfaces

| Surface        | Where                                            | What it does                                |
| -------------- | ------------------------------------------------ | ------------------------------------------- |
| Popup launcher | Toolbar icon → ページAI要約                      | Pick a mode, hand off to the side panel     |
| Side panel     | Right edge of the browser                        | Full summarizer UI — streaming, cards, chat |
| Options page   | Toolbar icon → ⚙, or chrome://extensions Options | API key + defaults + history controls       |

## Settings

| Setting         | Options                | Default  |
| --------------- | ---------------------- | -------- |
| Model           | Opus 4.7 / Sonnet 4.6  | Opus 4.7 |
| Length          | 短く / ふつう / 詳しく | ふつう   |
| Tone            | 話し言葉 / 中立 / 硬め | 中立     |
| Output language | 日本語 / English       | 日本語   |

History keeps the last 20 (URL × mode × model) summaries in `chrome.storage.local`.

## Implementation notes

| Field              | Value                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category           | productivity                                                                                                                                                                       |
| Permissions        | `storage`, `scripting`, `tabs`, `sidePanel`                                                                                                                                        |
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
