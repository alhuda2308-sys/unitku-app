// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Komplain & Pemeliharaan dataset (Phase 3 + owner ticket creation)
// Maintenance / ticketing module. Snapshot "today": 26 Sep 2026.
//
// Counts reconcile exactly with the Phase 3 spec:
//   Tiket Aktif (Menunggu)   : 2   → #TKT-041, #TKT-040
//   Sedang Dikerjakan        : 1   → #TKT-039
//   Selesai Bulan Ini (Sep)  : 8   → #TKT-031 … #TKT-038
//
// Integration seam: swap TICKETS for `GET /api/tickets` and the mutation
// callbacks for `PATCH /api/tickets/:id` + `POST /api/tickets` (webhooks).
// ─────────────────────────────────────────────────────────────────────────────

export type TicketStatus = "menunggu" | "dikerjakan" | "selesai";

export type TicketCategory =
  | "AC"
  | "Kelistrikan/Lampu"
  | "Sanitasi/Air/Plumbing"
  | "Kebocoran/Atap"
  | "Kunci/Pintu"
  | "Lainnya";

/** Where the ticket originates: tenant report or owner routine maintenance */
export type TicketSource = "penyewa" | "fasilitas";

export type TicketUrgensi = "rendah" | "sedang" | "darurat";

export interface TicketContact {
  name: string;
  phone: string;
}

export interface Ticket {
  id: string; // "#TKT-041"
  /** Kunci internal kamar — TIDAK untuk ditampilkan (lihat roomNomor) */
  roomId?: string;
  /** Nomor kamar murni (tanpa suffix "(n)") utk label "Kamar …" — fallback roomId */
  roomNomor?: string;
  /** Common-area location for facility maintenance tickets ("Area Parkir", …) */
  lokasi?: string;
  sumber: TicketSource;
  /** Short complaint title shown in the table */
  judul: string;
  urgensi: TicketUrgensi;
  reporterName: string; // penyewa pelapor / "Pengelola" for facility tickets
  reporterPhone: string;
  kategori: TicketCategory;
  deskripsi: string;
  /** Attachment URLs — static assets under /tickets or blob: URLs from uploads */
  photos: string[];
  status: TicketStatus;
  /** "Hari ini, 09:15 WIB" / "Kemarin, 17:40 WIB" / "24 Sep, 20:11 WIB" */
  reportedLabel: string;
  /** Monotonic sort key (newest first). New tickets use MAX + 1. */
  reportedSort: number;
  teknisi?: TicketContact;
  /** Filled when status === "selesai" */
  selesaiLabel?: string;
}

export const TICKET_STATUSES: TicketStatus[] = ["menunggu", "dikerjakan", "selesai"];

export const TICKET_CATEGORIES: TicketCategory[] = [
  "AC",
  "Kelistrikan/Lampu",
  "Sanitasi/Air/Plumbing",
  "Kebocoran/Atap",
  "Kunci/Pintu",
  "Lainnya",
];

/** Non-room locations for routine maintenance / public facility tickets */
export const COMMON_AREAS: string[] = [
  "Area Parkir",
  "Dapur Bersama",
  "Pompa Air",
  "Kamar Mandi Umum",
  "Taman & Halaman",
  "Koridor / Lorong",
];

// ── Status metadata ──────────────────────────────────────────────────────────

export const TICKET_STATUS_META: Record<
  TicketStatus,
  { label: string; pill: string; dot: string }
