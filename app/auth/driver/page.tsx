"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import AccessDenied from "@/app/components/AccessDenied";
import { auth } from "@/lib/firebase";
import { getUserRole } from "@/app/lib/authz";

export default function DriverLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCheckingSession(false);
        return;
      }

      try {
        const role = await getUserRole(user.uid);
        if (role === "DRIVER") {
          router.replace("/driver");
          return;
        }
        await signOut(auth);
        setAccessDenied(true);
        setError(
          role
            ? "This account does not have driver access."
            : "No role profile found for this account."
        );
      } catch (err) {
        await signOut(auth);
        setError(err instanceof Error ? err.message : "Login check failed.");
      } finally {
        setCheckingSession(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setAccessDenied(false);

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const role = await getUserRole(credential.user.uid);
      if (role !== "DRIVER") {
        await signOut(auth);
        setAccessDenied(true);
        setError(
          role
            ? "This account does not have driver access."
            : "No role profile found for this account."
        );
        return;
      }
      router.replace("/driver");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-emerald-50 to-emerald-100 text-slate-900">
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-emerald-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-emerald-200/60 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-16 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">
          Driver Login
        </p>
        <h1 className="mt-3 font-['Spectral',serif] text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Sign in to deliver
        </h1>
        <p className="mt-4 font-['Golos_Text',system-ui] text-sm text-slate-600 sm:text-base">
          Use your driver account to access your route dashboard.
        </p>

        <div className="mt-10 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg backdrop-blur sm:p-8">
          {checkingSession ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Checking your session...
            </div>
          ) : accessDenied ? (
            <AccessDenied
              title="Driver access required"
              message={error ?? "Access denied."}
              backHref="/"
              backLabel="Back to Home"
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-slate-600">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="driver@aquaorder.com"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </button>
            </form>
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
