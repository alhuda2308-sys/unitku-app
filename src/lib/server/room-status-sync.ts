// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sinkronisasi otomatis status kamar (DUA alarm tanggal gabungan)
//
// Status efektif kamar TIDAK dibaca mentah dari kolom rooms.status yang
// denormalisasi — melainkan DIHITUNG murni dari selisih hari ini terhadap dua
// tanggal acuan, memakai ATURAN YANG SAMA PERSIS dengan sisi klien
// (src/lib/room-status.ts — single source of truth deriveStatusFromAnchors):
//
//   status apa pun + tagihan lewat tempo          → "menunggak" (merah)
//   status apa pun + contractEnd EKSPLISIT lewat  → "menunggak" (merah —
//                                                   alarm komitmen: kamar
//                                                   habis sewanya MUSTAHIL
//                                                   merah, walau kolom status
//                                                   masih "lunas")
//   salah satu H-3..H+0 jatuh tempo               → "jatuhTempo" (kuning)
//   dua-duanya masih jauh                          → "lunas" (terbayar)
//
// Fallback data lama: kamar pra-refaktor tanpa nextBillingDate dievaluasi
// dari rooms.contractEnd (semantik model lama) — perilaku identik sampai
// "Tandai Lunas" pertama menginisialisasi penanda billing (lihat
// PATCH /api/invoices).
//
// Saat GET /api/rooms status baru dipersist ke database (best-effort,
// fail-open sesuai doktrin GET) SEKALIGUS diterapkan ke payload respons agar
// denah & tab filter (Lunas / Jatuh Tempo / Menunggak) langsung akurat tanpa
// reload manual. Klien tetap menghitung ulang secara independen (real-time
// computed status) sehingga UI tetap benar walau persist gagal.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/prisma";
import type { RoomStatus } from "@/lib/kost-data";
import { deriveStatusFromAnchors } from "@/lib/room-status";

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

    // Derive status efektif dgn aturan gabungan yang sama persis dgn klien
    // (alarm tagihan + alarm kontrak eksplisit), lalu persist (best-effort).
    // nextBillingDate kosong → fallback contractEnd utk jalur tagihan (data
    // lama); contractEnd eksplisit jadi alarm komitmen kedua.
    const flips: { row: TRow; next: string }[] = [];
    for (const row of candidates) {
      const next = deriveStatusFromAnchors(
        row.status as RoomStatus,
        row.nextBillingDate ?? row.contractEnd,
        row.contractEnd,
        today,
      );
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
      `[room-status-sync] ${flips.length} kamar digeser status efektifnya: ${flips
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
