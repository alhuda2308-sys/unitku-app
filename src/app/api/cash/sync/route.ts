// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cash/sync — Self-heal MANUAL Buku Kas (tombol "Sinkronkan Data
// Sewa" di header Buku Kas)
//
// Menjalankan sinkronisasi pemasukan sewa yang belum tercatat untuk seluruh
// properti owner (atau cabang aktif via ?propertyId=):
//   PASS 1 — setiap invoice lunas wajib punya entri pemasukannya;
//   PASS 2 — per kamar per BULAN: setiap bulan siklus terbayar kamar terisi
//            wajib punya bukti pemasukan; bulan yang kosong di-backfill dgn
//            tanggal jatuh tempo siklusnya (idempoten per kamar+tanggal).
//
// PERIODE-AWARE: kirim ?from=yyyy-mm-dd&to=yyyy-mm-dd (rentang periode aktif
// di tampilan Buku Kas) agar sinkron menyembuhkan bulan-bulan DALAM TAMPILAN
// — tekan tombol di tampilan Nov 2026 → seluruh kamar aktif yang siklusnya
// terbayar langsung dibuatkan pemasukan Nov 2026. Tanpa parameter = jendela
// default 3 bulan terakhir (perilaku auto-heal).
//
// IDEMPOTEN — id deterministik (KM-AUTO-… / KM-ROOMSYNC2-…-<yyyyMMdd>) +
// P2002 → tombol ini bisa ditekan berapa kali pun tanpa pernah mendobelkan
// buku kas.
//
// Respons: { created, scanned, entries } — created = jumlah entri BARU yang
// lahir dari eksekusi ini; entries = isi Buku Kas terbaru sehingga klien bisa
// mengganti state tanpa fetch kedua.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { ensureSeedForUser } from "@/lib/server/seed";
import { toClientCashEntry } from "@/lib/server/mappers";
import { applyRentalIncomeDedup } from "@/lib/cash-dedup";
import { getAuthUser } from "@/lib/auth/server";
import { resolveOwnedPropertyScopeLenient, unauthorized } from "@/lib/auth/ownership";
import { syncMissingRentalIncome } from "@/lib/server/cash-sync";

export const dynamic = "force-dynamic";

/** ISO "yyyy-mm-dd" → nilai valid, atau null (tanpa batas sisi tsb) */
function isoParam(raw: string | null): string | null {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? raw.trim() : null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    // Scope opsional ?propertyId= — sinkron SESUAI cabang aktif di switcher;
    // tanpa param = seluruh properti owner (perilaku lama). LENIENT: id basi
    // → fallback seluruh properti owner, bukan 404.
    const scope = await resolveOwnedPropertyScopeLenient(
      user,
      request.nextUrl.searchParams.get("propertyId")?.trim() || null,
    );
    // Rentang periode aktif tampilan Buku Kas — ?from=&to= (boleh kosong =
    // tanpa batas sisi tsb, mis. "Semua Waktu"). Kehadiran SALAH SATU parameter
    // menandakan mode eksplisit; tanpa keduanya = jendela default 3 bulan.
    const fromRaw = request.nextUrl.searchParams.get("from");
    const toRaw = request.nextUrl.searchParams.get("to");
    const explicit = fromRaw !== null || toRaw !== null;
    const result = await syncMissingRentalIncome(
      scope,
      explicit ? { fromISO: isoParam(fromRaw), toISO: isoParam(toRaw) } : undefined,
    );
    // Kembalikan isi Buku Kas terbaru — klien mengganti state dalam SATU
    // round trip (tanpa fetch kedua), konsisten dengan hasil sync. Dedup
    // non-destruktif utk entri otomatis berdeskripsi+nominal identik.
    const entries = await db.cashEntry.findMany({
      where: { propertyId: { in: scope } },
      orderBy: [{ dateSort: "desc" }, { id: "asc" }],
    });
    return NextResponse.json({
      success: true,
      created: result.created,
      scanned: result.scanned,
      entries: applyRentalIncomeDedup(entries.map(toClientCashEntry)),
    });
  } catch (err) {
    console.error("[api/cash/sync POST]", err);
    return NextResponse.json(
      { error: "Gagal menyinkronkan data sewa ke Buku Kas." },
      { status: 500 },
    );
  }
}
