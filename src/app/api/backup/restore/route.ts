// ─────────────────────────────────────────────────────────────────────────────
// /api/backup/restore — Pulihkan Data dari Berkas Cadangan (Pengaturan)
//
// POST { payload: BackupPayload }
//   Menerima isi berkas cadangan UnitKu (.json) hasil unduhan dari fitur
//   "Cadangan & Keamanan Data", memvalidasi ulang strukturnya di server,
//   lalu MENYELARASKAN database dengan isi cadangan:
//     • Kamar    : buat yang belum ada / perbarui yang sudah dimiliki owner
//     • Penyewa  : disamakan dengan isi cadangan per kamar (tambah/ubah/hapus)
//     • Tagihan  : buat/perbarui beserta rinciannya (invoice_lines)
//     • Kas      : buat/perbarui transaksi
//   Semua perubahan berlangsung dalam SATU transaksi Prisma — berhasil penuh
//   atau gagal tanpa sisa. Data milik owner lain TIDAK PERNAH disentuh:
//   kamar/tagihan/kas yang bukan milik owner aktif dilewati (skipped).
//
// Isolasi multi-tenant: seluruh query terfilter propertyId milik owner sesi.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth/server";
import { unauthorized } from "@/lib/auth/ownership";
import {
  BackupValidationError,
  backupLabelToDate,
  validateBackupPayload,
  type BackupPayload,
} from "@/lib/backup";
import { newPortalToken } from "@/lib/kost-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** id properti unik — "prop_xxxxxxxx" (sama dgn pola /api/onboarding) */
function nextPropertyId(): string {
  return `prop_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

const PROPERTY_TIPE_VALUES = ["kost", "kontrakan", "rusun"];

function normalizeOperational(v: string | undefined): string | null {
  if (v === "perbaikan" || v === "nonaktif") return v;
  return null; // "siap" / tidak diketahui → null (kolom DB menyimpan null)
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await getAuthUser();
  } catch {
    return unauthorized();
  }
  if (!user) return unauthorized();
  if (user.demo) {
    return NextResponse.json(
      {
        error:
          "Mode demo memakai data simulasi bersama — pulihkan data hanya tersedia untuk akun asli.",
      },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { payload?: unknown }
    | null;
  const raw = body?.payload ?? body;
  if (!raw) {
    return NextResponse.json({ error: "Berkas cadangan tidak terbaca." }, { status: 400 });
  }

  // ── Validasi struktur berkas (validator bersama klien & server) ───────────
  let validated: ReturnType<typeof validateBackupPayload>;
  try {
    validated = validateBackupPayload(raw);
  } catch (err) {
    if (err instanceof BackupValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[api/backup/restore] validasi gagal:", err);
    return NextResponse.json(
      { error: "Berkas cadangan tidak valid dan tidak dapat diproses." },
      { status: 400 },
    );
  }
  const payload: BackupPayload = validated.payload;

  try {
  // ── Properti tujuan pemulihan ─────────────────────────────────────────────
  let property = await db.property.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!property) {
    // Skenario migrasi/pemulihan akun baru — buat properti dari nama cadangan
    const backupName = payload.property?.name?.trim() ?? "";
    const name =
      backupName.length >= 2 && backupName.length <= 80 ? backupName : "Properti Pulihan";
    const tipe = PROPERTY_TIPE_VALUES.includes(payload.property?.tipe ?? "")
      ? (payload.property?.tipe as string)
      : "kost";
    const alamat = payload.property?.alamat ?? null;
    property = await db.property.create({
      data: { id: nextPropertyId(), ownerId: user.id, name, tipe, alamat },
    });
  }

  const ownedIds = (
    await db.property.findMany({ where: { ownerId: user.id }, select: { id: true } })
  ).map((p) => p.id);
  const ownedSet = new Set(ownedIds);


    const result = await db.$transaction(async (tx) => {
      // ── 0. Snapshot data yang relevan ─────────────────────────────────────
      const backupRoomIds = payload.rooms.map((r) => r.id);
      const existingRooms = await tx.room.findMany({
        where: {
          OR: [{ id: { in: backupRoomIds } }, { propertyId: { in: ownedIds } }],
        },
        include: { tenant: true },
      });
      const existingRoomById = new Map(existingRooms.map((r) => [r.id, r]));

      const counters = {
        roomsCreated: 0,
        roomsUpdated: 0,
        roomsSkipped: 0,
        tenantsAligned: 0,
        invoicesCreated: 0,
        invoicesUpdated: 0,
        invoicesSkipped: 0,
        cashCreated: 0,
        cashUpdated: 0,
        cashSkipped: 0,
      };

      // ── 1. Kamar + penyewa ────────────────────────────────────────────────
      const alignedRoomIds = new Set<string>();
      for (const room of payload.rooms) {
        const existing = existingRoomById.get(room.id);
        const roomData = {
          floor: room.floor,
          type: room.type,
          price: room.price,
          status: room.status,
          facilities: (room.facilities ?? []) as unknown as Prisma.InputJsonValue,
          operational: normalizeOperational(room.operational),
          contractDuration: room.contract?.duration ?? null,
          contractStart: backupLabelToDate(room.contract?.startDate),
          contractEnd: backupLabelToDate(room.contract?.endDate),
          deposit: room.contract?.deposit ?? 0,
          depositHeld: room.contract?.depositHeld ?? false,
        };

        if (existing) {
          if (!ownedSet.has(existing.propertyId)) {
            counters.roomsSkipped += 1; // nomor kamar dipakai owner lain — jangan sentuh
            continue;
          }
          await tx.room.update({ where: { id: existing.id }, data: roomData });
          counters.roomsUpdated += 1;
        } else {
          await tx.room.create({
            data: { id: room.id, propertyId: property!.id, ...roomData },
          });
          counters.roomsCreated += 1;
        }
        alignedRoomIds.add(room.id);

        // Penyewa: samakan dengan isi cadangan (tambah / ubah / hapus)
        const tenantInDb = await tx.tenant.findUnique({ where: { roomId: room.id } });
        if (room.tenant) {
          const tenantData = {
            name: room.tenant.name,
            phone: room.tenant.phone ?? "",
            moveInAt: backupLabelToDate(room.tenant.moveInDate),
            emergencyName: room.tenant.emergencyName ?? null,
            emergencyPhone: room.tenant.emergencyPhone ?? null,
          };
          if (tenantInDb) {
            await tx.tenant.update({ where: { roomId: room.id }, data: tenantData });
          } else {
            try {
              await tx.tenant.create({
                data: {
                  roomId: room.id,
                  portalToken: room.tenant.portalToken?.trim() || newPortalToken(room.id),
                  ...tenantData,
                },
              });
            } catch (err) {
              // portalToken tabrakan dgn milik penghuni lain → buat token baru
              if (
                err instanceof Prisma.PrismaClientKnownRequestError &&
                err.code === "P2002"
              ) {
                await tx.tenant.create({
                  data: {
                    roomId: room.id,
                    portalToken: newPortalToken(room.id),
                    ...tenantData,
                  },
                });
              } else {
                throw err;
              }
            }
          }
          counters.tenantsAligned += 1;
        } else if (tenantInDb) {
          // Cadangan mencatat kamar kosong — hapus penyewa lama (sinkron penuh)
          await tx.tenant.delete({ where: { roomId: room.id } });
          counters.tenantsAligned += 1;
        }
      }

      // ── 2. Tagihan (+ rincian) ────────────────────────────────────────────
      const invoiceIds = payload.invoices.map((i) => i.id);
      const existingInvoices = await tx.invoice.findMany({
        where: {
          OR: [
            { id: { in: invoiceIds } },
            {
              roomId: { in: [...alignedRoomIds] },
              periodKey: {
                in: [...new Set(payload.invoices.map((i) => i.periodKey))],
              },
            },
          ],
        },
        select: { id: true, roomId: true, periodKey: true },
      });
      const existingInvoiceById = new Map(existingInvoices.map((i) => [i.id, i]));
      const existingInvoiceByRoomPeriod = new Map(
        existingInvoices.map((i) => [`${i.roomId}::${i.periodKey}`, i] as const),
      );

      for (const inv of payload.invoices) {
        if (!alignedRoomIds.has(inv.roomId)) {
          counters.invoicesSkipped += 1; // kamar tidak dikenal / bukan milik owner
          continue;
        }
        const invoiceData = {
          roomId: inv.roomId,
          tenantName: inv.tenantName ?? null,
          tenantPhone: inv.tenantPhone ?? null,
          roomType: inv.roomType ?? null,
          periodLabel: inv.periodLabel,
          periodKey: inv.periodKey,
          dueDate: backupLabelToDate(inv.dueDate),
          status: inv.status,
          dayOffset: inv.dayOffset ?? null,
          paidAt: backupLabelToDate(inv.paidAt),
          total: inv.total,
        };
        const lines = inv.lines ?? [];

        const byId = existingInvoiceById.get(inv.id);
        const byRoomPeriod = existingInvoiceByRoomPeriod.get(
          `${inv.roomId}::${inv.periodKey}`,
        );
        const target = byId ?? byRoomPeriod;

        if (target) {
          // Isolasi: pastikan tagihan target milik owner (lewat properti kamar)
          const targetRoom = await tx.room.findUnique({
            where: { id: target.roomId },
            select: { propertyId: true },
          });
          if (!targetRoom || !ownedSet.has(targetRoom.propertyId)) {
            counters.invoicesSkipped += 1;
            continue;
          }
          await tx.invoiceLine.deleteMany({ where: { invoiceId: target.id } });
          await tx.invoice.update({
            where: { id: target.id },
            data: {
              ...invoiceData,
              ...(lines.length
                ? {
                    lines: {
                      create: lines.map((l) => ({ label: l.label, amount: l.amount })),
                    },
                  }
                : {}),
            },
          });
          counters.invoicesUpdated += 1;
        } else {
          try {
            await tx.invoice.create({
              data: {
                id: inv.id,
                ...invoiceData,
                ...(lines.length
                  ? {
                      lines: {
                        create: lines.map((l) => ({ label: l.label, amount: l.amount })),
                      },
                    }
                  : {}),
              },
            });
          } catch (err) {
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              (err.code === "P2002" || err.code === "P2003")
            ) {
              counters.invoicesSkipped += 1; // id/kunci unik bentrok — aman dilewati
              continue;
            }
            throw err;
          }
          counters.invoicesCreated += 1;
        }
      }

      // ── 3. Transaksi kas ──────────────────────────────────────────────────
      const cashIds = payload.cashEntries.map((c) => c.id);
      const existingCash = await tx.cashEntry.findMany({
        where: { id: { in: cashIds } },
        select: { id: true, propertyId: true },
      });
      const existingCashById = new Map(existingCash.map((c) => [c.id, c]));

      for (const entry of payload.cashEntries) {
        const cashData = {
          dateLabel: entry.dateLabel,
          dateSort: entry.dateSort ?? 0,
          type: entry.type,
          category: entry.category,
          description: entry.description ?? "",
          amount: entry.amount,
          source: entry.source ?? "Kas Tunai",
        };
        const existing = existingCashById.get(entry.id);
        if (existing) {
          if (!existing.propertyId || !ownedSet.has(existing.propertyId)) {
            counters.cashSkipped += 1; // transaksi milik owner lain
            continue;
          }
          await tx.cashEntry.update({ where: { id: existing.id }, data: cashData });
          counters.cashUpdated += 1;
        } else {
          try {
            await tx.cashEntry.create({
              data: { id: entry.id, propertyId: property!.id, ...cashData },
            });
          } catch (err) {
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              err.code === "P2002"
            ) {
              counters.cashSkipped += 1;
              continue;
            }
            throw err;
          }
          counters.cashCreated += 1;
        }
      }

      return counters;
    });

    return NextResponse.json({
      ok: true,
      propertyId: property.id,
      propertyName: property.name,
      restored: result,
    });
  } catch (err) {
    console.error("[api/backup/restore POST]", err);
    const message =
      err instanceof Prisma.PrismaClientKnownRequestError
        ? "Database menolak sebagian data cadangan — pastikan berkas berasal dari ekspor UnitKu terbaru."
        : "Gagal memulihkan data — tidak ada perubahan yang disimpan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
