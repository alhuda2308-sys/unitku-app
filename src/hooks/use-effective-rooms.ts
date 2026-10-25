// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — HOOK UTAMA penampil data kamar (single source of truth status)
//
// HOOK UNIVERSAL: dipakai semua jenis akun (Akun Admin, Akun Pemilik/User
// Riil, sesi Staf, maupun Mode Demo) dan semua properti (multi-cabang) —
// input apa pun array `rooms` aktif, output selalu kamar berstatus EFEKTIF.
//
// Status kamar TIDAK pernah dibaca mentah dari `room.status` (kolom database
// denormalisasi / dataset statis). Status efektif DIHITUNG realtime dari:
//   • contract_end_date (atau fallback kanonik masuk + 1 siklus sewa)
//   • selisih terhadap HARI INI (tengah malam lokal, stabil lintas zona waktu)
//   • pembayaran tagihan terakhir (shield alarm palsu — periode baru dibayar)
//
// Klasifikasi (aturan di src/lib/room-status.ts — dipakai bersama server):
//   lewat tanggal habis (diffDays > 0 vs today-endDate) → "menunggak"
//   H-3 s.d. H+0                                        → "jatuhTempo"
//   masa sewa aman                                       → "lunas" (status dasar)
//   kosong / tanpa tanggal habis                         → status dasar
//
// Konsumen wajib memakai hasil hook ini untuk SEMUA permukaan yang menampilkan
// status kamar (denah, kartu statistik, tab filter, direktori penghuni, portal
// mirror, dsb.) — kamar kontraknya lewat MUSTAHIL tampil "Lunas" di mana pun.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from "react";
import type { Room } from "@/lib/kost-data";
import {
  deriveRoomStatuses,
  lastPaymentDates,
  type PaymentDated,
} from "@/lib/room-status";

/**
 * Kamar berstatus EFEKTIF (dinamis berbasis tanggal kontrak vs hari ini).
 *
 * @param rooms    kamar aktif properti terpilih — mentah dari demo (demoData)
 *                 maupun cloud (Supabase `rooms` + `tenants`)
 * @param invoices daftar tagihan klien (label paidAt Indonesia) — sumber shield
 * @returns array BARU immutable; kamar tak berubah dipakai ulang referensinya
 *          agar memo/React aman. Taruh `today` hanya untuk pengujian.
 */
export function useEffectiveRooms(
  rooms: Room[],
  invoices: PaymentDated[],
  today?: Date,
): Room[] {
  // "Hari ini" dibekukan per commit render (bukan per kamar) supaya seluruh
  // permukaan dalam satu frame memakai tanggal yang sama — tidak ada flicker
  // klasifikasi saat lintas tengah malam.
  const now = useMemo(() => today ?? new Date(), [today]);
  const payments = useMemo(() => lastPaymentDates(invoices), [invoices]);
  return useMemo(
    () => deriveRoomStatuses(rooms, now, payments),
    [rooms, now, payments],
  );
}
