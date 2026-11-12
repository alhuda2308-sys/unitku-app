// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Bank data copywriting promosi mitra (bot Telegram @unitku_partner_bot)
//
// Dua bank materi terpisah, TOPIC-BASED POOL sama-sama berlaku:
//
//  1. COPY_THEMES          → iklan PRODUK untuk pemilik kost/kontrakan
//    (hook → pain → solusi → checklist fitur ✅ → CTA demo, pakai
//    getRandomAffiliateCopy())
//
//  2. RECRUITMENT_THEMES   → AJAK MITRA / kemitraan (peluang komisi)
//    (hook peluang → hitungan/cerita komisi → checklist keuntungan ✅ → CTA
//    daftar, pakai getRandomRecruitmentCopy()). Sudut pandang: bahasa
//    KEMITRAAN B2B PROFESIONAL — tanpa biaya pendaftaran, produk disediakan,
//    potensi komisi Rp150.000 per lisensi, plus simulasi 3 pendaftaran/hari.
//    AMAN MODERASI: seluruh kalimat dihindari dari kata pemicu spam Telegram
//    ("uang cepat", "tanpa modal" berulang-ulang, "gas jualan", "cuan",
//    "mesin penghasil", dsb).
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
// MULTI_PROPERTI. Tema rekrutmen tersedia: SIDE_HUSTLE_MHS, KARYAWAN_95,
// IBU_RUMAH_TANGGA, PELUANG_UMUM, OJOL_DRIVER. Dipakai handler
// /api/telegram/mitra-promo-bot (callback "mitra_promo" dan "mitra_rekrut")
// dan dibungkus tag <pre><code class="language-copy"> agar mitra tinggal
// tap sekali untuk menyalin tanpa merusak format ✅ dan baris.
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

// ─────────────────────────────────────────────────────────────────────────────
// BANK 2 — AJAK MITRA (program kemitraan, potensi komisi Rp150.000/lisensi)
//
// Struktur baku materi rekrutmen:
//   Baris 1  : Hook peluang (pertanyaan + emoji)              → theme.hooks
//   Baris 2  : Hitungan/cerita simulasi komisi konkret        → theme.calculations
//              (standar: 3 pendaftaran/hari × Rp150.000 = Rp450.000;
//               konsisten seminggu Rp3,15 juta, sebulan Rp13,5 juta)
//   Baris 3-7: 5 poin checklist keuntungan (wajib emoji ✅)   → theme.checklist
//              (wajib memuat: tanpa biaya pendaftaran, produk disediakan,
//               cukup bagikan link referral, potensi komisi Rp150.000)
//   Baris 8  : Kalimat pemicu aksi                            → theme.ctas
//   Baris 9  : 👉 Daftar [MASUKKAN_LINK_REFERRAL_ANDA]        → theme.ctas
//
// Pedoman aman moderasi Telegram (berlaku untuk SETIAP kalimat di bawah):
//   - Larangan: "uang cepat", "cuan", "gas", "mesin penghasil", janji hasil
//     instan, dan pengulangan "tanpa modal" di setiap baris.
//   - Pengganti: "Program Kemitraan Afiliasi", "Tanpa biaya pendaftaran",
//     "Potensi komisi Rp150.000 per lisensi", "cukup bagikan link referral".
//   - Simulasi hitungan WAJIB disebut sebagai simulasi/realistis, bukan janji.
//
// Target sudut pandang per tema (nada kemitraan profesional yang santai):
//   SIDE_HUSTLE_MHS   → mahasiswa, penghasilan tambahan sela kuliah
//   KARYAWAN_95       → pekerja kantor, penghasilan kedua tanpa resign
//   IBU_RUMAH_TANGGA  → ibu rumah tangga, jualan dari HP sela waktu
//   PELUANG_UMUM      → jobseeker/umum, tanpa syarat pengalaman
//   OJOL_DRIVER       → driver ojol, penghasilan tambahan sela orderan
// ─────────────────────────────────────────────────────────────────────────────

interface RecruitmentTheme {
  category: string;
  hooks: string[];
  calculations: string[];
  checklist: string[];
  ctas: string[];
}

