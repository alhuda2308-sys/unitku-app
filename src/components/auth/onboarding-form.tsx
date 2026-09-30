"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Onboarding properti pertama (dipakai /onboarding)
//
// Owner baru yang belum punya properti melengkapi nama + jumlah kamar awal.
// Akses dijaga di sisi klien via getAuthInfo(): belum masuk → /login,
// sesi demo → /. Validasi server ada di POST /api/onboarding.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthInfo } from "@/lib/auth/client";
import { toast } from "@/lib/toast";

export function OnboardingForm() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [roomCount, setRoomCount] = useState("5");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard sesi — sekali saat mount
  useEffect(() => {
    let alive = true;
    getAuthInfo().then((info) => {
      if (!alive) return;
      if (!info.user) {
        router.replace("/login");
        return;
      }
      if (info.demo) {
        router.replace("/");
        return;
      }
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [router]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const trimmedName = name.trim();
    const rooms = Number(roomCount);

    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setError("Nama properti wajib diisi (2–80 karakter).");
      return;
    }
    if (!Number.isFinite(rooms) || !Number.isInteger(rooms) || rooms < 1 || rooms > 50) {
      setError("Jumlah kamar awal harus angka 1–50.");
      return;
    }
    if (address.trim().length > 160) {
      setError("Alamat singkat maksimal 160 karakter.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          roomCount: rooms,
          address: address.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        roomsCreated?: number;
        error?: string;
      };

      if (res.status === 201) {
        toast.success("Properti berhasil dibuat", {
          description: `${data.roomsCreated ?? rooms} kamar siap dikelola.`,
        });
        router.replace("/");
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
          <h1 className="text-lg font-bold text-zinc-900">Selamat datang di UnitKu</h1>
          <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">
            Lengkapi profil properti pertama Anda untuk mulai mengelola kamar.
          </p>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription className="text-[12.5px]">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
            <div>
              <Label
                htmlFor="onb-name"
                className="mb-1.5 text-[12.5px] font-medium text-zinc-700"
              >
                Nama Kost / Properti Anda
              </Label>
              <Input
                id="onb-name"
                placeholder="Kost Bahagia"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                maxLength={80}
                className="h-10 text-[13px]"
              />
            </div>

            <div>
              <Label
                htmlFor="onb-rooms"
                className="mb-1.5 text-[12.5px] font-medium text-zinc-700"
              >
                Jumlah Kamar Awal
              </Label>
              <Input
                id="onb-rooms"
                type="number"
                min={1}
                max={50}
                step={1}
                inputMode="numeric"
                value={roomCount}
                onChange={(e) => setRoomCount(e.target.value)}
                disabled={busy}
                className="h-10 text-[13px] tabular-nums"
              />
              <p className="mt-1 text-[12.5px] text-zinc-500">
                Kamar bernomor urut dibuat otomatis (01, 02, …) — bisa diubah nanti.
              </p>
            </div>

            <div>
              <Label
                htmlFor="onb-address"
                className="mb-1.5 text-[12.5px] font-medium text-zinc-700"
              >
                Alamat Singkat <span className="font-normal text-zinc-400">(opsional)</span>
              </Label>
              <Input
                id="onb-address"
                placeholder="Jl. Melati No. 12, Makassar"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={busy}
                maxLength={160}
                className="h-10 text-[13px]"
              />
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="h-10 w-full text-[13px] font-semibold"
            >
              {busy ? (
                <>
                  <Loader2 className="animate-spin" strokeWidth={1.75} aria-hidden="true" />
                  Membuat properti…
                </>
              ) : (
                "Buat Properti & Mulai"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
