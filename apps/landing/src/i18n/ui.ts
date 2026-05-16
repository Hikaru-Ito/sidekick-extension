import type { Locale } from './types';

/** All UI strings keyed by locale. */
export const ui = {
  en: {
    'nav.features': 'Features',
    'nav.install': 'Install',
    'nav.docs': 'Docs',
    'nav.github': 'GitHub',
    'nav.cta': 'Install',
    'header.tag': 'Open source',
    'header.tagline': 'Productivity utilities in one extension',

    'hero.badge': 'v0.1.0 has been released',
    'hero.titleLine1': 'A reliable sidekick',
    'hero.titleLine2Accent': 'for your everyday browser',
    'hero.description':
      'Sidekick bundles many small productivity utilities into a single open-source Chrome extension. One install, every utility you need.',
    'hero.ctaPrimary': 'Add to Chrome',
    'hero.ctaSecondary': 'View on GitHub',
    'hero.footnote': 'MIT licensed · Manifest V3 · privacy-friendly',
    'hero.previewTagline': 'Productivity utilities in one extension',
    'hero.previewSection': 'Automation',
    'hero.previewSummary': 'Reloading 1 tab every 30 sec',

    'features.title': 'Available features',
    'features.subtitle': 'Sidekick is modular. New features are added continuously as open source.',
    'features.statusStable': 'Stable',
    'features.statusPlanned': 'Planned',

    'oss.title': 'Open source through and through',
    'oss.description':
      'All Sidekick code is on GitHub. Permissions and the privacy policy are fully transparent, and the community can propose and implement new features.',
    'oss.point1Title': 'MIT License',
    'oss.point1Desc': 'Free for commercial and personal use',
    'oss.point2Title': 'Manifest V3',
    'oss.point2Desc': "Built on Chrome's latest extension spec",
    'oss.point3Title': 'TypeScript + WXT',
    'oss.point3Desc': 'Modern, type-safe build toolchain',
    'oss.point4Title': 'Modular architecture',
    'oss.point4Desc':
      'One directory per feature under features/ — add features without touching anything else',
    'oss.codeComment': '# Adding a feature (manifest-driven)',

    'cta.title': 'Get started today',
    'cta.subtitle': 'Install in minutes and make your daily browsing better.',
    'cta.button': 'See install instructions',

    'install.title': 'Install',
    'install.subtitle':
      'Before the Chrome Web Store listing, you can install via a prebuilt zip or developer mode.',
    'install.optionA': 'Chrome Web Store (coming soon)',
    'install.optionADesc': 'Enabled after review. The easiest path.',
    'install.optionAButton': 'Add to Chrome (coming soon)',
    'install.optionB': 'Load from a release zip',
    'install.optionBStep1': 'Download the latest sidekick-chrome-vX.Y.Z.zip from the Releases page',
    'install.optionBStep2': 'Unzip into a folder of your choice',
    'install.optionBStep3': 'Open chrome://extensions in Chrome',
    'install.optionBStep4': "Toggle 'Developer mode' on (top-right)",
    'install.optionBStep5': "Click 'Load unpacked' and pick the folder you unzipped",
    'install.optionBStep6': 'The Sidekick icon should appear in your toolbar',
    'install.optionC': 'Build from source',
    'install.optionCDesc': 'For users who want the latest unreleased changes.',
    'install.permissions': 'Permissions',
    'install.permissionsDesc':
      'Sidekick uses the following permissions. Everything stays inside the extension; no data is sent to external servers.',
    'install.permTabs': 'reload and inspect tabs',
    'install.permAlarms': 'schedule periodic work',
    'install.permStorage': 'persist settings (synced across devices)',
    'install.permScripting': 'reserved for future features',

    'docs.title': 'Documentation',
    'docs.subtitle': 'Usage guides, feature reference, contributor docs.',
    'docs.guides': 'Guides',
    'docs.featureReference': 'Feature reference',
    'docs.linkInstall': 'Install guide',
    'docs.linkContributing': 'Contributing guide',
    'docs.linkArchitecture': 'Architecture overview',
    'docs.linkDesignSystem': 'Design system',
    'docs.back': '← Back to docs',

    'feature.section.usage': 'How to use',
    'feature.section.implementation': 'Implementation notes',
    'feature.section.highlights': 'Highlights',

    'footer.tagline': 'Sidekick contributors · MIT License',
    'footer.github': 'GitHub',
    'footer.issues': 'Issues',
    'footer.contributing': 'Contributing',

    'lang.switcher': 'Language',
  },
  ja: {
    'nav.features': '機能',
    'nav.install': 'インストール',
    'nav.docs': 'ドキュメント',
    'nav.github': 'GitHub',
    'nav.cta': 'インストール',
    'header.tag': 'Open Source',
    'header.tagline': '便利機能をひとつに',

    'hero.badge': 'v0.1.0 がリリースされました',
    'hero.titleLine1': '毎日のブラウザに、',
    'hero.titleLine2Accent': '頼れる相棒を',
    'hero.description':
      'Sidekick は便利機能を一つの拡張にまとめた、オープンソースの Chrome 拡張機能です。単機能拡張を何個も入れる代わりに、Sidekick 一つで生産性を底上げします。',
    'hero.ctaPrimary': 'Chromeに追加する',
    'hero.ctaSecondary': 'GitHubで見る',
    'hero.footnote': 'MITライセンス · Manifest V3 · プライバシーフレンドリー',
    'hero.previewTagline': '便利機能をひとつに',
    'hero.previewSection': 'Automation',
    'hero.previewSummary': '30秒毎に1タブ実行中',

    'features.title': '利用できる機能',
    'features.subtitle': 'Sidekick はモジュラー設計。新しい機能はOSSとして継続的に追加されます。',
    'features.statusStable': 'Stable',
    'features.statusPlanned': 'Planned',

    'oss.title': '完全にオープンソース',
    'oss.description':
      'Sidekick の全コードは GitHub で公開されています。プライバシーポリシーや権限が透明で、コミュニティが機能を提案・実装できます。',
    'oss.point1Title': 'MIT License',
    'oss.point1Desc': '商用・個人利用ともに自由',
    'oss.point2Title': 'Manifest V3',
    'oss.point2Desc': 'Chrome の最新拡張機能仕様に準拠',
    'oss.point3Title': 'TypeScript + WXT',
    'oss.point3Desc': 'モダンなビルドツールチェーン',
    'oss.point4Title': 'モジュラー設計',
    'oss.point4Desc': 'features/ 配下に1機能=1ディレクトリで追加可能',
    'oss.codeComment': '# 機能追加ルール (manifest駆動)',

    'cta.title': '今すぐ始める',
    'cta.subtitle': '数分でインストールして、毎日のブラウジングを快適に。',
    'cta.button': 'インストール手順を見る',

    'install.title': 'インストール',
    'install.subtitle':
      'Chrome Web Store 公開前は、ビルド済みパッケージか開発者モードでインストールできます。',
    'install.optionA': 'Chrome Web Store (準備中)',
    'install.optionADesc': '審査通過後に有効化されます。最も簡単な方法です。',
    'install.optionAButton': 'Chrome に追加 (準備中)',
    'install.optionB': 'リリースzipから読み込む',
    'install.optionBStep1': 'Releases ページから最新の sidekick-chrome-vX.Y.Z.zip をダウンロード',
    'install.optionBStep2': 'zip を任意のフォルダに解凍',
    'install.optionBStep3': 'Chrome で chrome://extensions を開く',
    'install.optionBStep4': '右上の「デベロッパーモード」をON',
    'install.optionBStep5':
      '「パッケージ化されていない拡張機能を読み込む」をクリックし、解凍したフォルダを選択',
    'install.optionBStep6': 'ツールバーにSidekickアイコンが表示されればOK!',
    'install.optionC': 'ソースからビルド',
    'install.optionCDesc': '最新の開発版を試したい人向け。',
    'install.permissions': '権限について',
    'install.permissionsDesc':
      'Sidekick は以下の権限を使います。すべて拡張機能内で完結し、外部にデータは送信されません。',
    'install.permTabs': 'タブのリロード・取得',
    'install.permAlarms': '定期実行のスケジューリング',
    'install.permStorage': '設定の保存 (端末間で同期)',
    'install.permScripting': '将来の機能のための予約',

    'docs.title': 'ドキュメント',
    'docs.subtitle': '使い方ガイド、機能リファレンス、コントリビュータ向けドキュメント。',
    'docs.guides': 'ガイド',
    'docs.featureReference': '機能リファレンス',
    'docs.linkInstall': 'インストール手順',
    'docs.linkContributing': 'コントリビューションガイド',
    'docs.linkArchitecture': 'アーキテクチャ概要',
    'docs.linkDesignSystem': 'デザインシステム',
    'docs.back': '← ドキュメントへ戻る',

    'feature.section.usage': '使い方',
    'feature.section.implementation': '技術的な詳細',
    'feature.section.highlights': '主な特徴',

    'footer.tagline': 'Sidekick contributors · MIT License',
    'footer.github': 'GitHub',
    'footer.issues': 'Issues',
    'footer.contributing': 'Contributing',

    'lang.switcher': '言語',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type UIKey = keyof (typeof ui)['en'];

export function t(locale: Locale, key: UIKey): string {
  return ui[locale][key] ?? ui.en[key] ?? key;
}
