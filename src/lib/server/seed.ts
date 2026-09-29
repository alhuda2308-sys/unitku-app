// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Auto-seed database Supabase (sekali, idempoten)
//
// GET pertama pada endpoint mana pun (rooms/invoices/cash/staff/properties)
// memanggil ensureSeed(): bila tabel masih kosong, seluruh dataset demo
// (24 kamar + penghuni, tagihan Sep 2026, buku kas, 2 staf contoh, properti
// utama "Kost Griya Pratama") dimigrasikan ke Supabase. Dari titik ini data
// tersimpan permanen di cloud & tersinkron lintas perangkat.
//
// Memoisasi promise per proses → request paralel (rooms+cash+invoices bersamaan)
// hanya memicu satu kali seed. Bila tabel sudah terisi, fungsi langsung kembali.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/prisma";
import { ROOMS, parseDateLabel, seededPortalToken } from "@/lib/kost-data";
import { INVOICES } from "@/lib/kost-invoices";
import { CASH_ENTRIES, dateSortFromLabel, type CashType } from "@/lib/kost-cashflow";

/** Properti utama (id sama dengan settings.properties[0] agar switcher konsisten) */
export const SEED_PROPERTY_ID = "kgp";

let seedPromise: Promise<void> | null = null;

export function ensureSeed(): Promise<void> {
  seedPromise ??= runSeed().catch((err) => {
    seedPromise = null; // gagal → boleh dicoba lagi request berikutnya
    throw err;
  });
  return seedPromise;
}

async function runSeed(): Promise<void> {
  const existing = await db.property.findUnique({ where: { id: SEED_PROPERTY_ID } });
  if (existing) return;

  const roomCount = await db.room.count();
  if (roomCount > 0) {
    // Database sudah berisi kamar (seed dari proses lain) — pastikan properti ada
    await db.property.upsert({
      where: { id: SEED_PROPERTY_ID },
      update: {},
      create: {
        id: SEED_PROPERTY_ID,
        name: "Kost Griya Pratama",
        tipe: "kost",
        alamat: "Jl. Cendana Raya No. 45, Cibinong, Bogor",
      },
    });
    return;
  }

  // ── Properti utama ────────────────────────────────────────────────────────
  await db.property.create({
    data: {
      id: SEED_PROPERTY_ID,
      name: "Kost Griya Pratama",
      tipe: "kost",
      alamat: "Jl. Cendana Raya No. 45, Kel. Sukamaju, Kec. Cibinong, Kab. Bogor, Jawa Barat 16913",
      bankName: "BCA",
      bankAccountNo: "1234567890",
      bankAccountName: "Hendra Wijaya",
    },
  });

  // ── Kamar + penghuni (dataset mock → relasional) ─────────────────────────
  for (const room of ROOMS) {
    await db.room.create({
      data: {
        id: room.id,
        propertyId: SEED_PROPERTY_ID,
        floor: room.floor,
        type: room.type,
        price: room.price,
        status: room.status,
        operational: room.operational ?? null,
        contractDuration: room.contract?.duration ?? null,
        contractStart: room.contract ? parseDateLabel(room.contract.startDate) : null,
        contractEnd: room.contract?.endDate ? parseDateLabel(room.contract.endDate) : null,
        deposit: room.contract?.deposit ?? 0,
        depositHeld: room.contract?.depositHeld ?? false,
        facilities: room.facilities ?? [],
        ...(room.tenant
          ? {
              tenant: {
                create: {
                  name: room.tenant.name,
                  phone: room.tenant.phone,
                  moveInAt: parseDateLabel(room.tenant.moveInDate),
                  emergencyName: room.tenant.emergencyContact.name,
                  emergencyPhone: room.tenant.emergencyContact.phone,
                  portalToken: seededPortalToken(room.id),
                },
              },
            }
          : {}),
      },
    });
  }

  // ── Tagihan & rincian (Sep 2026) ──────────────────────────────────────────
  for (const inv of INVOICES) {
    await db.invoice.create({
      data: {
        id: inv.id,
        roomId: inv.roomId,
        tenantName: inv.tenantName,
        tenantPhone: inv.tenantPhone,
        roomType: inv.roomType,
        periodLabel: inv.periodLabel,
        periodKey: inv.periodKey,
        dueDate: parseDateLabel(inv.dueDate),
        status: inv.status,
        dayOffset: inv.dayOffset ?? null,
        paidAt: inv.paidAt ? parseDateLabel(inv.paidAt) : null,
        total: inv.total,
        lines: {
          create: inv.lines.map((l) => ({ label: l.label, amount: l.amount })),
        },
      },
    });
  }

  // ── Buku kas (Sep 2026) ───────────────────────────────────────────────────
  await db.cashEntry.createMany({
    data: CASH_ENTRIES.map((e) => ({
      id: e.id,
      type: e.type,
      category: e.category,
      description: e.description,
      amount: e.amount,
      source: e.source ?? "Kas Tunai",
      entryDate: parseDateLabel(e.dateLabel),
      dateLabel: e.dateLabel,
      dateSort: e.dateSort ?? dateSortFromLabel(e.dateLabel),
      attachment: e.attachment ?? null,
    })),
  });

  // ── Staf contoh (link akses + PIN — bisa langsung diuji dari portal /staff) ─
  await db.staffMember.createMany({
    data: [
      {
        propertyId: SEED_PROPERTY_ID,
        name: "Ratna Sari",
        phone: "+62 813-7710-4455",
        role: "ADMIN_OPERASIONAL",
        accessToken: "stk_seed_ratna_9f21c7a4d8e3b605",
        accessPin: "482913",
        isActive: true,
      },
      {
        propertyId: SEED_PROPERTY_ID,
        name: "Agus Setiawan",
        phone: "+62 815-2233-8890",
        role: "PENJAGA_TEKNISI",
        accessToken: "stk_seed_agus_4c8e2b71fd0a9362",
        accessPin: "135724",
        isActive: true,
      },
    ],
  });
}

/** ID transaksi kas berikutnya — keluar "KX-012", masuk "KM-001", … (lanjutan seed) */
export async function nextCashId(type: CashType = "keluar"): Promise<string> {
  const prefix = type === "masuk" ? "KM" : "KX";
  const ids = await db.cashEntry.findMany({ select: { id: true } });
  const max = ids.reduce((m, row) => {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(row.id);
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}
