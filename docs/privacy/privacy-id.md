# Kebijakan Privasi SSW Compass

> **Status**: Versi lengkap — Menunggu tinjauan akhir gyoseishoshi (redaksi wajib ditinjau gyoseishoshi bersertifikat)
> **Terakhir diperbarui**: 2026-06-26
> **URL**: https://mcp.ssw-compass.jp/privacy
> **Sumber resmi**: Isi yang disajikan di `/privacy` adalah `apps/server/src/privacy/policy.ts`. Dokumen ini adalah cermin versi manusia.

---

## 1. Pengelola Layanan

- **Nama**: Sugukuru Inc. (スグクル株式会社)
- **Alamat**: Prefektur Kagoshima, Jepang
- **Kontak**: a_kabe@sugu-kuru.co.jp

---

## 2. Informasi yang Kami Kumpulkan

SSW Compass **tidak mengumpulkan informasi pribadi**.

Berikut ini **tidak diterima** sebagai input:
- Nomor kartu izin tinggal, nomor paspor, Nomor Individu (マイナンバー)
- Nama lengkap, tanggal lahir (hanya tahun-bulan yang diizinkan), alamat rumah
- Informasi lain yang dapat mengidentifikasi seseorang

Jika terdeteksi: diblokir secara otomatis dan tidak diproses.

**Metadata operasional yang ditangani** (Google Cloud Logging):
- Waktu akses layanan dan metadata keamanan (alamat IP dapat diproses oleh log Cloud Run / Cloud Armor untuk keamanan, tetapi tidak digunakan untuk profiling)
- Jenis pemanggilan alat (tanpa data pribadi)
- Log kesalahan

---

## 3. Tujuan Penggunaan

- Stabilitas layanan dan peningkatan kualitas
- Deteksi dan pencegahan akses tidak sah serta penyalahgunaan
- Penyimpanan catatan yang diwajibkan hukum dan kewajiban audit

---

## 4. Penyimpanan dan Masa Retensi Data

- Kami tidak menyimpan informasi pribadi. Konten permohonan visa dan identitas pribadi tidak disimpan di server kami.
- Log audit diteruskan dari Cloud Logging ke penyimpanan WORM di GCS dan disimpan selama **7 tahun** (tahan-rusak, hanya-tambah; ADR-015). Log audit tidak memuat PII.
- Metadata operasional disimpan hanya selama diperlukan, lalu dihapus.

---

## 5. Pengungkapan kepada Pihak Ketiga

Kami tidak menjual atau memberikan metadata operasional kepada pihak ketiga. Karena kami tidak menyimpan informasi pribadi, tidak ada PII yang dibagikan kepada pihak ketiga. Kami dapat menanggapi, hanya dalam batas hukum:
- Dipersyaratkan oleh hukum
- Untuk melindungi jiwa, raga, atau harta benda

---

## 6. Lokasi Data dan Transfer Lintas Negara

| Layanan | Tujuan | Lokasi data |
|---|---|---|
| Google Cloud Run | Hosting aplikasi | Jepang (asia-northeast1) |
| Google Cloud Logging | Pengumpulan log | Jepang |
| Google Cloud Armor | WAF keamanan | Global |
| Vertex AI Search | Pencarian informasi | Jepang |

Kami tidak secara sengaja mengumpulkan informasi pribadi. Metadata keamanan operasional dapat diproses oleh layanan edge global Google Cloud seperti Cloud Armor; konten permohonan visa atau identitas pribadi tidak ditransfer lintas negara oleh SSW Compass.

---

## 7. Hak Anda

Ini adalah layanan informasi anonim dan gratis yang, sebagai aturan, tidak menyimpan informasi pribadi. Oleh karena itu, biasanya tidak ada data yang terkait dengan individu tertentu yang dapat diungkapkan, dikoreksi, atau dihapus. Untuk pertanyaan atau permintaan privasi, hubungi a_kabe@sugu-kuru.co.jp; kami akan menanggapi secara tepat sesuai hukum yang berlaku.

> **Menunggu tinjauan gyoseishoshi**: prosedur penanganan permintaan konkret berdasarkan APPI.

---

## 8. Keamanan

- Enkripsi TLS 1.2/1.3 untuk semua komunikasi
- Cloud Armor WAF untuk pencegahan akses tidak sah
- Deteksi dan pemblokiran PII otomatis (pertahanan berlapis)
- Sanitizer output untuk pertahanan injeksi prompt tidak langsung
- Penyimpanan log audit WORM selama 7 tahun

---

## 9. Status Hukum dan Penafian

Layanan ini hanya menyediakan informasi umum.
**Ini bukan nasihat hukum atau layanan gyoseishoshi.**
Untuk kasus individu, konsultasikan dengan gyoseishoshi bersertifikat, pengacara, atau organisasi dukungan terdaftar.
Layanan ini mematuhi Gyoseishoshi Act Pasal 19 yang diubah (lingkup penyediaan informasi) dan tidak menyiapkan dokumen permohonan resmi atas nama Anda.

> **Menunggu tinjauan gyoseishoshi**: pernyataan definitif tentang undang-undang tertentu akan difinalkan setelah tinjauan profesional.

---

## 10. Perubahan Kebijakan

Ketika kebijakan ini diperbarui, tanggal revisi akan dicatat di sini.
Perubahan signifikan akan diumumkan sebelumnya bila memungkinkan.

---

## 11. Kontak

Pertanyaan privasi: a_kabe@sugu-kuru.co.jp

---

## 12. Hukum yang Berlaku

Kebijakan ini diatur oleh hukum Jepang dan ditafsirkan serta dijalankan sesuai dengan Act on the Protection of Personal Information (APPI) dan peraturan terkait.

---

*Redaksi final kebijakan ini wajib ditinjau oleh gyoseishoshi bersertifikat sebelum dipublikasikan.*
