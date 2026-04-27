# VCJ Design Specs — Reading Order

## 読み順 (上から順に)

1. **v3-supplement.md** ← 最新の上書き版。読み始めはここから。
2. **v2-comprehensive-design.md** ← v3 で言及されない技術詳細はこちらが正典。

## 競合解決ルール

v2 と v3 が矛盾する場合、**v3 が常に優先** する。例:
- ブランド名 → v3 (Visa Compass Japan / VCJ / ビザコンパス)
- Cursor rules 構造 → v3 24章 (2-4-2 構造)。v2 16章は無視。
- Sprint 計画 → v3 26章。v2 12章は無視。
- リスクレジスタ → v3 25章 (R16-R20 を v2 17章 R1-R15 に追加)。

## v2 のうち今でも有効な章 (本リポジトリの正典)

- **1章**: postMessage プロトコル正確仕様 (`ui/initialize` 系)
- **4章**: tsconfig / package.json / vite.config 雛形
- **5章**: search_visa 完全実装サンプル (handler + schema + zod)
- **6章**: UI Resource (App class + a11y + i18n)
- **7章**: PII guard コード (DLP + regex 二段)
- **8章**: BYOSA + Workload Identity Federation + Terraform 構造
- **9章**: Audit logging (PII 漏洩なし)
- **10章**: Vertex AI Search Grounding 整合性
- **11章**: 行政書士法 §19-1 防衛 (disclaimer 確定文)
- **13章**: GitHub Actions + WIF パイプライン
- **14章**: ディレクトリ提出チェックリスト
- **15章**: 観測性 / Feature Flag / Error Reporting
- **17章**: リスクレジスタ R1-R15

## v3 で新たに追加された章

- **A章**: リブランド全置換マップ (SuguVisa → VCJ)
- **B章**: 第二設計書からの統合 採否判定
- **20章**: 疑似ストリーミング UX (Skeleton + CSS transition)
- **21章**: Commit Moment パターン (checklist UI)
- **22章**: SEP-1686 Tasks Primitive (Sprint 5+ 採用予定、現時点では不採用)
- **23章**: ゼロトラスト多層 (出力 sanitizer / Egress / Tool visibility)
- **24章**: Cursor 2-4-2 ルール構造 + 3 大ガードレール
- **25章**: リスクレジスタ追補 R16-R20
- **26章**: Sprint 統合計画 (これが Sprint 1-5+ の決定版)

## 参照禁止 (古い情報、混入したら削除)

- 旧 SuguVisa B2B/Private 関連の記述全般 (本リポジトリの scope 外、別 repo で扱う)
- v2 12章「Sprint ロードマップ」 (v3 26章で完全に上書き)
- v2 16章「Cursor Skills / Rules」 (v3 24章で完全に上書き)
- 設計書中の「SuguVisa」表記 (全て VCJ または Visa Compass Japan に置換済み)

## ブランド名 (全 surface で統一)

- 正式名 (英語): **Visa Compass Japan**
- 略称 (技術): **VCJ**
- 日本語通称: **ビザコンパス**
- 採用しない呼称: ビザコン (婚活コン等と紛らわしい)、SuguVisa (旧名)、すぐビザ (旧名)
