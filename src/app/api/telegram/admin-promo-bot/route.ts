// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Telegram Webhook Admin: Generator Stok Konten Iklan Kemitraan
//
// POST /api/telegram/admin-promo-bot
//   Bot Telegram internal ADMIN ONLY untuk generate bahan promosi program
//   afiliasi secara instan (acak modular: hook + konteks + value + CTA).
//
//   Menu inline keyboard:
//     🎲 Acak Status FB / Threads   → gabungan HOOKS × CONTEXTS × VALUES × CTAS
//     📩 Template Balasan Inbox/DM  → salah satu DM_TEMPLATES siap copy-paste
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
// chat di handler inilah satu-satunya gerbang akses bot ini.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOT_TOKEN = process.env.TELEGRAM_ADMIN_BOT_TOKEN || "9293776042:AAHjcDNIdzkvi0Hl5In7iKk9uiH9W1YgWWU";
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

const HOOKS = [
  "Punya kenalan atau tetangga juragan kost/kontrakan? Jangan dianggurin.",
  "Cari tambahan cuan modal jempol doang sambil rebahan di rumah?",
  "Jualan barang fisik ribet mikir packing & ongkir? Mending lirik yang ini.",
  "Lagi nemu peluang sampingan gurih yang pasarnya gede banget tapi jarang digarap.",
  "Daripada scroll medsos seharian nggak dapet apa-apa, mending sebar link produk digital ini.",
  "Sebuah cara dapet Rp150.000 berkali-kali cuma dari orang-orang di sekitar kita.",
  "Kalau di sekitarmu banyak rumah kost atau kontrakan, ini ladang cuan empuk."
];

const CONTEXTS = [
  "Ada software manajemen kost lokal yang bayarnya cuma sekali seumur hidup (bebas biaya bulanan).",
  "Produk digital manajemen kosan & tagihan WhatsApp otomatis yang lagi banyak dicari pemilik kontrakan.",
  "Sistem pencatatan kamar dan kuitansi otomatis buat juragan kost biar hidup mereka tenang.",
  "Aplikasi pengelola kost tanpa potongan kamar atau tagihan langganan yang bikin pusing.",
  "Solusi simpel buat rekap sewa kost yang gampang banget diterima sama pemilik properti sekitar.",
  "Platform manajemen kosan praktis yang sekali beli langsung aktif selamanya."
];

const VALUES = [
  "💰 Komisinya flat Rp150.000 per closing langsung cair ke rekening/e-wallet.",
  "💰 Sekali ada 1 kenalan yang ambil lewat linkmu, Rp150.000 langsung masuk kantong.",
  "💰 100% GRATIS tanpa modal. Laku 1 dapet 150rb, tembus 10 dapet 1,5 juta lumayan banget.",
  "💰 Komisi bersih Rp150.000 per transaksi, ada dashboard mandiri buat pantau klik & komisi.",
  "💰 Nggak perlu repot handle teknis atau CS, sistem yang urus semuanya dari A sampai Z.",
  "💰 Cuma modal share link referral pribadimu, komisi flat Rp150.000 per lisensi."
];

const CTAS = [
  "Yang mau link daftarnya, komen 'MAU' di bawah ya, nanti saya kirim infonya via inbox.",
  "Mumpung pendaftarannya masih gratis, yang minat langsung komen 'MAU' di bawah!",
  "Mau ikutan coba? Komen 'MINAT' nanti saya bisikin link dan detailnya langsung.",
  "Slot mitranya masih terbuka gratis. Komen 'MAU' sekarang biar langsung saya DM.",
  "Yang mau coba ambil peluang ini, tinggalkan komen di bawah ya!"
];

const DM_TEMPLATES = [
  `Halo kak! Makasih udah respon postingan soal kemitraan produk digital tadi ya.\n\nSingkatnya: Ini software manajemen kost (tagihan WA otomatis, no biaya bulanan). Komisi kakak Rp150.000 bersih per closing. Pendaftaran 100% gratis tanpa modal.\n\nAmbil link referral & akses dashboard di sini ya kak:\n👉 https://unitku.my.id/affiliate`,
  `Siap kak! Info detail kemitraan yang tadi:\nProduknya aplikasi kelola kosan sekali bayar seumur hidup. Cukup bagikan link rekomendasi kakak ke kenalan pemilik kost. Tiap ada closing dapat Rp150.000 langsung.\n\nDaftar gratis & ambil link-nya di:\n👉 https://unitku.my.id/affiliate`,
  `Halo kak, untuk program partnernya simpel banget ya.\nNggak perlu jualan barang fisik atau packing barang. Cukup rekomendasikan sistem kost UnitKu, komisi flat Rp150.000 per lisensi.\n\nSilakan aktivasi akun mitra gratis di sini:\n👉 https://unitku.my.id/affiliate`
];

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePromo(): string {
  return `${getRandom(HOOKS)}\n\n${getRandom(CONTEXTS)}\n\n${getRandom(VALUES)}\n\n${getRandom(CTAS)}`;
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
        content = getRandom(DM_TEMPLATES);
        repeatAction = "gen_dm";
      }

      if (content) {
        // Tag pre code membuat teks bisa di-copy cukup 1x tap di Telegram
        const messageText = `Klik teks di bawah untuk langsung menyalin:\n\n<pre><code>${content}</code></pre>`;

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
