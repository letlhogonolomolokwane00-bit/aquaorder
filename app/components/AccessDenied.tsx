"use client";

import Link from "next/link";

type AccessDeniedProps = {
  title?: string;
  message?: string;
  backHref?: string;
  backLabel?: string;
};

export default function AccessDenied({
  title = "Access denied",
  message = "Your account does not have permission to view this page.",
  backHref = "/",
  backLabel = "Back to Home",
}: AccessDeniedProps) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-6 text-center shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
        {title}
      </p>
      <p className="mt-3 text-sm text-amber-700">{message}</p>
      <Link
        href={backHref}
        className="mt-5 inline-flex items-center justify-center rounded-full border border-amber-200 bg-white/80 px-5 py-2 text-sm font-semibold text-amber-700 shadow-sm backdrop-blur transition hover:border-amber-300 hover:text-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        {backLabel}
      </Link>
    </div>
  );
}
