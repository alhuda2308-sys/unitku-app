"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Card "🎁 Buat Akses Trial 3 Hari untuk Owner" (portal mitra)
//
// Fitur Generator Link Trial di /affiliate/dashboard:
//   1. Form singkat: Nama Pemilik, No. WhatsApp Pemilik, Nama Properti
//      (opsional) → POST /api/affiliate/trial (auth: magic-link token ATAU
//      sesi login — ditentukan props.accessToken, pola PayoutSettingsForm).
//   2. Hasil: link trial unik (/trial?token=<trial_id>) + tombol
//      "Salin Pesan WA" berisi draf persuasi siap kirim ke owner.
//   3. Riwayat trial mitra — tabel status (Pending / Aktif / Terkunci /
//      Expired) via TrialHistoryTable; baris LOCKED dilengkapi tombol
//      "Follow-up WA" (wa.me + draf persuasi lisensi). Refresh otomatis
//      setelah pembuatan; lazy-lock ditampilkan sesuai status efektif.
// Komisi Rp150.000 aman: paywall portal trial selalu mengarah ke checkout
// dengan refCode mitra pembuat (server-side, lihat src/lib/owner-trial.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Gift,
  Link2,
  Loader2,
  MessageCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CopyButton,
  TrialHistoryTable,
  type TrialRow,
} from "@/components/affiliate/trial-history-table";
import {
  buildTrialWaMessage,
  normalizeTrialStatus,
} from "@/lib/trial-shared";

/** Hasil POST — baris trial + draf pesan WA undangan siap salin */
interface CreatedTrial extends TrialRow {
  waMessage: string;
}

