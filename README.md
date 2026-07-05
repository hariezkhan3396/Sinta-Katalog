# Katalog Sinta

Website statis untuk mencari jurnal terakreditasi **Sinta** cukup dengan menuliskan
topiknya. Menampilkan nama jurnal, situs resmi, dan tingkat akreditasi Sinta (S1–S6).

Dibuat sebagai proyek **GitHub Pages** murni (HTML + CSS + JS, tanpa server),
ditambah satu alur kerja **GitHub Actions** yang secara berkala mengambil ulang
data dari situs SINTA agar katalog tetap segar.

## Kenapa arsitekturnya begini?

Kotak pencarian di situs SINTA (`sinta.kemdiktisaintek.go.id`) bekerja lewat
JavaScript di sisi klien, bukan lewat parameter URL sederhana seperti `?q=topik`
yang bisa dipanggil langsung dari luar. Karena itu, pendekatan yang paling
stabil untuk sebuah situs statis di GitHub adalah:

1. **Scraper** (`scraper/scrape_sinta.py`) mengunduh seluruh daftar jurnal dari
   SINTA, halaman demi halaman, lalu menyimpannya sebagai `data/journals.json`.
2. **GitHub Actions** (`.github/workflows/update-journals.yml`) menjalankan
   scraper itu setiap minggu secara otomatis (dan bisa dipicu manual kapan saja),
   lalu meng-commit hasilnya — inilah mekanisme "refresh"-nya.
3. **Halaman web** (`index.html` + `app.js`) memuat `data/journals.json` sekali,
   lalu pencarian topik dilakukan instan di peramban pengguna (tanpa perlu
   memanggil SINTA setiap kali seseorang mencari).

Repo ini disertakan dengan data contoh (±15 jurnal) di `data/journals.json` agar
tampilannya langsung bisa dicoba. Jalankan langkah di bawah untuk mengambil
seluruh ±15.000 jurnal.

## Cara memasang

1. **Upload folder ini ke repository GitHub baru** (atau gunakan sebagai template).
2. **Aktifkan GitHub Pages**: Settings → Pages → Source: `Deploy from a branch` →
   pilih branch `main`, folder `/ (root)`.
3. **Aktifkan GitHub Actions** (biasanya sudah aktif secara default di repo baru).
4. **Ambil data lengkap untuk pertama kali**:
   - Buka tab **Actions** → pilih workflow **"Perbarui Data Jurnal Sinta"** →
     klik **Run workflow**.
   - Proses ini mengambil ±1.500 halaman dari SINTA (sekitar 15–20 menit).
     Untuk uji coba cepat, isi kolom `max_pages` dengan angka kecil, mis. `20`.
   - Setelah selesai, `data/journals.json` dan `data/meta.json` akan otomatis
     ter-commit ke repo, dan situs akan menampilkan data terbaru.
5. Selesai — situs bisa diakses di `https://<username>.github.io/<nama-repo>/`.

Setelah langkah 4, workflow ini berjalan otomatis **setiap Senin dini hari**
untuk menjaga data tetap segar, tanpa perlu kamu sentuh lagi.

## Menjalankan scraper secara lokal (opsional)

```bash
cd scraper
pip install requests beautifulsoup4
python scrape_sinta.py --max-pages 1546 --out ../data/journals.json --meta-out ../data/meta.json
```

Gunakan `--max-pages 20` dulu untuk uji cepat sebelum menjalankan yang penuh.

## Struktur proyek

```
index.html                          halaman utama
style.css                           tampilan "kartu katalog perpustakaan"
app.js                              logika pencarian & filter di sisi klien
data/journals.json                  dataset jurnal (di-refresh otomatis)
data/meta.json                      info kapan data terakhir diperbarui
scraper/scrape_sinta.py             skrip pengambil data dari SINTA
.github/workflows/update-journals.yml   penjadwal refresh otomatis
```

## Catatan & batasan jujur

- Pencarian topik dicocokkan terhadap **judul jurnal** dan **bidang subjek**
  (Sinta hanya mencatat ±10 bidang subjek umum). Jurnal tanpa kata yang mirip
  topik di judulnya mungkin tidak muncul — ini keterbatasan data publik yang
  tersedia dari SINTA, bukan dari mesin pencariannya sendiri.
- Jika suatu saat SINTA mengubah struktur HTML situsnya, `scrape_sinta.py`
  mungkin perlu disesuaikan (lihat komentar di dalam file tersebut).
- Situs ini murni menggunakan data publik SINTA untuk memudahkan pencarian,
  dan tidak berafiliasi resmi dengan Kemdiktisaintek.
