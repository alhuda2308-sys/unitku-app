// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Bank Materi Kemitraan Bot Admin (@unitku_promogen_bot)
//
// Sumber data modular untuk generator konten bot admin (webhook
// /api/telegram/admin-promo-bot, ADMIN ONLY — whitelist TELEGRAM_ADMIN_CHAT_ID).
//
// Bank materi yang tersedia:
//   ADMIN_HOOKS            pembuka status medsos (sudut pandang kemitraan)
//   ADMIN_CONTEXTS         penjelasan produk (software kost karya lokal, tagihan
//                          WA otomatis, sekali bayar, bebas biaya bulanan)
//   ADMIN_VALUES           benefit kemitraan (komisi Rp150.000/lisensi,
//                          dashboard mandiri, materi disediakan, tim urus
//                          teknis/komplain, 10 lisensi = Rp1,5 juta)
//   ADMIN_CTAS             ajakan komen "MAU" / "MINAT" di kolom komentar medsos
//   ADMIN_DM_TEMPLATES     template balasan inbox ramah berisi link afiliasi
//   ADMIN_REKRUTMEN_THEMES materi AJAK MITRA terstruktur (DIPINDAHKAN dari
//                          src/data/affiliateCopies.ts): Hook peluang →
//                          Penjelasan & simulasi komisi Rp150.000/lisensi →
//                          5 poin checklist ✅ → CTA pendaftaran mitra.
//                          Konsumen: getRandomRecruitmentCopy() pada callback
//                          "gen_rekrut" di bot admin @unitku_promogen_bot.
//
// Kombinasi acak 100 × 100 × 100 × 100 = 100 juta variasi status medsos,
// ditambah 5 template DM dan 5 tema rekrutmen — stok konten tanpa terlihat
// repetitif.
//
// ATURAN GAYA MATERI (sanitasi anti-moderasi — berlaku untuk SETIAP kalimat):
//   - Larangan: "cuan", "duit", "gurih", "gas jualan", "mesin penghasil",
//     "uang cepat", "rebahan", "jempol", "kantong", "cair", "transferan",
//     "tis tis", janji hasil instan, dan pengulangan "tanpa modal".
//   - Pengganti: "penghasilan tambahan", "Program Kemitraan Afiliasi",
//     "Tanpa biaya pendaftaran", "Potensi komisi Rp150.000 per lisensi",
//     "cukup bagikan link referral".
//   - Simulasi hitungan WAJIB disebut sebagai simulasi, bukan janji.
//   - Bahasa kemitraan B2B profesional yang santun — tetap hangat, tanpa
//     slang agresif, aman dari filter spam Telegram & moderasi medsos.
//
// ATURAN PENAMAAN PRODUK:
//   - Nama produk "UnitKu" dan link HANYA boleh muncul di ADMIN_DM_TEMPLATES;
//     HOOKS/CONTEXTS/VALUES/CTAS sengaja netral agar status medsos terlihat
//     organik. Pengecualian: CTA pada ADMIN_REKRUTMEN_THEMES boleh menyebut
//     "Program Kemitraan Afiliasi UnitKu" (iklan rekrutmen resmi), dengan
//     placeholder [MASUKKAN_LINK_REFERRAL_ANDA] (bukan link langsung).
//
// CATATAN: teks dikirim dengan parse_mode HTML di dalam
// <pre><code class="language-copy">; route melakukan escapeHtml() sehingga
// karakter &, <, > pada isi string tetap aman — dan tombol salin instan
// (ikon COPY pojok kanan atas) tampil di Telegram.
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIN_HOOKS = [
  // Relasi dekat — tetangga, kenalan, keluarga pemilik properti sewa
  "Punya tetangga atau kenalan yang mengelola kost atau kontrakan? Program kemitraan ini bisa Anda tawarkan langsung kepada mereka.",
  "Banyak kenalan pemilik kos di grup RT atau komunitas warga? Peluang kemitraan afiliasi bisa dimulai dari sana.",
  "Kontak WhatsApp Anda banyak berisi pemilik properti sewa? Mereka adalah calon pembeli yang paling tepat.",
  "Keluarga atau saudara Anda punya kosan atau ruko kontrakan? Rekomendasi dari orang terdekat biasanya paling mudah diterima.",
  "Sering mengobrol dengan juragan kos di sekitar rumah? Topik pembukuan digital bisa jadi pembuka percakapan yang baik.",
  "Punya jaringan pertemanan di kompleks yang banyak kontrakannya? Program afiliasi ini cocok untuk Anda mulai.",
  "Kenalan Anda ada yang sering mengeluh mengurus tagihan sewa? Perkenalkan solusinya, Anda yang menerima komisinya.",
  "Pemilik kontrakan biasanya saling mengenal satu sama lain. Satu rekomendasi yang berhasil sering berlanjut ke kenalan mereka.",
  "Komunitas Anda banyak berisi orang tua yang mengelola aset properti? Mereka cocok dengan produk yang kami pasarkan.",
  "Hubungan baik dengan pengurus lingkungan bisa jadi pintu masuk memperkenalkan program ini ke pemilik kos sekitar.",
  // Penghasilan tambahan sela aktivitas
  "Mencari penghasilan tambahan yang bisa dikelola sela jam kuliah? Program kemitraan afiliasi bisa dijalankan secara fleksibel.",
  "Penghasilan kedua tanpa meninggalkan pekerjaan utama? Skema komisinya jelas: Rp150.000 per lisensi yang terjual.",
  "Waktu luang di rumah bisa dimanfaatkan untuk membangun penghasilan tambahan yang terukur.",
  "Sela aktivitas harian cukup untuk mempromosikan satu produk digital yang memang dibutuhkan pasar.",
  "Butuh tambahan pendapatan dengan jadwal yang Anda tentukan sendiri? Kemitraan afiliasi tidak mengikat waktu kerja.",
  "Rencana keuangan keluarga bisa lebih lega dengan penghasilan tambahan dari program kemitraan resmi.",
  "Sela waktu antar aktivitas bisa Anda gunakan untuk membagikan link referral ke orang yang tepat.",
  "Penghasilan tambahan tidak selalu butuh jam kerja panjang — cukup promosi yang konsisten dan tepat sasaran.",
  "Bagi yang waktu luangnya terbatas, program kemitraan ini bisa dijalankan dalam hitungan menit per hari.",
  "Menambah tabungan bulanan kini bisa dimulai dari satu langkah sederhana: membagikan rekomendasi produk berguna.",
  // Produk digital tanpa stok
  "Tertarik berbisnis tanpa stok barang, packing, dan pengiriman? Produk digital adalah jalannya.",
  "Tidak perlu mikirin ongkir, retur, atau barang rusak — semua yang dipasarkan adalah akses software.",
  "Bosan dengan dagangan yang ada kadaluwarsanya? Produk digital kami terjual berulang tanpa butuh gudang.",
  "Bisnis produk digital: tanpa kirim paket, tanpa kelola stok, komisinya jelas per transaksi.",
  "Satu link referral adalah 'gerai' Anda — tidak butuh ruko, rak barang, atau karyawan.",
  "Tidak perlu punya produk sendiri. Produk, materi promosi, dan sistemnya sudah disiapkan lengkap.",
  "Yang dipasarkan software praktis yang langsung dipakai pembeli — bukan kursus atau ebook motivasi.",
  "Urusan stok dan ekspedisi bukan bagian dari kerja mitra. Tugas Anda hanya memperkenalkan produknya.",
  "Produk digital lokal dengan imbalan komisi yang layak: Rp150.000 per lisensi tanpa potongan.",
  "Tidak ada urusan pengiriman fisik sama sekali — aktivasi lisensi diurus penuh oleh tim pusat.",
  // Komisi flat jelas
  "Skema komisinya transparan: satu pendaftaran lewat link referral Anda bernilai Rp150.000.",
  "Komisi flat Rp150.000 per lisensi — tanpa persentase yang membuat hitungan menjadi rumit.",
  "Satu closing bernilai Rp150.000; seminggu tiga closing berarti Rp450.000 tambahan.",
  "Angka komisinya tercantum jelas di dashboard mitra, tidak ada perhitungan tersembunyi.",
  "Rp150.000 per transaksi, dan tidak ada batasan jumlah lisensi yang bisa Anda pasarkan.",
  "Komisi dibayarkan penuh per penjualan — sepuluh lisensi sebulan berarti Rp1,5 juta.",
  "Nilai komisi per lisensinya besar untuk ukuran produk digital: Rp150.000, tercatat otomatis.",
  "Tidak ada target bulanan yang memaksa — Anda mengatur sendiri ritme promosinya.",
  "Setiap pendaftaran yang tervalidasi langsung tercatat sebagai hak komisi Anda di dashboard.",
  "Skema imbalannya sederhana: Anda memperkenalkan, pembeli berlangganan, komisi Rp150.000 menjadi milik Anda.",
  // Tanpa biaya pendaftaran
  "Pendaftaran mitra tidak dipungut biaya — Anda bisa mencoba dulu tanpa risiko.",
  "Program Kemitraan Afiliasi ini terbuka tanpa biaya pendaftaran, produknya sudah disediakan.",
  "Tidak ada investasi awal yang perlu Anda keluarkan untuk menjadi mitra resmi.",
  "Bergabung sebagai mitra tanpa biaya; Anda hanya perlu membagikan link referral yang diberikan.",
  "Risikonya rendah: tanpa biaya pendaftaran, tanpa stok, dan seluruh aktivasi diurus tim pusat.",
  "Anda tidak perlu membeli produknya terlebih dahulu untuk memasarkannya.",
  "Kemitraan ini tidak menuntut modal usaha — yang dibutuhkan hanya kemauan mempromosikan.",
  "Mulai dari nol rupiah: daftar, ambil link referral, lalu bagikan ke calon pembeli.",
  "Tidak ada biaya bulanan ataupun iuran kemitraan yang perlu Anda bayarkan.",
  "Pendaftaran tanpa biaya membuat program ini layak dicoba siapa pun yang punya jaringan properti.",
  // Ramah pemula
  "Belum berpengalaman berjualan? Tersedia panduan lengkap untuk mitra pemula.",
  "Tidak perlu keahlian teknis — cukup kenal siapa yang mengelola kost atau kontrakan.",
  "Untuk Anda yang baru memulai: materi promosi siap pakai tinggal disalin dan dibagikan.",
  "Anda tidak perlu menjelaskan fitur satu per satu; web demo produk yang berbicara.",
  "Mitra pemula dibimbing dengan panduan langkah demi langkah hingga closing pertama.",
  "Pengalaman sales bukan syarat — pemahaman soal masalah pemilik kos sudah lebih dari cukup.",
  "Semua kalimat promosi sudah disusun profesional; tugas Anda hanya memilih dan membagikan.",
  "Pertanyaan teknis pembeli? Alihkan ke tim pusat — mitra tidak menangani dukungan teknis.",
  "Tidak perlu paham koding atau aplikasi — produknya dirancang mudah dijelaskan ke siapa pun.",
  "Bahasa promosinya sopan dan profesional, cocok dibagikan ke grup keluarga maupun komunitas.",
  // Fleksibel dari mana saja
  "Kemitraan bisa dijalankan dari mana saja cukup dengan smartphone dan koneksi internet.",
  "Tidak ada jam kantor dan tidak ada atasan — Anda yang menentukan kapan mempromosikan.",
  "Cuaca dan macet tidak mengganggu pekerjaan mitra: promosi bisa dilakukan dari rumah.",
  "Cocok dijalankan sela pekerjaan utama tanpa saling mengganggu dengan jadwal kantor.",
  "Aktivitas kemitraan ringan: menyalin materi, membagikan link, dan memantau hasil di dashboard.",
  "Anda tetap bisa mengurus keluarga sambil menjalankan kemitraan ini secara santai.",
  "Waktu menunggu di sela perjalanan pun bisa dipakai membalas calon pembeli lewat chat.",
  "Tidak ada lokasi wajib — promosi bisa menjangkau pemilik kos di kota mana pun.",
  "Ritme kerja mitra sepenuhnya fleksibel: santai di awal, meningkat sesuai kebutuhan.",
  "Dibanding kerja sampingan lain, kemitraan afiliasi paling ringan dari sisi mobilitas.",
  // Materi & tools disediakan
  "Materi promosi siap pakai tersedia lengkap — Anda tidak perlu menyusun kalimat dari nol.",
  "Setiap mitra mendapat akses dashboard untuk memantau klik, pendaftaran, dan komisi.",
  "Bot pembuat materi promosi tersedia khusus untuk mitra — teks baru setiap kali dibutuhkan.",
  "Produk dan alat pendukungnya sudah disiapkan; fokus Anda tinggal menjangkau pemilik kos.",
  "Tersedia template pesan WhatsApp yang sopan untuk menawarkan produk ke pemilik properti.",
  "Dashboard kemitraan mencatat setiap klik dan transaksi secara transparan dan real-time.",
  "Anda mendapatkan link referral unik yang siap dibagikan lewat WhatsApp atau media sosial.",
  "Tim pusat menangani aktivasi lisensi, teknis, dan komplain — mitra cukup fokus promosi.",
  "Materi promosi rutin diperbarui mengikuti tren agar tetap relevan dan tidak membosankan.",
  "Seluruh bahan promosi telah disaring agar aman dari filter spam platform media sosial.",
  // Pasar luas
  "Jumlah kos dan kontrakan di Indonesia terus bertambah — pasarnya luas dan nyata.",
  "Hampir di setiap lingkungan ada pemilik kamar sewa yang butuh pembukuan yang rapi.",
  "Pemilik properti sewa umumnya langsung tertarik pada solusi penagihan otomatis via WhatsApp.",
  "Produknya menjawab keluhan klasik juragan kos: catatan hilang, tunggakan, dan rekap kas.",
  "Calon pembeli mudah ditemukan: mulai dari tetangga, kerabat, hingga komunitas properti.",
  "Permintaan sistem pengelolaan kost terus naik seiring makin banyaknya unit sewa baru.",
  "Satu lingkungan bisa berisi puluhan pemilik kos — semuanya calon pembeli potensial.",
  "Produk sekali bayar lebih mudah ditawarkan daripada layanan berlangganan bulanan.",
  "Software karya lokal ini dirancang sesuai kebiasaan juragan kos Indonesia — mudah diterima pasar.",
  "Pasar tidak terbatas kota: pemilik kos di mana pun bisa mengakses produk dari browser HP.",
  // Kemitraan resmi & transparan
  "Ini program kemitraan resmi, bukan skema berjenjang — komisi dibayar langsung per penjualan.",
  "Setiap komisi tercatat jelas di dashboard dan dapat Anda cek kapan saja dari HP.",
  "Status Anda sebagai mitra resmi tercatat, lengkap dengan link referral pribadi.",
  "Skema kemitraannya sederhana dan terbuka: tidak ada syarat tersembunyi di dalamnya.",
  "Pembeli mendapat software yang berguna, Anda menerima komisi yang sepadan — sama-sama untung.",
  "Pelaporan komisi dilakukan real-time sehingga Anda selalu tahu perkembangan promosi.",
  "Program ini mengutamakan hubungan jangka panjang: produknya benar-benar berguna bagi pembeli.",
  "Penarikan komisi mengikuti ketentuan yang jelas tanpa syarat yang berbelit-belit.",
  "Kemitraan yang sehat: produknya berkualitas, materinya profesional, imbalannya jelas.",
  "Rekomendasi yang tulus selalu diterima — Anda membantu pemilik kos sekaligus membangun penghasilan."
];

