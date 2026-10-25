// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sinkronisasi otomatis status kamar berbasis masa habis kontrak
//
// Masalah: status kamar ("lunas") tersimpan denormalisasi di kolom
// rooms.status dan hanya berubah saat invoice dibuat/dibayar — kamar milik
// penyewa yang kontraknya SUDAH LEWAT (rooms.contractEnd < hari ini) tapi
// belum ada pembayaran tagihan baru tetap tampil "Lunas" selamanya.
//
// Solusi: saat GET /api/rooms, evaluasi setiap kamar:
//   status "lunas" + contractEnd sudah lewat + TIDAK ada pembayaran tagihan
//   baru (invoice lunas dengan paidAt setelah tanggal habis kontrak)
//     → 1–7 hari lewat  : "jatuhTempo"  (badge kuning)
//     → lebih dari 7 hari: "menunggak"  (badge merah)
// Status baru dipersist ke database (best-effort, fail-open sesuai doktrin
// GET) SEKALIGUS diterapkan ke payload respons agar denah & tab filter
// (Lunas / Jatuh Tempo / Menunggak) langsung akurat tanpa reload manual.
//
// Note: kontrak penyewa tersimpan di kolom rooms.contractEnd (dikunci saat
// check-in & diperpanjang via modal Perpanjang Sewa) — kolom inilah yang
// dievaluasi, bukan tabel tenants.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/prisma";

/** Grace period (hari) setelah habis kontrak: masih "Jatuh Tempo" (kuning);
 *  melewati batas ini → "Menunggak" (merah). */
export const OVERDUE_GRACE_DAYS = 7;

export interface RoomStatusRow {
  id: string;
  status: string;
  contractEnd: Date | null;
}

export type OverdueStatus = "jatuhTempo" | "menunggak";

/**
 * Fungsi murni — status baru utk satu kamar, atau null bila tidak perlu
 * berubah. `lastPaymentAt` = tanggal pembayaran tagihan TERAKHIR (invoice
 * lunas, paidAt); bila pembayaran terjadi SETELAH kontrak habis, pemilik
 * sudah menerima pembayaran baru → status tetap "Lunas".
 */
export function deriveContractOverdueStatus(
  status: string,
  contractEnd: Date | null,
  today: Date,
  lastPaymentAt?: Date | null,
): OverdueStatus | null {
  if (status !== "lunas" || !contractEnd) return null;
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysPast = Math.floor((todayMid.getTime() - contractEnd.getTime()) / 86_400_000);
  // Hari ini > tanggal habis kontrak (minimal lewat 1 hari penuh)
  if (daysPast < 1) return null;
  // Sudah ada pembayaran tagihan baru setelah kontrak habis → tetap Lunas
  if (lastPaymentAt && lastPaymentAt.getTime() > contractEnd.getTime()) return null;
  return daysPast <= OVERDUE_GRACE_DAYS ? "jatuhTempo" : "menunggak";
}

/**
 * Evaluasi & sinkronkan kumpulan kamar (hasil db.room.findMany). Hanya kamar
 * berstatus "lunas" dgn contractEnd terisi yang dievaluasi — satu query
 * invoice tambahan HANYA bila ada kandidat; setelah status ter-persist,
 * pemanggilan berikutnya tanpa biaya tambahan (steady-state zero-overhead).
 *
 * Fail-open: kegagalan DB dicatat ke console, payload tetap dikembalikan
 * (status ter-derive tetap diterapkan di memori agar UI konsisten).
 */
export async function syncContractOverdueStatuses<TRow extends RoomStatusRow>(
  rows: TRow[],
  today: Date = new Date(),
): Promise<TRow[]> {
  try {
    const candidates = rows.filter((r) => r.status === "lunas" && r.contractEnd != null);
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

    // Derive status baru + persist (best-effort) — kumpulkan dulu supaya
    // query pembayaran tunggal, lalu update paralel.
    const flips: { row: TRow; next: OverdueStatus }[] = [];
    for (const row of candidates) {
      const next = deriveContractOverdueStatus(
        row.status,
        row.contractEnd,
        today,
        lastPaid.has(row.id) ? new Date(lastPaid.get(row.id)!) : null,
      );
      if (next) flips.push({ row, next });
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
    if (flips.some(({ row }) => rows.includes(row))) {
      console.info(
        `[room-status-sync] ${flips.length} kamar digeser status kontraknya: ${flips
          .map(({ row, next }) => `${row.id}→${next}`)
          .join(", ")}`,
      );
    }
    return rows;
  } catch (err) {
    // GET fail-open: jangan pernah menjatuhkan dashboard karena sync ini.
    console.error("[room-status-sync] gagal sinkron status kontrak:", err);
    return rows;
  }
}
