// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Pengumuman Kost & Broadcast Penyewa dataset
// Owner announcements pushed to the tenant portal (banner) & WhatsApp groups.
// Snapshot "today": 26 Sep 2026 (fixed, konsisten dengan modul lain).
//
// Seed reconciles with the spec metrics:
//   Pengumuman Aktif : 1   → #PGM-006 (tayang 26–30 Sep 2026)
//   Arsip Pengumuman : 5   → #PGM-001…005 (berakhir / dinonaktifkan)
//
// Integration seam: swap ANNOUNCEMENTS for `GET /api/announcements`; mutations
// map 1:1 to POST/PATCH/DELETE /api/announcements/:id.
// ─────────────────────────────────────────────────────────────────────────────

import { MONTH_NAMES } from "./kost-data";
import { BRAND_WA_FOOTER } from "./brand";

export type AnnouncementKategori = "info" | "penting" | "darurat";

export type AnnouncementStatus = "aktif" | "terjadwal" | "berakhir" | "nonaktif";

export interface Announcement {
  id: string; // "#PGM-006"
  judul: string;
  kategori: AnnouncementKategori;
  /** null = Semua Kamar · selain itu = nomor lantai yang dituju */
  targetFloor: number | null;
  isi: string;
  /** Periode tayang — ISO yyyy-mm-dd (otomatis hilang dari portal saat lewat) */
  tanggalMulai: string;
  tanggalBerakhir: string;
  /** Toggle manual (Aksi "Nonaktifkan") — dipasang/ditarik pengelola */
  aktif: boolean;
  createdAtLabel: string; // "26 Sep 2026"
  /** Monotonic sort key (newest first) — yyyymmddHHmm */
  createdAtSort: number;
}

// ── Kategori / urgensi metadata ──────────────────────────────────────────────

export const ANNOUNCEMENT_KATEGORI_META: Record<
  AnnouncementKategori,
  {
    label: string;
    short: string;
    pill: string;
    /** Border banner portal — 1px sesuai urgensi (spec) */
    bannerBorder: string;
    bannerBg: string;
    bannerText: string;
    bannerIconText: string;
    dot: string;
    waHeader: string;
  }
> = {
  info: {
    label: "Info Rutin",
    short: "Info",
    pill: "bg-zinc-50 text-zinc-600 border-zinc-200",
    bannerBorder: "border-blue-200",
    bannerBg: "bg-blue-50",
    bannerText: "text-blue-900",
    bannerIconText: "text-blue-600",
    dot: "bg-blue-500",
    waHeader: "ℹ️ INFO RUTIN",
  },
  penting: {
    label: "Penting",
    short: "Penting",
    pill: "bg-amber-50 text-amber-700 border-amber-200",
    bannerBorder: "border-amber-300",
    bannerBg: "bg-amber-50",
    bannerText: "text-amber-900",
    bannerIconText: "text-amber-600",
    dot: "bg-amber-500",
    waHeader: "⚠️ PENTING",
  },
  darurat: {
    label: "Darurat / Urgent",
    short: "Darurat",
    pill: "bg-red-50 text-red-700 border-red-200",
    bannerBorder: "border-red-300",
    bannerBg: "bg-red-50",
    bannerText: "text-red-900",
    bannerIconText: "text-red-600",
    dot: "bg-red-500",
    waHeader: "🚨 DARURAT / URGENT",
  },
};

export const ANNOUNCEMENT_KATEGORI: AnnouncementKategori[] = [
  "info",
  "penting",
  "darurat",
];

// ── Status & periode tayang ──────────────────────────────────────────────────

/** ISO "2026-09-26" → Date (local midnight — aman dibandingkan dengan ISO lain) */
function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

/** ISO → label "26 Sep 2026" */
export function isoToLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

/** Status tayang relatif terhadap tanggal snapshot "today" (ISO) */
export function announcementStatus(
  a: Announcement,
  todayISO: string
): AnnouncementStatus {
  if (!a.aktif) return "nonaktif";
  if (todayISO < a.tanggalMulai) return "terjadwal";
  if (todayISO > a.tanggalBerakhir) return "berakhir";
  return "aktif";
}

