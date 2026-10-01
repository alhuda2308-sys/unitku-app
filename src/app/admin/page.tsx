// ─────────────────────────────────────────────────────────────────────────────
// /admin — Panel Super Admin (proteksi server component)
//
//  • Belum masuk            → redirect /login?next=/admin (middleware juga)
//  • Masuk, bukan super admin → halaman 403 Forbidden (email TIDAK diumumkan
//    sebagai alasan penolakan ke publik — hanya pemilik sesi yang melihat)
//  • Super admin            → AdminPanel (client)
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthUser } from "@/lib/auth/server";
import { isSuperAdminEmail } from "@/lib/auth/super-admin";
import { AdminPanel } from "@/components/admin/admin-panel";

export const metadata: Metadata = {
  title: "Panel Super Admin · UnitKu",
  description: "Provisioning pengguna manual & kelola lisensi seumur hidup UnitKu.",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login?next=%2Fadmin");

  if (!isSuperAdminEmail(user.email)) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f8fafc] px-4 py-10">
        <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 text-center shadow-sm">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-red-50">
            <ShieldOff className="size-5 text-red-600" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-[17px] font-semibold tracking-tight text-zinc-900">
            403 — Akses Ditolak
          </h1>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">
            Panel ini khusus Super Admin. Akun yang sedang masuk tidak terdaftar
            pada daftar <span className="font-medium text-zinc-700">SUPER_ADMIN_EMAILS</span>.
          </p>
          <Button asChild className="mt-5 h-9 gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800">
            <Link href="/dashboard">
              <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              Kembali ke Dashboard
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  return <AdminPanel adminEmail={user.email} />;
}
