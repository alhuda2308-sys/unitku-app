// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Atribusi periode & dedup pemasukan sewa Buku Kas (client-safe)
//
// Laporan pemilik (perbandingan data Nov 2026): Tagihan & Invoice memuat 19
// invoice lunas senilai Rp30.700.000, tetapi Buku Kas mencatat 21 transaksi
// senilai Rp34.000.000 untuk bulan yang sama — selisih 2 entri dobel.
//
//   1) DOBEL — dedup lama hanya menggabungkan entri bila DESKRIPSI identik
//      100%, padahal dua jalur otomatis menghasilkan teks berbeda untuk
//      kamar & bulan yang sama:
//        • KM-AUTO-INV-…  (pelunasan invoice)  → "Pembayaran sewa Kamar 01-01
//          - {tenantName di INVOICE} (Sewa Nov 2026)" nominal invoice.total;
//        • KM-ROOMSYNC2-… (backfill sinkron)   → "Pembayaran sewa Kamar 01-01
//          - {tenantName di KAMAR} (Sewa Nov 2026)" nominal room.price.
//      Nama penyewa/nominal yang menyimpang membuat teks tak identik → entri
//      dobel lolos dan Buku Kas mendobel.
//   2) BULAN MELESET — tagihan dibayar telat (invoice periode Okt 2026 yang
//      baru lunas Nov 2026) tercatat ber-tanggal bayar → masuk filter Nov,
//      tidak selaras dgn "Sudah Diterima" Tagihan yang mengelompokkan per
//      PERIODE tagihan.
//
// Solusi (murni fungsi — aman diimpor client & server, tanpa dependensi db):
//   • KUNCI DEDUP (properti + kamar + PERIODE BULAN) — bukan kecocokan teks.
//     Satu kamar utk satu periode bulan maksimal SATU entri pemasukan sewa
//     bulanan. Prioritas sumber: invoice lunas (KM-AUTO-INV-…) > perpanjangan
//     (KM-AUTO-RENEW-…) > auto lain > backfill sinkron (KM-ROOMSYNC…) — entri
//     yang kalah di SEMUA bulannya disembunyikan saat baca (non-destruktif,
//     tidak dihapus dari database).
//   • ATRIBUSI PERIODE — rentalPrimaryMonthOf() memetakan entri sewa otomatis
//     ke bulan periode tagihan di deskripsinya ("(Sewa Okt 2026)" → 2026-10),
//     dipakai filter bulan Buku Kas agar total bulanan = angka Tagihan.
//   • PENGAMAN:
//       - hanya entri OTOMATIS ber-pola id "KM-AUTO-*" / "KM-ROOMSYNC*" yang
//         tersentuh — catatan manual pemilik (id "KM-###" numerik dari
//         nextCashId, "KX-…", "KAS-…") TIDAK PERNAH disembunyikan;
//       - siklus pendek Mingguan/Harian (periode ber-precision tanggal,
//         "(Sewa 12 Nov 2026)") sah memiliki beberapa pembayaran dalam satu
//         bulan kalender → tidak digulung per bulan (dedup teks lama);
//       - entri tanpa kunci kamar & tanpa periode → dedup teks lama.
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

/** monthKey "yyyy-mm" dari dateSort "yyyyMMdd" — fallback atribusi tanpa
 *  periode di deskripsi (data lama). */
