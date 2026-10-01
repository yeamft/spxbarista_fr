/**
 * Socket.IO order event channel (Express backend).
 */
import { formatSyncClock } from "@/lib/date-time";
import { toast } from "@/lib/toast";
import { loadSystemSettings } from "@/lib/system-settings";
import { getApiToken, getSocketUrl, isExpressApiConfigured } from "@/lib/api/express-client";

export type OrdersSocketEventType =
  | "order:created"
  | "order:updated"
  | "order:status"
  | "order:transferred"
  | "order:transfer-requested"
  | "order:transfer-rejected"
  | "order:merged"
  | "order:split"
  | "order:paid"
  | "order:closed"
  | "order:cancelled"
  | "order:return-requested"
  | "order:returned"
  | "ticket:accepted"
  | "ticket:preparing"
  | "ticket:ready"
  | "ticket:served"
  | "kitchen:reprint"
  | "kitchen:void"
  | "sync";

export interface OrdersSocketEvent {
  type: OrdersSocketEventType;
  orderId?: string;
  orderNo?: string;
  message: string;
  actor?: string;
  at: string;
  meta?: Record<string, unknown>;
}

type Listener = (event: OrdersSocketEvent) => void;

const listeners = new Set<Listener>();
const recent: OrdersSocketEvent[] = [];
const MAX_RECENT = 40;
let socketIo: { emit: (event: string, payload: unknown) => void; disconnect: () => void } | null = null;
let connectRefs = 0;
let sharedDisconnect: (() => void) | null = null;
let connecting: Promise<void> | null = null;

function pushRecent(event: OrdersSocketEvent) {
  recent.unshift(event);
  if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
}

export function getRecentOrdersSocketEvents() {
  return [...recent];
}

export function subscribeOrdersSocket(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyLocal(event: OrdersSocketEvent) {
  pushRecent(event);
  for (const listener of listeners) listener(event);
}

export function emitOrdersSocketEvent(
  event: Omit<OrdersSocketEvent, "at"> & { at?: string },
  options?: { toast?: boolean; broadcast?: boolean },
) {
  const full: OrdersSocketEvent = {
    ...event,
    at: event.at ?? formatSyncClock(new Date(), loadSystemSettings().calendar),
  };
  notifyLocal(full);

  if (options?.toast !== false) {
    toast.message(full.message, {
      description: [full.orderNo, full.actor, full.at].filter(Boolean).join(" · "),
    });
  }

  if (options?.broadcast === false) return;

  if (socketIo) {
    socketIo.emit("orders:event", full);
  }
}

async function startOrdersSocket() {
  if (!isExpressApiConfigured()) {
    sharedDisconnect = () => {
      socketIo?.disconnect();
      socketIo = null;
    };
    return;
  }

  try {
    const mod = await import("socket.io-client");
    const token = getApiToken();
    const socket = mod.io(getSocketUrl(), {
      transports: ["websocket", "polling"],
      path: "/socket.io",
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 8_000,
    });
    socket.on("orders:event", (payload: OrdersSocketEvent) => {
      notifyLocal(payload);
      if (payload.type !== "order:return-requested" && payload.type !== "sync") {
        toast.message(payload.message, {
          description: [payload.orderNo, payload.actor, payload.at].filter(Boolean).join(" · "),
        });
      }
    });
    socketIo = {
      emit: (event, payload) => {
        socket.emit(event, payload);
      },
      disconnect: () => {
        socket.disconnect();
      },
    };
    sharedDisconnect = () => {
      socketIo?.disconnect();
      socketIo = null;
    };
  } catch {
    sharedDisconnect = () => {
      socketIo?.disconnect();
      socketIo = null;
    };
  }
}

export async function connectOrdersSocket() {
  if (typeof window === "undefined") return () => undefined;

  connectRefs += 1;
  if (!sharedDisconnect && !connecting) {
    connecting = startOrdersSocket().finally(() => {
      connecting = null;
    });
  }
  if (connecting) await connecting;

  return () => {
    connectRefs = Math.max(0, connectRefs - 1);
    if (connectRefs === 0 && sharedDisconnect) {
      sharedDisconnect();
      sharedDisconnect = null;
    }
  };
}

export function ordersRealtimeTransportLabel() {
  if (isExpressApiConfigured()) return "Socket.IO";
  return "Local";
}
