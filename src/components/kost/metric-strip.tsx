import { computeStats, distinctFloors, type Room } from "@/lib/kost-data";
import { cn } from "@/lib/utils";

interface MetricStripProps {
  rooms: Room[];
  /** Label unit mengikuti tipe properti (Kamar / Pintu / Unit) */
  unit?: string;
}

/**
 * Skin solid kartu metrik (legenda indikator warna di atas Denah Kamar) —
 * palet status TEGAS (bold) yang SAMA dengan kartu denah (STATUS_SKIN) dan
 * SAMA di semua tema, light maupun dark (tanpa pastel, tanpa variabel tema):
 *  total → aksen tema · terisi → hijau emerald tegas ·
 *  jatuh tempo → KUNING tegas (teks hitam pekat) ·
 *  menunggak → MERAH tegas (teks putih) · kosong → abu-abu netral.
 * (Statis agar ter-generate Tailwind JIT.)
 */
const STAT_SKIN = {
  total: {
    card: "bg-[var(--ik-accent)] border-transparent",
    fg: "[color:var(--ik-accent-fg)]",
    dot: "bg-[var(--ik-accent-fg)]",
  },
  paid: {
    card: "bg-emerald-600 border-emerald-700",
    fg: "text-white",
    dot: "bg-white/85",
  },
  due: {
    card: "bg-amber-500 border-amber-600",
    fg: "text-slate-950",
    dot: "bg-slate-950/70",
  },
  late: {
    card: "bg-red-600 border-red-700",
    fg: "text-white",
    dot: "bg-white/85",
  },
  vacant: {
    card: "bg-zinc-200 border-zinc-400",
    // slate-800 (bukan zinc-800): aman dari remap teks zinc tema dark
    fg: "text-slate-800",
    dot: "bg-slate-500/70",
  },
} as const;

type StatSkinKey = keyof typeof STAT_SKIN;

/** Returns value + unit + sub rendered as one compact SOLID stat card */
function StatCard({
  skinKey,
  label,
  value,
  unit,
  sub,
  valueClass,
}: {
  skinKey: StatSkinKey;
  label: string;
  value: string;
  unit: string;
  sub: string;
  valueClass?: string;
}) {
  const skin = STAT_SKIN[skinKey];
  return (
    <div className={cn("ik-card rounded-lg border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.08)]", skin.card)}>
      <div className="flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full opacity-70", skin.dot)} aria-hidden="true" />
        <span className={cn("ik-num truncate text-xs sm:text-sm font-bold", skin.fg)}>{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={cn("ik-num text-2xl sm:text-3xl font-black leading-none tracking-tight tabular-nums", skin.fg, valueClass)}>
          {value}
        </span>
        <span className={cn("ik-num text-xs sm:text-sm font-bold", skin.fg)}>{unit}</span>
      </div>
      <p className={cn("mt-1.5 text-xs font-medium leading-snug", skin.fg)}>{sub}</p>
    </div>
  );
}

export function MetricStrip({ rooms, unit = "Kamar" }: MetricStripProps) {
  const s = computeStats(rooms);
  const potential = rooms
    .filter((r) => r.status === "kosong")
    .reduce((acc, r) => acc + r.price, 0);
  const floorCount = distinctFloors(rooms).length;
  const unitLower = unit.toLowerCase();

  return (
    <section
      aria-label="Ringkasan statistik"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
    >
      <StatCard
        skinKey="total"
        label={`Total ${unit}`}
        value={String(s.total)}
        unit={unit}
        sub={s.total > 0 ? `${floorCount} lantai · ${s.total} ${unitLower} terdata` : "Belum ada kamar terdata"}
      />
      <StatCard
        skinKey="paid"
        label="Terisi / Okupansi"
        value={String(s.occupied)}
        unit="Terisi"
        sub={s.total > 0 ? `Okupansi ${s.occupancyPct.replace(".", ",")}% dari total` : "Tambahkan kamar untuk memulai"}
      />
      <StatCard
        skinKey="due"
        label="Jatuh Tempo"
        value={String(s.dueSoon)}
        unit={unit}
        sub={s.dueSoon > 0 ? "Tagihan mendekati jatuh tempo (H-3…H+0)" : "Tidak ada tagihan mendekat"}
      />
      <StatCard
        skinKey="late"
        label="Menunggak"
        value={String(s.overdue)}
        unit={unit}
        sub={s.overdue > 0 ? "Tagihan sudah lewat jatuh tempo" : "Tidak ada tunggakan"}
      />
      <StatCard
        skinKey="vacant"
        label={`${unit} Kosong`}
        value={String(s.empty)}
        unit={unit}
        sub={`Potensi ±Rp${(potential / 1_000_000).toFixed(1).replace(".", ",")} jt / bln`}
      />
    </section>
  );
}
