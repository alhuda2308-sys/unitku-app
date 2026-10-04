"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AdminPanel — Panel Super Admin UnitKu (client)
//
// • Tabel seluruh pengguna/owner: Nama, Email, Tanggal Daftar, Properti/Kost,
//   Status Lisensi (badge), Sumber Lisensi, Aksi.
// • "+ Tambah Pengguna Manual (Bypass Mayar)" — buat akun + properti + lisensi
//   lifetime, lalu tampilkan kredensial siap-copy utk dikirim via WA/Email.
// • Aksi cepat per baris: saklar lisensi instan, reset password cepat,
//   hapus akun (dengan konfirmasi).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Check,
  Copy,
  Dices,
  KeyRound,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UsersRound,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AdminUserRow {
  id: string | null;
  email: string;
  name: string | null;
  phone: string | null; // No. WhatsApp 62… dari form checkout/register/lead
  registeredAt: string | null;
  properties: string[];
  licensed: boolean;
  licensedAt: string | null;
  source: "mayar" | "manual" | null;
  isSuperAdmin: boolean;
}

interface Credentials {
  email: string;
  password: string;
}

const SOURCE_LABEL: Record<"mayar" | "manual", string> = {
  mayar: "Mayar Webhook",
  manual: "Manual Super Admin",
};

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return dateFmt.format(new Date(ms));
}

/** Tampilan nomor rapi — "6281234567890" → "+62 812-3456-7890" */
function formatWaDisplay(phone: string): string {
  if (phone.startsWith("62")) {
    const local = phone.slice(2);
    const match = local.match(/^(\d{3})(\d{4})(\d+)$/);
    return match ? `+62 ${match[1]}-${match[2]}-${match[3]}` : `+62 ${local}`;
  }
  return `+${phone}`;
}

/** Password acak url-safe 16 char (browser crypto) — setara server */
function randomPassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function credentialsMessage(c: Credentials): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return [
    "Akses Dashboard UnitKu",
    `URL Masuk: ${origin}/login`,
    `Email: ${c.email}`,
    `Password: ${c.password}`,
  ].join("\n");
}

/* ── View kredensial hasil provisioning / reset (di dalam Dialog) ─────────── */

