"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

type ContactLinkProps = {
  defaultName?: string;
};

export default function ContactLink({ defaultName }: ContactLinkProps) {
  const fallbackLabel = defaultName
    ? `Contact ${defaultName}`
    : "Business Info";
  const [label, setLabel] = useState(fallbackLabel);

  useEffect(() => {
    const settingsRef = doc(db, "settings", "app");
    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        const name = snapshot.data()?.businessName as string | undefined;
        setLabel(name ? `Contact ${name}` : fallbackLabel);
      },
      () => {
        setLabel(fallbackLabel);
      }
    );
    return () => unsubscribe();
  }, [fallbackLabel]);

  return (
    <Link
      href="/contact"
      className="text-sm font-semibold text-slate-600 transition hover:text-slate-900"
    >
      {label}
    </Link>
  );
}
