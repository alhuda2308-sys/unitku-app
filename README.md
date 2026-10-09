# UnitKuu — Kelola Kost, Kontrakan & Unit Sewa Tanpa Ribet

Aplikasi manajemen properti (kost, kontrakan & unit sewa) berbasis web: denah kamar interaktif, tagihan & invoice WhatsApp-ready, komplain/pemeliharaan, pengumuman broadcast, portal penyewa, buku kas, dan pengaturan properti multi-cabang — berjalan penuh dengan **mock data localStorage**, dengan **skema database Prisma siap Supabase PostgreSQL** (integrasi API runtime menyusul).

## Fitur Utama

- **Denah Kamar** — peta okupansi per lantai dengan status warna (Lunas / Jatuh Tempo / Menunggak / Kosong), check-in penyewa baru, magic token akses portal.
- **Tagihan & Invoice** — siklus tagihan bulanan, tandai lunas, kwitansi, preview pesan WhatsApp, filter status & periode.
- **Komplain & Pemeliharaan** — tiket keluhan penyewa dengan foto lampiran, alur status (Menunggu → Dikerjakan → Selesai).
- **Pengumuman & Broadcast** — buat/edit/arsipkan pengumuman, target per kategori, salin ke WhatsApp.
- **Portal Penyewa** — halaman mandiri penyewa (detail unit, tagihan, fasilitas, pengumuman) via token akses.
- **Data Penghuni** — direktori penyewa aktif & alumni dengan riwayat kontrak.
- **Buku Kas** — arus kas masuk/keluar properti.
- **Pengaturan** — profil properti multi-cabang, kelola admin & staf (RBAC-ready), rekening & pembayaran, katalog fasilitas, template pesan WA, tarif & tipe unit.
- **12 Tema Visual** — zinc, teal, emerald, industrial, retro, blueprint, macaron, cyber terminal, dan lainnya — dapat diganti langsung dari navbar.
- **Responsif Penuh** — tata letak mobile-first (<640px kartu vertikal + dropdown filter) dan desktop (tabel & segmented tabs).

## Teknologi

| Layer | Teknologi |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript 5 |
| UI | Tailwind CSS 4 + shadcn/ui (New York) + Lucide Icons |
| State | Zustand + React hooks, data persist di localStorage |
| Database (opsional/dev) | Prisma ORM + SQLite |
| Runtime | Bun |

## Menjalankan Proyek

> Kebutuhan: [Bun](https://bun.sh) ≥ 1.1

```bash
# 1. Install dependensi
bun install

# 2. Siapkan environment
cp .env.example .env

# 3. (Opsional) siapkan database lokal Prisma/SQLite
bun run db:generate && bun run db:push

# 4. Jalankan server development
bun run dev
```

Buka `http://localhost:3000` — aplikasi langsung berisi data demo (mock localStorage).

### Skrip Lain

| Perintah | Fungsi |
| --- | --- |
| `bun run lint` | Pemeriksaan ESLint |
| `bun run build` | Build produksi (standalone) |
| `bun run start` | Jalankan hasil build produksi |
| `bun run db:push` | Dorong skema Prisma ke SQLite |

## Struktur Proyek (inti)

```
src/
├── app/            # App Router (/, /portal)
├── components/
│   ├── kost/       # Fitur utama UnitKu (banner, denah, tagihan, dsb.)
│   └── ui/         # Komponen shadcn/ui
└── lib/            # Store settings, tipe data, util
prisma/             # Skema database (opsional)
public/             # Aset statis
```

## Catatan

- Seluruh data pengguna tersimpan di `localStorage` browser (kunci `unitku_*`) — aman untuk demo.
- Data demo dapat direset kapan saja dari menu **Kelola Data / Reset Demo** di aplikasi.
- **Database siap Supabase**: `prisma/schema.prisma` (PostgreSQL) memodelkan `properties`, `rooms`, `tenants`, `invoices` + `invoice_lines`, `facilities`, `tickets`, `cash_entries`. Jalankan `bunx prisma db push` dengan kredensial Supabase di `.env` (lihat `.env.example`) untuk membuat seluruh tabel; script `build` otomatis menjalankan `prisma generate` (siap deploy Vercel). Runtime aplikasi saat ini masih memakai mock localStorage — penyambungan API backend menyusul.
