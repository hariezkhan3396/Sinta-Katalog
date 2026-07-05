#!/usr/bin/env python3
"""
Scraper Katalog Sinta
======================
Mengambil daftar jurnal dari https://sinta.kemdiktisaintek.go.id/journals
(halaman demi halaman) lalu menyimpannya sebagai data/journals.json agar
bisa dicari secara instan dari halaman web statis (tanpa perlu memanggil
Sinta setiap kali pengguna mencari).

Cara pakai:
    pip install requests beautifulsoup4
    python scrape_sinta.py --max-pages 1546 --out ../data/journals.json

Catatan penting:
- Sinta TIDAK menyediakan pencarian berbasis parameter URL sederhana
  (mis. ?q=topik) yang bisa langsung difilter dari luar. Kotak pencarian
  di situs mereka bekerja lewat JavaScript di sisi klien. Karena itu,
  strategi yang dipakai di sini adalah: unduh SEMUA data jurnal satu per
  satu halaman, simpan sebagai file JSON, lalu pencarian topik dilakukan
  di sisi pengguna (browser) terhadap file JSON tersebut.
- Jika suatu saat struktur HTML Sinta berubah, sesuaikan pola regex/CSS
  selector di fungsi `parse_page` di bawah ini.
- Jalankan dengan jeda antar-request (--delay) agar tidak membebani
  server Sinta secara berlebihan.
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://sinta.kemdiktisaintek.go.id"
LIST_PATH = "/journals"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; KatalogSintaBot/1.0; "
        "+https://github.com/) Educational journal catalog scraper"
    )
}


def parse_page(html: str):
    """Ambil daftar jurnal dari satu halaman hasil listing Sinta."""
    soup = BeautifulSoup(html, "html.parser")
    journals = []
    seen_ids = set()

    profile_links = soup.find_all("a", href=re.compile(r"/journals/profile/\d+"))

    for link in profile_links:
        href = link.get("href", "")
        match = re.search(r"/journals/profile/(\d+)", href)
        if not match:
            continue
        jid = match.group(1)
        title = link.get_text(strip=True)
        if not title or jid in seen_ids:
            continue

        # Naik ke elemen induk sampai ditemukan blok yang memuat info
        # ISSN / akreditasi, supaya kita tahu batas "kartu" jurnal ini.
        container = link
        block_text = ""
        for _ in range(6):
            if container.parent is None:
                break
            container = container.parent
            block_text = container.get_text(" ", strip=True)
            if "ISSN" in block_text or "Accredited" in block_text:
                break

        website = None
        for a_tag in container.find_all("a"):
            if a_tag.get_text(strip=True).lower() == "website" and a_tag.get("href"):
                website = a_tag.get("href").strip()
                break

        pissn = re.search(r"P-ISSN\s*:\s*([0-9Xx\-]+)", block_text)
        eissn = re.search(r"E-ISSN\s*:\s*([0-9Xx\-]+)", block_text)
        subject = re.search(
            r"Subject Area\s*:\s*(.*?)(?=\s*(?:S[1-6] Accredited|Not Accredited|Cancelled|$))",
            block_text,
        )
        level_match = re.search(r"\b(S[1-6])\s*Accredited\b", block_text)
        if level_match:
            level = level_match.group(1)
        elif "Cancelled" in block_text:
            level = "Cancelled"
        elif "Not Accredited" in block_text:
            level = "Belum Terakreditasi"
        else:
            level = None

        journals.append(
            {
                "id": jid,
                "title": title,
                "profile_url": BASE_URL + href,
                "website": website,
                "issn_p": pissn.group(1) if pissn else None,
                "issn_e": eissn.group(1) if eissn else None,
                "subject_area": subject.group(1).strip(" ,") if subject else None,
                "sinta_level": level,
                "scopus_indexed": "Scopus Indexed" in block_text,
                "garuda_indexed": "Garuda Indexed" in block_text,
            }
        )
        seen_ids.add(jid)

    return journals


def scrape(max_pages: int, delay: float, out_path: str, meta_path: str):
    all_journals = {}

    for page in range(1, max_pages + 1):
        url = f"{BASE_URL}{LIST_PATH}?page={page}"
        try:
            resp = requests.get(url, headers=HEADERS, timeout=20)
            resp.raise_for_status()
        except requests.RequestException as exc:
            print(f"[!] Gagal mengambil halaman {page}: {exc}", file=sys.stderr)
            continue

        items = parse_page(resp.text)
        if not items:
            print(f"[i] Halaman {page} tidak berisi data jurnal, berhenti di sini.")
            break

        for item in items:
            all_journals[item["id"]] = item

        print(f"[+] Halaman {page}: {len(items)} jurnal (total terkumpul {len(all_journals)})")
        time.sleep(delay)

    data = list(all_journals.values())
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    meta = {
        "last_updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total_journals": len(data),
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"\nSelesai. {len(data)} jurnal disimpan ke {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scraper Katalog Sinta")
    parser.add_argument("--max-pages", type=int, default=1546, help="Jumlah maksimum halaman yang diambil")
    parser.add_argument("--delay", type=float, default=0.4, help="Jeda antar-request (detik)")
    parser.add_argument("--out", default="../data/journals.json", help="Lokasi file output JSON")
    parser.add_argument("--meta-out", default="../data/meta.json", help="Lokasi file metadata JSON")
    args = parser.parse_args()

    scrape(args.max_pages, args.delay, args.out, args.meta_out)