export const ADMIN_CONTEXTS = [
  // Model pembayaran & nilai inti
  "Ada software pengelolaan kost lokal yang sekali bayar dan aktif tanpa batas waktu — tanpa tagihan langganan bulanan.",
  "Produk digital pencatatan kamar dan tagihan WhatsApp otomatis yang sedang dicari banyak pemilik kontrakan.",
  "Aplikasi sederhana yang mengirim pengingat sewa ke WhatsApp penyewa secara otomatis, tanpa pemiliknya perlu menagih secara langsung.",
  "Sistem pembukuan kost modern tanpa potongan per kamar dan tanpa biaya langganan per bulan.",
  "Solusi yang merapikan catatan sewa dan kuitansi secara otomatis, mudah diterima oleh pemilik kos mana pun.",
  "Platform pengelola kontrakan praktis yang sekali dibeli bisa dipakai selama lisensi aktif langsung dari ponsel.",
  "Software pencatat kamar kosong dan kuitansi digital instan yang menjawab kebutuhan harian pemilik kos.",
  "Alat bantu rekap kas kost yang menggantikan buku tulis dan kuitansi kertas sepenuhnya.",
  "Sistem yang mengirim invoice resmi ke WhatsApp penyewa tepat pada tanggal jatuh tempo.",
  "Aplikasi manajemen kost yang ringan, tidak memenuhi memori ponsel, dan ramah digunakan oleh siapa saja.",
  // Fitur inti produk
  "Produk digital lokal yang membantu pemilik kos memantau puluhan kamar cukup dari satu layar ponsel.",
  "Perangkat praktis yang menghilangkan masalah kuitansi hilang dan salah hitung uang sewa kontrakan.",
  "Software kelola kost tanpa biaya langganan tahunan, sehingga biaya pengelolaan lebih terkendali.",
  "Sistem digital pencatat deposit, kamar kosong, dan pengeluaran listrik kost secara otomatis.",
  "Aplikasi pengatur sewa properti yang membuat usaha kontrakan keluarga tampak lebih profesional.",
  "Produk digital yang mempermudah pemilik kos menagih sewa secara tertib dan sopan.",
  "Aplikasi web modern yang menuntaskan rekap bulanan kost dalam hitungan menit.",
  "Sistem kuitansi digital resmi yang terbit otomatis begitu pembayaran sewa diterima.",
  "Software pengelola kosan yang memang dirancang mengikuti kebiasaan juragan kos di Indonesia.",
  "Solusi digital yang membuat pemilik kos bisa berlibur tenang tanpa memikirkan rekap sewa.",
  // Keuangan pemilik kos
  "Aplikasi yang merapikan catatan keuangan kost dan menghitung saldo bersih bulanan secara otomatis.",
  "Produk digital tanpa biaya admin per kamar — seluruh uang sewa tetap milik penuh pemiliknya.",
  "Software pembukuan kost yang bisa diakses bersama oleh suami istri atau keluarga.",
  "Sistem pengingat WhatsApp yang membantu penyewa membayar lebih tertib sebelum jatuh tempo.",
  "Aplikasi manajemen kontrakan yang menggantikan kebutuhan menyewa staf administrasi bulanan.",
  "Produk digital praktis yang menyelesaikan tiga masalah klasik juragan kos: penagihan, kuitansi, dan rekap kas.",
  "Sistem pemantauan kamar yang memperlihatkan status kosong atau terisi secara langsung.",
  "Software lokal berbayar sekali yang aktif permanen — model pembelian yang paling disukai pemilik kos.",
  "Aplikasi pencatat sewa yang membebaskan pemilik kos dari tunggakan yang tidak terpantau.",
  "Produk digital yang mengubah catatan buku manual menjadi dashboard digital yang rapi.",
  // Operasional harian
  "Sistem otomatisasi kost yang dapat dipakai untuk kontrakan tiga pintu hingga kostan seratus pintu.",
  "Aplikasi pengingat sewa berbahasa santun sehingga hubungan dengan penyewa tetap terjaga.",
  "Software yang membantu pemilik kos lanjut usia mengelola asetnya secara mandiri.",
  "Produk digital yang menyimpan data penyewa, nomor telepon, dan riwayat bayar secara aman di cloud.",
  "Sistem yang memisahkan pemasukan sewa dari biaya operasional perawatan kost secara otomatis.",
  "Aplikasi kelola kost yang lancar dijalankan dari ponsel kelas standar tanpa perlu laptop.",
  "Software yang menyediakan denah kamar interaktif untuk melihat status hunian dengan cepat.",
  "Produk digital yang membuat pengelolaan sewa berjalan otomatis tanpa pantauan langsung setiap hari.",
  "Sistem pencatatan sewa prorata untuk penyewa yang menempati kamar di tengah bulan.",
  "Aplikasi yang menyediakan arsip digital kuitansi pembayaran yang tidak dapat sobek maupun hilang.",
  // Profesionalitas & kepercayaan
  "Software pengelola kosan dengan tampilan bersih, bebas iklan, dan mudah dipahami pengguna awam.",
  "Produk digital yang meningkatkan kepercayaan calon penyewa lewat sistem tagihan dan kuitansi resmi.",
  "Sistem pengingat jatuh tempo H-3, H-1, dan hari-H yang terkirim otomatis ke WhatsApp penyewa.",
  "Aplikasi yang melindungi pemilik kos dari risiko kesalahan pencatatan setoran oleh penjaga.",
  "Software lokal karya anak bangsa yang solutif untuk operasional kost sehari-hari.",
  "Produk digital yang membuat pembagian hasil sewa keluarga menjadi transparan.",
  "Sistem yang membantu juragan kos memantau pengeluaran listrik dan air agar tetap terkendali.",
  "Aplikasi kelola kontrakan yang menghadirkan invoice resmi digital bagi penyewa.",
  "Software praktis tanpa instalasi dari Play Store — cukup dibuka lewat browser ponsel.",
  "Produk digital yang menjadi jawaban atas lelahnya penagihan uang sewa setiap awal bulan.",
  // Waktu & ketenangan pemilik
  "Sistem manajemen properti yang mengangkat kualitas usaha kost dibanding pengelolaan manual.",
  "Aplikasi yang mengamankan catatan kas dari risiko buku hilang atau rusak.",
  "Software yang memberi kendali penuh keuangan kontrakan kepada pemiliknya tanpa perantara.",
  "Produk digital yang membuat operasional puluhan kamar bisa dikelola satu orang.",
  "Sistem cerdas yang memperbarui status kamar menjadi terisi begitu pembayaran pertama terkonfirmasi.",
  "Aplikasi yang membantu pemilik kos melihat laporan pemasukan bulan ini dalam hitungan detik.",
  "Software yang menggantikan kebiasaan menulis kuitansi rangkap dua secara manual.",
  "Produk digital yang menghilangkan alasan penyewa lupa nomor rekening saat tanggal bayar.",
  "Sistem yang membebaskan pemilik kos dari administrasi harian yang berulang.",
  "Aplikasi pencatat sewa dengan harga terjangkau karena berbayar sekali saja.",
  // Multi unit & data aman
  "Software yang mendukung pengelolaan multi-kost: kost A, kost B, dan kontrakan C dalam satu akun.",
  "Produk digital yang melindungi pemilik kos dari kerugian penyewa yang pergi tanpa melunasi tunggakan.",
  "Sistem invoice WhatsApp yang mendorong penyewa membayar tepat waktu.",
  "Aplikasi yang memastikan catatan transfer cocok dengan nama penyewa yang bersangkutan.",
  "Software lokal yang lebih hemat dibanding berlangganan software manajemen ratusan ribu per bulan.",
  "Produk digital yang membuat pengelolaan kost semudah membalas pesan WhatsApp sehari-hari.",
  "Sistem yang membantu pemilik kos mengenali kamar yang paling sering kosong untuk evaluasi harga.",
  "Aplikasi yang mencatat inventaris fasilitas kamar seperti kasur, lemari, dan AC.",
  "Software pengatur kontrakan yang menenangkan pemiliknya saat memasuki masa pergantian penyewa.",
  "Produk digital yang menyediakan laporan kas yang dapat diekspor ke Excel atau PDF kapan pun.",
  // Relasi & kedisiplinan
  "Sistem yang membuat kost terkelola profesional sehingga nyaman bagi penyewa.",
  "Aplikasi yang membantu rekap sewa harian, mingguan, bulanan, hingga tahunan secara fleksibel.",
  "Software manajemen kostan yang tidak mengambil potongan sepeser pun dari uang sewa.",
  "Produk digital yang memberi pemilik kos lebih banyak waktu bersama keluarga.",
  "Sistem pengingat sewa berbahasa ramah yang tidak menyinggung perasaan penyewa.",
  "Aplikasi yang membuat urusan sewa-menyewa berjalan tertib dan minim komplain.",
  "Software lokal dengan infrastruktur server yang cepat, aman, dan tersimpan otomatis.",
  "Produk digital yang membebaskan pemilik kos dari membawa buku catatan tebal saat memantau unit.",
  "Sistem yang membuat rekap tahunan kostan menjadi proses yang jauh lebih ringan.",
  "Aplikasi yang menyiapkan pembukuan kost agar tertata rapi dan siap dilanjutkan generasi berikutnya.",
  // Harmoni & mutasi data
  "Software yang membuat hubungan pemilik kos dan penyewa lebih harmonis tanpa perselisihan soal pembayaran.",
  "Produk digital yang mencatat pembayaran cicilan penyewa secara rapi tanpa sisa yang terlewat.",
  "Sistem pencatat sewa yang mudah dipakai bahkan oleh pengguna ponsel yang baru pertama kali.",
  "Aplikasi yang menuntaskan pengelolaan komplain fasilitas kost secara terdokumentasi.",
  "Software lokal yang membuat calon pembeli langsung menyadari manfaatnya sejak demo pertama.",
  "Produk digital yang mencegah data sewa hilang saat pemilik kos berganti ponsel baru.",
  "Sistem yang mempercepat verifikasi transfer penyewa tanpa membuka aplikasi mobile banking berulang kali.",
  "Aplikasi yang menyetarakan pengelolaan kontrakan kecil dengan standar manajemen kos eksklusif.",
  "Software yang menenangkan pemilik properti yang rumahnya berjauhan dengan lokasi kost.",
  "Produk digital yang membuat usaha kosan selalu selangkah lebih maju dibanding pengelolaan manual.",
  // Penutup nilai produk
  "Sistem pengingat otomatis yang membuat penyewa lebih disiplin namun tetap merasa dihargai.",
  "Aplikasi yang merapikan pembukuan kostan dari nol hingga laporan akhir tahun.",
  "Software manajemen properti yang menambah kebanggaan pemiliknya karena serba digital.",
  "Produk digital paling dicari pemilik kos saat ini karena bebas biaya bulanan selamanya.",
  "Sistem yang membantu juragan kontrakan mengelola deposit penyewa secara transparan.",
  "Aplikasi kelola kos yang benar-benar meringankan beban penagihan manual pemiliknya.",
  "Software lokal praktis yang membuat urusan bisnis properti sewa terasa lebih ringan.",
  "Produk digital yang membuat pemilik kontrakan langsung tertarik begitu melihat demonya.",
  "Sistem manajemen kos terintegrasi yang membuat operasional sewa properti berjalan mulus.",
  "Aplikasi pengatur sewa kamar yang menghadirkan ketenangan bagi juragan kos dalam mengelola unitnya."
];

