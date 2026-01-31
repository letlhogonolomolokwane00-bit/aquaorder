"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { digitsOnly } from "@/app/lib/types";
import { db } from "@/lib/firebase";

type BusinessCard = {
  businessName?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessAddress?: string;
  businessWhatsapp?: string;
  businessHours?: string;
  businessNote?: string;
};

export default function ContactPage() {
  const [card, setCard] = useState<BusinessCard>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const settingsRef = doc(db, "settings", "app");
    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        setCard((snapshot.data() ?? {}) as BusinessCard);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const whatsapp = digitsOnly(card.businessWhatsapp || card.businessPhone);
  const phone = card.businessPhone ?? "";
  const email = card.businessEmail ?? "";
  const address = card.businessAddress ?? "";
  const mapsQuery = address ? encodeURIComponent(address) : "";

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-sky-50 to-cyan-100 text-slate-900">
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-cyan-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-sky-200/60 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-12 sm:px-10">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">
            Contact
          </p>
          <h1 className="mt-3 font-['Spectral',serif] text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            {card.businessName ?? "Business Contact"}
          </h1>
          <p className="mt-3 max-w-xl font-['Golos_Text',system-ui] text-base leading-7 text-slate-600 sm:text-lg">
            Reach out for orders, support, or delivery updates.
          </p>
        </div>

        <div className="mt-10 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg backdrop-blur sm:p-8">
          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Loading contact details...
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
          {!loading && !error && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Phone
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    {card.businessPhone ?? "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Email
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    {card.businessEmail ?? "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Address
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    {card.businessAddress ?? "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Hours
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    {card.businessHours ?? "Not provided"}
                  </p>
                </div>
              </div>

              {card.businessNote && (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  {card.businessNote}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <a
                  href={phone ? `tel:${phone}` : undefined}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-slate-900"
                >
                  📞 Call
                </a>
                <a
                  href={whatsapp ? `https://wa.me/${whatsapp}` : undefined}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-slate-900"
                >
                  💬 WhatsApp
                </a>
                <a
                  href={email ? `mailto:${email}` : undefined}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-slate-900"
                >
                  ✉️ Email
                </a>
                <a
                  href={mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${mapsQuery}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-amber-300 hover:text-slate-900"
                >
                  📍 Open in Maps
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8">
          <Link
            href="/"
            className="text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
