// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Telegram Webhook ADMIN: Generator Stok Konten Kemitraan
//
// POST /api/telegram/admin-promo-bot
//   Bot Telegram internal ADMIN ONLY (@unitku_promogen_bot) untuk menyiapkan
//   bahan perekrutan mitra program afiliasi secara instan.
//
//   Menu inline keyboard:
//     🤝 Acak Teks Ajakan Mitra (Rekrutmen) → getRandomRecruitmentCopy()
//       (struktur baku: Hook peluang → Penjelasan & simulasi komisi
//        Rp150.000/lisensi → 5 poin checklist ✅ → CTA pendaftaran mitra;
//        dipindahkan dari src/data/affiliateCopies.ts ke adminPromoData.ts)
//     🎲 Acak Status FB / Threads           → gabungan ADMIN_HOOKS ×
//                                             ADMIN_CONTEXTS × ADMIN_VALUES ×
//                                             ADMIN_CTAS (100 juta variasi)
//     📩 Template Balasan Inbox/DM          → salah satu ADMIN_DM_TEMPLATES
//                                             siap copy-paste (5 variasi)
//     🔙 Menu Utama                         → kembali ke pilihan jenis materi
//
//   Tombol ulang mengikuti kategori aktif:
//     - Rekrutmen : [🎲 Acak Teks Ajakan Mitra] [🔙 Menu Utama]
//     - Status    : [🎲 Acak Status FB / Threads] [🔙 Menu Utama]
//     - DM        : [📩 Template DM Lain] [🔙 Menu Utama]
//
//   Seluruh output dibungkus <pre><code class="language-copy"> sehingga tombol
//   salin instan (ikon COPY di pojok kanan atas kotak pesan) tampil di
//   Telegram — teks tersalin utuh beserta emoji ✅ dan format baris.
//
//   Keamanan:
//     - Token WAJIB dari env TELEGRAM_ADMIN_BOT_TOKEN — tanpa hardcode di
//       kode; bila kosong webhook menolak diam (log error, tidak crash).
//     - Whitelist chat: hanya TELEGRAM_ADMIN_CHAT_ID yang dilayani (chat lain
//       di-abort diam-diam dengan { ok: true } agar Telegram berhenti retry).
//     - Cooldown klik callback 1,5 detik per chat — klik cepat beruntun tidak
//       memicu kirim pesan berulang (aman dari rate-limit/spam Telegram);
//       callback yang kena cooldown tetap dijawab answerCallbackQuery.
//
//   Konfigurasi:
//     - Env (wajib): TELEGRAM_ADMIN_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID
//     - Set webhook pada bot @unitku_promogen_bot (BotFather /setwebhook):
//         https://unitku.my.id/api/telegram/admin-promo-bot
//
// Catatan: /api/* dilewati middleware (lihat src/middleware.ts) — whitelist
// chat di handler inilah satu-satunya gerbang bot ini. Bank materi dipisah ke
// src/data/adminPromoData.ts agar route ringan dan mudah dirawat.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_CONTEXTS,
  ADMIN_CTAS,
  ADMIN_DM_TEMPLATES,
  ADMIN_HOOKS,
  ADMIN_VALUES,
  getRandomRecruitmentCopy,
} from "@/data/adminPromoData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Token bot admin — WAJIB dari environment variable, tanpa hardcode di kode. */
const BOT_TOKEN = (process.env.TELEGRAM_ADMIN_BOT_TOKEN || "").trim();
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Escape karakter HTML agar isi materi aman dikirim dengan parse_mode HTML di
// dalam <pre><code> — hasil render (dan teks yang tersalin 1x tap) tetap sama
// persis dengan bank materi, termasuk karakter &, <, >.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Gabungan 4 bank moduler: hook × konteks × value × CTA (status medsos). */
function generatePromo(): string {
  return `${getRandom(ADMIN_HOOKS)}\n\n${getRandom(ADMIN_CONTEXTS)}\n\n${getRandom(ADMIN_VALUES)}\n\n${getRandom(ADMIN_CTAS)}`;
}

/** Keyboard menu utama — dipakai /start dan tombol 🔙 Menu Utama. */
function buildMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🤝 Acak Teks Ajakan Mitra (Rekrutmen)", callback_data: "gen_rekrut" }],
      [{ text: "🎲 Acak Status FB / Threads", callback_data: "gen_promo" }],
      [{ text: "📩 Template Balasan Inbox/DM", callback_data: "gen_dm" }],
    ],
  };
}

