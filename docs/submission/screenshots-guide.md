# スクリーンショット取得手順 / Screenshot Capture Guide / Panduan Pengambilan Tangkapan Layar

> 対象 / Target / Target: Anthropic Connectors Directory（MCP Apps カルーセル）+ OpenAI Apps 提出用スクリーンショット。
> 本番エンドポイント / Production endpoint: `https://mcp.ssw-compass.jp/mcp`
>
> 実際の PNG はバイナリのため本リポジトリにはコミットしない（取得手順のみを記載）。
> プレースホルダの配置場所 / Placeholder location: `docs/submission/screenshots/`

---

## 1. 要件 / Requirements / Persyaratan

- フォーマット: PNG。
- 幅: **1000px 以上**（推奨 1200px）。
- クロップ: **アプリ応答（ウィジェット）のみ**。プロンプト入力欄・チャット履歴・サイドバー・ブラウザクロームを含めない。
- PII を含めない（年月のみ・固有名詞なしのプロンプトを使う）。
- 枚数: Anthropic は **3〜5 枚**を要求（要確認: 最新のフォーム要件）。本ガイドは 5 枚を用意する。

---

## 2. 対象ツール → 期待ウィジェット 対応表 / Tool → Widget mapping

SSW Compass の読み取り専用ツールのうち 5 つに MCP App UI ウィジェットが対応する
（`list_law_updates` には専用ウィジェットなし）。ウィジェットの実体は `ui/` 配下。

| # | 対象ツール | ウィジェット（`ui/` ディレクトリ） | UI Resource URI | 期待される表示 | ファイル名 |
|---|---|---|---|---|---|
| 1 | `search_visa` | `ui/ssw-search` | `ui://compass/search/1.0.0.html` | サマリー優先の検索カード（公式ソースは折りたたみ） | `01-search-visa.png` |
| 2 | `classify_procedure` | `ui/ssw-classify` | `ui://compass/classify/1.0.0.html` | 4 ステップの申請種別判定 + 技能実習 分野マッピング警告 | `02-classify-procedure.png` |
| 3 | `get_deadline_timeline` | `ui/ssw-timeline` | `ui://compass/timeline/1.0.0.html` | 法定期限タイムライン（関連様式リンク付き） | `03-deadline-timeline.png` |
| 4 | `list_visa_documents` | `ui/ssw-checklist` | `ui://compass/checklist/1.0.0.html` | グループ化された必要書類チェックリスト（省略候補 + 多言語バッジ） | `04-list-documents.png` |
| 5 | `validate_zairyu_compatibility` | `ui/ssw-validate` | `ui://compass/validate/1.0.0.html` | 在留資格×就労の適合性判定（H06 不法就労アラート） | `05-validate-zairyu.png` |

> 命名規則: `NN-<tool-name-kebab>.png`（2 桁連番 + ツール名 kebab-case）。`docs/submission/screenshots/` 配下に保存。

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
7. `docs/submission/screenshots/` に命名規則どおり保存する（例 `01-search-visa.png`）。
8. 幅を確認する:

```bash
sips -g pixelWidth docs/submission/screenshots/*.png
```

---

## 5. 受け入れチェック / Acceptance checks

- [ ] プロンプト文・チャット欄・サイドバー・ブラウザクロームが画像に写っていない。
- [ ] アプリカードの幅が 1000px 以上。
- [ ] `01-search-visa.png`: サマリー優先でソースが折りたたまれている。
- [ ] `02-classify-procedure.png`: 4 ステップ判定 + 技能実習の分野マッピング警告が見える。
- [ ] `03-deadline-timeline.png`: 関連する公式様式リンクが見える。
- [ ] `04-list-documents.png`: グループ化 + 省略候補 + 多言語/母語バッジが見える。
- [ ] `05-validate-zairyu.png`: 警告 / 不法就労リスク状態（H06）が見える。
- [ ] PII（氏名・番号・完全な生年月日）が一切写っていない。

> 要確認 / To confirm: Anthropic / OpenAI それぞれの最新フォームが要求する枚数・推奨解像度・アスペクト比。
> 提出直前に各審査ポータルの最新ガイドラインで確認すること。
