/**
 * 完全版プライバシーポリシー本文 (3言語: 日本語 / English / Bahasa Indonesia)。
 * Full privacy policy body (trilingual: Japanese / English / Bahasa Indonesia).
 * Isi lengkap kebijakan privasi (tiga bahasa: Jepang / Inggris / Indonesia).
 *
 * 設計方針 / Design notes / Catatan desain:
 * - 配信は FS 読み込みではなくビルド時定数で行う。Cloud Run コンテナ内のパス解決に
 *   依存させないため (ADR-012 のステートレス前提に整合)。docs/privacy/*.md は人間向け
 *   ミラーで、本定数が /privacy で配信される正本テキスト。
 * - Served as a build-time constant rather than reading from the filesystem, so it does
 *   not depend on container path resolution (consistent with the stateless model).
 *   docs/privacy/*.md is the human-facing mirror; this constant is the canonical text
 *   served at /privacy.
 * - 法的に断定できない項目は本文中で「行政書士レビュー要 / pending gyoseishoshi review」
 *   と注記する。文面確定は人間 (行政書士) レビューを必須とする (AGENTS.md 境界)。
 *
 * NOTE: 文面の確定は行政書士・人間レビューが必須 (AGENTS.md の免責境界)。
 *       本ファイルの編集は内容レビューを伴うこと。
 */

/** 最終更新日 / Last updated / Terakhir diperbarui (ISO 8601). */
export const PRIVACY_POLICY_LAST_UPDATED = "2026-06-26";

/** 問い合わせ先 / Contact / Kontak. */
export const PRIVACY_POLICY_CONTACT = "a_kabe@sugu-kuru.co.jp";

/**
 * 完全版が必ず含むべき節の見出しキー。テストの placeholder ゼロ検証に使用する。
 * Section anchors the full policy must always contain. Used by the placeholder-zero test.
 * Anchor bagian yang harus selalu ada. Dipakai uji "tanpa placeholder".
 */
export const REQUIRED_PRIVACY_SECTIONS = [
  // ja
  "事業者情報",
  "収集する情報",
  "情報の利用目的",
  "情報の保管と保持期間",
  "第三者提供",
  "データの所在と越境移転",
  "利用者の権利",
  "セキュリティ",
  "法的位置づけと免責",
  "お問い合わせ",
  "準拠法",
  "最終更新日",
  // en
  "Service Operator",
  "Information We Collect",
  "Purpose of Use",
  "Data Storage and Retention",
  "Third-Party Disclosure",
  "Data Location and Cross-Border Transfer",
  "Your Rights",
  "Security",
  "Legal Status and Disclaimer",
  "Contact",
  "Governing Law",
  "Last Updated",
  // id
  "Pengelola Layanan",
  "Informasi yang Kami Kumpulkan",
  "Tujuan Penggunaan",
  "Penyimpanan dan Masa Retensi Data",
  "Pengungkapan kepada Pihak Ketiga",
  "Lokasi Data dan Transfer Lintas Negara",
  "Hak Anda",
  "Keamanan",
  "Status Hukum dan Penafian",
  "Kontak",
  "Hukum yang Berlaku",
  "Terakhir Diperbarui",
] as const;

