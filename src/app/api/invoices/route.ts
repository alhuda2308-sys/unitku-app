// ─────────────────────────────────────────────────────────────────────────────
// /api/invoices — Tagihan & invoice (Supabase)
//
// GET    : seluruh tagihan + rincian (bentuk UI kost-invoices.ts)
// POST   : GENERATOR TAGIHAN BULANAN — pindai semua kamar terisi (ada penyewa
//          aktif), buat draft invoice utk periode terpilih yang belum punya
//          tagihan. Anti-duplikat: @@unique([roomId, periodKey]) + pre-scan.
//          Rincian standar: Sewa Pokok (invoice terakhir kamar) + add-on
//          berulang non-listrik (Parkir/Kebersihan/dll. "jika ada").
// PATCH  : tandai lunas ({ id, status: "lunas" }) — kamar ikut disetel lunas,
//          paidAt diperbarui & transaksi pemasukan otomatis dicatat ke Buku
//          Kas; atau perbarui rincian add-on ({ id, lines: [...] }) sebelum
//          tagihan dikirim ("Simpan & Siap Ditagih")
// DELETE : batalkan tagihan (?id=…)
//
// ANTI-500 (fail-open): seluruh pemanggilan database dibungkus try...catch.
// Bila kredensial database tidak terbaca atau query gagal, handler mengembalikan
// 200 { success: true, data: [] } — BUKAN 500 — agar bootstrap dashboard tidak
// langsung jatuh ke mode offline fatal. Detail penyebab selalu dicetak ke log
// server: console.error("Detail error API invoices/rooms:", error).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { ensureSeedForUser, nextCashId } from "@/lib/server/seed";
import { toClientCashEntry, toClientInvoice, toClientRoom } from "@/lib/server/mappers";
import { getAuthUser } from "@/lib/auth/server";
import {
  getOwnedPropertyIds,
  notOwned,
  resolveOwnedPropertyScopeLenient,
  unauthorized,
} from "@/lib/auth/ownership";
import { MONTH_NAMES, dateToLabel } from "@/lib/kost-data";
import { dateSortFromLabel } from "@/lib/kost-cashflow";
import { periodKeyOf, periodLabelFromKey, periodShortLabel } from "@/lib/kost-invoices";

export const dynamic = "force-dynamic";

const INVOICE_INCLUDE = { lines: { orderBy: { id: "asc" as const } } } satisfies Prisma.InvoiceInclude;

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    // Scope opsional ?propertyId= — tagihan dimuat SESUAI cabang aktif di
    // switcher properti; tanpa param = perilaku lama (semua properti owner).
    // LENIENT: id basi/tidak dikenal → fallback seluruh properti owner (200),
    // bukan 404 — dashboard tidak pernah offline karena localStorage basi.
    const scope = await resolveOwnedPropertyScopeLenient(
      user,
      request.nextUrl.searchParams.get("propertyId")?.trim() || null,
    );
    // Filter kolom LANGSUNG propertyId (tanpa join room) — kolom di-backfill
    // otomatis oleh self-heal sehingga seluruh baris terisi.
    const invoices = await db.invoice.findMany({
      where: { propertyId: { in: scope } },
      include: INVOICE_INCLUDE,
      orderBy: [{ periodKey: "desc" }, { roomId: "asc" }],
    });
    return NextResponse.json({ success: true, invoices: invoices.map(toClientInvoice) });
  } catch (err) {
    // Kredensial database tidak terbaca / query gagal → JANGAN 500: dashboard
    // memperlakukan kegagalan muat awal sebagai mode offline fatal. Fail-open
    // 200 dgn data kosong; UI tetap hidup & otomatis sinkron ulang saat DB pulih.
    console.error("Detail error API invoices/rooms:", err);
    return NextResponse.json({ success: true, data: [], invoices: [] });
  }
}

// ── POST — Generator Tagihan Bulanan (batch) ─────────────────────────────────

