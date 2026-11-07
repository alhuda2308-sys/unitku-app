'use client';

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Histats visitor counter situs-lebar (dipasang di root layout)
//
// - ID Histats: 5062868 — dipasang via next/script strategy
//   "afterInteractive" agar tidak memblokir hydration.
// - Script asli dimuat dari s10.histats.com; noscript fallback memakai
//   pixel GIF sstatic1.histats.com utk pengunjung tanpa JS.
// ─────────────────────────────────────────────────────────────────────────────

import Script from 'next/script';

export default function Histats() {
  return (
    <>
      <Script
        id="histats-counter"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            var _Hasync = _Hasync || [];
            _Hasync.push(['Histats.start', '1,5062868,4,0,0,0,00010000']);
            _Hasync.push(['Histats.fasi', '1']);
            _Hasync.push(['Histats.track_hits', '']);
            (function() {
              var hs = document.createElement('script'); hs.type = 'text/javascript'; hs.async = true;
              hs.src = ('//s10.histats.com/js15_as.js');
              (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(hs);
            })();
          `,
        }}
      />
      <noscript>
        <a href="/" target="_blank" rel="noopener noreferrer">
          <img
            src="//sstatic1.histats.com/0.gif?5062868&101"
            alt="Histats"
            style={{ border: 0, display: 'none' }}
          />
        </a>
      </noscript>
    </>
  );
}
