// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Card "Asisten Materi Promosi (Telegram Bot)" untuk portal mitra
//
// Section menonjol di /affiliate/dashboard yang mengarahkan mitra ke bot
// Telegram resmi @unitku_partner_bot (webhook /api/telegram/mitra-promo-bot):
//   1. CTA eksternal ke https://t.me/unitku_partner_bot (tab baru, noopener).
//   2. Tutorial 3 langkah: Start bot → pilih menu → tap salin + ganti
//      placeholder [MASUKKAN_LINK_REFERRAL_ANDA] dengan link referral mitra.
//
// Gaya: modern clean Swiss-grid — border solid, tanpa gradient, konsisten
// dengan tema emerald/zinc dashboard. Server component (tanpa state).
// ─────────────────────────────────────────────────────────────────────────────

import { Bot, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TELEGRAM_PROMO_BOT_URL = "https://t.me/unitku_partner_bot";

/** Tutorial pemakaian bot — urutan wajib terjaga (nomor dirender otomatis). */
const STEPS: ReadonlyArray<{ title: string; desc: string }> = [
  {
    title: "Buka bot, tekan Start",
    desc: "Klik tombol di atas untuk membuka bot @unitku_partner_bot di aplikasi Telegram Anda, lalu tekan tombol Start.",
  },
  {
    title: "Pilih jenis materi",
    desc: "Pilih menu 🏠 Iklan Produk (ke Pemilik Kost), 🤝 Ajak Mitra (Peluang Komisi 150rb), atau 💬 Template Chat WA sesuai kebutuhan Anda.",
  },
  {
    title: "Tap salin, ganti link",
    desc: "Tap sekali pada kotak teks yang muncul untuk menyalin otomatis, lalu ganti [MASUKKAN_LINK_REFERRAL_ANDA] dengan link referral yang tertera di dashboard ini sebelum diposting.",
  },
];

export function PromoBotCard() {
  return (
    <section
      aria-labelledby="promo-bot-heading"
      className="rounded-lg border border-border bg-white"
    >
      {/* Header card */}
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm"
            aria-hidden="true"
          >
            <Bot className="size-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2
              id="promo-bot-heading"
              className="text-sm font-bold leading-snug tracking-tight text-zinc-900 sm:text-base"
            >
              🤖 Asisten Materi Promosi (Telegram Bot)
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 sm:text-[13px]">
              Bingung mau posting apa hari ini? Gunakan bot resmi mitra kami
              untuk membuat teks iklan produk, ajakan rekrutmen mitra, dan
              chat WhatsApp siap pakai secara otomatis.
            </p>
          </div>
        </div>
        <Badge className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700">
          Gratis untuk Mitra
        </Badge>
      </div>

      {/* CTA utama + tutorial */}
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <Button
          asChild
          size="lg"
          className="h-12 w-full gap-2 bg-emerald-600 text-[15px] font-bold text-white shadow-sm hover:bg-emerald-700 sm:w-auto sm:px-8"
        >
          <a
            href={TELEGRAM_PROMO_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Buka Bot Materi Promo di Telegram (membuka tab baru)"
          >
            <Send className="size-4.5" strokeWidth={2} aria-hidden="true" />
            Buka Bot Materi Promo di Telegram
          </a>
        </Button>

        <h3 className="mt-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
          3 Langkah Mudah
        </h3>
        <ol className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
            >
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-md border border-emerald-200 bg-white text-sm font-black text-emerald-700"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-snug text-zinc-900">
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">
                  {step.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