export const RECRUITMENT_THEMES: RecruitmentTheme[] = [
  {
    category: "SIDE_HUSTLE_MHS",
    hooks: [
      "Sela waktu di antara jadwal kuliah ternyata bisa jadi penghasilan tambahan? 🎓",
      "Pengen punya penghasilan sendiri sejak kuliah, tanpa mengganggu perkuliahan? 📚",
      "Butuh penghasilan tambahan yang praktis dikelola dari HP? 💼"
    ],
    calculations: [
      "Skema komisinya transparan: setiap pendaftaran melalui link referral Anda bernilai komisi Rp150.000 per lisensi. Simulasi: 3 pendaftaran per hari = Rp450.000; bila dijaga konsisten selama sebulan, potensinya mencapai Rp13,5 juta.",
      "Simulasi per hari: 3 pendaftaran × Rp150.000 = Rp450.000. Satu minggu aktif = Rp3,15 juta — target realistis bagi mitra yang rajin mempromosikan.",
      "Ini simulasi kerja, bukan janji instan: 3 pendaftaran × Rp150.000 per hari = Rp450.000. Dijalankan selama 30 hari, penghasilan tambahan Anda bisa mencapai Rp13,5 juta."
    ],
    checklist: [
      "✅ Program Kemitraan Afiliasi tanpa biaya pendaftaran",
      "✅ Produk dan materi promosi sudah disediakan lengkap",
      "✅ Tugas mitra cukup membagikan link referral dari HP",
      "✅ Potensi komisi Rp150.000 per lisensi yang terjual",
      "✅ Jadwal fleksibel, bisa dijalankan sela waktu kuliah"
    ],
    ctas: [
      "Program Kemitraan Afiliasi UnitKu terbuka untuk pendaftaran.\n👉 Daftar sebagai mitra melalui tautan berikut:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
      "Mulai bangun penghasilan tambahan dengan langkah yang jelas dan terukur.\n👉 Daftar jadi mitra di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]"
    ]
  },
  {
    category: "KARYAWAN_95",
    hooks: [
      "Gaji bulanan terasa kurang untuk rencana keuangan Anda? 🏢",
      "Pengen punya penghasilan kedua tanpa mengganggu pekerjaan utama? 💼",
      "Sela waktu istirahat kantor bisa dimanfaatkan lebih produktif? ⏰"
    ],
    calculations: [
      "Skema komisinya jelas: Rp150.000 per lisensi yang terjual melalui link referral Anda. Simulasi 3 pendaftaran per hari = Rp450.000; dijaga konsisten sebulan, potensinya Rp13,5 juta — hampir setara gaji kedua.",
      "Simulasi per hari: 3 pendaftaran × Rp150.000 = Rp450.000. Satu minggu aktif = Rp3,15 juta tambahan, tanpa meninggalkan pekerjaan utama.",
      "Simulasi realistis: 3 pendaftaran × Rp150.000 per hari = Rp450.000. Dijalankan 30 hari, penghasilan kedua Anda bisa mencapai Rp13,5 juta."
    ],
    checklist: [
      "✅ Bergabung sebagai mitra tanpa biaya pendaftaran",
      "✅ Produk, materi promosi, dan panduan sudah disediakan",
      "✅ Cukup promosikan link referral lewat WhatsApp dan sosmed",
      "✅ Potensi komisi Rp150.000 per lisensi, tanpa potongan",
      "✅ Hasil referral tercatat transparan di dashboard mitra"
    ],
    ctas: [
      "Perluas penghasilan Anda dengan program kemitraan yang terukur.\n👉 Daftar sebagai mitra UnitKu di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
      "Bangun penghasilan kedua dari sela jam kerja, tanpa risiko resign.\n👉 Pendaftaran mitra lewat tautan berikut:\n[MASUKKAN_LINK_REFERRAL_ANDA]"
    ]
  },
  {
    category: "IBU_RUMAH_TANGGA",
    hooks: [
      "Mau membantu pemasukan keluarga sambil tetap mengurus rumah? 🏡",
      "Pengen punya penghasilan pribadi dari waktu luang di rumah? 🌷",
      "Waktu sela di antara kegiatan rumah tangga bisa lebih produktif? ✨"
    ],
    calculations: [
      "Skema komisinya sederhana: satu pendaftaran lewat link Anda = komisi Rp150.000 per lisensi. Simulasi 3 pendaftaran per hari = Rp450.000; konsisten sebulan, potensinya Rp13,5 juta.",
      "Simulasi per hari: 3 pendaftaran × Rp150.000 = Rp450.000. Dua hari aktif dalam seminggu saja = Rp900 ribu; dijalankan setiap hari, sebulan mencapai Rp13,5 juta.",
      "Simulasi ringan: sela waktu mengurus rumah dipakai mempromosikan link, 3 pendaftaran × Rp150.000 per hari = Rp450.000. Konsisten 30 hari, kebutuhan bulanan keluarga bisa terbantu."
    ],
    checklist: [
      "✅ Tanpa biaya pendaftaran dan tanpa risiko",
      "✅ Produk plus materi promosi sudah disediakan",
      "✅ Potensi komisi Rp150.000 per lisensi yang terjual",
      "✅ Cukup bagikan link referral dari smartphone di rumah",
      "✅ Ada panduan lengkap untuk mitra pemula"
    ],
    ctas: [
      "Manfaatkan waktu luang untuk penghasilan tambahan keluarga.\n👉 Daftar sebagai mitra UnitKu di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
      "Waktu di rumah Anda bisa bernilai lebih.\n👉 Pendaftaran mitra lewat tautan ini:\n[MASUKKAN_LINK_REFERRAL_ANDA]"
    ]
  },
  {
    category: "PELUANG_UMUM",
    hooks: [
      "Sedang mencari penghasilan tambahan yang bisa dimulai tanpa pengalaman? 🙌",
      "Pengen coba bisnis digital tanpa perlu punya produk sendiri? 🛒",
      "Waktu online Anda bisa dimanfaatkan untuk penghasilan tambahan? 📱"
    ],
    calculations: [
      "Skema komisinya terbuka: Rp150.000 per lisensi, tanpa syarat pengalaman. Simulasi 3 pendaftaran per hari = Rp450.000; konsisten sebulan, potensinya Rp13,5 juta.",
      "Simulasi per hari: 3 pendaftaran × Rp150.000 = Rp450.000. Satu minggu aktif = Rp3,15 juta, disesuaikan ritme kerja masing-masing.",
      "Simulasi pengenalan: 3 pendaftaran × Rp150.000 per hari = Rp450.000. Dijalankan 30 hari, totalnya Rp13,5 juta sebagai penghasilan tambahan dari kerja sendiri."
    ],
    checklist: [
      "✅ Pendaftaran mitra gratis, tanpa biaya awal",
      "✅ Produk sudah disediakan — tidak perlu stok barang",
      "✅ Materi promosi siap pakai, tinggal dibagikan",
      "✅ Potensi komisi Rp150.000 per lisensi yang terjual",
      "✅ Waktu kerja fleksibel, bisa dari mana saja"
    ],
    ctas: [
      "Tanpa pengalaman pun bisa memulai — tersedia panduan lengkap.\n👉 Daftar sebagai mitra UnitKu sekarang:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
      "Mulai penghasilan tambahan lewat program kemitraan resmi.\n👉 Klik tautan pendaftaran mitra:\n[MASUKKAN_LINK_REFERRAL_ANDA]"
    ]
  },
  {
    category: "OJOL_DRIVER",
    hooks: [
      "Pengen penghasilan tambahan tanpa menambah jam di jalan? 🛵",
      "Waktu istirahat di antara orderan bisa dimanfaatkan lebih produktif? ☕",
      "Cari penghasilan kedua yang praktis dikelola dari HP di sela pekerjaan? 📲"
    ],
    calculations: [
      "Skema komisinya jelas: Rp150.000 per lisensi, cukup dikelola dari HP tanpa harus keluar rumah. Simulasi 3 pendaftaran per hari = Rp450.000 — tambahan yang layak di sela jadwal antar orderan.",
      "Simulasi per hari: 3 pendaftaran × Rp150.000 = Rp450.000. Konsisten sebulan, potensinya Rp13,5 juta tanpa biaya bensin tambahan.",
      "Simulasi mudah: tiap pendaftaran lewat link Anda bernilai komisi Rp150.000. Rajin mempromosikan hingga 3 pendaftaran per hari, penghasilan tambahan bisa mencapai Rp13,5 juta per bulan."
    ],
    checklist: [
      "✅ Tanpa biaya pendaftaran dan tanpa kendaraan — cukup HP",
      "✅ Produk plus materi promosi sudah disediakan",
      "✅ Cukup bagikan link referral ke grup dan status WhatsApp",
      "✅ Potensi komisi Rp150.000 per lisensi yang terjual",
      "✅ Cuaca dan macet tidak memengaruhi penghasilan ini"
    ],
    ctas: [
      "Tambah penghasilan tanpa menambah jam kerja di jalan.\n👉 Daftar sebagai mitra UnitKu di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
      "Manfaatkan waktu tunggu antar orderan untuk penghasilan kedua.\n👉 Pendaftaran mitra lewat tautan ini:\n[MASUKKAN_LINK_REFERRAL_ANDA]"
    ]
  }
];

export function getRandomRecruitmentCopy(): string {
  // 1. Pilih tema rekrutmen secara acak
  const theme = RECRUITMENT_THEMES[Math.floor(Math.random() * RECRUITMENT_THEMES.length)];

  // 2. Ambil elemen acak DARI TEMA YANG SAMA (alur peluang → hitungan →
  //    keuntungan → CTA selalu nyambung satu sudut pandang)
  const hook = theme.hooks[Math.floor(Math.random() * theme.hooks.length)];
  const calculation = theme.calculations[Math.floor(Math.random() * theme.calculations.length)];
  const checklistText = theme.checklist.join("\n");
  const cta = theme.ctas[Math.floor(Math.random() * theme.ctas.length)];

  return `${hook}\n\n${calculation}\n\n${checklistText}\n\n${cta}`;
}
