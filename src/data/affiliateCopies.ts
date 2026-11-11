// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Bank data copywriting promosi mitra (bot Telegram @unitku_mitra_bot)
//
// Materi acak kategori "Acak Status Medsos" dengan struktur 4 lapis:
//   HOOKS        pembuka perhatian (pertanyaan/emoji)
//   PAIN_STORIES  cerita kesulitan kelola properti manual
//   BENEFITS     keunggulan UnitKu (bullet ✅)
//   CTAS         ajakan klik + placeholder [MASUKKAN_LINK_REFERRAL_ANDA]
//
// getRandomAffiliateCopy() merangkai satu materi utuh — hook, pain, benefit,
// dan CTA masing-masing diacak independen (25⁴ ≈ 390 ribu kombinasi). Dipakai
// handler /api/telegram/mitra-promo-bot (callback "mitra_promo").
// ─────────────────────────────────────────────────────────────────────────────

export const HOOKS = [
  "Masih mengelola kost atau kontrakan pakai buku catatan? 🫣",
  "Sering ngerasa gak enakan pas nagih sewa kamar kost? 😮‍💨",
  "Catatan uang sewa kost di buku sering ketumpahan kopi atau tercecer? ☕📖",
  "Punya kost, kontrakan pintu, paviliun, sampai kios usaha? 🏠",
  "Kelola bisnis sewa properti gak harus standby tiap hari di lokasi. ☕",
  "Kamar kost kosong berbulan-bulan bikin potensi pemasukan melayang? 📉",
  "Anak kost beralasan 'lupa bayar' tiap kali ditagih uang sewa? 🙄",
  "Buku catatan tebal, tapi pas dicari riwayat pembayarannya malah bikin pusing? 😵‍💫",
  "Berapa kerugian Anda tiap bulan kalau kamar kost dibiarkan menganggur? 💸",
  "Mau kembangkan bisnis properti tapi takut manajemennya keteteran? 📈",
  "Capek ditanya calon penyewa fasilitas apa saja yang masih kosong? 💬",
  "Uang sewa kost masuk, tapi kok saldo tabungan gak nambah-nambah? 🧐",
  "Malam-malam masih pusing rekap uang kas kost yang selisih? 🌙",
  "Pernah kejadian kamar kosong ditempati diam-diam tanpa izin? 🚪",
  "Nagih sewa kost rasa nagih utang pribadi ke teman sendiri? 🤦‍♂️",
  "Punya banyak unit tapi berasa kerja rodi ngurus operasionalnya? 🏃‍♂️",
  "Anak kost malas install aplikasi baru yang menuh-menuhin memori HP? 📱❌",
  "Takut dicap galak cuma gara-gara nagih hak uang sewa tempat sendiri? 😅",
  "Buku rekap kas basah atau sobek, pusingnya minta ampun! 🌧️",
  "Mau liburan bareng keluarga tanpa diteror urusan kunci dan sewa kost? 🏖️",
  "Berapa jam waktu Anda terbuang percuma tiap bulan cuma buat rekap manual? ⏳",
  "Sering lupa nomor kamar mana yang masa sewanya habis minggu ini? 🗓️",
  "Dapat laporan dari penjaga kost tapi angkanya sering gak masuk akal? 🕵️‍♂️",
  "Potongan komisi aplikasi booking online bikin untung sewa makin tipis? ✂️💵",
  "Bisnis sewa properti harusnya bikin tenang, bukan malah bikin darah tinggi! 🧘‍♂️",
];