const JA = `SSW Compass プライバシーポリシー（完全版）
================================================

事業者: スグクル株式会社 (Sugukuru Inc.)
所在地: 日本・鹿児島県（詳細は法人登記情報をご確認ください）
問い合わせ: ${PRIVACY_POLICY_CONTACT}
最終更新日: ${PRIVACY_POLICY_LAST_UPDATED}

1. 事業者情報
   本サービス「SSW Compass」は、スグクル株式会社が運営する、日本の特定技能（SSW）
   ビザ手続きに関する公的・匿名・読み取り中心の情報提供サービスです。

2. 収集する情報
   SSW Compass は個人情報（PII）を収集しません。
   サービスの性質上、次の入力は受け付けず、検知時は自動的にブロックして処理しません:
   - 在留カード番号・パスポート番号・マイナンバー（個人番号）
   - 氏名・生年月日（年月のみ可）・住所
   - その他、個人を特定できる情報
   運用上、最小限のメタデータのみを取り扱います:
   - アクセス日時およびセキュリティメタデータ（IP アドレスは Cloud Run / Cloud Armor の
     セキュリティログで処理される場合がありますが、行動プロファイリングには使用しません）
   - ツール呼び出しの種別（個人情報を含みません）
   - エラーログ

3. 情報の利用目的
   - サービスの安定運用と品質改善
   - 不正アクセス・不正利用の検知と防止
   - 法令・監査要件に基づく記録の保持

4. 情報の保管と保持期間
   - 個人情報は保存しません。ビザ申請内容や個人識別子をサーバーに保存しません。
   - 監査ログは Cloud Logging から GCS の WORM ストレージに転送し、7 年間保持します
     （改ざん防止・追記専用。ADR-015）。監査ログには個人情報を含めません。
   - 運用メタデータは目的達成に必要な期間のみ保持し、その後は削除します。

5. 第三者提供
   収集した運用メタデータを第三者に販売・提供することはありません。個人情報は保有しない
   ため第三者と共有しません。次の場合に限り、法令の範囲で対応することがあります:
   - 法令に基づく開示請求があった場合
   - 人の生命・身体・財産の保護に必要な場合

6. データの所在と越境移転
   - アプリケーション実行・ログ収集・情報検索は日本（asia-northeast1）で行います。
   - 運用上のセキュリティメタデータは、Cloud Armor 等の Google Cloud グローバル edge
     サービスで処理される場合があります。SSW Compass がビザ申請内容や個人識別子を
     越境移転することはありません。

7. 利用者の権利
   本サービスは匿名・無料の情報提供であり、原則として個人情報を保有しません。そのため
   特定個人に紐づく開示・訂正・削除の対象データは通常存在しません。プライバシーに関する
   ご質問・ご要望は ${PRIVACY_POLICY_CONTACT} へご連絡ください。適用法令に基づき適切に
   対応します。【行政書士レビュー要: 個人情報保護法上の請求対応手続の具体化】

8. セキュリティ
   - TLS 1.2/1.3 による通信暗号化
   - Cloud Armor WAF による不正アクセス防止
   - PII の自動検出・ブロック（多段防御）
   - 出力サニタイザーによる間接プロンプトインジェクション対策
   - 監査ログの 7 年 WORM 保存

9. 法的位置づけと免責
   本サービスは一般情報の提供のみを目的とします。法律相談・行政書士業務には該当しません。
   改正行政書士法第19条（情報提供の範囲）を遵守し、申請書類の作成代行は行いません。
   個別の手続きについては、行政書士・弁護士・登録支援機関などの専門家にご相談ください。
   【行政書士レビュー要: 個別法令の断定的記述は専門家監修後に確定】

10. ポリシーの変更
    本ポリシーを変更する場合、本ページに最終更新日を記載します。重要な変更は可能な範囲で
    事前にお知らせします。

11. お問い合わせ
    プライバシーに関するご質問: ${PRIVACY_POLICY_CONTACT}

12. 準拠法
    本ポリシーは日本法に準拠し、個人情報の保護に関する法律（APPI）および関連法令に
    従って解釈・運用されます。`;