export const ADMIN_VALUES = [
  // Komisi jelas & terukur
  "✅ Komisi Rp150.000 per lisensi yang terjual melalui link referral Anda.",
  "✅ Skema imbalan flat — satu pendaftaran bernilai Rp150.000 tanpa perhitungan berjenjang.",
  "✅ Sepuluh lisensi terjual dalam sebulan berarti tambahan Rp1,5 juta yang tercatat di dashboard.",
  "✅ Nilai komisi per transaksi lebih besar dibanding program afiliasi produk fisik pada umumnya.",
  "✅ Tidak ada target bulanan — ritme promosi sepenuhnya Anda yang menentukan.",
  "✅ Setiap pendaftaran tervalidasi langsung tercatat sebagai hak komisi Anda.",
  "✅ Komisi dibayarkan sesuai ketentuan yang jelas, tanpa potongan tersembunyi.",
  "✅ Angka komisinya transparan dan dapat Anda cek sendiri dari dashboard mitra.",
  "✅ Tidak ada batas maksimal lisensi yang bisa Anda pasarkan.",
  "✅ Simulasi sederhana: 3 pendaftaran per hari bernilai Rp450.000 komisi.",
  // Tanpa biaya & risiko rendah
  "✅ Pendaftaran mitra tanpa biaya — tidak ada iuran awal maupun bulanan.",
  "✅ Anda tidak perlu membeli produk terlebih dahulu untuk memasarkannya.",
  "✅ Tidak ada investasi stok, gudang, maupun modal usaha yang dituntut.",
  "✅ Seluruh biaya aktivasi lisensi ditanggung tim pusat, bukan mitra.",
  "✅ Risiko kemitraan rendah: keluar kapan pun tanpa penalti apa pun.",
  "✅ Program ini bukan skema berjenjang — imbalan dibayar langsung per penjualan.",
  "✅ Tidak ada biaya tersembunyi di balik status kemitraan Anda.",
  "✅ Ketentuan komisi tertulis jelas sejak Anda mendaftar.",
  "✅ Anda cukup fokus mempromosikan; sisanya ditangani sistem dan tim pusat.",
  "✅ Pendaftaran terbuka untuk siapa pun tanpa syarat pengalaman.",
  // Produk & materi disediakan
  "✅ Produk yang dipasarkan adalah software pengelolaan kos yang memang dibutuhkan pasar.",
  "✅ Materi promosi siap pakai tersedia lengkap untuk setiap mitra.",
  "✅ Bot pembuat materi promosi khusus mitra menghasilkan teks baru setiap kali dibutuhkan.",
  "✅ Tersedia template pesan WhatsApp sopan untuk menawarkan produk ke pemilik properti.",
  "✅ Web demo produk siap menjelaskan fiturnya sendiri kepada calon pembeli.",
  "✅ Materi promosi rutin diperbarui agar tawaran tetap terasa segar.",
  "✅ Seluruh bahan promosi telah disesuaikan standar moderasi platform media sosial.",
  "✅ Panduan memulai kemitraan tersedia langkah demi langkah untuk mitra pemula.",
  "✅ Tim pusat menangani aktivasi, dukungan teknis, dan komplain pembeli.",
  "✅ Mitra tidak perlu menyiapkan apa pun — produk dan pendukungnya sudah disediakan.",
  // Transparan via dashboard
  "✅ Dashboard kemitraan mencatat klik, pendaftaran, dan komisi secara real-time.",
  "✅ Setiap transaksi lewat link referral tercatat otomatis sebagai hak Anda.",
  "✅ Status komisi dapat diperiksa kapan saja langsung dari ponsel.",
  "✅ Pelaporan transparan — tidak ada perhitungan yang disembunyikan dari mitra.",
  "✅ Riwayat pendaftaran bisa Anda telusuri per tanggal di dashboard.",
  "✅ Penarikan komisi mengikuti ketentuan yang jelas dan terdokumentasi.",
  "✅ Notifikasi perkembangan promosi membantu Anda mengevaluasi strategi.",
  "✅ Statistik klik membantu Anda tahu materi promosi mana yang paling efektif.",
  "✅ Link referral unik memastikan setiap transaksi terhitung untuk Anda.",
  "✅ Seluruh data kemitraan tersimpan aman dan hanya dapat diakses akun Anda.",
  // Fleksibilitas
  "✅ Kemitraan bisa dijalankan dari mana saja cukup dengan ponsel.",
  "✅ Tidak ada jam kerja wajib — promosikan sesuai waktu luang Anda.",
  "✅ Cocok dijalankan sela pekerjaan utama atau aktivitas keluarga.",
  "✅ Tidak ada lokasi wajib; Anda bisa menjangkau pemilik kos di kota mana pun.",
  "✅ Cuaca dan lalu lintas tidak memengaruhi aktivitas kemitraan sama sekali.",
  "✅ Aktivitas harian mitra ringan: menyalin materi, membagikan link, memantau hasil.",
  "✅ Anda memegang kendali penuh atas strategi promosi Anda sendiri.",
  "✅ Bisa dimulai santai dan ditingkatkan bertahap sesuai hasil yang terlihat.",
  "✅ Tidak ada ikatan kontrak kerja — status kemitraan fleksibel dan jelas.",
  "✅ Waktu yang dibutuhkan bisa sesedikit sepuluh menit per hari.",
  // Pasar & produk kuat
  "✅ Pasarnya nyata: jumlah kos dan kontrakan di Indonesia terus bertumbuh.",
  "✅ Produk menjawab keluhan klasik pemilik kos: pencatatan, tagihan, dan rekap kas.",
  "✅ Sekali bayar tanpa biaya bulanan membuat produk lebih mudah ditawarkan.",
  "✅ Software karya lokal yang dirancang sesuai kebiasaan juragan kos Indonesia.",
  "✅ Calon pembeli mudah ditemukan di lingkungan, komunitas, dan grup WhatsApp.",
  "✅ Tidak ada potongan komisi sewa bagi pengguna — nilai produknya makin kuat.",
  "✅ Produk berbasis web ringan: cukup dibuka dari browser ponsel pembeli.",
  "✅ Fitur unggulan seperti tagihan WhatsApp otomatis mudah dijelaskan ke siapa pun.",
  "✅ Satu rekomendasi yang berhasil sering berlanjut ke kenalan si pembeli.",
  "✅ Pasar tidak terbatas satu kota — produk dapat diakses dari mana saja.",
  // Dukungan tim pusat
  "✅ Dukungan tim pusat tersedia untuk pertanyaan teknis maupun strategi promosi.",
  "✅ Mitra tidak menangani dukungan teknis pembeli — semuanya diurus tim pusat.",
  "✅ Pertanyaan calon pembeli bisa Anda alihkan ke materi demo yang tersedia.",
  "✅ Komplain pembeli ditangani penuh oleh tim pusat, bukan oleh mitra.",
  "✅ Panduan menjawab pertanyaan umum tersedia untuk membantu percakapan Anda.",
  "✅ Anda tidak perlu memahami sisi teknis aplikasi untuk memasarkannya.",
  "✅ Tim pusat mengurus aktivasi lisensi sejak pembeli menyelesaikan pendaftaran.",
  "✅ Materi pembuka percakapan profesional membantu Anda terlihat kredibel.",
  "✅ Ada bot Telegram khusus mitra untuk mengambil materi promosi kapan pun.",
  "✅ Komunitas mitra saling berbagi pengalaman dan strategi promosi yang berhasil.",
  // Kemitraan sehat
  "✅ Program resmi dengan ketentuan tertulis yang dapat Anda baca sebelum bergabung.",
  "✅ Pembeli mendapat software berguna; Anda menerima imbalan yang sepadan.",
  "✅ Hubungan kemitraan berbasis produk yang benar-benar menyelesaikan masalah.",
  "✅ Tidak ada janji penghasilan instan — yang ada skema imbalan yang jelas.",
  "✅ Rekomendasi Anda bernilai: membantu pemilik kos sekaligus menambah pendapatan.",
  "✅ Ketentuan penarikan komisi dirancang tanpa syarat yang berbelit-belit.",
  "✅ Status mitra resmi tercatat dengan link referral pribadi Anda.",
  "✅ Program mengutamakan hubungan jangka panjang, bukan penjualan sekali jadi.",
  "✅ Promosi dilakukan secara profesional sehingga menjaga reputasi Anda sendiri.",
  "✅ Semua materi sudah disaring agar aman dibagikan ke grup keluarga maupun komunitas.",
  // Nilai produk konkret
  "✅ Produk menagih sewa otomatis lewat WhatsApp dengan bahasa yang sopan.",
  "✅ Kuitansi digital resmi terbit otomatis setiap pembayaran diterima.",
  "✅ Denah kamar visual memperlihatkan status terisi dan kosong secara langsung.",
  "✅ Laporan kas bulanan tersusun otomatis tanpa perlu kalkulator.",
  "✅ Multi-pengguna: pemilik dan penjaga kos bisa mengakses bersama.",
  "✅ Data penghuni dan riwayat bayar tersimpan aman di cloud.",
  "✅ Cocok untuk skala kecil hingga ratusan kamar dalam satu akun.",
  "✅ Tanpa instalasi aplikasi berat — cukup browser di ponsel.",
  "✅ Pengingat jatuh tempo H-3, H-1, dan hari-H berjalan otomatis.",
  "✅ Rekap pendapatan per properti tersaji rapi untuk pemilik multi-unit.",
  // Motivasi profesional
  "✅ Komisi Rp150.000 per lisensi adalah imbalan yang layak untuk kemitraan produk digital.",
  "✅ Setiap rekomendasi yang berhasil berarti membantu satu pemilik kos lebih tertata.",
  "✅ Penghasilan tambahan dibangun dari kebiasaan sederhana yang konsisten.",
  "✅ Anda membangun keterampilan promosi yang berguna jangka panjang.",
  "✅ Kemitraan ini bisa menjadi penghasilan kedua yang stabil bila dijalankan rutin.",
  "✅ Semua langkah terukur: dari membagikan link hingga melihat komisi masuk di dashboard.",
  "✅ Anda bekerja mandiri namun tidak pernah berjalan sendiri — dukungan selalu tersedia.",
  "✅ Materi promosi profesional menjaga percakapan Anda tetap sopan dan meyakinkan.",
  "✅ Skema kemitraan ini dirancang agar semua pihak memperoleh manfaatnya.",
  "✅ Bergabung hari ini, dan materi pertama Anda bisa langsung disalin dari dashboard."
];

