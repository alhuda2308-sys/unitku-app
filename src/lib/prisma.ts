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

import { PrismaClient } from "@prisma/client";

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