export const PAIN_STORIES = [
  "Semakin banyak unit, semakin pusing mengecek pembayaran, kamar kosong, dan data tagihan penghuni.",
  "Catatan di buku sering tercecer, giliran jatuh tempo malah lupa, pas ditagih alasannya dicicil dua kali sampai hitungan kas berantakan.",
  "Giliran akhir bulan, pusing sendiri mencocokkan siapa yang sudah bayar dan siapa yang masih punya tunggakan.",
  "Kelola unit yang berbeda jenis gak perlu bikin catatan terpisah yang bikin pusing kepala.",
  "Mau lagi liburan atau sibuk kerjaan utama, pantau keluar masuk penyewa dan uang sewa harus tetap aman.",
  "Mau pasang iklan di sosmed tapi bingung menyusun kata-kata promosi yang menarik minat calon penyewa?",
  "Pencatatan manual rentan bikin selisih uang kas dan memicu salah paham dengan anak kost.",
  "Tanpa sistem terpusat, pengawasan uang sewa dan pengeluaran operasional sangat rawan kebocoran dana.",
  "Pencatatan pembayaran parsial sering jadi sumber masalah antara pemilik kost dan penyewa.",
  "Waktu berharga Anda mestinya dipakai buat kembangin aset, bukan jadi penagih tagihan manual.",
  "Kwitansi kertas gampang hilang, giliran ada komplain pembayaran jadi bingung cari bukti fisiknya.",
  "Sudah capek kerja seharian, malam hari masih harus meladeni chat komplain dan konfirmasi transferan.",
  "Uang sewa tercampur dengan uang belanja harian sampai tidak tahu bisnis untung atau buntung.",
  "Mengandalkan ingatan kepala untuk puluhan tanggal jatuh tempo cuma bikin stres berkepanjangan.",
  "Penghuni sering menunda pembayaran karena sistem penagihan yang tidak terjadwal rapi.",
  "Calon penyewa kabur ke tempat lain hanya karena kita lambat merespons ketersediaan kamar.",
  "Bingung menentukan harga sewa yang pas karena tidak pernah tahu rekap pengeluaran riil per pintu.",
  "Sistem lama yang manual membuat bisnis properti Anda sulit berkembang dan membuka cabang baru.",
  "Penjaga kost kewalahan mencatat tamu dan penghuni baru tanpa panduan denah yang jelas.",
  "Biaya perbaikan pompa, listrik, dan kebersihan membengkak tanpa riwayat pencatatan yang jelas.",
  "Penyewa sering beralasan tidak dapat info tagihan padahal waktu sewa sudah lewat berminggu-minggu.",
  "Ribet kirim nomor rekening berulang-ulang setiap kali tiba masa perpanjangan sewa.",
  "Pusing membedakan mana penghuni tetap, penyewa bulanan, atau tamu mingguan.",
  "Setiap pergantian penjaga kost, pembukuan lama selalu berantakan dan harus mulai dari nol lagi.",
  "Operasional properti menyita seluruh akhir pekan Anda yang seharusnya dinikmati bersama keluarga.",
];

