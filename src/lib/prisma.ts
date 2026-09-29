// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Prisma Client singleton (Supabase PostgreSQL via pgbouncer pooler)
//
// Instance disimpan di globalThis agar hot-reloading Next.js (dev) tidak
// membuat koneksi pool baru setiap kali modul dievaluasi — mencegah memory
// leak & kehabisan koneksi Supabase. Di production (NODE_ENV=production)
// modul hanya dievaluasi sekali sehingga instance langsung dipakai.
//
// Pemakaian:
//   import { prisma } from "@/lib/prisma";        // kanonik
//   import { db } from "@/lib/db";                // alias kompatibilitas
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Pastikan URL database Postgres dari file .env yang dipakai.
 *
 * Lingkungan sandbox mengekspor `DATABASE_URL=file:…` (SQLite bawaan) sebagai
 * environment variable proses — nilai env proses SELALU menimpa isi .env baik
 * oleh Bun maupun Next.js, sehingga Prisma gagal validasi protocol
 * `postgresql://`. Fungsi ini menimpa kembali (hanya bila nilai aktif bukan
 * URL postgres) dengan nilai dari .env.local / .env di root project.
 *
 * Di production (Vercel dsb.) `DATABASE_URL` sudah postgres → tidak ada
 * penimpaan, dan jika file .env tak ada pembacaan diabaikan dengan aman.
 */
function ensureDatabaseEnv(): void {
  if (
    process.env.DATABASE_URL?.startsWith("postgres") &&
    process.env.DIRECT_URL?.startsWith("postgres")
  ) {
    return;
  }

  let raw = "";
  for (const file of [".env.local", ".env"]) {
    try {
      raw += readFileSync(join(process.cwd(), file), "utf8") + "\n";
    } catch {
      // file tidak ada — abaikan
    }
  }

  const read = (key: string): string | undefined =>
    raw.match(new RegExp(`^\\s*${key}\\s*=\\s*"?([^"\\n]*)"?(?:\\s|$)`, "m"))?.[1];

  if (!process.env.DATABASE_URL?.startsWith("postgres")) {
    const value = read("DATABASE_URL");
    if (value) process.env.DATABASE_URL = value;
  }
  if (!process.env.DIRECT_URL?.startsWith("postgres")) {
    const value = read("DIRECT_URL");
    if (value) process.env.DIRECT_URL = value;
  }

  // Diagnostik deployment (khususnya Vercel serverless): bila URL tetap bukan
  // postgres, Prisma pasti gagal validasi protokol — log pesan yang jelas &
  // actionable agar penyebabnya langsung terbaca di Runtime Logs.
  if (!process.env.DATABASE_URL?.startsWith("postgres")) {
    const masked =
      process.env.DATABASE_URL?.slice(0, 20).replace(/:\/\/.*/, "://***") ??
      "(tidak terisi)";
    console.error(
      "[UnitKu DB] DATABASE_URL tidak valid untuk PostgreSQL — dapat:",
      masked,
      "\n  → Prisma provider = postgresql; Vercel serverless TIDAK mendukung SQLite file.",
      "\n  → Perbaikan: isi Environment Variables di Vercel (Project → Settings →",
      "    Environment Variables): DATABASE_URL = postgresql://…pooler.supabase.com:6543/postgres?pgbouncer=true",
      "    dan DIRECT_URL = postgresql://…pooler.supabase.com:5432/postgres, lalu Redeploy.",
    );
  }
}

ensureDatabaseEnv();

/** Log sekali per proses — memperjelas koneksi mana yang dipakai runtime */
function logDatasourceOnce(): void {
  const target = process.env.DATABASE_URL ?? "";
  const host = target.match(/@([^:/?]+)/)?.[1] ?? "unknown";
  const kind = target.startsWith("postgres")
    ? target.includes(":6543")
      ? "supabase-pooler(:6543)"
      : "postgresql"
    : target.startsWith("file:")
      ? "sqlite"
      : "TIDAK VALID";
  console.log(`[UnitKu DB] Prisma init — provider=postgresql, target=${kind}, host=${host}`);
}
logDatasourceOnce();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query logging dimatikan (bising saat streaming dashboard); error & warning
    // tetap terlihat di log server.
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Alias kompatibilitas — `import { db } from "@/lib/prisma"` juga valid */
export const db = prisma;
