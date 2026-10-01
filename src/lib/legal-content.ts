// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Konten halaman legalitas (S&K, Privasi, Refund)
// Ringkas & jujur untuk kebutuhan verifikasi KYC Mayar — SUNTIK identitas
// vendor yang sebenarnya (alamat, dsb.) bila diperlukan lebih lanjut.
// ─────────────────────────────────────────────────────────────────────────────

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDoc {
  slug: string;
  title: string;
  description: string;
  updatedLabel: string;
  sections: LegalSection[];
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "syarat-ketentuan",
    title: "Syarat & Ketentuan",
    description:
      "Ketentuan penggunaan aplikasi UnitKu — lisensi seumur hidup dari Elvindigital.",
    updatedLabel: "Terakhir diperbarui: 30 September 2026",
    sections: [
      {
        heading: "1. Tentang Layanan",
        paragraphs: [
          "UnitKu adalah perangkat lunak berbasis web (SaaS) untuk manajemen properti sewa — kost, kontrakan, dan unit sewa — yang dikembangkan dan dioperasikan oleh Elvindigital. Dengan membeli dan/atau menggunakan UnitKu, Anda menyatakan telah membaca, memahami, dan menyetujui Syarat & Ketentuan ini.",
        ],
      },
      {
        heading: "2. Lisensi Seumur Hidup",
        paragraphs: [
          "Pembayaran satu kali (jual putus) memberikan Anda hak penggunaan penuh seluruh fitur UnitKu yang tersedia saat pembelian beserta pembaruan fitur berikutnya, untuk satu akun email, tanpa biaya langganan bulanan.",
        ],
        bullets: [
          "Lisensi berlaku selama layanan UnitKu dioperasikan oleh Elvindigital.",
          "Lisensi bersifat pribadi pada akun Anda — tidak dapat dijual, disewakan, atau dipindahtangankan.",
          "Anda bebas menambah unit/kamar sesuai kebutuhan pengelolaan Anda sendiri.",
        ],
      },
      {
        heading: "3. Akun & Keamanan",
        paragraphs: [
          "Anda bertanggung jawab penuh menjaga kerahasiaan email dan kata sandi akun Anda. Seluruh aktivitas yang terjadi melalui akun Anda dianggap sebagai tindakan Anda. Segera laporkan dugaan penyalahgunaan akun ke Customer Care kami.",
        ],
      },
      {
        heading: "4. Penggunaan yang Wajar",
        paragraphs: [
          "Anda dilarang melakukan hal-hal berikut:",
        ],
        bullets: [
          "Mengunggah atau menyebarluaskan konten yang melanggar hukum Republik Indonesia.",
          "Mencoba mengakses data atau akun pengguna lain, termasuk mengeksploitasi celah teknis.",
          "Menyalin, membongkar (reverse engineering), menjual ulang, atau menjadikan UnitKu bagian dari produk kompetitif.",
        ],
      },
      {
        heading: "5. Data Anda",
        paragraphs: [
          "Data properti, kamar, penghuni, tagihan, dan keuangan yang Anda masukkan ke dalam UnitKu adalah milik Anda dan hanya dapat diakses melalui akun Anda. Lakukan pencadangan (backup) rutin atas data operasional Anda.",
        ],
      },
      {
        heading: "6. Ketersediaan Layanan",
        paragraphs: [
          "Kami berupaya terbaik menjaga UnitKu tetap tersedia setiap saat. Pemeliharaan terjadwal atau keadaan di luar kendali (mis. gangguan penyedia infrastruktur cloud) dapat membatasi akses secara sementara tanpa dianggap kelalaian kami.",
        ],
      },
      {
        heading: "7. Pembayaran",
        paragraphs: [
          "Pembayaran lisensi diproses oleh mitra pembayaran digital (Mayar). Aktivasi akun dilakukan otomatis setelah pembayaran terverifikasi. Kami tidak menyimpan data kartu pembayaran Anda.",
        ],
      },
      {
        heading: "8. Perubahan Syarat",
        paragraphs: [
          "Elvindigital dapat memperbarui Syarat & Ketentuan ini dari waktu ke waktu. Perubahan material akan diumumkan melalui aplikasi atau halaman ini. Melanjutkan penggunaan setelah perubahan berarti Anda menyetujuinya.",
        ],
      },
      {
        heading: "9. Hukum yang Berlaku",
        paragraphs: [
          "Syarat & Ketentuan ini tunduk pada hukum Republik Indonesia. Pertanyaan seputar ketentuan ini dapat disampaikan ke Customer Care kami (lihat footer situs).",
        ],
      },
    ],
  },
  {
    slug: "kebijakan-privasi",
    title: "Kebijakan Privasi",
    description:
      "Bagaimana UnitKu by Elvindigital mengumpulkan, menggunakan, dan melindungi data Anda.",
    updatedLabel: "Terakhir diperbarui: 30 September 2026",
    sections: [
      {
        heading: "1. Ringkasan",
        paragraphs: [
          "Kami mengumpulkan data seminimal mungkin — hanya yang diperlukan agar UnitKu berfungsi: akun Anda, lisensi Anda, dan data operasional yang Anda masukkan sendiri. Kami tidak menjual data Anda.",
        ],
      },
      {
        heading: "2. Data yang Kami Kumpulkan",
        bullets: [
          "Data akun: email, nama (opsional), dan nomor HP (opsional).",
          "Data operasional yang Anda input: properti, kamar, data penghuni, tagihan, catatan kas, tiket komplain, dan foto pelaporan.",
          "Data pembayaran: referensi/ID transaksi dari mitra pembayaran (Mayar) untuk aktivasi lisensi. Kami TIDAK menyimpan nomor kartu atau kredensial bank Anda.",
          "Data teknis dasar: cookie sesi login untuk menjaga keamanan akun.",
        ],
      },
      {
        heading: "3. Tujuan Penggunaan Data",
        bullets: [
          "Membuat dan mengaktifkan akun serta lisensi Anda secara otomatis.",
          "Menjalankan fitur aplikasi: tagihan, kas, portal penyewa, portal staf, dan komplain.",
          "Memberikan dukungan pelanggan saat Anda meminta bantuan.",
          "Menjaga keamanan, mencegah penyalahgunaan, dan memenuhi kewajiban hukum.",
        ],
      },
      {
        heading: "4. Penyimpanan & Keamanan",
        paragraphs: [
          "Data disimpan pada infrastruktur penyedia cloud ternama (antara lain Supabase/Vercel) dengan enkripsi saat transit. Data setiap owner diisolasi — pemilik UnitKu lain tidak dapat melihat data Anda.",
        ],
      },
      {
        heading: "5. Cookie",
        paragraphs: [
          "UnitKu hanya menggunakan cookie sesi yang wajib untuk proses login. Kami tidak memakai cookie iklan maupun pelacak pihak ketiga.",
        ],
      },
      {
        heading: "6. Pembagian ke Pihak Ketiga",
        paragraphs: [
          "Data tidak dijual atau disewakan. Pembagian hanya terjadi kepada penyedia infrastruktur dan mitra pembayaran sebatas yang diperlukan untuk menjalankan layanan, serta apabila diwajibkan oleh hukum.",
        ],
      },
      {
        heading: "7. Retensi & Penghapusan",
        paragraphs: [
          "Data disimpan selama akun Anda aktif. Jika Anda ingin menghapus akun beserta datanya, hubungi Customer Care — penghapusan diproses maksimal 30 hari, kecuali data yang harus disimpan sesuai kewajiban hukum.",
        ],
      },
      {
        heading: "8. Hak Anda",
        bullets: [
          "Meminta akses dan salinan data pribadi Anda.",
          "Meminta koreksi data yang tidak akurat.",
          "Meminta penghapusan akun dan data terkait.",
        ],
      },
      {
        heading: "9. Kontak",
        paragraphs: [
          "Pertanyaan seputar privasi dapat disampaikan melalui Customer Care kami (WhatsApp dan email — lihat footer situs).",
        ],
      },
    ],
  },
  {
    slug: "kebijakan-refund",
    title: "Kebijakan Pengembalian Dana",
    description:
      "Garansi dan ketentuan pengembalian dana lisensi UnitKu — jujur dan tegas.",
    updatedLabel: "Terakhir diperbarui: 30 September 2026",
    sections: [
      {
        heading: "1. Garansi 7 Hari",
        paragraphs: [
          "Anda berhak mengajukan pengembalian dana penuh dalam 7 hari sejak pembelian apabila:",
        ],
        bullets: [
          "Aplikasi tidak dapat diakses atau diaktifkan karena kesalahan di sisi kami, dan upaya perbaikan kami tidak berhasil.",
          "Fitur yang Anda terima berbeda secara material dari deskripsi pada halaman penjualan ini.",
        ],
      },
      {
        heading: "2. Yang Tidak Tercakup",
        bullets: [
          "Ketidaksukaan pada preferensi tampilan (warna, urutan, gaya) yang tidak mengurangi fungsi.",
          "Permintaan pengembalian setelah masa garansi 7 hari berlalu.",
          "Akun yang dinonaktifkan karena pelanggaran Syarat & Ketentuan.",
          "Kehilangan akses akun akibat kelalaian menjaga kredensial — ini dapat kami bantu reset, bukan refund.",
        ],
      },
      {
        heading: "3. Cara Mengajukan",
        paragraphs: [
          "Hubungi Customer Care kami melalui WhatsApp atau email (lihat footer situs) dengan menyertakan: nama, email akun UnitKu, bukti pembayaran atau ID transaksi Mayar, serta penjelasan singkat alasannya.",
        ],
      },
      {
        heading: "4. Proses & Waktu",
        paragraphs: [
          "Pengajuan kami evaluasi maksimal 7 hari kerja. Apabila disetujui, dana dikembalikan melalui metode pembayaran asli Anda. Biaya administrasi/transfer yang dipersyaratkan penyedia pembayaran (bila ada) ditanggung pembeli.",
        ],
      },
      {
        heading: "5. Komitmen Kami",
        paragraphs: [
          "Aktivasi lisensi berjalan otomatis setelah pembayaran terverifikasi. Jika aktivasi gagal karena gangguan sistem kami, tim kami akan menyelesaikannya secara manual dan segera — tanpa biaya tambahan.",
        ],
      },
    ],
  },
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((doc) => doc.slug === slug);
}
