-- ═════════════════════════════════════════════════════════════════════════════
-- UnitKu — Tabel `articles` untuk Blog SEO Otomatis (Task: auto-article)
--
-- Cara pakai: tempel & jalankan SELURUH file ini di Supabase Dashboard →
-- SQL Editor → New query → Run. Idempotent (aman dijalankan berulang).
--
-- Skema sesuai spesifikasi cron /api/cron/auto-article:
--   insert (title, slug, meta_description, content, image_url, is_published: true)
-- Akses:
--   • SELECT  — publik (anon) HANYA utk baris is_published = true (policy RLS)
--   • INSERT  — HANYA service role (bypass RLS) dari route cron Vercel
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.articles (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  slug             text not null unique,
  meta_description text not null default '',
  content          text not null,
  image_url        text,
  is_published     boolean not null default true,
  created_at       timestamptz not null default now()
);

-- MIGRASI utk tabel yg SUDAH terdeploy sebelum kolom image_url ada
-- (idempotent — tanpa efek samping bila kolom sudah ada)
alter table public.articles add column if not exists image_url text;

-- Urutan listing (terbaru dulu) + filter published — index pendukung
create index if not exists articles_created_at_idx on public.articles (created_at desc);
create index if not exists articles_is_published_idx on public.articles (is_published);

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.articles enable row level security;

-- Publik boleh MEMBACA artikel yang sudah publish saja (listing + detail blog)
drop policy if exists "Public read published articles" on public.articles;
create policy "Public read published articles"
  on public.articles
  for select
  to anon, authenticated
  using (is_published = true);

-- TIDAK ADA policy INSERT/UPDATE/DELETE utk anon/authenticated — penulisan
-- hanya lewat SUPABASE_SERVICE_ROLE_KEY (dipakai cron /api/cron/auto-article).

-- ═════════════════════════════════════════════════════════════════════════════
-- OPSIONAL — 3 artikel pembuka agar blog tidak kosong sebelum cron pertama
-- berjalan. Hapus blok ini bila ingin blog mulai dari nol.
-- ═════════════════════════════════════════════════════════════════════════════

