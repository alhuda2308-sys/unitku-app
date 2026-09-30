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
import { DEMO_OWNER_ID } from "@/lib/auth/config";
import { ROOMS, parseDateLabel, seededPortalToken } from "@/lib/kost-data";
import { INVOICES } from "@/lib/kost-invoices";
import { CASH_ENTRIES, dateSortFromLabel, type CashType } from "@/lib/kost-cashflow";
import { TICKETS } from "@/lib/ticket-data";

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

/**
 * Seed dataset demo HANYA untuk sesi demo (mode lokal). Owner Supabase
 * tidak pernah memicu seed — data contoh tidak boleh memenuhi database
 * produksi SaaS. Owner baru mendapat properti kosong via /api/onboarding.
 */
export async function ensureSeedForUser(user: { demo: boolean } | null): Promise<void> {
  if (user?.demo) await ensureSeed();
}

async function runSeed(): Promise<void> {
  const existing = await db.property.findUnique({ where: { id: SEED_PROPERTY_ID } });
  if (existing) {
    // Properti demo sudah ada — tiket & kontak teknisi adalah tabel yang lebih
    // baru: pastikan terisi (idempoten) agar modul Komplain hidup.
    await seedTicketsIfEmpty();
    await seedTechniciansIfEmpty();
    return;
  }

  // Era multi-tenant: seed demo penuh bila properti demo belum ada. Kamar demo
  // berlabel "101"+ (scoped kgp) sehingga aman berdampingan dengan properti
  // owner lain (label "01", "02", …); dataset demo hanya terlihat oleh sesi
  // demo (ownerId = DEMO_OWNER_ID) dan tidak pernah muncul di dashboard owner.
  // Owner nyata mendapat properti kosong via /api/onboarding.

  // ── Properti utama ────────────────────────────────────────────────────────
  await db.property.create({
    data: {
      id: SEED_PROPERTY_ID,
      ownerId: DEMO_OWNER_ID,
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
      // Isolasi multi-tenant — kas demo milik properti seed
      propertyId: SEED_PROPERTY_ID,
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

  // ── Tiket komplain & pemeliharaan (Sep 2026) ───────────────────────────────
  await seedTicketsIfEmpty();

  // ── Kontak teknisi on-call ─────────────────────────────────────────────────
  await seedTechniciansIfEmpty();
}

/** Seed kontak teknisi demo — idempoten: hanya bila tabel masih kosong */
async function seedTechniciansIfEmpty(): Promise<void> {
  const count = await db.technicianContact.count();
  if (count > 0) return;
  await db.technicianContact.createMany({
    data: [
      {
        propertyId: SEED_PROPERTY_ID,
        name: "Pak Yanto",
        phone: "081322001177",
        specialization: "AC & Pendingin",
        isPrimary: true,
      },
      {
        propertyId: SEED_PROPERTY_ID,
        name: "Pak Joko",
        phone: "081322002288",
        specialization: "Pipa & Sanitasi",
        isPrimary: false,
      },
      {
        propertyId: SEED_PROPERTY_ID,
        name: "Servicing Jaya",
        phone: "081288994410",
        specialization: "Listrik",
        isPrimary: false,
      },
    ],
  });
}

/** Seed tiket demo — idempoten: hanya bila tabel masih kosong */
async function seedTicketsIfEmpty(): Promise<void> {
  const count = await db.ticket.count();
  if (count > 0) return;
  await db.ticket.createMany({
    data: TICKETS.map((t) => ({
      id: t.id,
      // Properti seed — tiket fasilitas (roomId null) tetap terikat kgp
      propertyId: SEED_PROPERTY_ID,
      roomId: t.sumber === "penyewa" ? (t.roomId ?? null) : null,
      lokasi: t.lokasi ?? null,
      sumber: t.sumber,
      judul: t.judul,
      urgensi: t.urgensi,
      reporterName: t.reporterName,
      reporterPhone: t.reporterPhone,
      kategori: t.kategori,
      deskripsi: t.deskripsi,
      photos: t.photos,
      status: t.status,
      reportedLabel: t.reportedLabel,
      reportedSort: BigInt(t.reportedSort),
      teknisiName: t.teknisi?.name ?? null,
      teknisiPhone: t.teknisi?.phone ?? null,
      selesaiLabel: t.selesaiLabel ?? null,
    })),
  });
}

/** ID transaksi kas berikutnya — keluar "KX-012", masuk "KM-001", … (lanjutan seed) */
export async function nextCashId(type: CashType = "keluar"): Promise<string> {
  const prefix = type === "masuk" ? "KM" : "KX";
  const ids = await db.cashEntry.findMany({ select: { id: true, propertyId: true } });
  const max = ids.reduce((m, row) => {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(row.id);
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

/** ID tiket berikutnya — max #TKT-N existing + 1 ("#TKT-042") */
export async function nextTicketId(): Promise<string> {
  const ids = await db.ticket.findMany({ select: { id: true } });
  const max = ids.reduce((m, row) => {
    const n = Number(row.id.replace(/[^0-9]/g, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `#TKT-${String(max + 1).padStart(3, "0")}`;
}
