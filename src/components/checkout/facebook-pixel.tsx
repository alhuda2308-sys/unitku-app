"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Meta (Facebook) Pixel untuk halaman iklan /checkout
//
// - NEXT_PUBLIC_FACEBOOK_PIXEL_ID kosong / tidak valid → komponen merender
//   null: script pixel TIDAK dimuat sama sekali, tanpa error apa pun.
// - Diisi → otomatis memuat fbevents.js, `fbq('init', ID)`, lalu menembakkan
//   event 'PageView' + 'InitiateCheckout' (standard event Meta untuk halaman
//   checkout, dipakai optimasi kampanye Ads).
// ─────────────────────────────────────────────────────────────────────────────

import Script from "next/script";

export function FacebookPixel() {
  const pixelId = (process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID ?? "").trim();

  // ID Pixel Meta hanya berisi angka (mis. "1234567890123456") — validasi
  // ketat agar nilai env yang aneh tidak bisa menyuntik skrip berbahaya.
  if (!/^\d{5,30}$/.test(pixelId)) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
fbq('track', 'InitiateCheckout');`}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
