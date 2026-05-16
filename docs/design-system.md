# Design System

Sidekickのデザインシステム。Mobbinリサーチに基づくニュートラル + シングルアクセント構成。

## 設計原則

1. **ニュートラル > 装飾** — 機能を邪魔しない。アクセントは1色のみ
2. **密度の階層** — アイコンタイル(36px) + 14pxタイトル + 12px説明 で視線誘導
3. **動きは控えめに** — 120-240ms / `ease-out`。ポップアップ内ではバウンスを使わない
4. **アクセシビリティ** — contrast 4.5:1以上、focus-visible のリング必須
5. **ダーク/ライト両対応** — CSS変数(--sk-\*)経由でセマンティック切替

## カラー

### Accent — Iris (#6366f1)

Productivity tool らしい知性 + 中立性を表す青紫系。`accent-50` 〜 `accent-950` (Tailwindプリセット経由)。

### Neutral — Zinc

Tailwind zinc と同等。`neutral-50` 〜 `neutral-950`。

### Semantic

| Token     | 用途         | Color     |
| --------- | ------------ | --------- |
| `success` | 成功・実行中 | `#10b981` |
| `warning` | 注意・警告   | `#f59e0b` |
| `danger`  | 削除・停止   | `#ef4444` |
| `info`    | 通知・情報   | `#06b6d4` |

### CSS Variables (Surface)

ライト/ダークの自動切替のため、surface系はCSS変数で扱う:

| Variable                | 用途                     |
| ----------------------- | ------------------------ |
| `--sk-surface`          | ベース背景               |
| `--sk-surface-muted`    | サブ背景 (リストhover等) |
| `--sk-surface-elevated` | カード/ポップオーバー    |
| `--sk-border`           | デフォルト境界線         |
| `--sk-border-strong`    | 強調境界線               |
| `--sk-fg-default`       | テキスト                 |
| `--sk-fg-muted`         | サブテキスト             |
| `--sk-fg-subtle`        | ヒント・ラベル           |

Tailwindでは `bg-surface`, `bg-surface-muted`, `text-fg-default` のように使用。

## タイポグラフィ

- **ファミリ**: Inter Variable (rsms.me/inter からCDN取得)
- **モノスペース**: JetBrains Mono / Fira Code
- **font-feature-settings**: `cv11`, `ss01`, `ss03` (Interの改良グリフ)

スケール: `xs`(11) / `sm`(13) / `base`(14) / `md`(15) / `lg`(16) / `xl`(18) / `2xl`(22) / `3xl`(28) / `4xl`(36) / `5xl`(48) / `6xl`(60)

## 角丸

| Token  | Value  | 用途                       |
| ------ | ------ | -------------------------- |
| `sm`   | 4px    | 小さなインジケータ         |
| `md`   | 8px    | ボタン・インプット・チップ |
| `lg`   | 12px   | カード                     |
| `xl`   | 16px   | モーダル                   |
| `2xl`  | 20px   | ヒーロー要素               |
| `full` | 9999px | トグル・アバター           |

## シャドウ

| Token      | 用途                                      |
| ---------- | ----------------------------------------- |
| `xs`       | カード(デフォルト)                        |
| `sm`       | ボタン                                    |
| `md`       | ホバー時のカード                          |
| `lg`       | ドロップダウン                            |
| `xl`/`2xl` | モーダル                                  |
| `glow`     | フォーカス・アクセント (4px iris-500 12%) |

## コンポーネント

`@sidekick/ui-kit` から提供:

- `Button` — primary / secondary / ghost / danger / link, sm / md / lg / icon
- `IconButton` — アイコンのみのボタン
- `Switch` — iOS風トグル (22x36)
- `Slider` — 単一値スライダー
- `Select` — Radix UIベース
- `Input` — テキスト入力
- `Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent`
- `ListItem` — アイコン+タイトル+説明+トレーリング+chevron
- `Badge` — iris / neutral / success / warning / danger
- `SectionHeader` — 機能カテゴリ等の小見出し

## モーション

| Token  | Value | 用途          |
| ------ | ----- | ------------- |
| `fast` | 120ms | hover, fade   |
| `base` | 200ms | toggle, slide |
| `slow` | 320ms | modal         |

Easing: `out` = `cubic-bezier(0.16, 1, 0.3, 1)` をデフォルトに。

Animation:

- `animate-fade-in` — 0 → 1 (200ms)
- `animate-fade-in-up` — 4px下から (240ms)
- `animate-shimmer` — スケルトン用

## ポップアップサイズ

`width: 380px, max-height: 600px` — Chromeのツールバーポップアップ標準幅。
