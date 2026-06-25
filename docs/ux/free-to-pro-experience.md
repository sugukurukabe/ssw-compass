# Free → Pro 体験 設計提案 (Phase 2)

# Free → Pro experience design proposal (Phase 2)

# Proposal desain pengalaman Free → Pro (Fase 2)

> **本書は設計提案であり、実装は含まない (別 PR / 別フェーズで実装)。**
> This is a design proposal only; no implementation is included here.
> Ini hanya proposal desain; tidak ada implementasi di sini.
>
> ステータス: Draft / 提案 — レビュー待ち
> 関連: `docs/ssw-compass-master-plan.md` T11 (Pro/JWT 認可) / T12 (外部チェックアウト誘導)、
> ADR-024 (L2 HITL 書き込みツール)、`docs/verify-widgets.md` (Phase 1)

---

## 0. 要旨 / Abstract / Abstrak

SSW Compass は公的・読み取り中心・匿名の MCP アプリ (行政書士法 §19 = 情報提供のみ)。
Free の 6 読み取りツールに加え、Pro には L2 の HITL 書き込みツール 3 種
(`prepare_document_package` / `submit_gyoseishoshi_approval` / `get_package_status`) がある。
本提案は **Free ユーザーが自然に価値を体感し、必要になった時だけ Pro へ上位移行する体験** を設計する。
**アプリ内課金はしない / 強いアップセルはしない / 外部チェックアウトへ誘導** (T12・MCP/Apps 規約準拠)。

> Free has 6 read-only tools; Pro adds 3 L2 HITL write tools. This proposes a
> calm, useful Free→Pro path with **no in-app billing, no aggressive upsell,
> redirect to external checkout** — compliant with §19 and the T12 plan.

---

## 1. 前提と制約 / Principles & constraints

1. **§19 = 情報提供のみ。** Pro でも法律行為は行わない。Pro は「行政書士の作業を効率化する
   道具」(書類パッケージ生成・承認記録・状態照会) であり、申請代行ではない。
2. **アプリ内課金をしない。** ChatGPT / Claude のウィジェット内で決済 UI を出さない。
3. **強いアップセルをしない。** モーダルの連打・誘導の点滅・ダークパターンを禁止。
   「丁寧で有用な説明 + 外部リンク」を 1 回、文脈に沿って提示するだけ。
4. **外部チェックアウトへ誘導。** 価格・契約・本人確認 (行政書士資格確認) は
   サーバー外の Web (例: `https://compass.sugukuru.example/pro`) で完結。
   `_meta` の `redirect_domains` (T12) に当該ドメインのみを宣言。
5. **PII を扱わない。** 上位移行フローでも氏名・在留カード番号等を MCP に入れさせない。
6. **匿名のまま価値が出る。** 認証は Pro 機能に触れた時だけ求める (段階的認可 / step-up)。

---

## 2. ペルソナと価値訴求 / Personas & value props

### P1. 行政書士 (Pro 候補・`gyoseishoshi_verified`)

- **痛み**: 一次情報の確認・必要書類の取りまとめ・承認記録 (監査) に時間がかかる。様式の取り違え。
- **Free で得る価値**: 一次情報リンク・必要書類チェックリスト・期限タイムラインで**確認の下ごしらえ**が速い。
- **Pro で喜ばれること (根拠)**:
  - `prepare_document_package`: 申請区分・分野から**書類パッケージ + GCS 署名 URL を冪等生成**。
    → 手作業の取りまとめを削減。`get_package_status` で状態照会・再署名。
  - `submit_gyoseishoshi_approval`: **MRTR 多段承認 + 7 年監査保存**で承認記録の証跡化。
    → 事務所のコンプライアンス (確認した・承認した、を残す) を満たす。
  - 根拠: これらは ADR-024 で承認された唯一の L2 書き込みツール。Free の読み取りでは
    「調べる」までで止まるが、行政書士の実務は「まとめる・承認する・記録する」に価値がある。

### P2. 派遣会社担当 (Free/Pro)

- **痛み**: 複数スタッフの**期限管理**(14 日以内届出・更新・通算 5 年上限)、必要書類の抜け漏れ、申請種別の即断。
- **Free で得る価値**: `get_deadline_timeline` / `list_visa_documents` / `classify_procedure` で**即断・即チェック**。
  Phase 1 で進捗バー・期限強調・コピー機能を追加済み。
- **Pro で喜ばれること (根拠)**:
  - 提携行政書士へ渡す**書類パッケージの素**を `prepare_document_package` で生成 → 受け渡しの往復削減。
  - (将来) 複数案件の期限ダッシュボード的な見え方。ただし PII 非保持の範囲で、年月のみ・匿名集計。

### P3. 本人/家族 (Free 中心)

- **価値**: 自分の手続きの全体像・期限・必要書類を母国語で把握。Pro は基本不要 (行政書士向け機能のため)。
- **方針**: 本人には Pro を**勧めない**。「専門家に相談を」の導線 (情報提供) に留める (§19)。

---

## 3. 「触れた時」の体験 / The "moment of contact" experience

Free ユーザーが Pro 専用ツール (例: `prepare_document_package`) を呼ぼうとした時の体験を中心に設計する。

### 3.1 既存の挙動 (前提)

Pro ツールは `requiresGyoseishoshiAuth: true` / `tier: "pro"` / scope (`compass:draft` / `compass:approve`)。
未認証・未スコープの Free 呼び出しは認可ゲートで拒否される。
→ 現状はエラーになるだけで、**「なぜ・どうすれば使えるか」が伝わりにくい**。

### 3.2 提案する体験 (Graceful upgrade explanation)

エラーではなく、**丁寧で有用な説明カード**を返す (情報提供として)。要素:

