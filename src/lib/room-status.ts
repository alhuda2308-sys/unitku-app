// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sumber kebenaran TUNGGAL status kamar berbasis tanggal kontrak
//
// Masalah: status kamar tersimpan denormalisasi di kolom rooms.status dan
// hanya berubah saat invoice dibuat/dibayar — kamar penyewa yang kontraknya
// sudah lewat tetap tampil "Lunas" (kartu biru/hijau) selamanya, kartu
// statistik & tab filter ikut salah. Sinkronisasi lama hanya jalan di server
// (GET /api/rooms, mode cloud) sehingga mode demo & data tanpa contractEnd
// tidak pernah tersentuh — sementara kartu justru menampilkan baris "Habis:"
// hasil derivasi klien. SPLIT-BRAIN.
//
// Solusi: status efektif TIDAK dibaca mentah dari database, melainkan DIHITUNG
// MURNI dari selisih hari ini terhadap tanggal habis kontrak. Satu fungsi
// inti (deriveStatusFromContract) dipakai bersama oleh:
//   • Klien  — dashboard (kartu denah, kartu statistik, tab filter, drawer)
//   • Server — room-status-sync (persist best-effort saat GET /api/rooms)
//
// ── Aturan status dinamis (murni tanggal — TANPA pengecualian pembayaran) ─────
//   kosong                        → kosong (tidak pernah disentuh)
//   tanpa tanggal habis           → status dasar (tidak bisa dihitung)
//   H-3 s.d. H+0                  → "jatuhTempo" (kuning — segera jatuh tempo)
//   hari ini > habis kontrak      → "menunggak" (merah — lewat tempo)
//   masa depan di luar jendela H  → status dasar
//
// PENTING (keputusan produk 25 Okt 2026 — laporan pemilik akun riil):
// pembayaran tagihan baru TIDAK lagi menahan alarm. Kontrak yang lewat tanggal
// habisnya WAJIB tampil berbeda warna ("harusnya update otomatis ketika
// tanggal melewati jatuh tempo harus ada pembeda warna") — invoice baru-lunas
// tidak memperpanjang kontrak; alarm hilang hanya lewat Perpanjang Sewa
// (menyetel status kembali "lunas" — lihat PATCH /api/tenants) atau check-out.
// Ini menghapus "shield" pembayaran versi lama yang membuat kamar kontraknya
// lewat tetap tampil "Lunas" tanpa batas waktu.
//
// Status hanya pernah NAIK otomatis (lunas → jatuhTempo → menunggak);
// "menunggak" eksplisit dari pemilik tidak pernah diturunkan otomatis di
// luar jendela H-3..H+0 — menutup risiko menyembunyikan tunggakan nyata.
// ─────────────────────────────────────────────────────────────────────────────

import {
  addMonths,
  dateToLabel,
  parseDateLabel,
  type Room,
  type RoomStatus,
} from "./kost-data";

/** Jendela "Jatuh Tempo" (kuning): H-3 s.d. H+0 — mulai 3 hari sebelum habis
 *  kontrak sampai tepat hari habis. Hari berikutnya → "Menunggak" (merah). */
export const DUE_SOON_DAYS = 3;

const DAY_MS = 86_400_000;

/** Durasi kontrak → panjang 1 siklus sewa dalam bulan (aturan kanonik yang
 *  sama dipakai check-in: "Per 3 Bulan"→3, "Tahunan"→12, selain itu bulanan).
 *  "Harian" ditangani terpisah (+1 hari). */
const DURATION_MONTHS: Record<string, number> = {
  "Per 3 Bulan": 3,
  "Tahunan": 12,
};

export interface ContractEndInfo {
  /** Tanggal habis kontrak (tengah malam lokal) — null bila tak dapat ditentukan */
  date: Date | null;
  /** true = diturunkan dari aturan kanonik (masuk + 1 siklus), bukan endDate eksplisit */
  derived: boolean;
  /** Label Indonesia siap tampil — "" bila tak tersedia (tidak pernah "—") */
  label: string;
}

/** Tengah malam lokal — dasar selisih hari yang stabil lintas zona waktu. */
export function midnightLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Tanggal "Habis" kamar — SATU fungsi untuk tampilan kartu & kalkulasi status:
 *   1) contract.endDate eksplisit (dikunci saat check-in / Perpanjang Sewa);
 *   2) fallback kanonik: tanggal masuk + 1 siklus sewa (Bulanan→+1 bln,
 *      Per 3 Bulan→+3, Tahunan→+12, Harian→+1 hari) — data lama/kontrak
 *      rolling tanpa endDate tetap punya tanggal habis yang dipercaya logika
 *      status, bukan hanya ditampilkan.
 */