/** Banner portal hanya untuk pengumuman yang AKTIF pada tanggal snapshot */
export function isAnnouncementLive(
  a: Announcement,
  todayISO: string
): boolean {
  return announcementStatus(a, todayISO) === "aktif";
}

/** Banner relevan bila target "semua" atau lantai kamar cocok */
export function matchesFloor(a: Announcement, floor: number): boolean {
  return a.targetFloor === null || a.targetFloor === floor;
}

/** Label kolom "Target Kamar" & baris WA */
export function targetLabel(targetFloor: number | null): string {
  return targetFloor === null ? "Semua Kamar" : `Khusus Lantai ${targetFloor}`;
}

/** "26 Sep – 30 Sep 2026" — ringkas untuk banner & WA */
export function periodeLabel(a: Pick<Announcement, "tanggalMulai" | "tanggalBerakhir">): string {
  const start = isoToLabel(a.tanggalMulai);
  const end = isoToLabel(a.tanggalBerakhir);
  if (start === end) return start;
  // Label format "d mmm yyyy" → [day, month, year]
  const [sd, sm, sy] = start.split(" ");
  const [ed, em, ey] = end.split(" ");
  if (sy === ey && sm === em) return `${sd} – ${ed} ${em} ${ey}`;
  if (sy === ey) return `${sd} ${sm} – ${ed} ${em} ${ey}`;
  return `${start} – ${end}`;
}

// ── Format broadcast WhatsApp (tombol "Salin Format Chat Grup WhatsApp") ─────

/** Field minimal yang dibutuhkan — bisa Announcement penuh atau draft modal */
export type WaBroadcastSource = Pick<
  Announcement,
  "judul" | "kategori" | "targetFloor" | "isi" | "tanggalMulai" | "tanggalBerakhir"
>;

export function waBroadcastText(a: WaBroadcastSource, propertyName: string): string {
  const meta = ANNOUNCEMENT_KATEGORI_META[a.kategori];
  const lines: string[] = [
    "*[PENGUMUMAN KOST]*",
    propertyName,
    "",
    meta.waHeader,
    "",
    `*${a.judul}*`,
    "",
    a.isi.trim(),
    "",
    `Periode tayang: ${periodeLabel(a)}`,
    `Target: ${targetLabel(a.targetFloor)}`,
    "",
    "Terima kasih atas perhatiannya.",
    `— Pengelola ${propertyName}`,
    "",
    BRAND_WA_FOOTER,
  ];
  return lines.join("\n");
}

// ── ID generator (max #PGM-N + 1) ────────────────────────────────────────────