const EN = `SSW Compass Privacy Policy (Full Version)
================================================

Operator: Sugukuru Inc. (スグクル株式会社)
Address: Kagoshima Prefecture, Japan (see corporate registry for details)
Contact: ${PRIVACY_POLICY_CONTACT}
Last Updated: ${PRIVACY_POLICY_LAST_UPDATED}

1. Service Operator
   "SSW Compass" is a public, anonymous, read-only informational service operated by
   Sugukuru Inc., covering Japanese Specified Skilled Worker (SSW / 特定技能) visa
   procedures.

2. Information We Collect
   SSW Compass does NOT collect personal information (PII).
   By design, the following inputs are not accepted and are automatically blocked and
   not processed when detected:
   - Residence card numbers, passport numbers, My Number (個人番号)
   - Full names, dates of birth (year-month only is permitted), home addresses
   - Any other personally identifiable information
   We handle only minimal operational metadata:
   - Access timestamps and security metadata (IP addresses may be processed in
     Cloud Run / Cloud Armor security logs but are not used for behavioral profiling)
   - Tool invocation types (no personal data)
   - Error logs

3. Purpose of Use
   - Service stability and quality improvement
   - Detection and prevention of unauthorized access and abuse
   - Retention of records required by law and audit obligations

4. Data Storage and Retention
   - We do not store personal information. Visa application content and personal
     identifiers are not stored on our servers.
   - Audit logs are forwarded from Cloud Logging to WORM storage on GCS and retained
     for 7 years (tamper-resistant, append-only; ADR-015). Audit logs contain no PII.
   - Operational metadata is retained only as long as necessary, then deleted.

5. Third-Party Disclosure
   We do not sell or provide collected operational metadata to third parties. Because we
   hold no personal information, no PII is shared with third parties. We may respond, only
   within the scope of law, in the following cases:
   - When disclosure is required by law
   - When necessary to protect life, body, or property

6. Data Location and Cross-Border Transfer
   - Application execution, log collection, and information retrieval are performed in
     Japan (asia-northeast1).
   - Operational security metadata may be processed by Google Cloud global edge services
     such as Cloud Armor. SSW Compass does not transfer visa application content or
     personal identifiers across borders.

7. Your Rights
   This is an anonymous, free informational service that, as a rule, holds no personal
   information. Accordingly, there is normally no data tied to a specific individual that
   is subject to disclosure, correction, or deletion. For privacy questions or requests,
   contact ${PRIVACY_POLICY_CONTACT}; we will respond appropriately under applicable law.
   [Pending gyoseishoshi review: concrete request-handling procedures under APPI]

8. Security
   - TLS 1.2/1.3 encryption for all communications
   - Cloud Armor WAF for unauthorized access prevention
   - Automatic PII detection and blocking (multi-stage defense)
   - Output sanitizer for indirect prompt injection defense
   - 7-year WORM audit log storage

9. Legal Status and Disclaimer
   This service provides general information only. It does not constitute legal advice or
   gyoseishoshi services. It complies with the amended Gyoseishoshi Act Article 19 (scope
   of information provision) and does not prepare official application documents on your
   behalf. For individual procedures, consult a certified gyoseishoshi, attorney, or
   registered support organization.
   [Pending gyoseishoshi review: definitive statements on specific statutes to be
   finalized after professional review]

10. Policy Changes
    When this policy is updated, the last-updated date on this page will be revised.
    Significant changes will be announced in advance where feasible.

11. Contact
    Privacy inquiries: ${PRIVACY_POLICY_CONTACT}

12. Governing Law
    This policy is governed by the laws of Japan and is interpreted and operated in
    accordance with the Act on the Protection of Personal Information (APPI) and related
    laws.`;