export function contractEndOf(room: Room): ContractEndInfo {
  const explicit = room.contract?.endDate?.trim();
  if (explicit) {
    const d = parseDateLabel(explicit);
    if (!Number.isNaN(d.getTime())) {
      return { date: midnightLocal(d), derived: false, label: explicit };
    }
  }
  const masuk =
    room.contract?.startDate?.trim() ||
    (room.tenant?.moveInDate && room.tenant.moveInDate !== "—"
      ? room.tenant.moveInDate.trim()
      : "");
  if (!masuk) return { date: null, derived: false, label: "" };
  try {
    const start = parseDateLabel(masuk);
    if (Number.isNaN(start.getTime())) return { date: null, derived: false, label: "" };
    const duration = room.contract?.duration;
    const end =
      duration === "Harian"
        ? new Date(start.getTime() + DAY_MS)
        : addMonths(start, DURATION_MONTHS[duration ?? ""] ?? 1);
    return { date: midnightLocal(end), derived: true, label: dateToLabel(end) };
  } catch {
    return { date: null, derived: false, label: "" };
  }
}

/**
 * Selisih hari utuh contractEnd − today (positif = berakhir dalam N hari,
 * 0 = berakhir hari ini, negatif = lewat N hari). Kedua sisi dinormalisasi ke
 * tengah malam lokal sehingga jam/timenya tidak menggeser hasil.
 */
export function contractDaysLeft(contractEnd: Date, today: Date): number {
  return Math.round(
    (midnightLocal(contractEnd).getTime() - midnightLocal(today).getTime()) / DAY_MS
  );
}

/**
 * ── INTI ATURAN STATUS DINAMIS (satu untuk klien & server) ───────────────────
 * Murni fungsi tanggal — TANPA pengecualian pembayaran (lihat header modul):
 * kamar yang kontraknya lewat SELALU "menunggak", apa pun riwayat bayarnya.
 *
 * @param base          status tersimpan di database (tidak dipercaya mentah)
 * @param contractEnd   tanggal habis kontrak (Date apa pun — dinormalisasi)
 * @param today         hari ini
 * @returns status efektif yang HARUS tampil di seluruh UI
 */
export function deriveStatusFromContract(
  base: RoomStatus,
  contractEnd: Date | null,
  today: Date,
): RoomStatus {
  if (base === "kosong" || !contractEnd) return base;
  const daysLeft = contractDaysLeft(contractEnd, today);
  // H-3 s.d. H+0 → segera jatuh tempo (kuning)
  if (daysLeft >= 0 && daysLeft <= DUE_SOON_DAYS) return "jatuhTempo";
  // Hari ini > tanggal habis kontrak → lewat tempo (merah) — TANPA kecuali
  if (daysLeft < 0) return "menunggak";
  // Masa depan di luar jendela → status dasar dipertahankan
  return base;
}

/** Status efektif satu kamar — membaca tanggal habis dari objek Room (label). */
export function deriveRoomStatus(room: Room, today: Date = new Date()): RoomStatus {
  return deriveStatusFromContract(room.status, contractEndOf(room).date, today);
}

/** true bila kontrak kamar SUDAH LEWAT tanggal habisnya — dasar merahnya
 *  baris tanggal kartu ("Habis:") pada kartu menunggak. */
export function isContractPastEnd(room: Room, today: Date = new Date()): boolean {
  const end = contractEndOf(room).date;
  return end != null && contractDaysLeft(end, today) < 0;
}

/**
 * ── Teks keterangan keterlambatan/jatuh tempo (baris merah kartu denah) ──────
 * Dihitung REAL-TIME dari selisih hari today vs tanggal habis kontrak —
 * memakai SUMBER TANGGAL YANG SAMA dengan aturan status di atas, sehingga
 * teks dan warna kartu mustahil berbeda (tanpa split-brain):
 *
 *   kontrak lewat           → "Lewat tempo 5 hari"   (kartu menunggak)
 *   tepat hari habis        → "Jatuh tempo hari ini" (kartu jatuh tempo)
 *   H-3 s.d. H-1            → "Jatuh tempo 2 hari lagi"
 *   selain itu              → null (tanpa baris — masa sewa aman / tanpa
 *                             tanggal acuan)
 *
 * Spesifikasi pemilik 25 Okt 2026: sufiks statis "(Lewat Tempo)" diganti
 * hitungan hari hidup — pemilik langsung tahu SUDAH BERAPA hari terlambat,
 * dan angkanya bertambah sendiri setiap hari tanpa sync manual.
 */
export function arrearsLine(room: Room, today: Date = new Date()): string | null {
  const end = contractEndOf(room).date;
  if (!end) return null;
  const daysLeft = contractDaysLeft(end, today);
  if (daysLeft < 0) return `Lewat tempo ${Math.abs(daysLeft)} hari`;
  if (daysLeft === 0) return "Jatuh tempo hari ini";
  if (daysLeft <= DUE_SOON_DAYS) return `Jatuh tempo ${daysLeft} hari lagi`;
  return null;
}

/** Versi massal — kamar → kamar berstatus efektif (array baru, immutable;
 *  kamar yang tidak berubah dipakai ulang referensinya agar memo aman). */
export function deriveRoomStatuses(rooms: Room[], today: Date = new Date()): Room[] {
  return rooms.map((r) => {
    const next = deriveRoomStatus(r, today);
    return next === r.status ? r : { ...r, status: next };
  });
}
