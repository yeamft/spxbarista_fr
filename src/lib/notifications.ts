import { canApproveOrderReturns, canApproveWaiterBillTransfers, type AuthUser, type UserRole } from "./auth-context.ts";
import { activeBaristaCalls, callsForBarista, type BaristaCall } from "./barista-call.ts";
import {
  onDutyBaristas,
  type BaristaShift,
} from "./barista-availability.ts";
import { isFinalOrderStatus, type Order, type ProductionStation } from "./demo-data.ts";
import { canApproveReturnOrder, summarizeReturnRequestedLines } from "./orders-ops.ts";
import { ordersWithPendingWaiterTransfer } from "./waiter-bill-transfer.ts";
import { assignedWaiterMatches } from "./waiter-identity.ts";
import type { AppLang } from "./lang-context.ts";
import { orderLineName, selectText } from "./i18n.ts";
import { resolveUserAssignedLocations } from "./inventory-access.ts";
import {
  defaultProductionStations,
  findStation,
} from "./stations.ts";
import type {
  StockLocationBalance,
  StockRequestRecord,
  StockTransferRecord,
} from "./stock-management.ts";

export type NotificationTone = "ember" | "gold" | "teff" | "muted";
export type NotificationKind =
  | "cashier-request"
  | "waiter-update"
  | "station-ticket"
  | "void-request"
  | "return-request"
  | "transfer-request"
  | "barista-call"
  | "barista-availability";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  time: string;
  tone: NotificationTone;
  orderId: string;
  orderNo: string;
  area: string;
  tableNumber: string;
  waiter: string;
  total: number;
  href: string;
  actionLabel?: string;
  voidReason?: string;
  returnReason?: string;
};

function stationByKeywords(stations: readonly ProductionStation[], keywords: string[]) {
  return stations.find((station) => {
    const key = station.toLowerCase();
    return keywords.some((keyword) => key.includes(keyword));
  });
}

function roleStation(
  stations: readonly ProductionStation[],
  preferred: string,
  keywords: string[],
) {
  const exact = findStation(preferred, stations);
  const keyword = stationByKeywords(stations, keywords);
  const target = exact ?? keyword;
  return target ? [target] : [];
}

export type BarOrderScope = "vip" | "main" | "all";

export function isVipSeatingArea(area?: string | null) {
  return area?.trim().toLowerCase().includes("vip") ?? false;
}

export function barScopeFromUser(
  user: Pick<AuthUser, "role" | "assignedInventoryLocations">,
): BarOrderScope {
  const locations = resolveUserAssignedLocations(user);
  const hasVip = locations.includes("VIP Bar");
  const hasMain = locations.includes("Main Bar");
  if (hasVip && !hasMain) return "vip";
  if (hasMain && !hasVip) return "main";
  if (user.role === "Bartender") return "vip";
  if (user.role === "Bar Staff") return "main";
  return "all";
}

export function orderMatchesBarScope(
  order: Pick<Order, "area">,
  scope: BarOrderScope,
  ticketStation?: string,
) {
  if (scope === "all") return true;
  const stationKey = ticketStation?.trim().toLowerCase() ?? "";
  const vipTicket = stationKey.includes("vip") && stationKey.includes("bar");
  const vipOrder = isVipSeatingArea(order.area) || vipTicket;
  return scope === "vip" ? vipOrder : !vipOrder;
}

export function stationsForRole(
  role: UserRole,
  configuredStations: readonly ProductionStation[] = defaultProductionStations(),
): ProductionStation[] {
  const stations = configuredStations.length > 0 ? configuredStations : defaultProductionStations();
  if (
    role === "Barista" ||
    role === "Coffee House Staff" ||
    role === "Chef" ||
    role === "Kitchen Staff"
  ) {
    return [...stations];
  }
  if (role === "Bartender" || role === "Bar Staff") {
    return roleStation(stations, "Coffee Station Pickup", ["coffee", "pickup"]);
  }
  if (role === "Butcher House Staff" || role === "Butcher Staff") {
    return roleStation(stations, "Coffee Station Pickup", ["coffee", "pickup"]);
  }
  return [];
}

export function isOperationalDashboardRole(role: UserRole) {
  return [
    "Barista",
    "Kitchen Staff",
    "Bartender",
    "Bar Staff",
    "Storekeeper",
    "Inventory Staff",
    "Procurement Officer",
    "Store Manager",
    "Inventory Administrator",
    "Butcher House Staff",
    "Butcher Staff",
    "Coffee House Staff",
    "Chef",
  ].includes(role);
}