/** "2026-10" */
const PERIOD_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Add-on yang ikut berulang ke tagihan baru (listrik dihitung ulang via meteran) */
function isRecurringAddon(label: string): boolean {
  return label !== "Sewa Kamar" && !label.startsWith("Listrik");
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const propertyIds = await getOwnedPropertyIds(user);
    if (propertyIds.length === 0) {
      return NextResponse.json(
        { error: "Properti belum terdaftar — lengkapi onboarding terlebih dahulu." },
        { status: 400 },
      );
    }
    const body = (await request.json().catch(() => ({}))) as {
      periodKey?: unknown;
      propertyId?: unknown;
    };
    const periodKey = typeof body.periodKey === "string" ? body.periodKey.trim() : "";
    if (!PERIOD_KEY_RE.test(periodKey)) {
      return NextResponse.json(
        { error: "Periode tidak valid — gunakan format \"YYYY-MM\", misal \"2026-10\"." },
        { status: 400 },
      );
    }
    // Generator hanya memindai cabang AKTIF yang sedang dikelola bila klien
    // mengirim propertyId; tanpa itu = perilaku lama (semua properti owner).
    const requestedId = typeof body.propertyId === "string" ? body.propertyId.trim() : "";
    let scopeIds = propertyIds;
    if (requestedId) {
      if (!propertyIds.includes(requestedId)) return notOwned("Properti tidak ditemukan.");
      scopeIds = [requestedId];
    }

    const [year, month] = periodKey.split("-").map(Number);
    const monthName = MONTH_NAMES[month - 1];
    const lastDay = new Date(year, month, 0).getDate();
    const periodLabel = periodLabelFromKey(periodKey);

    // 1) Semua kamar TERISI milik owner (ada penyewa aktif) — kosong/renovasi dilewati
    const occupiedRooms = await db.room.findMany({
      where: { propertyId: { in: scopeIds }, tenant: { isNot: null } },
      include: { tenant: true },
      orderBy: { id: "asc" },
    });

    // 2) Kamar yang sudah ditagih pada periode ini — anti duplikasi
    const existing = await db.invoice.findMany({
      where: { propertyId: { in: scopeIds }, periodKey },
      select: { roomId: true, id: true },
    });
    const billedRooms = new Set(existing.map((i) => i.roomId));
    const existingIds = new Set(existing.map((i) => i.id));
    // Kamar kontrak Harian (Villa/Homestay) ditagih di muka saat check-in —
    // bukan bagian dari siklus tagihan bulanan.
    const pendingRooms = occupiedRooms.filter(
      (r) => !billedRooms.has(r.id) && r.contractDuration !== "Harian",
    );

    // 3) Riwayat invoice terakhir per kamar milik owner — sumber Sewa Pokok & add-on
    const history = await db.invoice.findMany({
      where: { propertyId: { in: scopeIds } },
      include: { lines: true },
      orderBy: [{ roomId: "asc" }, { periodKey: "desc" }],
    });
    const latestByRoom = new Map<string, (typeof history)[number]>();
    for (const inv of history) {
      if (!latestByRoom.has(inv.roomId)) latestByRoom.set(inv.roomId, inv);
    }

    // 4) Tenggat bayar = tanggal siklus penyewa (hari move-in) pada periode ini
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const created: (Prisma.InvoiceGetPayload<{ include: typeof INVOICE_INCLUDE }>)[] = [];
    const roomStatusUpdates: { id: string; status: string }[] = [];

    for (const room of pendingRooms) {
      const tenant = room.tenant;
      if (!tenant) continue;

      // Sewa pokok: nilai "Sewa Kamar" invoice terakhir (akurat utk kamar check-in
      // yg price-nya sudah termasuk add-on), fallback harga kamar
      const prev = latestByRoom.get(room.id);
      const prevSewa = prev?.lines.find((l) => l.label === "Sewa Kamar")?.amount;
      const sewaPokok = prevSewa ?? room.price;
      const recurringAddons = (prev?.lines ?? [])
        .filter((l) => isRecurringAddon(l.label))
        .map((l) => ({ label: l.label, amount: l.amount }));

      const lines = [{ label: "Sewa Kamar", amount: sewaPokok }, ...recurringAddons];
      const total = lines.reduce((a, l) => a + l.amount, 0);

      const moveInDay = tenant.moveInAt ? tenant.moveInAt.getDate() : 24;
      const dueDay = Math.min(Math.max(1, moveInDay), lastDay);
      const dueDate = new Date(year, month - 1, dueDay);

      // Status awal draft: lewat tenggat → menunggak (H+n), selain itu belum bayar
      const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000);
      const status = diffDays < 0 ? "menunggak" : "belumBayar";
      const dayOffset = diffDays < 0 ? -diffDays : null;

      // ID unik — hindari tabrakan dgn arsip (#INV-202610-106, -2, -3, …)
      const baseInvoiceId = `#INV-${periodKey.replace("-", "")}-${room.id}`;
      let invoiceId = baseInvoiceId;
      let seq = 2;
      while (existingIds.has(invoiceId) || (await db.invoice.findUnique({ where: { id: invoiceId } }))) {
        invoiceId = `${baseInvoiceId}-${seq}`;
        seq += 1;
      }
      existingIds.add(invoiceId);

      const invoice = await db.invoice.create({
        data: {
          id: invoiceId,
          roomId: room.id,
          // Isolasi multi-cabang — tagihan terikat properti kamar sumber
          propertyId: room.propertyId,
          tenantName: tenant.name,
          tenantPhone: tenant.phone,
          roomType: room.type,
          periodLabel,
          periodKey,
          dueDate,
          status,
          dayOffset,
          total,
          lines: { create: lines },
        },
        include: INVOICE_INCLUDE,
      });
      created.push(invoice);

      // Sinkronkan pill kamar: menunggak selalu naik; belum bayar menggantikan lunas
      const nextRoomStatus =
        status === "menunggak" ? "menunggak" : room.status === "lunas" ? "jatuhTempo" : room.status;
      roomStatusUpdates.push({ id: room.id, status: nextRoomStatus });
    }

    // 5) Terapkan pembaruan status kamar (paralel, aman utk pooler)
    await Promise.all(
      roomStatusUpdates.map((u) =>
        db.room.update({ where: { id: u.id }, data: { status: u.status } }).catch(() => null),
      ),
    );

    return NextResponse.json(
      {
        created: created.map(toClientInvoice),
        scanned: occupiedRooms.length,
        skipped: occupiedRooms.length - pendingRooms.length,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Detail error API invoices/rooms:", err);
    // Fail-open 200 — payload memuat bentuk kosong sesuai kontrak klien
    // (created/scanned/skipped) agar UI tidak pernah menerima 500.
    return NextResponse.json({ success: true, data: [], created: [], scanned: 0, skipped: 0 });
  }
}

