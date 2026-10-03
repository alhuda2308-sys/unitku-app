"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Meta (Facebook) Pixel situs-lebar (dipasang di root layout)
//
// - ID Pixel: 1589897592484190 (Meta Ads UnitKu) — konstanta angka, aman
//   di-inline ke script (tanpa risiko injeksi).
// - Otomatis `fbq('init')` + event 'PageView' setiap halaman dibuka.
// - Event lanjutan ('Lead', 'InitiateCheckout', dst.) ditembakkan dari
//   komponen client lain via window.fbq — tipe globalnya ada di
//   src/types/facebook-pixel.d.ts.
// - Catatan: halaman /checkout punya komponen pixel terpisah (env-driven,
//   NEXT_PUBLIC_FACEBOOK_PIXEL_ID) — saat env kosong komponen itu merender
//   null, sehingga tidak ada event dobel dengan pixel situs-lebar ini.
// ─────────────────────────────────────────────────────────────────────────────

import Script from "next/script";

// ID Pixel Meta hanya berisi angka — divalidasi statis agar inline script
// selalu aman.
const META_PIXEL_ID = "1589897592484190";

export function MetaPixel() {
  return (
    <>
      <Script id="meta-pixel-global" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* Fallback resmi Meta saat JS dinonaktifkan pengunjung */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