export const BENEFITS = [
  "Dengan UnitKu, pengelolaan unit sewa jadi jauh lebih rapi dan serba otomatis:\n✅ Lihat denah & status kamar real-time dalam satu layar\n✅ Tahu pasti siapa yang sudah lunas & siapa yang nunggak\n✅ Tagihan otomatis terkirim langsung ke WhatsApp penyewa\n✅ Laporan arus kas masuk & keluar tercatat otomatis\n✅ Bisa pantau banyak cabang properti dalam 1 akun",
  "Biar sistem UnitKu yang menagih secara tertib dan profesional:\n✅ Notifikasi jatuh tempo otomatis dikirim via WhatsApp\n✅ Riwayat pembayaran & bukti transfer tersimpan rapi\n✅ Anak kost gak perlu download aplikasi rumit (cukup akses browser)\n✅ Status sewa terpantau jelas: Hijau (Lunas), Merah (Menunggak)\n✅ Bebas stres & hemat waktu kelola sewa harian",
  "UnitKu didesain praktis untuk semua jenis properti sewa:\n✅ Denah visual interaktif untuk cek status pintu dalam 3 detik\n✅ Kirim rincian tagihan via WhatsApp sekali klik tanpa ketik ulang\n✅ AI Generator untuk bikin teks iklan kamar kosong siap sebar\n✅ Transaksi langsung masuk rekening Anda tanpa potongan komisi\n✅ Bisa diakses langsung dari HP atau Laptop tanpa install aplikasi",
  "Operasional properti Anda kini bisa terpantau dari mana saja:\n✅ Pantau okupansi kamar & kamar kosong dari mana saja\n✅ Pengingat jatuh tempo jalan sendiri tanpa manual\n✅ Catatan kas masuk & kas keluar tercatat real-time\n✅ Data penghuni & kontak darurat tersimpan aman di cloud\n✅ Tampilan simpel, bersih, dan langsung paham tanpa tutorial ribet",
  "Dongkrak performa bisnis properti Anda bersama UnitKu:\n✅ AI Ad Generator bantu bikin teks iklan kamar menarik sekali klik\n✅ Format teks promosi siap sebar ke grup Facebook, WA, atau IG\n✅ Denah visual pantau kamar kosong yang butuh prioritas sewa\n✅ Kelola fasilitas kamar dan tarif sewa dalam satu katalog teratur\n✅ Cepat terisi kembali sehingga pendapatan properti tetap maksimal",
  "Nikmati kemudahan kontrol penuh atas aset sewa Anda:\n✅ Notifikasi otomatis via WhatsApp tanpa perlu simpan nomor satu-satu\n✅ Laporan laba-rugi otomatis setiap akhir bulan\n✅ Denah warna interaktif memudahkan cek pintu kosong\n✅ Data penghuni lengkap dengan foto identitas aman tersimpan\n✅ 100% uang sewa langsung masuk ke rekening pribadi Anda",
  "Sistem ramah pengguna yang siap pakai dalam hitungan menit:\n✅ Tanpa instalasi di Play Store, hemat memori ponsel\n✅ Tampilan modern bergaya minimalis dan sangat responsif\n✅ Fitur multi-user untuk pemilik dan penjaga properti\n✅ Pencatatan biaya operasional dan token listrik yang rapi\n✅ Bebas biaya langganan bulanan yang mencekik",
  "Kelola kamar kost harian, bulanan, hingga tahunan tanpa ribet:\n✅ Sistem fleksibel menyesuaikan siklus sewa tiap penyewa\n✅ Tagihan WhatsApp formal membuat penghuni lebih disiplin\n✅ Rekap pembayaran parsial atau cicilan tercatat akurat\n✅ Riwayat keluar masuk penghuni terdokumentasi rapi\n✅ Solusi praktis untuk kost putra, putri, pasutri, maupun campur",
  "Tinggalkan cara manual dan beralih ke era otomatisasi:\n✅ Sekali klik untuk kirim rincian invoice ke penyewa\n✅ Grafik okupansi bulanan untuk evaluasi performa bisnis\n✅ Asisten AI pintar untuk buatkan promo kamar di media sosial\n✅ Akses aman dari mana saja via smartphone, tablet, atau PC\n✅ Pembukuan digital yang anti-basah, anti-rusak, dan anti-hilang",
  "Kenyamanan maksimal bagi pemilik properti maupun penghuni:\n✅ Penyewa senang karena tagihan transparan dan jelas\n✅ Pemilik tenang karena sistem pengingat jalan mandiri\n✅ Monitoring kas masuk dan kas keluar tanpa selisih\n✅ Manajemen deposit / uang jaminan penghuni yang amanah\n✅ Support responsif siap bantu kapan saja dibutuhkan",
  "Solusi ideal untuk ekspansi bisnis properti kontrakan pintu:\n✅ Skalabilitas tinggi dari 5 unit hingga ratusan pintu\n✅ Pisahkan pencatatan tiap blok atau lokasi kontrakan\n✅ Pantau status sewa lunas hanya dengan melirik layar HP\n✅ Format tagihan siap kirim langsung ke chat WhatsApp\n✅ Efisiensi waktu kelola operasional hingga 80%",
  "Proteksi keuangan bisnis sewa dari kebocoran kas:\n✅ Transparansi pencatatan antara staf penjaga dan pemilik\n✅ Log riwayat transaksi yang tidak bisa dimanipulasi\n✅ Deteksi dini kamar menunggak agar tidak berlarut-larut\n✅ Rekap pengeluaran renovasi dan pemeliharaan gedung\n✅ Pantau margin keuntungan bersih secara transparan",
  "Bantu kamar kosong terisi lebih cepat dengan fitur promosi modern:\n✅ Buat materi copywriting iklan properti dalam 5 detik via AI\n✅ Tampilkan katalog tipe kamar beserta fasilitas lengkap\n✅ Share tautan kamar langsung ke calon penyewa potensial\n✅ Update ketersediaan unit secara instan di dashboard\n✅ Maksimalkan perputaran uang sewa tiap bulannya",
  "Manajemen database penghuni yang rapi dan terorganisir:\n✅ Simpan nomor darurat keluarga penghuni untuk kondisi darurat\n✅ Catatan nomor kendaraan dan plat nomor penghuni\n✅ Arsip digital bukti transfer pembayaran bank\n✅ Ekspor laporan keuangan ke format spreadsheet kapan saja\n✅ Semua data terlindungi dengan enkripsi cloud yang aman",
  "Kendali bisnis sewa properti ada di genggaman tangan Anda:\n✅ Desain UI simpel, bersih, dan langsung to-the-point\n✅ Cek kondisi bisnis sambil santai minum kopi di kafe\n✅ Reminder otomatis WhatsApp mengurangi beban pikiran\n✅ Pengaturan tarif sewa fleksibel per tipe kamar\n✅ Cocok untuk kost mahasiswa, karyawan, maupun ruko usaha",
  "Otomatisasi tagihan yang menjaga hubungan baik dengan penyewa:\n✅ Bahasa pengingat yang sopan, terstruktur, dan tidak menggurui\n✅ Cantumkan detail nomor rekening dan total tagihan akurat\n✅ Menghilangkan rasa canggung saat menagih sewa\n✅ Penghuni merasa diperlakukan secara profesional\n✅ Mengurangi risiko sewa macet atau kabur tanpa bayar",
  "Kelola properti bersama keluarga atau mitra bisnis lebih transparan:\n✅ Data keuangan bisa dicek bersama secara real-time\n✅ Mencegah salah paham pembagian hasil sewa bulanan\n✅ Laporan kas otomatis tanpa perlu repot rekap manual\n✅ Denah interaktif memetakan siapa penghuni di tiap kamar\n✅ Bisnis keluarga berjalan lebih profesional dan langgeng",
  "Aplikasi manajemen properti teringan tanpa beban memori:\n✅ Cukup buka lewat Google Chrome atau browser bawaan HP\n✅ Loading super cepat bahkan di jaringan sinyal minim\n✅ Hemat kuota internet untuk operasional harian\n✅ Data langsung tersinkronisasi antar perangkat\n✅ Tidak perlu repot update berkala di app store",
  "Tingkatkan gengsi dan profesionalitas bisnis sewa Anda:\n✅ Kirim tagihan dengan format digital yang rapi dan modern\n✅ Tampilan aplikasi sekelas sistem perhotelan modern\n✅ Bukti bayar digital langsung tersimpan di akun penyewa\n✅ Bikin anak kost betah dan loyal tinggal bertahun-tahun\n✅ Branding properti Anda terlihat jauh lebih terpercaya",
  "Solusi cerdas bagi pemilik kost yang tinggal di luar kota:\n✅ Awasi seluruh pintu dari jarak ratusan kilometer\n✅ Pantau apakah kamar kosong benar-benar belum berpenghuni\n✅ Terima setoran sewa langsung ke rekening tanpa perantara\n✅ Notifikasi real-time saat tagihan dikonfirmasi lunas\n✅ Hemat biaya perjalanan bolak-balik cek properti",
  "Manajemen fasilitas dan pemeliharaan gedung yang terjadwal:\n✅ Catat jadwal servis rutin AC, pompa air, dan kebersihan\n✅ Pantau pengeluaran operasional per unit kamar\n✅ Riwayat perawatan tercatat rapi untuk nilai jual properti\n✅ Kontrol anggaran belanja keperluan kost tiap bulannya\n✅ Pertahankan kondisi properti tetap prima dan bernilai tinggi",
  "Kemudahan pelacakan tunggakan tanpa bikin sakit kepala:\n✅ Sistem otomatis menyortir kamar yang lewat jatuh tempo\n✅ Kirim peringatan bertahap via WhatsApp secara teratur\n✅ Lihat total piutang yang belum terbayar dalam satu angka\n✅ Mengurangi piutang macet hingga titik terendah\n✅ Aliran kas masuk bulanan menjadi jauh lebih stabil",
  "Pencatatan uang jaminan (deposit) yang transparan dan aman:\n✅ Catat penerimaan deposit saat penghuni pertama masuk\n✅ Rincian potongan deposit saat checkout transparan\n✅ Hindari perselisihan pengembalian uang jaminan di akhir sewa\n✅ Riwayat kondisi inventaris kamar terdokumentasi\n✅ Standar operasional sewa menjadi tertib dan teratur",
  "Bebas pusing urusan pembukuan walau Anda gaptek teknologi:\n✅ Navigasi sangat intuitif dan mudah dipahami orang tua\n✅ Tombol aksi besar dan instruksi bahasa Indonesia jelas\n✅ Bantuan tim support jika mengalami kesulitan setting\n✅ Panduan pemakaian singkat langsung bisa digunakan\n✅ Rasakan kemudahan teknologi tanpa rasa bingung",
  "Fokus kembangkan aset, biarkan UnitKu kelola teknis hariannya:\n✅ Hemat waktu administrasi hingga puluhan jam per bulan\n✅ Waktu luang Anda bisa dipakai untuk mencari properti baru\n✅ Bisnis berjalan otomatis dengan kontrol penuh di tangan Anda\n✅ Kepastian laporan keuangan setiap awal dan akhir bulan\n✅ Pilihan utama para juragan kost cerdas di era modern",
];