/** Cooldown klik callback per chat (1,5 detik) — klik cepat beruntun tidak
 *  memicu kirim pesan berulang sehingga aman dari rate-limit/spam server
 *  Telegram. Callback yang kena cooldown tetap dijawab answerCallbackQuery
 *  (toast ringan) supaya spinner tombol berhenti tanpa kirim pesan. */
const CALLBACK_COOLDOWN_MS = 1500;
const lastCallbackAt = new Map<number, number>();

function pruneCallbackMap(now: number): void {
  if (lastCallbackAt.size < 1000) return;
  for (const [key, ts] of lastCallbackAt) {
    if (now - ts > 60_000) lastCallbackAt.delete(key);
  }
}

async function sendTelegram(method: string, payload: any) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Telegram API error:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!BOT_TOKEN) {
      console.error(
        "[admin-promo-bot] Token bot belum diatur — set TELEGRAM_ADMIN_BOT_TOKEN di environment."
      );
      return NextResponse.json({ ok: true });
    }

    const body = await req.json();

    const isMessage = Boolean(body.message);
    const isCallback = Boolean(body.callback_query);

    const chatId = isMessage
      ? body.message.chat.id
      : isCallback
      ? body.callback_query.message.chat.id
      : null;

    if (!chatId) return NextResponse.json({ ok: true });

    // Whitelist check — chat selain admin di-abort diam-diam
    if (ADMIN_CHAT_ID && String(chatId) !== String(ADMIN_CHAT_ID)) {
      return NextResponse.json({ ok: true });
    }

    if (isMessage && body.message.text === "/start") {
      await sendTelegram("sendMessage", {
        chat_id: chatId,
        text: "⚡ <b>UnitKu Promo Generator (Admin Only)</b>\n\nPilih jenis materi yang ingin Anda ambil:",
        parse_mode: "HTML",
        reply_markup: buildMainMenuKeyboard(),
      });
      return NextResponse.json({ ok: true });
    }

    if (isCallback) {
      const data = body.callback_query.data;
      const callbackId = body.callback_query.id;

      // Rate-limit ringan: abaikan klik beruntun < 1,5 detik pada chat yang sama
      const now = Date.now();
      pruneCallbackMap(now);
      const lastTs = lastCallbackAt.get(chatId) ?? 0;
      if (now - lastTs < CALLBACK_COOLDOWN_MS) {
        await sendTelegram("answerCallbackQuery", {
          callback_query_id: callbackId,
          text: "Tunggu sebentar ya, materi sedang disiapkan 🙏",
          show_alert: false,
        });
        return NextResponse.json({ ok: true });
      }
      lastCallbackAt.set(chatId, now);

      // Respons callback langsung agar spinner tombol Telegram berhenti
      await sendTelegram("answerCallbackQuery", { callback_query_id: callbackId });

      if (data === "menu_main") {
        await sendTelegram("sendMessage", {
          chat_id: chatId,
          text: "⚡ <b>Pilih Menu:</b>",
          parse_mode: "HTML",
          reply_markup: buildMainMenuKeyboard(),
        });
        return NextResponse.json({ ok: true });
      }

      // Konten, petunjuk di atas kotak, dan tombol ulang mengikuti kategori aktif
      let content = "";
      let hint = "";
      let repeatAction = "";
      let repeatLabel = "";

      if (data === "gen_rekrut") {
        content = getRandomRecruitmentCopy();
        hint = "💡 <b>Tap kotak di bawah untuk menyalin, lalu ganti [MASUKKAN_LINK_REFERRAL_ANDA] dengan link referral Anda:</b>";
        repeatAction = "gen_rekrut";
        repeatLabel = "🎲 Acak Teks Ajakan Mitra";
      } else if (data === "gen_promo") {
        content = generatePromo();
        hint = "💡 <b>Tap kotak di bawah untuk menyalin materi status medsos:</b>";
        repeatAction = "gen_promo";
        repeatLabel = "🎲 Acak Status FB / Threads";
      } else if (data === "gen_dm") {
        content = getRandom(ADMIN_DM_TEMPLATES);
        hint = "💡 <b>Tap kotak di bawah untuk menyalin balasan DM:</b>";
        repeatAction = "gen_dm";
        repeatLabel = "📩 Template DM Lain";
      }

      if (content) {
        // Tag <code class="language-copy"> memunculkan tombol salin instan
        // (ikon COPY di pojok kanan atas kotak pesan) di aplikasi Telegram.
        const messageText = `${hint}\n\n<pre><code class="language-copy">${escapeHtml(content)}</code></pre>`;

        await sendTelegram("sendMessage", {
          chat_id: chatId,
          text: messageText,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: repeatLabel, callback_data: repeatAction }],
              [{ text: "🔙 Menu Utama", callback_data: "menu_main" }],
            ],
          },
        });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
