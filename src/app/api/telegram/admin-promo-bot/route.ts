// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Telegram Webhook Admin: Generator Stok Konten Iklan Kemitraan
//
// POST /api/telegram/admin-promo-bot
//   Bot Telegram internal ADMIN ONLY untuk generate bahan perekrutan mitra
//   program afiliasi secara instan (acak modular: hook + konteks + value +
//   CTA — 100 × 100 × 100 × 100 = 100 juta variasi status medsos).
//
//   Menu inline keyboard:
//     🎲 Acak Status FB / Threads   → gabungan ADMIN_HOOKS × ADMIN_CONTEXTS ×
//                                     ADMIN_VALUES × ADMIN_CTAS
//     📩 Template Balasan Inbox/DM  → salah satu ADMIN_DM_TEMPLATES siap
//                                     copy-paste (5 variasi)
//     🔄 Acak Teks Baru             → generate ulang materi yang sama
//     🔙 Menu Utama                 → kembali ke pilihan jenis materi
//
//   Keamanan:
//     - Whitelist chat: hanya TELEGRAM_ADMIN_CHAT_ID yang dilayani (chat lain
//       di-abort diam-diam dengan { ok: true } agar Telegram berhenti retry).
//     - Setelah /start, admin tinggal tap tombol — teks hasil dibungkus
//       <pre><code> sehingga 1x tap langsung tersalin ke clipboard.
//
//   Konfigurasi:
//     - Env (opsional): TELEGRAM_ADMIN_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID
//     - Set webhook via BotFather / setWebhook:
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
} from "@/data/adminPromoData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOT_TOKEN = process.env.TELEGRAM_ADMIN_BOT_TOKEN || "9293776042:AAHjcDNIdzkvi0Hl5In7iKk9uiH9W1YgWWU";
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

function generatePromo(): string {
  return `${getRandom(ADMIN_HOOKS)}\n\n${getRandom(ADMIN_CONTEXTS)}\n\n${getRandom(ADMIN_VALUES)}\n\n${getRandom(ADMIN_CTAS)}`;
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
    const body = await req.json();

    const isMessage = Boolean(body.message);
    const isCallback = Boolean(body.callback_query);

    const chatId = isMessage
      ? body.message.chat.id
      : isCallback
      ? body.callback_query.message.chat.id
      : null;

    if (!chatId) return NextResponse.json({ ok: true });

    // Whitelist check
    if (ADMIN_CHAT_ID && String(chatId) !== String(ADMIN_CHAT_ID)) {
      return NextResponse.json({ ok: true });
    }

    if (isMessage && body.message.text === "/start") {
      await sendTelegram("sendMessage", {
        chat_id: chatId,
        text: "⚡ <b>UnitKu Promo Generator (Admin Only)</b>\n\nPilih jenis materi yang ingin Anda ambil:",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎲 Acak Status FB / Threads", callback_data: "gen_promo" }],
            [{ text: "📩 Template Balasan Inbox/DM", callback_data: "gen_dm" }],
          ],
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (isCallback) {
      const data = body.callback_query.data;
      const callbackId = body.callback_query.id;

      await sendTelegram("answerCallbackQuery", { callback_query_id: callbackId });

      if (data === "menu_main") {
        await sendTelegram("sendMessage", {
          chat_id: chatId,
          text: "⚡ <b>Pilih Menu:</b>",
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🎲 Acak Status FB / Threads", callback_data: "gen_promo" }],
              [{ text: "📩 Template Balasan Inbox/DM", callback_data: "gen_dm" }],
            ],
          },
        });
        return NextResponse.json({ ok: true });
      }

      let content = "";
      let repeatAction = "";

      if (data === "gen_promo") {
        content = generatePromo();
        repeatAction = "gen_promo";
      } else if (data === "gen_dm") {
        content = getRandom(ADMIN_DM_TEMPLATES);
        repeatAction = "gen_dm";
      }

      if (content) {
        // Tag pre code membuat teks bisa di-copy cukup 1x tap di Telegram
        const messageText = `Klik teks di bawah untuk langsung menyalin:\n\n<pre><code>${escapeHtml(content)}</code></pre>`;

        await sendTelegram("sendMessage", {
          chat_id: chatId,
          text: messageText,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Acak Teks Baru", callback_data: repeatAction }],
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
