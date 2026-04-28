# URL Health Report — 2026-04-29

> **前回**: 2026-04-27 (Batch 1 pre-flight)
> **今回**: 2026-04-29 (Sprint 5 フォローアップ)
> **ツール**: Python urllib (timeout=5s, User-Agent=SSW-Compass/1.0)

---

## サマリー

| 指標 | 前回 (2026-04-27) | 今回 (2026-04-29) | 変化 |
|---|---|---|---|
| 総 URL 数 | 40 | 40 | — |
| **成功 (2xx)** | 28 | **28** | 変化なし |
| **失敗 (4xx/5xx/timeout)** | 12 | **12** | 変化なし |
| dead rate | 30% | 30% | 変化なし |

---

## 失敗 URL 一覧 (12件)

| URL | エラー | 省庁 | 推定原因 |
|---|---|---|---|
| `moj.go.jp/isa/policies/policies/ssw/index.html` | 404 | 法務省 (ISA) | subtree 再編 |
| `moj.go.jp/isa/policies/policies/ssw/` | 404 | 法務省 (ISA) | subtree 再編 |
| `moj.go.jp/isa/applications/procedures/nyuukokukanri07_00201.html` | 404 | 法務省 (ISA) | subtree 再編 |
| `moj.go.jp/isa/news/` | 404 | 法務省 (ISA) | subtree 再編 |
| `moj.go.jp/isa/faq/` | 404 | 法務省 (ISA) | subtree 再編 |
| `moj.go.jp/hourei/` | 404 | 法務省 | subtree 再編 |
| `maff.go.jp/j/new_farmer/n_syurou/t_ginou.html` | 403 | 農林水産省 | bot 対策または移動 |
| `mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/gaikokujin/06.html` | 404 | 厚生労働省 | subtree 再編 |
| `mlit.go.jp/tochi_fudousan_kensetsugyo/const/index.html` | 404 | 国土交通省 | subtree 再編 |
| `meti.go.jp/` | timeout | 経産省 | bot 対策 |
| `meti.go.jp/policy/mono_info_service/mono/fiber/` | timeout | 経産省 | bot 対策 |
| `meti.go.jp/policy/` | timeout | 経産省 | bot 対策 |

---

## 分析

### moj.go.jp (6件) — ISA サブツリー再編
- 2026年3月-4月の moj.go.jp/isa 再構成で多数のパスが変更
- 代替 URL の調査が必要 (行政書士監修時に確認依頼済み)

### meti.go.jp (3件) — bot 対策
- ブラウザ経由ではアクセス可能だが、プログラムからの fetch を拒否
- 代替: meti.go.jp の公式 PDF を直接 URL 指定するか、別省庁の同等情報源を使用

### maff.go.jp (1件) / mhlw.go.jp (1件) / mlit.go.jp (1件)
- 403/404 — URL 移動または bot ブロック
- 行政書士監修時に最新 URL を確認

---

## 生存 URL の主要カテゴリ (28件)

- `moj.go.jp/isa/applications/ssw/` 系: ほぼ生存
- `moj.go.jp/isa/policies/ssw/` 系: 一部 404
- visa_secondary (5件): 全て生存 ✅
- visa_faq (1件): **0 件生存** (前回と変わらず)

---

## 行政書士監修へのお願い

以下の失敗 URL について、最新の正式 URL を教えてください:

1. 特定技能制度 総合案内 → 現在の正式 URL
2. 特定技能 手引き (在留資格変更) → 現在の正式 URL  
3. ISA FAQ → 現在の正式 URL
4. visa_faq 用の Q&A ページ → 新規 URL が必要 (現在 0 件)
5. maff.go.jp/mhlw.go.jp/mlit.go.jp 系の代替 URL

---

## 次のアクション

1. 行政書士監修で URL を確定 (`docs/gyoseishoshi-review-packet.md §E`)
2. `data/source-index.jsonl` の死 URL を修正 + 新規 URL 追加 (50件以上目標)
3. `pnpm run ingest --mode=best-effort` で全件 ingest
4. `SSW_VERTEX_MODE=real` に flip (ADR-016)
