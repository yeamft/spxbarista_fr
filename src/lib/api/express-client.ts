/**
 * Express API client for the coffee service backend (MongoDB + Socket.IO).
 */
const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};

export function getApiBaseUrl() {
  return (env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");
}

export function getSocketUrl() {
  return (env.VITE_SOCKET_IO_URL || getApiBaseUrl()).replace(/\/$/, "");
}

export function isExpressApiConfigured() {
  return Boolean(env.VITE_API_URL || env.VITE_SOCKET_IO_URL);
}

const TOKEN_KEY = "ep_api_token";

export function getApiToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) || "";
}

export function setApiToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) window.localStorage.removeItem(TOKEN_KEY);
  else window.localStorage.setItem(TOKEN_KEY, token);
}

export type ApiUser = {
  id: string;
  email?: string;
  username?: string;
  name: string;
  role: string;
  branch: string;
  avatar?: string;
  /** Present for coffee-office PIN directory (same as username/pin). */
  password?: string;
};

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = options.token === undefined ? getApiToken() : options.token;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `API ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export async function apiLogin(login: string, password: string) {
  const result = await apiFetch<{ token: string; user: ApiUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ login, password }),
    token: null,
  });
  setApiToken(result.token);
  return result;
}

export async function apiMe() {
  return apiFetch<ApiUser>("/api/auth/me");
}

export async function apiHealth() {
  return apiFetch<{ ok: boolean; service: string; time: string }>("/health", { token: null });
}

export async function apiRegisterPin(input: {
  name: string;
  pin: string;
  role?: string;
  branch?: string;
}) {
  const result = await apiFetch<{ token: string; user: ApiUser }>("/api/auth/register-pin", {
    method: "POST",
    body: JSON.stringify(input),
    token: null,
  });
  setApiToken(result.token);
  return result;
}

/** Admin creates staff without replacing the current session token. */
export async function apiAdminCreateUser(input: {
  name: string;
  pin: string;
  role?: string;
  branch?: string;
}) {
  return apiFetch<ApiUser>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      pin: input.pin,
      password: input.pin,
      username: input.pin,
      role: input.role || "User",
      branch: input.branch || "Main Office",
    }),
  });
}

export async function apiAuthDirectory() {
  return apiFetch<{ users: ApiUser[] }>("/api/auth/directory", { token: null });
}

export async function apiListStaff() {
  return apiFetch<{ users: ApiUser[] }>("/api/staff");
}

export async function apiListOrders() {
  return apiFetch<{ orders: Record<string, unknown>[] }>("/api/orders");
}

export async function apiUpsertOrder(order: Record<string, unknown>) {
  return apiFetch<{ id: string; order: Record<string, unknown> }>("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      paymentStatus: order.paymentStatus,
      area: order.area,
      tableNumber: order.tableNumber,
      barista: order.waiter || order.orderedByWaiter || order.barista,
      cashier: order.enteredByCashier || order.cashier,
      branch: order.branch || "Main Office",
      items: order.items,
      total: order.total,
      raw: order,
      eventType: "order:updated",
      message: `Order ${String(order.orderNo || "")} synced`,
    }),
  });
}

export async function apiBulkUpsertOrders(orders: Record<string, unknown>[]) {
  return apiFetch<{ orders: Record<string, unknown>[] }>("/api/orders/bulk", {
    method: "POST",
    body: JSON.stringify({
      orders: orders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        paymentStatus: order.paymentStatus,
        area: order.area,
        tableNumber: order.tableNumber,
        barista: order.waiter || order.orderedByWaiter || order.barista,
        cashier: order.enteredByCashier || order.cashier,
        branch: order.branch || "Main Office",
        items: order.items,
        total: order.total,
        raw: order,
        eventType: "order:updated",
        message: `Order ${String(order.orderNo || "")} synced`,
      })),
    }),
  });
}

export type ApiBaristaCall = {
  id: string;
  requestedBy: string;
  requestedByRole?: string;
  baristaName: string;
  location: string;
  note: string;
  status: "open" | "acknowledged" | "done";
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
};

export async function apiListBaristaCalls() {
  return apiFetch<{ calls: ApiBaristaCall[] }>("/api/barista/calls", { token: null });
}

export async function apiCreateBaristaCall(input: {
  id?: string;
  requestedBy?: string;
  requestedByRole?: string;
  baristaName?: string;
  location?: string;
  note?: string;
}) {
  return apiFetch<{ call: ApiBaristaCall }>("/api/barista/calls", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiUpdateBaristaCall(
  id: string,
  patch: { status: "open" | "acknowledged" | "done"; acknowledgedBy?: string },
) {
  return apiFetch<{ call: ApiBaristaCall }>(`/api/barista/calls/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export type ApiStation = {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
};

