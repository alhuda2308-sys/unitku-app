// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Bank data copywriting promosi mitra (bot Telegram @unitku_mitra_bot)
//
// Dua bank materi terpisah, TOPIC-BASED POOL sama-sama berlaku:
//
//  1. COPY_THEMES          → iklan PRODUK untuk pemilik kost/kontrakan
//    (hook → pain → solusi → checklist fitur ✅ → CTA demo, pakai
//    getRandomAffiliateCopy())
//
//  2. RECRUITMENT_THEMES   → AJAK MITRA / rekrutmen (peluang komisi)
//    (hook peluang → hitungan/cerita komisi → checklist keuntungan ✅ → CTA
//    daftar, pakai getRandomRecruitmentCopy()). Sudut pandang: tanpa modal,
//    produk disediakan, tinggal gas jualan, komisi Rp150.000 sekali jual,
//    plus simulasi hitungan sehari 3 closing.
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
// BANK 2 — REKRUTMEN MITRA ("Ajak Mitra", peluang komisi Rp150.000/jual)
//
// Struktur baku materi rekrutmen:
//   Baris 1  : Hook peluang (pertanyaan + emoji)              → theme.hooks
//   Baris 2  : Hitungan/cerita simulasi komisi konkret        → theme.calculations
//              (standar: 3 closing/hari × Rp150.000 = Rp450.000;
//               konsisten seminggu Rp3,15 juta, sebulan Rp13,5 juta)
//   Baris 3-7: 5 poin checklist keuntungan (wajib emoji ✅)   → theme.checklist
//              (wajib memuat: tanpa modal, produk disediakan, tinggal gas
//               jualan, komisi Rp150.000 sekali jual)
//   Baris 8  : Kalimat pemicu aksi                            → theme.ctas
//   Baris 9  : 👉 Daftar [MASUKKAN_LINK_REFERRAL_ANDA]        → theme.ctas
//
// Target sudut pandang per tema (semua nada "gampang & zero risk"):
//   SIDE_HUSTLE_MHS   → mahasiswa/anak kos cari uang sampingan
//   KARYAWAN_95       → pekerja kantor yang mau side income
//   IBU_RUMAH_TANGGA  → ibu rumah tangga, jualan dari HP sela waktu
//   PELUANG_UMUM      → jobseeker/umum, tanpa syarat pengalaman
//   OJOL_DRIVER       → driver ojol, cuan tambahan tanpa tambah jam jalan
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
      "Uang kos cair tanggal 1, habis melintas tanggal 10? 😅",
      "Butuh penghasilan sendiri tapi gak punya modal sepeser pun? 💸",
      "Pengen punya uang jajan abadi tanpa minta terus ke orang tua? 🎓"
    ],
    calculations: [
      "Coba hitung bareng dulu: satu closing di UnitKu berarti komisi Rp150.000 langsung cair. Sekali semangat promosi dapat 3 closing dalam sehari, itu Rp450.000 masuk rekening. Konsisten sebulan penuh, hitungannya bisa tembus Rp13,5 juta — semua cuma dari HP.",
      "Matematikanya gampang banget: 3 closing × Rp150.000 = Rp450.000 per hari. Jalan rutin seminggu aja udah Rp3,15 juta, lebih besar dari uang kos setahun.",
      "Ini hitungan riilnya: komisi Rp150.000 per orang yang Anda ajak daftar. Target santai 3 closing sehari aja, dalam 30 hari ada Rp13,5 juta mengalir ke rekening Anda."
    ],
    checklist: [
      "✅ 100% tanpa modal — gak perlu setor sepeser pun",
      "✅ Produk dan materi promosi sudah disediakan lengkap",
      "✅ Tugas Anda cuma satu: gas jualan dari HP",
      "✅ Komisi Rp150.000 langsung dapat tiap satu kali jual",
      "✅ Jam kerja bebas, sela waktu kuliah pun bisa"
    ],
    ctas: [
      "Slot mitra selalu terbuka, tapi yang gerak duluan yang panen duluan.\n👉 Daftar jadi mitra UnitKu sekarang:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
      "Modal nol, produk tinggal pakai — rugi di mana kalau gak dicoba?\n👉 Daftar lewat link ini sebelum nyesel:\n[MASUKKAN_LINK_REFERRAL_ANDA]"
    ]
  },
  {
    category: "KARYAWAN_95",
    hooks: [
      "Gaji selalu habis sebelum tanggal muda datang? 😮‍💨",
      "Kerja 9-5 tiap hari tapi saldo rekening tetap segitu-gitu aja? 🏢",
      "Pengen side hustle tapi bingung mulai jualan apa tanpa modal? 🤔"
    ],
    calculations: [
      "Hitung sederhananya begini: komisi Rp150.000 per closing UnitKu. Sisipkan waktu istirahat buat promosi, dapat 3 closing sehari berarti tambahan Rp450.000. Konsisten sebulan, side income Anda bisa menembus Rp13,5 juta — nyaris setara gaji kedua.",
      "Bayangkan: 3 closing × Rp150.000 = Rp450.000 sore ini. Jalan rutin seminggu, tambahan Rp3,15 juta masuk rekening tanpa harus tinggalkan kerja utama.",
      "Ini bukan janji muluk: tiap orang yang daftar lewat link Anda berarti Rp150.000 untuk Anda. Konsisten 3 closing per hari, penghasilan sampingan Rp13,5 juta per bulan bukan angka mustahil."
    ],
    checklist: [
      "✅ Sistem affiliate tanpa modal dan tanpa stok barang",
      "✅ Produk, landing page, dan materi iklan sudah disediakan",
      "✅ Tinggal gas jualan lewat WhatsApp dan sosmed",
      "✅ Komisi Rp150.000 sekali jual, cair tanpa potongan",
      "✅ Hasil referral tercatat transparan di dashboard"
    ],
    ctas: [
      "Gaji tetap jalan, tambahan komisi ikut mengalir.\n👉 Daftar jadi mitra UnitKu di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
      "Kenapa harus nunggu bonus tahunan kalau komisi bisa cair tiap hari?\n👉 Amankan slot mitra Anda lewat link ini:\n[MASUKKAN_LINK_REFERRAL_ANDA]"
    ]
  },
  {
    category: "IBU_RUMAH_TANGGA",
    hooks: [
      "Mau bantu tambah pemasukan keluarga tapi gak bisa keluar rumah? 🏡",
      "Pengen punya uang pribadi tanpa harus nunggu dikasih? 💐",
      "Sela waktu di antara urusan rumah ternyata bisa jadi penghasilan? ✨"
    ],
    calculations: [
      "Hitungannya ringan banget: satu orang daftar lewat link Anda = komisi Rp150.000. Sekali share santai ke grup WA dapat 3 closing, itu Rp450.000. Rutin sebulan, Rp13,5 juta bisa cair tanpa ninggalin dapur.",
      "Sederhananya: sekali bagikan link, dapat 3 closing berarti komisi Rp150.000 × 3 = Rp450.000 langsung masuk. Seminggu dua kali aja udah Rp900 ribu; kalau tiap hari, sebulan Rp13,5 juta.",
      "Coba simulasi ini: komisi Rp150.000 per daftar. Sambil nunggu jemuran kering, 3 closing terkumpul = Rp450.000. Sebulan penuh konsisten, belanja bulanan terbayar dari HP doang."
    ],
    checklist: [
      "✅ Tanpa modal dan tanpa risiko sepeser pun",
      "✅ Produk plus materi promosi sudah disediakan — tinggal gas share link",
      "✅ Komisi Rp150.000 per closing, dapat langsung tiap jual",
      "✅ Cukup dari smartphone, jualan sambil urus rumah",
      "✅ Ada panduan lengkap, pemula pun bisa langsung jalan"
    ],
    ctas: [
      "Penghasilan sendiri tanpa ninggalin keluarga? Bisa banget.\n👉 Daftar jadi mitra UnitKu di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
      "Waktu luang Anda layak menghasilkan lebih.\n👉 Mulai jadi mitra lewat link ini:\n[MASUKKAN_LINK_REFERRAL_ANDA]"
    ]
  },
  {
    category: "PELUANG_UMUM",
    hooks: [
      "Lagi cari penghasilan tapi semua lowongan minta pengalaman? 🙃",
      "Bosan nunggu hasil lamaran kerja yang gak kelar-kelar? 📭",
      "Punya kuota internet melimpah tapi belum menghasilkan? 📱"
    ],
    calculations: [
      "Ini peluangnya: komisi Rp150.000 per closing, tanpa syarat pengalaman. Bisa dapat 3 closing sehari, rekening dapat Rp450.000. Konsisten sebulan, Rp13,5 juta — tanpa interview dan tanpa jam kerja.",
      "Gak perlu pengalaman, perhitungannya aja yang perlu: 3 closing × Rp150.000 = Rp450.000 per hari. Sekali jalan seminggu, Rp3,15 juta sudah menunggu di rekening.",
      "Simulasi paling jujur: ajak 3 orang daftar = 3 closing dalam sehari = 3 × Rp150.000 = Rp450.000. Dilakukan rutin 30 hari, totalnya Rp13,5 juta dari kerja sendiri."
    ],
    checklist: [
      "✅ Tanpa modal, tanpa biaya pendaftaran sepeser pun",
      "✅ Produk sudah disediakan, gak perlu siapkan apa-apa",
      "✅ Materi jualan siap copas, tinggal gas promosi",
      "✅ Komisi Rp150.000 dapat langsung setiap satu kali jual",
      "✅ Fleksibel penuh: kerja kapan pun, dari mana pun"
    ],
    ctas: [
      "Pengalaman gak wajib, niat jualan saja yang dinilai.\n👉 Daftar jadi mitra UnitKu sekarang:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
      "Stop nunggu panggilan kerja, mulai panen komisi sendiri.\n👉 Klik link dan daftar jadi mitra:\n[MASUKKAN_LINK_REFERRAL_ANDA]"
    ]
  },
  {
    category: "OJOL_DRIVER",
    hooks: [
      "Ngantar penumpang sampai tengah malam tapi setoran tetap ke mitra? 🛵",
      "Pengen cuan tambahan tanpa nambah jam di jalan? ⛽",
      "Bensin naik terus, tapi tarif orderan tetap segitu-gitu aja? 😤"
    ],
    calculations: [
      "Coba bandingkan: satu closing di UnitKu bernilai Rp150.000 tanpa harus keluar rumah. Gas 3 closing sehari lewat HP, Rp450.000 masuk rekening — lebih aman dari bolak-balik nyari orderan tengah malam.",
      "Hitungan santainya: 3 closing × Rp150.000 = Rp450.000 per hari dari kasur. Sebulan konsisten, Rp13,5 juta tanpa bensin dan tanpa geter.",
      "Simulasi gampang: tiap orang yang daftar lewat link Anda = Rp150.000. Rutin dapat 3 closing sehari, penghasilan barunya Rp13,5 juta per bulan."
    ],
    checklist: [
      "✅ Tanpa modal dan tanpa kendaraan — cukup HP",
      "✅ Produk plus materi promosi sudah disediakan",
      "✅ Tinggal gas share link ke grup dan status WhatsApp",
      "✅ Komisi Rp150.000 langsung cair tiap satu kali jual",
      "✅ Cuaca dan macet gak bisa ganggu penghasilan ini"
    ],
    ctas: [
      "Tubuh gak perlu capek, penghasilan tetap nambah.\n👉 Daftar jadi mitra UnitKu di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
      "Setoran buat mitra sudah, tambahan buat Anda belum?\n👉 Mulai panen komisi lewat link ini:\n[MASUKKAN_LINK_REFERRAL_ANDA]"
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
