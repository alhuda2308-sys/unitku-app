// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Halaman legalitas publik: /legal/[slug]
//   • syarat-ketentuan · kebijakan-privasi · kebijakan-refund
// Statik, publik (middleware), bertipografi bersih untuk peninjauan KYC Mayar.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LifeBuoy } from "lucide-react";

import { LEGAL_DOCS, getLegalDoc } from "@/lib/legal-content";
import {
  COPYRIGHT_LINE,
  SUPPORT_EMAIL,
  SUPPORT_WA_LINK,
} from "@/lib/landing-config";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return LEGAL_DOCS.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) return { title: "Legal — UnitKu" };
  return { title: `${doc.title} — UnitKu`, description: doc.description };
}

export default async function LegalPage({ params }: PageProps) {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();

  return (
    <main className="flex min-h-dvh flex-col bg-[#f8fafc]">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Kembali ke Beranda
        </Link>

        <header className="mt-5 border-b border-zinc-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {doc.title}
          </h1>
          <p className="mt-1 text-[12.5px] text-zinc-500">{doc.updatedLabel}</p>
        </header>

        <article className="mt-6 space-y-6">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-[15px] font-semibold text-zinc-900">
                {section.heading}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="mt-2 text-[13px] leading-relaxed text-zinc-600"
                >
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-2 space-y-1.5">
                  {section.bullets.map((bullet) => (
                    <li
                      key={bullet.slice(0, 40)}
                      className="flex gap-2 text-[13px] leading-relaxed text-zinc-600"
                    >
                      <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-zinc-400" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>

        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
              <LifeBuoy className="size-4 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-zinc-900">
                Butuh bantuan? Customer Care siap membantu.
              </p>
              <p className="mt-0.5 text-[12.5px] text-zinc-500">
                WhatsApp:{" "}
                <a
                  href={SUPPORT_WA_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-zinc-800 underline-offset-2 hover:underline"
                >
                  Chat CS
                </a>{" "}
                · Email:{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-medium text-zinc-800 underline-offset-2 hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 sm:flex-row sm:px-6">
          <p className="text-[12.5px] text-zinc-500">{COPYRIGHT_LINE}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {LEGAL_DOCS.map((entry) => (
              <Link
                key={entry.slug}
                href={`/legal/${entry.slug}`}
                className={`text-[12.5px] underline-offset-2 hover:underline ${
                  entry.slug === doc.slug
                    ? "font-semibold text-zinc-900"
                    : "text-zinc-500"
                }`}
              >
                {entry.title}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
