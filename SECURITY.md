# Security Policy

## Reporting a Vulnerability

セキュリティに関する問題を発見した場合、公開のissueは作成せず、以下までメールでご連絡ください:

**hikaru@stract.co.jp**

48時間以内に確認の返信をします。詳細・再現手順・影響範囲を含めていただけると助かります。

## Scope

- ChromeのMV3 sandboxを超えた特権処理
- ユーザーデータの外部送信
- 拡張機能起因のXSS / CSRF
- 認証情報・トークンの漏洩

## Out of Scope

- Chrome本体やWeb標準のバグ
- ベストプラクティスではない設定 (ただし合理的な提案は歓迎)
