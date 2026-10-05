"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { TenantPortal } from "@/components/kost/tenant-portal";
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
 * kamar. Data diambil pertama dari cloud via GET /api/portal?token=… (Supabase)
 * sehingga status pembayaran selalu terkini lintas perangkat; bila API gagal,
 * jatuh ke mirror dashboard owner (localStorage) seperti sebelumnya.
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

  // Cloud-first: data kamar & tagihan dari database; gagal → mirror lokal
  const [cloud, setCloud] = useState<PortalData | null>(null);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    portalApi
      .resolve(token)
      .then((res) => {
        if (alive) setCloud(res);
      })
      .catch(() => {
        /* fallback mirror */
      });
    return () => {
      alive = false;
    };
  }, [token]);

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
      announcements={cloud?.announcements ?? mirror.announcements}
      propertyName={cloud?.propertyName ?? mirror.propertyName}
      sharedFacilities={settings.facilities.shared.map((f) => f.label)}
      rekening={rekening}
      standalone
    />
  );
}

export default function PortalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" aria-hidden="true" />}>
      <PortalByToken />
    </Suspense>
  );
}
