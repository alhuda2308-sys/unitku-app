// ─────────────────────────────────────────────────────────────────────────────
// Self-heal Buku Kas — backfill pemasukan sewa yang belum tercatat
//
// Masalah: pembayaran sewa bisa tercatat lunas (invoice berstatus "lunas",
// kamar hijau, nextBillingDate maju) TANPA entri pemasukan di Buku Kas —
// akibat jalur pembayaran lama sebelum pencatatan otomatis ada, pencatatan
// yang gagal di tengah request, atau check-in/perpanjangan lewat versi lama.
// Buku Kas tampak kosong (Total Pemasukan Rp0) padahal ada pemasukan.
//
// Solusi DUA pass (lihat syncMissingRentalIncome):
//   PASS 1 per INVOICE — setiap invoice lunas wajib punya entri kasnya.
//   PASS 2 per KAMAR per BULAN (period-aware) — setiap bulan siklus terbayar
//     kamar terisi wajib punya bukti pemasukan; bulan yang belum ada buktinya
//     di-backfill dgn tanggal jatuh tempo siklusnya. Menyembuhkan kasus
//     "14-15 kamar check-in Okt, diperpanjang Nov, kas Nov kosong" yang oleh
//     sinkron lama (satu entri per kamar seumur kamar) tak pernah terheal.
//
// Semua entri otomatis ber-id deterministik → IDEMPOTEN: dijalankan berapa
// kali pun (otomatis saat GET /api/cash, manual via POST /api/cash/sync)
// buku kas tidak pernah mendobel.
//
// Ringan: 3–4 query baca + create hanya utk yang benar-benar belum tercatat.
// Fail-open: kegagalan heal tidak pernah menjatuhkan endpoint pemanggil.
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { periodMonthsFromDescription } from "@/lib/cash-dedup";
import { dateSortFromLabel } from "@/lib/kost-cashflow";
import { dateToLabel, wibDateLabel, wibDateParts, wibMidnight } from "@/lib/kost-data";
import { periodShortLabel } from "@/lib/kost-invoices";
import { advanceOneCycle, stepBackOneCycle } from "@/lib/room-status";

/** ID deterministik & idempoten utk entri kas otomatis dari invoice —
 *  "#INV-202611-101" → "KM-AUTO-INV-202611-101". Semua jalur pencatatan
 *  otomatis (Tandai Lunas, check-in, self-heal) memakai id yang SAMA untuk
 *  invoice yang sama → create kedua kena P2002 dan diabaikan — buku kas
 *  tidak pernah dobel. */
export function autoCashId(invoiceId: string): string {
  return `KM-AUTO-${invoiceId.replace(/[^A-Za-z0-9-]/g, "")}`;
}

/** ID deterministik utk entri kas perpanjangan sewa (tanpa invoice) —
 *  kamar yang sama + akhir kontrak yang sama = satu pembayaran yang sama →
 *  retry/eksekusi ganda tidak pernah mendobelkan pemasukan. */
export function renewalCashId(roomId: string, newEnd: Date): string {
  const slug = roomId.replace(/[^A-Za-z0-9-]/g, "") || "room";
  const { year, month, day } = wibDateParts(newEnd);
  const stamp = `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  return `KM-AUTO-RENEW-${slug}-${stamp}`;
}

/** Deskripsi kanonik pemasukan PERPANJANGAN sewa — format konsisten lintas
 *  jalur (server PATCH /api/tenants & cermin demo):
 *  "Perpanjangan sewa Kamar 02 - Budi Santoso (Periode Nov 2026)" */
export function renewalIncomeDescription(
  nomor: string,
  tenantName: string | null | undefined,
  periodKey?: string | null,
): string {
  const period = periodKey ? ` (Periode ${periodShortLabel(periodKey)})` : "";
  return `Perpanjangan sewa Kamar ${nomor} - ${tenantName?.trim() || "Penyewa"}${period}`;
}

/** ID deterministik & idempoten utk entri kas hasil SINKRONISASI level kamar
 *  PER SIKLUS — satu kamar + satu tanggal jatuh tempo = SATU entri backfill,
 *  apa pun berapa kali sync dijalankan → id yang sama, create kedua kena
 *  P2002 dan diabaikan. (Penerus KM-ROOMSYNC-<roomId> yang lama: kini
 *  period-aware — satu entri per bulan siklus, bukan sekali seumur kamar.) */
export function roomCycleSyncCashId(roomId: string, due: Date): string {
  const slug = roomId.replace(/[^A-Za-z0-9-]/g, "") || "room";
  const { year, month, day } = wibDateParts(due);
  const stamp = `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  return `KM-ROOMSYNC2-${slug}-${stamp}`;
}

