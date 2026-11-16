// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Atribusi periode & dedup pemasukan sewa Buku Kas (client-safe)
//
// Masalah dari laporan pemilik (Buku Kas Nov 2026: 31 transaksi / Rp50,3jt
// untuk properti 20 kamar):
//   1) DOBEL — satu pembayaran sewa tercatat dua kali dengan deskripsi kanonik
//      yang identik: entri "Tandai Lunas" (KM-AUTO-INV-…) + entri self-heal
//      backfill siklus (KM-ROOMSYNC2-…) lahir untuk kamar & periode yang sama.
//   2) BULAN MELESET — atribusi bukti lama hanya membaca bulan TANGGAL entri
//      (dateSort); padahal deskripsi kanonik selalu menyebut periode siklusnya:
//      "… (Sewa Okt 2026)" / "… (Periode Okt 2026 – Des 2026)". Tagihan dibayar
//      telat (paidAt Des utk periode Okt) dan perpanjangan multi-siklus
//      (nominal 3× tarif, tanggal aksi Nov) mencakup bulan-bulan lain yang
//      tak ikut tertutup → bulan tsb di-backfill ULANG padahal sudah terbayar.
//
// Solusi (murni fungsi — aman diimpor client & server, tanpa dependensi db):
//   • periodMonthsFromDescription — parse SEMUA periode yang disebut deskripsi
//     (tunggal maupun rentang, termasuk label ber-tanggal "12 Nov 2026" utk
//     siklus Mingguan/Harian) → daftar monthKey "yyyy-mm" yang ditutupnya.
//   • duplicateAutoRentalIncomeIds / applyRentalIncomeDedup — dedup NON-
//     DESTRUKTIF saat baca: entri OTOMATIS (id "KM-…") kategori "Sewa Kamar"
//     dengan deskripsi+nominal identik = satu pembayaran yang sama → tampil
//     sekali. Aturan aman:
//       - hanya grup yang memuat entri KM-AUTO- (invoice/perpanjangan) yang
//         di-dedup — grup murni KM-ROOMSYNC2 (backfill per siklus Mingguan/
//         Harian yang sah, deskripsi lama identik per bulan) DIBIARKAN utuh;
//       - entri manual pemilik (id selain "KM-") tidak pernah tersentuh;
//       - data tidak dihapus dari database — hanya disaring dari respons.
// ─────────────────────────────────────────────────────────────────────────────

import { MONTH_NAMES } from "./kost-data";

/** monthKey "yyyy-mm" dari token tanggal kanonik "12 Nov 2026" / "Nov 2026". */
function monthKeyFromToken(token: string): string | null {
  const parts = token.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const monthName = parts[parts.length === 2 ? 0 : 1]; // "Nov 2026" | "12 Nov 2026"
  const year = parts[parts.length - 1];
  const monthIdx = MONTH_NAMES.findIndex(
    (m) => m.toLowerCase() === monthName.toLowerCase(),
  );
  if (monthIdx < 0 || !/^\d{4}$/.test(year)) return null;
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
}

/**
 * Semua monthKey "yyyy-mm" yang dicakup deskripsi kanonik pemasukan sewa:
 *   "Pembayaran sewa Kamar 08 - X (Sewa Okt 2026)"        → ["2026-10"]
 *   "Perpanjangan sewa Kamar 08 - X (Periode Nov 2026)"   → ["2026-11"]
 *   "… (Periode Okt 2026 – Des 2026)"                     → 2026-10 … 2026-12
 *   "… (Sewa 12 Nov 2026)"  (siklus Mingguan/Harian)      → ["2026-11"]
 * Rentang dibuka penuh (inklusif, batas 36 bulan demi sanity). Tanpa match →
 * [] — pemanggil fallback ke bulan tanggal entri (dateSort).
 */
export function periodMonthsFromDescription(description: string): string[] {
  if (!description) return [];
  const months = new Set<string>();
  const re =
    /\((?:Sewa|Periode)\s+((?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4})(?:\s*[–—-]\s*((?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}))?\s*\)/gi;
  for (const match of description.matchAll(re)) {
    const start = monthKeyFromToken(match[1]);
    if (!start) continue;
    months.add(start);
    if (match[2]) {
      const end = monthKeyFromToken(match[2]);
      if (!end || end <= start) continue;
      const [sy, sm] = start.split("-").map(Number);
      const [ey, em] = end.split("-").map(Number);
      let cursorY = sy;
      let cursorM = sm;
      let guard = 0;
      while ((cursorY < ey || (cursorY === ey && cursorM <= em)) && guard < 36) {
        months.add(`${cursorY}-${String(cursorM).padStart(2, "0")}`);
        cursorM += 1;
        if (cursorM > 12) {
          cursorM = 1;
          cursorY += 1;
        }
        guard += 1;
      }
    }
  }
  return [...months].sort();
}

/** Field minimal entri kas yang dibutuhkan dedup (row DB maupun bentuk klien). */
interface DedupableEntry {
  id: string;
  type: string;
  category: string;
  description: string;
  amount: number;
}

/** id entri yang DIHILANGKAN dari tampilan karena dobel terdeteksi. */
export function duplicateAutoRentalIncomeIds<T extends DedupableEntry>(
  entries: T[],
): Set<string> {
  // Grup entri OTOMATIS (id "KM-…") kategori "Sewa Kamar" per (deskripsi, nominal)
  // — deskripsi kanonik memuat nomor kamar + periode, jadi identik berarti
  // kamar sama + periode sama + nominal sama = satu pembayaran yang sama.
  const groups = new Map<string, T[]>();
  for (const e of entries) {
    if (e.type !== "masuk" || e.category !== "Sewa Kamar") continue;
    if (!e.id.startsWith("KM-")) continue; // catatan manual pemilik — tak tersentuh
    const key = `${e.description.trim().toLowerCase()}|${e.amount}`;
    const group = groups.get(key);
    if (group) group.push(e);
    else groups.set(key, [e]);
  }

  const dropped = new Set<string>();
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    // Dedup HANYA bila grup memuat entri KM-AUTO- (invoice/perpanjangan):
    // keberadaannya membuktikan ada pencatatan "resmi" utk pembayaran itu.
    // Grup murni KM-ROOMSYNC2 (semua backfill, deskripsi identik) adalah
    // pola SAH siklus Mingguan/Harian berdurasi pendek — dibiarkan utuh.
    if (!group.some((e) => e.id.startsWith("KM-AUTO-"))) continue;
    // Pertahankan entri KM-AUTO- pertama (id terkecil — deterministik),
    // hilangkan sisanya (umumnya KM-ROOMSYNC2-… hasil self-heal).
    const autos = group
      .filter((e) => e.id.startsWith("KM-AUTO-"))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const keepId = autos[0].id;
    for (const e of group) if (e.id !== keepId) dropped.add(e.id);
  }
  return dropped;
}

/** Versi siap pakai — kembalikan daftar entri tanpa yang dobel (immutable). */
export function applyRentalIncomeDedup<T extends DedupableEntry>(entries: T[]): T[] {
  const dropped = duplicateAutoRentalIncomeIds(entries);
  if (dropped.size === 0) return entries;
  return entries.filter((e) => !dropped.has(e.id));
}
