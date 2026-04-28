# Sprint <N> Summary — <Title>

> **Period**: Day 1 – Day N (estimated <X> days, actual <Y> days)
> **Status**: <Complete | In progress | Aborted>
> **Author**: <作成者>, <最終更新日>
> **Compaction note**: 本書はトランスクリプト圧縮後に復元されたものを含む場合がある。`[reconstructed]` マークの箇所はトランスクリプト原文では確認できず、ADR / コミット / コードベースとの照合で再構成した内容。

---

## 0. ゴール

Sprint 開始時に設定したゴール (boolean で達成判定可能な形式)。後付けで書き換えない。

- [ ] G1: ...
- [ ] G2: ...
- [ ] G3: ...

---

## 1. Batch リスト

| # | Batch名 | 期間 | 結果 | 関連 ADR | コミット範囲 |
|---|---|---|---|---|---|
| 1 | <name> | Day X-Y | ✅ Complete / ⚠️ Partial / ❌ Aborted | ADR-NNN | sha-sha |
| ... | ... | ... | ... | ... | ... |

---

## 2. Hotfix 集計

Sprint 中に発生した Hotfix を bucket 単位で集計。**post-mortem の根拠**となるため省略しない。

| Bucket | 件数 | 主な原因 | 恒久対策 |
|---|---|---|---|
| <bucket-name> | N | ... | ADR-NNN で恒久対策化 |

---

## 3. ADR 起票

Sprint 中に確定した ADR を列挙。本書は ADR の要約のみを記録し、詳細は `docs/adr/ADR-NNN-*.md` を一次ソースとする。

- **ADR-NNN**: <title> — <status: Proposed / Accepted / Superseded>

---

## 4. メトリクス

定量的に追える数値のみを記載。主観的評価は本書では書かない (5節「学び」へ)。

| 指標 | 目標 | 実績 | 備考 |
|---|---|---|---|
| 完走日数 | X 日 | Y 日 | |
| コミット数 | — | N | |
| 新規 ADR | — | M | |
| テスト件数 (新規) | — | K | |
| Hotfix 件数 | <5 | H | bucket 数 = J |
| PR数 / merge率 | — | P / Q% | |

---

## 5. 学び (主観的評価可)

3-7 個の bullet で、Sprint で得られた knowledge を Sprint チーム向けに記録。次 Sprint 計画時の参照点となる。

- ...
- ...

---

## 6. 次 Sprint への継承事項

次 Sprint の Plan で必ず参照すべき点を明示。Plan 担当 (Cursor + 人間) はこのセクションを必ず読むこと。

- **継承1**: ...
- **継承2**: ...
- **未消化 (繰り越し)**: 本 Sprint で完了しなかった項目。次 Sprint の Backlog 入り。

---

## 7. 関連ファイル

Sprint 中に追加・変更された主要ファイルへのポインタ。

- `docs/specs/<file>.md`
- `docs/adr/ADR-NNN-*.md`
- `apps/server/src/<path>`
- `infra/terraform/<path>`

---

## 改訂履歴

| 日付 | 変更 | 起票 |
|---|---|---|
| YYYY-MM-DD | 初版 | <name> |