insert into public.articles (title, slug, meta_description, content, image_url, is_published)
values
(
  'Panduan Pembukuan Arus Kas Kost: Cara Mudah Agar Untung Terlihat Jelas',
  'panduan-pembukuan-arus-kas-kost',
  'Cara membukukan arus kas kost dengan rapi: pemasukan sewa, pengeluaran operasional, hingga laba bersih bulanan. Panduan praktis untuk pemilik kost pemula.',
  $content$Membuka pembukuan yang rapi adalah langkah pertama supaya bisnis kost Anda benar-benar menguntungkan. Banyak pemilik kost merasa "sepertinya untung", tetapi tidak bisa menjawab berapa laba bersih bulan lalu. Padahal tanpa angka yang jelas, keputusan seperti menaikkan harga sewa atau merenovasi kamar menjadi tebak-tebakan.

## Kenapa Pembukuan Kas Kost Sering Berantakan

Pemasukan dan pengeluaran kost tercampur dengan uang pribadi, catatan tersebar di buku tulis, chat WhatsApp, dan ingatan penjaga. Akibatnya:

- Pengeluaran kecil (listrik pompa air, ongkos tukang, sabun) lolos dari catatan
- Tagihan yang sudah dibayar penyewa tidak tercatat dan dianggap belum lunas
- Kas di bank dan kas tunai di lokasi tidak pernah direkonsiliasi

## Langkah Membangun Pembukuan Arus Kas yang Sehat

**1. Pisahkan kas kost dari uang pribadi.** Sediakan rekening khusus untuk kost. Semua pembayaran sewa masuk ke rekening ini, dan semua pengeluaran operasional keluar dari sini.

**2. Catat setiap transaksi pada hari yang sama.** Pemasukan diberi kategori (sewa kamar, deposit, denda keterlambatan) dan pengeluaran diberi kategori (listrik & air, gaji penjaga, perbaikan). Konsistensi kategori membuat laporan bulanan mudah dibaca.

**3. Rekap bulanan dan hitung laba bersih.** Total pemasukan dikurangi total pengeluaran = laba bersih. Bandingkan antarbulan: jika turun, cari penyebabnya — kamar kosong? tagihan menunggak? pengeluaran naik?

**4. Pisahkan deposit dari pendapatan.** Uang deposit bukan pendapatan; ia adalah dana yang dipegang dan dikembalikan saat penyewa pindah. Mencampur deposit ke kas bulanan membuat laporan terlihat lebih untung dari kenyataan.

## Manfaat Digitalisasi Pembukuan

Mencatat manual memakan waktu dan mudah salah hitung. Di sinilah aplikasi seperti **UnitKu** (unitku.my.id) membantu: setiap pembayaran sewa yang ditandai lunas otomatis tercatat sebagai pemasukan di Buku Kas, pengeluaran bisa dicatat dari HP lengkap dengan foto nota, dan rekap pemasukan-pengeluaran-laba bersih tersaji otomatis tiap bulan.

Fitur *denah kamar* juga membantu Anda melihat berapa persentase kamar terisi — angka kunci dalam proyeksi pendapatan bulanan.

## Kesimpulan

Pembukuan yang rapi bukan pekerjaan tambahan; ia adalah alat untuk melihat kesehatan bisnis. Mulailah dengan memisahkan rekening, mencatat harian, dan rekap bulanan. Jika ingin cara yang lebih praktis, coba gratis demo UnitKu di unitku.my.id — pembukuan kost Anda akan tersusun otomatis dari aktivitas harian yang sudah Anda lakukan.$content$,
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
  true
),
(
  'Cara Menagih Sewa Tepat Waktu + Kuitansi Digital (Tanpa terasa Jelek)',
  'cara-menagih-sewa-tepat-waktu-kuitansi-digital',
  'Strategi menagih sewa kost tepat waktu dengan pesan WhatsApp sopan, template siap pakai, dan kuitansi digital otomatis. Tingkatkan rasio pembayaran tepat waktu.',
  $content$Menagih sewa adalah tugas yang paling sering ditunda oleh pemilik kost. Rasanya tidak enak, takut dianggap materialistis. Padahal tagihan tepat waktu justru membuat hubungan dengan penyewa lebih sehat: aturannya jelas, tidak ada drama di akhir bulan.

## Aturan Emas Penagihan Sewa

**1. Tagih SEBELUM jatuh tempo, bukan sesudah.** Kirim pengingat H-3 sampai H-1. Pesan pengingat yang ramah jauh lebih mudah dibalas daripada tagihan yang datang setelah penyewa "lupa".

**2. Satu kanal, satu format.** Konsisten menagih via WhatsApp dengan format yang sama membuat penyewa mengenali pola: tanggal datang, tagihan datang.

**3. Berikan kuitansi seketika.** Penyewa yang menerima kuitansi rapi merasa transaksinya dihargai — dan lebih disiplin membayar di bulan berikutnya.

## Template Pesan Tagihan WhatsApp (Siap Pakai)

> Halo Kak Rina, semoga sehat selalu 🙏 Kami ingatkan bahwa tagihan sewa kamar A-3 periode Nov 2026 sebesar Rp1.200.000 jatuh tempo 5 Nov. Pembayaran bisa transfer ke rekening berikut: BCA 1234567890 a.n. Nama. Setelah transfer, kirim buktinya ya Kak, kuitansi digital langsung kami kirim. Terima kasih!

Sesuaikan nomor, periode, dan tenggat. Kunci utamanya: sebutkan nama, kamar, periode, nominal, tenggat, dan langkah berikutnya dalam satu pesan pendek.

## Kuitansi Digital: Kenapa Penting

Kuitansi adalah bukti sah pembayaran untuk dua pihak. Dengan kuitansi digital:

- Penyewa punya arsip pembayaran di galeri HP-nya
- Anda punya jejak pencatatan otomatis di buku kas
- Sengketa "sudah/belum bayar" selesai dalam hitungan detik

## Biarkan Aplikasi yang Ingat, Anda Tinggal Kirim

Jika mengelola belasan kamar, menandai lunas dan mengirim kuitansi manual satu per satu memakan waktu. Aplikasi **UnitKu** menyatukan semuanya: status kamar langsung berubah saat tagihan lunas, kuitansi digital siap dibagikan ke WhatsApp penyewa, dan kamar yang jatuh tempo otomatis ditandai di denah dengan warna berbeda — Anda tinggal menyapu daftar yang sudah tersusun.

Ada juga pengingat tagihan otomatis berbasis template WhatsApp, jadi pesan di atas bisa terkirim tanpa Anda mengetik ulang setiap bulan.

## Kesimpulan

Penagihan tepat waktu = pengingat ramah sebelum jatuh tempo + kuitansi segera + pencatatan otomatis. Bangun kebiasaan ini sejak sekarang, atau biarkan UnitKu (unitku.my.id) mengerjakannya untuk Anda.$content$,
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80',
  true
),
(
  'Denah Kamar Interaktif: Cara Modern Memantau Status Kamar Kost',
  'denah-kamar-interaktif-perawatan-fasilitas-kost',
  'Kenali denah kamar interaktif untuk kost: status terisi, kosong, jatuh tempo, dan menunggak dalam satu layar. Plus tips perawatan fasilitas kost rutin.',
  $content$Coba ingat-ingat: berapa persen kamar kost Anda yang terisi saat ini? Berapa yang tagihannya jatuh tempo minggu ini? Jika jawabannya "sepertinya", berarti Anda butuh denah kamar yang selalu akurat.

## Apa Itu Denah Kamar Interaktif

Denah kamar interaktif adalah peta visual seluruh kamar Anda — seperti denah lantai — tetapi setiap kotak kamar menampilkan status terkini: **terisi (lunas)**, **jatuh tempo**, **menunggak**, atau **kosong**. Satu tatapan, seluruh kondisi bisnis terlihat.

Manfaat langsung di lapangan:

- Kamar yang baru ditinggalkan penyewa langsung terlihat → bisa segera diiklankan
- Kamar berstatus menunggak menonjol dengan warna berbeda → prioritas penagihan jelas
- Kapasitas terisi vs kosong terhitung otomatis → proyeksi pendapatan akurat

## Perawatan Fasilitas: Sisi Lain yang Sering Terlupa

Denah hanya menampilkan status sewa. Kondisi fisik kamar — keran bocor, AC mati, lampu redup — tidak bisa dilihat dari warna kotak. Di sinilah sistem komplain membantu:

1. Penyewa melaporkan kerusakan dari portal mereka (lengkap dengan foto)
2. Tiket masuk ke daftar pekerjaan dengan tingkat urgensi
3. Anda assign teknisi dan memantau sampai selesai

Perawatan cepat menjaga kepuasan penyewa — dan penyewa yang puas adalah penyewa yang perpanjang sewa.

## Kenapa Catatan Manual Tidak Cukup Lagi

Buku tulis tidak bisa: menghitung persentase okupansi otomatis, mengingatkan jatuh tempo, mengubah warna kamar saat pembayaran masuk, dan diakses bersama penjaga dari HP masing-masing. Semakin banyak kamar yang Anda kelola, semakin mahal harga dari "catatan manual".

## Solusi Praktis: UnitKu

Aplikasi **UnitKu** (unitku.my.id) menghadirkan denah kamar interaktif persis seperti itu — lengkap dengan filter lantai, status operasional kamar (renovasi/perbaikan), data penyewa satu klik, dan kaitan langsung ke tagihan serta buku kas. Dirancang untuk pemilik kost, kontrakan, dan unit sewa di Indonesia, bisa dicoba gratis lewat demo tanpa registrasi.

## Kesimpulan

Memantau kamar lewat denah interaktif mengubah cara Anda mengambil keputusan: dari mengingat-ingat menjadi melihat. Pasangkan dengan sistem tiket perawatan, dan seluruh operasional kost Anda terkendali dari satu layar HP.$content$,
  'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&q=80',
  true
)
on conflict (slug) do nothing;
