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
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import AccessDenied from "@/app/components/AccessDenied";
import { useRequireRole } from "@/app/lib/authz";
import {
  digitsOnly,
  endOfToday,
  formatStatusLabel,
  formatTimestamp,
  Order,
  OrderStatus,
  startOfToday,
} from "@/app/lib/types";
import { auth, db } from "@/lib/firebase";

type OwnerTab = "dashboard" | "orders" | "settings";

type DriverOption = {
  uid: string;
  name: string;
};

type DashboardMetrics = {
  total: number;
  liters: number;
  byStatus: Record<OrderStatus, number>;
  deliveredOrders: number;
  deliveredLiters: number;
};

const STATUS_TABS: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
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
    "and create the suggested index for orders by status + createdAt."
  );
};

const createEmptyMetrics = (): DashboardMetrics => ({
  total: 0,
  liters: 0,
  byStatus: {
    PENDING: 0,
    CONFIRMED: 0,
    OUT_FOR_DELIVERY: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  },
  deliveredOrders: 0,
  deliveredLiters: 0,
});

export default function OwnerPage() {
  const router = useRouter();
  const { loading, accessDenied, error } = useRequireRole(
    "OWNER",
    "/auth/owner"
  );
  const [activeTab, setActiveTab] = useState<OwnerTab>("orders");
  const [selectedStatus, setSelectedStatus] =
    useState<OrderStatus>("PENDING");

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [dashboardMetrics, setDashboardMetrics] =
    useState<DashboardMetrics>(createEmptyMetrics);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [driversError, setDriversError] = useState<string | null>(null);
  const [driverSelections, setDriverSelections] = useState<
    Record<string, string>
  >({});
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);

  const [tankCapacityInput, setTankCapacityInput] = useState("");
  const [pricePer1000Input, setPricePer1000Input] = useState("");
  const [deliveryFeeInput, setDeliveryFeeInput] = useState("");
  const [dailyGoalInput, setDailyGoalInput] = useState("");
  const [businessNameInput, setBusinessNameInput] = useState("");
  const [businessPhoneInput, setBusinessPhoneInput] = useState("");
  const [businessEmailInput, setBusinessEmailInput] = useState("");
  const [businessAddressInput, setBusinessAddressInput] = useState("");
  const [businessWhatsappInput, setBusinessWhatsappInput] = useState("");
  const [businessHoursInput, setBusinessHoursInput] = useState("");
  const [businessNoteInput, setBusinessNoteInput] = useState("");
  const [pricePer1000Value, setPricePer1000Value] = useState(0);
  const [deliveryFeeValue, setDeliveryFeeValue] = useState(0);
  const [dailyGoalValue, setDailyGoalValue] = useState(0);
  const [settingsExists, setSettingsExists] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  // Firestore index: orders (status ASC, createdAt DESC)
  const statusQuery = useMemo(
    () =>
      query(
        collection(db, "orders"),
        where("status", "==", selectedStatus),
        orderBy("createdAt", "desc")
      ),
    [selectedStatus]
  );

  const todayRange = useMemo(
    () => ({ start: startOfToday(), end: endOfToday() }),
    []
  );

  // Firestore index: orders (createdAt DESC) with createdAt range filters
  const todayQuery = useMemo(
    () =>
      query(
        collection(db, "orders"),
        where("createdAt", ">=", Timestamp.fromDate(todayRange.start)),
        where("createdAt", "<", Timestamp.fromDate(todayRange.end)),
        orderBy("createdAt", "desc")
      ),
    [todayRange]
  );

  useEffect(() => {
    if (loading || accessDenied || activeTab !== "orders") return;
    setOrdersLoading(true);
    setOrdersError(null);
    const unsubscribe = onSnapshot(
      statusQuery,
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
  }, [statusQuery, loading, accessDenied, activeTab]);

  useEffect(() => {
    if (loading || accessDenied || activeTab !== "dashboard") return;
    setDashboardLoading(true);
    setDashboardError(null);
    const unsubscribe = onSnapshot(
      todayQuery,
      (snapshot) => {
        const metrics = createEmptyMetrics();
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          const status = data.status as OrderStatus | undefined;
          if (status && metrics.byStatus[status] !== undefined) {
            metrics.byStatus[status] += 1;
          }
          metrics.total += 1;
          const liters = typeof data.liters === "number" ? data.liters : 0;
          metrics.liters += liters;
          if (status === "DELIVERED") {
            metrics.deliveredOrders += 1;
            metrics.deliveredLiters += liters;
          }
        });
        setDashboardMetrics(metrics);
        setDashboardLoading(false);
      },
      (err) => {
        setDashboardError(
          err.message.toLowerCase().includes("index")
            ? "Dashboard requires a Firestore index for createdAt date range."
            : err.message
        );
        setDashboardLoading(false);
      }
    );
    return () => unsubscribe();
  }, [todayQuery, loading, accessDenied, activeTab]);

  useEffect(() => {
    if (loading || accessDenied || activeTab !== "orders") return;
    setDriversLoading(true);
    setDriversError(null);
    const driversQuery = query(
      collection(db, "users"),
      where("role", "==", "DRIVER"),
      where("isActive", "==", true)
    );
    const unsubscribe = onSnapshot(
      driversQuery,
      (snapshot) => {
        const nextDrivers = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data();
          return {
            uid: docSnapshot.id,
            name: data.name || `Driver ${docSnapshot.id.slice(0, 6)}`,
          };
        });
        setDrivers(nextDrivers);
        setDriversLoading(false);
      },
      (err) => {
        setDriversError(err.message);
        setDriversLoading(false);
      }
    );
    return () => unsubscribe();
  }, [loading, accessDenied, activeTab]);

  useEffect(() => {
    if (loading || accessDenied) return;
    setSettingsLoading(true);
    setSettingsError(null);
    const settingsRef = doc(db, "settings", "app");
    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        setSettingsExists(snapshot.exists());
        const data = snapshot.data();
        if (data?.tankCapacityLiters) {
          setTankCapacityInput(String(data.tankCapacityLiters));
        }
        if (typeof data?.pricePer1000L === "number") {
          setPricePer1000Input(String(data.pricePer1000L));
          setPricePer1000Value(data.pricePer1000L);
        }
        if (typeof data?.deliveryFee === "number") {
          setDeliveryFeeInput(String(data.deliveryFee));
          setDeliveryFeeValue(data.deliveryFee);
        }
        if (typeof data?.dailyDeliveryGoalOrders === "number") {
          setDailyGoalInput(String(data.dailyDeliveryGoalOrders));
          setDailyGoalValue(data.dailyDeliveryGoalOrders);
        }
        if (typeof data?.businessName === "string") {
          setBusinessNameInput(data.businessName);
        }
        if (typeof data?.businessPhone === "string") {
          setBusinessPhoneInput(data.businessPhone);
        }
        if (typeof data?.businessEmail === "string") {
          setBusinessEmailInput(data.businessEmail);
        }
        if (typeof data?.businessAddress === "string") {
          setBusinessAddressInput(data.businessAddress);
        }
        if (typeof data?.businessWhatsapp === "string") {
          setBusinessWhatsappInput(data.businessWhatsapp);
        }
        if (typeof data?.businessHours === "string") {
          setBusinessHoursInput(data.businessHours);
        }
        if (typeof data?.businessNote === "string") {
          setBusinessNoteInput(data.businessNote);
        }
        setSettingsLoading(false);
      },
      (err) => {
        setSettingsError(err.message);
        setSettingsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [loading, accessDenied]);

  useEffect(() => {
    if (!orders.length) return;
    setDriverSelections((prev) => {
      const next = { ...prev };
      orders.forEach((order) => {
        if (order.assignedDriverUid && !next[order.id]) {
          next[order.id] = order.assignedDriverUid;
        }
      });
      return next;
    });
  }, [orders]);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/auth/owner");
  };

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    await updateDoc(doc(db, "orders", orderId), {
      status,
      updatedAt: serverTimestamp(),
    });
  };

  const handleAssignDriver = async (order: Order) => {
    const selectedUid = driverSelections[order.id];
    if (!selectedUid) return;
    const driver = drivers.find((item) => item.uid === selectedUid);
    setAssigningOrderId(order.id);
    setAssignmentMessage(null);
    try {
      await updateDoc(doc(db, "orders", order.id), {
        assignedDriverUid: selectedUid,
        assignedDriverName: driver?.name ?? "Driver",
        updatedAt: serverTimestamp(),
      });
      setAssignmentMessage("Driver assignment saved.");
    } catch (err) {
      setAssignmentMessage(
        err instanceof Error ? err.message : "Failed to assign driver."
      );
    } finally {
      setAssigningOrderId(null);
    }
  };

  const handleSaveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setSettingsMessage(null);
    setSettingsError(null);
    const parsed = Number(tankCapacityInput);
    if (!parsed || parsed <= 0) {
      setSettingsError("Please enter a valid tank capacity.");
      return;
    }
    const pricePer1000 = Number(pricePer1000Input) || 0;
    const deliveryFee = Number(deliveryFeeInput) || 0;
    const dailyGoal = Number(dailyGoalInput) || 0;
    try {
      await setDoc(
        doc(db, "settings", "app"),
        {
          tankCapacityLiters: parsed,
          pricePer1000L: pricePer1000,
          deliveryFee,
          dailyDeliveryGoalOrders: dailyGoal,
          businessName: businessNameInput.trim(),
          businessPhone: businessPhoneInput.trim(),
          businessEmail: businessEmailInput.trim(),
          businessAddress: businessAddressInput.trim(),
          businessWhatsapp: businessWhatsappInput.trim(),
          businessHours: businessHoursInput.trim(),
          businessNote: businessNoteInput.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setPricePer1000Value(pricePer1000);
      setDeliveryFeeValue(deliveryFee);
      setDailyGoalValue(dailyGoal);
      setSettingsMessage("Settings saved.");
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : "Failed to save settings."
      );
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-sky-50 to-cyan-100 text-slate-900">
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-cyan-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-sky-200/60 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-12 sm:px-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
              Owner
            </p>
            <h1 className="mt-3 font-['Spectral',serif] text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Operations Hub
            </h1>
            <p className="mt-3 max-w-xl font-['Golos_Text',system-ui] text-base leading-7 text-slate-600 sm:text-lg">
              Track performance, manage orders, and keep daily operations under
              control.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-full border border-amber-200 bg-white/80 px-5 py-2 text-sm font-semibold text-amber-700 shadow-sm backdrop-blur transition hover:border-amber-300 hover:text-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Log out
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/80 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-amber-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {loading && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm backdrop-blur">
            Checking owner access...
          </div>
        )}

        {accessDenied && (
          <div className="mt-8 w-full max-w-md">
            <AccessDenied
              title="Owner access required"
              message={error ?? "Access denied."}
              backHref="/auth/owner"
              backLabel="Go to Owner Login"
            />
          </div>
        )}

        {!loading && !accessDenied && (
          <div className="mt-10">
            <div className="flex flex-wrap gap-3">
              {(["dashboard", "orders", "settings"] as OwnerTab[]).map(
                (tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      activeTab === tab
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-slate-200 bg-white/80 text-slate-600 hover:border-amber-200 hover:text-slate-900"
                    }`}
                  >
                    {tab === "dashboard"
                      ? "Dashboard"
                      : tab === "orders"
                      ? "Orders"
                      : "Settings"}
                  </button>
                )
              )}
            </div>

            {activeTab === "dashboard" && (
              <div className="mt-8 space-y-6">
                {dashboardLoading && (
                  <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm backdrop-blur">
                    Loading today&#39;s metrics...
                  </div>
                )}
                {dashboardError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
                    {dashboardError}
                  </div>
                )}
                {!dashboardLoading && !dashboardError && (
                  <>
                    {(() => {
                      const deliveredOrdersToday =
                        dashboardMetrics.deliveredOrders;
                      const pricePer1000 = Number(pricePer1000Value) || 0;
                      const deliveryFee = Number(deliveryFeeValue) || 0;
                      const dailyGoal = Number(dailyGoalValue) || 0;
                      const deliveredRevenueToday =
                        pricePer1000 > 0
                          ? (dashboardMetrics.deliveredLiters / 1000) *
                              pricePer1000 +
                            deliveryFee * deliveredOrdersToday
                          : 0;
                      const progress =
                        dailyGoal > 0
                          ? Math.min(deliveredOrdersToday / dailyGoal, 1)
                          : 0;
                      const radius = 54;
                      const circumference = 2 * Math.PI * radius;
                      const offset = circumference * (1 - progress);
                      return (
                        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg backdrop-blur">
                          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="relative flex h-36 w-36 items-center justify-center">
                              <svg
                                viewBox="0 0 120 120"
                                className="h-36 w-36"
                              >
                                <circle
                                  cx="60"
                                  cy="60"
                                  r={radius}
                                  stroke="rgba(226,232,240,0.9)"
                                  strokeWidth="10"
                                  fill="none"
                                />
                                <circle
                                  cx="60"
                                  cy="60"
                                  r={radius}
                                  stroke="rgba(16,185,129,0.8)"
                                  strokeWidth="10"
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeDasharray={circumference}
                                  strokeDashoffset={offset}
                                />
                              </svg>
                              <div className="absolute text-center">
                                <p className="text-lg font-semibold text-slate-900">
                                  R {Math.round(deliveredRevenueToday).toLocaleString()}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {deliveredOrdersToday} / {dailyGoal || 0} delivered
                                </p>
                              </div>
                            </div>
                            <div className="text-center sm:text-left">
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                Revenue Today
                              </p>
                              <p className="mt-2 text-sm text-slate-600">
                                {pricePer1000 > 0
                                  ? "Progress toward today’s delivery goal."
                                  : "Set price per 1000L in Settings."}
                              </p>
                              {dailyGoal <= 0 && (
                                <p className="mt-1 text-xs text-slate-500">
                                  Set a daily goal in Settings.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Total Orders Today
                        </p>
                        <p className="mt-3 text-3xl font-semibold text-slate-900">
                          {dashboardMetrics.total}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Total Liters Today
                        </p>
                        <p className="mt-3 text-3xl font-semibold text-slate-900">
                          {dashboardMetrics.liters.toLocaleString()} L
                        </p>
                      </div>
                      {STATUS_TABS.map((status) => (
                        <div
                          key={status}
                          className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            {formatStatusLabel(status)}
                          </p>
                          <p className="mt-3 text-3xl font-semibold text-slate-900">
                            {dashboardMetrics.byStatus[status]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "orders" && (
              <div className="mt-8">
                <div className="flex flex-wrap gap-3">
                  {STATUS_TABS.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setSelectedStatus(status)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        selectedStatus === status
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-white/80 text-slate-600 hover:border-amber-200 hover:text-slate-900"
                      }`}
                    >
                      {formatStatusLabel(status)}
                    </button>
                  ))}
                </div>

                <div className="mt-8 space-y-6">
                  {ordersLoading && (
                    <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm backdrop-blur">
                      Loading orders...
                    </div>
                  )}

                  {ordersError && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
                      {ordersError}
                    </div>
                  )}

                  {!ordersLoading && !ordersError && orders.length === 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-600 shadow-sm backdrop-blur">
                      No orders in this queue yet.
                    </div>
                  )}

                  {driversError && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
                      {driversError}
                    </div>
                  )}

                  {assignmentMessage && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
                      {assignmentMessage}
                    </div>
                  )}

                  {!ordersLoading &&
                    !ordersError &&
                    orders.map((order) => {
                      const whatsapp = digitsOnly(order.customerPhone);
                      const mapsQuery = order.address
                        ? encodeURIComponent(order.address)
                        : "";
                      const scheduleLabel =
                        order.scheduleType === "later"
                          ? `Scheduled for ${formatTimestamp(
                              order.scheduledFor
                            )}`
                          : "ASAP delivery";
                      const assignedLabel = order.assignedDriverName
                        ? order.assignedDriverName
                        : order.assignedDriverUid
                        ? `Driver ${order.assignedDriverUid.slice(0, 6)}`
                        : "Unassigned";
                      const canAssign =
                        order.status === "PENDING" ||
                        order.status === "CONFIRMED";
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
                                    STATUS_STYLES[order.status ?? "PENDING"]
                                  }`}
                                >
                                  {formatStatusLabel(order.status ?? "PENDING")}
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
                                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-amber-300 hover:text-slate-900"
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
                                  className="mt-3 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-amber-300 hover:text-slate-900"
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
                              <p className="mt-1 text-xs text-slate-500">
                                {scheduleLabel}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Assigned: {assignedLabel}
                              </p>
                            </div>
                          </div>

                          {canAssign && (
                            <div className="mt-5 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                Driver Assignment
                              </p>
                              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <select
                                  value={driverSelections[order.id] ?? ""}
                                  onChange={(event) =>
                                    setDriverSelections((prev) => ({
                                      ...prev,
                                      [order.id]: event.target.value,
                                    }))
                                  }
                                  className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 sm:max-w-xs"
                                  disabled={driversLoading}
                                >
                                  <option value="">
                                    {driversLoading
                                      ? "Loading drivers..."
                                      : "Select a driver"}
                                  </option>
                                  {drivers.map((driver) => (
                                    <option key={driver.uid} value={driver.uid}>
                                      {driver.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleAssignDriver(order)}
                                  disabled={
                                    assigningOrderId === order.id ||
                                    !driverSelections[order.id]
                                  }
                                  className="inline-flex items-center justify-center rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                >
                                  {assigningOrderId === order.id
                                    ? "Assigning..."
                                    : "Assign Driver"}
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-slate-500">
                              Created: {formatTimestamp(order.createdAt)}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {order.status === "PENDING" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateStatus(order.id, "CONFIRMED")
                                    }
                                    className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateStatus(order.id, "CANCELLED")
                                    }
                                    className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                              {order.status === "CONFIRMED" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => updateStatus(order.id, "PENDING")}
                                    className="rounded-full border border-amber-200 bg-white px-4 py-2 text-xs font-semibold text-amber-700 transition hover:border-amber-300 hover:text-amber-900"
                                  >
                                    Revert to Pending
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateStatus(order.id, "CANCELLED")
                                    }
                                    className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="mt-8 max-w-xl">
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg backdrop-blur sm:p-8">
                  {settingsLoading ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                      Loading settings...
                    </div>
                  ) : (
                    <form onSubmit={handleSaveSettings} className="space-y-5">
                      <div>
                        <label className="text-sm font-semibold text-slate-600">
                          Tank capacity (liters)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={tankCapacityInput}
                          onChange={(event) =>
                            setTankCapacityInput(event.target.value)
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                          placeholder="Enter capacity in liters"
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="text-sm font-semibold text-slate-600">
                            Price per 1000L
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={pricePer1000Input}
                            onChange={(event) =>
                              setPricePer1000Input(event.target.value)
                            }
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                            placeholder="e.g. 250"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-slate-600">
                            Delivery fee
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={deliveryFeeInput}
                            onChange={(event) =>
                              setDeliveryFeeInput(event.target.value)
                            }
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                            placeholder="e.g. 0"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-slate-600">
                          Daily delivery goal (orders)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={dailyGoalInput}
                          onChange={(event) =>
                            setDailyGoalInput(event.target.value)
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                          placeholder="e.g. 10"
                        />
                      </div>
                      <div className="pt-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Business Card
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-slate-600">
                          Business name
                        </label>
                        <input
                          type="text"
                          value={businessNameInput}
                          onChange={(event) =>
                            setBusinessNameInput(event.target.value)
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                          placeholder="Business name"
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="text-sm font-semibold text-slate-600">
                            Business phone
                          </label>
                          <input
                            type="tel"
                            value={businessPhoneInput}
                            onChange={(event) =>
                              setBusinessPhoneInput(event.target.value)
                            }
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                            placeholder="+27 82 000 0000"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-slate-600">
                            Business email
                          </label>
                          <input
                            type="email"
                            value={businessEmailInput}
                            onChange={(event) =>
                              setBusinessEmailInput(event.target.value)
                            }
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                            placeholder="hello@business.com"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-slate-600">
                          Business address
                        </label>
                        <input
                          type="text"
                          value={businessAddressInput}
                          onChange={(event) =>
                            setBusinessAddressInput(event.target.value)
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                          placeholder="Street address"
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="text-sm font-semibold text-slate-600">
                            WhatsApp number
                          </label>
                          <input
                            type="tel"
                            value={businessWhatsappInput}
                            onChange={(event) =>
                              setBusinessWhatsappInput(event.target.value)
                            }
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                            placeholder="Optional"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-slate-600">
                            Business hours
                          </label>
                          <input
                            type="text"
                            value={businessHoursInput}
                            onChange={(event) =>
                              setBusinessHoursInput(event.target.value)
                            }
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                            placeholder="Mon-Sat 8am - 6pm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-slate-600">
                          Business note
                        </label>
                        <textarea
                          value={businessNoteInput}
                          onChange={(event) =>
                            setBusinessNoteInput(event.target.value)
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                          placeholder="Short message for customers"
                          rows={3}
                        />
                      </div>
                      {settingsError && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                          {settingsError}
                        </div>
                      )}
                      {settingsMessage && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                          {settingsMessage}
                        </div>
                      )}
                      <button
                        type="submit"
                        className="flex w-full items-center justify-center rounded-full bg-amber-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
                      >
                        {settingsExists ? "Update Settings" : "Save Settings"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