export const ADMIN_CTAS = [
  // Aksi langsung
  "Penasaran dengan program kemitraan ini? Tinggalkan komentar 'MAU' — detail lengkapnya kami kirim melalui pesan pribadi.",
  "Tinggalkan komentar 'MINAT' di bawah, dan tim kami akan mengirimkan informasi kemitraan langsung ke pesan Anda.",
  "Yang ingin bergabung sebagai mitra, cukup komentar 'MAU' — tautan pendaftarannya kami kirimkan via inbox.",
  "Ketik 'MAU' di kolom komentar untuk menerima tautan pendaftaran mitra secara resmi.",
  "Komentar 'MINAT' ya, kami akan menjelaskan langkah pendaftarannya satu per satu melalui pesan pribadi.",
  "Ketik 'MAU' sekarang — panduan singkat beserta tautan pendaftaran langsung kami kirimkan.",
  "Yang berminat memeriksa detail programnya, silakan komentar 'MAU' dan kami hubungi lewat DM.",
  "Tulis 'MINAT' di komentar, nanti kami kirimkan ringkasan program dan tautan pendaftarannya.",
  "Komentar 'MAU' di bawah untuk mendapatkan akses dashboard kemitraan beserta panduannya.",
  "Silakan ketik 'MINAT' — informasi lengkapnya kami sampaikan secara pribadi tanpa mengganggu kolom komentar.",
  // Fokus produk
  "Mau tahu produk digital apa yang sedang dibutuhkan pemilik kos di seluruh Indonesia? Komentar 'MAU', kami jelaskan lewat DM.",
  "Ingin melihat dulu contoh produknya sebelum bergabung? Komentar 'MINAT' — kami kirimkan tautan demonya.",
  "Ketik 'MAU' untuk mendapatkan contoh materi promosi yang nantinya Anda gunakan.",
  "Komentar 'MINAT' ya, kami kirimkan penjelasan produk beserta skema komisinya secara lengkap.",
  "Yang penasaran bagaimana produk ini bekerja, ketik 'MAU' — demo langsung kami kirimkan lewat pesan.",
  "Komentar 'MAU' untuk menerima penjelasan singkat cara kerja program kemitraannya.",
  "Silakan tulis 'MINAT' di bawah — kami jelaskan mengapa produk ini mudah ditawarkan ke pemilik kos.",
  "Ketik 'MAU' dan kami akan mengirimkan contoh hasil generator materi promosi mitranya.",
  "Komentar 'MINAT' jika Anda ingin memahami dulu skema kemitraannya sebelum memutuskan.",
  "Yang ingin mengetahui profil pembelinya, ketik 'MAU' — kami kirimkan gambaran pasarnya lewat inbox.",
  // Proses pendaftaran
  "Proses pendaftarannya singkat: komentar 'MAU', terima tautan, lalu mulai bagikan link referral Anda.",
  "Komentar 'MINAT' — pendaftaran mitra tidak dipungut biaya dan panduannya kami kirimkan.",
  "Ketik 'MAU' di bawah, nanti kami pandu langkah demi langkah hingga link referral Anda aktif.",
  "Tulis 'MINAT' untuk mendapatkan tautan pendaftaran resmi beserta panduan memulainya.",
  "Komentar 'MAU' ya — tim kami akan mengirimkan tautan pendaftaran dan materi promosi awal.",
  "Ketik 'MINAT' sekarang; pendaftarannya tidak dipungut biaya dan prosesnya hanya beberapa menit.",
  "Yang siap memulai, silakan komentar 'MAU' — akun kemitraan Anda kami bantu aktifkan.",
  "Komentar 'MINAT' di bawah, nanti kami kirimkan checklist langkah memulai kemitraan.",
  "Ketik 'MAU' untuk langsung menerima tautan dashboard kemitraan beserta panduan pemula.",
  "Tulis 'MINAT' — kami kirimkan semua yang Anda butuhkan untuk memulai hari ini juga.",
  // Info komisi
  "Ingin tahu rincian skema komisi Rp150.000 per lisensinya? Komentar 'MAU', kami jelaskan lewat pesan.",
  "Ketik 'MINAT' untuk menerima simulasi komisi beserta ketentuan pencairannya.",
  "Komentar 'MAU' ya — rincian nilai komisi dan cara penarikannya kami kirimkan via inbox.",
  "Yang ingin memahami perhitungan komisinya, ketik 'MAU' — kami jelaskan dengan contoh nyata.",
  "Komentar 'MINAT' untuk mendapatkan penjelasan skema imbalan yang transparan.",
  "Ketik 'MAU' — kami kirimkan rincian komisi per lisensi dan ketentuannya secara jelas.",
  "Komentar 'MAU' di bawah, nanti kami jelaskan bagaimana komisi tercatat di dashboard Anda.",
  "Silakan tulis 'MINAT' — penjelasan skema komisinya kami sampaikan pribadi agar lebih rinci.",
  "Ketik 'MAU' untuk menerima tabel simulasi komisi mingguan dan bulanannya.",
  "Komentar 'MINAT' ya, kami kirimkan ketentuan komisi lengkap sebelum Anda memutuskan.",
  // Materi promosi
  "Butuh bahan promosi siap pakai untuk rekrutmen? Komentar 'MAU' — contoh materinya kami kirimkan.",
  "Ketik 'MINAT' untuk menerima contoh materi promosi yang telah disaring dan aman dari filter spam.",
  "Komentar 'MAU' di bawah, nanti kami kirimkan contoh template pesan penawaran untuk pemilik kos.",
  "Yang ingin melihat bot pembuat materi promosinya, ketik 'MINAT' — kami perkenalkan lewat DM.",
  "Komentar 'MAU' — Anda akan menerima paket materi pembuka percakapan yang profesional.",
  "Tulis 'MINAT' di bawah untuk mendapatkan template chat WhatsApp yang siap digunakan.",
  "Ketik 'MAU' ya, kami kirimkan pratinjau materi promosi yang tersedia untuk setiap mitra.",
  "Komentar 'MINAT' — materi promosi rutin diperbarui dan tinggal Anda salin serta bagikan.",
  "Silakan ketik 'MAU' untuk melihat contoh status promosi yang aman diposting di media sosial.",
  "Komentar 'MAU' di bawah ya — kami kirimkan contoh teks penawaran yang sudah teruji.",
  // Pasar & target
  "Punya kenalan pemilik kos atau kontrakan? Komentar 'MAU' dan kami bantu Anda memulai dari sana.",
  "Ketik 'MINAT' — kami kirimkan panduan menemukan calon pembeli di lingkungan sekitar Anda.",
  "Komentar 'MAU' untuk menerima tips memperkenalkan produk ke pemilik properti secara santun.",
  "Yang aktif di komunitas warga, ketik 'MINAT' — strategi promosinya kami jelaskan lewat inbox.",
  "Komentar 'MINAT' ya, kami kirimkan contoh percakapan pendek yang berhasil mengantar closing.",
  "Ketik 'MAU' — kami kirimkan panduan memetakan kenalan yang cocok dengan produk ini.",
  "Komentar 'MAU' di bawah, nanti kami bagikan strategi promosi sederhana untuk pemula.",
  "Tulis 'MINAT' untuk menerima panduan menjangkau pemilik kos lewat grup WhatsApp komunitas.",
  "Ketik 'MAU' — kami jelaskan mengapa lingkungan Anda kemungkinan besar penuh calon pembeli.",
  "Komentar 'MINAT' di bawah, kami kirimkan teknik follow-up yang sopan dan efektif.",
  // Kemitraan resmi
  "Ingin memastikan ini kemitraan resmi? Komentar 'MAU' — profil programnya kami kirimkan lewat DM.",
  "Ketik 'MINAT' untuk menerima penjelasan ketentuan kemitraan secara transparan.",
  "Komentar 'MAU' ya — kami kirimkan ringkasan program, hak mitra, dan dukungan yang tersedia.",
  "Yang ingin memahami tanggung jawab mitra, ketik 'MAU' — kami jelaskan detailnya via pesan.",
  "Komentar 'MINAT' — kami kirimkan ketentuan lengkap tanpa syarat tersembunyi.",
  "Ketik 'MAU' di bawah untuk menerima gambaran lengkap program kemitraan afiliasi ini.",
  "Komentar 'MAU' sekarang — tim kami siap menjawab pertanyaan Anda satu per satu via inbox.",
  "Tulis 'MINAT' untuk menerima dokumen ringkasan program kemitraannya.",
  "Silakan ketik 'MAU' — kami akan mengirimkan penjelasan hubungan mitra dengan tim pusat.",
  "Komentar 'MINAT' ya, kami jelaskan bagaimana dukungan tim pusat bekerja untuk mitra.",
  // Dashboard & pelaporan
  "Ingin melihat tampilan dashboard kemitraannya? Komentar 'MAU' — tangkapan layarnya kami kirim.",
  "Ketik 'MINAT' untuk mengetahui bagaimana klik dan komisi Anda tercatat secara otomatis.",
  "Komentar 'MAU' — kami kirimkan penjelasan fitur dashboard mitra beserta fungsinya.",
  "Yang ingin memantau hasil promosi secara transparan, ketik 'MINAT' — kami jelaskan via DM.",
  "Komentar 'MAU' di bawah, nanti kami perlihatkan cara kerja pelaporan komisi real-time.",
  "Tulis 'MINAT' — kami kirimkan contoh dashboard dan cara membaca statistiknya.",
  "Ketik 'MAU' ya, kami kirimkan gambaran alur: link diklik, pembeli daftar, komisi tercatat.",
  "Komentar 'MINAT' untuk memahami bagaimana setiap transaksi tercatat menjadi hak Anda.",
  "Silakan ketik 'MAU' — penjelasan sistem pelaporannya kami sampaikan lewat pesan pribadi.",
  "Komentar 'MAU' di bawah ya, kami kirimkan contoh laporan komisi yang terlihat mitra.",
  // Undangan lembut
  "Ada pertanyaan seputar program ini? Komentar 'MAU' atau 'MINAT' — kami balas satu per satu.",
  "Ketik 'MAU' di komentar, dan seluruh penjelasan kami sampaikan langsung lewat pesan pribadi.",
  "Komentar 'MINAT' ya — tidak perlu bertanya panjang di kolom komentar, kami jelaskan via DM.",
  "Yang masih mempertimbangkan, ketik 'MAU' — informasinya kami kirim dulu untuk Anda baca.",
  "Komentar 'MAU' di bawah, nanti materi pembuka percakapan kami kirimkan langsung ke inbox.",
  "Tulis 'MINAT' sekarang — pendaftaran mitra terbuka dan panduannya kami siapkan.",
  "Ketik 'MAU' ya kak, informasi program kemitraan ini kami kirimkan secara pribadi.",
  "Komentar 'MINAT' di bawah — kami akan mengirimkan informasi tanpa memaksa dan tanpa spam.",
  "Silakan ketik 'MAU' — keputusan tetap di tangan Anda, kami hanya mengirimkan informasinya.",
  "Komentar 'MAU' di bawah untuk menerima penjelasan yang jelas, rinci, dan tanpa tekanan.",
  // Penutup
  "Program kemitraan ini terbuka untuk siapa saja yang punya jaringan pemilik properti. Komentar 'MAU' untuk memulai.",
  "Ketik 'MINAT' — slot kemitraan terbuka dan pendaftarannya tidak dipungut biaya.",
  "Komentar 'MAU' sekarang, dan besok Anda sudah bisa mulai membagikan link referral sendiri.",
  "Yang ingin penghasilan tambahan yang terukur, ketik 'MINAT' — langkah awalnya kami kirim via inbox.",
  "Komentar 'MAU' di bawah ya — kami kirimkan tautan pendaftaran beserta materi pembuka.",
  "Tulis 'MINAT' untuk bergabung dengan program kemitraan afiliasi yang transparan dan terdokumentasi.",
  "Ketik 'MAU' — panduan memulai, materi promosi, dan dashboard komisi kami kirimkan sekaligus.",
  "Komentar 'MINAT' di bawah, tim kami akan menghubungi Anda dengan penjelasan yang lengkap.",
  "Silakan ketik 'MAU' — mulai hari ini juga dengan panduan yang jelas dan dukungan penuh.",
  "Komentar 'MAU' atau 'MINAT' di bawah, dan semua informasi kemitraan kami kirimkan melalui pesan pribadi."
];

