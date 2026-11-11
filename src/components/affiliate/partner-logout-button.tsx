"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Tombol Keluar Portal Mitra (dashboard /affiliate/dashboard)
//
// POST /api/affiliate/logout → cookie "unitku_partner" dihapus server →
// mitra dibawa ke /affiliate/login. Bila request gagal (offline), tombol
// menampilkan pesan kecil alih-alih me-redirect (hindari pantulan loop dgn
// guard sesi di halaman login).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PartnerLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleLogout() {
    setError(false);
    setLoading(true);
    try {
      const res = await fetch("/api/affiliate/logout", { method: "POST" });
      if (!res.ok) throw new Error("logout gagal");
      router.replace("/affiliate/login");
      router.refresh();
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-zinc-600 hover:text-red-600"
        onClick={handleLogout}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <LogOut className="size-4" aria-hidden="true" />
        )}
        Keluar dari Portal Mitra
      </Button>
      {error && (
        <span role="alert" className="text-[11px] font-medium text-red-600">
          Gagal keluar — periksa koneksi lalu coba lagi.
        </span>
      )}
    </span>
  );
}
