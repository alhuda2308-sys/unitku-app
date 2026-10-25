// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sinkronisasi otomatis status kamar berbasis masa habis kontrak
//
// Status efektif kamar TIDAK dibaca mentah dari kolom rooms.status yang
// denormalisasi (hanya berubah saat invoice dibuat/dibayar) — melainkan
// DIHITUNG dari selisih hari ini terhadap rooms.contractEnd + pembayaran
// tagihan baru, memakai ATURAN YANG SAMA PERSIS dengan sisi klien
// (src/lib/room-status.ts — single source of truth deriveStatusFromContract):
//
//   status "lunas"  + kontrak habis H-3..H+0, tanpa bayar baru → "jatuhTempo"
//   status "lunas"  + kontrak sudah lewat,    tanpa bayar baru → "menunggak"
//   status "jatuhTempo" + kontrak sudah lewat                  → "menunggak"
//   (pembayaran tagihan pada/setelah tanggal habis → tetap "Lunas")
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
import { deriveStatusFromContract, midnightLocal } from "@/lib/room-status";

export interface RoomStatusRow {
  id: string;
  status: string;
  contractEnd: Date | null;
}

/**
 * Evaluasi & sinkronkan kumpulan kamar (hasil db.room.findMany). Semua kamar
 * TERISI dengan contractEnd terisi dievaluasi — satu query invoice tambahan
 * HANYA bila ada kandidat; setelah status ter-persist, pemanggilan berikutnya
 * tanpa perubahan (steady-state zero-overhead).
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

    // Pembayaran tagihan terakhir per kamar (invoice lunas) — paidAt, fallback
    // updatedAt (invoice lama mungkin belum punya paidAt).
    const ids = candidates.map((r) => r.id);
    const paidRows = await db.invoice.findMany({
      where: { roomId: { in: ids }, status: "lunas" },
      select: { roomId: true, paidAt: true, updatedAt: true },
    });
    const lastPaid = new Map<string, number>();
    for (const inv of paidRows) {
      const at = (inv.paidAt ?? inv.updatedAt).getTime();
      const prev = lastPaid.get(inv.roomId);
      if (prev === undefined || at > prev) lastPaid.set(inv.roomId, at);
    }

    // Derive status efektif dgn aturan yang sama dgn klien, lalu persist
    // (best-effort) — kumpulkan dulu supaya query pembayaran tunggal.
    const flips: { row: TRow; next: string }[] = [];
    for (const row of candidates) {
      const next = deriveStatusFromContract(
        row.status as RoomStatus,
        row.contractEnd,
        today,
        lastPaid.has(row.id) ? new Date(lastPaid.get(row.id)!) : null,
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

/** Tengah malam lokal — diekspor ulang utk pemakaian server bila perlu. */
export { midnightLocal };
