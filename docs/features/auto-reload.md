# 定期リロード (auto-reload)

> 指定した間隔で開いているタブを自動リロードします。

## 概要

ダッシュボード監視、ライブビュー、ステータスページの自動更新などに便利な機能です。タブごとに個別の間隔を設定でき、バックグラウンドservice workerで省リソースに動作します。

## 使い方

1. ツールバーのSidekickアイコンをクリック
2. ホーム画面の「Automation」セクションから **定期リロード** を選択
3. プリセット (15秒〜1時間) またはカスタムで秒数を指定
4. トグルをONにすると現在のタブが自動でリロードされ始める
5. 他のタブの状態は下の「他のタブ」セクションから確認・停止可能

## 設定

### プリセット間隔

| ラベル | 秒数 |
| ------ | ---- |
| 15秒   | 15   |
| 30秒   | 30   |
| 1分    | 60   |
| 3分    | 180  |
| 5分    | 300  |
| 10分   | 600  |
| 30分   | 1800 |
| 1時間  | 3600 |

### カスタム間隔

`5秒 〜 86,400秒 (24時間)` の範囲で任意の秒数を指定可能。

## 技術的な詳細

| 項目           | 内容                                                       |
| -------------- | ---------------------------------------------------------- |
| カテゴリ       | automation                                                 |
| Permissions    | `tabs`, `alarms`, `storage`                                |
| ストレージ     | `chrome.storage.local` (`feature:auto-reload:config` キー) |
| 1分以上の間隔  | `chrome.alarms` で実行 (省リソース)                        |
| 1分未満の間隔  | service worker内の `setTimeout` で実行                     |
| クリーンアップ | タブが閉じられたら自動で設定削除                           |

### データモデル

```ts
interface AutoReloadConfig {
  enabled: boolean;
  intervalSeconds: number;
  tabs: Record<number, TabReloadState>;
}

interface TabReloadState {
  tabId: number;
  url: string;
  title: string;
  intervalSeconds?: number;
  startedAt: number;
  nextReloadAt: number;
}
```

## 関連

- ソース: `apps/extension/src/features/auto-reload/`
- LP: https://hikaru-ito.github.io/sidekick-extension/docs/features/auto-reload
