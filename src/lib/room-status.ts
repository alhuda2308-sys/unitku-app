// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sumber kebenaran TUNGGAL status kamar berbasis SIKLUS TAGIHAN
//
// Dua tanggal, dua peran (DECOUPLED — spesifikasi refaktor penagihan):
//   • nextBillingDate  — jatuh tempo TAGIHAN berikutnya (siklus pembayaran
//     berulang). Maju 1 siklus sewa setiap "Tandai Lunas" (Bulanan +1 bln,
//     Mingguan +7 hari, Harian +1 hari/checkout) TANPA menyentuh kontrak.
//     INILAH sumber status kartu: Menunggak/Jatuh Tempo/Lunas.
//   • contractEnd      — BATAS MASA KOMITMEN sewa ("Habis:" di kartu, sisa
//     hari kontrak, tab Akan Keluar). TIDAK lagi menentukan status tagihan.
//
// Masalah lama yang dipecahkan: status dihitung dari contractEnd sehingga
// pembayaran tagihan bulanan TIDAK bisa menenangkan alarm (kontrak setahun
// tetap "lewat" di mata logika) — pemilik terpaksa "Perpanjang Sewa" setiap
// kali menandai lunas. Kini menandai lunas otomatis memajukan nextBillingDate
// satu siklus, alarm mereda natural, dan kontrak tetap utuh sebagai komitmen.
//
// Solusi arsitektur: status efektif TIDAK dibaca mentah dari database —
// DIHITUNG murni dari selisih hari ini terhadap nextBillingDate. Satu fungsi
// inti (deriveStatusFromBilling) dipakai bersama oleh:
//   • Klien  — dashboard (kartu denah, kartu statistik, tab filter, drawer)
//   • Server — room-status-sync (persist best-effort saat GET /api/rooms)
//
// ── Aturan status dinamis (murni tanggal) ────────────────────────────────────
//   kosong                        → kosong (tidak pernah disentuh)
//   tanpa tanggal tagihan         → status dasar (tidak bisa dihitung)
//   H-3 s.d. H+0                  → "jatuhTempo" (kuning — segera jatuh tempo)
//   hari ini > nextBillingDate    → "menunggak" (merah — lewat tempo tagihan;
//                                    invoice periode tsb belum lunas — bila
//                                    lunas, "Tandai Lunas" pasti sudah majukan
//                                    penanda ini, lihat PATCH /api/invoices)
//   masa depan di luar jendela H  → "lunas" (siklus terbayar — tagihan
//                                    berikutnya masih jauh)
//
// ── Fallback data lama (pra-refaktor, nextBillingDate kosong) ────────────────
// Kamar lama belum punya kolom nextBillingDate → billingDueOf memakai
// contractEnd sebagai penanda tempo (semantik model lama persis: kontrak
// lewat = menunggak). Pada "Tandai Lunas" PERTAMA, server menginisialisasi
// nextBillingDate = max(contractEnd, hari ini) + 1 siklus sehingga kamar lama
// ter-migrasi alami tanpa skrip backfill.
// ─────────────────────────────────────────────────────────────────────────────

import {
  addMonths,
  dateToLabel,
  parseDateLabel,
  type Room,
  type RoomStatus,
} from "./kost-data";

/** Jendela "Jatuh Tempo" (kuning): H-3 s.d. H+0 — mulai 3 hari sebelum jatuh
 *  tempo tagihan sampai tepat hari itu. Hari berikutnya → "Menunggak" (merah). */
export const DUE_SOON_DAYS = 3;

const DAY_MS = 86_400_000;

/**
 * Maju SATU siklus sewa dari tanggal acuan — SATU definisi durasi siklus untuk
 * seluruh aplikasi (check-in: nextBillingDate awal; Tandai Lunas: maju 1 siklus;
 * fallback kontrak kanonik). Harian +1 hari, Mingguan +7 hari, Bulanan +1 bulan
 * (clamp ujung bulan), Per 3 Bulan +3, Tahunan +12. Durasi tak dikenal → bulanan.
 */
export function advanceOneCycle(from: Date, duration: string | undefined | null): Date {
  switch (duration) {
    case "Harian":
      return new Date(from.getTime() + DAY_MS);
    case "Mingguan":
      return new Date(from.getTime() + 7 * DAY_MS);
    case "Per 3 Bulan":
      return addMonths(from, 3);
    case "Tahunan":
      return addMonths(from, 12);
    default:
      // "Bulanan" & durasi legacy/tak dikenal
      return addMonths(from, 1);
  }
}

export interface ContractEndInfo {
  /** Tanggal (tengah malam lokal) — null bila tak dapat ditentukan */
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
 * Tanggal "Habis" KONTRAK kamar (batas masa komitmen — BUKAN penanda tagihan):
 *   1) contract.endDate eksplisit (dikunci saat check-in / Perpanjang Sewa);
 *   2) fallback kanonik: tanggal masuk + 1 siklus sewa (Mingguan→+7 hari,
 *      Bulanan→+1 bln, Per 3 Bulan→+3, Tahunan→+12, Harian→+1 hari).
 * Dipakai untuk baris "Habis:" kartu, sisa hari kontrak & tab Akan Keluar.
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
    const end = advanceOneCycle(start, room.contract?.duration);
    return { date: midnightLocal(end), derived: true, label: dateToLabel(end) };
  } catch {
    return { date: null, derived: false, label: "" };
  }
}

