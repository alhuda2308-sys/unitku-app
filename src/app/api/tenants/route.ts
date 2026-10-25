// ─────────────────────────────────────────────────────────────────────────────
// /api/tenants — siklus hidup penyewa (Supabase, atomik per langkah)
//
// POST  : check-in penyewa baru ke kamar kosong — membuat Tenant + token portal
//         unik (magic link /portal?token=…), mengunci kontrak & deposit di kamar,
//         dan menerbitkan invoice pertama (status lunas) beserta rinciannya
// PATCH : perbarui data penyewa/kontrak — perpanjang endDate, ubah deposit
// DELETE: check-out penyewa (?roomId=…) — kamar dikosongkan, kontrak dilepas;
//         riwayat tagihan dipertahankan sebagai arsip
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { ensureSeedForUser } from "@/lib/server/seed";
import { toClientInvoice, toClientRoom } from "@/lib/server/mappers";
import { getAuthUser } from "@/lib/auth/server";
import { getOwnedPropertyIds, unauthorized } from "@/lib/auth/ownership";
import { MONTH_NAMES, newPortalToken, parseDateLabel, addMonths, diffNights, formatDateLabel } from "@/lib/kost-data";

export const dynamic = "force-dynamic";

/** "8123456789" → "+62 812-3456-7890" — format tampilan konsisten dgn dataset */
function formatPhoneDisplay(digits: string): string {
  if (digits.length <= 4) return `+62 ${digits}`;
  const head = digits.slice(0, 3);
  const rest = digits.slice(3);
  const groups = rest.match(/.{1,4}/g) ?? [];
  return `+62 ${[head, ...groups].join("-")}`;
}

/** "2026-10-01" → Date lokal tengah malam (deterministik lintas timezone) */
function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── POST (check-in) ──────────────────────────────────────────────────────────

interface CheckinBody {
  roomId?: unknown;
  name?: unknown;
  phone?: unknown; // digits tanpa +62
  emergencyName?: unknown;
  emergencyPhone?: unknown;
  tanggalMasuk?: unknown; // "yyyy-mm-dd"
  siklus?: unknown; // Harian | Bulanan | Per 3 Bulan | Tahunan
  hargaSewa?: unknown;
  deposit?: unknown;
  addons?: unknown; // string[]
  totalPerBulan?: unknown;
  // ── Sewa harian (siklus Harian)
  tanggalCheckout?: unknown; // "yyyy-mm-dd"
  durasiHari?: unknown; // jumlah malam (verifikasi dari klien, dihitung ulang server)
  totalTagihan?: unknown; // harga per hari × durasi
}

