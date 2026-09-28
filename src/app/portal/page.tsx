"use client";

import { Suspense, useEffect, useSyncExternalStore } from "react";
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

/**
 * Halaman publik Portal Penyewa — /portal?token=[portal_token]
 *
 * Token magic-link (atribut `portalToken` milik penghuni) menentukan SATU
 * kamar: halaman hanya menampilkan identitas kamar & tagihan milik token
 * tersebut, tanpa login. Data dihidrasi dari mirror dashboard owner
 * (localStorage, live via event storage) sehingga status pembayaran selalu
 * terkini; bila mirror belum ada, dipakai dataset seed.
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

  return (
    <TenantPortal
      token={token}
      rooms={mirror.rooms}
      invoices={mirror.invoices}
      announcements={mirror.announcements}
      propertyName={mirror.propertyName}
      sharedFacilities={settings.facilities.shared.map((f) => f.label)}
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