export function nextAnnouncementId(announcements: Announcement[]): string {
  const max = announcements.reduce((acc, a) => {
    const n = Number(a.id.replace(/[^0-9]/g, ""));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `#PGM-${String(max + 1).padStart(3, "0")}`;
}

// ── Draft dari modal "+ Buat Pengumuman Baru" ────────────────────────────────

export interface AnnouncementDraft {
  judul: string;
  kategori: AnnouncementKategori;
  targetFloor: number | null;
  isi: string;
  tanggalMulai: string; // ISO
  tanggalBerakhir: string; // ISO
}

/** Build a ready-to-insert Announcement (status default tayang = aktif) */
export function announcementFromDraft(
  draft: AnnouncementDraft,
  announcements: Announcement[],
  todayISO: string
): Announcement {
  const maxSort = announcements.reduce((m, a) => Math.max(m, a.createdAtSort), 0);
  const t = isoToDate(todayISO);
  const stamp = `${todayISO.replace(/-/g, "")}0900`;
  return {
    id: nextAnnouncementId(announcements),
    judul: draft.judul,
    kategori: draft.kategori,
    targetFloor: draft.targetFloor,
    isi: draft.isi,
    tanggalMulai: draft.tanggalMulai,
    tanggalBerakhir: draft.tanggalBerakhir,
    aktif: true,
    createdAtLabel: `${t.getDate()} ${MONTH_NAMES[t.getMonth()]} ${t.getFullYear()}`,
    createdAtSort: Number(stamp) || maxSort + 1,
  };
}

// ── Dataset ──────────────────────────────────────────────────────────────────
// Newest first. "Hari ini" snapshot = 26 Sep 2026.

export const ANNOUNCEMENT_TODAY_ISO = "2026-09-26";

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "#PGM-006",
    judul: "Jadwal Pengurasan Toren Air & Mati Lampu Sementara",
    kategori: "penting",
    targetFloor: null,
    isi: "Diberitahukan seluruh penghuni bahwa pengurasan toren air akan dilakukan pada Minggu, 27 Sep 2026 pukul 09.00–15.00 WIB.\n\nSelama pengerjaan:\n• Aliran air terhenti sementara (± 4 jam).\n• Lampu koridor & area parkir dimatikan pukul 10.00–12.00 WIB.\n• Mohon simpan air minum dan kebutuhan pokok sebelum jadwal tersebut.\n\nAir akan kembali mengalir normal setelah toren terisi penuh. Terima kasih atas pengertiannya.",
    tanggalMulai: "2026-09-26",
    tanggalBerakhir: "2026-09-30",
    aktif: true,
    createdAtLabel: "26 Sep 2026",
    createdAtSort: 202609260900,
  },
  {
    id: "#PGM-005",
    judul: "Pemeliharaan Pompa Air Otomatis — Lantai 2",
    kategori: "info",
    targetFloor: 2,
    isi: "Teknisi akan melakukan pengecekan rutin pompa air otomatis pada kamar lantai 2, Kamis 17 Sep 2026 pukul 08.00 WIB. Tekanan air mungkin tidak stabil ± 1 jam. Tidak perlu koordinasi khusus — cukup informasi.",
    tanggalMulai: "2026-09-15",
    tanggalBerakhir: "2026-09-18",
    aktif: true,
    createdAtLabel: "15 Sep 2026",
    createdAtSort: 202609150800,
  },
  {
    id: "#PGM-004",
    judul: "Spot Check Kamar & Fasilitas Bersama Pemilik",
    kategori: "info",
    targetFloor: null,
    isi: "Pemilik akan melakukan spot check kondisi kamar & fasilitas bersama pada 8–12 Sep 2026. Mohon izin ketuk pintu saat penghuni berada di kamar. Atas kerja samanya, terima kasih.",
    tanggalMulai: "2026-09-05",
    tanggalBerakhir: "2026-09-12",
    aktif: false, // ditarik lebih awal — jadwal digabung ke kunjungan bulan depan
    createdAtLabel: "4 Sep 2026",
    createdAtSort: 202609040830,
  },
  {
    id: "#PGM-003",
    judul: "Penggunaan Listrik & Perangkat High-Wattage",
    kategori: "penting",
    targetFloor: null,
    isi: "Beberapa MCB sempat trip karena pemakaian setrika, water heater & charger berbarengan pada jam yang sama (21.00–23.00). Mohon tidak menjalankan perangkat high-wattage secara serentak untuk menjaga stabilitas listrik gedung.",
    tanggalMulai: "2026-09-01",
    tanggalBerakhir: "2026-09-10",
    aktif: true,
    createdAtLabel: "1 Sep 2026",
    createdAtSort: 202609010900,
  },
  {
    id: "#PGM-002",
    judul: "Fogging & Pengendalian Nyamuk Area Kost",
    kategori: "info",
    targetFloor: null,
    isi: "Fogging nyamuk akan dilakukan Minggu, 23 Agu 2026 pukul 07.00–09.00 WIB di area parkir, taman & koridor. Mohon tutup makanan & kipas jendela selama proses. Ventilasi kamar dibuka kembali pukul 10.00 WIB.",
    tanggalMulai: "2026-08-20",
    tanggalBerakhir: "2026-08-23",
    aktif: true,
    createdAtLabel: "20 Agu 2026",
    createdAtSort: 202608200900,
  },
  {
    id: "#PGM-001",
    judul: "Kebijakan Baru: Parkir Mobil Tamu Hanya Area Depan",
    kategori: "info",
    targetFloor: null,
    isi: "Mulai 10 Agu 2026, parkir mobil tamu hanya diizinkan di area depan (maks. 1×24 jam). Mobil penghuni tetap pada slot masing-masing. Mohon informasikan tamu yang berkunjung. Kendaraan yang melanggar akan digeser oleh petugas.",
    tanggalMulai: "2026-08-05",
    tanggalBerakhir: "2026-08-10",
    aktif: true,
    createdAtLabel: "5 Agu 2026",
    createdAtSort: 202608051000,
  },
];