/** Deskripsi kanonik pemasukan sewa — format konsisten lintas jalur:
 *  "Pembayaran sewa Kamar 101 - Budi Santoso (Sewa Nov 2026)" */
export function rentalIncomeDescription(
  nomor: string,
  tenantName: string | null | undefined,
  periodKey?: string | null,
): string {
  const period = periodKey ? ` (Sewa ${periodShortLabel(periodKey)})` : "";
  return `Pembayaran sewa Kamar ${nomor} - ${tenantName?.trim() || "Penyewa"}${period}`;
}

export interface CashSyncResult {
  created: number;
  scanned: number;
}

const EMPTY_RESULT: CashSyncResult = { created: 0, scanned: 0 };

/** Rentang eksplisit sinkronisasi — dikirim tombol "Sinkronkan Data Sewa"
 *  dari tampilan Buku Kas (periode aktif). ISO "yyyy-mm-dd"; null = tanpa
 *  batas di sisi itu ("Semua Waktu"). */
export interface CashSyncRange {
  fromISO?: string | null;
  toISO?: string | null;
}

/** Sinkronkan pemasukan sewa yang hilang utk scope properti owner — DUA pass:
 *
 *  PASS 1 (per invoice): setiap invoice "lunas" adalah bukti pembayaran →
 *  wajib punya SATU entri pemasukan dgn tanggal paidAt persis.
 *
 *  PASS 2 (per kamar per BULAN — period-aware): setiap kamar TERISI wajib
 *  punya bukti pemasukan di setiap bulan siklusnya yang sudah terbayar
 *  (tanggal tempo siklus < anchor "terbayar sampai" = nextBillingDate/
 *  contractEnd). Kasus nyata yang memicu perbaikan ini: 14-15 kamar check-in
 *  Okt 2026 lalu DIPERPANJANG Nov 2026 — sinkron lama hanya membuat SATU
 *  entri backfill per kamar (seumur kamar, KM-ROOMSYNC-<roomId>) sehingga
 *  bulan November tidak pernah lahir walau tombol sync ditekan berkali-kali.
 *  Tanggal entri = tanggal jatuh tempo siklus bulan tsb; nominal = harga sewa
 *  kamar per siklus. Siklus bertanggal masa depan DILEWATI (jangan mencatat
 *  pemasukan yang belum terjadi); kamar menunggak hanya di-backfill untuk
 *  bulan-bulan siklus TERDAHULU yang terbayar, bukan siklus berjalan.
 *
 *  Bukti "bulan M kamar R sudah tercatat" (cukup salah satu):
 *   a. entri masuk bulan M di properti yang sama dgn deskripsi menyebut
 *      "Kamar <nomor>" (uji batas kata — "Kamar 02" tidak cocok "Kamar 02-10");
 *   b. entri masuk bulan M ber-id deterministik milik kamar R
 *      (KM-AUTO-RENEW-<slug>-* / KM-ROOMSYNC-<slug> / KM-ROOMSYNC2-<slug>-*);
 *   c. entri masuk bulan M nominal persis harga kamar + deskripsi menyebut
 *      nama penyewa (catatan manual pemilik tanpa nomor kamar);
 *   d. kamar punya invoice lunas periodKey = M — PASS 1 yang mencatat entri
 *      (paidAt bisa jatuh di bulan lain bila dibayar telat; jangan dobel).
 *
 *  Atribusi PERIODE DESKRIPSI (perbaikan laporan dobel Nov 2026): entri yang
 *  ter-atribusi ke kamar R menutup SEMUA bulan yang disebut deskripsinya —
 *  bukan hanya bulan tanggal entri. Tagihan dibayar telat ("… (Sewa Okt 2026)"
 *  ber-tanggal Nov) dan perpanjangan multi-siklus ("… (Periode Okt 2026 –
 *  Des 2026)", nominal 3× tarif) mencakup bulan-bulan siklusnya — tanpa ini
 *  bulan-bulan tsb di-backfill ULANG padahal sudah terbayar (dobel kas).
 *
 *  Tanpa `range` (auto-heal GET /api/cash) hanya jendela 3 bulan terakhir
 *  (bulan berjalan −2 … berjalan) — aman dari backfill massal bertahun-tahun
 *  pada data lama; tombol manual mengirim rentang eksplisit dari tampilan.
 *
 *  IDEMPOTEN: id deterministik (KM-AUTO-… / KM-ROOMSYNC2-…-<yyyyMMdd>) +
 *  P2002 → dijalankan berapa kali pun (otomatis saat GET /api/cash, manual
 *  via POST /api/cash/sync) buku kas tidak pernah mendobel. */
