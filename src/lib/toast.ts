"use client";

/**
 * Toast ber-brand UnitKu — pembungkus sonner yang menambahkan akhiran
 * " · UnitKu" pada SETIAP judul notifikasi yang belum menyebut brand.
 * Seluruh komponen wajib mengimpor dari sini (bukan langsung dari "sonner").
 */

import { toast as base } from "sonner";

const BRAND = "UnitKu";

/** Judul toast otomatis diakhiri " · UnitKu" bila belum menyebut brand. */
const brandify = (title: string) => (title.includes(BRAND) ? title : `${title} · ${BRAND}`);

type ToastOpts = Parameters<typeof base.success>[1];
type ToastResult = ReturnType<typeof base.success>;

interface BrandedToast {
  (title: string, opts?: ToastOpts): ToastResult;
  success(title: string, opts?: ToastOpts): ToastResult;
  error(title: string, opts?: ToastOpts): ToastResult;
  warning(title: string, opts?: ToastOpts): ToastResult;
  info(title: string, opts?: ToastOpts): ToastResult;
  loading(title: string, opts?: ToastOpts): ToastResult;
  message(title: string, opts?: ToastOpts): ToastResult;
  promise: typeof base.promise;
  dismiss: typeof base.dismiss;
  custom: typeof base.custom;
}

const branded = (title: string, opts?: ToastOpts): ToastResult => base(brandify(title), opts);

const method = (fn: (t: string, o?: ToastOpts) => ToastResult) => (title: string, opts?: ToastOpts) =>
  fn(brandify(title), opts);

export const toast = Object.assign(branded, {
  success: method(base.success),
  error: method(base.error),
  warning: method(base.warning),
  info: method(base.info),
  loading: method(base.loading),
  message: method(base.message),
  promise: base.promise,
  dismiss: base.dismiss,
  custom: base.custom,
}) as BrandedToast;
