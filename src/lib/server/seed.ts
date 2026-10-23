// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Auto-seed database Supabase (sekali, idempoten)
//
// GET pertama pada endpoint mana pun (rooms/invoices/cash/staff/properties)
// memanggil ensureSeed(): bila tabel masih kosong, seluruh dataset demo
// (12 kamar + penghuni, tagihan Sep 2026, buku kas dgn tanggal dinamis bulan
// berjalan, 2 staf contoh, properti utama "Kost Griya Pratama") dimigrasikan
// ke Supabase. Dari titik ini data tersimpan permanen di cloud & tersinkron
// lintas perangkat.
//
// Memoisasi promise per proses → request paralel (rooms+cash+invoices bersamaan)
// hanya memicu satu kali seed. Bila tabel sudah terisi, fungsi langsung kembali.
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from "@prisma/client";

import { db } from "@/lib/prisma";
import { DEMO_OWNER_ID } from "@/lib/auth/config";
import { ensureSchema } from "@/lib/server/schema";
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
 * Jalankan operasi seed sambil mengabaikan tabrakan id unik (P2002).
 * Di serverless (Vercel) beberapa instance bisa memicu seed BERSAMAAN pada
 * request demo pertama — semua id seed konstan, jadi P2002 hanya berarti
 * "instance lain sedang/sudah menulis data yang sama" → aman dilanjutkan.
 * Tanpa ini, request demo yang kalah race menjawab 500 → dashboard offline.
 */