function waiterTitle(order: Order, lang: AppLang) {
  if (order.status === "PENDING_CASHIER") return selectText(lang, "Waiting for cashier", "ካሸርን እየጠበቀ");
  if (order.status === "READY TO SERVE") return selectText(lang, "Ready to serve", "ለማቅረብ ዝግጁ");
  if (order.status === "PARTIALLY READY") return selectText(lang, "Partially ready", "በከፊል ዝግጁ");
  if (order.paymentStatus === "Paid") return selectText(lang, "Bill paid, still open", "ተከፍሏል፣ ሂሳቡ ክፍት ነው");
  return selectText(lang, "Open bill", "ክፍት ሂሳብ");
}

function waiterTone(order: Order): NotificationTone {
  if (order.status === "PENDING_CASHIER") return "gold";
  if (order.status === "READY TO SERVE") return "teff";
  if (order.status === "PARTIALLY READY") return "gold";
  if (order.paymentStatus === "Paid") return "teff";
  return "ember";
}

function formatLineQty(qty: number, unitLabel?: string) {
  const value = qty.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return unitLabel ? `${value} ${unitLabel}` : `${value}x`;
}

export function getNotificationsForUser(
  user: AuthUser,
  orders: Order[],
  _stock: readonly StockLocationBalance[] = [],
  _requests: readonly StockRequestRecord[] = [],
  _transfers: readonly StockTransferRecord[] = [],
  configuredStations: readonly ProductionStation[] = defaultProductionStations(),
  menuItems: readonly { id: string; name_en: string; name_am?: string }[] = [],
  lang: AppLang = "en",
  baristaCalls: readonly BaristaCall[] = [],
  baristaShifts: readonly BaristaShift[] = [],
): AppNotification[] {
  const notifications: AppNotification[] = [];
  const role = user.role;
  const isManager =
    role === "Branch Manager" ||
    role === "Manager" ||
    role === "Administrator" ||
    role === "Supervisor";
  const isCashier = role === "Cashier" || role === "User" || isManager;

  const dutyStaff =
    role === "User" ||
    role === "Cashier" ||
    role === "Coffee House Staff" ||
    role === "Administrator" ||
    role === "Manager" ||
    role === "Supervisor" ||
    isManager;

  if (dutyStaff) {
    const onDuty = onDutyBaristas(baristaShifts);
    if (onDuty.length > 0) {
      onDuty.forEach((shift) => {
        notifications.push({
          id: `barista-available-${shift.baristaId}`,
          kind: "barista-availability",
          title: selectText(lang, "Barista available", "ባሪስታ ተገኝቷል"),
          detail: selectText(
            lang,
            `${shift.baristaName} is clocked in — Service Desk is open for orders.`,
            `${shift.baristaName} ገብቷል — ሰርቪስ ዴስክ ለትዕዛዝ ክፍት ነው።`,
          ),
          time: shift.clockedInAt || shift.updatedAt,
          tone: "teff",
          orderId: shift.baristaId,
          orderNo: "DUTY",
          area: "Service Desk",
          tableNumber: "",
          waiter: shift.baristaName,
          total: 0,
          href: "/app/pos",
          actionLabel: selectText(lang, "Place order", "ትዕዛዝ አስገባ"),
        });
      });
    } else {
      notifications.push({
        id: "barista-unavailable",
        kind: "barista-availability",
        title: selectText(lang, "No barista on duty", "ባሪስታ አልተገኘም"),
        detail: selectText(
          lang,
          "Service Desk ordering is paused until a barista clocks in.",
          "ባሪስታ እስኪገባ ድረስ የሰርቪስ ዴስክ ትዕዛዝ ቆሟል።",
        ),
        time: new Date().toISOString(),
        tone: "gold",
        orderId: "duty",
        orderNo: "DUTY",
        area: "Service Desk",
        tableNumber: "",
        waiter: "",
        total: 0,
        href: "/app/notifications",
      });
    }
  }

  if (role === "Barista" || role === "Coffee House Staff" || isManager || role === "Administrator" || role === "Supervisor") {
    const relevant =
      role === "Barista"
        ? callsForBarista(baristaCalls, user.name)
        : activeBaristaCalls(baristaCalls);
    relevant.forEach((call) => {
      if (call.status === "done") return;
      notifications.push({
        id: `barista-call-${call.id}`,
        kind: "barista-call",
        title:
          call.status === "acknowledged"
            ? selectText(lang, "Barista call acknowledged", "የባሪስታ ጥሪ ተቀባይነት አግኝቷል")
            : selectText(lang, "Barista assistance requested", "የባሪስታ እገዛ ተጠይቋል"),
        detail: selectText(
          lang,
          `${call.requestedBy} needs help at ${call.location || "Service Desk"}${call.note ? ` — ${call.note}` : ""}.`,
          `${call.requestedBy} በ ${call.location || "ሰርቪስ ዴስክ"} እገዛ ይፈልጋል${call.note ? ` — ${call.note}` : "።"}`,
        ),
        time: call.createdAt,
        tone: call.status === "open" ? "ember" : "gold",
        orderId: call.id,
        orderNo: "CALL",
        area: call.location || "Service Desk",
        tableNumber: "",
        waiter: call.baristaName || call.requestedBy,
        total: 0,
        href: "/app/notifications",
        actionLabel:
          call.status === "open"
            ? selectText(lang, "I'm coming", "እየመጣሁ ነው")
            : selectText(lang, "Close call", "ጥሪ ዝጋ"),
      });
    });
  }

  if (isManager) {
    orders
      .filter((order) => order.voidRequestedBy && !isFinalOrderStatus(order.status))
      .forEach((order) => {
        notifications.push({
          id: `void-${order.id}`,
          kind: "void-request",
          title: selectText(lang, "Void order requested", "ትዕዛዝ መሰረዝ ተጠይቋል"),
          detail: selectText(
            lang,
            `${order.voidRequestedBy} requested to void order ${order.orderNo} (${order.area} ${order.tableNumber})${order.voidReason ? `: "${order.voidReason}"` : "."}`,
            `${order.voidRequestedBy} ትዕዛዝ ${order.orderNo} (${order.area} ${order.tableNumber}) እንዲሰረዝ ጠይቋል${order.voidReason ? `፦ "${order.voidReason}"` : "።"}`,
          ),
          time: order.voidRequestedAt ?? order.sentAt,
          tone: "ember",
          orderId: order.id,
          orderNo: order.orderNo,
          area: order.area,
          tableNumber: order.tableNumber,
          waiter: order.waiter,
          total: order.total,
          href: "/app/orders",
          actionLabel: selectText(lang, "Review & approve", "ይገምግሙ እና ያፅድቁ"),
          voidReason: order.voidReason,
        });
      });
  }

  if (canApproveOrderReturns(role) || role === "Branch Manager") {
    orders
      .filter((order) => canApproveReturnOrder(order))
      .forEach((order) => {
        const itemSummary = summarizeReturnRequestedLines(order.items, order.returnRequestedLines);
        notifications.push({
          id: `return-${order.id}`,
          kind: "return-request",
          title: selectText(lang, "Order return requested", "የትዕዛዝ መልስ ተጠይቋል"),
          detail: selectText(
            lang,
            `${order.returnRequestedBy} requested to return ${order.orderNo} (${order.area} ${order.tableNumber})${itemSummary ? ` — ${itemSummary}` : ""}${order.returnReason ? `: "${order.returnReason}"` : "."}`,
            `${order.returnRequestedBy} ${order.orderNo} (${order.area} ${order.tableNumber}) እንዲመለስ ጠይቋል${itemSummary ? ` — ${itemSummary}` : ""}${order.returnReason ? `፦ "${order.returnReason}"` : "።"}`,
          ),
          time: order.returnRequestedAt ?? order.sentAt,
          tone: "ember",
          orderId: order.id,
          orderNo: order.orderNo,
          area: order.area,
          tableNumber: order.tableNumber,
          waiter: order.waiter,
          total: order.total,
          href: "/app/orders",
          actionLabel: selectText(lang, "Review & approve", "ይገምግሙ እና ያፅድቁ"),
          returnReason: order.returnReason,
        });
      });
  }

  if (canApproveWaiterBillTransfers(role)) {
    const pending = ordersWithPendingWaiterTransfer(orders);
    const groups = new Map<string, Order[]>();
    for (const order of pending) {
      const from = order.waiter.trim();
      const to = order.waiterTransferRequestedTo?.trim() || "";
      const key = `${from.toLowerCase()}=>${to.toLowerCase()}`;
      const list = groups.get(key) ?? [];
      list.push(order);
      groups.set(key, list);
    }
    for (const [key, group] of groups) {
      const [from, to] = key.split("=>");
      const first = group[0];
      if (!first || !from || !to) continue;
      notifications.push({
        id: `transfer-${key}`,
        kind: "transfer-request",
        title: selectText(lang, "Bill transfer requested", "የሂሳብ ማስተላለፍ ተጠይቋል"),
        detail: selectText(
          lang,
          `${first.waiterTransferRequestedBy || first.waiter} requested ${group.length} open bill(s) from ${first.waiter} to ${first.waiterTransferRequestedTo}.`,
          `${first.waiterTransferRequestedBy || first.waiter} ${group.length} ክፍት ሂሳብ ከ ${first.waiter} ወደ ${first.waiterTransferRequestedTo} እንዲተላለፍ ጠይቋል።`,
        ),
        time: first.waiterTransferRequestedAt ?? first.sentAt,
        tone: "ember",
        orderId: first.id,
        orderNo: first.orderNo,
        area: first.area,
        tableNumber: first.tableNumber,
        waiter: first.waiter,
        total: group.reduce((sum, order) => sum + order.total, 0),
        href: "/app/orders",
        actionLabel: selectText(lang, "Review & approve", "ይገምግሙ እና ያፅድቁ"),
      });
    }
  }

  if (isCashier) {
    orders
      .filter((order) => order.status === "PENDING_CASHIER")
      .forEach((order) => {
        notifications.push({
          id: `cashier-${order.id}`,
          kind: "cashier-request",
          title: selectText(lang, "Barista order waiting", "የባሪስታ ትዕዛዝ እየተጠበቀ"),
          detail: selectText(
            lang,
            `${order.waiter} sent ${order.items.length} item${order.items.length === 1 ? "" : "s"} for cashier acceptance.`,
            `${order.waiter} ${order.items.length} እቃ${order.items.length === 1 ? "" : "ዎች"} ለካሸር ማረጋገጫ ላከ።`,
          ),
          time: order.requestedAt ?? order.sentAt,
          tone: "ember",
          orderId: order.id,
          orderNo: order.orderNo,
          area: order.area,
          tableNumber: order.tableNumber,
          waiter: order.waiter,
          total: order.total,
          href: "/app/pos",
          actionLabel: selectText(lang, "Accept and send", "ተቀብለህ ላክ"),
        });
      });
  }

  const stationRoles = stationsForRole(role, configuredStations);
  if (stationRoles.length > 0) {
    const barScope = barScopeFromUser(user);
    orders
      .filter((order) => !isFinalOrderStatus(order.status) && order.status !== "PENDING_CASHIER")
      .forEach((order) => {
        order.stationTickets
          .filter(
            (ticket) =>
              (ticket.status === "NEW" || ticket.status === "PREPARING") &&
              stationRoles.some((station) => station.toLowerCase() === ticket.station.toLowerCase()) &&
              orderMatchesBarScope(order, barScope, ticket.station),
          )
          .forEach((ticket) => {
            notifications.push({
              id: `station-${order.id}-${ticket.id}-${ticket.status}`,
              kind: "station-ticket",
              title:
                ticket.status === "NEW"
                  ? selectText(lang, `New ${ticket.station} ticket`, `አዲስ ${ticket.station} ቲኬት`)
                  : selectText(lang, `${ticket.station} preparing`, `${ticket.station} እየተዘጋጀ`),
              detail: `${order.orderNo} · ${order.area} ${order.tableNumber} · ${ticket.items
                .map((item) => `${formatLineQty(item.qty, item.unitLabel)} ${orderLineName(item, menuItems, lang)}`)
                .join(", ")}`,
              time: ticket.sentAt,
              tone: ticket.status === "NEW" ? "ember" : "gold",
              orderId: order.id,
              orderNo: order.orderNo,
              area: order.area,
              tableNumber: order.tableNumber,
              waiter: order.waiter,
              total: order.total,
              href: "/app/kds",
              actionLabel: selectText(lang, "Open station tickets", "የጣቢያ ቲኬቶችን ክፈት"),
            });
          });
      });
  }

  if (role === "Barista") {
    orders
      .filter(
        (order) =>
          !isFinalOrderStatus(order.status) &&
          (assignedWaiterMatches(order.waiter, user) ||
            assignedWaiterMatches(order.orderedByWaiter, user)),
      )
      .forEach((order) => {
        notifications.push({
          id: `waiter-${order.id}-${order.status}`,
          kind: "waiter-update",
          title: waiterTitle(order, lang),
          detail: `${order.area} ${order.tableNumber} - ${order.items
            .map((item) => `${formatLineQty(item.qty, item.unitLabel)} ${orderLineName(item, menuItems, lang)}`)
            .join(", ")}`,
          time:
            order.status === "PENDING_CASHIER"
              ? (order.requestedAt ?? order.sentAt)
              : (order.stationSentAt ?? order.sentAt),
          tone: waiterTone(order),
          orderId: order.id,
          orderNo: order.orderNo,
          area: order.area,
          tableNumber: order.tableNumber,
          waiter: order.waiter,
          total: order.total,
          href: "/app/pos",
        });
      });
  }

  return notifications.sort((a, b) => {
    const rank = (item: AppNotification) => {
      if (item.kind === "barista-call" && item.tone === "ember") return 0;
      if (item.kind === "return-request") return 1;
      if (item.kind === "transfer-request" || item.kind === "void-request") return 2;
      if (item.tone === "ember") return 3;
      return 4;
    };
    const byKind = rank(a) - rank(b);
    if (byKind !== 0) return byKind;
    return a.time.localeCompare(b.time);
  });
}