export const CTAS = [
  "Saatnya tinggalkan cara manual yang bikin pusing.\n👉 Coba gratis demo UnitKu sekarang juga:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Bikin operasional kost Anda naik level dan serba praktis.\n👉 Klik link ini untuk lihat cara kerja demonya:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Semua unit usaha Anda terorganisir rapi dalam satu genggaman.\n👉 Buktikan sendiri kemudahannya lewat demo di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Bisnis jalan lancar, waktu santai tetap terjaga.\n👉 Coba fitur lengkapnya lewat link demo resmi ini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Kembalikan performa bisnis kost Anda ke kapasitas penuh.\n👉 Cek demo interaktifnya lewat tautan ini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Jangan biarkan cara manual menguras waktu berharga Anda.\n👉 Coba gratis sistem UnitKu hari ini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Tingkatkan profit dan ketertiban bisnis properti Anda sekarang.\n👉 Akses link uji coba gratis di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Kelola kost lebih santai dan bebas drama penagihan sewa.\n👉 Cek demonya tanpa perlu daftar akun:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Buktikan sendiri bagaimana operasional properti jadi serba otomatis.\n👉 Buka tautan demo berikut:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Modernisasi kost Anda sekarang sebelum didahului kompetitor.\n👉 Klik link ini untuk coba demonya:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Mulai digitalisasi bisnis kontrakan dan kost Anda tanpa repot.\n👉 Coba demo aplikasinya di tautan ini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Bebaskan diri dari tumpukan buku catatan usang mulai hari ini.\n👉 Cek cara kerja UnitKu di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Waktunya jadi juragan properti modern yang serba efisien.\n👉 Akses link demo gratis sekarang:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Lihat bagaimana UnitKu memangkas waktu kerja administrasi Anda.\n👉 Uji coba fiturnya lewat tautan ini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Amankan kas masuk dan disiplinkan pembayaran anak kost Anda.\n👉 Klik link demo resminya di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Kelola puluhan kamar cukup dari satu layar ponsel Anda.\n👉 Buktikan kemudahannya lewat link ini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Tinggalkan cara lama yang bikin pusing dan melelahkan.\n👉 Coba demo praktis UnitKu sekarang:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Rasakan nyamannya memantau bisnis sewa properti dari mana saja.\n👉 Cek demonya langsung di tautan ini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Bikin anak kost lebih tertib bayar tanpa perlu adu argumen.\n👉 Akses link uji coba UnitKu di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Sederhanakan manajemen bisnis properti Anda dalam satu klik.\n👉 Klik tautan demo resmi berikut:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Kelola kost serasa hotel berbintang dengan sistem otomatis.\n👉 Coba demonya sekarang juga di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Ubah cara kerja bisnis properti sewa Anda menjadi serba autopilot.\n👉 Cek tampilan aplikasinya di link ini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Nikmati kemudahan rekap kas dan tagihan sewa otomatis.\n👉 Buka demo gratisnya lewat tautan berikut:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Solusi terbaik untuk juragan kost yang mendambakan kepraktisan.\n👉 Uji coba aplikasinya langsung di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
  "Mulai sekarang dan rasakan bedanya kelola properti tanpa ribet.\n👉 Klik link demo interaktif di sini:\n[MASUKKAN_LINK_REFERRAL_ANDA]",
];

/** Materi promosi utuh acak — hook × pain × benefit × CTA diacak independen */
export function getRandomAffiliateCopy(): string {
  const hook = HOOKS[Math.floor(Math.random() * HOOKS.length)];
  const pain = PAIN_STORIES[Math.floor(Math.random() * PAIN_STORIES.length)];
  const benefit = BENEFITS[Math.floor(Math.random() * BENEFITS.length)];
  const cta = CTAS[Math.floor(Math.random() * CTAS.length)];

  return `${hook}\n\n${pain}\n\n${benefit}\n\n${cta}`;
}
