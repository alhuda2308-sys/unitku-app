import { cn } from "@/lib/utils";
import {
  invoiceBadgeText,
  STATUS_META,
  STATUS_SKIN,
  type Room,
} from "@/lib/kost-data";

/** Skin kartu per status kini didefinisikan di kost-data (sumber tunggal,
 *  dipakai juga pratinjau Tema via STATUS_ROOM_TONE) — re-export agar import
 *  lama dari "./status-badge" tetap bekerja. */
export { STATUS_SKIN };

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
