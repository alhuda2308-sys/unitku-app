// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — /affiliate/join : Halaman publik pendaftaran mitra afiliasi baru
//
// Publik tanpa sesi (PUBLIC_PAGE_PREFIXES: /affiliate/join). Halaman ini HANYA
// memuat header promosi + form (client component join-form.tsx); seluruh
// logika validasi, pembuatan akun, magic-link dashboard, dan notifikasi
// Telegram admin ada di POST /api/affiliate/join.
//
// Desain: mobile-first, tema emerald/zinc senada portal affiliator — header
// komisi flat Rp150.000, tiga poin keunggulan, form minimalis (5 field,
// rekening opsional), footer kontak WA admin (sticky ke dasar layar).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { BadgeCheck, HandCoins, ShieldCheck, Sparkles } from "lucide-react";

import { AffiliateJoinForm } from "@/components/affiliate/join-form";
import { SUPPORT_WA_DISPLAY, SUPPORT_WA_LINK } from "@/lib/landing-config";

export const metadata: Metadata = {
  title: "Program Kemitraan Afiliasi UnitKu — Komisi Rp150.000 per Penjualan",
  description:
    "Gabung gratis sebagai mitra afiliasi UnitKu. Dapatkan komisi flat Rp150.000 setiap kali ada yang membeli lisensi UnitKu lewat link rekomendasi Anda. Pencairan transparan, pendaftaran 2 menit.",
};

/** Satu poin keunggulan — ikon + judul + keterangan singkat */
function BenefitItem({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-white/80 p-3 backdrop-blur-sm">
      <span
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-bold leading-tight text-zinc-900">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-zinc-600">{detail}</p>
      </div>
    </div>
  );
}

export default function AffiliateJoinPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-emerald-50 via-white to-white">
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-8 sm:pt-12">
        {/* ── Header program ──────────────────────────────────────────────── */}
        <header className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
            <Sparkles className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            Pendaftaran Gratis
          </span>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-zinc-900 sm:text-3xl">
            Program Kemitraan Afiliasi UnitKu
          </h1>
          <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-zinc-600 sm:text-[15px]">
            Dapatkan komisi flat{" "}
            <span className="font-bold text-emerald-700">Rp150.000</span> setiap
            kali ada yang membeli lisensi UnitKu melalui link rekomendasi Anda.
          </p>
        </header>

        {/* ── Poin keunggulan ─────────────────────────────────────────────── */}
        <section
          aria-label="Keunggulan program kemitraan"
          className="mt-5 grid gap-2.5 sm:grid-cols-3"
        >
          <BenefitItem
            icon={<BadgeCheck className="size-4" strokeWidth={2.25} />}
            title="Pendaftaran Gratis"
            detail="Tanpa biaya & tanpa syarat ribet — akun aktif seketika."
          />
          <BenefitItem
            icon={<ShieldCheck className="size-4" strokeWidth={2.25} />}
            title="Pencairan Transparan"
            detail="Komisi tercatat otomatis & bisa dipantau di dashboard pribadi."
          />
          <BenefitItem
            icon={<HandCoins className="size-4" strokeWidth={2.25} />}
            title="Komisi Flat Rp150.000"
            detail="Per penjualan lisensi — tanpa batas jumlah closing."
          />
        </section>

        {/* ── Form pendaftaran / kartu selamat ────────────────────────────── */}
        <section aria-label="Form pendaftaran mitra" className="mt-6">
          <AffiliateJoinForm />
        </section>
      </main>

      {/* Footer sticky — nempel di dasar saat konten pendek, terdorong alami
          saat konten panjang (root min-h-screen flex flex-col + mt-auto) */}
      <footer className="mt-auto border-t border-zinc-200 bg-white/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-1 px-4 py-4 text-center">
          <p className="text-xs text-zinc-500">
            Butuh bantuan pendaftaran? Chat Admin UnitKu (WA {SUPPORT_WA_DISPLAY})
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
