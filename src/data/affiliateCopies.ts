// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Bank data copywriting iklan PRODUK (bot Telegram @unitku_partner_bot)
//
// Isi: COPY_THEMES → iklan PRODUK untuk pemilik kost/kontrakan
//   (hook → pain → solusi → checklist fitur ✅ → CTA demo, pakai
//   getRandomAffiliateCopy()).
//
// TOPIC-BASED POOL: seluruh teks dikelompokkan per tema supaya hasil acak
// SELALU NYAMBUNG antar-paragraf — semua elemen diambil dari TEMA YANG SAMA
// (tidak ada lagi hook kamar kosong yang nyambung ke cerita kwitansi hilang).
//
// Struktur baku setiap materi (10 baris):
//   Baris 1  : Hook masalah emosional (pertanyaan + emoji)      → theme.hooks
//   Baris 2  : Cerita masalah / pain point spesifik topik       → theme.pains
//   Baris 3  : Jembatan solusi UnitKu                           → theme.solutions
//   Baris 4-8: 5 poin checklist fitur hijau (wajib emoji ✅)     → theme.checklist
//   Baris 9  : Kalimat pemicu aksi                              → theme.ctas
//   Baris 10 : 👉 Tautan demo [MASUKKAN_LINK_REFERRAL_ANDA]     → theme.ctas
//
// Tema produk tersedia: MANUAL_BOOK, NAGIH_SEWA, KAMAR_KOSONG, REMOTE_OWNER,
// MULTI_PROPERTI. Dipakai handler /api/telegram/mitra-promo-bot
// (callback "mitra_promo") dan dibungkus tag <pre><code class="language-copy">
// agar mitra tinggal tap sekali untuk menyalin tanpa merusak format ✅ dan baris.
//
// CATATAN: bank materi REKRUTMEN / ajak mitra (hook peluang → simulasi komisi
// Rp150.000/lisensi → checklist ✅ → CTA pendaftaran mitra) telah DIPINDAHKAN
// ke src/data/adminPromoData.ts dan kini di-generate oleh bot admin
// @unitku_promogen_bot via /api/telegram/admin-promo-bot.
// ─────────────────────────────────────────────────────────────────────────────

interface CopywritingTheme {
  category: string;
  hooks: string[];
  pains: string[];
  solutions: string[];
  checklist: string[];
  ctas: string[];
}

