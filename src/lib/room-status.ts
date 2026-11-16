// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sumber kebenaran TUNGGAL status kamar (DUA alarm tanggal gabungan)
//
// Dua tanggal, dua alarm — status efektif = yang LEBIH BURUK di antara keduanya:
//   • nextBillingDate  — jatuh tempo TAGIHAN berikutnya (siklus pembayaran
//     berulang). Maju 1 siklus sewa setiap "Tandai Lunas" (Bulanan +1 bln,
//     Mingguan +7 hari, Harian +1 hari/checkout) TANPA menyentuh kontrak.
//   • contract.endDate — BATAS MASA KOMITMEN sewa ("Habis:" di kartu, sisa
//     hari kontrak, tab Akan Keluar) — EKSPLISIT, dikunci saat check-in /
//     Perpanjang Sewa. LEWAT → kamar PAKSA "menunggak" walau kolom status
//     database masih "lunas" (permintaan pemilik: kamar yang sudah melewati
//     tanggal habis sewanya MUSTAHIL tampil hijau "Lunas" saat halaman
//     dimuat — status dihitung real-time, bukan dibaca mentah dari DB).
//
// ── Aturan status dinamis (murni tanggal, real-time) ─────────────────────────
//   kosong                              → kosong (tidak pernah disentuh)
//   tagihan lewat (today > nextBilling) → "menunggak" (merah — alarm tagihan)
//   kontrak eksplisit lewat (today > endDate) → "menunggak" (merah — alarm
//                                           komitmen; pemilik perlu
//                                           Perpanjang Sewa / checkout)
//   salah satu H-3 s.d. H+0             → "jatuhTempo" (kuning — segera jatuh
//                                           tempo, kecuali sisi lain sudah
//                                           menunggak)
//   dua-duanya masih jauh               → "lunas" (siklus terbayar)
//
// Masalah lama yang tetap dipecahkan: "Tandai Lunas" memajukan nextBillingDate
// satu siklus sehingga alarm TAGIHAN mereda natural tanpa menyentuh kontrak.
// Alarm KONTRAK kini kembali aktif (khusus endDate eksplisit) — komitmen yang
// habis wajib ditindak pemilik (Perpanjang Sewa / check-out), bukan diam
// hijau. EndDate KANONIK (masuk + 1 siklus, bila endDate kosong) TIDAK ikut
// alarm kontrak — itu asumsi, bukan komitmen yang dikunci; alarmnya cukup
// lewat jalur tagihan agar kamar bulanan pembayar setia tidak salah merah.
//
// ── Fallback data lama (pra-refaktor, nextBillingDate kosong) ────────────────
// Kamar lama belum punya kolom nextBillingDate → billingDueOf memakai
// contractEnd (eksplisit/kanonik) sebagai penanda tempo (semantik model lama
// persis: kontrak lewat = menunggak). Pada "Tandai Lunas" PERTAMA, server
// menginisialisasi nextBillingDate = max(contractEnd, hari ini) + 1 siklus
// sehingga kamar lama ter-migrasi alami tanpa skrip backfill.
//
// Solusi arsitektur: satu fungsi inti terpusat (getEffectiveRoomStatus →
// deriveStatusFromAnchors) dipakai bersama oleh:
//   • Klien  — hook useEffectiveRooms: kartu denah, kartu statistik
//              (MetricStrip/computeStats), tab filter, drawer, penghuni
//   • Server — room-status-sync (persist best-effort saat GET /api/rooms)
//   • Portal — /api/portal (mirror status utk penghuni)
// sehingga warna kartu denah, angka statistik & tab filter MUSTAHIL sinkron
// 100% — semuanya membaca status EFEKTIF yang sama.
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

/**
 * Mundur SATU siklus sewa — kebalikan advanceOneCycle. Dipakai self-heal Buku
 * Kas utk MENAKSIR tanggal pembayaran terakhir kamar yang hanya punya
 * nextBillingDate: siklus terbayar berakhir di nextBillingDate, jadi pembayaran
 * itu terjadi ≈ satu siklus sebelumnya. Harian −1 hari, Mingguan −7 hari,
 * Bulanan −1 bln (clamp ujung bulan), Per 3 Bulan −3, Tahunan −12.
 */
