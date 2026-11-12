// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Telegram Webhook MITRA: Generator Materi Promosi (PUBLIK)
//
// POST /api/telegram/mitra-promo-bot
//   Bot Telegram untuk seluruh MITRA UnitKu — bebas akses, tanpa whitelist:
//   siapa pun yang menekan /start pada bot ini bisa mengambil draf promosi
//   siap pakai untuk menawarkan UnitKu ke pemilik kost/kontrakan.
//
//   Menu inline keyboard (2 kategori generator copywriting + 1 fitur lama):
//     🏠 Iklan Produk (Tawarkan ke Pemilik Kost)  → getRandomAffiliateCopy()
//     🤝 Ajak Mitra (Tawarkan Peluang Komisi 150rb) → getRandomRecruitmentCopy()
//       (TOPIC-BASED POOL: semua paragraf diambil dari TEMA YANG SAMA di
//        affiliateCopies.ts — COPY_THEMES untuk produk, RECRUITMENT_THEMES
//        untuk rekrutmen — supaya alur kalimat selalu nyambung)
//     💬 Template Chat WhatsApp      → salah satu WA_TEMPLATES siap kirim
//     🔙 Menu Utama                  → kembali ke pilihan kategori
//
//   Tombol inline mengikuti kategori aktif:
//     - Produk   : [🎲 Acak Teks Produk Lain] [🔄 Ganti ke Teks Ajak Mitra] [🔙 Menu Utama]
//     - Ajak Mitra: [🎲 Acak Teks Mitra Lain] [🔄 Ganti ke Teks Produk]     [🔙 Menu Utama]
//     - WhatsApp : [🎲 Acak Teks Baru] [🔙 Menu Utama]
//
//   Mitra tinggal tap ikon COPY di pojok kanan atas kotak pesan (preformatted
//   code block <pre><code class="language-copy"> — memicu tombol salin bawaan
//   Telegram), lalu mengganti placeholder [MASUKKAN_LINK_REFERRAL_ANDA]
//   dengan link referral sendiri.
//
//   Konfigurasi:
//     - Env: TELEGRAM_PARTNER_BOT_TOKEN (utama — token @unitku_partner_bot);
//       fallback TELEGRAM_MITRA_BOT_TOKEN (kompatibilitas lama), lalu
//       TELEGRAM_BOT_TOKEN. TANPA token hardcode di kode — bila semua env
//       kosong, webhook menolak diam (log error, tidak crash).
//     - Set webhook pada bot @unitku_partner_bot (BotFather /setwebhook):
//       https://unitku.my.id/api/telegram/mitra-promo-bot
//
// Catatan: /api/* dilewati middleware (lihat src/middleware.ts). Data materi
// dipisah dari route: bank copywriting per-tema di src/data/affiliateCopies.ts,
// template WA ke pemilik kost tetap di src/data/mitraPromoData.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getRandomAffiliateCopy, getRandomRecruitmentCopy } from "@/data/affiliateCopies";
import { WA_TEMPLATES } from "@/data/mitraPromoData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Token bot — WAJIB dari environment variable, tanpa hardcode di kode.
 *  Urutan: var khusus partner → var lama (kompatibilitas) → var umum. */
const BOT_TOKEN = (
  process.env.TELEGRAM_PARTNER_BOT_TOKEN ||
  process.env.TELEGRAM_MITRA_BOT_TOKEN ||
  process.env.TELEGRAM_BOT_TOKEN ||
  ""
).trim();

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

/** Keyboard menu utama — dipakai /start dan tombol 🔙 Menu Utama. */
function buildMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🏠 Iklan Produk (Tawarkan ke Pemilik Kost)", callback_data: "mitra_promo" }],
      [{ text: "🤝 Ajak Mitra (Tawarkan Peluang Komisi 150rb)", callback_data: "mitra_rekrut" }],
      [{ text: "💬 Template Chat WhatsApp ke Pemilik Kost", callback_data: "mitra_wa" }],
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

export async function POST(req: NextRequest) {
  try {
    if (!BOT_TOKEN) {
      console.error(
        "[mitra-promo-bot] Token bot belum diatur — set TELEGRAM_PARTNER_BOT_TOKEN (atau TELEGRAM_BOT_TOKEN) di environment."
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

    // Handle command /start (Publik, tanpa whitelist)
    if (isMessage && body.message.text === "/start") {
      await sendTelegram("sendMessage", {
        chat_id: chatId,
        text: "👋 <b>Selamat Datang di Generator Materi Promosi Mitra UnitKu!</b>\n\nPilih kategori materi: 🏠 iklan produk untuk ditawarkan ke pemilik kost, atau 🤝 ajakan kemitraan untuk merekrut mitra baru. Klik tombol di bawah:",
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
          text: "⚡ <b>Pilih Kategori Materi:</b>",
          parse_mode: "HTML",
          reply_markup: buildMainMenuKeyboard(),
        });
        return NextResponse.json({ ok: true });
      }

      // Konten + tombol inline mengikuti kategori yang sedang aktif
      let content = "";
      let replyMarkup: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } | null = null;

      if (data === "mitra_promo") {
        content = getRandomAffiliateCopy();
        replyMarkup = {
          inline_keyboard: [
            [{ text: "🎲 Acak Teks Produk Lain", callback_data: "mitra_promo" }],
            [{ text: "🔄 Ganti ke Teks Ajak Mitra", callback_data: "mitra_rekrut" }],
            [{ text: "🔙 Menu Utama", callback_data: "menu_main" }],
          ],
        };
      } else if (data === "mitra_rekrut") {
        content = getRandomRecruitmentCopy();
        replyMarkup = {
          inline_keyboard: [
            [{ text: "🎲 Acak Teks Mitra Lain", callback_data: "mitra_rekrut" }],
            [{ text: "🔄 Ganti ke Teks Produk", callback_data: "mitra_promo" }],
            [{ text: "🔙 Menu Utama", callback_data: "menu_main" }],
          ],
        };
      } else if (data === "mitra_wa") {
        content = getRandom(WA_TEMPLATES);
        replyMarkup = {
          inline_keyboard: [
            [{ text: "🎲 Acak Teks Baru", callback_data: "mitra_wa" }],
            [{ text: "🔙 Menu Utama", callback_data: "menu_main" }],
          ],
        };
      }

      if (content && replyMarkup) {
        const messageText = `💡 <b>Tap kotak di bawah untuk menyalin, lalu ganti [MASUKKAN_LINK_REFERRAL_ANDA] dengan link milik Anda:</b>\n\n<pre><code class="language-copy">${escapeHtml(content)}</code></pre>`;

        await sendTelegram("sendMessage", {
          chat_id: chatId,
          text: messageText,
          parse_mode: "HTML",
          reply_markup: replyMarkup,
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
