// ─────────────────────────────────────────────────────────────────────────────
// Nomor kamar — sanitasi & normalisasi data (Task 135)
//
// Aturan baru: nomor kamar MURNI tanpa suffix angka dalam kurung. "Kamar A-1"
// tampil sebagai "A-1" — TIDAK pernah "A-1 (2)"/"A-1 (3)". Unik cukup PER
// PROPERTI (data antar cabang terisolasi oleh property_id), jadi nomor milik
// properti lain TIDAK pernah memicu penamaan otomatis.
//
// Dua lapis penerapan:
//   1) sanitizeRoomNomor() — dipanggil di SEMUA jalur tulis (POST/PATCH kamar,
//      onboarding) agar suffix "(n)" tidak pernah masuk lagi ke database.
//   2) ensureRoomsNormalized() — sekali per proses (dipanggil ensureSchema):
//      backfill kolom nomor dari id (data lama) lalu membuka suffix " (n)"
//      yang terlanjur tersimpan ("A-1 (3)" → "A-1") dengan aman tabrakan
//      (bila "A-1" sudah dipakai kamar lain di properti yang sama, baris itu
//      dibiarkan — pemilik data bisa merapikan manual).
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/prisma";

/** Suffix penamaan otomatis lama — " (2)", " (3)", " (99)" di akhir nomor. */
const ROOM_NOMOR_SUFFIX_RE = /\s*\(\d+\)\s*$/;

/** Batas panjang nomor kamar (selaras placeholder UI & ukuran label kartu). */
const NOMOR_MAX_LENGTH = 60;

/**
 * Bersihkan input nomor kamar: buang suffix "(n)" di akhir + rapikan spasi.
 * "A-1 (3)" → "A-1"; "  101  " → "101"; "Paviliun Barat (2)" → "Paviliun Barat".
 * Tidak pernah mengembalikan string kosong bila input hanya berisi suffix —
 * pemanggil wajib memeriksa hasil kosong sebagai input tidak valid.
 */
export function sanitizeRoomNomor(raw: string): string {
  return raw.replace(ROOM_NOMOR_SUFFIX_RE, "").trim().slice(0, NOMOR_MAX_LENGTH);
}

let normalizedPromise: Promise<void> | null = null;

/**
 * Normalisasi data kamar lama — idempoten, sekali per proses server.
 * Gagal (DB tidak terjangkau dsb.) TIDAK pernah melempar: ini higienitas
 * data, bukan prasyarat query — dicatat ke log dan dicoba lagi di cold start
 * berikutnya.
 */
export function ensureRoomsNormalized(): Promise<void> {
  normalizedPromise ??= runRoomNomorNormalization().catch((err) => {
    console.warn(
      "[UnitKu DB] Normalisasi nomor kamar dilewati kali ini — dicoba ulang pada cold start berikutnya:",
      err instanceof Error ? err.message : err,
    );
  });
  return normalizedPromise;
}

async function runRoomNomorNormalization(): Promise<void> {
  // 1) Backfill kolom nomor utk baris lama (kolom baru, default '') —
  //    nomor lama tersimpan di id (PK global). SQL mentah karena Prisma
  //    updateMany tidak bisa menyalin nilai antar kolom.
  //    Kompatibel Postgres (produksi) & SQLite (sandbox).
  try {
    await db.$executeRawUnsafe(`UPDATE "rooms" SET "nomor" = "id" WHERE "nomor" = ''`);
  } catch (err) {
    // Tabel/kolom belum ada (DB belum ter-heal) — biarkan lapis berikutnya yang
    // memutuskan; jangan tumpahkan error ke pemanggil.
    console.warn(
      "[UnitKu DB] Backfill nomor kamar dilewati:",
      err instanceof Error ? err.message : err,
    );
    return;
  }

  // 2) Buka suffix "(n)" yang tersimpan — collision-safe PER PROPERTI.
  const suffixed = await db.room.findMany({
    where: { nomor: { contains: "(" } },
    select: { id: true, propertyId: true, nomor: true },
  });
  if (suffixed.length === 0) return;

  // Kumpulkan seluruh nomor kamar di properti yang bersangkutan utk cek tabrakan
  const propertyIds = [...new Set(suffixed.map((r) => r.propertyId))];
  const siblings = await db.room.findMany({
    where: { propertyId: { in: propertyIds } },
    select: { id: true, propertyId: true, nomor: true },
  });
  const takenByProperty = new Map<string, Set<string>>();
  for (const s of siblings) {
    let set = takenByProperty.get(s.propertyId);
    if (!set) {
      set = new Set<string>();
      takenByProperty.set(s.propertyId, set);
    }
    set.add(s.nomor.trim());
  }

  // Dua kamar ber-suffix bisa saling tabrakan saat keduanya dibersihkan ke
  // nomor dasar yang sama ("A-1 (2)" & "A-1 (3)") — proses berurutan dan
  // perbarui set "taken" agar hanya yang pertama yang menang (urutan stabil
  // berdasarkan id).
  const ordered = suffixed.slice().sort((a, b) => a.id.localeCompare(b.id));
  for (const room of ordered) {
    const clean = sanitizeRoomNomor(room.nomor);
    if (!clean || clean === room.nomor.trim()) continue;
    const taken = takenByProperty.get(room.propertyId);
    if (taken?.has(clean)) continue; // nomor dasar sudah dipakai kamar lain — biarkan
    await db.room.update({ where: { id: room.id }, data: { nomor: clean } });
    taken?.add(clean);
  }
}
