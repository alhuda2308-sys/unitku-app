import { cn } from "@/lib/utils";
import { invoiceBadgeLabel, INVOICE_STATUS_META, type Invoice } from "@/lib/kost-invoices";

/** Soft status pill for invoice rows: Lunas / Menunggak H+2 / H-3 / Verifikasi */
export function InvoiceStatusBadge({ invoice, className }: { invoice: Invoice; className?: string }) {
  const meta = INVOICE_STATUS_META[invoice.status];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 text-xs font-semibold leading-none tabular-nums whitespace-nowrap",
        meta.pill,
        className
      )}
    >
      {invoiceBadgeLabel(invoice)}
    </span>
  );
}
