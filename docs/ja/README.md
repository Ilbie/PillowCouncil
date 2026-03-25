# PillowCouncil ドキュメント

> GitHub 閲覧者とコントリビューター向けの日本語概要です。

## 概要

PillowCouncil はローカル環境で動作するマルチエージェント意思決定ワークスペースです。複数の AI ペルソナに構造化された議論を行わせ、対立する観点を早い段階で可視化し、最後に最終提案・リスク・代替案・次のアクションまで整理できます。

## なぜ便利か

- 単発の AI チャットを再利用可能な意思決定プロセスに変えます。
- 最初の回答をそのまま採用せず、対立する視点を比較できます。
- セッション、プリセット、設定を SQLite ベースでローカル保存します。
- 独自の認証保存層を作らずに OpenCode 接続を再利用します。

## 提供機能

- opening・rebuttal・summary・final recommendation で進む構造化議論
- OpenCode ベースの再利用可能なプロバイダー・ログイン・モデル設定
- **SaaS Founder**、**Product Scope**、**Architecture Review** などの組み込みパネル
- 既定パネルでは足りない場合に使える AI 生成カスタムプリセット
- 韓国語・英語・日本語の出力対応
- Markdown / JSON エクスポート対応

## 利用フロー

1. プロバイダー、ログイン方式、モデルを設定します。
2. OpenCode を通じて接続を保存します。
3. トピック、プリセット、言語、議論強度を指定してセッションを作成します。
4. 実行中の議論をタイムラインで確認します。
5. 最終提案を確認し、必要に応じてエクスポートします。

## ローカルランタイム構成

- 認証情報は OpenCode が管理します。
- アプリ設定とセッション履歴は PillowCouncil が管理します。
- アプリデータは `~/.pillow-council/` 配下に保存されます。
- 既定の SQLite パスは `~/.pillow-council/data/pillow-council.db` です。

## リポジトリ構成

```text
apps/web                 Next.js UI と API ルート
packages/shared          データベース、スキーマ、リポジトリ、共有型
packages/agents          組み込みペルソナとプリセット生成
packages/providers       OpenCode 連携レイヤー
packages/orchestration   議論実行エンジン
packages/exports         エクスポート整形ユーティリティ
```

## コマンド

```bash
npm run dev
npm run build
npm run typecheck
npm test
npm run test:e2e
npm run db:inspect
```

## 関連ドキュメント

- [GitHub README](../../README.md)
- [ドキュメントハブ](../README.md)
- [English](../en/README.md)
- [한국어](../ko/README.md)
