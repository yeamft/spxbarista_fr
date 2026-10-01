/**
 * Express + MongoDB backend adapters for POS sync and realtime.
 */
import type { Order } from "@/lib/demo-data";
import {
  apiBulkUpsertOrders,
  apiListCategories,
  apiListMenuItems,
  apiListOrders,
  apiListStations,
  getApiToken,
  getSocketUrl,
  isExpressApiConfigured,
} from "@/lib/api/express-client";

export type BackendRealtimeStatus = "disabled" | "connecting" | "connected" | "error";

export type BackendSnapshot = {
  menuItems?: unknown[];
  menuCategories?: string[];
  menuStations?: string[];
  orders?: Order[];
  tables?: unknown[];
} | null;

function asOrder(row: Record<string, unknown>): Order | null {
  if (!row || typeof row.id !== "string" || typeof row.orderNo !== "string") return null;
  return row as unknown as Order;
}

export async function loadBackendSnapshot(options?: { only?: string[] }) {
  if (!isExpressApiConfigured() || !getApiToken()) return null;
  const only = new Set(options?.only ?? []);
  const wantAll = only.size === 0;
  const snapshot: NonNullable<BackendSnapshot> = {};

  try {
    if (wantAll || only.has("orders")) {
      const { orders } = await apiListOrders();
      snapshot.orders = orders
        .map((row) => asOrder(row))
        .filter((row): row is Order => Boolean(row));
    }

    if (wantAll || only.has("menuItems") || only.has("menu")) {
      const { items } = await apiListMenuItems();
      snapshot.menuItems = items.map((item) => ({
        id: item.id,
        name_en: item.name_en,
        name_am: item.name_am,
        category: item.category,
        price: item.price,
        cost: item.cost,
        station: item.station,
        emoji: item.emoji,
        unitLabel: item.unitLabel,
        available: item.available !== false,
      }));
    }

    if (wantAll || only.has("menuCategories") || only.has("menu")) {
      const { categories } = await apiListCategories();
      snapshot.menuCategories = categories
        .filter((row) => row.active !== false)
        .map((row) => row.name);
    }

    if (wantAll || only.has("menuStations") || only.has("stations")) {
      const { stations } = await apiListStations();
      snapshot.menuStations = stations
        .filter((row) => row.active !== false)
        .map((row) => row.name);
    }

    return snapshot;
  } catch {
    return null;
  }
}

export async function loadGuestOrderingSnapshot(..._args: unknown[]) {
  return null;
}

export async function loadBackendRestaurantProfile() {
  return null;
}

async function noop(..._args: unknown[]) {}

export const syncBackendMenuItems = noop;
export const upsertBackendMenuItem = noop;
export const syncBackendMenuCategories = noop;
export const deleteBackendMenuItem = noop;
export const syncBackendTables = noop;
export const upsertBackendTables = noop;
export const upsertBackendTable = noop;
export const deleteBackendTable = noop;
export const deleteBackendOrder = noop;
export const syncBackendStations = noop;
export const syncBackendStock = noop;
export const syncBackendSuppliers = noop;
export const deleteBackendSupplier = noop;
export const syncBackendReservations = noop;
export const deleteBackendReservation = noop;
export const syncBackendCustomers = noop;
export const syncBackendPayments = noop;
export const syncBackendSalesRecords = noop;
export const syncBackendExpenseRecords = noop;
export const syncBackendPurchaseOrders = noop;
export const syncBackendGuestOrders = noop;
export const syncBackendRestaurantProfile = noop;
export const upsertBackendGuestOrder = noop;
export const updateBackendGuestOrderStatus = noop;

export async function syncBackendOrders(orders: Order[]) {
  if (!isExpressApiConfigured() || !getApiToken()) return;
  if (!orders.length) return;
  // Chunk to keep payloads small and avoid long request stalls.
  const chunkSize = 25;
  for (let i = 0; i < orders.length; i += chunkSize) {
    const chunk = orders.slice(i, i + chunkSize);
    await apiBulkUpsertOrders(chunk as unknown as Record<string, unknown>[]);
  }
}

export async function fetchOrdersPage(_input: {
  limit?: number;
  cursor?: string | null;
  status?: string;
}) {
  if (!isExpressApiConfigured() || !getApiToken()) {
    return { rows: [] as unknown[], nextCursor: null as string | null };
  }
  const { orders } = await apiListOrders();
  return { rows: orders, nextCursor: null as string | null };
}

type SocketLike = {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler?: (...args: unknown[]) => void) => void;
  disconnect: () => void;
};

/**
 * Efficient realtime: prefer order patches; fall back to table hydrate signals.
 * Debounce is handled by the store's scheduleRealtimeHydrate.
 */
export function subscribeToBackendChanges(
  onChange: (payload: unknown) => void,
  setStatus?: (status: BackendRealtimeStatus) => void,
): { status: BackendRealtimeStatus; unsubscribe: () => void } {
  if (!isExpressApiConfigured()) {
    setStatus?.("disabled");
    return { status: "disabled", unsubscribe: () => undefined };
  }

  let socket: SocketLike | null = null;
  let stopped = false;
  setStatus?.("connecting");

  void (async () => {
    try {
      const mod = await import("socket.io-client");
      if (stopped) return;
      const token = getApiToken();
      socket = mod.io(getSocketUrl(), {
        transports: ["websocket", "polling"],
        path: "/socket.io",
        auth: token ? { token } : undefined,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 800,
        reconnectionDelayMax: 8_000,
      }) as SocketLike;

      socket.on("connect", () => setStatus?.("connected"));
      socket.on("disconnect", () => setStatus?.("connecting"));
      socket.on("connect_error", () => setStatus?.("error"));

      const bumpOrders = () => onChange("orders");
      socket.on("orders:patch", (payload: unknown) => {
        // Patch stream — still ask store to merge via orders hydrate (debounced).
        if (payload && typeof payload === "object" && "order" in (payload as object)) {
          try {
            window.dispatchEvent(
              new CustomEvent("ep:orders-patch", { detail: payload }),
            );
          } catch {
            // ignore
          }
        }
        bumpOrders();
      });
      socket.on("orders:event", (payload: unknown) => {
        const type =
          payload && typeof payload === "object" && "type" in payload
            ? String((payload as { type: unknown }).type)
            : "";
        if (type === "sync") return;
        bumpOrders();
      });
      socket.on("menu:updated", () => onChange("menuItems"));
      socket.on("stations:updated", () => onChange("menuStations"));
      socket.on("categories:updated", () => onChange("menuCategories"));

      setStatus?.("connected");
    } catch {
      setStatus?.("error");
    }
  })();

  return {
    status: "connecting",
    unsubscribe: () => {
      stopped = true;
      try {
        socket?.disconnect();
      } catch {
        // ignore
      }
      socket = null;
      setStatus?.("disabled");
    },
  };
}
