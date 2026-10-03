// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Halaman sukses setelah pembayaran lisensi di Mayar
//
// Pembeli diarahkan ke sini setelah checkout Mayar selesai (URL redirect
// sukses di product/link Mayar). Halaman PUBLIK — tidak butuh sesi owner.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pembayaran Berhasil — UnitKu",
};

const STEPS = [
  "Lisensi seumur hidup Anda otomatis diaktifkan ke akun email pembeli.",
  "Masuk dengan email tersebut — bila akun baru, kredensial awal dikirim/diserahkan setelah pembayaran.",
  "Lengkapi profil properti pertama, lalu mulai kelola kamar & tagihan.",
];

export default function PaymentSuccessPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#f8fafc] px-4 py-8">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="mb-5 flex items-center justify-center gap-3">
          <Image
            src="/brand/icon.png"
            alt="Logo UnitKu"
            width={40}
            height={40}
            priority
            className="size-10 shrink-0 rounded-xl object-contain ring-1 ring-zinc-200"
          />
          <div className="min-w-0">
            <p className="text-[17px] font-bold leading-tight text-zinc-900">UnitKu</p>
            <p className="text-[12.5px] leading-tight text-zinc-500">
              Kelola Kost, Kontrakan &amp; Unit Sewa
            </p>
          </div>
        </div>

        <div className="w-full rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="size-6 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
          </span>

          <h1 className="mt-4 text-xl font-bold text-zinc-900">
            Pembayaran Berhasil!
          </h1>
          <p className="mt-1 text-[13px] leading-snug text-zinc-600">
            Akun UnitKu Anda telah aktif.
          </p>

          <ol className="mt-4 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-left">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-2 text-[12.5px] leading-snug text-zinc-600">
                <span className="font-semibold text-zinc-800 tabular-nums">
                  {index + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <Button asChild className="mt-5 h-10 w-full text-[13px] font-semibold">
            <Link href="/login">Masuk ke Dashboard UnitKu</Link>
          </Button>

          <p className="mt-3 text-[12.5px] text-zinc-500">
            Lisensi seumur hidup — sekali bayar, aktif selamanya.
          </p>
        </div>

        <p className="mt-6 text-center text-[12.5px] text-zinc-400">
          UnitKu — SaaS Manajemen Properti Sewa
        </p>
      </div>
    </main>
  );
}
