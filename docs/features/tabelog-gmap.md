# Tabelog × Google Maps

> Auto-injects a Google Maps rating card under the rating header of every Tabelog
> restaurant page, so you can compare both ratings without leaving the page.

## Demo

<video src="../../apps/landing/public/demos/tabelog-gmap.webm" controls muted loop playsinline width="380"></video>

Regenerate with `pnpm record:demos -- --only tabelog-gmap`.

## Overview

Open a restaurant page on `tabelog.com`. Sidekick:

1. Reads the restaurant name + nearest station off the page header.
2. Opens `google.com/maps/search/{name} {station}` in a hidden background tab.
3. Scrapes the rating, review count, and matched place name via
   `chrome.scripting.executeScript`.
4. Closes the tab.
5. Injects a card under Tabelog's rating header showing
   **★ rating / review count / confidence badge / link to Maps**.

Results are cached for 7 days (configurable) so subsequent visits are instant.

## Match confidence

The matched place name is compared to Tabelog's restaurant name using a
character-bigram Dice coefficient. The card always displays whatever Google
returned, plus a badge indicating how reliable the match is:

| Badge  | Threshold         | Meaning                                                    |
| ------ | ----------------- | ---------------------------------------------------------- |
| 高確度 | similarity ≥ 0.80 | Same restaurant with very high confidence                  |
| 中確度 | 0.60–0.79         | Probably right, double-check                               |
| 要確認 | < 0.60            | Could be a different place — click "Maps で見る" to verify |
| 不明   | (no match)        | Couldn't extract a name                                    |

## How to use

The card is automatic — no configuration is required after installation.
Open any `tabelog.com/{prefecture}/A.../A.../{id}/` page and the rating card
appears beneath Tabelog's own rating.

## Settings

In the Sidekick popup → **食べログ × Google Maps**:

- **有効化** — turn the auto-injection on/off globally.
- **キャッシュ期限 (日)** — `1` / `7` / `30` days. Lookups inside this window
  reuse the cached result and never open a hidden tab.
- **キャッシュ全削除** — wipe the IndexedDB cache.
- **取得失敗時に「Maps で検索」リンクを出す** — render a manual-search link
  when scraping fails (default ON).

## Operational caveats

- **Hidden tab briefly visible**: the lookup tab opens with `active: false`,
  so it doesn't steal focus, but it appears in the tab strip for ~3 seconds
  before being closed.
- **Rate limit**: at most one lookup per 2 seconds. Coalesced into a queue
  when multiple Tabelog tabs are opened in quick succession.
- **CAPTCHA cooldown**: if Google challenges the scrape with a CAPTCHA, the
  feature pauses new lookups for 30 minutes. Cached results continue to
  render normally.
- **Selector drift**: Google Maps' DOM is obfuscated and changes occasionally.
  The extractor tries several selectors in order; if all of them fail the
  card renders a "Couldn't find this restaurant" fallback with a manual
  search link.

## Implementation notes

- Category: lifestyle
- Manifest permissions used: `storage`, `tabs`, `scripting`, plus the
  `<all_urls>` host permission Sidekick already declares (needed for
  `chrome.scripting.executeScript` against `google.com`).
- Content script entry: `apps/extension/src/entrypoints/tabelog.content.ts`
- Match regex for the store-detail URL:
  `^https://tabelog\.com/[^/]+/A\d+/A\d+/(\d+)/?`
- Cache: IndexedDB store `tabelogGmap` (same database as Read Later,
  bumped to schema v2).

## See also

- [Landing page](https://hikaru-ito.github.io/sidekick-extension/docs/features/tabelog-gmap)
- Source: `apps/extension/src/features/tabelog-gmap/`