export type ApiMenuItem = {
  id: string;
  mongoId?: string;
  name_en: string;
  name_am: string;
  category: string;
  price: number;
  cost: number;
  station: string;
  emoji: string;
  unitLabel: string;
  available: boolean;
  active?: boolean;
};

export async function apiListStations() {
  return apiFetch<{ stations: ApiStation[] }>("/api/stations");
}

export async function apiCreateStation(name: string) {
  return apiFetch<{ station: ApiStation }>("/api/stations", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function apiUpdateStation(
  id: string,
  patch: { name?: string; active?: boolean; sortOrder?: number },
) {
  return apiFetch<{ station: ApiStation }>(`/api/stations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function apiDeleteStation(id: string) {
  return apiFetch<{ ok: boolean }>(`/api/stations/${id}`, { method: "DELETE" });
}

export async function apiListMenuItems() {
  return apiFetch<{ items: ApiMenuItem[] }>("/api/menu");
}

export async function apiUpsertMenuItem(item: Omit<ApiMenuItem, "mongoId" | "active">) {
  return apiFetch<{ item: ApiMenuItem }>("/api/menu", {
    method: "POST",
    body: JSON.stringify(item),
  });
}

export async function apiSetMenuAvailability(itemId: string, available: boolean) {
  return apiFetch<{ item: ApiMenuItem }>(`/api/menu/${encodeURIComponent(itemId)}/availability`, {
    method: "PATCH",
    body: JSON.stringify({ available }),
  });
}

export async function apiDeleteMenuItem(itemId: string) {
  return apiFetch<{ ok: boolean }>(`/api/menu/${encodeURIComponent(itemId)}`, { method: "DELETE" });
}

export type ApiCategory = {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
};

export async function apiListCategories() {
  return apiFetch<{ categories: ApiCategory[] }>("/api/categories");
}

export async function apiCreateCategory(name: string) {
  return apiFetch<{ category: ApiCategory }>("/api/categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function apiUpdateCategory(
  id: string,
  patch: { name?: string; active?: boolean; sortOrder?: number },
) {
  return apiFetch<{ category: ApiCategory }>(`/api/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function apiDeleteCategory(id: string) {
  return apiFetch<{ ok: boolean }>(`/api/categories/${id}`, { method: "DELETE" });
}

export type ApiBaristaShift = {
  id: string;
  baristaId: string;
  baristaName: string;
  status: "clocked_in" | "clocked_out";
  clockedInAt?: string;
  clockedOutAt?: string;
  updatedAt: string;
};

export async function apiGetBaristaAvailability() {
  return apiFetch<{
    available: ApiBaristaShift[];
    shifts: ApiBaristaShift[];
    anyOnDuty: boolean;
  }>("/api/barista/availability", { token: null });
}

export async function apiBaristaClockIn(baristaId: string, baristaName: string) {
  return apiFetch<{
    shift: ApiBaristaShift;
    available: ApiBaristaShift[];
    anyOnDuty: boolean;
  }>("/api/barista/clock-in", {
    method: "POST",
    body: JSON.stringify({ baristaId, baristaName }),
    token: null,
  });
}

export async function apiBaristaClockOut(baristaId: string) {
  return apiFetch<{
    shift: ApiBaristaShift;
    available: ApiBaristaShift[];
    anyOnDuty: boolean;
  }>("/api/barista/clock-out", {
    method: "POST",
    body: JSON.stringify({ baristaId }),
    token: null,
  });
}
