# スクリーンショット取得手順 / Screenshot Capture Guide / Panduan Pengambilan Tangkapan Layar

> 対象 / Target / Target: Anthropic Connectors Directory（MCP Apps カルーセル）+ OpenAI Apps 提出用スクリーンショット。
> 本番エンドポイント / Production endpoint: `https://mcp.ssw-compass.jp/mcp`
>
> 既存の審査用 PNG は `docs/screenshots/` に 5 枚あります。
> `docs/submission/screenshots/` は提出ポータルへアップロードするコピーを置く作業場所です。

---

## 1. 要件 / Requirements / Persyaratan

- フォーマット: PNG。
- 幅: **1000px 以上**（推奨 1200px）。
- クロップ: **アプリ応答（ウィジェット）のみ**。プロンプト入力欄・チャット履歴・サイドバー・ブラウザクロームを含めない。
- PII を含めない（年月のみ・固有名詞なしのプロンプトを使う）。
- 枚数: **3〜5 枚の PNG**。本パケットは 5 枚を用意する。

---

## 2. 対象ツール → 期待ウィジェット 対応表 / Tool → Widget mapping

SSW Compass の読み取り専用ツールのうち 5 つに MCP App UI ウィジェットが対応する
（`list_law_updates` には専用ウィジェットなし）。ウィジェットの実体は `ui/` 配下。

| # | 対象ツール | ウィジェット（`ui/` ディレクトリ） | UI Resource URI | 期待される表示 | ファイル名 |
|---|---|---|---|---|---|
| 1 | `classify_procedure` | `ui/ssw-classify` | `ui://compass/classify/1.0.0.html` | 4 ステップの申請種別判定 + 技能実習 分野マッピング警告 | `docs/screenshots/01-classifier.png` |
| 2 | `list_visa_documents` | `ui/ssw-checklist` | `ui://compass/checklist/1.0.0.html` | グループ化された必要書類チェックリスト（省略候補 + 多言語バッジ） | `docs/screenshots/02-documents-checklist.png` |
| 3 | `search_visa` | `ui/ssw-search` | `ui://compass/search/1.0.0.html` | サマリー優先の検索カード（公式ソースは折りたたみ） | `docs/screenshots/03-search-summary.png` |
| 4 | `get_deadline_timeline` | `ui/ssw-timeline` | `ui://compass/timeline/1.0.0.html` | 法定期限タイムライン（関連様式リンク付き） | `docs/screenshots/04-deadline-timeline.png` |
| 5 | `validate_zairyu_compatibility` | `ui/ssw-validate` | `ui://compass/validate/1.0.0.html` | 在留資格×就労の適合性判定（H06 不法就労アラート） | `docs/screenshots/05-zairyu-warning.png` |

> 提出時は上表の 5 PNG を使用する。ポータルが別名を要求する場合のみ、内容を変えずにコピー名を変更する。

---

## 3. 各ウィジェットを出すプロンプト / Prompts that trigger each widget

Claude Desktop / Claude Web で SSW Compass を有効化し、以下を 1 件ずつ実行する。
いずれも PII を含まない（固有名詞・番号なし）。

| # | プロンプト（日本語） | 期待ウィジェット |
|---|---|---|
| 1 | `特定技能1号・農業の手続きで、まず何から確認すべき？` | `search_visa` |
| 2 | `技能実習2号から特定技能1号・農業へ変更したい。どの申請で、どの表が必要？` | `classify_procedure` |
| 3 | `支援計画を変更したときの届出期限と様式を確認して` | `get_deadline_timeline` |
| 4 | `特定技能1号・農業で必要書類チェックリストを見せて。省略できる書類も分けて` | `list_visa_documents` |
| 5 | `留学ビザの人を農業でフルタイム雇用してよいか確認して` | `validate_zairyu_compatibility` |

> 既存の `docs/screenshot-capture-guide.md` と同一のプロンプトセット。整合性を保つこと。

---

## 4. 手動取得手順 / Manual capture steps

1. Claude Web（または Claude Desktop）を開き、SSW Compass コネクタを有効化する。
2. 上表のプロンプトを 1 件実行する。
3. ウィジェットの iframe が描画され、タイトルが `ssw compass の埋め込み` になるまで待つ。
4. Chrome DevTools の Elements パネルを開く。
5. ウィジェットの iframe（またはそのアプリ応答コンテナ）の要素を選択する。
6. 右クリック → `Capture node screenshot` でウィジェットのみを取得する。
7. 新規に撮り直す場合は `docs/submission/screenshots/` に保存し、`docs/screenshots/manifest.json` と同じ順序・内容にそろえる。
8. 幅を確認する:

```bash
sips -g pixelWidth docs/screenshots/*.png
```

---

## 5. 受け入れチェック / Acceptance checks

- [ ] プロンプト文・チャット欄・サイドバー・ブラウザクロームが画像に写っていない。
- [ ] アプリカードの幅が 1000px 以上。
- [ ] `01-classifier.png`: 4 ステップ判定 + 技能実習の分野マッピング警告が見える。
- [ ] `02-documents-checklist.png`: グループ化 + 省略候補 + 多言語/母語バッジが見える。
- [ ] `03-search-summary.png`: サマリー優先でソースが折りたたまれている。
- [ ] `04-deadline-timeline.png`: 関連する公式様式リンクが見える。
- [ ] `05-zairyu-warning.png`: 警告 / 不法就労リスク状態（H06）が見える。
- [ ] PII（氏名・番号・完全な生年月日）が一切写っていない。
