# Ikyu × Tabelog + Maps

> Auto-injects a two-row rating panel under the header of every Ikyu restaurant
> page, showing both the Tabelog and Google Maps scores side by side.

## Demo

<video src="../../apps/landing/public/demos/ikyu-ratings.webm" controls muted loop playsinline width="380"></video>

Regenerate with `pnpm record:demos -- --only ikyu-ratings`.

## Overview

Open a restaurant page on `restaurant.ikyu.com`. Sidekick:

1. Reads the restaurant name + nearest station / area from the page header.
2. **Tabelog (two-step)**: opens
   `google.com/search?q={name} {area} site:tabelog.com` in a hidden tab,
   picks the first SERP link that matches Tabelog's detail-page pattern
   (`/{pref}/A\d+/A\d+/\d+/`), navigates the same tab to that URL, then
   scrapes the _actual_ `★ rating` and `件のレビュー` count off the page
   header. Closes the tab. Google's relevance ranking is significantly
   stronger than Tabelog's own search, so the right restaurant is picked
   even for long fancy names.
3. **Google Maps**: opens `google.com/maps/search/{name} {area}` in a
   hidden tab, scrapes the best name-matched result, closes the tab.
4. Injects a two-row card under the Ikyu page header with **Tabelog
   rating / review count** and **Google Maps rating / review count**,
   each with a confidence badge and a direct link to the source.

Lookups are cached for 7 days, so re-visiting a page is instant. Tabelog
and Maps scrapes run **sequentially** (not in parallel) to keep the
tab-strip flash short and halve the rate at which Google might serve a
CAPTCHA.

## Match confidence

For each source, the matched place name is compared to the Ikyu restaurant
name using a character-bigram Dice coefficient. The row shows whatever the
source returned, plus a badge indicating how reliable the match is:

| Badge  | Threshold         | Meaning                                            |
| ------ | ----------------- | -------------------------------------------------- |
| 高確度 | similarity ≥ 0.80 | Same restaurant with very high confidence          |
| 中確度 | 0.60–0.79         | Probably right, double-check                       |
| 要確認 | < 0.60            | Could be a different place — click the source link |
| 不明   | (no match)        | Couldn't extract a name                            |

## How to use

Automatic — no configuration required after installation. Open any
`restaurant.ikyu.com/{numeric-id}/` page and the rating panel appears
beneath the page header.

## Settings

In the Sidekick popup → **一休 × 食べログ + Maps**:

- **有効化** — turn the auto-injection on/off globally.
- **キャッシュ期限 (日)** — `1` / `7` / `30` days. Lookups inside this window
  reuse the cached result and never open a hidden tab.
- **キャッシュ全削除** — wipe the IndexedDB cache.
- **取得失敗時に「検索」リンクを出す** — render manual-search links to
  Tabelog and Maps when scraping fails entirely (default ON).

## Operational caveats

- **Hidden tabs briefly visible**: two scrape tabs in sequence
  (Tabelog first, then Maps), each ~3 seconds in the tab strip.
- **Rate limit**: 2 seconds minimum between scrapes. CAPTCHA detection on
  either source pauses both for 30 minutes.
- **Selector drift**: Tabelog and Maps DOM are scraped with a list of
  fallback selectors; if all of them fail the row renders a manual-search
  link instead.

## Implementation notes

- Category: lifestyle
- Manifest permissions used: `storage`, `tabs`, `scripting`, plus the
  `<all_urls>` host permission Sidekick already declares.
- Content script entry: `apps/extension/src/entrypoints/ikyu.content.ts`
- URL regex: `^https://restaurant\.ikyu\.com/(\d+)(?:[/?#]|$)`
- Cache: IndexedDB store `ikyuRatings` (sidekick DB v3, shared with Read
  Later + Tabelog × Google Maps).
- Reuses `scrapeGmaps` from the tabelog-gmap feature for the Maps scrape.

## See also

- [Landing page](https://hikaru-ito.github.io/sidekick-extension/docs/features/ikyu-ratings)
- Source: `apps/extension/src/features/ikyu-ratings/`