const ADDON_PRICE: Record<string, number> = {
  "Parkir Motor": 50_000,
  "Parkir Mobil": 150_000,
};

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const propertyIds = await getOwnedPropertyIds(user);
    const body = (await request.json().catch(() => ({}))) as CheckinBody;

    const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phoneDigits = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
    const hargaSewa = Number(body.hargaSewa);
    const totalPerBulan = Number(body.totalPerBulan);
    const deposit = Number.isFinite(Number(body.deposit)) ? Math.max(0, Math.round(Number(body.deposit))) : 0;
    const siklus =
      body.siklus === "Harian" || body.siklus === "Per 3 Bulan" || body.siklus === "Tahunan"
        ? body.siklus
        : "Bulanan";
    const moveIn = typeof body.tanggalMasuk === "string" ? parseIsoDate(body.tanggalMasuk) : null;
    const isHarian = siklus === "Harian";
    const checkOut = isHarian && typeof body.tanggalCheckout === "string"
      ? parseIsoDate(body.tanggalCheckout)
      : null;

    if (!roomId || !name || !moveIn) {
      return NextResponse.json(
        { error: "Kamar, nama penyewa, dan tanggal masuk wajib diisi." },
        { status: 400 },
      );
    }
    if (isHarian && (!checkOut || checkOut.getTime() <= moveIn.getTime())) {
      return NextResponse.json(
        { error: "Tanggal check-out harus minimal 1 malam setelah tanggal check-in." },
        { status: 400 },
      );
    }
    if (!Number.isFinite(hargaSewa) || !Number.isFinite(totalPerBulan) || totalPerBulan <= 0) {
      return NextResponse.json({ error: "Nominal sewa tidak valid." }, { status: 400 });
    }

    // Isolasi: hanya kamar milik properti owner yang bisa dihuni
    const room = await db.room.findFirst({
      where: { id: roomId, propertyId: { in: propertyIds } },
      include: { tenant: true },
    });
    if (!room) {
      return NextResponse.json({ error: `Kamar "${roomId}" tidak ditemukan.` }, { status: 404 });
    }
    if (room.tenant) {
      return NextResponse.json(
        { error: `Kamar ${roomId} sudah dihuni ${room.tenant.name}.` },
        { status: 409 },
      );
    }

    // Kontrak: Harian → berakhir di tanggal check-out; periodik → months bulan
    const nights = isHarian
      ? Math.max(1, diffNights(String(body.tanggalMasuk), String(body.tanggalCheckout)))
      : 0;
    const totalHarian = isHarian ? Math.round(hargaSewa) * nights : 0;
    const months = siklus === "Bulanan" ? 1 : siklus === "Per 3 Bulan" ? 3 : 12;
    const contractEnd = isHarian ? checkOut! : addMonths(moveIn, months);
    const monthName = MONTH_NAMES[moveIn.getMonth()];
    const lastDay = new Date(moveIn.getFullYear(), moveIn.getMonth() + 1, 0).getDate();
    const phoneDisplay = formatPhoneDisplay(phoneDigits || "000");
    const addons = isHarian
      ? [] // add-on rutin berorientasi bulanan — tidak berlaku utk sewa harian
      : Array.isArray(body.addons)
        ? (body.addons.filter((a): a is string => typeof a === "string"))
        : [];

    // 1) Penghuni + token portal unik — terikat properti kamar (isolasi cabang)
    const tenant = await db.tenant.create({
      data: {
        roomId: room.id,
        propertyId: room.propertyId,
        name,
        phone: phoneDisplay,
        moveInAt: moveIn,
        emergencyName: typeof body.emergencyName === "string" && body.emergencyName.trim() ? body.emergencyName.trim() : null,
        emergencyPhone:
          typeof body.emergencyPhone === "string" && body.emergencyPhone.trim()
            ? body.emergencyPhone.trim()
            : null,
        portalToken: newPortalToken(room.id),
      },
    });

    // 2) Kunci kontrak di kamar + status lunas (pembayaran pertama diterima)
    // Harian: harga kamar tersimpan = tarif per hari (Villa/Homestay).
    const updatedRoom = await db.room.update({
      where: { id: room.id },
      data: {
        status: "lunas",
        price: Math.round(isHarian ? hargaSewa : totalPerBulan),
        contractDuration: siklus,
        contractStart: moveIn,
        contractEnd,
        deposit,
        depositHeld: true,
      },
      include: { tenant: true, invoices: { orderBy: { periodKey: "desc" } } },
    });

    // 3) Invoice pertama (bulan masuk — lunas saat check-in)
    // Satu invoice per kamar per periode (@@unique roomId+periodKey): bila kamar
    // sudah punya invoice periode sama (arsip penyewa sebelumnya), perbarui
    // invoice itu menjadi milik penyewa baru; jika belum ada, buat dengan ID unik.
    // Harian: rincian check-in/check-out & durasi (malam) ikut tersimpan agar
    // template tagihan/kwitansi WA menampilkannya secara otomatis.
    const periodKey = `${moveIn.getFullYear()}-${String(moveIn.getMonth() + 1).padStart(2, "0")}`;
    const invoiceLines = isHarian
      ? [{ label: "Sewa Harian", amount: Math.round(hargaSewa) }]
      : [
          { label: "Sewa Kamar", amount: Math.round(hargaSewa) },
          ...addons.map((a) => ({ label: a, amount: ADDON_PRICE[a] ?? 0 })),
        ];
    const invoiceData = {
      tenantName: name,
      tenantPhone: phoneDisplay,
      roomType: room.type,
      periodLabel: isHarian
        ? `${formatDateLabel(String(body.tanggalMasuk))} – ${formatDateLabel(String(body.tanggalCheckout))} (${nights} Malam)`
        : `1 ${monthName} – ${lastDay} ${monthName} ${moveIn.getFullYear()}`,
      dueDate: moveIn,
      status: "lunas",
      // Pembayaran pertama terjadi SAAT CHECK-IN (= tanggal masuk), bukan hari
      // eksekusi API — check-in mundur (penghuni lama didata, masuk berbulan-
      // bulan lalu) tidak boleh tercatat "membayar hari ini" agar arsip &
      // kwitansi WA tetap jujur. Status kamar dinamis (room-status.ts) murni
      // tanggal: kontrak lewat tetap tampil "Menunggak" apa pun paidAt.
      paidAt: moveIn,
      total: isHarian ? totalHarian : Math.round(totalPerBulan),
      checkIn: isHarian ? moveIn : null,
      checkOut: isHarian ? checkOut : null,
      nights: isHarian ? nights : null,
    };
    const reused = await db.invoice.findUnique({
      where: { roomId_periodKey: { roomId: room.id, periodKey } },
      include: { lines: true },
    });
    let invoice;
    if (reused) {
      await db.invoiceLine.deleteMany({ where: { invoiceId: reused.id } });
      invoice = await db.invoice.update({
        where: { id: reused.id },
        data: { ...invoiceData, lines: { create: invoiceLines } },
        include: { lines: true },
      });
    } else {
      const baseInvoiceId = `#INV-${periodKey.replace("-", "")}-${room.id}`;
      let invoiceId = baseInvoiceId;
      let seq = 2;
      while (await db.invoice.findUnique({ where: { id: invoiceId } })) {
        invoiceId = `${baseInvoiceId}-${seq}`;
        seq += 1;
      }
      invoice = await db.invoice.create({
        data: {
          id: invoiceId,
          roomId: room.id,
          propertyId: room.propertyId,
          periodKey,
          ...invoiceData,
          lines: { create: invoiceLines },
        },
        include: { lines: true },
      });
    }

    return NextResponse.json(
      { room: toClientRoom(updatedRoom), invoice: toClientInvoice(invoice, updatedRoom.nomor ?? updatedRoom.id), tenantId: tenant.id },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api/tenants POST]", err);
    return NextResponse.json(
      { error: "Gagal memproses check-in penyewa." },
      { status: 500 },
    );
  }
}

