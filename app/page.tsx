import Link from "next/link";
import ContactLink from "@/app/components/ContactLink";

export default function Home() {
  const APP_NAME = "Aquaorder";
  const [firstWord, ...restWords] = APP_NAME.split(" ");
  const firstWordStart = firstWord.slice(0, -1);
  const firstWordLast = firstWord.slice(-1);
  const remainingWords = restWords.join(" ");

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-sky-50 to-cyan-100 text-slate-900">
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-cyan-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-sky-200/60 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-6 py-16 sm:px-10">
        <div className="w-full text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">
            Water delivery, simplified
          </p>
          <h1 className="mt-3 font-['Spectral',serif] text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            <span>{firstWordStart}</span>
            <span>{firstWordLast}</span>
            <span> {remainingWords}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl font-['Golos_Text',system-ui] text-base leading-7 text-slate-600 sm:text-lg">
            Simple water delivery for your home &amp; business
          </p>
        </div>

        <section className="mt-12 grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/customer"
            className="group flex min-h-[220px] w-full flex-col justify-between rounded-3xl border border-slate-200 bg-white/80 p-6 text-left shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-sky-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            aria-label="Customer role card"
          >
            <div>
              <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-sky-700">
                Customer
              </span>
              <h2 className="mt-4 font-['Golos_Text',system-ui] text-2xl font-semibold text-slate-900">
                Order water for your JoJo tank
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Fast requests, clear delivery windows, and instant order status.
              </p>
            </div>
            <span className="mt-6 text-sm font-semibold text-sky-700 transition group-hover:translate-x-1">
              Tap to explore
            </span>
          </Link>

          <Link
            href="/driver"
            className="group flex min-h-[220px] w-full flex-col justify-between rounded-3xl border border-slate-200 bg-white/80 p-6 text-left shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-label="Driver role card"
          >
            <div>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700">
                Driver
              </span>
              <h2 className="mt-4 font-['Golos_Text',system-ui] text-2xl font-semibold text-slate-900">
                Manage deliveries and tanker refills
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Smart routing, refill reminders, and delivery checklists.
              </p>
            </div>
            <span className="mt-6 text-sm font-semibold text-emerald-700 transition group-hover:translate-x-1">
              Tap to explore
            </span>
          </Link>

          <Link
            href="/owner"
            className="group flex min-h-[220px] w-full flex-col justify-between rounded-3xl border border-slate-200 bg-white/80 p-6 text-left shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-amber-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            aria-label="Owner role card"
          >
            <div>
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-700">
                Owner
              </span>
              <h2 className="mt-4 font-['Golos_Text',system-ui] text-2xl font-semibold text-slate-900">
                Oversee orders, capacity, and operations
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Live dashboards, tanker capacity, and daily performance.
              </p>
            </div>
            <span className="mt-6 text-sm font-semibold text-amber-700 transition group-hover:translate-x-1">
              Tap to explore
            </span>
          </Link>
        </section>

        <div className="mt-8">
          <ContactLink defaultName={APP_NAME} />
        </div>
      </main>
    </div>
  );
}
