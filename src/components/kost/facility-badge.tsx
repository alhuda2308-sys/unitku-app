import { Check } from "lucide-react";

/** Badge pill fasilitas — dipakai di Detail Kamar (RoomDrawer), Portal Penyewa,
 *  dan pratinjau fasilitas. Border solid + ikon centang jelas; membungkus rapi
 *  (flex-wrap gap-2 di induk) tanpa melebar ke samping di ponsel. */
export function FacilityBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-6 max-w-full items-center gap-1 rounded-full border border-border bg-white px-2 text-[12.5px] font-medium text-zinc-700">
      <Check className="size-3 shrink-0 text-emerald-600" strokeWidth={2.25} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}
