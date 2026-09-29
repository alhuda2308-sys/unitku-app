// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Service Worker minimal (syarat installability PWA Chrome)
//
// Strategi: pass-through network-first TANPA cache data — dashboard selalu
// menampilkan data segar dari Supabase; SW hanya memenuhi kriteria instalasi
// dan menyediakan halaman offline ramah saat jaringan hilang.
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // mutasi API → jangan ganggu
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // lintas origin → abaikan

  event.respondWith(
    fetch(req).catch(async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === "navigate") {
        return new Response(
          '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>UnitKu — Offline</title></head><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fff;color:#18181b"><div style="text-align:center;padding:24px"><div style="font-size:40px">&#128225;</div><h1 style="font-size:18px;margin:8px 0">Anda sedang offline</h1><p style="font-size:14px;color:#52525b;margin:0">UnitKu butuh koneksi internet untuk memuat data terbaru.</p></div></body></html>',
          { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 },
        );
      }
      return Response.error();
    }),
  );
});