export const ADMIN_DM_TEMPLATES = [
  `Halo kak! Terima kasih sudah merespons postingan soal kemitraan produk digital tadi ya 🙏\n\nSingkatnya begini kak: produknya adalah software manajemen kosan & kontrakan (tagihan WhatsApp otomatis, kuitansi digital, sekali bayar tanpa biaya bulanan).\n\n✅ Komisi Rp150.000 per lisensi yang terjual.\n✅ Pendaftaran mitra tanpa biaya.\n\nAmbil link referral dan buka dashboard kemitraan Anda di sini ya kak:\n👉 https://unitku.my.id/affiliate`,

  `Siap kak! Ini detail program kemitraan yang tadi:\n\nProduk yang dipasarkan adalah aplikasi pengelola kosan lokal yang banyak dicari pemilik kontrakan karena tanpa biaya langganan bulanan. Anda cukup membagikan link referral ke kenalan atau grup yang berisi pemilik kos.\n\nSetiap pendaftaran lewat link Anda bernilai komisi Rp150.000 per lisensi.\n\nDaftar tanpa biaya dan ambil link referral Anda di:\n👉 https://unitku.my.id/affiliate`,

  `Halo kak, program kemitraannya sederhana dan jelas ya.\n\nTidak perlu menjual barang fisik, tidak ada urusan packing atau pengiriman paket. Cukup rekomendasikan sistem manajemen kosan ini ke pemilik properti sewa di sekitar kita.\n\nKeuntungan Anda:\n- Komisi Rp150.000 per lisensi\n- Dashboard pemantauan komisi mandiri\n- Bot pembuat materi promosi otomatis\n\nAktivasi akun mitra tanpa biaya, langsung daftar di sini kak:\n👉 https://unitku.my.id/affiliate`,

  `Halo kak! Terima kasih sudah berkomentar di postingan tadi ya.\n\nProgramnya sederhana: kami punya produk digital untuk membantu juragan kosan merapikan rekap sewa dan tagihan otomatis via WhatsApp. Pasarnya luas di sekitar kita.\n\nAnda cukup membagikan link, setiap transaksi bernilai komisi Rp150.000 per lisensi.\n\nSilakan daftar dan ambil linknya di:\n👉 https://unitku.my.id/affiliate`,

  `Siap kak, izin menjelaskan singkat ya:\nIni program kemitraan afiliasi produk digital software kosan lokal. Produknya mudah diterima juragan kos karena bayar sekali dan aktif tanpa tagihan bulanan.\n\nKomisi Rp150.000 per penjualan. Pendaftaran mitra tanpa biaya.\n\nSilakan cek detail dan buat link referral Anda di sini ya kak:\n👉 https://unitku.my.id/affiliate`
];

