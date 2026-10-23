"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react";
import { TenantPortal } from "@/components/kost/tenant-portal";
import { Button } from "@/components/ui/button";
import { ANNOUNCEMENT_TODAY_ISO } from "@/lib/announcement-data";
import {
  getPortalMirror,
  getServerPortalMirror,
  subscribeMirror,
} from "@/lib/portal-mirror";
import {
  getServerSettingsSnapshot,
  getSettingsSnapshot,
  loadSettings,
  subscribeSettings,
} from "@/lib/app-settings";
import { portalApi, type PortalData } from "@/lib/api-client";
import type { PortalRekening } from "@/lib/tenant-portal";

/**
 * Halaman publik Portal Penyewa — /portal?token=[portal_token]
 *
 * Token magic-link (atribut `portalToken` milik penghuni) menentukan SATU
 * kamar. Portal penyewa RIIL SELALU memakai data cloud via GET
 * /api/portal?token=… (Supabase) — TANPA data mock/statik:
 *   • Memuat → kartu "Memuat portal penyewa…"
 *   • Gagal  → kartu error + "Coba Lagi" (BUKAN data contoh dari mirror)
 *   • Sukses → TenantPortal dgn kamar/tagihan/pengumuman terkini
 *
 * Revalidasi (anti cache): respons API no-store + refetch berkala tiap 30
 * detik saat tab terlihat + refetch saat tab kembali fokus/terlihat —
 * pengumuman & tagihan baru yang dipasang owner langsung muncul tanpa
 * clear cache browser.
 *
 * Tanpa token (pratinjau /portal kosong): tetap membaca mirror dashboard
 * owner di localStorage — itu bukan portal penyewa riil, sekadar pratinjau.
 */
function PortalByToken() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  // Ikuti tema solid yang dipilih owner di Pengaturan → Tema & Tampilan
  useEffect(() => {
    document.documentElement.dataset.ikTheme = loadSettings().theme;
  }, []);
  const mirror = useSyncExternalStore(
    subscribeMirror,
    getPortalMirror,
    getServerPortalMirror
  );
  // Katalog fasilitas bersama (Pengaturan → Katalog Fasilitas) — live sinkron
  const settings = useSyncExternalStore(
    subscribeSettings,
    getSettingsSnapshot,
    getServerSettingsSnapshot
  );

  // Cloud-first: token ada → HANYA data database (tanpa fallback mock/statik)
  const [cloud, setCloud] = useState<PortalData | null>(null);
  const [failed, setFailed] = useState(false);
  const hasCloudRef = useRef(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await portalApi.resolve(token);
      setCloud(res);
      hasCloudRef.current = true;
      setFailed(false);
    } catch {
      // Gagal: tanpa data cloud sama sekali → tampilkan error (BUKAN mock).
      // Gagal saat refresh → pertahankan data terakhir yang baik (diam).
      if (!hasCloudRef.current) setFailed(true);
    }
  }, [token]);

  // Reset data cloud saat token berganti (pola "adjust state during render" —
  // token lama tidak boleh bocor ke tampilan token baru)
  const [prevToken, setPrevToken] = useState(token);
  if (prevToken !== token) {
    setPrevToken(token);
    setCloud(null);
    setFailed(false);
  }

  // Muat awal — pola .then (setState di callback async, bukan sinkron di effect)
  useEffect(() => {
    hasCloudRef.current = false;
    let alive = true;
    portalApi
      .resolve(token)
      .then((res) => {
        if (!alive) return;
        setCloud(res);
        hasCloudRef.current = true;
        setFailed(false);
      })
      .catch(() => {
        if (alive && !hasCloudRef.current) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  // Revalidasi berkala + saat tab kembali aktif — pengumuman baru dari owner
  // tampil tanpa reload manual / clear cache.
  useEffect(() => {
    if (!token) return;
    const refetch = () => {
      if (document.visibilityState === "visible") void load();
    };
    const interval = window.setInterval(refetch, 30_000);
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", refetch);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", refetch);
    };
  }, [load, token]);

  // "Hari ini" utk status tayang banner pengumuman:
  //  • Pratinjau tanpa token (mirror dataset lokal) & sesi demo (properti seed)
  //    → tanggal snapshot dataset (ANNOUNCEMENT_TODAY_ISO) — konsisten dgn
  //    panel admin demo yang berada di dunia dataset beku Sep 2026.
  //  • Portal penyewa RIIL (token non-demo) → tanggal riil perangkat —
  //    pengumuman yang dipasang owner hari ini langsung live di portal.
  const realTodayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  }, []);

  // Portal penyewa RIIL (token ada, cloud belum berhasil) — TIDAK PERNAH
  // menampilkan data mock/statik: loading atau error state saja.
  if (token && !cloud) {
    return failed ? (
      <PortalNotice
        tone="error"
        onRetry={() => void load()}
      />
    ) : (
      <PortalNotice tone="loading" />
    );
  }

  const portalTodayISO = cloud
    ? cloud.demo
      ? ANNOUNCEMENT_TODAY_ISO
      : realTodayISO
    : ANNOUNCEMENT_TODAY_ISO;

  // Rekening & QRIS statis owner — cloud-first (Supabase), fallback pengaturan
  // lokal perangkat ini agar pratinjau tetap hidup saat offline.
  const rekening: PortalRekening = cloud?.rekening ?? {
    bank: settings.rekening.bank,
    noRek: settings.rekening.noRek,
    atasNama: settings.rekening.atasNama,
    qrisImageUrl: settings.rekening.qrisImageUrl,
    qrisNmid: settings.rekening.qrisNmid,
  };

  return (
    <TenantPortal
      token={token}
      rooms={cloud ? [cloud.room] : mirror.rooms}
      invoices={cloud ? cloud.invoices : mirror.invoices}
      announcements={cloud ? (cloud.announcements ?? []) : mirror.announcements}
      propertyName={cloud?.propertyName ?? mirror.propertyName}
      sharedFacilities={settings.facilities.shared.map((f) => f.label)}
      rekening={rekening}
      todayISO={portalTodayISO}
      standalone
    />
  );
}

