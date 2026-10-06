"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Form autentikasi terpusat (dipakai /login dan /register)
//
// Satu kartu dengan tab Masuk / Daftar Akun Baru — TANPA EMAIL (zero friction,
// selaras form checkout):
//   • Daftar  : Nama Lengkap + Nomor WhatsApp + Kata Sandi. Email autentikasi
//               dibuat otomatis server dari nomor WA (62…@user.unitku.my.id —
//               lihat src/lib/auth/phone-email.ts); pengguna tidak pernah
//               menyentuh input email.
//   • Masuk   : satu kolom "Nomor WhatsApp" + kata sandi. UI 100% berbasis
//               WhatsApp; email asli akun lama TETAP diterima diam-diam oleh
//               resolver server (kompatibilitas tanpa membingungkan UI).
// Nomor WA & Nama tersimpan di metadata Supabase (raw_user_meta_data) & lead
// Admin. Validasi klien: nama ≥2, format WA 62…, password ≥6. Semua logika
// sesi diambil dari kontrak src/lib/auth/client — komponen ini hanya UI +
// validasi klien.
// CATATAN: memakai useSearchParams → halaman pemakai wajib membungkus dengan
// <Suspense>.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MailCheck, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  afterAuthRedirect,
  signIn,
  signUp,
} from "@/lib/auth/client";
import { normalizeWaPhone } from "@/lib/checkout-validation";
import { SUPPORT_WA_LINK } from "@/lib/landing-config";
import { toast } from "@/lib/toast";

type Mode = "login" | "register";
type Pending = null | "form";

const COPY: Record<Mode, { title: string; subtitle: string }> = {
  login: {
    title: "Masuk ke UnitKu",
    subtitle: "Kelola kost, kontrakan & unit sewa Anda dalam satu dashboard.",
  },
  register: {
    title: "Buat Akun Owner",
    subtitle: "Gratis untuk memulai — atur properti pertama Anda dalam 1 menit.",
  },
};

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const WA_RE = /^62[0-9]{8,13}$/;

