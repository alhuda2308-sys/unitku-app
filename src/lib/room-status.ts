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
// dari selisih hari ini terhadap tanggal habis kontrak + pembayaran tagihan
// baru. Satu fungsi inti (deriveStatusFromContract) dipakai bersama oleh:
//   • Klien  — dashboard (kartu denah, kartu statistik, tab filter, drawer)
//   • Server — room-status-sync (persist best-effort saat GET /api/rooms)
//
// ── Aturan status dinamis ─────────────────────────────────────────────────────
//   kosong                        → kosong (tidak pernah disentuh)
//   tanpa tanggal habis           → status dasar (tidak bisa dihitung)
//   H-3 s.d. H+0                  → "jatuhTempo" (kuning — segera jatuh tempo)
//   hari ini > habis kontrak      → "menunggak" (merah — lewat tempo)
//       kecuali status dasar "lunas" DAN sudah ada pembayaran tagihan baru
//       (invoice lunas pada/setelah tanggal habis kontrak) → tetap "lunas"
//       (pemilik menerima pembayaran periode baru namun belum memperpanjang
//       kontrak — jangan bunyikan alarm palsu)
//   masa depan di luar jendela H  → status dasar
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
 *
 * @param base          status tersimpan di database (tidak dipercaya mentah)
 * @param contractEnd   tanggal habis kontrak (Date apa pun — dinormalisasi)
 * @param today         hari ini
 * @param lastPaymentAt tanggal pembayaran tagihan terakhir (invoice lunas),
 *                      null bila belum pernah membayar
 * @returns status efektif yang HARUS tampil di seluruh UI
 */
export function deriveStatusFromContract(
  base: RoomStatus,
  contractEnd: Date | null,
  today: Date,
  lastPaymentAt?: Date | null,
): RoomStatus {
  if (base === "kosong" || !contractEnd) return base;
  const daysLeft = contractDaysLeft(contractEnd, today);
  // H-3 s.d. H+0 → segera jatuh tempo (kuning)
  if (daysLeft >= 0 && daysLeft <= DUE_SOON_DAYS) return "jatuhTempo";
  // Hari ini > tanggal habis kontrak → lewat tempo
  if (daysLeft < 0) {
    if (
      base === "lunas" &&
      lastPaymentAt &&
      midnightLocal(lastPaymentAt).getTime() >= midnightLocal(contractEnd).getTime()
    ) {
      // Pembayaran periode baru sudah masuk (pada/setelah tanggal habis) —
      // pemilik belum sempat memperpanjang kontrak → tetap Lunas, tanpa alarm.
      return "lunas";
    }
    return "menunggak";
  }
  // Masa depan di luar jendela → status dasar dipertahankan
  return base;
}

/** Status efektif satu kamar — membaca tanggal habis dari objek Room (label). */
export function deriveRoomStatus(
  room: Room,
  today: Date = new Date(),
  lastPaymentAt?: Date | null,
): RoomStatus {
  return deriveStatusFromContract(room.status, contractEndOf(room).date, today, lastPaymentAt);
}

/** true bila kontrak kamar SUDAH LEWAT tanggal habisnya — dasar penanda
 *  "(Lewat Tempo)" pada baris tanggal kartu & aria-label. */
export function isContractPastEnd(room: Room, today: Date = new Date()): boolean {
  const end = contractEndOf(room).date;
  return end != null && contractDaysLeft(end, today) < 0;
}

/** Versi massal — kamar → kamar berstatus efektif (array baru, immutable;
 *  kamar yang tidak berubah dipakai ulang referensinya agar memo aman). */
export function deriveRoomStatuses(
  rooms: Room[],
  today: Date = new Date(),
  lastPayments?: Map<string, Date>,
): Room[] {
  return rooms.map((r) => {
    const next = deriveRoomStatus(r, today, lastPayments?.get(r.id) ?? null);
    return next === r.status ? r : { ...r, status: next };
  });
}

/** Bentuk minimum invoice yang dibutuhkan — cocok dgn Invoice kost-invoices. */
export interface PaymentDated {
  roomId: string;
  status: string;
  paidAt?: string | null;
}

/**
 * Tanggal pembayaran tagihan TERAKHIR per kamar (invoice lunas, paidAt label
 * Indonesia) — sumber cek "belum ada pembayaran baru" pada aturan dinamis di
 * sisi klien. Label kosong/tak valid diabaikan.
 */
export function lastPaymentDates(invoices: PaymentDated[]): Map<string, Date> {
  const map = new Map<string, Date>();
  for (const inv of invoices) {
    if (inv.status !== "lunas" || !inv.paidAt) continue;
    const d = parseDateLabel(inv.paidAt);
    if (Number.isNaN(d.getTime())) continue;
    const prev = map.get(inv.roomId);
    if (prev === undefined || d.getTime() > prev.getTime()) map.set(inv.roomId, d);
  }
  return map;
}