/** Kartu memuat / gagal-muat — pengganti data mock di portal penyewa riil */
function PortalNotice({
  tone,
  onRetry,
}: {
  tone: "loading" | "error";
  onRetry?: () => void;
}) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10"
      aria-live="polite"
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-white p-6 text-center shadow-sm">
        <span
          className={
            tone === "loading"
              ? "mx-auto flex size-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700"
              : "mx-auto flex size-11 items-center justify-center rounded-full bg-amber-50 text-amber-600"
          }
          aria-hidden="true"
        >
          {tone === "loading" ? (
            <LoaderCircle className="size-5 animate-spin" strokeWidth={2} />
          ) : (
            <AlertTriangle className="size-5" strokeWidth={1.75} />
          )}
        </span>
        <p className="mt-3 text-[14px] font-bold text-zinc-900">
          {tone === "loading"
            ? "Memuat portal penyewa…"
            : "Gagal memuat data portal"}
        </p>
        <p className="mt-1 text-[12.5px] leading-5 text-zinc-700">
          {tone === "loading"
            ? "Mengambil data kamar, tagihan, dan pengumuman terbaru dari server."
            : "Koneksi ke server tidak berhasil. Data tidak ditampilkan dari sumber lain agar informasi tetap akurat — periksa jaringan lalu coba lagi."}
        </p>
        {onRetry && (
          <Button
            onClick={onRetry}
            className="mt-4 h-9 gap-1.5 bg-zinc-900 px-3 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800"
          >
            <RefreshCw className="size-3.5" strokeWidth={2} aria-hidden="true" />
            Coba Lagi
          </Button>
        )}
      </div>
    </main>
  );
}

export default function PortalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" aria-hidden="true" />}>
      <PortalByToken />
    </Suspense>
  );
}
