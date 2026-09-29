"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Kelola Kontak Teknisi — dialog CRUD kontak teknisi on-call.
//
// Dibuka dari pill "On-call: {nama}" pada panel Komplain & Pemeliharaan.
// Daftar teknisi tersimpan di Supabase (via /api/technicians); kontak dengan
// status on-call utama tampil di pill header & jadi pilihan default dispatch.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { Loader2, Pencil, Phone, Plus, Trash2, Wrench } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/kost-data";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  formatWaPhone,
  shortSpecialization,
  TECHNICIAN_CUSTOM_SPEC,
  TECHNICIAN_SPECIALIZATIONS,
  validateWaPhone,
  type TechnicianContact,
} from "@/lib/technician-data";

interface TechnicianContactsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technicians: TechnicianContact[];
  /** Ganti daftar di parent (panel) — sumber tunggal pill & tombol dispatch */
  onTechniciansChange: (list: TechnicianContact[]) => void;
}

/** Form kosong — dipakai untuk "Tambah" & reset setelah simpan */
const EMPTY_FORM = {
  name: "",
  specChoice: "",
  specCustom: "",
  phone: "",
  isPrimary: false,
};

export function TechnicianContactsModal({
  open,
  onOpenChange,
  technicians,
  onTechniciansChange,
}: TechnicianContactsModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  /** id kontak yang sedang diedit — null = mode tambah */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** konfirmasi hapus inline dua-langkah */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Modal dibuka / target edit berganti → reset form
  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setEditingId(null);
      setConfirmDeleteId(null);
    }
  }, [open]);

  const isCustomSpec = form.specChoice === TECHNICIAN_CUSTOM_SPEC;

  const startEdit = (tech: TechnicianContact) => {
    setEditingId(tech.id);
    setConfirmDeleteId(null);
    const preset = (TECHNICIAN_SPECIALIZATIONS as readonly string[]).includes(tech.specialization)
      ? tech.specialization
      : TECHNICIAN_CUSTOM_SPEC;
    setForm({
      name: tech.name,
      specChoice: preset,
      specCustom: preset === TECHNICIAN_CUSTOM_SPEC ? tech.specialization : "",
      phone: tech.phone,
      isPrimary: tech.isPrimary,
    });
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  /** Tarik ulang daftar kanonik dari server (isPrimary dipindah server-side) */
  const refresh = async () => {
    const res = await api.getTechnicians();
    onTechniciansChange(res.technicians);
  };

  const handleSubmit = async () => {
    const name = form.name.trim();
    const spec = (isCustomSpec ? form.specCustom : form.specChoice).trim();
    const phone = form.phone.trim();

    if (name.length < 2) {
      toast.error("Nama teknisi minimal 2 karakter.");
      return;
    }
    const phoneError = validateWaPhone(phone);
    if (phoneError) {
      toast.error(phoneError);
      return;
    }
    if (!spec) {
      toast.error("Spesialisasi wajib dipilih atau diisi.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const res = await api.updateTechnician(editingId, {
          name,
          phone,
          specialization: spec,
          isPrimary: form.isPrimary,
        });
        await refresh();
        toast.success(`Kontak ${res.technician.name} diperbarui`, {
          description: res.technician.isPrimary
            ? "Kini menjadi teknisi on-call utama."
            : undefined,
        });
      } else {
        const res = await api.createTechnician({
          name,
          phone,
          specialization: spec,
          isPrimary: form.isPrimary,
        });
        await refresh();
        toast.success(`Kontak ${res.technician.name} ditambahkan`, {
          description: res.technician.isPrimary
            ? "Jadi teknisi on-call utama — pill header ikut ter-update."
            : "Siap dipakai tombol Chat Teknisi.",
        });
      }
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan kontak teknisi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tech: TechnicianContact) => {
    setDeleting(true);
    try {
      await api.deleteTechnician(tech.id);
      // Server mempromosikan kontak terlama bila utama terhapus — tarik ulang
      await refresh();
      if (editingId === tech.id) resetForm();
      toast.success(`Kontak ${tech.name} dihapus`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus kontak teknisi.");
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const primaryCount = technicians.filter((t) => t.isPrimary).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border bg-zinc-50 px-5 py-4 pr-12">
          <DialogTitle className="text-[15px] font-bold text-zinc-900">
            Kelola Kontak Teknisi
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-[12.5px] leading-4 text-zinc-700">
            Daftar teknisi dipakai tombol &ldquo;Chat Teknisi&rdquo; dan pesan WhatsApp dispatch —
            tersimpan di cloud.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[62vh] overflow-y-auto scrollbar-thin">
          {/* ── Daftar teknisi tersimpan ─────────────────────────────────── */}
          <section aria-label="Daftar teknisi" className="px-5 py-4">
            <h3 className="text-[12.5px] font-semibold uppercase tracking-wide text-zinc-700">
              Teknisi Tersimpan
              <span className="ml-1.5 font-normal normal-case text-zinc-700">
                · {technicians.length}
              </span>
            </h3>

            {technicians.length === 0 ? (
              <div className="mt-3 rounded-md border border-dashed border-zinc-200 px-4 py-6 text-center">
                <Wrench className="mx-auto size-5 text-zinc-300" strokeWidth={1.5} aria-hidden="true" />
                <p className="mt-1.5 text-[13px] font-medium text-zinc-700">
                  Belum ada kontak teknisi
                </p>
                <p className="mt-0.5 text-xs leading-4 text-zinc-700">
                  Tambahkan kontak pertama lewat form di bawah.
                </p>
              </div>
            ) : (
              <ul role="list" className="mt-3 space-y-2">
                {technicians.map((tech) => (
                  <li
                    key={tech.id}
                    className={cn(
                      "rounded-lg border bg-white p-3",
                      tech.isPrimary ? "border-emerald-200 bg-emerald-50/40" : "border-border"
                    )}
                  >
                    {confirmDeleteId === tech.id ? (
                      /* Konfirmasi hapus inline */
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-[12.5px] font-medium text-zinc-800">
                          Hapus kontak <span className="font-bold">{tech.name}</span>?
                        </p>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={deleting}
                          >
                            Batal
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 gap-1 bg-red-600 px-2 text-xs text-white hover:bg-red-700"
                            onClick={() => handleDelete(tech)}
                            disabled={deleting}
                          >
                            {deleting && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
                            Ya, Hapus
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-700"
                            aria-hidden="true"
                          >
                            {initialsOf(tech.name)}
                          </span>
                          <span className="min-w-0 leading-tight">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-[13px] font-semibold text-zinc-900">
                                {tech.name}
                              </span>
                              {tech.isPrimary && (
                                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-px text-xs font-semibold leading-none text-emerald-700">
                                  On-call Utama
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-zinc-700">
                              <span>{tech.specialization}</span>
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Phone className="size-3" strokeWidth={1.75} aria-hidden="true" />
                                {formatWaPhone(tech.phone)}
                              </span>
                            </span>
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 border-zinc-200 bg-white px-0 text-zinc-700 shadow-none hover:bg-zinc-50"
                            onClick={() => startEdit(tech)}
                            aria-label={`Edit kontak ${tech.name}`}
                          >
                            <Pencil className="size-3.5" strokeWidth={1.75} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 border-zinc-200 bg-white px-0 text-zinc-700 shadow-none hover:bg-red-50 hover:text-red-700"
                            onClick={() => setConfirmDeleteId(tech.id)}
                            aria-label={`Hapus kontak ${tech.name}`}
                          >
                            <Trash2 className="size-3.5" strokeWidth={1.75} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Form tambah / edit ────────────────────────────────────────── */}
          <section
            aria-label={editingId ? "Edit kontak teknisi" : "Tambah kontak teknisi"}
            className="border-t border-border bg-zinc-50/60 px-5 py-4"
          >
            <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-zinc-700">
              {editingId ? (
                <>Edit Kontak Teknisi</>
              ) : (
                <>
                  <Plus className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  Tambah Kontak Teknisi
                </>
              )}
            </h3>

            <div className="mt-3 grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="tech-name" className="text-[12.5px] font-medium text-zinc-800">
                  Nama Teknisi
                </Label>
                <Input
                  id="tech-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Contoh: Pak Yanto"
                  className="h-9 border-border bg-white text-[13px]"
                  maxLength={60}
                  autoComplete="off"
                />
              </div>

              <div className="grid gap-1.5 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="tech-spec" className="text-[12.5px] font-medium text-zinc-800">
                    Spesialisasi
                  </Label>
                  <Select
                    value={form.specChoice}
                    onValueChange={(v) => setForm((f) => ({ ...f, specChoice: v }))}
                  >
                    <SelectTrigger
                      id="tech-spec"
                      className="h-9 border-border bg-white text-[13px] data-[placeholder]:text-zinc-500"
                    >
                      <SelectValue placeholder="Pilih keahlian…" />
                    </SelectTrigger>
                    <SelectContent>
                      {TECHNICIAN_SPECIALIZATIONS.map((s) => (
                        <SelectItem key={s} value={s} className="text-[13px]">
                          {s}
                        </SelectItem>
                      ))}
                      <SelectItem value={TECHNICIAN_CUSTOM_SPEC} className="text-[13px]">
                        Lainnya (tulis manual)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="tech-phone" className="text-[12.5px] font-medium text-zinc-800">
                    Nomor WhatsApp
                  </Label>
                  <Input
                    id="tech-phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="081322001177"
                    inputMode="tel"
                    autoComplete="off"
                    className="h-9 border-border bg-white text-[13px] tabular-nums"
                    maxLength={20}
                  />
                </div>
              </div>

              {isCustomSpec && (
                <div className="grid gap-1.5">
                  <Label htmlFor="tech-spec-custom" className="text-[12.5px] font-medium text-zinc-800">
                    Tulis Spesialisasi
                  </Label>
                  <Input
                    id="tech-spec-custom"
                    value={form.specCustom}
                    onChange={(e) => setForm((f) => ({ ...f, specCustom: e.target.value }))}
                    placeholder="Contoh: Kelistrikan & Genset"
                    className="h-9 border-border bg-white text-[13px]"
                    maxLength={60}
                    autoComplete="off"
                  />
                </div>
              )}

              <label
                htmlFor="tech-primary"
                className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-white p-3"
              >
                <Checkbox
                  id="tech-primary"
                  checked={form.isPrimary}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isPrimary: v === true }))}
                  className="mt-0.5"
                />
                <span className="leading-tight">
                  <span className="block text-[13px] font-semibold text-zinc-900">
                    Jadikan Teknisi On-call Utama
                  </span>
                  <span className="mt-0.5 block text-xs leading-4 text-zinc-700">
                    Tampil di pill &ldquo;On-call&rdquo; di header & jadi pilihan default dispatch.
                    {primaryCount > 0 && !editingId && " Status utama kontak lain otomatis dilepas."}
                  </span>
                </span>
              </label>
            </div>
          </section>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 border-t border-border bg-white px-5 py-3.5 sm:justify-between">
          {editingId ? (
            <>
              <Button
                variant="outline"
                className="h-9 border-zinc-200 bg-white text-[12.5px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
                onClick={resetForm}
                disabled={saving}
              >
                Batal Edit
              </Button>
              <Button
                className="h-9 gap-1.5 bg-zinc-900 text-[12.5px] font-semibold text-white shadow-none hover:bg-zinc-800"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                Simpan Perubahan
              </Button>
            </>
          ) : (
            <>
              <span className="hidden text-xs text-zinc-700 sm:block">
                {shortSpecializationHint()}
              </span>
              <Button
                className="h-9 gap-1.5 bg-zinc-900 text-[12.5px] font-semibold text-white shadow-none hover:bg-zinc-800"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                <Plus className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                Simpan
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Hint ringkas format nomor di footer mode tambah */
function shortSpecializationHint(): string {
  return "Format nomor bebas — 08xx / 62xx otomatis dinormalisasi.";
}
