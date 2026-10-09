"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Modal "+ Tambah / Undang Admin Baru" (dan edit izin akses staf)
// Tiga seksi sesuai spec: Informasi Staf · Pilihan Peran (radio + keterangan)
// · Batasan Akses Properti (multi-select checkbox, wajib ≥ 1).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Building2, Check, ShieldCheck, UserPlus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ManagedProperty } from "@/lib/property-store";
import { isWaPhone, waDigits } from "@/lib/kost-data";
import { STAFF_ROLE_META, type StaffDraft, type StaffMember, type StaffRole } from "@/lib/staff-store";
import { cn } from "@/lib/utils";

interface StaffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Daftar seluruh cabang milik Owner untuk checkbox batasan akses */
  properties: ManagedProperty[];
  /** null = mode tambah, terisi = mode edit izin */
  initial: StaffMember | null;
  onSubmit: (draft: StaffDraft) => void;
}

const inputCls =
  "h-9 border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-zinc-900/5";

const sectionLabel = "text-[11px] font-bold uppercase tracking-wider text-zinc-400";

const ROLE_ICONS: Record<StaffRole, typeof ShieldCheck> = {
  admin: ShieldCheck,
  caretaker: Wrench,
};

export function StaffModal({ open, onOpenChange, properties, initial, onSubmit }: StaffModalProps) {
  const isEdit = initial !== null;

  const [name, setName] = useState(initial?.name ?? "");
  const [contact, setContact] = useState(initial?.contact ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>(initial?.role ?? "admin");
  const [selected, setSelected] = useState<string[]>(initial?.propertyIds ?? []);

  const nameOk = name.trim().length >= 3;
  const contactOk = contact.trim().length >= 5;
  const phoneOk = isWaPhone(phone);
  const passwordOk = isEdit || password.length >= 6;
  const propsOk = selected.length > 0;
  const valid = nameOk && contactOk && phoneOk && passwordOk && propsOk;

  const toggleProperty = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const submit = () => {
    if (!valid) return;
    onSubmit({
      name: name.trim(),
      contact: contact.trim(),
      phone: phone.trim(),
      role,
      propertyIds: selected,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 bg-white p-0 sm:max-w-[540px]">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-900">
            <UserPlus className="size-4 text-zinc-600" strokeWidth={2} aria-hidden="true" />
            {isEdit ? `Edit Izin Akses — ${initial.name}` : "Tambah / Undang Admin Baru"}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-zinc-500">
            {isEdit
              ? "Perbarui peran & batasan properti staf. Perubahan langsung berlaku pada sesi demo berikutnya."
              : "Buat akun staf dengan hak akses terbatas pada properti yang Anda tunjuk."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[62vh] space-y-5 overflow-y-auto bg-zinc-50 p-5 scrollbar-thin">
          {/* ── Informasi Staf ── */}
          <section className="space-y-3">
            <h4 className={sectionLabel}>Informasi Staf</h4>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="stf-nama" className="text-[12px] text-zinc-600">
                  Nama Lengkap <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="stf-nama"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="cth. Pak Yanto"
                  className={cn(inputCls, name.trim().length > 0 && !nameOk && "border-red-300")}
                  autoFocus
                />
                {name.trim().length > 0 && !nameOk && (
                  <p className="text-[11px] font-medium text-red-600">Nama minimal 3 karakter.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stf-kontak" className="text-[12px] text-zinc-600">
                  Nomor WhatsApp / Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="stf-kontak"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="cth. 0813-2468-1357 atau nama@email.com"
                  className={cn(inputCls, contact.trim().length > 0 && !contactOk && "border-red-300")}
                />
                {contact.trim().length > 0 && !contactOk && (
                  <p className="text-[11px] font-medium text-red-600">
                    Masukkan nomor WhatsApp atau email yang valid.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stf-wa" className="text-[12px] text-zinc-600">
                  Nomor WhatsApp Aktif <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="stf-wa"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="cth. 0813-2468-1357 atau +62 813-2468-1357"
                  className={cn(inputCls, "tabular-nums", phone.trim().length > 0 && !phoneOk && "border-red-300")}
                />
                {phone.trim().length > 0 && !phoneOk ? (
                  <p className="text-[11px] font-medium text-red-600">
                    Nomor tidak valid — gunakan format 0812-xxxx-xxxx atau +62 812-xxxx-xxxx.
                  </p>
                ) : (
                  <p className="text-[11px] text-zinc-400">
                    Wajib aktif — dipakai sebagai identitas pengirim tagihan
                    {phoneOk ? ` (wa.me/${waDigits(phone)})` : ""}.
                  </p>
                )}
              </div>
              {!isEdit && (
                <div className="space-y-1.5">
                  <Label htmlFor="stf-pass" className="text-[12px] text-zinc-600">
                    Password Sementara <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="stf-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter — diganti staf setelah login pertama"
                    className={cn(inputCls, password.length > 0 && !passwordOk && "border-red-300")}
                  />
                  {password.length > 0 && !passwordOk ? (
                    <p className="text-[11px] font-medium text-red-600">Password minimal 6 karakter.</p>
                  ) : (
                    <p className="text-[11px] text-zinc-400">
                      Bagikan via WhatsApp kepada staf — simulasi demo, tidak dikirim otomatis.
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── Pilihan Peran ── */}
          <section className="space-y-2.5">
            <h4 className={sectionLabel}>Pilihan Peran</h4>
            <div role="radiogroup" aria-label="Peran staf" className="space-y-2">
              {(Object.keys(STAFF_ROLE_META) as StaffRole[]).map((r) => {
                const Icon = ROLE_ICONS[r];
                const active = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setRole(r)}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
                      active
                        ? "border-zinc-900 bg-white ring-1 ring-zinc-900"
                        : "border-border bg-white hover:border-zinc-300 hover:bg-zinc-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md border",
                        active ? "border-zinc-900 bg-zinc-900 text-white" : "border-border bg-zinc-50 text-zinc-500"
                      )}
                    >
                      <Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-900">
                        {STAFF_ROLE_META[r].label}
                        {active && <Check className="size-3.5 text-zinc-900" strokeWidth={2.5} aria-hidden="true" />}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-4 text-zinc-500">
                        {STAFF_ROLE_META[r].description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Batasan Akses Properti ── */}
          <section className="space-y-2.5">
            <h4 className={sectionLabel}>Batasan Akses Properti</h4>
            <div className="space-y-1.5 rounded-lg border border-border bg-white p-2.5">
              {properties.map((p) => {
                const checked = selected.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-zinc-50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleProperty(p.id)}
                      aria-label={`Akses ${p.name}`}
                      className="size-4 border-zinc-300 data-[state=checked]:border-zinc-900 data-[state=checked]:bg-zinc-900 data-[state=checked]:text-white"
                    />
                    <span className="flex size-6 shrink-0 items-center justify-center rounded border border-border bg-zinc-50 text-zinc-500">
                      <Building2 className="size-3" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-zinc-800">{p.name}</span>
                      <span className="block truncate text-[11px] text-zinc-400">
                        {[p.kelurahan, p.city].filter(Boolean).join(" · ") || "Lokasi belum diisi"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="flex items-start gap-1.5 text-[11.5px] leading-4 text-zinc-500">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
              Staf ini HANYA akan memiliki akses ke properti yang dicentang — properti lain tidak
              muncul pada switcher akunnya.
            </p>
            {!propsOk && (
              <p className="text-[11px] font-medium text-red-600">
                Centang minimal satu properti untuk akun ini.
              </p>
            )}
          </section>
        </div>

        <DialogFooter className="border-t border-border bg-white px-5 py-4">
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 border-zinc-200 bg-white px-3.5 text-[13px] font-medium text-zinc-700 shadow-none hover:bg-zinc-100"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={!valid}
              onClick={submit}
              className="h-9 bg-zinc-900 px-3.5 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800 disabled:opacity-50"
            >
              <Check className="size-3.5" strokeWidth={2.25} />
              {isEdit ? "Simpan Perubahan" : "Simpan & Buat Akun"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