export function AuthForm({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [identity, setIdentity] = useState(""); // nomor WhatsApp (atau email akun lama — diterima diam-diam)
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [awaitConfirm, setAwaitConfirm] = useState(false);

  const nextParam = searchParams.get("next");
  const busy = pending !== null;

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setAwaitConfirm(false);
  };

  const redirectAfterAuth = async () => {
    const target = await afterAuthRedirect(nextParam);
    router.replace(target);
    router.refresh();
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    setAwaitConfirm(false);
    if (mode === "register") {
      if (fullName.trim().length < 2) {
        setError("Nama lengkap wajib diisi (minimal 2 karakter).");
        return;
      }
      if (!WA_RE.test(normalizeWaPhone(phone))) {
        setError(
          "Nomor WhatsApp tidak valid — gunakan format 08… atau 62… (9–15 digit).",
        );
        return;
      }
    } else {
      // Mode Masuk: UI murni Nomor WhatsApp, namun email akun lama TETAP
      // diterima diam-diam — server resolver yang mengenali keduanya.
      const value = identity.trim();
      const isPhone = WA_RE.test(normalizeWaPhone(value));
      const looksEmail = EMAIL_RE.test(value); // akun lama — tanpa perlu disebut di UI
      if (!isPhone && !looksEmail) {
        setError("Masukkan nomor WhatsApp yang terdaftar (contoh: 0812xxxxxxx).");
        return;
      }
    }
    if (password.length < 6) {
      setError(
        mode === "register"
          ? "Kata sandi minimal 6 karakter."
          : "Kata sandi wajib diisi.",
      );
      return;
    }

    setError(null);
    setPending("form");
    try {
      if (mode === "login") {
        const res = await signIn(identity.trim(), password);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        await redirectAfterAuth();
      } else {
        const res = await signUp(
          { name: fullName.trim(), phone: normalizeWaPhone(phone) },
          password,
        );
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (res.needsEmailConfirmation) {
          // Edge case (verifikasi email aktif di dashboard Supabase): akun
          // dibuat tanpa sesi — email konfirmasi terkirim ke alamat otomatis
          // nomor WA yang tidak punya inbox, jadi arahkan lewat Admin.
          setAwaitConfirm(true);
          return;
        }
        toast.success("Pendaftaran berhasil — selamat datang di UnitKu! 🎉");
        await redirectAfterAuth();
      }
    } catch {
      setError("Terjadi kesalahan tak terduga — coba lagi.");
    } finally {
      setPending(null);
    }
  };

  return (
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

      <div className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h1 className="text-lg font-bold text-zinc-900">{COPY[mode].title}</h1>
        <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">{COPY[mode].subtitle}</p>

        <Tabs value={mode} onValueChange={(v) => switchMode(v as Mode)} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="login" disabled={busy}>
              Masuk
            </TabsTrigger>
            <TabsTrigger value="register" disabled={busy}>
              Daftar Akun Baru
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Error validasi klien / server */}
        {error && (
          <Alert variant="destructive" className="mt-4">
            <TriangleAlert strokeWidth={1.75} />
            <AlertDescription className="text-[12.5px]">{error}</AlertDescription>
          </Alert>
        )}

        {/* Info tunggu aktivasi akun (register, Supabase dgn verifikasi aktif) */}
        {awaitConfirm && (
          <Alert className="mt-4 border-amber-200 bg-amber-50 [&>svg]:text-amber-600">
            <MailCheck strokeWidth={1.75} />
            <AlertDescription className="text-[12.5px] text-amber-800">
              Akun berhasil dibuat — aktivasi diperlukan sebelum masuk. Hubungi
              Admin via{" "}
              <a
                href={SUPPORT_WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-2"
              >
                WhatsApp
              </a>{" "}
              untuk aktivasi cepat, lalu masuk dengan Nomor WhatsApp &amp; kata
              sandi Anda.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
          {mode === "register" ? (
            <>
              <div>
                <Label htmlFor="auth-name" className="mb-1.5 text-[12.5px] font-medium text-zinc-700">
                  Nama Lengkap <span aria-hidden="true" className="text-red-600">*</span>
                  <span className="sr-only">(wajib)</span>
                </Label>
                <Input
                  id="auth-name"
                  autoComplete="name"
                  placeholder="cth. Budi Santoso"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={busy}
                  className="h-10 text-[13px]"
                />
              </div>

              <div>
                <Label htmlFor="auth-phone" className="mb-1.5 text-[12.5px] font-medium text-zinc-700">
                  Nomor WhatsApp <span aria-hidden="true" className="text-red-600">*</span>
                  <span className="sr-only">(wajib)</span>
                </Label>
                <Input
                  id="auth-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="08xxxxxxxxxx / 62xxxxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={busy}
                  className="h-10 text-[13px]"
                />
                <p className="mt-1 text-[12.5px] text-zinc-500">
                  Dipakai untuk masuk ke akun &amp; notifikasi tagihan.
                </p>
              </div>
            </>
          ) : (
            <div>
              <Label htmlFor="auth-identity" className="mb-1.5 text-[12.5px] font-medium text-zinc-700">
                Nomor WhatsApp
              </Label>
              <Input
                id="auth-identity"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                placeholder="08xxxxxxxxxx / 62xxxxxxxxxx"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                disabled={busy}
                className="h-10 text-[13px]"
              />
              <p className="mt-1 text-[12.5px] text-zinc-500">
                Gunakan nomor WhatsApp yang Anda daftarkan di UnitKu.
              </p>
            </div>
          )}

          <div>
            <Label
              htmlFor="auth-password"
              className="mb-1.5 text-[12.5px] font-medium text-zinc-700"
            >
              Kata Sandi{" "}
              {mode === "register" && (
                <>
                  <span aria-hidden="true" className="text-red-600">*</span>
                  <span className="sr-only">(wajib)</span>
                </>
              )}
            </Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="h-10 text-[13px]"
            />
            {mode === "register" && (
              <p className="mt-1 text-[12.5px] text-zinc-500">Minimal 6 karakter.</p>
            )}
          </div>

          <Button type="submit" disabled={busy} className="h-10 w-full text-[13px] font-semibold">
            {pending === "form" ? (
              <>
                <Loader2 className="animate-spin" strokeWidth={1.75} aria-hidden="true" />
                Memproses…
              </>
            ) : mode === "login" ? (
              "Masuk"
            ) : (
              "Daftar"
            )}
          </Button>
        </form>

        {/* Pindah mode */}
        <p className="mt-4 text-center text-[12.5px] text-zinc-600">
          {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "register" : "login")}
            disabled={busy}
            className="font-semibold text-zinc-900 underline underline-offset-2 hover:text-zinc-600 disabled:opacity-50"
          >
            {mode === "login" ? "Daftar Akun Baru" : "Masuk di sini"}
          </button>
        </p>
      </div>
    </div>
  );
}
