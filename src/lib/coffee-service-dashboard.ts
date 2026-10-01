import {
  SEATING_AREAS,
  type MenuItem,
  type Order,
  type StationTicket,
} from "@/lib/demo-data";
import { isOrderToday } from "@/lib/orders-ops";
import { dateKey, dateKeyFromDateTime } from "@/lib/sales-analytics";

export type CoffeeServicePhase =
  | "new"
  | "accepted"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export type CoffeeQueueRow = {
  id: string;
  orderNo: string;
  employee: string;
  itemsLabel: string;
  serveAt: string;
  phase: CoffeeServicePhase;
  waitingMinutes: number;
  createdAtMs: number;
  /** 1-based place in the active queue (earlier = served sooner). */
  position: number;
  /** How many active orders are ahead of this one. */
  aheadCount: number;
};

export type UserQueuePlace = {
  row: CoffeeQueueRow;
  position: number;
  aheadCount: number;
  totalInQueue: number;
};

function namesMatch(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Active queue rows belonging to this employee (newest match first via queue order). */
export function findUserQueuePlace(
  queue: readonly CoffeeQueueRow[],
  userName: string,
): UserQueuePlace | null {
  const match = queue.find((row) => namesMatch(row.employee, userName));
  if (!match) return null;
  return {
    row: match,
    position: match.position,
    aheadCount: match.aheadCount,
    totalInQueue: queue.length,
  };
}

export type NamedCount = { name: string; count: number };

export type CoffeeServiceOverview = {
  ordersToday: number;
  activeOrders: number;
  readyForService: number;
  completedToday: number;
  cancelledToday: number;
  avgPrepMinutes: number | null;
  avgWaitMinutes: number | null;
  fastestPrepMinutes: number | null;
  ordersOverTenMinutes: number;
  completionRate: number | null;
  employeesServed: number;
  phaseCounts: Record<CoffeeServicePhase, number>;
  queue: CoffeeQueueRow[];
  mostOrdered: NamedCount[];
  byLocation: NamedCount[];
  byDepartment: NamedCount[];
  peakHours: Array<{ label: string; count: number }>;
  unavailableItems: Array<{ id: string; name: string }>;
  activity: Array<{ atMs: number; timeLabel: string; text: string }>;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseMs(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function orderCreatedMs(order: Order) {
  return (
    parseMs(order.createdAtIso) ??
    parseMs(order.requestedAt) ??
    parseMs(order.sentAt) ??
    parseMs(order.cashierAcceptedAt) ??
    Date.now()
  );
}

export function orderEmployeeName(order: Order) {
  return (order.customerName || order.orderedByWaiter || order.waiter || "Guest").trim() || "Guest";
}

export function orderServeAt(order: Order) {
  const table = order.tableNumber?.trim() || "";
  const area = order.area?.trim() || "";
  if (table && area && table.toLowerCase() !== area.toLowerCase()) {
    return `${area} · ${table}`;
  }
  return table || area || "Coffee Station Pickup";
}

export function coffeePhase(order: Order): CoffeeServicePhase {
  if (order.status === "CANCELLED" || order.status === "RETURNED") return "cancelled";
  if (order.status === "CLOSED") return "completed";
  if (order.status === "READY TO SERVE" || order.status === "RECEIPT_GENERATED") return "ready";
  if (order.status === "PENDING_CASHIER") return "new";

  const tickets = order.stationTickets ?? [];
  if (tickets.some((ticket) => ticket.status === "PREPARING") || order.status === "PARTIALLY READY") {
    return "preparing";
  }
  if (tickets.length > 0 && tickets.every((ticket) => ticket.status === "NEW")) {
    const accepted =
      Boolean(order.cashierAcceptedAt) || tickets.some((ticket) => Boolean(ticket.acceptedAt));
    return accepted ? "accepted" : "new";
  }
  if (tickets.length === 0 && order.status === "NEW") return "new";
  if (tickets.some((ticket) => ticket.status === "READY")) return "ready";
  return "new";
}

function itemsLabel(order: Order) {
  const lines = order.items ?? [];
  if (lines.length === 0) return "—";
  if (lines.length === 1) {
    const line = lines[0]!;
    return `${line.qty} ${line.name}`;
  }
  const qty = lines.reduce((sum, line) => sum + line.qty, 0);
  return `${qty} items`;
}

function waitingMinutes(order: Order, nowMs: number) {
  return Math.max(0, Math.round((nowMs - orderCreatedMs(order)) / 60000));
}

function ticketAcceptedMs(ticket: StationTicket, order: Order) {
  return (
    parseMs(ticket.acceptedAt) ??
    parseMs(ticket.preparingAt) ??
    parseMs(order.cashierAcceptedAt) ??
    parseMs(ticket.sentAt) ??
    orderCreatedMs(order)
  );
}

function prepDurationsMinutes(order: Order) {
  const durations: number[] = [];
  for (const ticket of order.stationTickets ?? []) {
    const ready = parseMs(ticket.readyAt);
    if (ready == null) continue;
    const accepted = ticketAcceptedMs(ticket, order);
    if (accepted == null || ready < accepted) continue;
    durations.push((ready - accepted) / 60000);
  }
  return durations;
}

function totalWaitMinutes(order: Order) {
  const readyTimes = (order.stationTickets ?? [])
    .map((ticket) => parseMs(ticket.readyAt))
    .filter((ms): ms is number => ms != null);
  if (readyTimes.length === 0) {
    if (order.status === "CLOSED") {
      const closed = parseMs(order.payment?.closedAt) ?? parseMs(order.receiptGeneratedAt);
      if (closed != null) return (closed - orderCreatedMs(order)) / 60000;
    }
    return null;
  }
  return (Math.max(...readyTimes) - orderCreatedMs(order)) / 60000;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countMapToRows(map: Map<string, number>, limit = 8): NamedCount[] {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function hourLabel(hour: number) {
  const next = (hour + 1) % 24;
  const fmt = (h: number) => {
    const suffix = h >= 12 ? "PM" : "AM";
    const hr = h % 12 || 12;
    return `${hr} ${suffix}`;
  };
  return `${fmt(hour)}–${fmt(next)}`;
}

function formatClockLabel(ms: number) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildActivity(orders: readonly Order[], nowMs: number) {
  const events: Array<{ atMs: number; text: string }> = [];
  for (const order of orders) {
    const employee = orderEmployeeName(order);
    const created = orderCreatedMs(order);
    events.push({ atMs: created, text: `${employee} placed ${order.orderNo}` });
    for (const ticket of order.stationTickets ?? []) {
      const ready = parseMs(ticket.readyAt);
      if (ready != null) events.push({ atMs: ready, text: `${order.orderNo} marked Ready` });
      const preparing = parseMs(ticket.preparingAt);
      if (preparing != null) events.push({ atMs: preparing, text: `${order.orderNo} started preparing` });
    }
    if (order.status === "CLOSED") {
      const at = parseMs(order.payment?.closedAt) ?? parseMs(order.receiptGeneratedAt) ?? created;
      events.push({ atMs: at, text: `${order.orderNo} collected` });
    }
  }
  return events
    .filter((event) => event.atMs <= nowMs + 60_000)
    .sort((a, b) => b.atMs - a.atMs)
    .slice(0, 8)
    .map((event) => ({
      atMs: event.atMs,
      timeLabel: formatClockLabel(event.atMs),
      text: event.text,
    }));
}

export function isMenuItemAvailable(item: MenuItem) {
  return item.available !== false;
}

export function buildCoffeeServiceOverview(
  orders: readonly Order[],
  menuItems: readonly MenuItem[],
  options: {
    now?: Date;
    departmentsByEmployee?: ReadonlyMap<string, string>;
  } = {},
): CoffeeServiceOverview {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const departmentsByEmployee = options.departmentsByEmployee ?? new Map();
  const todayOrders = orders.filter((order) => isOrderToday(order, now));

  const phaseCounts: Record<CoffeeServicePhase, number> = {
    new: 0,
    accepted: 0,
    preparing: 0,
    ready: 0,
    completed: 0,
    cancelled: 0,
  };

  const drinkCounts = new Map<string, number>();
  const locationCounts = new Map<string, number>();
  for (const area of SEATING_AREAS) {
    locationCounts.set(area, 0);
  }
  const departmentCounts = new Map<string, number>();
  const hourCounts = new Map<number, number>();
  const employees = new Set<string>();
  const prepSamples: number[] = [];
  const waitSamples: number[] = [];
  const queue: CoffeeQueueRow[] = [];

  for (const order of todayOrders) {
    const phase = coffeePhase(order);
    phaseCounts[phase] += 1;
    employees.add(orderEmployeeName(order).toLowerCase());

    const location = orderServeAt(order);
    const locationKey =
      order.area?.trim() ||
      order.tableNumber?.trim() ||
      "Coffee Station Pickup";
    locationCounts.set(locationKey, (locationCounts.get(locationKey) ?? 0) + 1);

    const employeeKey = orderEmployeeName(order).toLowerCase();
    const department = departmentsByEmployee.get(employeeKey) || "General Office";
    departmentCounts.set(department, (departmentCounts.get(department) ?? 0) + 1);

    const created = new Date(orderCreatedMs(order));
    if (dateKey(created) === dateKey(now)) {
      hourCounts.set(created.getHours(), (hourCounts.get(created.getHours()) ?? 0) + 1);
    }

    for (const line of order.items ?? []) {
      const name = line.name.trim() || "Drink";
      drinkCounts.set(name, (drinkCounts.get(name) ?? 0) + line.qty);
    }

    for (const duration of prepDurationsMinutes(order)) prepSamples.push(duration);
    const wait = totalWaitMinutes(order);
    if (wait != null) waitSamples.push(wait);

    if (phase !== "completed" && phase !== "cancelled") {
      queue.push({
        id: order.id,
        orderNo: order.orderNo,
        employee: orderEmployeeName(order),
        itemsLabel: itemsLabel(order),
        serveAt: location,
        phase,
        waitingMinutes: waitingMinutes(order, nowMs),
        createdAtMs: orderCreatedMs(order),
        position: 0,
        aheadCount: 0,
      });
    }
  }

  const phaseRank: Record<CoffeeServicePhase, number> = {
    ready: 0,
    preparing: 1,
    accepted: 2,
    new: 3,
    completed: 4,
    cancelled: 5,
  };
  queue.sort((a, b) => phaseRank[a.phase] - phaseRank[b.phase] || a.createdAtMs - b.createdAtMs);
  queue.forEach((row, index) => {
    row.position = index + 1;
    row.aheadCount = index;
  });

  const completedToday = phaseCounts.completed;
  const cancelledToday = phaseCounts.cancelled;
  const finished = completedToday + cancelledToday;
  const avgPrepMinutes = average(prepSamples);
  const avgWaitMinutes = average(waitSamples);
  const fastestPrepMinutes = prepSamples.length ? Math.min(...prepSamples) : null;

  const peakHours = [...hourCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, count]) => ({ label: hourLabel(hour), count }));

  const peakDisplay =
    peakHours.length <= 6
      ? peakHours
      : [...peakHours].sort((a, b) => b.count - a.count).slice(0, 6).sort((a, b) => {
          return peakHours.findIndex((row) => row.label === a.label) - peakHours.findIndex((row) => row.label === b.label);
        });

  return {
    ordersToday: todayOrders.length,
    activeOrders: phaseCounts.new + phaseCounts.accepted + phaseCounts.preparing,
    readyForService: phaseCounts.ready,
    completedToday,
    cancelledToday,
    avgPrepMinutes,
    avgWaitMinutes,
    fastestPrepMinutes,
    ordersOverTenMinutes: todayOrders.filter((order) => {
      const phase = coffeePhase(order);
      if (phase === "cancelled" || phase === "completed") {
        const wait = totalWaitMinutes(order);
        return wait != null && wait > 10;
      }
      return waitingMinutes(order, nowMs) > 10;
    }).length,
    completionRate: finished > 0 ? (completedToday / finished) * 100 : null,
    employeesServed: employees.size,
    phaseCounts,
    queue,
    mostOrdered: countMapToRows(drinkCounts, 6),
    byLocation: SEATING_AREAS.map((name) => ({
      name,
      count: locationCounts.get(name) ?? 0,
    })),
    byDepartment: countMapToRows(departmentCounts, 8),
    peakHours: peakDisplay,
    unavailableItems: menuItems
      .filter((item) => !isMenuItemAvailable(item))
      .map((item) => ({ id: item.id, name: item.name_en || item.name_am || item.id })),
    activity: buildActivity(todayOrders, nowMs),
  };
}

export function formatDurationMinutes(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  const totalSeconds = Math.max(0, Math.round(value * 60));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${pad(seconds)}s`;
}

export function orderDayKey(order: Order) {
  return (
    dateKeyFromDateTime(order.createdAtIso) ??
    dateKeyFromDateTime(order.requestedAt) ??
    dateKeyFromDateTime(order.sentAt)
  );
}
