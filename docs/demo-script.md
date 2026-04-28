# SSW Compass デモスクリプト × 3 言語

> **用途**: Sprint 5 Phase A3 — デモ動画撮影 (60秒 × ja/en/id)
> **Host**: Claude Desktop または Claude Web (mcp.ssw-compass.jp)
> **前提**: Vertex real mode 有効 (Batch 5 完了後に撮影)

---

## 日本語デモ (60秒)

### セリフ / 字幕

```
【0:00-0:08】
こんにちは。SSW Compass は特定技能ビザ手続きの羅針盤です。
出入国在留管理庁の公式情報にもとづいて、いつでも無料でお使いいただけます。

【0:08-0:30】(実操作: Claude Desktop でツール呼び出し)
「特定技能1号 建設分野の在留期間更新手続を教えて」

→ search_visa が実行され、公式情報源からの回答が表示される

「必要書類のチェックリストを見せて」

→ list_visa_documents が実行され、書類一覧が表示される

【0:30-0:45】(続き: 法改正フィード)
「直近の法改正情報はありますか?」

→ list_law_updates が実行。
  「改正行政書士法 (2026年1月施行)」「入管法§73-2 厳罰化 (2025年6月施行)」が表示される

【0:45-0:60】(免責・締め)
すべての回答の末尾には必ず免責事項が表示されます。
個別案件は行政書士・弁護士にご相談ください。

SSW Compass — 正しい方向へ導くコンパス。
mcp.ssw-compass.jp で今すぐご利用いただけます。
```

---

## English Demo (60s)

```
【0:00-0:08】
Hi, SSW Compass is the compass for Japanese visa procedures.
Grounded in official 出入国在留管理庁 sources — free to use, anytime.

【0:08-0:30】(action: Claude Desktop tool calls)
Prompt: "What documents do I need to renew my Specified Skilled Worker visa in construction?"

→ search_visa returns official sources with document list

"Show me the deadline timeline"

→ get_deadline_timeline returns renewal and notification deadlines

【0:30-0:45】(law updates)
"Any recent legal changes I should know about?"

→ list_law_updates returns key updates:
  "Amended Gyoseishoshi Act §19 (Jan 2026)"
  "Immigration Act §73-2 stricter penalties (Jun 2025)"

【0:45-0:60】(disclaimer & close)
Every response includes a disclaimer reminding users to consult
a certified gyoseishoshi for individual cases.

SSW Compass — We point the way.
Try it at mcp.ssw-compass.jp
```

---

## Demo Bahasa Indonesia (60 detik)

```
【0:00-0:08】
Halo, SSW Compass adalah kompas untuk prosedur visa Jepang.
Berdasarkan sumber resmi 出入国在留管理庁 — gratis, kapan saja.

【0:08-0:30】(aksi: Claude Desktop)
Pertanyaan: "Dokumen apa yang diperlukan untuk perpanjangan visa Tokutei Gino bidang konstruksi?"

→ search_visa menampilkan daftar dokumen dari sumber resmi

"Tampilkan jadwal tenggat waktu"

→ get_deadline_timeline menampilkan tenggat perbaruan dan notifikasi

【0:30-0:45】(pembaruan hukum)
"Ada perubahan hukum terbaru yang perlu saya ketahui?"

→ list_law_updates menampilkan:
  "Amandemen Gyoseishoshi Act §19 (Jan 2026)"
  "Pengetatan hukuman §73-2 Undang-undang Imigrasi (Jun 2025)"

【0:45-0:60】(penafian & penutup)
Setiap respons menyertakan penafian yang mengingatkan pengguna
untuk berkonsultasi dengan gyoseishoshi bersertifikat.

SSW Compass — Kami menunjukkan arahnya.
Coba di mcp.ssw-compass.jp
```

---

## 撮影チェックリスト

- [ ] 画面録画: 1080p 以上
- [ ] Vertex real mode が有効なこと (fixture 画面は NG)
- [ ] 字幕を用意 (SRT または埋め込み)
- [ ] 60 秒 ± 5 秒
- [ ] disclaimer footer が画面に映っていること
- [ ] *.go.jp の URL が少なくとも 1 件表示されること
- [ ] 保存先: `assets/demo/demo-{ja,en,id}.mp4`

## 推奨ツール

| OS | ツール | 備考 |
|---|---|---|
| macOS | QuickTime Player | 内蔵、無料 |
| macOS | OBS Studio | 字幕焼き込み可 |
| 字幕編集 | Kapwing (web) | SRT 対応 |