function monthKeyFromSort(dateSort: number): string {
  const s = String(dateSort).padStart(8, "0");
  return `${s.slice(0, 4)}-${s.slice(4, 6)}`;
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

/** Field minimal entri kas yang dibutuhkan dedup & atribusi (row DB maupun
 *  bentuk klien). propertyId opsional — menyertakan kunci dedup saat tersedia
 *  (baris mentah server) agar kamar bernomor sama lintas cabang tak saling
 *  meniadakan. */
export interface DedupableEntry {
  id: string;
  type: string;
  category: string;
  description: string;
  amount: number;
  dateSort: number;
  propertyId?: string | null;
}

/** Entri pemasukan sewa OTOMATIS (bukan catatan pemilik): id deterministik
 *  "KM-AUTO-…" (pelunasan invoice / perpanjangan) atau "KM-ROOMSYNC*"
 *  (backfill self-heal). Catatan manual pemilik ber-id "KM-###" numerik
 *  (nextCashId), "KX-…", dan "KAS-…" TIDAK termasuk — tak pernah tersentuh. */
function isAutoRentalEntry(e: Pick<DedupableEntry, "id" | "type" | "category">): boolean {
  return (
    e.type === "masuk" &&
    e.category === "Sewa Kamar" &&
    (e.id.startsWith("KM-AUTO-") || e.id.startsWith("KM-ROOMSYNC"))
  );
}

/** Slug roomId dari id backfill/perpanjangan — KM-ROOMSYNC-<slug>,
 *  KM-ROOMSYNC2-<slug>-<yyyyMMdd>, KM-AUTO-RENEW-<slug>-<yyyyMMdd>.
 *  KM-AUTO-INV-… memuat id INVOICE (bukan kamar) → tidak cocok → null. */
function roomSlugFromId(id: string): string | null {
  const m = /^KM-(?:AUTO-RENEW|ROOMSYNC2?)-([A-Za-z0-9-]+?)(?:-\d{8})?$/.exec(id);
  return m ? m[1] : null;
}

/** Kunci kamar dari deskripsi kanonik — "… Kamar 01-01 - Afra (Sewa …)" →
 *  "01-01" (lowercase). Berhenti di " - ", " (", atau akhir teks; nomor kamar
 *  bertanda hubung ("01-01") tetap utuh. */
function roomKeyFromDescription(description: string): string | null {
  const re = /\bkamar\s+([^()]*?)\s*(?=\s[-–—]\s|\(|$)/i;
  const m = re.exec(description);
  if (!m) return null;
  const nomor = m[1].trim().toLowerCase().replace(/\s+/g, " ");
  return nomor || null;
}

/** Kunci kamar utk dedup — deskripsi DULULAH (nomor kamar unik per properti &
 *  konsisten di SEMUA jalur pencatatan: pelunasan invoice memakai nomor kamar
 *  murni, begitu juga backfill & perpanjangan), slug id hanya fallback utk
 *  entri yang deskripsinya tak menyebut "Kamar <nomor>". Perhatian: slug id
 *  (KM-ROOMSYNC2-<roomIdSlug>) dan nomor kamar ("01-05") adalah dua ruang
 *  nilai berbeda utk kamar yang sama — mencampurnya membuat entri dobel tak
 *  pernah bertemu di kunci yang sama. */
function roomKeyOf(e: DedupableEntry): string | null {
  return roomKeyFromDescription(e.description) ?? roomSlugFromId(e.id);
}

/** Siklus pendek (Mingguan/Harian) — periode ber-precision tanggal
 *  "(Sewa 12 Nov 2026)": sah ada beberapa pembayaran dalam SATU bulan
 *  kalender → JANGAN digulung per bulan; dedup teks lama yang berlaku. */
function isShortCycleDescription(description: string): boolean {
  return /\(\s*(?:Sewa|Periode)\s+\d{1,2}\s+[A-Za-z]+/i.test(description);
}

/** Semua monthKey yang DITUTUP entri — periode di deskripsi; fallback bulan
 *  tanggal entri bila deskripsi tanpa periode (data lama). */
function coveredMonthsOf(e: DedupableEntry): string[] {
  const months = periodMonthsFromDescription(e.description);
  return months.length > 0 ? months : [monthKeyFromSort(e.dateSort)];
}

/** Prioritas sumber — angka kecil = menang: invoice lunas (KM-AUTO-INV-…,
 *  KM-AUTO-…) > perpanjangan (KM-AUTO-RENEW-…) > backfill sinkronisasi
 *  (KM-ROOMSYNC…). Invoice adalah single source of truth Tagihan & Invoice. */
function sourcePriorityOf(id: string): number {
  if (id.startsWith("KM-AUTO-RENEW-")) return 1;
  if (id.startsWith("KM-AUTO-")) return 0;
  return 3;
}

/**
 * monthKey atribusi FILTER BULAN utk satu entri kas:
 *   • pemasukan sewa OTOMATIS → bulan PERIODE TAGIHAN di deskripsi (bulan
 *     pertama yang ditutup; "… (Sewa Okt 2026)" ber-tanggal kas Nov tetap
 *     terhitung di Okt) — total Sewa Kamar bulanan Buku Kas jadi sama persis
 *     dgn "Sudah Diterima" Tagihan & Invoice periode yang sama;
 *   • entri lain (manual pemilik, pengeluaran, auto tanpa periode) → null,
 *     pemanggil fallback ke bulan tanggal entri (dateSort).
 * HANYA bulan pertama yang dikembalikan — entri satu pembayaran tampil SEKALI
 * (di bulan periode awalnya), tidak digandakan ke tiap bulan rentangnya.
 */
export function rentalPrimaryMonthOf(e: {
  id: string;
  type: string;
  category: string;
  description: string;
  dateSort: number;
}): string | null {
  if (!isAutoRentalEntry(e)) return null;
  const months = periodMonthsFromDescription(e.description);
  if (months.length > 0) return months[0];
  return monthKeyFromSort(e.dateSort);
}

/** id entri yang DIHILANGKAN dari tampilan karena dobel terdeteksi. */
export function duplicateAutoRentalIncomeIds<T extends DedupableEntry>(
  entries: T[],
): Set<string> {
  // ── PASS A — kunci (properti + kamar + PERIODE BULAN) ──────────────────────
  // Satu kamar utk satu periode bulan maksimal SATU entri pemasukan sewa
  // bulanan: pemenang per bulan = sumber berprioritas tertinggi (invoice
  // lunas selalu mengalahkan backfill sinkronisasi), seri → entri terlama
  // (dateSort, lalu id — deterministik). Entri yang kalah di SELURUH bulan
  // yang dicakupnya disembunyikan; yang masih memenangkan minimal satu
  // bulan tetap tampil (satu pembayaran, satu baris).
  interface MonthlyMeta {
    e: T;
    propKey: string;
    roomKey: string;
    months: string[];
    priority: number;
  }
  const monthly: MonthlyMeta[] = [];
  const fallback: T[] = [];
  for (const e of entries) {
    if (!isAutoRentalEntry(e)) continue; // catatan manual pemilik — tak tersentuh
    if (isShortCycleDescription(e.description)) {
      fallback.push(e); // siklus Mingguan/Harian — beberapa pembayaran/bulan sah
      continue;
    }
    const roomKey = roomKeyOf(e);
    if (!roomKey) {
      fallback.push(e); // tak terpetakan ke kamar — dedup teks lama
      continue;
    }
    monthly.push({
      e,
      propKey: e.propertyId ?? "",
      roomKey,
      months: coveredMonthsOf(e),
      priority: sourcePriorityOf(e.id),
    });
  }

  const dropped = new Set<string>();
  const winnerByMonth = new Map<string, MonthlyMeta>();
  for (const meta of monthly) {
    for (const month of meta.months) {
      const key = `${meta.propKey}|${meta.roomKey}|${month}`;
      const cur = winnerByMonth.get(key);
      if (!cur) {
        winnerByMonth.set(key, meta);
        continue;
      }
      const challengerWins =
        meta.priority < cur.priority ||
        (meta.priority === cur.priority &&
          (meta.e.dateSort < cur.e.dateSort ||
            (meta.e.dateSort === cur.e.dateSort && meta.e.id < cur.e.id)));
      if (challengerWins) winnerByMonth.set(key, meta);
    }
  }
  for (const meta of monthly) {
    const ownsOne = meta.months.some(
      (m) =>
        winnerByMonth.get(`${meta.propKey}|${meta.roomKey}|${m}`)?.e.id === meta.e.id,
    );
    if (!ownsOne) dropped.add(meta.e.id);
  }

  // ── PASS B — fallback teks (siklus pendek & entri tanpa kunci kamar) ───────
  // Perilaku lama dipertahankan: deskripsi+nominal identik dgn entri KM-AUTO-
  // di grup = satu pembayaran yang sama → tampil sekali. Grup murni backfill
  // (KM-ROOMSYNC2 siklus pendek yang sah) dibiarkan utuh.
  const groups = new Map<string, T[]>();
  for (const e of fallback) {
    const key = `${e.propertyId ?? ""}|${e.description.trim().toLowerCase()}|${e.amount}`;
    const group = groups.get(key);
    if (group) group.push(e);
    else groups.set(key, [e]);
  }
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const autos = group
      .filter((e) => e.id.startsWith("KM-AUTO-"))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (autos.length === 0) continue;
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
