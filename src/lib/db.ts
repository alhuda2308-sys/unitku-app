// Alias kompatibilitas — singleton kanonik sekarang di src/lib/prisma.ts
// (Task: integrasi Prisma Route Handlers + Supabase).
import { prisma as prismaClient } from "./prisma";

export const db = prismaClient;