// ─────────────────────────────────────────────────────────────────────────────
// BANK REKRUTMEN — AJAK MITRA (dipindahkan dari src/data/affiliateCopies.ts)
//
// Struktur baku materi rekrutmen (dikonsumsi bot admin @unitku_promogen_bot
// via callback "gen_rekrut", output dibungkus <pre><code class="language-copy">):
//   Baris 1  : Hook peluang (pertanyaan + emoji)              → theme.hooks
//   Baris 2  : Penjelasan & simulasi komisi konkret           → theme.calculations
//              (standar: komisi Rp150.000 per lisensi; simulasi 3 pendaftaran/
//               hari = Rp450.000; seminggu Rp3,15 juta; sebulan Rp13,5 juta)
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
//   IBU_RUMAH_TANGGA  → ibu rumah tangga, promosi dari HP sela waktu
//   PELUANG_UMUM      → jobseeker/umum, tanpa syarat pengalaman
//   OJOL_DRIVER       → driver ojol, penghasilan tambahan sela orderan
// ─────────────────────────────────────────────────────────────────────────────

export interface RecruitmentTheme {
  category: string;
  hooks: string[];
  calculations: string[];
  checklist: string[];
  ctas: string[];
}

export const ADMIN_REKRUTMEN_THEMES: RecruitmentTheme[] = [
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
      "✅ Pendaftaran mitra tanpa biaya awal",
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

/** Gabungkan satu tema rekrutmen menjadi materi utuh:
 *  Hook → Penjelasan & simulasi komisi → 5 poin checklist ✅ → CTA pendaftaran. */
export function getRandomRecruitmentCopy(): string {
  // 1. Pilih tema rekrutmen secara acak
  const theme = ADMIN_REKRUTMEN_THEMES[Math.floor(Math.random() * ADMIN_REKRUTMEN_THEMES.length)];

  // 2. Ambil elemen acak DARI TEMA YANG SAMA (alur peluang → hitungan →
  //    keuntungan → CTA selalu nyambung satu sudut pandang)
  const hook = theme.hooks[Math.floor(Math.random() * theme.hooks.length)];
  const calculation = theme.calculations[Math.floor(Math.random() * theme.calculations.length)];
  const checklistText = theme.checklist.join("\n");
  const cta = theme.ctas[Math.floor(Math.random() * theme.ctas.length)];

  return `${hook}\n\n${calculation}\n\n${checklistText}\n\n${cta}`;
}