export function stepBackOneCycle(from: Date, duration: string | undefined | null): Date {
  switch (duration) {
    case "Harian":
      return new Date(from.getTime() - DAY_MS);
    case "Mingguan":
      return new Date(from.getTime() - 7 * DAY_MS);
    case "Per 3 Bulan":
      return addMonths(from, -3);
    case "Tahunan":
      return addMonths(from, -12);
    default:
      // "Bulanan" & durasi legacy/tak dikenal
      return addMonths(from, -1);
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
 * Tanggal "Habis" EKSPLISIT kamar — komitmen yang dikunci pemilik via
 * check-in / Perpanjang Sewa (bukan asumsi kanonik). INI sumber alarm
 * kontrak di getEffectiveRoomStatus: lewat → kamar paksa "menunggak".
 * null bila endDate kosong / tak dapat diparse (alarm kontrak dilewati).
 */
export function explicitContractEndOf(room: Room): Date | null {
  const explicit = room.contract?.endDate?.trim();
  if (!explicit) return null;
  const d = parseDateLabel(explicit);
  return Number.isNaN(d.getTime()) ? null : midnightLocal(d);
}

/**
 * Tanggal jatuh tempo TAGIHAN berikutnya — alarm pertama status kartu:
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

/** Status efektif satu kamar — alias getEffectiveRoomStatus (konsumen lama). */
export function deriveRoomStatus(room: Room, today: Date = new Date()): RoomStatus {
  return getEffectiveRoomStatus(room, today);
}

/**
 * ── FUNGSI TERPUSAT STATUS EFEKTIF KAMAR (real-time computed status) ─────────
 * Gabungan DUA alarm tanggal — yang LEBIH BURUK yang menang:
 *   1) Alarm TAGIHAN  — nextBillingDate (fallback contractEnd utk data lama)
 *      via deriveStatusFromBilling: "Tandai Lunas" menenangkannya natural.
 *   2) Alarm KONTRAK  — contract.endDate EKSPLISIT ("Habis:" di kartu):
 *      lewat → PAKSA "menunggak", H-3..H+0 → "jatuhTempo" — walau kolom
 *      status database masih "lunas" dan/atau tagihan berikutnya masih jauh.
 *
 * Kelas kamar kosong tidak pernah disentuh alarm (tetap "kosong"). EndDate
 * kanonik (tanpa endDate eksplisit) TIDAK memicu alarm kontrak — alarm kamar
 * begitu cukup dari jalur tagihan (billingDueOf sudah memfallback ke sana).
 *
 * Dipakai KONSISTEN oleh seluruh permukaan status: warna & badge kartu denah
 * (RoomCard), kartu statistik ringkasan (MetricStrip → computeStats), tab
 * filter status (RoomMatrix), drawer, direktori penghuni, portal penghuni,
 * dan persist server (room-status-sync) — satu sumber, mustahil beda.
 */
export function getEffectiveRoomStatus(room: Room, today: Date = new Date()): RoomStatus {
  return deriveStatusFromAnchors(
    room.status,
    billingDueOf(room).date,
    explicitContractEndOf(room),
    today,
  );
}

/**
 * Alarm KONTRAK — aturan tanggal yang sama dengan tagihan, tapi untuk batas
 * masa komitmen eksplisit: lewat → "menunggak"; H-3 s.d. H+0 → "jatuhTempo";
 * masih jauh / tanpa tanggal → null (tanpa pendapat — serahkan ke alarm
 * tagihan agar tidak menaikkan status yang tak didukung tanggal mana pun).
 */
function deriveStatusFromContract(
  base: RoomStatus,
  end: Date | null,
  today: Date,
): RoomStatus | null {
  if (base === "kosong" || !end) return null;
  const daysLeft = contractDaysLeft(end, today);
  if (daysLeft < 0) return "menunggak";
  if (daysLeft <= DUE_SOON_DAYS) return "jatuhTempo";
  return null;
}

/**
 * Gabungan dua alarm berbasis TANGGAL MENTAH — bentuk server-friendly dari
 * getEffectiveRoomStatus (room-status-sync hanya punya kolom DB, bukan objek
 * Room penuh). Prioritas paket terburuk: menunggak > jatuhTempo > lunas/basis.
 *
 * @param base        status tersimpan di database (tidak dipercaya mentah)
 * @param billingDue  jatuh tempo tagihan (SUDAH termasuk fallback data lama)
 * @param contractEnd tanggal "Habis" EKSPLISIT (null = tanpa alarm kontrak)
 * @param today       hari ini
 */
export function deriveStatusFromAnchors(
  base: RoomStatus,
  billingDue: Date | null,
  contractEnd: Date | null,
  today: Date,
): RoomStatus {
  if (base === "kosong") return "kosong";
  const byBilling = deriveStatusFromBilling(base, billingDue, today);
  const byContract = deriveStatusFromContract(base, contractEnd, today);
  if (byBilling === "menunggak" || byContract === "menunggak") return "menunggak";
  if (byBilling === "jatuhTempo" || byContract === "jatuhTempo") return "jatuhTempo";
  return byBilling;
}

/**
 * Selisih hari UTUH terhadap anchor TERBURUK kamar — minimum dari jatuh tempo
 * tagihan & tanggal "Habis" eksplisit yang tersedia (null bila tak ada satu
 * pun). SATU sumber untuk teks keterangan kartu (arrearsLine) & deteksi lewat
 * tempo (isRoomOverdue) sehingga teks, warna kartu & statistik selalu seirama.
 */
export function effectiveDaysLeftOf(room: Room, today: Date = new Date()): number | null {
  const anchors = [billingDueOf(room).date, explicitContractEndOf(room)].filter(
    (d): d is Date => d != null,
  );
  if (anchors.length === 0) return null;
  return Math.min(...anchors.map((d) => contractDaysLeft(d, today)));
}

/** true bila kamar TERISI sudah LEWAT salah satu tanggal acuannya (tagihan
 *  atau "Habis" eksplisit) — dasar merahnya baris tanggal kartu menunggak.
 *  Konsisten dengan getEffectiveRoomStatus: status "menunggak" dari tanggal
 *  selalu berarti fungsi ini true (kecuali menunggak basis tanpa tanggal). */
export function isRoomOverdue(room: Room, today: Date = new Date()): boolean {
  const daysLeft = effectiveDaysLeftOf(room, today);
  return daysLeft != null && daysLeft < 0;
}

/** true bila KONTRAK kamar sudah lewat tanggal habisnya — MASA KOMITMEN
 *  berakhir (bukan tentu menunggak tagihan; alarm tagihan memakai
 *  isRoomOverdue). Dipakai Perpanjang Sewa & pengingat kontrak. */
export function isContractPastEnd(room: Room, today: Date = new Date()): boolean {
  const end = contractEndOf(room).date;
  return end != null && contractDaysLeft(end, today) < 0;
}

/**
 * ── Teks keterangan keterlambatan/jatuh tempo (baris merah/kuning kartu) ─────
 * Dihitung REAL-TIME dari selisih hari today vs anchor TERBURUK kamar
 * (effectiveDaysLeftOf: jatuh tempo tagihan ATAU tanggal "Habis" eksplisit —
 * SUMBER TANGGAL YANG SAMA dengan aturan status getEffectiveRoomStatus),
 * sehingga teks, warna kartu & badge mustahil berbeda (tanpa split-brain):
 *
 *   anchor lewat           → "Lewat tempo 5 hari"   (kartu menunggak)
 *   tepat hari jatuh tempo → "Jatuh tempo hari ini" (kartu jatuh tempo)
 *   H-3 s.d. H-1           → "Jatuh tempo 2 hari lagi"
 *   selain itu             → null (tanpa baris — masa sewa aman / tanpa
 *                            tanggal acuan)
 */
export function arrearsLine(room: Room, today: Date = new Date()): string | null {
  const daysLeft = effectiveDaysLeftOf(room, today);
  if (daysLeft == null) return null;
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