const ID = `Kebijakan Privasi SSW Compass (Versi Lengkap)
================================================

Pengelola: Sugukuru Inc. (スグクル株式会社)
Alamat: Prefektur Kagoshima, Jepang (lihat registri perusahaan untuk detail)
Kontak: ${PRIVACY_POLICY_CONTACT}
Terakhir Diperbarui: ${PRIVACY_POLICY_LAST_UPDATED}

1. Pengelola Layanan
   "SSW Compass" adalah layanan informasi publik, anonim, dan hanya-baca yang dikelola
   oleh Sugukuru Inc., mencakup prosedur visa Pekerja Berketerampilan Spesifik
   (SSW / 特定技能) Jepang.

2. Informasi yang Kami Kumpulkan
   SSW Compass TIDAK mengumpulkan informasi pribadi (PII).
   Berdasarkan desain, input berikut tidak diterima dan diblokir otomatis serta tidak
   diproses saat terdeteksi:
   - Nomor kartu izin tinggal, nomor paspor, My Number (個人番号)
   - Nama lengkap, tanggal lahir (hanya tahun-bulan yang diizinkan), alamat rumah
   - Informasi lain yang dapat mengidentifikasi seseorang
   Kami hanya menangani metadata operasional minimal:
   - Waktu akses dan metadata keamanan (alamat IP dapat diproses dalam log keamanan
     Cloud Run / Cloud Armor tetapi tidak digunakan untuk profiling perilaku)
   - Jenis pemanggilan alat (tanpa data pribadi)
   - Log kesalahan

3. Tujuan Penggunaan
   - Stabilitas layanan dan peningkatan kualitas
   - Deteksi dan pencegahan akses tidak sah serta penyalahgunaan
   - Penyimpanan catatan yang diwajibkan hukum dan kewajiban audit

4. Penyimpanan dan Masa Retensi Data
   - Kami tidak menyimpan informasi pribadi. Konten permohonan visa dan identitas pribadi
     tidak disimpan di server kami.
   - Log audit diteruskan dari Cloud Logging ke penyimpanan WORM di GCS dan disimpan
     selama 7 tahun (tahan-rusak, hanya-tambah; ADR-015). Log audit tidak memuat PII.
   - Metadata operasional disimpan hanya selama diperlukan, lalu dihapus.

5. Pengungkapan kepada Pihak Ketiga
   Kami tidak menjual atau memberikan metadata operasional kepada pihak ketiga. Karena
   kami tidak menyimpan informasi pribadi, tidak ada PII yang dibagikan kepada pihak
   ketiga. Kami dapat menanggapi, hanya dalam batas hukum, dalam hal berikut:
   - Bila diwajibkan oleh hukum
   - Bila perlu untuk melindungi jiwa, raga, atau harta benda

6. Lokasi Data dan Transfer Lintas Negara
   - Eksekusi aplikasi, pengumpulan log, dan pencarian informasi dilakukan di Jepang
     (asia-northeast1).
   - Metadata keamanan operasional dapat diproses oleh layanan edge global Google Cloud
     seperti Cloud Armor. SSW Compass tidak mentransfer konten permohonan visa atau
     identitas pribadi lintas negara.

7. Hak Anda
   Ini adalah layanan informasi anonim dan gratis yang, sebagai aturan, tidak menyimpan
   informasi pribadi. Oleh karena itu, biasanya tidak ada data yang terkait dengan
   individu tertentu yang dapat diungkapkan, dikoreksi, atau dihapus. Untuk pertanyaan
   atau permintaan privasi, hubungi ${PRIVACY_POLICY_CONTACT}; kami akan menanggapi secara
   tepat sesuai hukum yang berlaku.
   [Menunggu tinjauan gyoseishoshi: prosedur penanganan permintaan konkret berdasarkan APPI]

8. Keamanan
   - Enkripsi TLS 1.2/1.3 untuk semua komunikasi
   - Cloud Armor WAF untuk pencegahan akses tidak sah
   - Deteksi dan pemblokiran PII otomatis (pertahanan berlapis)
   - Sanitizer output untuk pertahanan injeksi prompt tidak langsung
   - Penyimpanan log audit WORM selama 7 tahun

9. Status Hukum dan Penafian
   Layanan ini hanya menyediakan informasi umum. Ini bukan nasihat hukum atau layanan
   gyoseishoshi. Layanan ini mematuhi Gyoseishoshi Act Pasal 19 yang diubah (lingkup
   penyediaan informasi) dan tidak menyiapkan dokumen permohonan resmi atas nama Anda.
   Untuk kasus individu, konsultasikan dengan gyoseishoshi bersertifikat, pengacara, atau
   organisasi dukungan terdaftar.
   [Menunggu tinjauan gyoseishoshi: pernyataan definitif tentang undang-undang tertentu
   akan difinalkan setelah tinjauan profesional]

10. Perubahan Kebijakan
    Ketika kebijakan ini diperbarui, tanggal pembaruan terakhir di halaman ini akan
    direvisi. Perubahan signifikan akan diumumkan sebelumnya bila memungkinkan.

11. Kontak
    Pertanyaan privasi: ${PRIVACY_POLICY_CONTACT}

12. Hukum yang Berlaku
    Kebijakan ini diatur oleh hukum Jepang dan ditafsirkan serta dijalankan sesuai dengan
    Act on the Protection of Personal Information (APPI) dan peraturan terkait.`;

/**
 * /privacy で配信する完全版テキスト (3言語連結)。placeholder・要約リンクを含まない。
 * Full text served at /privacy (trilingual). Contains no placeholder or summary link.
 * Teks lengkap yang disajikan di /privacy (tiga bahasa). Tanpa placeholder atau tautan ringkasan.
 */
export const PRIVACY_POLICY_TEXT = [JA, EN, ID].join(
  "\n\n------------------------------------------------\n\n",
);
