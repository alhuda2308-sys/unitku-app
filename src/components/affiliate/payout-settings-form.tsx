"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Form Pengaturan Rekening Pencairan komisi affiliator (Tahap 4)
//
// POST /api/affiliate/payout (sesi wajib; ownership by userId sesi).
// Sukses → toast + router.refresh() agar data server terbaru tampil.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";

interface PayoutSettingsFormProps {
  initial: {
    bankName: string | null;
    bankAccountNo: string | null;
    bankAccountName: string | null;
  };
}

const FIELD =
  "h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

export function PayoutSettingsForm({ initial }: PayoutSettingsFormProps) {
  const router = useRouter();
  const [bankName, setBankName] = useState(initial.bankName ?? "");
  const [bankAccountNo, setBankAccountNo] = useState(initial.bankAccountNo ?? "");
  const [bankAccountName, setBankAccountName] = useState(initial.bankAccountName ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    if (!bankName.trim() || !bankAccountNo.trim() || !bankAccountName.trim()) {
      toast.error("Lengkapi semua kolom rekening pencairan.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/affiliate/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName: bankName.trim(),
          bankAccountNo: bankAccountNo.trim(),
          bankAccountName: bankAccountName.trim(),
        }),
      });
      const payload: { success?: boolean; error?: string } = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !payload.success) {
        toast.error(payload.error ?? "Gagal menyimpan rekening — coba lagi.");
        return;
      }
      toast.success("Rekening pencairan tersimpan.", {
        description: "Komisi akan dicairkan ke rekening ini oleh tim Admin.",
      });
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server — periksa koneksi lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-white p-4 sm:p-5">
      <div className="flex items-start gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
          <Landmark className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-zinc-900 sm:text-base">
            Rekening Pencairan Komisi
          </h2>
          <p className="mt-0.5 text-xs leading-snug text-zinc-700">
            Rekening tujuan pencairan komisi Anda. Pastikan atas nama sesuai
            identitas agar proses transfer lancar.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="payout-bank" className="text-xs font-semibold text-zinc-800">
            Nama Bank
          </Label>
          <Input
            id="payout-bank"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="BCA / Mandiri / BRI"
            maxLength={64}
            className={FIELD}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payout-account" className="text-xs font-semibold text-zinc-800">
            Nomor Rekening
          </Label>
          <Input
            id="payout-account"
            value={bankAccountNo}
            onChange={(e) => setBankAccountNo(e.target.value)}
            placeholder="0970545093"
            inputMode="numeric"
            maxLength={32}
            className={FIELD}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payout-holder" className="text-xs font-semibold text-zinc-800">
            Atas Nama Rekening
          </Label>
          <Input
            id="payout-holder"
            value={bankAccountName}
            onChange={(e) => setBankAccountName(e.target.value)}
            placeholder="Nama sesuai buku tabungan"
            maxLength={128}
            className={FIELD}
            autoComplete="off"
          />
        </div>
        <div className="sm:col-span-3">
          <Button
            type="submit"
            disabled={saving}
            className="h-10 w-full gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto sm:px-6"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span>Menyimpan…</span>
              </>
            ) : (
              <span>Simpan Perubahan</span>
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}
