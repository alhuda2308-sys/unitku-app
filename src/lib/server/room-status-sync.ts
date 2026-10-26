// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sinkronisasi otomatis status kamar berbasis SIKLUS TAGIHAN
//
// Status efektif kamar TIDAK dibaca mentah dari kolom rooms.status yang
// denormalisasi — melainkan DIHITUNG murni dari selisih hari ini terhadap
// rooms.nextBillingDate (jatuh tempo tagihan berikutnya), memakai ATURAN YANG
// SAMA PERSIS dengan sisi klien (src/lib/room-status.ts — single source of
// truth deriveStatusFromBilling):
//
//   status apa pun + tagihan sudah lewat tempo   → "menunggak" (merah)
//   status apa pun + H-3..H+0 jatuh tempo        → "jatuhTempo" (kuning)
//   status apa pun + tagihan berikutnya masih jauh → "lunas" (terbayar)
//
// Fallback data lama: kamar pra-refaktor tanpa nextBillingDate dievaluasi
// dari rooms.contractEnd (semantik model lama) — perilaku identik sampai
// "Tandai Lunas" pertama menginisialisasi penanda billing (lihat
// PATCH /api/invoices).
//
// Saat GET /api/rooms status baru dipersist ke database (best-effort,
// fail-open sesuai doktrin GET) SEKALIGUS diterapkan ke payload respons agar
// denah & tab filter (Lunas / Jatuh Tempo / Menunggak) langsung akurat tanpa
// reload manual. Klien tetap menghitung ulang secara independen sehingga UI
// tetap benar walau persist gagal.
//
// Note: contractEnd TIDAK lagi menentukan status (decoupled) — kolom itu kini
// murni batas masa komitmen sewa ("Habis:", sisa hari kontrak).
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/prisma";
import type { RoomStatus } from "@/lib/kost-data";
import { deriveStatusFromBilling } from "@/lib/room-status";

export interface RoomStatusRow {
  id: string;
  status: string;
  contractEnd: Date | null;
  nextBillingDate: Date | null;
}

/**
 * Evaluasi & sinkronkan kumpulan kamar (hasil db.room.findMany). Semua kamar
 * TERISI dengan penanda tempo (nextBillingDate atau fallback contractEnd)
 * dievaluasi — tanpa query tambahan; setelah status ter-persist, pemanggilan
 * berikutnya tanpa perubahan (steady-state zero-overhead).
 *
 * Fail-open: kegagalan DB dicatat ke console, payload tetap dikembalikan
 * (status ter-derive tetap diterapkan di memori agar UI konsisten).
 */
export async function syncContractOverdueStatuses<TRow extends RoomStatusRow>(
  rows: TRow[],
  today: Date = new Date(),
): Promise<TRow[]> {
  try {
    const candidates = rows.filter(
      (r) => r.status !== "kosong" && (r.nextBillingDate != null || r.contractEnd != null),
    );
    if (candidates.length === 0) return rows;

    // Derive status efektif dgn aturan yang sama persis dgn klien, lalu persist
    // (best-effort) — murni tanggal jatuh tempo tagihan.
    const flips: { row: TRow; next: string }[] = [];
    for (const row of candidates) {
      const due = row.nextBillingDate ?? row.contractEnd;
      const next = deriveStatusFromBilling(row.status as RoomStatus, due, today);
      if (next !== row.status) flips.push({ row, next });
    }
    if (flips.length === 0) return rows;

    await Promise.allSettled(
      flips.map(({ row, next }) =>
        db.room.update({ where: { id: row.id }, data: { status: next } }),
      ),
    );

    // Terapkan ke payload respons apa pun hasil persist (fail-open) — denah,
    // badge kuning/merah, dan tab filter langsung akurat pada fetch ini.
    for (const { row, next } of flips) row.status = next;
    console.info(
      `[room-status-sync] ${flips.length} kamar digeser status tagihannya: ${flips
        .map(({ row, next }) => `${row.id}→${next}`)
        .join(", ")}`,
    );
    return rows;
  } catch (err) {
    // GET fail-open: jangan pernah menjatuhkan dashboard karena sync ini.
    console.error("[room-status-sync] gagal sinkron status tagihan:", err);
    return rows;
  }
}
