// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Telegram Webhook MITRA: Generator Materi Promosi (PUBLIK)
//
// POST /api/telegram/mitra-promo-bot
//   Bot Telegram untuk seluruh MITRA UnitKu — bebas akses, tanpa whitelist:
//   siapa pun yang menekan /start pada bot ini bisa mengambil draf promosi
//   siap pakai untuk menawarkan UnitKu ke pemilik kost/kontrakan.
//
//   Menu inline keyboard:
//     🎲 Acak Status Medsos          → getRandomAffiliateCopy()
//       (TOPIC-BASED POOL: hook + pain + solusi + checklist ✅ + CTA selalu
//        diambil dari TEMA YANG SAMA di COPY_THEMES — affiliateCopies.ts,
//        supaya alur kalimat selalu nyambung antar-paragraf)
//     💬 Template Chat WhatsApp      → salah satu WA_TEMPLATES siap kirim
//     🎲 Acak Teks Baru              → generate ulang kategori yang sama
//     🔙 Menu Utama                  → kembali ke pilihan kategori
//
//   Mitra tinggal tap kotak <code> untuk menyalin, lalu mengganti
//   placeholder [MASUKKAN_LINK_REFERRAL_ANDA] dengan link referral sendiri.
//
//   Konfigurasi:
//     - Env (opsional): TELEGRAM_MITRA_BOT_TOKEN (fallback hardcode produksi)
//     - Set webhook: https://unitku.my.id/api/telegram/mitra-promo-bot
//
// Catatan: /api/* dilewati middleware (lihat src/middleware.ts). Data materi
// dipisah dari route: bank copywriting per-tema di src/data/affiliateCopies.ts,
// template WA ke pemilik kost tetap di src/data/mitraPromoData.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getRandomAffiliateCopy } from "@/data/affiliateCopies";
import { WA_TEMPLATES } from "@/data/mitraPromoData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOT_TOKEN = process.env.TELEGRAM_MITRA_BOT_TOKEN || "9169376869:AAEgyAQif7vHReKFUVKGLmJZW-vQFmauohc";

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Escape karakter HTML agar aman dikirim dengan parse_mode "HTML" Telegram
 *  (konten copywriting memuat "&" pada poin checklist). */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

    // Handle command /start (Publik, tanpa whitelist)
    if (isMessage && body.message.text === "/start") {
      await sendTelegram("sendMessage", {
        chat_id: chatId,
        text: "👋 <b>Selamat Datang di Generator Materi Promosi Mitra UnitKu!</b>\n\nAmbil draf promosi siap pakai untuk ditawarkan ke pemilik kost/kontrakan. Klik tombol di bawah:",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎲 Acak Status Medsos (Nyambung Sesuai Tema)", callback_data: "mitra_promo" }],
            [{ text: "💬 Template Chat WhatsApp ke Pemilik Kost", callback_data: "mitra_wa" }],
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
          text: "⚡ <b>Pilih Kategori Materi:</b>",
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🎲 Acak Status Medsos (Nyambung Sesuai Tema)", callback_data: "mitra_promo" }],
              [{ text: "💬 Template Chat WhatsApp ke Pemilik Kost", callback_data: "mitra_wa" }],
            ],
          },
        });
        return NextResponse.json({ ok: true });
      }

      let content = "";
      let repeatAction = "";

      if (data === "mitra_promo") {
        content = getRandomAffiliateCopy();
        repeatAction = "mitra_promo";
      } else if (data === "mitra_wa") {
        content = getRandom(WA_TEMPLATES);
        repeatAction = "mitra_wa";
      }

      if (content) {
        const messageText = `💡 <b>Tap kotak di bawah untuk menyalin, lalu ganti [MASUKKAN_LINK_REFERRAL_ANDA] dengan link milik Anda:</b>\n\n<code>${escapeHtml(content)}</code>`;

        await sendTelegram("sendMessage", {
          chat_id: chatId,
          text: messageText,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🎲 Acak Teks Baru", callback_data: repeatAction }],
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
