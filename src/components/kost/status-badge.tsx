import { cn } from "@/lib/utils";
import { invoiceBadgeText, STATUS_META, type Room, type RoomStatus } from "@/lib/kost-data";

/**
 * Solid skin per status — latar kartu TERISI WARNA BLOK PENUH (bukan putih
 * bergaris). Semua kelas statis (Tailwind JIT tidak bisa membuat kelas dinamis)
 * dan memakai variabel `[data-ik-theme]` sehingga otomatis ikut 5 palet tema.
 */
export const STATUS_SKIN: Record<
  RoomStatus,
  { card: string; chip: string; kebab: string; pill: string }
> = {
  lunas: {
    card: "bg-[var(--ik-card-paid-bg)] border-[var(--ik-card-paid-line)] [color:var(--ik-card-paid-fg)]",
    chip: "border-[var(--ik-card-paid-line)] bg-white/50 [color:var(--ik-card-paid-fg)]",
    kebab: "[color:var(--ik-card-paid-muted)] hover:bg-white/60 hover:[color:var(--ik-card-paid-fg)] data-[state=open]:bg-white/60 data-[state=open]:[color:var(--ik-card-paid-fg)]",
    pill: "bg-[var(--ik-card-paid-pill-bg)] [color:var(--ik-card-paid-pill-fg)] border-transparent",
  },
  jatuhTempo: {
    card: "bg-[var(--ik-card-due-bg)] border-[var(--ik-card-due-line)] [color:var(--ik-card-due-fg)]",
    chip: "border-[var(--ik-card-due-line)] bg-white/50 [color:var(--ik-card-due-fg)]",
    kebab: "[color:var(--ik-card-due-muted)] hover:bg-white/60 hover:[color:var(--ik-card-due-fg)] data-[state=open]:bg-white/60 data-[state=open]:[color:var(--ik-card-due-fg)]",
    pill: "bg-[var(--ik-card-due-pill-bg)] [color:var(--ik-card-due-pill-fg)] border-transparent",
  },
  menunggak: {
    card: "bg-[var(--ik-card-late-bg)] border-[var(--ik-card-late-line)] [color:var(--ik-card-late-fg)]",
    chip: "border-[var(--ik-card-late-line)] bg-white/25 [color:var(--ik-card-late-fg)]",
    kebab: "[color:var(--ik-card-late-muted)] hover:bg-white/25 hover:[color:var(--ik-card-late-fg)] data-[state=open]:bg-white/25 data-[state=open]:[color:var(--ik-card-late-fg)]",
    pill: "bg-[var(--ik-card-late-pill-bg)] [color:var(--ik-card-late-pill-fg)] border-transparent",
  },
  kosong: {
    card: "bg-[var(--ik-card-vacant-bg)] border-[var(--ik-card-vacant-line)] [color:var(--ik-card-vacant-fg)]",
    chip: "border-[var(--ik-card-vacant-line)] bg-white/60 [color:var(--ik-card-vacant-fg)]",
    kebab: "[color:var(--ik-card-vacant-muted)] hover:bg-white/70 hover:[color:var(--ik-card-vacant-fg)] data-[state=open]:bg-white/70 data-[state=open]:[color:var(--ik-card-vacant-fg)]",
    pill: "bg-[var(--ik-card-vacant-pill-bg)] [color:var(--ik-card-vacant-pill-fg)] border-transparent",
  },
};

/** Tiny status pill used on room cards & drawer: "Lunas" / "H-2" / "H+2" / "Kosong".
 *  `solid` → pill blok kontras penuh mengikuti tema aktif (untuk kartu solid). */
export function StatusBadge({
  room,
  className,
  solid = false,
}: {
  room: Room;
  className?: string;
  solid?: boolean;
}) {
  const meta = STATUS_META[room.status];
  return (
    <span
      data-status={room.status}
      className={cn(
        // ik-pill: hook cap karet tema Retro Ledger · ik-num: monospace tema karakter
        // min-w-0 + child truncate: pill boleh menyusut (shrink diatur pemanggil
        // via className) tanpa meluber di kartu sempit — nomor kamar tetap utuh.
        "ik-pill ik-num inline-flex h-6 min-w-0 max-w-full items-center rounded-full border px-2.5 text-xs font-bold tracking-wide leading-none tabular-nums whitespace-nowrap",
        solid ? STATUS_SKIN[room.status].pill : meta.pill,
        className
      )}
    >
      <span className="min-w-0 truncate">{invoiceBadgeText(room)}</span>
    </span>
  );
}
