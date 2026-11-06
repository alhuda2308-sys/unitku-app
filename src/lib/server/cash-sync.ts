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
//   PASS 2 per KAMAR — kamar terisi tanpa invoice lunas sama sekali (data
//     lama pra-fitur) tetap di-backfill SATU entri, dgn tanggal bukti
//     terbaik yang tersedia (masuk penyewa → kontrak → siklus terbayar).
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
import { dateSortFromLabel } from "@/lib/kost-cashflow";
import { dateToLabel, wibDateLabel, wibDateParts, wibMidnight } from "@/lib/kost-data";
import { periodShortLabel } from "@/lib/kost-invoices";
import { stepBackOneCycle } from "@/lib/room-status";

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

/** ID deterministik & idempoten utk entri kas hasil SINKRONISASI level kamar
 *  (self-heal kamar aktif yang tidak punya invoice lunas — data lama pra-fitur
 *  pencatatan). Satu kamar = SATU entri backfill, apa pun berapa kali sync
 *  dijalankan → id yang sama, create kedua kena P2002 dan diabaikan. */
export function roomSyncCashId(roomId: string): string {
  const slug = roomId.replace(/[^A-Za-z0-9-]/g, "") || "room";
  return `KM-ROOMSYNC-${slug}`;
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

/** Sinkronkan pemasukan sewa yang hilang utk scope properti owner — DUA pass:
 *
 *  PASS 1 (per invoice): setiap invoice "lunas" adalah bukti pembayaran →
 *  wajib punya SATU entri pemasukan dgn tanggal paidAt persis.
 *
 *  PASS 2 (per kamar — self-heal data lama): kamar TERISI yang TIDAK punya
 *  invoice lunas sama sekali (dibuat/di-set lunas sebelum fitur pencatatan
 *  otomatis ada) wajib punya SATU entri backfill. Tanggal pembayaran
 *  diprioritaskan: tanggal masuk penyewa → mulai kontrak → awal siklus
 *  terbayar (nextBillingDate mundur 1 siklus) → hari ini. Kamar menunggak
 *  tanpa jejak tanggal apa pun DILEWATI (tidak mencatat pemasukan fiktif).
 *
 *  Cakupan entri yang dianggap "sudah tercatat":
 *   1. id deterministik sudah ada (skema otomatis baru), atau
 *   2. ada entri masuk dgn nominal & tanggal PERSIS sama — mencakup catatan
 *      manual pemilik maupun catatan otomatis lama (label tanggal dibandingkan
 *      dlm dua kalender: WIB (skema baru) & jam server/UTC (skema lama)).
 *
 *  IDEMPOTEN: id deterministik (KM-AUTO-… / KM-ROOMSYNC-…) + P2002 → dijalankan
 *  berapa kali pun (otomatis saat GET /api/cash, manual via POST /api/cash/sync)
 *  buku kas tidak pernah mendobel. */
export async function syncMissingRentalIncome(propertyIds: string[]): Promise<CashSyncResult> {
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

    // 2) Entri kas masuk milik scope — indeks cakupan
    const masukEntries = await db.cashEntry.findMany({
      where: { propertyId: { in: propertyIds }, type: "masuk" },
      select: { id: true, propertyId: true, amount: true, dateSort: true },
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

    // ── PASS 2: kamar terisi TANPA invoice lunas (data lama pra-fitur) ────────
    //     Satu entri backfill per kamar — idempoten via KM-ROOMSYNC-<roomId>.
    // Kamar yg punya invoice lunas diserahkan penuh ke jalur invoice (tepat
    // per invoice) — pass kamar tidak menambah apa pun utk kamar itu, apa pun
    // hasil pass invoice, agar tidak pernah dobel.
    const roomIdsWithPaidInvoice = new Set(paidInvoices.map((i) => i.roomId));

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

    const DAY_MS = 86_400_000;
    const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const now = new Date();
    const todayMidnight = midnight(now);

    for (const room of occupiedRooms) {
      if (room.price <= 0) continue; // tanpa tarif — tidak ada yg dicatat
      const id = roomSyncCashId(room.id);
      if (existingIds.has(id)) continue; // backfill kamar ini sudah pernah dibuat
      if (roomIdsWithPaidInvoice.has(room.id)) continue; // jalur invoice yang urus

      // Status dinamis dari jatuh tempo tagihan (mirror deriveStatusFromBilling):
      // menunggak = siklus berjalan BELUM dibayar — tanpa jejak tanggal
      // pembayaran lain, kamar ini DILEWATI (jangan mencatat pemasukan fiktif).
      const due = room.nextBillingDate ?? room.contractEnd;
      const daysLeft = due ? Math.round((midnight(due).getTime() - todayMidnight.getTime()) / DAY_MS) : null;
      const isMenunggak = daysLeft !== null && daysLeft < 0;

      // Tanggal pembayaran — prioritas: masuk penyewa (pembayaran pertama
      // saat check-in) → mulai kontrak → awal siklus terbayar → hari ini.
      let payDate: Date | null = room.tenant?.moveInAt ?? room.contractStart ?? null;
      if (!payDate && due) payDate = stepBackOneCycle(due, room.contractDuration);
      if (!payDate) {
        if (isMenunggak) continue;
        payDate = now;
      }
      if (midnight(payDate).getTime() > todayMidnight.getTime()) payDate = now; // tanpa masa depan

      const dateLabel = wibDateLabel(payDate);
      const sort = dateSortFromLabel(dateLabel);
      const propKey = room.propertyId ?? "";
      if (covered.has(`${propKey}|${room.price}|${sort}`)) {
        continue; // catatan manual pemilik dgn nominal+tanggal persis sama
      }
      const periodKey = `${sort.toString().slice(0, 4)}-${sort.toString().slice(4, 6)}`;
      try {
        await db.cashEntry.create({
          data: {
            id,
            type: "masuk",
            category: "Sewa Kamar",
            description: rentalIncomeDescription(
              room.nomor?.trim() || room.id,
              room.tenant?.name,
              periodKey,
            ),
            amount: room.price,
            entryDate: wibMidnight(payDate),
            dateLabel,
            dateSort: sort,
            propertyId: room.propertyId,
          },
        });
        created += 1;
        existingIds.add(id);
        covered.add(`${propKey}|${room.price}|${sort}`);
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          console.error("[cash-sync] gagal membuat entri kas utk kamar", room.id, err);
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