function CredentialsView({ credentials }: { credentials: Credentials }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const ok = await copyText(credentialsMessage(credentials));
    if (ok) {
      setCopied(true);
      toast.success("Kredensial disalin", {
        description: "Tempel & kirimkan ke pengguna via WhatsApp atau Email.",
      });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Gagal menyalin", { description: "Salin manual dari kolom di bawah." });
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <p className="text-[12.5px] font-medium text-emerald-800">
          Akun siap digunakan — salin kredensial berikut dan kirimkan ke pemilik akun.
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-zinc-50 px-3 py-2">
          <span className="text-[12.5px] text-zinc-500">Email</span>
          <span className="truncate font-mono text-[12.5px] font-medium text-zinc-900">{credentials.email}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-zinc-50 px-3 py-2">
          <span className="text-[12.5px] text-zinc-500">Password</span>
          <span className="truncate font-mono text-[12.5px] font-medium text-zinc-900">{credentials.password}</span>
        </div>
      </div>
      <Button type="button" variant="outline" onClick={copy} className="h-9 w-full gap-1.5 text-[12.5px]">
        {copied ? (
          <Check className="size-3.5 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        )}
        Salin Kredensial (WhatsApp/Email)
      </Button>
    </div>
  );
}

/* ── Dialog: + Tambah Pengguna Manual (Bypass Mayar) ──────────────────────── */

function AddUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [lifetime, setLifetime] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setPropertyName("");
    setLifetime(true);
    setError("");
    setCredentials(null);
  };

  const close = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid =
    name.trim().length >= 2 && emailValid && propertyName.trim().length >= 2 && password.length >= 6;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          propertyName: propertyName.trim(),
          lifetime,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        credentials?: Credentials;
        error?: string;
      };
      if (res.status === 201 && data.credentials) {
        setCredentials(data.credentials);
        onCreated();
      } else {
        setError(data.error ?? "Gagal menambahkan pengguna.");
      }
    } catch {
      setError("Tidak dapat terhubung ke server — coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        {credentials ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-[15px]">Pengguna Berhasil Dibuat</DialogTitle>
              <DialogDescription className="text-[12.5px]">
                {lifetime
                  ? "Lisensi seumur hidup aktif & properti awal telah dibuat."
                  : "Akun dibuat tanpa lisensi — status: Terkunci sampai diaktifkan."}
              </DialogDescription>
            </DialogHeader>
            <CredentialsView credentials={credentials} />
            <DialogFooter>
              <Button onClick={() => close(false)} className="h-9 w-full text-[12.5px]">
                Selesai
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-[15px]">+ Tambah Pengguna Manual (Bypass Mayar)</DialogTitle>
              <DialogDescription className="text-[12.5px]">
                Buat akun owner tanpa pembayaran Mayar — akun langsung terverifikasi.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="text-[12.5px]">{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="adm-nama" className="text-[12.5px] text-zinc-600">Nama Lengkap Owner</Label>
                <Input
                  id="adm-nama"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="cth. Budi Santoso"
                  className="h-9 text-[13px]"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adm-email" className="text-[12.5px] text-zinc-600">Alamat Email</Label>
                <Input
                  id="adm-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@email.com"
                  className="h-9 text-[13px]"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adm-pass" className="text-[12.5px] text-zinc-600">Password Awal</Label>
                <div className="flex gap-2">
                  <Input
                    id="adm-pass"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="min. 6 karakter"
                    className="h-9 font-mono text-[13px]"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPassword(randomPassword())}
                    className="h-9 shrink-0 gap-1.5 px-3 text-[12.5px]"
                  >
                    <Dices className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    Generate
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adm-prop" className="text-[12.5px] text-zinc-600">Nama Kost / Properti Awal</Label>
                <Input
                  id="adm-prop"
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
                  placeholder="cth. Kost Melati Indah"
                  className="h-9 text-[13px]"
                />
              </div>
              <label
                htmlFor="adm-life"
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 hover:bg-zinc-50"
              >
                <Checkbox
                  id="adm-life"
                  checked={lifetime}
                  onCheckedChange={(v) => setLifetime(v === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-[12.5px] font-medium text-zinc-900">
                    Beri Akses Seumur Hidup (Lifetime License)
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-zinc-500">
                    Aktifkan lisensi penuh tanpa pembayaran — tercatat sebagai sumber &ldquo;Manual Super Admin&rdquo;.
                  </span>
                </span>
              </label>
            </div>
            <DialogFooter>
              <Button
                onClick={submit}
                disabled={!valid || busy}
                className="h-9 w-full gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800"
              >
                {busy && <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
                Buat Pengguna
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Dialog: Reset Password Cepat ─────────────────────────────────────────── */

function ResetPasswordDialog({
  target,
  onOpenChange,
}: {
  target: AdminUserRow | null;
  onOpenChange: (v: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  useEffect(() => {
    setPassword("");
    setError("");
    setCredentials(null);
  }, [target]);

  const submit = async () => {
    if (!target || busy || password.length < 6) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target.email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        credentials?: Credentials;
        error?: string;
      };
      if (res.ok && data.credentials) {
        setCredentials(data.credentials);
        toast.success("Password diperbarui", {
          description: `Password baru untuk ${target.email} sudah aktif.`,
        });
      } else {
        setError(data.error ?? "Gagal mengganti password.");
      }
    } catch {
      setError("Tidak dapat terhubung ke server — coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {credentials ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-[15px]">Password Berhasil Diganti</DialogTitle>
              <DialogDescription className="text-[12.5px]">
                Password lama tidak berlaku lagi.
              </DialogDescription>
            </DialogHeader>
            <CredentialsView credentials={credentials} />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} className="h-9 w-full text-[12.5px]">
                Selesai
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-[15px]">Reset Password Cepat</DialogTitle>
              <DialogDescription className="text-[12.5px]">
                Set password baru untuk{" "}
                <span className="font-medium text-zinc-700">{target?.email}</span> langsung via Admin API.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="text-[12.5px]">{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="adm-reset-pass" className="text-[12.5px] text-zinc-600">Password Baru</Label>
                <div className="flex gap-2">
                  <Input
                    id="adm-reset-pass"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="min. 6 karakter"
                    className="h-9 font-mono text-[13px]"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPassword(randomPassword())}
                    className="h-9 shrink-0 gap-1.5 px-3 text-[12.5px]"
                  >
                    <Dices className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    Generate
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={submit}
                disabled={password.length < 6 || busy}
                className="h-9 w-full bg-zinc-900 text-white hover:bg-zinc-800"
              >
                {busy && <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
                Simpan Password Baru
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Panel utama ──────────────────────────────────────────────────────────── */

export function AdminPanel({ adminEmail }: { adminEmail: string }) {
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [mode, setMode] = useState<"supabase" | "local">("local");
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [pendingToggle, setPendingToggle] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminUserRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRows(null);
    setLoadError("");
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        users?: AdminUserRow[];
        mode?: "supabase" | "local";
        error?: string;
        detail?: string;
      };
      if (res.ok && Array.isArray(data.users)) {
        setRows(data.users);
        if (data.mode === "supabase" || data.mode === "local") setMode(data.mode);
      } else {
        // detail (bila ada) = pesan error teknis dari server — mempercepat
        // debugging Super Admin tanpa harus membuka log Vercel.
        const base = data.error ?? "Gagal memuat daftar pengguna.";
        setLoadError(data.detail ? `${base} — ${data.detail}` : base);
      }
    } catch {
      setLoadError("Tidak dapat terhubung ke server.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load(true);
    setTimeout(() => setRefreshing(false), 400);
  };

  const toggleLicense = async (row: AdminUserRow, licensed: boolean) => {
    if (pendingToggle) return;
    setPendingToggle(row.email);
    // Optimistic — balikkan bila gagal
    setRows((prev) =>
      prev
        ? prev.map((r) => (r.email === row.email ? { ...r, licensed } : r))
        : prev,
    );
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: row.email, licensed }),
      });
      const data = (await res.json().catch(() => ({}))) as { licensed?: boolean; error?: string };
      if (res.ok && typeof data.licensed === "boolean") {
        setRows((prev) =>
          prev
            ? prev.map((r) =>
                r.email === row.email
                  ? { ...r, licensed: data.licensed === true, licensedAt: licensed ? (r.licensedAt ?? new Date().toISOString()) : r.licensedAt }
                  : r,
              )
            : prev,
        );
        toast.success(
          licensed ? "Lisensi diaktifkan" : "Lisensi dicabut",
          { description: `${row.email} — akses seumur hidup ${licensed ? "aktif" : "dikunci"}.` },
        );
      } else {
        setRows((prev) =>
          prev ? prev.map((r) => (r.email === row.email ? { ...r, licensed: !licensed } : r)) : prev,
        );
        toast.error("Gagal mengubah lisensi", { description: data.error ?? "Coba lagi sebentar." });
      }
    } catch {
      setRows((prev) =>
        prev ? prev.map((r) => (r.email === row.email ? { ...r, licensed: !licensed } : r)) : prev,
      );
      toast.error("Gagal mengubah lisensi", { description: "Tidak dapat terhubung ke server." });
    } finally {
      setPendingToggle(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteBusy) return;
    const target = deleteTarget;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/users?email=${encodeURIComponent(target.email)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        leadDeleted?: boolean;
        authDeleted?: boolean;
      };
      if (res.ok) {
        // Optimistic update — baris hilang instan dari tabel & statistik,
        // lalu re-fetch sebagai sumber kebenaran (konsistensi akhir server).
        setRows((prev) => (prev ? prev.filter((r) => r.email !== target.email) : prev));
        setDeleteTarget(null);
        const hasAuth = Boolean(target.id);
        toast.success("Data pengguna/lead berhasil dihapus.", {
          description: hasAuth
            ? `${target.email} — akun & lisensi dihapus; data properti dipertahankan.`
            : `${target.email} — data lead calon pembeli dihapus dari database.`,
        });
        await load(true);
      } else {
        toast.error("Gagal menghapus data", {
          description: [data.error, data.detail].filter(Boolean).join(" — ") ?? "Coba lagi sebentar.",
        });
      }
    } catch {
      toast.error("Gagal menghapus data", { description: "Tidak dapat terhubung ke server." });
    } finally {
      setDeleteBusy(false);
    }
  };

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.email.includes(q) ||
        (r.name ?? "").toLowerCase().includes(q) ||
        (r.phone ?? "").includes(q) ||
        r.properties.some((p) => p.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const stats = useMemo(() => {
    if (!rows) return { total: 0, licensed: 0, locked: 0 };
    return {
      total: rows.length,
      licensed: rows.filter((r) => r.licensed).length,
      locked: rows.filter((r) => !r.licensed).length,
    };
  }, [rows]);

  return (
    <main className="min-h-dvh bg-[#f8fafc] pb-10">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-zinc-900">
              <ShieldCheck className="size-5 text-white" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[17px] font-semibold tracking-tight text-zinc-900">
                  Panel Super Admin
                </h1>
                <Badge className="border-transparent bg-zinc-200 text-[12.5px] font-medium text-zinc-700">
                  {mode === "supabase" ? "Supabase Auth" : "Mode Lokal"}
                </Badge>
              </div>
              <p className="mt-0.5 text-[12.5px] text-zinc-500">
                Provisioning manual &amp; kelola lisensi seumur hidup pengguna UnitKu.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={refreshing}
              className="h-8 gap-1.5 px-3 text-[12.5px]"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} strokeWidth={1.75} aria-hidden="true" />
              Muat Ulang
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 gap-1.5 px-3 text-[12.5px]"
            >
              <Link href="/dashboard">
                <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                Dashboard
              </Link>
            </Button>
          </div>
        </header>

        {/* ── Statistik ──────────────────────────────────────────────────────── */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center gap-2 text-zinc-500">
              <UsersRound className="size-4" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[12.5px]">Total Pengguna</span>
            </div>
            <p className="mt-1.5 text-[20px] font-semibold tabular-nums tracking-tight text-zinc-900">
              {rows ? stats.total : "…"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center gap-2 text-zinc-500">
              <BadgeCheck className="size-4 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[12.5px]">Lisensi Aktif</span>
            </div>
            <p className="mt-1.5 text-[20px] font-semibold tabular-nums tracking-tight text-emerald-700">
              {rows ? stats.licensed : "…"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center gap-2 text-zinc-500">
              <Lock className="size-4 text-red-500" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[12.5px]">Terkunci</span>
            </div>
            <p className="mt-1.5 text-[20px] font-semibold tabular-nums tracking-tight text-red-600">
              {rows ? stats.locked : "…"}
            </p>
          </div>
        </div>

        {/* ── Toolbar ────────────────────────────────────────────────────────── */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, email, atau properti…"
            className="h-9 w-full max-w-xs text-[13px]"
          />
          <Button
            onClick={() => setAddOpen(true)}
            className="h-9 gap-1.5 bg-zinc-900 px-3.5 text-[12.5px] text-white hover:bg-zinc-800"
          >
            <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Tambah Pengguna Manual
          </Button>
        </div>

        {/* ── Tabel pengguna ─────────────────────────────────────────────────── */}
        <div className="mt-3 rounded-xl border border-border bg-white">
          {loadError ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertDescription className="text-[12.5px]">{loadError}</AlertDescription>
              </Alert>
            </div>
          ) : filtered === null ? (
            <div className="flex items-center justify-center gap-2 p-10 text-[12.5px] text-zinc-500">
              <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
              Memuat daftar pengguna…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-xl bg-zinc-100">
                <UsersRound className="size-5 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <p className="text-[13px] font-medium text-zinc-700">
                {query ? "Tidak ada pengguna yang cocok." : "Belum ada pengguna terdaftar."}
              </p>
              <p className="max-w-sm text-[12.5px] text-zinc-500">
                {query
                  ? "Coba kata kunci lain — pencarian mencakup nama, email, dan properti."
                  : "Akun pembeli dari webhook Mayar dan pengguna manual akan tampil di sini."}
              </p>
            </div>
          ) : (
            <div className="scrollbar-thin max-h-[560px] overflow-auto">
              <Table className="min-w-[1020px]">
                <TableHeader className="sticky top-0 z-10 bg-zinc-50 [&_tr]:border-b">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-9 pl-4 text-[12.5px] font-medium text-zinc-500">Nama</TableHead>
                    <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">Email</TableHead>
                    <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">Nomor WhatsApp</TableHead>
                    <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">Tanggal Daftar</TableHead>
                    <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">Properti/Kost</TableHead>
                    <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">Status Lisensi</TableHead>
                    <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">Sumber</TableHead>
                    <TableHead className="h-9 pr-4 text-right text-[12.5px] font-medium text-zinc-500">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.email} className="hover:bg-zinc-50/60">
                      <TableCell className="py-2.5 pl-4">
                        <div className="flex items-center gap-2">
                          <span className="max-w-[160px] truncate text-[13px] font-medium text-zinc-900">
                            {row.name ?? "—"}
                          </span>
                          {row.isSuperAdmin && (
                            <Badge className="border-transparent bg-zinc-900 px-1.5 py-0 text-[11px] font-medium text-white">
                              Admin
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="block max-w-[220px] truncate text-[12.5px] text-zinc-600">{row.email}</span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        {row.phone ? (
                          <a
                            href={`https://wa.me/${row.phone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[12.5px] font-medium text-emerald-700 underline-offset-2 hover:bg-emerald-50 hover:text-emerald-800 hover:underline"
                            aria-label={`Chat WhatsApp ${formatWaDisplay(row.phone)} (${row.email})`}
                            title={`Follow-up via WhatsApp — ${formatWaDisplay(row.phone)}`}
                          >
                            <MessageCircle className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                            {formatWaDisplay(row.phone)}
                          </a>
                        ) : (
                          <span className="text-[12.5px] text-zinc-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 text-[12.5px] tabular-nums text-zinc-600">
                        {formatDate(row.registeredAt)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        {row.properties.length === 0 ? (
                          <span className="text-[12.5px] text-zinc-400">—</span>
                        ) : (
                          <div className="flex max-w-[200px] items-center gap-1.5">
                            <Building2 className="size-3.5 shrink-0 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
                            <span className="truncate text-[12.5px] text-zinc-700" title={row.properties.join(", ")}>
                              {row.properties[0]}
                              {row.properties.length > 1 ? ` +${row.properties.length - 1}` : ""}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5">
                        {row.licensed ? (
                          <Badge className="border-transparent bg-emerald-100 text-[12.5px] font-medium text-emerald-800">
                            <BadgeCheck className="mr-1 size-3" strokeWidth={1.75} aria-hidden="true" />
                            Lifetime · Aktif
                          </Badge>
                        ) : (
                          <Badge className="border-transparent bg-red-100 text-[12.5px] font-medium text-red-700">
                            <Lock className="mr-1 size-3" strokeWidth={1.75} aria-hidden="true" />
                            Terkunci
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5">
                        {row.source ? (
                          <span className="text-[12.5px] text-zinc-600">{SOURCE_LABEL[row.source]}</span>
                        ) : (
                          <span className="text-[12.5px] text-zinc-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 pr-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Saklar lisensi instan */}
                          <div className="flex items-center gap-1.5">
                            <Switch
                              checked={row.licensed}
                              disabled={pendingToggle === row.email}
                              onCheckedChange={(v) => void toggleLicense(row, v === true)}
                              aria-label={
                                row.licensed
                                  ? `Cabut lisensi ${row.email}`
                                  : `Aktifkan lisensi ${row.email}`
                              }
                            />
                          </div>
                          {/* Reset password cepat */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setResetTarget(row)}
                            className="size-7 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                            aria-label={`Reset password ${row.email}`}
                            title="Reset Password Cepat"
                          >
                            <KeyRound className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          </Button>
                          {/* Hapus akun */}
                          {row.email !== adminEmail.trim().toLowerCase() && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(row)}
                              className="size-7 text-red-500 hover:bg-red-50 hover:text-red-600"
                              aria-label={`Hapus akun ${row.email}`}
                              title="Hapus Akun"
                            >
                              <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-zinc-500">
          <ShieldOff className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          Menghapus pengguna membersihkan data auth, lisensi, profil, dan lead calon pembeli; data properti
          (kamar, tagihan, kas) dipertahankan tanpa pemilik. Sesi admin aktif: <span className="font-medium text-zinc-700">{adminEmail}</span>.
        </p>
      </div>

      {/* Dialog tambah pengguna */}
      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} onCreated={() => void load(true)} />

      {/* Dialog reset password */}
      <ResetPasswordDialog target={resetTarget} onOpenChange={(v) => !v && setResetTarget(null)} />

      {/* Konfirmasi hapus akun */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">
              {deleteTarget?.id ? "Hapus Akun Pengguna?" : "Hapus Data Calon Pengguna?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12.5px]">
              {deleteTarget?.id ? (
                <>
                  Akun auth <span className="font-medium text-zinc-700">{deleteTarget?.email}</span> dan data
                  lisensinya akan dihapus permanen. Data properti (kamar, tagihan, kas) tetap tersimpan tanpa
                  pemilik. Tindakan ini tidak dapat dibatalkan.
                </>
              ) : (
                <>
                  Data lead calon pembeli{" "}
                  <span className="font-medium text-zinc-700">{deleteTarget?.email}</span> akan dihapus permanen
                  dari database (license_leads). Tindakan ini tidak dapat dibatalkan.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-[12.5px]">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleteBusy}
              className="h-9 bg-red-600 text-[12.5px] text-white hover:bg-red-700"
            >
              {deleteBusy && <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
              {deleteTarget?.id ? "Ya, Hapus Akun" : "Ya, Hapus Data Lead"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
