// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cash/sync — Self-heal MANUAL Buku Kas (tombol "Sinkronkan Data
// Sewa" di header Buku Kas)
//
// Menjalankan sinkronisasi pemasukan sewa yang belum tercatat untuk seluruh
// properti owner (atau cabang aktif via ?propertyId=):
//   PASS 1 — setiap invoice lunas wajib punya entri pemasukannya;
//   PASS 2 — kamar terisi TANPA invoice lunas (data lama pra-fitur pencatatan
//            otomatis) di-backfill SATU entri pemasukan.
// IDEMPOTEN — id deterministik (KM-AUTO-… / KM-ROOMSYNC-…) + P2002 → tombol
// ini bisa ditekan berapa kali pun tanpa pernah mendobelkan buku kas.
//
// Respons: { created, scanned, entries } — created = jumlah entri BARU yang
// lahir dari eksekusi ini; entries = isi Buku Kas terbaru sehingga klien bisa
// mengganti state tanpa fetch kedua.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { ensureSeedForUser } from "@/lib/server/seed";
import { toClientCashEntry } from "@/lib/server/mappers";
import { getAuthUser } from "@/lib/auth/server";
import { resolveOwnedPropertyScopeLenient, unauthorized } from "@/lib/auth/ownership";
import { syncMissingRentalIncome } from "@/lib/server/cash-sync";

export const dynamic = "force-dynamic";

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
    const result = await syncMissingRentalIncome(scope);
    // Kembalikan isi Buku Kas terbaru — klien mengganti state dalam SATU
    // round trip (tanpa fetch kedua), konsisten dengan hasil sync.
    const entries = await db.cashEntry.findMany({
      where: { propertyId: { in: scope } },
      orderBy: [{ dateSort: "desc" }, { id: "asc" }],
    });
    return NextResponse.json({
      success: true,
      created: result.created,
      scanned: result.scanned,
      entries: entries.map(toClientCashEntry),
    });
  } catch (err) {
    console.error("[api/cash/sync POST]", err);
    return NextResponse.json(
      { error: "Gagal menyinkronkan data sewa ke Buku Kas." },
      { status: 500 },
    );
  }
}