async function ignoreUniqueConflict(op: () => Promise<unknown>): Promise<void> {
  try {
    await op();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
}

/**
 * Seed dataset demo HANYA untuk sesi demo (mode lokal). Owner Supabase
 * tidak pernah memicu seed — data contoh tidak boleh memenuhi database
 * produksi SaaS. Owner baru mendapat properti kosong via /api/onboarding.
 */
export async function ensureSeedForUser(user: { demo: boolean } | null): Promise<void> {
  // Self-heal skema DULU sebelum query apa pun — bila skema Prisma lebih baru
  // dari tabel Supabase produksi (mis. kolom invoices."checkIn" hasil fitur
  // sewa harian), DDL idempoten menyinkronkannya di sini sehingga INSERT kamar
  // & SELECT denah tidak pernah gagal "column does not exist". Gagal heal
  // dilempar: GET fail-open (offline mode), MUTASI fail-loud dgn error nyata.
  await ensureSchema();
  if (user?.demo) await ensureSeed();
}

async function runSeed(): Promise<void> {
  const existing = await db.property.findUnique({ where: { id: SEED_PROPERTY_ID } });
  if (existing) {
    // Properti demo sudah ada — tabel yang lebih baru tetap dipastikan terisi
    // (idempoten) agar modul Komplain & Pengumuman hidup di database lama.
    await seedTicketsIfEmpty();
    await seedTechniciansIfEmpty();
    await seedAnnouncementsIfEmpty();
    return;
  }

  // Era multi-tenant: seed demo penuh bila properti demo belum ada. Kamar demo
  // berlabel "101"+ (scoped kgp) sehingga aman berdampingan dengan properti
  // owner lain (label "01", "02", …); dataset demo hanya terlihat oleh sesi
  // demo (ownerId = DEMO_OWNER_ID) dan tidak pernah muncul di dashboard owner.
  // Owner nyata mendapat properti kosong via /api/onboarding.

  // ── Properti utama (P2002-safe: instance lain mungkin sudah membuat) ──────
  await ignoreUniqueConflict(() =>
    db.property.create({
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
    }),
  );

  // ── Kamar + penghuni (dataset mock → relasional, P2002-safe) ───────────────
  for (const room of ROOMS) {
    await ignoreUniqueConflict(() =>
      db.room.create({
        data: {
        id: room.id,
        // Nomor tampilan murni — dataset demo tidak pernah menyertakan suffix
        nomor: room.id,
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
                  // Isolasi multi-cabang — penghuni demo milik properti seed
                  propertyId: SEED_PROPERTY_ID,
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
      }),
    );
  }

  // ── Tagihan & rincian (Sep 2026, P2002-safe) ───────────────────────────────
  for (const inv of INVOICES) {
    await ignoreUniqueConflict(() =>
      db.invoice.create({
      data: {
        id: inv.id,
        roomId: inv.roomId,
        // Isolasi multi-cabang — tagihan demo milik properti seed
        propertyId: SEED_PROPERTY_ID,
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
      }),
    );
  }

  // ── Buku kas (tanggal dinamis bulan berjalan — buildDemoCashEntries) ───────
  await ignoreUniqueConflict(() =>
    db.cashEntry.createMany({
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
    }),
  );

  // ── Staf contoh (link akses + PIN — bisa langsung diuji dari portal /staff) ─
  await ignoreUniqueConflict(() =>
    db.staffMember.createMany({
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
    }),
  );

  // ── Tiket komplain & pemeliharaan (Sep 2026) ───────────────────────────────
  await seedTicketsIfEmpty();

  // ── Kontak teknisi on-call ─────────────────────────────────────────────────
  await seedTechniciansIfEmpty();

  // ── Pengumuman & broadcast (banner Portal Penyewa) ─────────────────────────
  await seedAnnouncementsIfEmpty();
}

/** Seed kontak teknisi demo — idempoten: hanya bila tabel masih kosong */
async function seedTechniciansIfEmpty(): Promise<void> {
  const count = await db.technicianContact.count();
  if (count > 0) return;
  await ignoreUniqueConflict(() =>
    db.technicianContact.createMany({
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
    }),
  );
}

/** Seed tiket demo — idempoten: hanya bila tabel masih kosong */
async function seedTicketsIfEmpty(): Promise<void> {
  const count = await db.ticket.count();
  if (count > 0) return;
  await ignoreUniqueConflict(() =>
    db.ticket.createMany({
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
    }),
  );
}

/**
 * Seed pengumuman demo — idempoten: hanya bila tabel masih kosong.
 * Dunia demo beku pada snapshot Sep 2026 (sama dengan dataset lokal
 * ANNOUNCEMENTS) supaya panel admin & Portal Penyewa menampilkan konten
 * identik baik offline (dataset lokal) maupun cloud (tabel announcements).
 * Termasuk 1 baris target "Khusus Penyewa" (targetTenantId = penyewa seed)
 * untuk mendemonstrasikan filter portal: property_id + (ALL ATAU tenant).
 */
async function seedAnnouncementsIfEmpty(): Promise<void> {
  const count = await db.announcement.count();
  if (count > 0) return;

  // Penyewa seed untuk contoh target "Khusus Penyewa" (id auto-generated saat
  // kamar dibuat — dicari, bukan di-hardcode). Bila tidak ada, baris targeted
  // kembali ke target ALL (targetTenantId null).
  const tenant = await db.tenant.findFirst({
    where: { propertyId: SEED_PROPERTY_ID },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  await ignoreUniqueConflict(() =>
    db.announcement.createMany({
      data: [
        {
          id: "#PGM-006",
          propertyId: SEED_PROPERTY_ID,
          judul: "Jadwal Pengurasan Toren Air & Mati Lampu Sementara",
          kategori: "penting",
          targetFloor: null,
          targetTenantId: null,
          isi: "Diberitahukan seluruh penghuni bahwa pengurasan toren air akan dilakukan pada Minggu, 27 Sep 2026 pukul 09.00–15.00 WIB.\n\nSelama pengerjaan:\n• Aliran air terhenti sementara (± 4 jam).\n• Lampu koridor & area parkir dimatikan pukul 10.00–12.00 WIB.\n• Mohon simpan air minum dan kebutuhan pokok sebelum jadwal tersebut.\n\nAir akan kembali mengalir normal setelah toren terisi penuh. Terima kasih atas pengertiannya.",
          tanggalMulai: "2026-09-26",
          tanggalBerakhir: "2026-09-30",
          aktif: true,
          createdAtLabel: "26 Sep 2026",
          createdAtSort: 202609260900,
        },
        {
          id: "#PGM-005",
          propertyId: SEED_PROPERTY_ID,
          judul: "Pemeliharaan Pompa Air Otomatis — Lantai 2",
          kategori: "info",
          targetFloor: 2,
          targetTenantId: null,
          isi: "Teknisi akan melakukan pengecekan rutin pompa air otomatis pada kamar lantai 2, Kamis 17 Sep 2026 pukul 08.00 WIB. Tekanan air mungkin tidak stabil ± 1 jam. Tidak perlu koordinasi khusus — cukup informasi.",
          tanggalMulai: "2026-09-15",
          tanggalBerakhir: "2026-09-18",
          aktif: true,
          createdAtLabel: "15 Sep 2026",
          createdAtSort: 202609150800,
        },
        {
          id: "#PGM-004",
          propertyId: SEED_PROPERTY_ID,
          judul: "Spot Check Kamar & Fasilitas Bersama Pemilik",
          kategori: "info",
          targetFloor: null,
          targetTenantId: null,
          isi: "Pemilik akan melakukan spot check kondisi kamar & fasilitas bersama pada 8–12 Sep 2026. Mohon izin ketuk pintu saat penghuni berada di kamar. Atas kerja samanya, terima kasih.",
          tanggalMulai: "2026-09-05",
          tanggalBerakhir: "2026-09-12",
          aktif: false, // ditarik lebih awal — contoh status nonaktif di panel
          createdAtLabel: "4 Sep 2026",
          createdAtSort: 202609040830,
        },
        {
          id: "#PGM-003",
          propertyId: SEED_PROPERTY_ID,
          judul: "Penggunaan Listrik & Perangkat High-Wattage",
          kategori: "penting",
          targetFloor: null,
          // Contoh target "Khusus Penyewa" — hanya tampil di portal penyewa ini
          targetTenantId: tenant?.id ?? null,
          isi: "Beberapa MCB sempat trip karena pemakaian setrika, water heater & charger berbarengan pada jam yang sama (21.00–23.00). Mohon tidak menjalankan perangkat high-wattage secara serentak untuk menjaga stabilitas listrik gedung.",
          tanggalMulai: "2026-09-20",
          tanggalBerakhir: "2026-09-30",
          aktif: true,
          createdAtLabel: "20 Sep 2026",
          createdAtSort: 202609200900,
        },
      ],
    }),
  );
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

/**
 * Hapus SELURUH data properti demo ("Kost Griya Pratama") lalu seed ulang
 * dari nol — dipakai tombol "Reset Data Demo" (POST /api/demo/reset) agar
 * dataset simulasi kembali persis ke kondisi awal (penghuni, tagihan, kas,
 * staf, tiket). HANYA boleh dipanggil untuk sesi demo.
 *
 * Urutan hapus aman FK: tiket & kas & staf (onDelete SetNull — harus dihapus
 * manual) → kamar (tenant/invoice/lines ikut Cascade) → properti.
 */
export async function resetDemoSeed(): Promise<void> {
  const roomScope = { propertyId: SEED_PROPERTY_ID };

  await db.ticket.deleteMany({
    // SetNull — tiket demo harus dibersihkan SEBELUM room/property dihapus
    where: { OR: [{ propertyId: SEED_PROPERTY_ID }, { room: roomScope }] },
  });
  await db.cashEntry.deleteMany({ where: { propertyId: SEED_PROPERTY_ID } });
  await db.staffMember.deleteMany({ where: { propertyId: SEED_PROPERTY_ID } });
  await db.room.deleteMany({ where: roomScope }); // tenant + invoice + lines cascade
  await db.property.deleteMany({ where: { id: SEED_PROPERTY_ID } });

  // Seed ulang penuh — bypass memo ensureSeed (data memang baru saja dihapus)
  await runSeed();
}
