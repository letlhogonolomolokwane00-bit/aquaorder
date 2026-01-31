"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import AccessDenied from "@/app/components/AccessDenied";
import { useRequireRole } from "@/app/lib/authz";
import {
  digitsOnly,
  formatStatusLabel,
  formatTimestamp,
  Order,
  OrderStatus,
} from "@/app/lib/types";
import { auth, db } from "@/lib/firebase";

type DriverTab = "CONFIRMED" | "OUT_FOR_DELIVERY" | "DELIVERED";

const STATUS_TABS: DriverTab[] = [
  "CONFIRMED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-sky-100 text-sky-700",
  OUT_FOR_DELIVERY: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

const formatIndexError = (message: string) => {
  if (!message.toLowerCase().includes("index")) return message;
  return (
    "This query needs a Firestore index. Please open the Firebase Console " +
    "and create the suggested index for assignedDriverUid + status + createdAt."
  );
};

export default function DriverPage() {
  const router = useRouter();
  const { loading, accessDenied, error, user } = useRequireRole(
    "DRIVER",
    "/auth/driver"
  );
  const driverUid = user?.uid ?? null;
  const [selectedStatus, setSelectedStatus] =
    useState<DriverTab>("CONFIRMED");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [unassignedOrders, setUnassignedOrders] = useState<Order[]>([]);
  const [unassignedLoading, setUnassignedLoading] = useState(true);
  const [unassignedError, setUnassignedError] = useState<string | null>(null);
  const [tankCapacity, setTankCapacity] = useState<number | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Firestore index: orders (assignedDriverUid ASC, status ASC, createdAt DESC)
  const assignedQuery = useMemo(() => {
    if (!driverUid) return null;
    return query(
      collection(db, "orders"),
      where("assignedDriverUid", "==", driverUid),
      where("status", "==", selectedStatus),
      orderBy("createdAt", "desc")
    );
  }, [selectedStatus, driverUid]);

  // Firestore index: orders (assignedDriverUid ASC, status ASC, createdAt DESC)
  const unassignedQuery = useMemo(() => {
    if (selectedStatus !== "CONFIRMED") return null;
    return query(
      collection(db, "orders"),
      where("assignedDriverUid", "==", null),
      where("status", "==", "CONFIRMED"),
      orderBy("createdAt", "desc")
    );
  }, [selectedStatus]);

  useEffect(() => {
    if (loading || accessDenied || !assignedQuery) return;
    const unsubscribe = onSnapshot(
      assignedQuery,
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
        setOrders(nextOrders);
        setOrdersLoading(false);
      },
      (err) => {
        setOrdersError(formatIndexError(err.message));
        setOrdersLoading(false);
      }
    );
    return () => unsubscribe();
  }, [assignedQuery, loading, accessDenied]);

  useEffect(() => {
    if (loading || accessDenied || !unassignedQuery) return;
    const unsubscribe = onSnapshot(
      unassignedQuery,
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
        setUnassignedOrders(nextOrders);
        setUnassignedLoading(false);
      },
      (err) => {
        setUnassignedError(formatIndexError(err.message));
        setUnassignedLoading(false);
      }
    );
    return () => unsubscribe();
  }, [unassignedQuery, loading, accessDenied]);

  useEffect(() => {
    if (loading || accessDenied) return;
    const settingsRef = doc(db, "settings", "app");
    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        const data = snapshot.data();
        if (typeof data?.tankCapacityLiters === "number") {
          setTankCapacity(data.tankCapacityLiters);
        }
      },
      (err) => {
        setSettingsError(err.message);
      }
    );
    return () => unsubscribe();
  }, [loading, accessDenied]);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/auth/driver");
  };

  const handleStatusChange = (status: DriverTab) => {
    setSelectedStatus(status);
    setOrdersLoading(true);
    setOrdersError(null);
    setActionMessage(null);
    if (status === "CONFIRMED") {
      setUnassignedLoading(true);
      setUnassignedError(null);
    } else {
      setUnassignedOrders([]);
      setUnassignedLoading(false);
      setUnassignedError(null);
    }
  };

  const updateStatus = async (order: Order, status: OrderStatus) => {
    setActionMessage(null);
    const current = order.status;
    if (status === "OUT_FOR_DELIVERY" && current !== "CONFIRMED") {
      setActionMessage("This delivery is no longer in the confirmed stage.");
      return;
    }
    if (status === "DELIVERED" && current !== "OUT_FOR_DELIVERY") {
      setActionMessage("This delivery is not out for delivery yet.");
      return;
    }
    const payload: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (status === "OUT_FOR_DELIVERY" && !order.assignedDriverUid && driverUid) {
      payload.assignedDriverUid = driverUid;
      payload.assignedDriverName =
        order.assignedDriverName ?? user?.displayName ?? "Driver";
    }
    await updateDoc(doc(db, "orders", order.id), payload);
  };

  const renderOrderCard = (order: Order) => {
    const whatsapp = digitsOnly(order.customerPhone);
    const mapsQuery = order.address ? encodeURIComponent(order.address) : "";
    const scheduleLabel =
      order.scheduleType === "later"
        ? `Scheduled for ${formatTimestamp(order.scheduledFor)}`
        : "ASAP delivery";
    return (
      <article
        key={order.id}
        className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg backdrop-blur"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                {order.customerName ?? "Unnamed customer"}
              </h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  STATUS_STYLES[order.status ?? "CONFIRMED"]
                }`}
              >
                {formatStatusLabel(order.status ?? "CONFIRMED")}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {order.customerPhone ?? "No phone number"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {order.customerPhone ? (
              <a
                href={`tel:${order.customerPhone}`}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-slate-900"
              >
                Call
              </a>
            ) : (
              <span className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-400">
                Call
              </span>
            )}
            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp}`}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-slate-900"
              >
                WhatsApp
              </a>
            ) : (
              <span className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-400">
                WhatsApp
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Address
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {order.address ?? "No address provided"}
            </p>
            {order.landmark && (
              <p className="mt-1 text-xs text-slate-500">
                Landmark: {order.landmark}
              </p>
            )}
            {mapsQuery && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-slate-900"
              >
                📍 Open in Maps
              </a>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Order Details
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {order.liters ?? "—"} L · {order.waterType ?? "Water"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Payment: {order.paymentMethod?.toUpperCase() ?? "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">{scheduleLabel}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Created: {formatTimestamp(order.createdAt)}
          </p>
          <div className="flex flex-wrap gap-2">
            {order.status === "CONFIRMED" && (
              <button
                type="button"
                onClick={() => updateStatus(order, "OUT_FOR_DELIVERY")}
                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                Start Delivery
              </button>
            )}
            {order.status === "OUT_FOR_DELIVERY" && (
              <button
                type="button"
                onClick={() => updateStatus(order, "DELIVERED")}
                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                Mark Delivered
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-sky-50 to-cyan-100 text-slate-900">
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-cyan-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-sky-200/60 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-12 sm:px-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">
              Driver
            </p>
            <h1 className="mt-3 font-['Spectral',serif] text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Deliveries
            </h1>
            <p className="mt-3 max-w-xl font-['Golos_Text',system-ui] text-base leading-7 text-slate-600 sm:text-lg">
              Claim confirmed jobs, track deliveries in motion, and close out
              completed routes.
            </p>
            {tankCapacity !== null && (
              <div className="mt-4 inline-flex items-center rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-semibold text-emerald-700 shadow-sm backdrop-blur">
                Tank Capacity: {tankCapacity.toLocaleString()} L
              </div>
            )}
            {settingsError && (
              <p className="mt-2 text-xs text-rose-600">{settingsError}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white/80 px-5 py-2 text-sm font-semibold text-emerald-700 shadow-sm backdrop-blur transition hover:border-emerald-300 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              Log out
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/80 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-emerald-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {loading && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm backdrop-blur">
            Checking driver access...
          </div>
        )}

        {accessDenied && (
          <div className="mt-8 w-full max-w-md">
            <AccessDenied
              title="Driver access required"
              message={error ?? "Access denied."}
              backHref="/auth/driver"
              backLabel="Go to Driver Login"
            />
          </div>
        )}

        {!loading && !accessDenied && (
          <div className="mt-10">
            <div className="flex flex-wrap gap-3">
              {STATUS_TABS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleStatusChange(status)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    selectedStatus === status
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white/80 text-slate-600 hover:border-emerald-200 hover:text-slate-900"
                  }`}
                >
                  {formatStatusLabel(status)}
                </button>
              ))}
            </div>

            <div className="mt-8 space-y-6">
              {ordersLoading && (
                <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm backdrop-blur">
                  Loading deliveries...
                </div>
              )}

              {ordersError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
                  {ordersError}
                </div>
              )}
              {actionMessage && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 shadow-sm">
                  {actionMessage}
                </div>
              )}

              {!ordersLoading && !ordersError && orders.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-600 shadow-sm backdrop-blur">
                  No deliveries assigned to you in this queue yet.
                </div>
              )}

              {!ordersLoading && !ordersError && orders.map(renderOrderCard)}

              {selectedStatus === "CONFIRMED" && (
                <div className="mt-8">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Unassigned Confirmed Orders
                    </h2>
                  </div>

                  {unassignedLoading && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm backdrop-blur">
                      Loading unassigned orders...
                    </div>
                  )}

                  {unassignedError && (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
                      {unassignedError}
                    </div>
                  )}

                  {!unassignedLoading &&
                    !unassignedError &&
                    unassignedOrders.length === 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-600 shadow-sm backdrop-blur">
                        No unassigned confirmed orders right now.
                      </div>
                    )}

                  <div className="mt-6 space-y-6">
                    {unassignedOrders.map(renderOrderCard)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