1. **何ができるか** (1-2 文、価値): 「Pro では書類パッケージを冪等生成し、承認を監査記録できます」。
2. **なぜ今使えないか**: 「この機能は行政書士資格の確認 (gyoseishoshi_verified) と Pro 契約が必要です」。
3. **どうすれば使えるか**: 外部リンク 1 つ → `https://.../pro` (資格確認 + 契約 + 認可)。
4. **Free で今できること**: 代替の読み取りツール導線 (例: まず `list_visa_documents` で下調べ)。
5. **境界の明示**: 「本サービスは情報提供のみ。申請の代理は行いません」(§19 免責)。

> 表示は **1 回・非モーダル・閉じられる**。点滅や連打なし。ウィジェット下部の控えめなバナー
> またはツール応答テキストとして提示。アプリ内に決済 UI は出さない。

### 3.3 文言トーン (ダークパターン回避)

- ❌ 「今すぐアップグレード!」「残りわずか!」のような煽り。
- ✅ 「行政書士の方へ: 書類のまとめと承認記録を効率化できます。詳細・お申し込みはこちら (外部)」。
- 多言語 (まず ja/en/id、エラー辞書は 10 言語) で提供。既定は host locale。

---

## 4. 体験フロー / Flow

```
Free ユーザー
  └─ 読み取りツールで「調べる」(search / classify / timeline / checklist / validate)
       └─ 必要書類が固まる → 「まとめたい/承認記録したい」ニーズ発生
            └─ Pro ツールに触れる
                 ├─ [認可OK] そのまま Pro 体験 (prepare/approve/status)
                 └─ [未認可] Graceful upgrade explanation カード
                      ├─ 外部リンク → 資格確認 + 契約 + scope 付与 (サーバー外)
                      │     └─ 戻り → step-up 認可済みで再実行
                      └─ 「Free で今できること」導線 (代替の読み取り)
```

- **認可は step-up**: Pro に触れた時だけ OAuth scope を要求 (匿名のまま Free を使い続けられる)。
- **戻り導線**: 外部で契約・資格確認後、ホストの再認可フローで scope を取得し、同じ操作を再開。

---

## 5. 「何を・どうすれば喜ばれるか」根拠 / Why this is useful (evidence)

| 施策 | 喜ばれる理由 (根拠) |
| --- | --- |
| Graceful 説明カード | 拒否エラーは離脱を生む。価値+次の一歩を示すと「使える時に戻ってくる」体験になる。 |
| 外部チェックアウト誘導 | T12・各 Apps 規約で**アプリ内課金/アップセル禁止**。規約順守かつ審査リスク回避。 |
| step-up 認可 | 匿名・無料の体験を壊さず、必要時だけ認証 → Free の価値を最大化しつつ Pro へ橋渡し。 |
| 行政書士に絞った訴求 | Pro は L2 書き込み (ADR-024) = 行政書士の実務効率化。本人には勧めない (§19 配慮)。 |
| Free 代替導線の併記 | 「今できること」を示すと、Pro 不要層も満足し、Pro 必要層は自然に移行する。 |
| PII 非保持の明示 | 信頼の核。年月のみ・匿名で価値が出ることを体験で示す。 |

---

## 6. 実装フェーズ案 / Phased rollout (proposal)

> いずれも別 PR。本書はスコープと受け入れ条件の提案のみ。

### Phase 2a — Graceful upgrade explanation (サーバー + UI 文言)
- 内容: Pro ツール未認可時に、エラーではなく構造化された「説明 + 外部リンク + Free 代替導線」を返す。
  既存免責を維持。`_meta` に `redirect_domains` (T12) で外部ドメインのみ宣言。
- 受け入れ条件: 未認可 Free 呼び出しで説明が返る/応答に内部 ID・PII が無い/免責が逐語/
  決済 UI を含まない、をテストで検証。`pnpm test` green。

### Phase 2b — 外部 Pro ランディング & step-up 認可導線
- 内容: 外部 Web (`/pro`) で資格確認 (gyoseishoshi_verified) + 契約 + scope 付与。
  ホストの再認可後に同操作を再開できる導線。
- 受け入れ条件: step-up 後に `prepare_document_package` 等が実行可能/不正 `aud`・改ざん署名拒否
  (T11)/契約・決済はすべて外部で完結。

### Phase 2c — 派遣担当向け軽量価値 (任意)
- 内容: 複数案件の期限の見通しを Free の範囲で改善 (年月のみ・匿名・PII 非保持)。
  Pro へは「行政書士へ渡すパッケージ生成」を控えめに案内。
- 受け入れ条件: PII を保持しない/匿名で価値が出る/アップセルが非モーダル 1 回まで。

---

## 7. 受け入れ条件 (共通) / Acceptance criteria (global)

- [ ] §19: 全画面・全応答が情報提供の範囲。法律行為の示唆なし。免責 (`DISCLAIMER_BY_LANG`) を逐語維持。
- [ ] アプリ内課金 UI を一切出さない。価格・契約・決済は外部のみ。
- [ ] アップセルは**非モーダル・1 回・閉じられる**。ダークパターン禁止。
- [ ] 外部リンクは許可ドメインのみ (`redirect_domains`)。PII を MCP に渡させない。
- [ ] step-up 認可で Free の匿名体験を壊さない。
- [ ] 多言語 (まず ja/en/id) で文言を提供。既定は host locale。

---

## 8. 非目標 / Non-goals

- アプリ内決済・サブスク管理 UI の実装。
- 本人/家族への Pro 勧奨。
- PII を用いた個別案件管理・永続ストレージ。
- 行政書士法に抵触し得る申請代行・法律相談機能。
