# Kebijakan Privasi SSW Compass

> **Status**: Draf publik aktif — Menunggu tinjauan akhir gyoseishoshi
> **Terakhir diperbarui**: 2026-04-29
> **URL**: https://mcp.ssw-compass.jp/privacy

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
- Nama lengkap, tanggal lahir, alamat rumah
- Informasi lain yang dapat mengidentifikasi seseorang

Jika terdeteksi: diblokir secara otomatis dan tidak diproses.

**Data log yang dikumpulkan** (Google Cloud Logging):
- Waktu akses layanan dan metadata keamanan (alamat IP dapat diproses oleh log Cloud Run / Cloud Armor untuk keamanan, tetapi tidak digunakan untuk profiling)
- Jenis pemanggilan alat (tanpa data pribadi)
- Log kesalahan

---

## 3. Tujuan Penggunaan Data

- Stabilitas layanan dan peningkatan kualitas
- Deteksi dan pencegahan akses tidak sah
- Penyimpanan log audit (7 tahun — sesuai persyaratan catatan bisnis Gyoseishoshi Act §9)

---

## 4. Pengungkapan kepada Pihak Ketiga

Kami tidak menjual atau memberikan data log kepada pihak ketiga, kecuali:
- Dipersyaratkan oleh hukum
- Untuk melindungi jiwa, raga, atau harta benda

---

## 5. Layanan Cloud yang Digunakan

| Layanan | Tujuan | Lokasi data |
|---|---|---|
| Google Cloud Run | Hosting aplikasi | Jepang (asia-northeast1) |
| Google Cloud Logging | Pengumpulan log | Jepang |
| Google Cloud Armor | WAF keamanan | Global |
| Vertex AI Search | Pencarian informasi | Jepang |

Kami tidak secara sengaja mengumpulkan informasi pribadi. Metadata keamanan operasional dapat diproses oleh layanan edge global Google Cloud seperti Cloud Armor; konten permohonan visa atau identitas pribadi tidak ditransfer lintas negara oleh SSW Compass.

---

## 6. Keamanan

- Enkripsi TLS 1.2/1.3 untuk semua komunikasi
- Cloud Armor WAF untuk pencegahan akses tidak sah
- Deteksi dan pemblokiran PII otomatis (Cloud DLP + regex, dua tahap)
- Sanitizer output untuk pertahanan injeksi prompt tidak langsung
- Penyimpanan log audit WORM selama 7 tahun

---

## 7. Penafian

Layanan ini hanya menyediakan informasi umum.
**Ini bukan nasihat hukum atau layanan gyoseishoshi.**
Untuk kasus individu, konsultasikan dengan gyoseishoshi bersertifikat, pengacara,
atau organisasi dukungan terdaftar.
Berdasarkan Gyoseishoshi Act §19 yang diubah (berlaku 1 Januari 2026), persiapan
dokumen resmi sebagai layanan hanya dapat dilakukan oleh gyoseishoshi.

---

## 8. Perubahan Kebijakan

Ketika kebijakan ini diperbarui, tanggal revisi akan dicatat di sini.
Perubahan signifikan akan diumumkan sebelumnya.

---

## 9. Kontak

Pertanyaan privasi: a_kabe@sugu-kuru.co.jp

---

*Kebijakan ini akan diterbitkan dalam bentuk finalnya setelah ditinjau oleh gyoseishoshi bersertifikat.*
*Draf saat ini hanya untuk tujuan referensi.*
