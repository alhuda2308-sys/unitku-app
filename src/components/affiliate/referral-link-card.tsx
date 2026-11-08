"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Kartu Link Referral affiliator (Tahap 4)
//
// Link pribadi https://unitku.my.id/?ref=<kode> (middleware menyimpan cookie
// 30 hari) + link direct checkout /checkout?ref=<kode> utk promosi langsung
// ke pembayaran. Tombol "Salin Link" dengan feedback visual "Tersalin!".
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Salin teks ke clipboard — dengan fallback utk browser/http non-secure lama */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // lanjut ke fallback
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** Tombol salin dgn feedback "Tersalin!" 2 detik */
function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(value);
    if (!ok) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <Button
      type="button"
      size="sm"
      onClick={handleCopy}
      className={cn(
        "h-9 shrink-0 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700",
        copied && "bg-emerald-700",
        className,
      )}
      aria-label={`${label} — salin ke clipboard`}
    >
      {copied ? (
        <>
          <Check className="size-4" strokeWidth={2.25} aria-hidden="true" />
          <span>Tersalin!</span>
        </>
      ) : (
        <>
          <Copy className="size-4" strokeWidth={2} aria-hidden="true" />
          <span>{label}</span>
        </>
      )}
    </Button>
  );
}

/** Baris link: teks ter-select-able + tombol salin */
function LinkRow({
  url,
  copyLabel,
  readOnlyLabel,
}: {
  url: string;
  copyLabel: string;
  readOnlyLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="text"
        readOnly
        value={url}
        aria-label={readOnlyLabel}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] font-medium text-zinc-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
      />
      <CopyButton value={url} label={copyLabel} />
    </div>
  );
}

export function ReferralLinkCard({ refCode }: { refCode: string }) {
  const referralUrl = `https://unitku.my.id/?ref=${refCode}`;
  const checkoutUrl = `https://unitku.my.id/checkout?ref=${refCode}`;

  return (
    <section className="rounded-lg border border-border bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-zinc-900 sm:text-base">
            Link Referral Pribadi Anda
          </h2>
          <p className="mt-0.5 text-xs leading-snug text-zinc-700">
            Bagikan link ini — setiap pengunjung yang checkout dalam 30 hari
            (atribusi last-click) menghasilkan komisi untuk Anda.
          </p>
        </div>
        <span className="hidden shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 sm:inline-block">
          Ref {refCode}
        </span>
      </div>

      <div className="mt-3">
        <LinkRow
          url={referralUrl}
          copyLabel="Salin Link"
          readOnlyLabel="Link referral pribadi"
        />
      </div>

      <div className="mt-4 rounded-md border border-emerald-100 bg-emerald-50/60 p-3">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-800">
          <ShoppingBag className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          Promosi Langsung ke Pembayaran
        </div>
        <p className="mt-0.5 text-xs leading-snug text-emerald-800/80">
          Pengunjung langsung diarahkan ke halaman checkout — cocok untuk bio
          WhatsApp, status, atau iklan.
        </p>
        <div className="mt-2">
          <LinkRow
            url={checkoutUrl}
            copyLabel="Salin Link Checkout"
            readOnlyLabel="Link checkout referral"
          />
        </div>
      </div>
    </section>
  );
}