// ── PATCH (perpanjang kontrak / ubah deposit / edit data penghuni) ───────────

/** Baris kolom kustom JSONB — sanitasi ketat sebelum masuk database */
function sanitizeCustomFields(raw: unknown): Prisma.InputJsonValue {
  if (!Array.isArray(raw)) return [];
  const clean = raw
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const rec = item as Record<string, unknown>;
      const label = typeof rec.label === "string" ? rec.label.trim().slice(0, 80) : "";
      const value = typeof rec.value === "string" ? rec.value.trim().slice(0, 300) : "";
      return label ? { label, value } : null;
    })
    .filter((v): v is { label: string; value: string } => v !== null)
    .slice(0, 25);
  return clean as unknown as Prisma.InputJsonValue;
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const propertyIds = await getOwnedPropertyIds(user);
    const body = (await request.json().catch(() => ({}))) as {
      roomId?: unknown;
      contractEnd?: unknown; // label "30 Mar 2026"
      deposit?: unknown;
      // ── Edit Data Penghuni (profil penyewa — kolom tabel tenants) ──
      name?: unknown;
      phone?: unknown;
      occupation?: unknown;
      maritalStatus?: unknown;
      guardianName?: unknown;
      emergencyPhone?: unknown;
      addressKtp?: unknown;
      notes?: unknown;
      customFields?: unknown; // [{ label, value }]
    };
    const roomId = typeof body.roomId === "string" ? body.roomId : "";
    const room = await db.room.findFirst({
      where: { id: roomId, propertyId: { in: propertyIds } },
      include: { tenant: true },
    });
    if (!room) {
      return NextResponse.json({ error: `Kamar "${roomId}" tidak ditemukan.` }, { status: 404 });
    }
    if (!room.tenant) {
      return NextResponse.json({ error: `Kamar ${roomId} tidak memiliki penghuni aktif.` }, { status: 409 });
    }

    const data: Prisma.RoomUpdateInput = {};
    if (typeof body.contractEnd === "string" && body.contractEnd.trim()) {
      const parsed = parseDateLabel(body.contractEnd.trim());
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Format tanggal kontrak tidak valid." }, { status: 400 });
      }
      data.contractEnd = parsed;
      // Perpanjangan kontrak menonaktifkan alarm "Jatuh Tempo/Menunggak" yang
      // bersumber dari kontrak LAMA yang sudah kedaluwarsa — kamar kembali
      // "lunas" (aksi eksplisit pemilik, bukan penurunan otomatis). Tunggakan
      // nyata periode baru tetap bisa ditandai lewat Tagihan; sinkron dinamis
      // (room-status-sync) kembali menaikkan status bila kontrak berikutnya
      // benar-benar lewat. Tanpa ini, kamar yang diperpanjang tetap merah
      // selamanya meski kontraknya sudah sehat ke depan.
      if (
        (room.status === "menunggak" || room.status === "jatuhTempo") &&
        room.contractEnd &&
        room.contractEnd.getTime() <= Date.now()
      ) {
        data.status = "lunas";
      }
    }
    if (Number.isFinite(Number(body.deposit))) data.deposit = Math.max(0, Math.round(Number(body.deposit)));

    // ── Profil penyewa — partial update: hanya kolom yang dikirim yang berubah
    const tenantData: Prisma.TenantUpdateInput = {};
    if (typeof body.name === "string") {
      const n = body.name.trim().slice(0, 120);
      if (!n) {
        return NextResponse.json({ error: "Nama lengkap penyewa tidak boleh kosong." }, { status: 400 });
      }
      tenantData.name = n;
    }
    if (typeof body.phone === "string") {
      // Terima bentuk apa pun ("+62 812-…", "0812…", "812…") → tampilan konsisten
      let digits = body.phone.replace(/\D/g, "");
      if (digits.startsWith("62")) digits = digits.slice(2);
      else if (digits.startsWith("0")) digits = digits.slice(1);
      if (!digits) {
        return NextResponse.json({ error: "Nomor WhatsApp tidak valid." }, { status: 400 });
      }
      tenantData.phone = formatPhoneDisplay(digits);
    }
    if (typeof body.occupation === "string") tenantData.occupation = body.occupation.trim().slice(0, 120) || null;
    if (typeof body.maritalStatus === "string") tenantData.maritalStatus = body.maritalStatus.trim().slice(0, 40) || null;
    if (typeof body.guardianName === "string") tenantData.guardianName = body.guardianName.trim().slice(0, 120) || null;
    if (typeof body.emergencyPhone === "string") {
      const digits = body.emergencyPhone.replace(/\D/g, "");
      tenantData.emergencyPhone = digits ? body.emergencyPhone.trim().slice(0, 40) : null;
    }
    if (typeof body.addressKtp === "string") tenantData.addressKtp = body.addressKtp.trim().slice(0, 400) || null;
    if (typeof body.notes === "string") tenantData.notes = body.notes.trim().slice(0, 1000) || null;
    if (body.customFields !== undefined) tenantData.customFields = sanitizeCustomFields(body.customFields);

    if (Object.keys(data).length === 0 && Object.keys(tenantData).length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
    }

    if (Object.keys(data).length > 0) {
      await db.room.update({ where: { id: roomId }, data });
    }
    if (Object.keys(tenantData).length > 0) {
      // roomId @unique → update by roomId; keberadaan tenant sudah dipastikan di atas
      await db.tenant.update({ where: { roomId }, data: tenantData });
    }
    const updated = await db.room.findUniqueOrThrow({
      where: { id: roomId },
      include: { tenant: true, invoices: { orderBy: { periodKey: "desc" }, take: 1 } },
    });
    return NextResponse.json({ room: toClientRoom(updated) });
  } catch (err) {
    console.error("[api/tenants PATCH]", err);
    return NextResponse.json({ error: "Gagal memperbarui data penyewa." }, { status: 500 });
  }
}

