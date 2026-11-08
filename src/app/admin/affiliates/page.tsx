// ─────────────────────────────────────────────────────────────────────────────
// /admin/affiliates — Manajemen Afiliasi Super Admin (proteksi server component)
//
// Pola proteksi identik /admin (src/app/admin/page.tsx):
//   • Belum masuk              → redirect /login?next=/admin/affiliates
//   • Masuk, bukan super admin → halaman 403 Forbidden (email TIDAK diumumkan
//     sebagai alasan penolakan ke publik)
//   • Super admin              → AffiliateAdminPanel (client) dgn data awal
//     dari getAffiliateAdminOverview() (stats + payout queue + daftar mitra)
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, ShieldOff } from "lucide-react";

import { AffiliateAdminPanel } from "@/components/admin/affiliate-admin-panel";
import { getAffiliateAdminOverview } from "@/lib/affiliate-admin";
import { Button } from "@/components/ui/button";
import { getAuthUser } from "@/lib/auth/server";
import { isSuperAdminEmail } from "@/lib/auth/super-admin";

export const metadata: Metadata = {
  title: "Kelola Afiliasi · Panel Super Admin · UnitKu",
  description:
    "Kelola pencairan komisi affiliator & daftar mitra program afiliasi UnitKu.",
};

export const dynamic = "force-dynamic";

export default async function AdminAffiliatesPage() {
  // Gerbang sesi — tamu → /login dengan tujuan kembali (pattern /admin)
  const user = await getAuthUser();
  if (!user) redirect("/login?next=%2Fadmin%2Faffiliates");

  // Gerbang role — hanya email di SUPER_ADMIN_EMAILS
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
            Manajemen afiliasi khusus Super Admin. Akun yang sedang masuk tidak
            terdaftar pada daftar{" "}
            <span className="font-medium text-zinc-700">SUPER_ADMIN_EMAILS</span>.
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

  const data = await getAffiliateAdminOverview();

  // Fail-graceful — DB sedang tidak terjangkau: kartu error rapi, bukan 500
  if (!data) {
    return (
      <main className="min-h-dvh bg-[#f8fafc] px-4 py-10">
        <div className="mx-auto w-full max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <h1 className="text-sm font-bold text-amber-900">
                Gagal memuat data afiliasi
              </h1>
              <p className="mt-1 text-[13px] leading-snug text-amber-800">
                Terjadi kendala menghubungi database. Muat ulang halaman, atau
                coba lagi beberapa saat bila kendala berlanjut.
              </p>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-3 h-8 gap-1.5 border-amber-300 bg-white text-[12.5px] text-amber-900 hover:bg-amber-100"
              >
                <Link href="/admin/affiliates">
                  <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                  Coba Muat Ulang
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return <AffiliateAdminPanel initial={data} />;
}
