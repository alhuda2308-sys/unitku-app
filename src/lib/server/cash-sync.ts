// ─────────────────────────────────────────────────────────────────────────────
// Self-heal Buku Kas — backfill pemasukan sewa yang belum tercatat
//
// Masalah: pembayaran sewa bisa tercatat lunas (invoice berstatus "lunas",
// kamar hijau, nextBillingDate maju) TANPA entri pemasukan di Buku Kas —
// akibat jalur pembayaran lama sebelum pencatatan otomatis ada, pencatatan
// yang gagal di tengah request, atau check-in/perpanjangan lewat versi lama.
// Buku Kas tampak kosong (Total Pemasukan Rp0) padahal ada pemasukan.
//
// Solusi: setiap invoice "lunas" adalah bukti pembayaran → wajib punya SATU
// entri pemasukan "Sewa Kamar". Fungsi syncMissingRentalIncome membandingkan
// invoice lunas vs entri kas masuk dan membuatkan entri yang hilang secara
// IDEMPOTEN (id deterministik dari id invoice → create ulang/race/paralel
// tidak pernah mendobelkan buku).
//
// Ringan: 3 query baca + create hanya untuk invoice yang benar-benar belum
// tercatat. Dipanggil otomatis saat Buku Kas dimuat (GET /api/cash) — fail-open:
// kegagalan heal tidak pernah menjatuhkan endpoint pemanggil.
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { dateSortFromLabel } from "@/lib/kost-cashflow";
import { dateToLabel, wibDateLabel, wibDateParts, wibMidnight } from "@/lib/kost-data";
import { periodShortLabel } from "@/lib/kost-invoices";

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

/** Sinkronkan pemasukan sewa yang hilang utk scope properti owner.
 *  Cakupan entri yang dianggap "sudah tercatat":
 *   1. id deterministik sudah ada (skema otomatis baru), atau
 *   2. ada entri masuk dgn nominal & tanggal PERSIS sama — mencakup catatan
 *      manual pemilik maupun catatan otomatis lama (label tanggal dibandingkan
 *      dlm dua kalender: WIB (skema baru) & jam server/UTC (skema lama)). */
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
    if (paidInvoices.length === 0) return EMPTY_RESULT;

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

    // 4) Buat entri yang hilang — idempoten
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
      } catch (err) {
        // P2002 = request paralel keburu membuat entri yang sama — bukan gagal
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          console.error("[cash-sync] gagal membuat entri kas utk invoice", inv.id, err);
        }
      }
    }
    return { created, scanned: paidInvoices.length };
  } catch (err) {
    // Fail-open — self-heal tidak pernah menjatuhkan endpoint pemanggil
    console.error("[cash-sync] self-heal Buku Kas gagal (diabaikan):", err);
    return EMPTY_RESULT;
  }
}
