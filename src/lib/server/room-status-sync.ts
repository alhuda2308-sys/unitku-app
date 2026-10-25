// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sinkronisasi otomatis status kamar berbasis masa habis kontrak
//
// Status efektif kamar TIDAK dibaca mentah dari kolom rooms.status yang
// denormalisasi (hanya berubah saat invoice dibuat/dibayar) — melainkan
// DIHITUNG murni dari selisih hari ini terhadap rooms.contractEnd, memakai
// ATURAN YANG SAMA PERSIS dengan sisi klien (src/lib/room-status.ts —
// single source of truth deriveStatusFromContract, TANPA pengecualian
// pembayaran sejak 25 Okt 2026):
//
//   status "lunas"      + kontrak habis H-3..H+0 → "jatuhTempo" (kuning)
//   status apa pun      + kontrak sudah lewat    → "menunggak" (merah)
//   status "jatuhTempo" + kontrak sudah lewat    → "menunggak" (merah)
//
// Saat GET /api/rooms status baru dipersist ke database (best-effort,
// fail-open sesuai doktrin GET) SEKALIGUS diterapkan ke payload respons agar
// denah & tab filter (Lunas / Jatuh Tempo / Menunggak) langsung akurat tanpa
// reload manual. Klien tetap menghitung ulang secara independen sehingga UI
// tetap benar walau persist gagal.
//
// Note: kontrak penyewa tersimpan di kolom rooms.contractEnd (dikunci saat
// check-in & diperpanjang via modal Perpanjang Sewa) — kolom inilah yang
// dievaluasi, bukan tabel tenants.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/prisma";
import type { RoomStatus } from "@/lib/kost-data";
import { deriveStatusFromContract } from "@/lib/room-status";

export interface RoomStatusRow {
  id: string;
  status: string;
  contractEnd: Date | null;
}

/**
 * Evaluasi & sinkronkan kumpulan kamar (hasil db.room.findMany). Semua kamar
 * TERISI dengan contractEnd terisi dievaluasi — tanpa query tambahan; setelah
 * status ter-persist, pemanggilan berikutnya tanpa perubahan (steady-state
 * zero-overhead).
 *
 * Fail-open: kegagalan DB dicatat ke console, payload tetap dikembalikan
 * (status ter-derive tetap diterapkan di memori agar UI konsisten).
 */
export async function syncContractOverdueStatuses<TRow extends RoomStatusRow>(
  rows: TRow[],
  today: Date = new Date(),
): Promise<TRow[]> {
  try {
    const candidates = rows.filter((r) => r.status !== "kosong" && r.contractEnd != null);
    if (candidates.length === 0) return rows;

    // Derive status efektif dgn aturan yang sama persis dgn klien, lalu persist
    // (best-effort) — murni tanggal, tanpa pengecualian pembayaran.
    const flips: { row: TRow; next: string }[] = [];
    for (const row of candidates) {
      const next = deriveStatusFromContract(
        row.status as RoomStatus,
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
      `[room-status-sync] ${flips.length} kamar digeser status kontraknya: ${flips
        .map(({ row, next }) => `${row.id}→${next}`)
        .join(", ")}`,
    );
    return rows;
  } catch (err) {
    // GET fail-open: jangan pernah menjatuhkan dashboard karena sync ini.
    console.error("[room-status-sync] gagal sinkron status kontrak:", err);
    return rows;
  }
}
