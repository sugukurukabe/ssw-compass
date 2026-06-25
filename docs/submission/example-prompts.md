# 動作例プロンプト / Example Prompts / Contoh Prompt

> 審査提出用の動作例。3 シナリオ × 3 言語（日本語 / English / Bahasa Indonesia）。
> すべて PII（氏名・在留番号・パスポート番号・マイナンバー・完全な生年月日）を含まない。
> 本番エンドポイント / Production endpoint: `https://mcp.ssw-compass.jp/mcp`

---

## シナリオ 1: 申請種別の判定 / Scenario 1: Classify the procedure / Skenario 1: Menentukan jenis permohonan

期待ツール / Expected tool: `classify_procedure`（+ `search_visa`）

- **日本語**: 「技能実習2号を農業分野で良好に修了しました。特定技能1号・農業に切り替えるには、どの申請（認定・変更・更新）が必要ですか？試験免除になるかも教えてください。」
- **English**: "I completed Technical Intern Training (ii) in agriculture in good standing. To move to Specified Skilled Worker (i) in agriculture, which application do I need — Certificate of Eligibility, Change of Status, or Extension? Also, am I exempt from the skills and language tests?"
- **Bahasa Indonesia**: "Saya telah menyelesaikan Pemagangan Teknis (ii) di bidang pertanian dengan baik. Untuk pindah ke Pekerja Berketerampilan Spesifik (i) bidang pertanian, permohonan mana yang saya butuhkan — Sertifikat Kelayakan, Perubahan Status, atau Perpanjangan? Apakah saya juga dibebaskan dari ujian keterampilan dan bahasa?"

価値 / Value: 現在資格・希望資格・分野から必要な申請種別を判定し、試験免除条件を一次情報に基づいて提示する。

---

## シナリオ 2: 必要書類の確認 / Scenario 2: Check the required documents / Skenario 2: Memeriksa dokumen yang diperlukan

期待ツール / Expected tool: `list_visa_documents`

- **日本語**: 「特定技能1号・農業の在留資格変更許可申請で必要な書類の一覧を見せてください。省略できる書類があれば、分けて表示してください。」
- **English**: "Show me the list of documents required for a Change of Status application to Specified Skilled Worker (i) in agriculture. If any documents can be omitted, please separate them out."
- **Bahasa Indonesia**: "Tunjukkan daftar dokumen yang diperlukan untuk permohonan Perubahan Status ke Pekerja Berketerampilan Spesifik (i) bidang pertanian. Jika ada dokumen yang bisa dihilangkan, pisahkan daftarnya."

価値 / Value: 申請区分・分野別の必要書類を、省略条件適用後の形でグループ化して提示する。

---

## シナリオ 3: 期限タイムライン / Scenario 3: Deadline timeline / Skenario 3: Lini masa tenggat

期待ツール / Expected tool: `get_deadline_timeline`

- **日本語**: 「支援計画を変更した場合の届出期限と様式を確認したいです。あわせて、定期届出や在留期間更新の時期、通算5年の上限についても整理して教えてください。」
- **English**: "I want to check the notification deadline and form for when a support plan changes. Also, please summarize the periodic notification window, the visa extension timing, and the cumulative 5-year cap."
- **Bahasa Indonesia**: "Saya ingin memeriksa tenggat pemberitahuan dan formulir saat rencana dukungan berubah. Tolong rangkum juga periode pemberitahuan berkala, waktu perpanjangan visa, dan batas kumulatif 5 tahun."

価値 / Value: 14 日以内の随時届出・定期届出（4/1〜5/31）・更新申請（期限3ヶ月前）・通算5年上限を、法定期限タイムラインとして可視化する。

---

## 注意 / Notes / Catatan

- いずれのシナリオも **情報提供のみ**。法的助言・行政書士業務ではない（改正行政書士法§19）。
- 全レスポンスに免責事項が付与される（`DISCLAIMER_BY_LANG`）。
- 一次情報源は出入国在留管理庁等の公式資料に限定（信頼度 ≥ 0.7）。
- Vertex grounding の本格対応言語は ja / en / id。他 7 言語（zh-CN / zh-TW / vi / tl / th / km / my）は段階的改善中。
