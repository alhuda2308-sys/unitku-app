"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Wizard onboarding properti pertama (dipakai /onboarding)
//
// Dua langkah ringkas agar akun baru langsung punya dashboard siap pakai:
//   Langkah 1 — Tipe properti (Kost / Kontrakan / Rusun), nama & alamat.
//   Langkah 2 — Setup cepat:
//     (A) "Buat Otomatis X Kamar" — kamar bernomor urut (01, 02, …) langsung
//         dibuat di database, lengkap harga sewa per kamar (opsional).
//     (B) "Isi Nanti / Manual" — properti dibuat tanpa kamar; tambahkan
//         kamar kapan saja dari dashboard (tanpa error apa pun).
//
// Akses dijaga di sisi klien via getAuthInfo(): belum masuk → /login,
// sesi demo → /. Validasi server ada di POST /api/onboarding.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  Sparkles,
  Wallet,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthInfo } from "@/lib/auth/client";
import { toast } from "@/lib/toast";
import {
  PROPERTY_TYPE_META,
  PROPERTY_TYPES,
  type PropertyType,
} from "@/lib/app-settings";
import { LicenseGate } from "@/components/billing/license-gate";

type SetupMode = "auto" | "later";

const ROOM_PRESETS = [5, 10, 15] as const;

export function OnboardingForm() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [gate, setGate] = useState<{ email: string; checkoutUrl: string } | null>(null);

  // Langkah 1 — identitas properti
  const [step, setStep] = useState<1 | 2>(1);
  const [tipe, setTipe] = useState<PropertyType>("kost");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  // Langkah 2 — setup cepat
  const [setupMode, setSetupMode] = useState<SetupMode>("auto");
  const [roomCount, setRoomCount] = useState("5");
  const [price, setPrice] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard sesi + gerbang lisensi — sekali saat mount
  useEffect(() => {
    let alive = true;
    getAuthInfo().then(async (info) => {
      if (!alive) return;
      if (!info.user) {
        router.replace("/login");
        return;
      }
      if (info.demo) {
        router.replace("/dashboard");
        return;
      }
      // Gerbang lisensi: akun belum lunas → layar gembok, bukan form onboarding
      try {
        const res = await fetch("/api/billing/license", { cache: "no-store" });
        const lic = (await res.json().catch(() => null)) as {
          licensed?: boolean;
          checkoutUrl?: string;
        } | null;
        if (!alive) return;
        if (lic && lic.licensed === false) {
          setGate({
            email: info.user.email ?? "",
            checkoutUrl:
              typeof lic.checkoutUrl === "string" ? lic.checkoutUrl : "",
          });
          return;
        }
        // API gagal (offline) → fail-open, lanjut onboarding
      } catch {
        /* offline — lanjut */
      }
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [router]);

  /** Validasi langkah 1 → lanjut ke langkah 2 */
  const goStep2 = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setError("Nama properti wajib diisi (2–80 karakter).");
      return;
    }
    if (address.trim().length > 160) {
      setError("Alamat singkat maksimal 160 karakter.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    // Validasi langkah 2 (setup cepat)
    let rooms = 0;
    if (setupMode === "auto") {
      rooms = Number(roomCount);
      if (!Number.isFinite(rooms) || !Number.isInteger(rooms) || rooms < 1 || rooms > 50) {
        setError("Jumlah kamar harus angka 1–50.");
        return;
      }
    }
    const priceValue = price.trim() === "" ? 0 : Number(price.replace(/[^\d]/g, ""));
    if (!Number.isFinite(priceValue) || priceValue < 0 || priceValue > 100_000_000) {
      setError("Harga sewa per kamar tidak valid (maks. Rp 100.000.000).");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || undefined,
          tipe,
          roomCount: rooms,
          price: priceValue,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        roomsCreated?: number;
        error?: string;
      };

      if (res.status === 201) {
        const created = data.roomsCreated ?? 0;
        toast.success("Properti Anda siap!", {
          description:
            created > 0
              ? `${created} kamar berhasil dibuat — denah sudah bisa langsung dikelola.`
              : "Properti tersimpan — tambahkan kamar kapan saja dari dashboard.",
        });
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      setError(
        typeof data.error === "string" && data.error
          ? data.error
          : "Gagal membuat properti — coba lagi sebentar.",
      );
    } catch {
      setError("Tidak dapat terhubung ke server — periksa koneksi internet.");
    } finally {
      setBusy(false);
    }
  };

  // Layar gembok lisensi (akun belum lunas)
  if (gate) {
    return <LicenseGate email={gate.email} checkoutUrl={gate.checkoutUrl} />;
  }

  // Spinner pusat sebelum guard selesai
  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f8fafc] px-4 py-8">
        <Loader2 className="size-6 animate-spin text-zinc-400" strokeWidth={1.75} aria-label="Memuat" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f8fafc] px-4 py-8">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="mb-5 flex items-center justify-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-lg font-bold text-white select-none">
            U
          </span>
          <div className="min-w-0">
            <p className="text-[17px] font-bold leading-tight text-zinc-900">UnitKu</p>
            <p className="text-[12.5px] leading-tight text-zinc-500">
              Kelola Kost, Kontrakan &amp; Unit Sewa
            </p>
          </div>
        </div>

        <div className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {/* Indikator langkah */}
          <div className="mb-3 flex items-center gap-2" aria-hidden="true">
            <span
              className={`flex size-6 items-center justify-center rounded-full text-[11px] font-bold ${
                step === 1 ? "bg-zinc-900 text-white" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {step === 1 ? "1" : "✓"}
            </span>
            <span className="h-0.5 w-6 rounded bg-zinc-200" />
            <span
              className={`flex size-6 items-center justify-center rounded-full text-[11px] font-bold ${
                step === 2 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400"
              }`}
            >
              2
            </span>
            <span className="ml-1 text-[11.5px] font-medium text-zinc-500">
              Langkah {step} dari 2
            </span>
          </div>

          {step === 1 ? (
            <>
              <h1 className="text-lg font-bold text-zinc-900">Selamat datang di UnitKu</h1>
              <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">
                Perkenalkan properti Anda dulu — setup kamar menyusul di langkah berikutnya.
              </p>

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription className="text-[12.5px]">{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={goStep2} className="mt-4 space-y-4" noValidate>
                {/* Tipe properti */}
                <div>
                  <Label className="mb-1.5 text-[12.5px] font-medium text-zinc-700">
                    Tipe Properti
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {PROPERTY_TYPES.map((t) => {
                      const meta = PROPERTY_TYPE_META[t];
                      const active = tipe === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTipe(t)}
                          aria-pressed={active}
                          className={`rounded-lg border px-2 py-2.5 text-center transition-colors ${
                            active
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                          }`}
                        >
                          <span className="block text-[12.5px] font-semibold leading-tight">
                            {meta.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-snug text-zinc-500">
                    {PROPERTY_TYPE_META[tipe].hint}
                  </p>
                </div>

                <div>
                  <Label htmlFor="onb-name" className="mb-1.5 text-[12.5px] font-medium text-zinc-700">
                    Nama {PROPERTY_TYPE_META[tipe].label}
                  </Label>
                  <Input
                    id="onb-name"
                    placeholder={tipe === "kontrakan" ? "Kontrakan Bahagia" : "Kost Bahagia"}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    className="h-10 text-[13px]"
                  />
                </div>

                <div>
                  <Label
                    htmlFor="onb-address"
                    className="mb-1.5 text-[12.5px] font-medium text-zinc-700"
                  >
                    Alamat <span className="font-normal text-zinc-400">(opsional)</span>
                  </Label>
                  <Input
                    id="onb-address"
                    placeholder="Jl. Melati No. 12, Makassar"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    maxLength={160}
                    className="h-10 text-[13px]"
                  />
                </div>

                <Button
                  type="submit"
                  className="h-10 w-full gap-1.5 text-[13px] font-semibold"
                >
                  Lanjut ke Setup Kamar
                  <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold text-zinc-900">Setup Cepat Kamar</h1>
              <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">
                <span className="font-semibold text-zinc-700">{name.trim()}</span> · pilih
                cara menambah kamar — semuanya bisa diubah nanti.
              </p>

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription className="text-[12.5px]">{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={onSubmit} className="mt-4 space-y-3" noValidate>
                {/* Opsi A — buat otomatis */}
                <button
                  type="button"
                  onClick={() => setSetupMode("auto")}
                  aria-pressed={setupMode === "auto"}
                  className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                    setupMode === "auto"
                      ? "border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles
                      className={`size-4 shrink-0 ${setupMode === "auto" ? "text-emerald-600" : "text-zinc-400"}`}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="text-[13px] font-bold text-zinc-900">
                      Buat Otomatis X Kamar
                    </span>
                    <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">
                      Rekomendasi
                    </span>
                  </span>
                  <span className="mt-1 block text-[12px] leading-snug text-zinc-600">
                    Kamar 01, 02, 03, … langsung dibuat otomatis — denah siap pakai
                    tanpa input satu per satu.
                  </span>
                </button>

                {setupMode === "auto" && (
                  <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5">
                    <div>
                      <Label
                        htmlFor="onb-rooms"
                        className="mb-1.5 text-[12.5px] font-medium text-zinc-700"
                      >
                        Jumlah Kamar
                      </Label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {ROOM_PRESETS.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setRoomCount(String(n))}
                            className={`h-8 rounded-lg border px-3 text-[12.5px] font-bold transition-colors ${
                              roomCount === String(n)
                                ? "border-zinc-900 bg-zinc-900 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                            }`}
                          >
                            {n} kamar
                          </button>
                        ))}
                        <Input
                          id="onb-rooms"
                          type="number"
                          min={1}
                          max={50}
                          step={1}
                          inputMode="numeric"
                          placeholder="atau ketik angka…"
                          value={roomCount}
                          onChange={(e) => setRoomCount(e.target.value)}
                          disabled={busy}
                          className="h-8 w-32 text-[12.5px] tabular-nums"
                        />
                      </div>
                    </div>
                    <div>
                      <Label
                        htmlFor="onb-price"
                        className="mb-1.5 text-[12.5px] font-medium text-zinc-700"
                      >
                        Harga sewa per kamar{" "}
                        <span className="font-normal text-zinc-400">(opsional)</span>
                      </Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12.5px] text-zinc-400">
                          Rp
                        </span>
                        <Input
                          id="onb-price"
                          inputMode="numeric"
                          placeholder="cth. 1.500.000 — bisa diatur nanti"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          disabled={busy}
                          className="h-10 pl-9 text-[13px] tabular-nums"
                        />
                      </div>
                      <p className="mt-1 text-[11.5px] leading-snug text-zinc-500">
                        Harga sama untuk semua kamar awal — bisa dibedakan per kamar
                        lewat menu Kelola Kamar.
                      </p>
                    </div>
                  </div>
                )}

                {/* Opsi B — isi nanti */}
                <button
                  type="button"
                  onClick={() => setSetupMode("later")}
                  aria-pressed={setupMode === "later"}
                  className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                    setupMode === "later"
                      ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Building2
                      className={`size-4 shrink-0 ${setupMode === "later" ? "text-zinc-900" : "text-zinc-400"}`}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="text-[13px] font-bold text-zinc-900">
                      Isi Nanti / Manual
                    </span>
                  </span>
                  <span className="mt-1 block text-[12px] leading-snug text-zinc-600">
                    Properti dibuat tanpa kamar — tambahkan satu per satu lewat tombol
                    &ldquo;Tambah Kamar Baru&rdquo; di dashboard.
                  </span>
                </button>

                <div className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2.5 text-[11.5px] leading-snug text-sky-900">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  Setelah &ldquo;Selesai&rdquo;, properti & kamar langsung tersimpan dan
                  dashboard denah langsung siap pakai — tanpa error.
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setStep(1);
                      setError(null);
                    }}
                    disabled={busy}
                    className="h-10 gap-1.5 text-[13px]"
                  >
                    <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    Kembali
                  </Button>
                  <Button
                    type="submit"
                    disabled={busy}
                    className="h-10 flex-1 gap-1.5 text-[13px] font-semibold"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="animate-spin" strokeWidth={1.75} aria-hidden="true" />
                        Menyimpan…
                      </>
                    ) : setupMode === "auto" ? (
                      <>
                        <Wallet className="size-4" strokeWidth={1.75} aria-hidden="true" />
                        Selesai — Buat Kamar
                      </>
                    ) : (
                      "Selesai"
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[11.5px] leading-snug text-zinc-400">
          Data Anda tersimpan aman di cloud dan hanya bisa diakses akun Anda.
        </p>
      </div>
    </div>
  );
}
