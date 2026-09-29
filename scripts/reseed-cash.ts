// One-off: refresh tabel cash_entries ke seed Task 49
// (7 kategori spesifikasi + sumber dana). Jalankan: bun scripts/reseed-cash.ts
import { PrismaClient } from "@prisma/client";
import { CASH_ENTRIES, dateSortFromLabel } from "../src/lib/kost-cashflow";
import { parseDateLabel } from "../src/lib/kost-data";

const db = new PrismaClient();

async function main() {
  await db.cashEntry.deleteMany({});
  await db.cashEntry.createMany({
    data: CASH_ENTRIES.map((e) => ({
      id: e.id,
      type: e.type,
      category: e.category,
      description: e.description,
      amount: e.amount,
      source: e.source ?? "Kas Tunai",
      entryDate: parseDateLabel(e.dateLabel),
      dateLabel: e.dateLabel,
      dateSort: e.dateSort ?? dateSortFromLabel(e.dateLabel),
      attachment: e.attachment ?? null,
    })),
  });
  const count = await db.cashEntry.count();
  const sources = await db.cashEntry.groupBy({ by: ["source"], _count: true });
  const cats = await db.cashEntry.findMany({
    where: { type: "keluar" },
    select: { category: true },
    distinct: ["category"],
  });
  console.log(`cash_entries: ${count} rows`);
  console.log("sources:", sources.map((s) => `${s.source}×${s._count}`).join(", "));
  console.log("expense categories:", cats.map((c) => c.category).join(" | "));
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
