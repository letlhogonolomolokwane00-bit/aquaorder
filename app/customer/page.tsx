"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  onAuthStateChanged,
  signInAnonymously,
  User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import {
  formatStatusLabel,
  formatTimestamp,
  Order,
  OrderStatus,
} from "@/app/lib/types";
import { auth, db } from "@/lib/firebase";

type WaterType = "refill" | "bottles";
type PaymentMethod = "cash" | "eft";
type ScheduleType = "asap" | "later";

type CustomerTab = "order" | "myOrders";

const QUICK_LITERS = [500, 1000, 2000, 5000];

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-sky-100 text-sky-700",
  OUT_FOR_DELIVERY: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

export default function CustomerPage() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<CustomerTab>("order");
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [myOrdersLoading, setMyOrdersLoading] = useState(false);
  const [myOrdersError, setMyOrdersError] = useState<string | null>(null);

  const [isOnline, setIsOnline] = useState(true);

  const [waterType, setWaterType] = useState<WaterType>("refill");
  const [liters, setLiters] = useState<number>(1000);
  const [customLiters, setCustomLiters] = useState<string>("1000");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("asap");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthUid(user?.uid ?? null);
      setAuthLoading(false);
    });

    if (!auth.currentUser) {
      signInAnonymously(auth).catch((error) => {
        setAuthError(error.message);
        setAuthLoading(false);
      });
    }

    return () => unsubscribe();
  }, []);

  const scheduledTimestamp = useMemo(() => {
    if (scheduleType === "asap") return null;
    if (!scheduledDate || !scheduledTime) return null;
    const [year, month, day] = scheduledDate.split("-").map(Number);
    const [hour, minute] = scheduledTime.split(":").map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day, hour || 0, minute || 0);
    return Timestamp.fromDate(date);
  }, [scheduleType, scheduledDate, scheduledTime]);

  // Firestore index: orders (customerUid ASC, createdAt DESC)
  const myOrdersQuery = useMemo(() => {
    if (!authUid) return null;
    return query(
      collection(db, "orders"),
      where("customerUid", "==", authUid),
      orderBy("createdAt", "desc")
    );
  }, [authUid]);

  useEffect(() => {
    if (!myOrdersQuery || activeTab !== "myOrders") return;
    setMyOrdersLoading(true);
    setMyOrdersError(null);
    const unsubscribe = onSnapshot(
      myOrdersQuery,
      (snapshot) => {
        const nextOrders = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            customerUid: data.customerUid,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            address: data.address,
            landmark: data.landmark,
            waterType: data.waterType,
            liters: data.liters,
            paymentMethod: data.paymentMethod,
            scheduleType: data.scheduleType,
            scheduledFor: data.scheduledFor ?? null,
            status: data.status,
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
            assignedDriverUid: data.assignedDriverUid ?? null,
            assignedDriverName: data.assignedDriverName ?? null,
          } as Order;
        });
        setMyOrders(nextOrders);
        setMyOrdersLoading(false);
      },
      (err) => {
        setMyOrdersError(err.message);
        setMyOrdersLoading(false);
      }
    );
    return () => unsubscribe();
  }, [myOrdersQuery, activeTab]);

  const isSynced = isOnline && !isSubmitting;

  const handleQuickLiters = (value: number) => {
    setLiters(value);
    setCustomLiters(String(value));
  };

  const handleCustomLiters = (value: string) => {
    setCustomLiters(value);
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      setLiters(parsed);
    }
  };

  const resetForm = () => {
    setWaterType("refill");
    setLiters(1000);
    setCustomLiters("1000");
    setScheduleType("asap");
    setScheduledDate("");
    setScheduledTime("");
    setCustomerName("");
    setCustomerPhone("");
    setAddress("");
    setLandmark("");
    setPaymentMethod("cash");
    setSubmitError(null);
    setOrderId(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (!authUser) {
      setSubmitError("Signing you in. Please try again in a moment.");
      return;
    }

    if (!customerName.trim() || !customerPhone.trim() || !address.trim()) {
      setSubmitError("Please complete your name, phone, and address.");
      return;
    }

    if (!liters || liters <= 0) {
      setSubmitError("Please choose a valid liters amount.");
      return;
    }

    if (scheduleType === "later" && !scheduledTimestamp) {
      setSubmitError("Please select a delivery date and time.");
      return;
    }

    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "orders"), {
        customerUid: authUser.uid,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        address: address.trim(),
        landmark: landmark.trim(),
        waterType,
        liters,
        paymentMethod,
        scheduleType,
        scheduledFor: scheduledTimestamp,
        status: "PENDING",
        assignedDriverUid: null,
        assignedDriverName: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setOrderId(docRef.id);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to place order."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-sky-50 to-cyan-100 text-slate-900">
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-cyan-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-sky-200/60 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-12 sm:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">
              Customer
            </p>
            <h1 className="mt-3 font-['Spectral',serif] text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Place an Order
            </h1>
            <p className="mt-3 max-w-xl font-['Golos_Text',system-ui] text-base leading-7 text-slate-600 sm:text-lg">
              Schedule a refill, track liters, and confirm delivery details in
              one place.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  isOnline ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              <span>{isOnline ? "Online" : "Offline"}</span>
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              {authUid ? "Signed in" : "Signing in"}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              {isSynced ? "Synced" : "Syncing"}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {(["order", "myOrders"] as CustomerTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab
                  ? "border-sky-300 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white/80 text-slate-600 hover:border-sky-200 hover:text-slate-900"
              }`}
            >
              {tab === "order" ? "Place Order" : "My Orders"}
            </button>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg backdrop-blur sm:p-8">
          {authLoading && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Setting up your secure session...
            </div>
          )}
          {authError && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {authError}
            </div>
          )}

          {activeTab === "order" && (
            <>
              {orderId ? (
                <div className="flex flex-col gap-6 text-center">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-600">
                      Order received ✅
                    </p>
                    <h2 className="mt-3 font-['Spectral',serif] text-3xl font-semibold text-slate-900">
                      Thank you!
                    </h2>
                    <p className="mt-3 text-sm text-slate-600">
                      Order ID: <span className="font-semibold">{orderId}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-500">Status: PENDING</p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-full bg-sky-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                    >
                      Place another order
                    </button>
                    <Link
                      href="/"
                      className="rounded-full border border-slate-200 bg-white px-6 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-slate-900"
                    >
                      Back to Home
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-8">
                  <section className="space-y-4">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Water Type
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setWaterType("refill")}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          waterType === "refill"
                            ? "border-sky-400 bg-sky-50 text-slate-900"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <p className="text-sm font-semibold">JoJo/Tank Refill</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Default delivery option
                        </p>
                      </button>
                      <button
                        type="button"
                        disabled
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-400"
                      >
                        <p className="text-sm font-semibold">Bottled Water</p>
                        <p className="mt-1 text-xs">Coming soon</p>
                      </button>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Liters
                    </h2>
                    <div className="flex flex-wrap gap-3">
                      {QUICK_LITERS.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleQuickLiters(value)}
                          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            liters === value
                              ? "border-sky-400 bg-sky-50 text-slate-900"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {value} L
                        </button>
                      ))}
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-600">
                        Custom liters
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={customLiters}
                        onChange={(event) => handleCustomLiters(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                        placeholder="Enter liters"
                      />
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Schedule
                    </h2>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setScheduleType("asap")}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          scheduleType === "asap"
                            ? "border-sky-400 bg-sky-50 text-slate-900"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        ASAP
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleType("later")}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          scheduleType === "later"
                            ? "border-sky-400 bg-sky-50 text-slate-900"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        Later
                      </button>
                    </div>
                    {scheduleType === "later" && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="text-sm font-semibold text-slate-600">
                            Delivery date
                          </label>
                          <input
                            type="date"
                            value={scheduledDate}
                            onChange={(event) =>
                              setScheduledDate(event.target.value)
                            }
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-slate-600">
                            Delivery time
                          </label>
                          <input
                            type="time"
                            value={scheduledTime}
                            onChange={(event) =>
                              setScheduledTime(event.target.value)
                            }
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          />
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="space-y-4">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Customer details
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-sm font-semibold text-slate-600">
                          Full name
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(event) => setCustomerName(event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          placeholder="Your name"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-slate-600">
                          Phone number
                        </label>
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(event) => setCustomerPhone(event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          placeholder="+27 82 000 0000"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Delivery details
                    </h2>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-semibold text-slate-600">
                          Address
                        </label>
                        <input
                          type="text"
                          value={address}
                          onChange={(event) => setAddress(event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          placeholder="Street address"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-slate-600">
                          Landmark / Notes (optional)
                        </label>
                        <input
                          type="text"
                          value={landmark}
                          onChange={(event) => setLandmark(event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          placeholder="Gate code, landmarks, etc."
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Payment
                    </h2>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cash")}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          paymentMethod === "cash"
                            ? "border-sky-400 bg-sky-50 text-slate-900"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        Pay on delivery: Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("eft")}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          paymentMethod === "eft"
                            ? "border-sky-400 bg-sky-50 text-slate-900"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        Pay on delivery: EFT
                      </button>
                    </div>
                  </section>

                  {submitError && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      {submitError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isSubmitting ? "Placing order..." : "Place Order"}
                  </button>
                </form>
              )}
            </>
          )}

          {activeTab === "myOrders" && (
            <div className="space-y-6">
              {myOrdersLoading && (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  Loading your orders...
                </div>
              )}
              {myOrdersError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {myOrdersError}
                </div>
              )}
              {!myOrdersLoading && !myOrdersError && myOrders.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
                  You have not placed any orders yet.
                </div>
              )}
              {!myOrdersLoading &&
                !myOrdersError &&
                myOrders.map((order) => {
                  const scheduleLabel =
                    order.scheduleType === "later"
                      ? `Scheduled for ${formatTimestamp(order.scheduledFor)}`
                      : "ASAP delivery";
                  return (
                    <article
                      key={order.id}
                      className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {order.liters ?? "—"} L · {order.waterType ?? "Water"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Created: {formatTimestamp(order.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            STATUS_STYLES[order.status ?? "PENDING"]
                          }`}
                        >
                          {formatStatusLabel(order.status ?? "PENDING")}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Delivery
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            {order.address ?? "No address provided"}
                          </p>
                          {order.landmark && (
                            <p className="mt-1 text-xs text-slate-500">
                              Landmark: {order.landmark}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Schedule
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            {scheduleLabel}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Payment: {order.paymentMethod?.toUpperCase() ?? "—"}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
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