// ── DELETE (check-out) ───────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const propertyIds = await getOwnedPropertyIds(user);
    const roomId = request.nextUrl.searchParams.get("roomId");
    if (!roomId) {
      return NextResponse.json({ error: "Parameter ?roomId= wajib diisi." }, { status: 400 });
    }
    const room = await db.room.findFirst({
      where: { id: roomId, propertyId: { in: propertyIds } },
      include: { tenant: true },
    });
    if (!room) {
      return NextResponse.json({ error: `Kamar "${roomId}" tidak ditemukan.` }, { status: 404 });
    }
    if (!room.tenant) {
      return NextResponse.json({ error: `Kamar ${roomId} memang sudah kosong.` }, { status: 409 });
    }

    const tenantName = room.tenant.name;
    await db.tenant.delete({ where: { roomId } }); // arsip riwayat tagihan tetap ada
    const updated = await db.room.update({
      where: { id: roomId },
      data: {
        status: "kosong",
        contractDuration: null,
        contractStart: null,
        contractEnd: null,
        deposit: 0,
        depositHeld: false,
      },
      include: { tenant: true, invoices: { orderBy: { periodKey: "desc" }, take: 1 } },
    });

    return NextResponse.json({ room: toClientRoom(updated), checkedOut: tenantName });
  } catch (err) {
    console.error("[api/tenants DELETE]", err);
    return NextResponse.json({ error: "Gagal memproses check-out penyewa." }, { status: 500 });
  }
}