export async function syncMissingRentalIncome(
  propertyIds: string[],
  range?: CashSyncRange,
): Promise<CashSyncResult> {
  if (propertyIds.length === 0) return EMPTY_RESULT;
  try {
    // 1) Invoice lunas milik scope — bukti pembayaran yang wajib tercatat
    const paidInvoices = await db.invoice.findMany({
      where: { propertyId: { in: propertyIds }, status: "lunas", total: { gt: 0 } },
      select: {
        id: true,
        roomId: true,
        propertyId: true,
        total: true,
        paidAt: true,
        periodKey: true,
        tenantName: true,
      },
    });

    // 2) Entri kas masuk milik scope — indeks cakupan (deskripsi utk atribusi
    //    "entri ini milik kamar R bulan M")
    const masukEntries = await db.cashEntry.findMany({
      where: { propertyId: { in: propertyIds }, type: "masuk" },
      select: { id: true, propertyId: true, amount: true, dateSort: true, description: true },
    });
    const existingIds = new Set(masukEntries.map((e) => e.id));
    const covered = new Set(
      masukEntries.map((e) => `${e.propertyId ?? ""}|${e.amount}|${e.dateSort}`),
    );

    // 3) Nomor kamar murni utk deskripsi
    const roomIds = [...new Set(paidInvoices.map((i) => i.roomId))];
    const nomorById = new Map<string, string>();
    if (roomIds.length > 0) {
      const roomRows = await db.room.findMany({
        where: { id: { in: roomIds } },
        select: { id: true, nomor: true },
      });
      for (const r of roomRows) nomorById.set(r.id, r.nomor?.trim() || r.id);
    }

    // ── PASS 1: invoice lunas tanpa entri kas → buatkan (idempoten) ──────────
    let created = 0;
    for (const inv of paidInvoices) {
      const id = autoCashId(inv.id);
      if (existingIds.has(id)) continue; // sudah tercatat (skema deterministik)
      if (!inv.paidAt) continue; // tanpa tanggal bayar — tak bisa ditempatkan
      const wibSort = dateSortFromLabel(wibDateLabel(inv.paidAt));
      const legacySort = dateSortFromLabel(dateToLabel(inv.paidAt)); // label skema lama (server UTC)
      const propKey = inv.propertyId ?? "";
      if (
        covered.has(`${propKey}|${inv.total}|${wibSort}`) ||
        covered.has(`${propKey}|${inv.total}|${legacySort}`)
      ) {
        continue; // sudah tercatat manual / otomatis lama — jangan dobelkan
      }
      const dateLabel = wibDateLabel(inv.paidAt);
      try {
        await db.cashEntry.create({
          data: {
            id,
            type: "masuk",
            category: "Sewa Kamar",
            description: rentalIncomeDescription(
              nomorById.get(inv.roomId) ?? inv.roomId,
              inv.tenantName,
              inv.periodKey,
            ),
            amount: inv.total,
            entryDate: wibMidnight(inv.paidAt),
            dateLabel,
            dateSort: wibSort,
            propertyId: inv.propertyId,
          },
        });
        created += 1;
        existingIds.add(id);
        covered.add(`${propKey}|${inv.total}|${wibSort}`);
      } catch (err) {
        // P2002 = request paralel keburu membuat entri yang sama — bukan gagal
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          console.error("[cash-sync] gagal membuat entri kas utk invoice", inv.id, err);
        }
      }
    }

    // ── PASS 2: per kamar per BULAN (period-aware self-heal) ─────────────────
    // Setiap kamar terisi wajib punya bukti pemasukan utk setiap bulan siklus
    // yang sudah terbayar (due < anchor "terbayar sampai"). Kamar dgn invoice
    // lunas TETAP diproses — invoice hanya membuktikan bulan periodKey-nya;
    // bulan siklus lain (mis. Nov setelah check-in Okt + perpanjangan tanpa
    // invoice) tetap wajib backfill di sini.
    const occupiedRooms = await db.room.findMany({
      where: { propertyId: { in: propertyIds }, status: { not: "kosong" } },
      select: {
        id: true,
        nomor: true,
        propertyId: true,
        price: true,
        contractDuration: true,
        contractStart: true,
        contractEnd: true,
        nextBillingDate: true,
        tenant: { select: { name: true, moveInAt: true } },
      },
    });

    const now = new Date();
    const { year: wibY, month: wibM, day: wibD } = wibDateParts(now);
    const todayWib = new Date(Date.UTC(wibY, wibM - 1, wibD)); // tengah malam WIB

    // Jendela siklus: rentang eksplisit (tombol manual) atau default 3 bulan
    // terakhir (auto-heal). Batas numerik yyyyMMdd — komparabel dgn dateSort.
    const isoToSortKey = (iso: string) => Number(iso.replace(/-/g, ""));
    const explicit = range !== undefined;
    const fromSortBound = explicit
      ? range?.fromISO
        ? isoToSortKey(range.fromISO)
        : null
      : isoToSortKey(`${new Date(Date.UTC(wibY, wibM - 3, 1)).getUTCFullYear()}-${String(new Date(Date.UTC(wibY, wibM - 3, 1)).getUTCMonth() + 1).padStart(2, "0")}-01`);
    const toSortBound = explicit ? (range?.toISO ? isoToSortKey(range.toISO) : null) : null;

    // Bulan yang sudah tercatat per kamar — dari invoice lunas (periodKey) …
    const invoiceMonthsByRoom = new Map<string, Set<string>>();
    for (const inv of paidInvoices) {
      if (!inv.periodKey) continue;
      let set = invoiceMonthsByRoom.get(inv.roomId);
      if (!set) invoiceMonthsByRoom.set(inv.roomId, (set = new Set()));
      set.add(inv.periodKey);
    }

    // … dan dari entri kas masuk yang bisa diatribusikan ke kamar tsb.
    const roomMeta = occupiedRooms.map((room) => ({
      room,
      slug: room.id.replace(/[^A-Za-z0-9-]/g, "") || "room",
      nomorLower: (room.nomor?.trim() || room.id).toLowerCase(),
      tenantLower: (room.tenant?.name ?? "").trim().toLowerCase(),
      propKey: room.propertyId ?? "",
    }));
    const entryMonthsByRoom = new Map<string, Set<string>>();
    const pad2 = (n: number) => String(n).padStart(2, "0");
    for (const e of masukEntries) {
      const sortStr = String(e.dateSort).padStart(8, "0");
      const month = `${sortStr.slice(0, 4)}-${sortStr.slice(4, 6)}`;
      const descLower = (e.description ?? "").toLowerCase();
      const eProp = e.propertyId ?? "";
      for (const meta of roomMeta) {
        if (eProp !== meta.propKey) continue; // isolasi multi-cabang
        let coveredMonth = false;
        // (a) deskripsi menyebut "Kamar <nomor>" — uji batas kata di tiap kemunculan
        const needle = `kamar ${meta.nomorLower}`;
        if (meta.nomorLower) {
          let idx = descLower.indexOf(needle);
          while (idx !== -1) {
            const after = descLower[idx + needle.length] ?? "";
            if (!/[a-z0-9-]/.test(after)) {
              coveredMonth = true;
              break;
            }
            idx = descLower.indexOf(needle, idx + 1);
          }
        }
        // (b) id deterministik milik kamar ini
        if (
          !coveredMonth &&
          (e.id.startsWith(`KM-AUTO-RENEW-${meta.slug}-`) ||
            e.id === `KM-ROOMSYNC-${meta.slug}` ||
            e.id.startsWith(`KM-ROOMSYNC2-${meta.slug}-`))
        ) {
          coveredMonth = true;
        }
        // (c) nominal persis + nama penyewa (catatan manual tanpa nomor kamar)
        if (
          !coveredMonth &&
          meta.tenantLower &&
          e.amount === meta.room.price &&
          descLower.includes(meta.tenantLower)
        ) {
          coveredMonth = true;
        }
        if (coveredMonth) {
          let set = entryMonthsByRoom.get(meta.room.id);
          if (!set) entryMonthsByRoom.set(meta.room.id, (set = new Set()));
          set.add(month);
          // Atribusi PERIODE DESKRIPSI — entri menutup semua bulan siklus yang
          // disebutnya, bukan hanya bulan tanggal entri (lihat komentar atas).
          for (const covered of periodMonthsFromDescription(e.description ?? "")) {
            set.add(covered);
          }
        }
      }
    }

    for (const meta of roomMeta) {
      const room = meta.room;
      if (room.price <= 0) continue; // tanpa tarif — tidak ada yg dicatat

      // Siklus terbayar: due berjalan dari tanggal mulai (masuk penyewa →
      // mulai kontrak) s.d. SATU langkah sebelum anchor "terbayar sampai"
      // (nextBillingDate ?? contractEnd) — due == anchor = siklus BERJALAN
      // yang belum dibayar, BUKAN bukti pemasukan.
      const start = room.tenant?.moveInAt ?? room.contractStart ?? null;
      const anchor = room.nextBillingDate ?? room.contractEnd ?? null;
      const dues: Date[] = [];
      if (start && anchor && anchor.getTime() > start.getTime()) {
        let cursor = new Date(start.getTime());
        let guard = 0;
        while (cursor.getTime() < anchor.getTime() && guard < 240) {
          if (wibMidnight(cursor).getTime() <= todayWib.getTime()) {
            dues.push(new Date(cursor.getTime())); // tanpa siklus masa depan
          }
          cursor = advanceOneCycle(cursor, room.contractDuration);
          guard += 1;
        }
      } else if (!start) {
        // Tanpa jejak tanggal masuk — perilaku lama: satu kandidat dari anchor.
        // Kamar menunggak (anchor lewat) tanpa bukti apa pun DILEWATI — jangan
        // mencatat pemasukan fiktif.
        if (anchor) {
          if (anchor.getTime() >= todayWib.getTime()) {
            const cand = stepBackOneCycle(anchor, room.contractDuration);
            if (wibMidnight(cand).getTime() <= todayWib.getTime()) dues.push(cand);
          }
        } else if (wibMidnight(now).getTime() <= todayWib.getTime()) {
          dues.push(now);
        }
      } else if (start && !anchor) {
        // Ada tanggal masuk tanpa anchor tagihan — pembayaran check-in saja.
        if (wibMidnight(start).getTime() <= todayWib.getTime()) dues.push(start);
      }

      // Kelompokkan per bulan kalender WIB → cek bukti → backfill per siklus
      const duesByMonth = new Map<string, Date[]>();
      for (const due of dues) {
        const { year, month } = wibDateParts(due);
        const key = `${year}-${pad2(month)}`;
        const arr = duesByMonth.get(key);
        if (arr) arr.push(due);
        else duesByMonth.set(key, [due]);
      }

      for (const [monthKey, monthDues] of [...duesByMonth.entries()].sort((a, b) =>
        a[0].localeCompare(b[0]),
      )) {
        if (invoiceMonthsByRoom.get(room.id)?.has(monthKey)) continue; // (d) jalur invoice
        if (entryMonthsByRoom.get(room.id)?.has(monthKey)) continue; // (a)/(b)/(c)
        for (const due of monthDues) {
          const dateLabel = wibDateLabel(due);
          const sort = dateSortFromLabel(dateLabel);
          if (fromSortBound !== null && sort < fromSortBound) continue;
          if (toSortBound !== null && sort > toSortBound) continue;
          const id = roomCycleSyncCashId(room.id, due);
          if (existingIds.has(id)) continue; // sudah pernah dibuat (idempoten)
          // Deskripsi backfill: siklus Bulanan/Per 3 Bulan/Tahunan menyebut
          // PERIODE bulan siklusnya ("… (Sewa Nov 2026)"); siklus pendek
          // (Mingguan/Harian — bisa beberapa siklus sah dalam SATU bulan)
          // menyebut TANGGAL siklusnya ("… (Sewa 12 Nov 2026)") agar setiap
          // entri tetap unik per pembayaran — dasar dedup yang akurat.
          const shortCycle =
            room.contractDuration === "Mingguan" || room.contractDuration === "Harian";
          const description = shortCycle
            ? `${rentalIncomeDescription(
                room.nomor?.trim() || room.id,
                room.tenant?.name,
                null,
              )} (Sewa ${dateLabel})`
            : rentalIncomeDescription(room.nomor?.trim() || room.id, room.tenant?.name, monthKey);
          try {
            await db.cashEntry.create({
              data: {
                id,
                type: "masuk",
                category: "Sewa Kamar",
                description,
                amount: room.price,
                entryDate: wibMidnight(due),
                dateLabel,
                dateSort: sort,
                // Isolasi multi-cabang — pemasukan milik properti kamar
                propertyId: room.propertyId,
              },
            });
            created += 1;
            existingIds.add(id);
            entryMonthsByRoom.get(room.id)?.add(monthKey);
          } catch (err) {
            if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
              console.error("[cash-sync] gagal membuat entri kas utk kamar", room.id, err);
            }
          }
        }
      }
    }
    return { created, scanned: paidInvoices.length + occupiedRooms.length };
  } catch (err) {
    // Fail-open — self-heal tidak pernah menjatuhkan endpoint pemanggil
    console.error("[cash-sync] self-heal Buku Kas gagal (diabaikan):", err);
    return EMPTY_RESULT;
  }
}
