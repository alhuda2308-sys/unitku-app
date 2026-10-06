"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Kartu "Ganti Password" (Dashboard → Pengaturan → Profil Saya)
//
// - Password Baru + Konfirmasi, masing-masing dengan toggle intip (mata)
// - Validasi live: minimal 6 karakter & konfirmasi harus cocok
// - Submit → POST /api/auth/update-password (Supabase Auth updateUser) via
//   helper updatePassword() di src/lib/auth/client.ts
// - Feedback toast: sukses "Password berhasil diperbarui!" / error spesifik
// - Mode demo & mode lokal (tanpa Supabase Auth) tetap tampil dgn catatan —
//   submit akan ditolak server dengan pesan yang jelas
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthInfo, updatePassword, type AuthInfo } from "@/lib/auth/client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const MIN_PASSWORD = 6;

const inputCls =
  "h-9 border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-600 focus-visible:ring-zinc-900/5";

/** Tombol mata kecil di dalam kolom password (toggle intip) */
function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
      aria-pressed={show}
      className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
    >
      {show ? (
        <EyeOff className="size-4" strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Eye className="size-4" strokeWidth={1.75} aria-hidden="true" />
      )}
    </button>
  );
}

export function ChangePasswordCard() {
  const [info, setInfo] = useState<AuthInfo | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getAuthInfo().then((data) => {
      if (alive) setInfo(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = password.length >= MIN_PASSWORD && password === confirm;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !valid) return;

    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);

    if (result.ok) {
      toast.success("Password berhasil diperbarui!", {
        description: "Gunakan password baru saat login berikutnya — sesi saat ini tetap aktif.",
      });
      setPassword("");
      setConfirm("");
      setShowPassword(false);
      setShowConfirm(false);
      return;
    }
    toast.error(result.error);
  };

  return (
    <section className="rounded-lg border border-border bg-white" aria-label="Ganti password">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">Ganti Password</h3>
        <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-zinc-500">
          <KeyRound className="size-3" strokeWidth={1.75} aria-hidden="true" />
          Akun {info?.demo ? "demo" : info?.user?.email ?? "pengelola"}
        </span>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-3.5 p-4">
        {/* Catatan kontekstual per mode sesi */}
        {info?.demo && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-[12.5px] font-medium text-amber-800">
            Mode demo tidak memiliki password — masuk dengan akun owner asli untuk mengganti password.
          </p>
        )}
        {info && !info.demo && info.mode !== "supabase" && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-[12.5px] font-medium text-amber-800">
            Ganti password hanya tersedia saat login via Supabase Auth.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Password Baru */}
          <div className="space-y-1.5">
            <Label htmlFor="st-pw-baru" className="text-[12.5px] text-zinc-600">
              Password Baru
            </Label>
            <div className="relative">
              <Input
                id="st-pw-baru"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className={cn(inputCls, "pr-10", tooShort && "border-red-300 focus-visible:ring-red-900/10")}
                placeholder="Minimal 6 karakter"
                aria-invalid={tooShort}
                aria-describedby={tooShort ? "st-pw-baru-error" : undefined}
              />
              <EyeToggle show={showPassword} onToggle={() => setShowPassword((v) => !v)} />
            </div>
            {tooShort && (
              <p id="st-pw-baru-error" role="alert" className="text-xs text-red-500">
                Password minimal {MIN_PASSWORD} karakter.
              </p>
            )}
          </div>

          {/* Konfirmasi Password Baru */}
          <div className="space-y-1.5">
            <Label htmlFor="st-pw-konfirmasi" className="text-[12.5px] text-zinc-600">
              Konfirmasi Password Baru
            </Label>
            <div className="relative">
              <Input
                id="st-pw-konfirmasi"
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className={cn(inputCls, "pr-10", mismatch && "border-red-300 focus-visible:ring-red-900/10")}
                placeholder="Ulangi password baru"
                aria-invalid={mismatch}
                aria-describedby={mismatch ? "st-pw-konfirmasi-error" : undefined}
              />
              <EyeToggle show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
            </div>
            {mismatch && (
              <p id="st-pw-konfirmasi-error" role="alert" className="text-xs text-red-500">
                Konfirmasi password tidak cocok.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <p className="text-[11.5px] leading-4 text-zinc-500">
            Minimal {MIN_PASSWORD} karakter. Sesi perangkat lain akan otomatis keluar demi keamanan.
          </p>
          <Button
            type="submit"
            size="sm"
            disabled={busy || !valid}
            className="h-9 gap-1.5 bg-zinc-900 px-4 text-[12.5px] font-semibold text-white shadow-none hover:bg-zinc-800"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <KeyRound className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            )}
            Simpan Password Baru
          </Button>
        </div>
      </form>
    </section>
  );
}