export const COPY_THEMES: CopywritingTheme[] = [
  {
    category: "MANUAL_BOOK",
    hooks: [
      "Buku catatan tebal dan kwitansi kertas sering hilang entah ke mana? 😵‍💫",
      "Masih mengelola kost atau kontrakan pakai buku catatan? 🫣",
      "Catatan uang sewa di buku sering ketumpahan kopi atau keselip? ☕📖"
    ],
    pains: [
      "Giliran ada komplain pembayaran dari anak kost, Anda malah bingung cari bukti fisiknya.",
      "Semakin banyak unit, semakin pusing mencocokkan siapa yang sudah lunas dan siapa yang nunggak.",
      "Pencatatan manual bikin uang sewa sering tercecer dan hitungan kas berantakan."
    ],
    solutions: [
      "Saatnya beralih ke UnitKu, pembukuan digital yang rapi dan serba otomatis:",
      "Tinggalkan cara lama dan gunakan UnitKu untuk kelola unit sewa tanpa pusing:"
    ],
    checklist: [
      "✅ Denah visual tampilkan status kamar lunas vs nunggak instan",
      "✅ Tagihan resmi terkirim otomatis ke WhatsApp penyewa",
      "✅ Bukti transfer & riwayat bayar tersimpan aman di cloud",
      "✅ Laporan kas bulanan langsung tersaji tanpa kalkulator",
      "✅ Akses langsung via browser HP tanpa install aplikasi berat"
    ],
    ctas: [
      "Saatnya tinggalkan cara manual yang bikin pusing.\n👉 Coba gratis demo UnitKu sekarang juga:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
      "Bikin operasional kost Anda naik level dan serba rapi.\n👉 Klik link ini untuk coba demonya:\n[MASUKKAN_LINK_REFERRAL_ANDA]"
    ]
  },
  {
    category: "NAGIH_SEWA",
    hooks: [
      "Sering ngerasa gak enakan pas nagih sewa kamar kost? 😮‍💨",
      "Anak kost suka beralasan 'lupa bayar' tiap kali jatuh tempo? 🙄",
      "Nagih uang sewa kost rasa nagih utang pribadi ke teman sendiri? 🤦‍♂️"
    ],
    pains: [
      "Mau nagih langsung tapi segan, dibiarin malah nunggak berbulan-bulan sampai kas tekor.",
      "Pas ditagih alasannya dicicil dua kali sampai hitungan pembukuan jadi berantakan.",
      "Waktu berharga Anda habis cuma buat chat wa pengingat satu per satu ke penghuni."
    ],
    solutions: [
      "Biar sistem UnitKu yang menagih secara tertib, sopan, dan profesional:",
      "Otomatiskan penagihan sewa Anda dengan sistem notifikasi UnitKu:"
    ],
    checklist: [
      "✅ Notifikasi tagihan jatuh tempo terkirim otomatis via WhatsApp",
      "✅ Format rincian tagihan sopan, jelas, dan berkredibilitas",
      "✅ Indikator warna kamar otomatis merah saat lewat tempo",
      "✅ Anak kost gak wajib install aplikasi (cukup buka via WhatsApp)",
      "✅ Rekap cicilan dan sisa tunggakan tercatat akurat"
    ],
    ctas: [
      "Bikin anak kost tertib bayar tanpa perlu adu argumen.\n👉 Akses link uji coba UnitKu di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
      "Bebas drama penagihan sewa mulai hari ini.\n👉 Coba demo aplikasinya lewat link berikut:\n[MASUKKAN_LINK_REFERRAL_ANDA]"
    ]
  },
  {
    category: "KAMAR_KOSONG",
    hooks: [
      "Berapa kerugian Anda tiap bulan kalau kamar kost dibiarkan menganggur? 💸",
      "Kamar kost kosong berbulan-bulan bikin potensi pemasukan melayang? 📉",
      "Bikin status promosi kamar kost tapi sepi peminat dan gak ada yang tanya? 🥱"
    ],
    pains: [
      "Biaya listrik dan operasional jalan terus, tapi kamar tak kunjung terisi karena promosi kurang maksimal.",
      "Mau pasang iklan di sosmed tapi bingung merangkai kata-kata penawaran yang memikat calon penyewa.",
      "Kalah cepat dengan kost tetangga hanya karena lambat membalas ketersediaan fasilitas kamar."
    ],
    solutions: [
      "Dongkrak daya tarik dan tingkat okupansi properti Anda bersama UnitKu:",
      "Maksimalkan pemasaran kamar kosong Anda dengan fitur cerdas UnitKu:"
    ],
    checklist: [
      "✅ AI Ad Generator bantu buat teks promo iklan kamar dalam 3 detik",
      "✅ Tampilan katalog kamar modern dan terpercaya sekelas hotel",
      "✅ Pantau pintu yang siap huni secara live lewat denah visual",
      "✅ Kirim rincian fasilitas & foto kamar langsung ke WhatsApp calon penyewa",
      "✅ Tanpa potongan komisi sewa sepeser pun (0% potongan)"
    ],
    ctas: [
      "Kembalikan performa bisnis kost Anda ke kapasitas penuh.\n👉 Coba gratis demo UnitKu sekarang:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
      "Isi kamar kosong lebih cepat tanpa pusing mikir kata-kata promosi.\n👉 Cek demonya di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]"
    ]
  },
  {
    category: "REMOTE_OWNER",
    hooks: [
      "Tinggal jauh dari lokasi kost tapi tetap wajib pantau semuanya? ✈️",
      "Habis puluhan ribu buat BBM bolak-balik cuma buat cek kamar kosong? ⛽",
      "Mau tenang kerja di luar kota tapi dikejar laporan penjaga kost yang selalu telat? 🏖️"
    ],
    pains: [
      "Kabar tunggakan dan kamar kosong baru sampai berminggu-minggu lewat penjaga, keputusan Anda selalu kebablasan.",
      "Setoran sewa sering telat masuk rekening dan Anda gak pernah tahu kondisi riil properti tanpa datang langsung.",
      "Penjaga mencatat dengan caranya sendiri, giliran Anda minta laporan malah sulit dibaca dan sulit dipercaya."
    ],
    solutions: [
      "Kendalikan seluruh properti jarak jauh secara real-time dengan UnitKu:",
      "Pantau bisnis kost Anda dari mana saja layaknya melihat layar sendiri:"
    ],
    checklist: [
      "✅ Denah kamar & status penghuni terpantau live dari HP",
      "✅ Notifikasi tagihan lunas masuk langsung ke HP Anda",
      "✅ Setoran sewa mengalir ke rekening pribadi tanpa perantara",
      "✅ Laporan kas otomatis tanpa menunggu rekap penjaga",
      "✅ Hemat biaya perjalanan bolak-balik cek properti"
    ],
    ctas: [
      "Tinggal di mana pun, kendali bisnis tetap penuh di tangan Anda.\n👉 Coba demo UnitKu sekarang:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
      "Bebas bolak-balik ke lokasi hanya buat mengecek kamar.\n👉 Buka link demo ini langsung dari HP Anda:\n[MASUKKAN_LINK_REFERRAL_ANDA]"
    ]
  },
  {
    category: "MULTI_PROPERTI",
    hooks: [
      "Punya banyak pintu kost, kontrakan, sampai kios usaha sekaligus? 🏘️",
      "Catatan tiap properti terpisah sampai sendiri bingung hitung total untung? 📊",
      "Makin banyak unit ditambah, administrasinya malah makin tumpang tindih? 📈"
    ],
    pains: [
      "Tiap lokasi dicatat di buku berbeda, giliran akhir bulan Anda menjumlahkan semuanya manual satu per satu.",
      "Juggling antar lokasi makin berat sampai ada tagihan yang lolos dan kamar yang terlewat.",
      "Sulit tahu properti mana yang paling untung karena semua angka bercampur jadi satu."
    ],
    solutions: [
      "Gabungkan seluruh unit sewa Anda dalam satu akun terpusat UnitKu:",
      "Kelola banyak cabang properti serapi mengelola satu pintu:"
    ],
    checklist: [
      "✅ Semua properti & cabang tampil dalam satu dashboard",
      "✅ Status lunas vs nunggak tiap lokasi terlihat sekaligus",
      "✅ Rekap pendapatan per properti tersusun otomatis",
      "✅ Multi-user: pemilik & penjaga bisa akses bersama",
      "✅ Skala fleksibel dari 5 pintu hingga ratusan unit"
    ],
    ctas: [
      "Satu akun untuk seluruh kekayaan properti Anda.\n👉 Buktikan lewat demo gratis ini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
      "Makin banyak unit, makin ringan kelolanya bersama UnitKu.\n👉 Klik link demo dan lihat sendiri:\n[MASUKKAN_LINK_REFERRAL_ANDA]"
    ]
  }
];

export function getRandomAffiliateCopy(): string {
  // 1. Pilih tema secara acak
  const theme = COPY_THEMES[Math.floor(Math.random() * COPY_THEMES.length)];

  // 2. Ambil elemen acak DARI TEMA YANG SAMA (menjamin alur kalimat selalu nyambung)
  const hook = theme.hooks[Math.floor(Math.random() * theme.hooks.length)];
  const pain = theme.pains[Math.floor(Math.random() * theme.pains.length)];
  const solution = theme.solutions[Math.floor(Math.random() * theme.solutions.length)];
  const checklistText = theme.checklist.join("\n");
  const cta = theme.ctas[Math.floor(Math.random() * theme.ctas.length)];

  return `${hook}\n\n${pain}\n\n${solution}\n${checklistText}\n\n${cta}`;
}