// ── PATCH — tandai lunas / perbarui rincian add-on ───────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
      roomId?: unknown; // fallback: cari/buat tagihan milik kamar ini bila id tak dikenal
      periodKey?: unknown; // opsional — periode tagihan yang dilunasi (auto-create)
      status?: unknown;
      lines?: unknown; // [{ label, amount }] — "Simpan & Siap Ditagih"
    };
    const ownedIds = await getOwnedPropertyIds(user);
    const rawId = typeof body.id === "string" ? body.id.trim() : "";
    const fallbackRoomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
    if (!rawId && !fallbackRoomId) {
      return NextResponse.json({ error: "Parameter id atau roomId tagihan wajib diisi." }, { status: 400 });
    }

    let before = rawId
      ? await db.invoice.findFirst({
          where: { id: rawId, propertyId: { in: ownedIds } },
          include: INVOICE_INCLUDE,
        })
      : null;

    // ── Fallback / auto-create (khusus penandaan lunas) ─────────────────────
    // id tidak dikenal (state klien basi) atau tidak disertakan BUKAN alasan
    // gagal: pakai tagihan aktif milik kamar, atau catat invoice periode
    // terkait yang langsung berstatus lunas (pembayaran manual/tunai tanpa
    // tagihan terbit) — status kamar ikut hijau & pemasukan tercatat di kas.
    let autoCreated = false;
    if (!before && fallbackRoomId && body.status === "lunas" && !Array.isArray(body.lines)) {
      const room = await db.room.findFirst({
        where: { id: fallbackRoomId, propertyId: { in: ownedIds } },
        include: {
          tenant: true,
          invoices: {
            orderBy: { periodKey: "desc" },
            include: { lines: { orderBy: { id: "asc" as const } } },
          },
        },
      });
      if (room) {
        const reqPeriod =
          typeof body.periodKey === "string" && PERIOD_KEY_RE.test(body.periodKey)
            ? body.periodKey
            : "";
        const active = reqPeriod
          ? (room.invoices.find((i) => i.periodKey === reqPeriod && i.status !== "lunas") ??
            room.invoices.find((i) => i.status !== "lunas"))
          : room.invoices.find((i) => i.status !== "lunas");
        if (active) {
          // Ada tagihan aktif — id dari klien basi, pakai tagihan sungguhan
          before = await db.invoice.findFirst({
            where: { id: active.id, propertyId: { in: ownedIds } },
            include: INVOICE_INCLUDE,
          });
        } else {
          // Tidak ada tagihan tertunggak sama sekali → catat invoice periode
          // terkait (permintaan klien bila valid, bila tidak periode berjalan)
          // yang langsung lunas — idempoten bila periode itu sudah ada.
          const now = new Date();
          const periodKey = reqPeriod || periodKeyOf(now);
          const existing = await db.invoice.findUnique({
            where: { roomId_periodKey: { roomId: room.id, periodKey } },
            include: INVOICE_INCLUDE,
          });
          if (existing) {
            before = existing;
          } else {
            const [year, month] = periodKey.split("-").map(Number);
            const lastDay = new Date(year, month, 0).getDate();
            const moveInDay = room.tenant?.moveInAt
              ? room.tenant.moveInAt.getDate()
              : now.getDate();
            const dueDate = new Date(year, month - 1, Math.min(Math.max(1, moveInDay), lastDay));
            // Rincian mengikuti tagihan terakhir kamar (Sewa Pokok + add-on berulang)
            const prev = room.invoices[0];
            const prevSewa = prev?.lines.find((l) => l.label === "Sewa Kamar")?.amount;
            const sewaPokok = prevSewa ?? room.price;
            const lines = [
              { label: "Sewa Kamar", amount: sewaPokok },
              ...(prev?.lines ?? [])
                .filter((l) => isRecurringAddon(l.label))
                .map((l) => ({ label: l.label, amount: l.amount })),
            ];
            const total = lines.reduce((a, l) => a + l.amount, 0);

            const baseInvoiceId = `#INV-${periodKey.replace("-", "")}-${room.id}`;
            let invoiceId = baseInvoiceId;
            let seq = 2;
            while (await db.invoice.findUnique({ where: { id: invoiceId }, select: { id: true } })) {
              invoiceId = `${baseInvoiceId}-${seq}`;
              seq += 1;
            }

            before = await db.invoice.create({
              data: {
                id: invoiceId,
                roomId: room.id,
                propertyId: room.propertyId,
                tenantName: room.tenant?.name ?? null,
                tenantPhone: room.tenant?.phone ?? null,
                roomType: room.type,
                periodLabel: periodLabelFromKey(periodKey),
                periodKey,
                dueDate,
                status: "lunas",
                dayOffset: null,
                paidAt: now,
                total,
                lines: { create: lines },
              },
              include: INVOICE_INCLUDE,
            });
            autoCreated = true;
          }
        }
      }
    }

    if (!before) {
      return NextResponse.json({ error: "Tagihan tidak ditemukan." }, { status: 404 });
    }

    // ── Mode A: perbarui rincian add-on (listrik, parkir, biaya lain-lain) ──
    if (Array.isArray(body.lines)) {
      const parsed: { label: string; amount: number }[] = [];
      for (const raw of body.lines) {
        const line = raw as { label?: unknown; amount?: unknown };
        const label = typeof line.label === "string" ? line.label.trim() : "";
        const amount = Number(line.amount);
        if (!label || label.length > 80) {
          return NextResponse.json(
            { error: "Nama biaya wajib diisi (maks. 80 karakter)." },
            { status: 400 },
          );
        }
        if (!Number.isFinite(amount) || amount < 0) {
          return NextResponse.json({ error: `Nominal "${label}" tidak valid.` }, { status: 400 });
        }
        parsed.push({ label, amount: Math.round(amount) });
      }
      if (!parsed.some((l) => l.label === "Sewa Kamar")) {
        return NextResponse.json(
          { error: "Rincian wajib memuat baris \"Sewa Kamar\"." },
          { status: 400 },
        );
      }
      const total = parsed.reduce((a, l) => a + l.amount, 0);
      await db.invoiceLine.deleteMany({ where: { invoiceId: before.id } });
      const invoice = await db.invoice.update({
        where: { id: before.id },
        data: { lines: { create: parsed }, total },
        include: INVOICE_INCLUDE,
      });
      return NextResponse.json({ invoice: toClientInvoice(invoice) });
    }

    // ── Mode B: ubah status (lunas / verifikasi) ────────────────────────────
    const data: Prisma.InvoiceUpdateInput = {};
    if (body.status === "lunas") {
      data.status = "lunas";
      data.paidAt = new Date();
      data.dayOffset = null;
    } else if (body.status === "verifikasi") {
      data.status = "verifikasi";
      data.dayOffset = null;
    } else if (typeof body.status === "string" && body.status) {
      data.status = body.status;
    } else {
      return NextResponse.json({ error: "Status tagihan tidak valid." }, { status: 400 });
    }

    const invoice = await db.invoice.update({
      where: { id: before.id },
      data,
      include: INVOICE_INCLUDE,
    });

    // Kamar ikut disetel lunas agar pill denah konsisten (belumBayar → jatuhTempo)
    const roomStatus = body.status === "lunas" ? "lunas" : invoice.status === "belumBayar" ? "jatuhTempo" : invoice.status;
    const room = await db.room.update({
      where: { id: invoice.roomId },
      data: { status: roomStatus },
      include: { tenant: true, invoices: { orderBy: { periodKey: "desc" }, take: 1 } },
    });

    // Catat pemasukan otomatis ke Buku Kas — sekali saja (idempoten; invoice
    // hasil auto-create juga langsung tercatat meski lahir sudah lunas)
    const wasUnpaid = before.status !== "lunas";
    let cashEntryJson: ReturnType<typeof toClientCashEntry> | null = null;
    if (body.status === "lunas" && (wasUnpaid || autoCreated)) {
      const dateLabel = dateToLabel(new Date());
      const entry = await db.cashEntry.create({
        data: {
          id: await nextCashId(),
          type: "masuk",
          category: "Sewa Kamar",
          description: `Kamar ${invoice.roomId} · ${invoice.tenantName ?? "Penyewa"} — Sewa ${periodShortLabel(invoice.periodKey)}`,
          amount: invoice.total,
          entryDate: new Date(),
          dateLabel,
          dateSort: dateSortFromLabel(dateLabel),
          // Isolasi multi-cabang — pemasukan tercatat di properti tagihan
          propertyId: before.propertyId,
        },
      });
      cashEntryJson = toClientCashEntry(entry);
    }

    return NextResponse.json({
      invoice: toClientInvoice(invoice),
      room: toClientRoom(room),
      ...(cashEntryJson ? { cashEntry: cashEntryJson } : {}),
      ...(autoCreated ? { created: true } : {}),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Tagihan tidak ditemukan." }, { status: 404 });
    }
    console.error("Detail error API invoices/rooms:", err);
    return NextResponse.json({ success: true, data: [] });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Parameter ?id= tagihan wajib diisi." }, { status: 400 });
    }
    // Isolasi: tagihan milik owner lain → 404 (filter kolom langsung)
    const owned = await db.invoice.findFirst({
      where: { id, propertyId: { in: await getOwnedPropertyIds(user) } },
      select: { id: true },
    });
    if (!owned) return notOwned("Tagihan tidak ditemukan.");
    await db.invoice.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Detail error API invoices/rooms:", err);
    return NextResponse.json({ success: true, data: [] });
  }
}
