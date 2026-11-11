// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — /affiliate/login : Login khusus mitra affiliator (PUBLIK)
//
// Mitra didaftarkan Super Admin ATAU daftar mandiri TANPA akun owner —
// identitas = No. WhatsApp terdaftar (tanpa kode manual). Halaman ini GERBANG
// khusus mitra:
//   • Belum login  → form No. WA → POST /api/affiliate/login → cookie sesi
//     mitra ("unitku_partner") → lanjut ?next= / dashboard mitra.
//   • Sudah punya sesi mitra sah → langsung dilempar ke dashboard (tanpa
//     mengetik ulang).
// Senada /affiliate/join: tema emerald/zinc, mobile-first, footer sticky.
//
// `?next=` disanitasi ketat — HANYA path dalam area /affiliate/ (anti
// open-redirect). Halaman owner biasa tetap lewat /login (link di footer).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessageCircle, UserRound } from "lucide-react";

import { PartnerLoginForm } from "@/components/affiliate/partner-login-form";
import { getAffiliateFromSession } from "@/lib/affiliate-auth";
import { SUPPORT_WA_DISPLAY, SUPPORT_WA_LINK } from "@/lib/landing-config";

export const metadata: Metadata = {
  title: "Masuk Portal Mitra — UnitKu",
  description:
    "Login khusus mitra afiliasi UnitKu. Masukkan nomor WhatsApp terdaftar untuk masuk otomatis ke portal: kelola link referral, komisi, dan rekening pencairan Anda.",
};

export const dynamic = "force-dynamic";

/** Sanitasi tujuan kembali — HANYA path dalam area /affiliate/ (bukan "//…") */
function sanitizeNextPath(raw: string | string[] | undefined): string | null {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (!value.startsWith("/affiliate/")) return null;
  return value;
}

export default async function AffiliateLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);

  // Sudah punya sesi mitra sah → langsung ke dashboard (tanpa login ulang)
  const session = await getAffiliateFromSession();
  if (session) redirect(nextPath ?? "/affiliate/dashboard");

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-emerald-50 via-white to-white">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:py-12">
        <PartnerLoginForm nextPath={nextPath} />

        {/* Pembeda jelas dari login pemilik properti — anti tercampur guard */}
        <p className="mt-4 text-center text-xs leading-snug text-zinc-500">
          Ini portal <span className="font-bold text-emerald-700">mitra
          afiliasi</span>. Pemilik kost/kontrakan dengan lisensi UnitKu masuk
          lewat halaman{" "}
          <a
            href="/login"
            className="inline-flex items-center gap-1 font-semibold text-zinc-700 underline-offset-2 hover:underline"
          >
            <UserRound className="size-3.5" aria-hidden="true" />
            login pemilik
          </a>
          .
        </p>
      </main>

      {/* Footer sticky — nempel di dasar saat konten pendek, terdorong alami
          saat konten panjang (root min-h-dvh flex flex-col) */}
      <footer className="mt-auto border-t border-zinc-200 bg-white/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-1 px-4 py-4 text-center">
          <p className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
            <MessageCircle className="size-3.5 shrink-0" aria-hidden="true" />
            Nomor tidak dikenali? Chat Admin UnitKu (WA {SUPPORT_WA_DISPLAY})
          </p>
          <a
            href={SUPPORT_WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-emerald-700 underline-offset-2 hover:underline"
          >
            Hubungi Admin via WhatsApp
          </a>
        </div>
      </footer>
    </div>
  );
}
