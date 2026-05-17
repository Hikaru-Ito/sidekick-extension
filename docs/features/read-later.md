# Read Later

> Save the current tab to a personal queue you read later, optionally with an AI summary and notifications to Slack / Linear / Discord / custom webhooks.

## Demo

<video src="../../apps/landing/public/demos/read-later.webm" controls muted loop playsinline width="380"></video>

Regenerate with `pnpm record:demos -- --only read-later`.

## Overview

The Read Later feature gives you three surfaces:

- **Popup save card** — open a page, click the toolbar icon → "あとで読む", optionally add tags, optionally tick "AI要約も同時に作成する", and hit save. The popup closes after a brief confirmation.
- **Side panel list** — open from the toolbar (or via Chrome's side panel UI). Search, filter by unread / read, click tag chips to narrow, expand inline summaries, mark read / unread, delete.
- **Options page → Webhooks section** — configure where saves are pushed (Slack, Linear, Discord, custom). Toggle "保存時に AI 要約をデフォルトで作成する" to flip the popup checkbox default.

## Storage

| Data                                                              | Where                                                  | Why                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Saved items (title, URL, favicon, tags, summary, delivery status) | IndexedDB (`sidekick` DB, `readLater` store)           | Larger capacity than `chrome.storage.local`, indexed lookups by URL / tags / savedAt |
| Webhook configs + user preferences                                | `chrome.storage.local` (`feature:read-later:settings`) | Small; same locality guarantees as the AI Summary key                                |

`subscribeChanges` uses `BroadcastChannel('sidekick:read-later')` so the side-panel list refreshes the moment background side-effects finish.

## Save flow

1. **Popup**: `PopupSave` reads the active tab, dedups against any existing IDB item with the same URL, sends a `read-later:save` message to the service worker.
2. **Service worker**: extracts the page (Mozilla Readability via `chrome.scripting.executeScript`), writes the item to IDB with `deliveries: [pending, …]`, returns OK.
3. **Side-effects (background, non-blocking)**:
   - If "AI summary too" was checked, the SW runs the same overview + key-point calls as the AI Page Summary feature, writes the result back to the item.
   - Each enabled webhook is dispatched in order (after the summary if applicable), with status / error stored on the item.
4. **UI**: the side-panel list subscribes to the broadcast channel and re-renders.

URL dedup: saving the same URL again updates the existing entry. Tags merge (existing + new, deduplicated). `summary` is reset when the user opts into a fresh summary; otherwise it's preserved.

## Webhooks

| Provider | Configuration                          | Body                                                                                         |
| -------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| Slack    | Incoming Webhook URL                   | `{ "text": <rendered template> }`                                                            |
| Linear   | Personal API key + team key/UUID       | GraphQL `issueCreate` mutation; template is split on `\n---\n` between title and description |
| Discord  | Webhook URL                            | `{ "content": <rendered template> }`                                                         |
| Custom   | URL + method + headers + body template | Body is rendered as JSON-escaped when content-type is JSON, otherwise as plain text          |

### Template variables

`{{title}}` `{{url}}` `{{hostname}}` `{{description}}` `{{tags}}` `{{notes}}` `{{summary}}` `{{overview}}` `{{keypoints}}` `{{savedAt}}`

Section blocks: `{{#summary}}…{{/summary}}` — body inside the section is only emitted when the variable is non-empty.

If the "AI summary too" checkbox is ticked, webhook delivery waits for the summary so `{{summary}}` is populated.

## Implementation notes

| Field          | Value                                                                       |
| -------------- | --------------------------------------------------------------------------- |
| Category       | productivity                                                                |
| Permissions    | `storage`, `scripting`, `tabs`, `sidePanel`                                 |
| Side panel     | Shares `sidepanel.html` with AI Page Summary, routed via `?view=read-later` |
| AI integration | Re-uses `streamOverview` + `generateKeyPoints` from the AI Summary feature  |

## See also

- Source: `apps/extension/src/features/read-later/`
- Landing page: https://hikaru-ito.github.io/sidekick-extension/docs/features/read-later