/**
 * Tanggal jatuh tempo TAGIHAN berikutnya — SUMBER STATUS kartu:
 *   1) room.nextBillingDate eksplisit (dikunci saat check-in, maju 1 siklus
 *      setiap "Tandai Lunas");
 *   2) fallback data lama: contractEnd (semantik model lama — kontrak lewat
 *      berarti tagihan lewat) sehingga kamar pra-refaktor tetap berperilaku
 *      benar sampai lunas pertama memigrasinya.
 */
export function billingDueOf(room: Room): ContractEndInfo {
  const explicit = room.nextBillingDate?.trim();
  if (explicit) {
    const d = parseDateLabel(explicit);
    if (!Number.isNaN(d.getTime())) {
      return { date: midnightLocal(d), derived: false, label: explicit };
    }
  }
  return contractEndOf(room);
}

/**
 * Selisih hari utuh anchor − today (positif = N hari ke depan, 0 = hari ini,
 * negatif = lewat N hari). Kedua sisi dinormalisasi ke tengah malam lokal
 * sehingga jam/timenya tidak menggeser hasil.
 */
export function contractDaysLeft(contractEnd: Date, today: Date): number {
  return Math.round(
    (midnightLocal(contractEnd).getTime() - midnightLocal(today).getTime()) / DAY_MS
  );
}

/**
 * ── INTI ATURAN STATUS DINAMIS (satu untuk klien & server) ───────────────────
 * Murni fungsi tanggal terhadap jatuh tempo TAGIHAN (nextBillingDate):
 *   lewat            → "menunggak"  (merah — "Lewat tempo X hari")
 *   H-3 s.d. H+0     → "jatuhTempo" (kuning)
 *   masih jauh       → "lunas"      (siklus terbayar — mereset status dasar
 *                                     basi, mis. menunggak warisan generator)
 *
 * Kondisi "invoice periode tersebut belum lunas" TERJAMIN STRUKTURAL: satu-
 * satunya cara nextBillingDate berjalan maju adalah aksi "Tandai Lunas"
 * (server PATCH /api/invoices & lokal demo) — jadi "hari ini > nextBillingDate"
 * selalu berarti periode berjalan memang belum dibayar. Kamar lama tanpa
 * nextBillingDate memakai fallback contractEnd (perilaku model lama utuh).
 *
 * @param base  status tersimpan di database (tidak dipercaya mentah)
 * @param due   tanggal jatuh tempo tagihan (Date apa pun — dinormalisasi)
 * @param today hari ini
 */
export function deriveStatusFromBilling(
  base: RoomStatus,
  due: Date | null,
  today: Date,
): RoomStatus {
  if (base === "kosong" || !due) return base;
  const daysLeft = contractDaysLeft(due, today);
  // Hari ini > jatuh tempo tagihan → lewat tempo (merah)
  if (daysLeft < 0) return "menunggak";
  // H-3 s.d. H+0 → segera jatuh tempo (kuning)
  if (daysLeft <= DUE_SOON_DAYS) return "jatuhTempo";
  // Tagihan berikutnya masih jauh → siklus terbayar (hijau)
  return "lunas";
}

/** Status efektif satu kamar — membaca jatuh tempo tagihan dari objek Room. */
export function deriveRoomStatus(room: Room, today: Date = new Date()): RoomStatus {
  return deriveStatusFromBilling(room.status, billingDueOf(room).date, today);
}

/** true bila tagihan kamar SUDAH LEWAT jatuh temponya — dasar merahnya baris
 *  tanggal kartu ("Habis:"/"Tempo:") pada kartu menunggak. */
export function isBillingOverdue(room: Room, today: Date = new Date()): boolean {
  const due = billingDueOf(room).date;
  return due != null && contractDaysLeft(due, today) < 0;
}

/** true bila KONTRAK kamar sudah lewat tanggal habisnya — MASA KOMITMEN
 *  berakhir (bukan tentu menunggak tagihan; alarm tagihan memakai
 *  isBillingOverdue). Dipakai Perpanjang Sewa & pengingat kontrak. */
export function isContractPastEnd(room: Room, today: Date = new Date()): boolean {
  const end = contractEndOf(room).date;
  return end != null && contractDaysLeft(end, today) < 0;
}

/**
 * ── Teks keterangan keterlambatan/jatuh tempo (baris merah/kuning kartu) ─────
 * Dihitung REAL-TIME dari selisih hari today vs jatuh tempo TAGIHAN —
 * memakai SUMBER TANGGAL YANG SAMA dengan aturan status di atas, sehingga
 * teks dan warna kartu mustahil berbeda (tanpa split-brain):
 *
 *   tagihan lewat           → "Lewat tempo 5 hari"   (kartu menunggak)
 *   tepat hari jatuh tempo  → "Jatuh tempo hari ini" (kartu jatuh tempo)
 *   H-3 s.d. H-1            → "Jatuh tempo 2 hari lagi"
 *   selain itu              → null (tanpa baris — masa sewa aman / tanpa
 *                             tanggal acuan)
 */
export function arrearsLine(room: Room, today: Date = new Date()): string | null {
  const due = billingDueOf(room).date;
  if (!due) return null;
  const daysLeft = contractDaysLeft(due, today);
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
