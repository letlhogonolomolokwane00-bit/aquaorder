import { Timestamp } from "firebase/firestore";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export type Order = {
  id: string;
  customerUid?: string;
  customerName?: string;
  customerPhone?: string;
  address?: string;
  landmark?: string;
  waterType?: string;
  liters?: number;
  paymentMethod?: string;
  scheduleType?: string;
  scheduledFor?: Timestamp | null;
  status?: OrderStatus;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  assignedDriverUid?: string | null;
  assignedDriverName?: string | null;
};

export type AppSettings = {
  tankCapacityLiters?: number;
  updatedAt?: Timestamp | null;
};

export const formatTimestamp = (timestamp?: Timestamp | null) => {
  if (!timestamp) return "—";
  const date = timestamp.toDate();
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const digitsOnly = (value?: string) => (value ? value.replace(/\D/g, "") : "");

export const formatStatusLabel = (status?: string) =>
  status ? status.replace(/_/g, " ") : "—";

export const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export const endOfToday = () => {
  const start = startOfToday();
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return end;
};