export function TrialGeneratorCard({ accessToken }: { accessToken?: string }) {
  // ── State form & hasil ────────────────────────────────────────────────────
  const [ownerName, setOwnerName] = useState("");
  const [ownerWhatsapp, setOwnerWhatsapp] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedTrial | null>(null);

  // ── Riwayat trial ─────────────────────────────────────────────────────────
  const [trials, setTrials] = useState<TrialRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);

  const loadTrials = useCallback(async () => {
    try {
      const query = accessToken ? `?token=${encodeURIComponent(accessToken)}` : "";
      const res = await fetch(`/api/affiliate/trial${query}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        success: boolean;
        trials?: TrialRow[];
      };
      if (res.ok && json.success && Array.isArray(json.trials)) {
        setTrials(json.trials.map((t) => ({ ...t, status: normalizeTrialStatus(t.status) })));
        setListError(false);
      } else {
        setListError(true);
      }
    } catch {
      setListError(true);
    } finally {
      setListLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadTrials();
  }, [loadTrials]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitting) return;
      setError(null);
      setSubmitting(true);
      try {
        const res = await fetch("/api/affiliate/trial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerName,
            ownerWhatsapp,
            propertyName,
            ...(accessToken ? { token: accessToken } : {}),
          }),
        });
        const json = (await res.json()) as {
          success: boolean;
          error?: string;
          trial?: CreatedTrial;
        };
        if (res.ok && json.success && json.trial) {
          setCreated({ ...json.trial, status: normalizeTrialStatus(json.trial.status) });
          setOwnerName("");
          setOwnerWhatsapp("");
          setPropertyName("");
          void loadTrials(); // refresh riwayat
        } else {
          setError(
            json.error ?? "Gagal membuat link trial — coba lagi beberapa saat.",
          );
        }
      } catch {
        setError(
          "Koneksi bermasalah — periksa internet Anda lalu coba lagi.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [accessToken, loadTrials, ownerName, ownerWhatsapp, propertyName, submitting],
  );

  return (
    <section
      aria-labelledby="trial-gen-heading"
      className="rounded-lg border border-border bg-white"
    >
      {/* Header card */}
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm"
            aria-hidden="true"
          >
            <Gift className="size-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2
              id="trial-gen-heading"
              className="text-sm font-bold leading-snug tracking-tight text-zinc-900 sm:text-base"
            >
              🎁 Buat Akses Trial 3 Hari untuk Owner
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 sm:text-[13px]">
              Beri calon customer kesempatan coba gratis 3 hari. Setelah 3 hari
              sistem terkunci otomatis dan mengarahkan mereka untuk beli
              lisensi melalui link referral Anda.
            </p>
          </div>
        </div>
        <Badge className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700">
          Gratis untuk Mitra
        </Badge>
      </div>

      {/* Form + hasil */}
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <form onSubmit={handleSubmit} className="grid gap-3.5" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="trial-owner-name" className="text-[13px] font-bold text-zinc-800">
              Nama Pemilik Kost / Kontrakan{" "}
              <span className="font-medium text-zinc-500">(wajib)</span>
            </Label>
            <Input
              id="trial-owner-name"
              name="ownerName"
              type="text"
              inputMode="text"
              autoComplete="off"
              required
              maxLength={80}
              placeholder="cth. Pak Budi Santoso"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="h-11 bg-white"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="trial-owner-wa" className="text-[13px] font-bold text-zinc-800">
              Nomor WhatsApp Pemilik{" "}
              <span className="font-medium text-zinc-500">(wajib)</span>
            </Label>
            <Input
              id="trial-owner-wa"
              name="ownerWhatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              required
              maxLength={20}
              placeholder="cth. 0812 3456 7890"
              value={ownerWhatsapp}
              onChange={(e) => setOwnerWhatsapp(e.target.value)}
              className="h-11 bg-white"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="trial-property" className="text-[13px] font-bold text-zinc-800">
              Nama Properti / Kost{" "}
              <span className="font-medium text-zinc-500">(opsional)</span>
            </Label>
            <Input
              id="trial-property"
              name="propertyName"
              type="text"
              inputMode="text"
              autoComplete="off"
              maxLength={120}
              placeholder="cth. Kost Griya Asri"
              value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)}
              className="h-11 bg-white"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] font-medium leading-snug text-amber-800"
            >
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={submitting}
            className="h-12 w-full gap-2 bg-emerald-600 text-[15px] font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {submitting ? (
              <Loader2 className="size-4.5 animate-spin" aria-hidden="true" />
            ) : (
              <Link2 className="size-4.5" strokeWidth={2} aria-hidden="true" />
            )}
            {submitting ? "Membuat link…" : "Buat Link Trial Eksklusif"}
          </Button>
        </form>

        {/* Hasil berhasil — link + pesan WA siap kirim */}
        {created ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4"
          >
            <p className="flex items-center gap-1.5 text-[13px] font-black text-emerald-800">
              <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
              Link trial untuk {created.ownerName} berhasil dibuat!
            </p>

            {/* Kotak link trial */}
            <div className="mt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Link Trial Eksklusif
              </p>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  readOnly
                  value={created.trialUrl}
                  aria-label="Link trial eksklusif (salin dengan tombol di samping)"
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-9 min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-3 text-[12.5px] font-medium text-zinc-800"
                />
                <CopyButton
                  value={created.trialUrl}
                  label="Salin Link"
                  className="sm:w-32"
                />
              </div>
            </div>

            {/* Kotak pesan WA */}
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Pesan WhatsApp Siap Kirim
              </p>
              <p className="mt-1.5 whitespace-pre-wrap break-words rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-[12.5px] leading-relaxed text-zinc-700">
                {created.waMessage}
              </p>
              <div className="mt-2">
                <CopyButton
                  value={created.waMessage}
                  label="Salin Pesan WA"
                  className="w-full sm:w-40"
                />
              </div>
              <p className="mt-2 text-xs leading-snug text-zinc-500">
                Tempel pesan ini ke chat WhatsApp{" "}
                {created.ownerName} — begitu dia membuka link, trial 3 hari
                mulai berjalan otomatis.
              </p>
            </div>
          </div>
        ) : null}

        {/* Riwayat trial mitra — tabel status + tombol Follow-up WA (LOCKED) */}
        <div className="mt-6">
          <TrialHistoryTable
            loading={listLoading}
            error={listError}
            trials={trials}
          />
        </div>

        <p className="mt-4 flex items-start gap-1.5 text-xs leading-snug text-zinc-500">
          <MessageCircle
            className="mt-0.5 size-3.5 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
          <span>
            Saat masa trial habis, portal owner otomatis terkunci dan tombol
            &ldquo;Aktifkan Lisensi&rdquo; di sana langsung mengarah ke
            checkout dengan link referral Anda — komisi tetap milik Anda.
            Gunakan tombol{" "}
            <span className="font-semibold text-emerald-700">
              Follow-up WA
            </span>{" "}
            pada klien berstatus Terkunci / Expired untuk langsung mengirim
            draf penawaran lisensi lewat chat WhatsApp.
          </span>
        </p>
      </div>
    </section>
  );
}
