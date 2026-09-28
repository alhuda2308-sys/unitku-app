import { computeStats, distinctFloors, type Room } from "@/lib/kost-data";
import { cn } from "@/lib/utils";

interface MetricStripProps {
  rooms: Room[];
  /** Label unit mengikuti tipe properti (Kamar / Pintu / Unit) */
  unit?: string;
}

/**
 * Skin solid kartu metrik — blok warna penuh mengikuti tema aktif:
 *  total → aksen tema · terisi → blok lunas · menunggak → blok peringatan ·
 *  kosong → blok netral. (Statis agar ter-generate Tailwind JIT.)
 */
const STAT_SKIN = {
  total: {
    card: "bg-[var(--ik-accent)] border-transparent",
    fg: "[color:var(--ik-accent-fg)]",
    dot: "bg-[var(--ik-accent-fg)]",
  },
  paid: {
    card: "bg-[var(--ik-card-paid-bg)] border-[var(--ik-card-paid-line)]",
    fg: "[color:var(--ik-card-paid-fg)]",
    dot: "bg-[var(--ik-card-paid-fg)]",
  },
  late: {
    card: "bg-[var(--ik-card-late-bg)] border-[var(--ik-card-late-line)]",
    fg: "[color:var(--ik-card-late-fg)]",
    dot: "bg-[var(--ik-card-late-fg)]",
  },
  vacant: {
    card: "bg-[var(--ik-card-vacant-bg)] border-[var(--ik-card-vacant-line)]",
    fg: "[color:var(--ik-card-vacant-fg)]",
    dot: "bg-[var(--ik-card-vacant-fg)]",
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
    <section aria-label="Ringkasan statistik" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
        skinKey="late"
        label="Menunggak / Jatuh Tempo"
        value={String(s.dueSoon + s.overdue)}
        unit={unit}
        sub={`${s.overdue} menunggak · ${s.dueSoon} jatuh tempo`}
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