> = {
  menunggu: {
    label: "Perlu Ditangani",
    pill: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  dikerjakan: {
    label: "Dalam Pengerjaan",
    pill: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
  },
  selesai: {
    label: "Selesai",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
};

// ── Urgensi metadata ─────────────────────────────────────────────────────────

export const TICKET_URGENSI_META: Record<
  TicketUrgensi,
  { label: string; pill: string; dot: string }
> = {
  rendah: {
    label: "Rendah",
    pill: "bg-zinc-50 text-zinc-600 border-zinc-200",
    dot: "bg-zinc-400",
  },
  sedang: {
    label: "Sedang",
    pill: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  darurat: {
    label: "Darurat",
    pill: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
};

export const TICKET_URGENSI: TicketUrgensi[] = ["rendah", "sedang", "darurat"];

/** "Kamar 102" / "Area Parkir" — table & toasts use this for both sources */
export function ticketSubject(
  ticket: Pick<Ticket, "sumber" | "roomId" | "roomNomor" | "lokasi">,
): string {
  return ticket.sumber === "fasilitas"
    ? (ticket.lokasi ?? "Fasilitas Umum")
    : `Kamar ${ticket.roomNomor || ticket.roomId || "—"}`;
}

// ── On-call teknisi (used when a ticket has no assigned teknisi) ─────────────

export const ONCALL_TEKNISI: TicketContact = {
  name: "Pak Yanto (on-call)",
  phone: "+62 813-2200-1177",
};

/** Owner identity used as reporter for facility/routine tickets */
export const OWNER_REPORTER: TicketContact = {
  name: "Pengelola",
  phone: "+62 811-2233-4455",
};

// ── Dataset ──────────────────────────────────────────────────────────────────
// Newest first. Kamar 102 = Dimas Ardi (consistent with Phase 1 & 2 mock data).

export const TICKETS: Ticket[] = [
  {
    id: "#TKT-041",
    roomId: "102",
    sumber: "penyewa",
    judul: "AC tidak dingin & menetes",
    urgensi: "sedang",
    reporterName: "Dimas Ardi",
    reporterPhone: "+62 812-3456-7890",
    kategori: "AC",
    deskripsi: "AC kurang dingin sejak semalam, ada tetesan air dari unit indoor.",
    photos: ["/tickets/ac.png"],
    status: "menunggu",
    reportedLabel: "Hari ini, 09:15 WIB",
    reportedSort: 202609260915,
  },
  {
    id: "#TKT-040",
    roomId: "104",
    sumber: "penyewa",
    judul: "Plafon kamar rembes",
    urgensi: "darurat",
    reporterName: "Dewi Lestari",
    reporterPhone: "+62 812-9902-3367",
    kategori: "Kebocoran/Atap",
    deskripsi: "Plafon kamar memerah, air menetes dari sudut dekat jendela.",
    photos: ["/tickets/bocor.png"],
    status: "menunggu",
    reportedLabel: "Hari ini, 08:02 WIB",
    reportedSort: 202609260802,
  },
  {
    id: "#TKT-039",
    roomId: "108",
    sumber: "penyewa",
    judul: "Stop kontak mati & hangat",
    urgensi: "darurat",
    reporterName: "Doni Kusnadi",
    reporterPhone: "+62 856-4410-8823",
    kategori: "Kelistrikan/Lampu",
    deskripsi: "Stop kontak kamar mati total, colokan longgar dan hangat disentuh.",
    photos: ["/tickets/socket.png"],
    status: "dikerjakan",
    reportedLabel: "Kemarin, 17:40 WIB",
    reportedSort: 202609251740,
    teknisi: { name: "Pak Yanto", phone: "+62 813-2200-1177" },
  },
  {
    id: "#TKT-038",
    roomId: "109",
    sumber: "penyewa",
    judul: "Kran shower tidak bisa ditutup",
    urgensi: "sedang",
    reporterName: "Putri Handayani",
    reporterPhone: "+62 813-2299-4405",
    kategori: "Sanitasi/Air/Plumbing",
    deskripsi: "Kran shower tidak bisa ditutup, air terus mengalir pelan.",
    photos: ["/tickets/kran.png"],
    status: "selesai",
    reportedLabel: "24 Sep, 20:11 WIB",
    reportedSort: 202609242011,
    teknisi: { name: "Pak Yanto", phone: "+62 813-2200-1177" },
    selesaiLabel: "Selesai 25 Sep, 10:30 WIB",
  },
  {
    id: "#TKT-037",
    roomId: "103",
    sumber: "penyewa",
    judul: "Closet mampet",
    urgensi: "sedang",
    reporterName: "Ahmad Fauzi",
    reporterPhone: "+62 813-8821-5502",
    kategori: "Sanitasi/Air/Plumbing",
    deskripsi: "Closet duduk mampet, pembilasan lambat sekali.",
    photos: [],
    status: "selesai",
    reportedLabel: "24 Sep, 07:48 WIB",
    reportedSort: 202609240748,
    teknisi: { name: "Pak Yanto", phone: "+62 813-2200-1177" },
    selesaiLabel: "Selesai 24 Sep, 15:05 WIB",
  },
  {
    id: "#TKT-036",
    roomId: "110",
    sumber: "penyewa",
    judul: "Lampu kamar berkedip",
    urgensi: "rendah",
    reporterName: "Agus Setiawan",
    reporterPhone: "+62 812-3358-9907",
    kategori: "Kelistrikan/Lampu",
    deskripsi: "Lampu kamar berkedip terus, sudah ganti bohlam tetap sama.",
    photos: [],
    status: "selesai",
    reportedLabel: "22 Sep, 19:05 WIB",
    reportedSort: 202609221905,
    teknisi: { name: "Servicing Jaya", phone: "+62 812-8899-4410" },
    selesaiLabel: "Selesai 23 Sep, 09:20 WIB",
  },
  {
    id: "#TKT-035",
    roomId: "101",
    sumber: "penyewa",
    judul: "Pintu kamar berderit",
    urgensi: "rendah",
    reporterName: "Budi Santoso",
    reporterPhone: "+62 812-1101-2210",
    kategori: "Kunci/Pintu",
    deskripsi: "Pintu kamar berderit parah, engsel perlu diberi minyak.",
    photos: [],
    status: "selesai",
    reportedLabel: "21 Sep, 08:30 WIB",
    reportedSort: 202609210830,
    teknisi: { name: "Pak Yanto", phone: "+62 813-2200-1177" },
    selesaiLabel: "Selesai 21 Sep, 11:45 WIB",
  },
  {
    id: "#TKT-034",
    roomId: "107",
    sumber: "penyewa",
    judul: "Remote AC tidak merespons",
    urgensi: "rendah",
    reporterName: "Maya Anggraini",
    reporterPhone: "+62 812-6675-0119",
    kategori: "AC",
    deskripsi: "Remote AC tidak merespons, unit hanya bisa dinyalakan manual.",
    photos: [],
    status: "selesai",
    reportedLabel: "19 Sep, 21:14 WIB",
    reportedSort: 202609192114,
    teknisi: { name: "Servicing Jaya", phone: "+62 812-8899-4410" },
    selesaiLabel: "Selesai 20 Sep, 14:00 WIB",
  },
  {
    id: "#TKT-033",
    roomId: "105",
    sumber: "penyewa",
    judul: "Pipa wastafel rembes",
    urgensi: "sedang",
    reporterName: "Rizky Pratama",
    reporterPhone: "+62 878-2210-6634",
    kategori: "Sanitasi/Air/Plumbing",
    deskripsi: "Pipa di bawah wastafel rembes saat keran dibuka penuh.",
    photos: [],
    status: "selesai",
    reportedLabel: "17 Sep, 13:22 WIB",
    reportedSort: 202609171322,
    teknisi: { name: "Pak Yanto", phone: "+62 813-2200-1177" },
    selesaiLabel: "Selesai 18 Sep, 08:50 WIB",
  },
  {
    id: "#TKT-032",
    roomId: "112",
    sumber: "penyewa",
    judul: "Kunci jendela macet",
    urgensi: "rendah",
    reporterName: "Fajar Nugroho",
    reporterPhone: "+62 878-9920-1145",
    kategori: "Kunci/Pintu",
    deskripsi: "Kunci jendela kamar macet, sulit dibuka dari dalam.",
    photos: [],
    status: "selesai",
    reportedLabel: "15 Sep, 09:40 WIB",
    reportedSort: 202609150940,
    teknisi: { name: "Pak Yanto", phone: "+62 813-2200-1177" },
    selesaiLabel: "Selesai 15 Sep, 16:10 WIB",
  },
  {
    id: "#TKT-031",
    roomId: "112",
    sumber: "penyewa",
    judul: "MCB sering trip",
    urgensi: "sedang",
    reporterName: "Fajar Nugroho",
    reporterPhone: "+62 878-9920-1145",
    kategori: "Kelistrikan/Lampu",
    deskripsi: "MCB sering trip saat memakai setrika bersamaan dengan charger.",
    photos: [],
    status: "selesai",
    reportedLabel: "12 Sep, 18:25 WIB",
    reportedSort: 202609121825,
    teknisi: { name: "Servicing Jaya", phone: "+62 812-8899-4410" },
    selesaiLabel: "Selesai 13 Sep, 10:15 WIB",
  },
];

// ── Derived stats ────────────────────────────────────────────────────────────

export interface TicketStats {
  /** Menunggu konfirmasi pengelola — spec metric "Tiket Aktif" */
  aktif: number;
  dikerjakan: number;
  selesaiBulanIni: number;
  byStatus: Record<TicketStatus, number>;
}

export function computeTicketStats(tickets: Ticket[]): TicketStats {
  return {
    aktif: tickets.filter((t) => t.status === "menunggu").length,
    dikerjakan: tickets.filter((t) => t.status === "dikerjakan").length,
    selesaiBulanIni: tickets.filter((t) => t.status === "selesai").length,
    byStatus: {
      menunggu: tickets.filter((t) => t.status === "menunggu").length,
      dikerjakan: tickets.filter((t) => t.status === "dikerjakan").length,
      selesai: tickets.filter((t) => t.status === "selesai").length,
    },
  };
}

/** Next sequential ticket id: max existing #TKT-N + 1 */
export function nextTicketId(tickets: Ticket[]): string {
  const max = tickets.reduce((acc, t) => {
    const n = Number(t.id.replace(/[^0-9]/g, ""));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `#TKT-${String(max + 1).padStart(3, "0")}`;
}

/** Newest-first sort used by the ticket table */
export function sortTicketsNewestFirst(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => b.reportedSort - a.reportedSort);
}

// ── Owner-side ticket creation (modal "+ Buat Tiket Komplain") ───────────────

export interface CreateTicketDraft {
  sumber: TicketSource;
  /** Kamar number — required when sumber === "penyewa" */
  roomId?: string;
  /** Common-area location — required when sumber === "fasilitas" */
  lokasi?: string;
  reporterName: string;
  reporterPhone: string;
  kategori: TicketCategory;
  judul: string;
  deskripsi: string;
  urgensi: TicketUrgensi;
  /** Blob URLs of locally uploaded photos (may be empty) */
  photos: string[];
}

/** Build a ready-to-insert Ticket from the create-modal draft */
export function ticketFromDraft(draft: CreateTicketDraft, tickets: Ticket[]): Ticket {
  const maxSort = tickets.reduce((m, t) => Math.max(m, t.reportedSort), 0);
  return {
    id: nextTicketId(tickets),
    sumber: draft.sumber,
    ...(draft.sumber === "penyewa"
      ? { roomId: draft.roomId }
      : { lokasi: draft.lokasi }),
    reporterName: draft.reporterName,
    reporterPhone: draft.reporterPhone,
    kategori: draft.kategori,
    judul: draft.judul,
    urgensi: draft.urgensi,
    deskripsi: draft.deskripsi,
    photos: draft.photos,
    status: "menunggu",
    reportedLabel: "Baru saja",
    reportedSort: maxSort + 1,
  };
}
