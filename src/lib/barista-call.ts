export const BARISTA_CALLS_MODULE_KEY = "barista_calls";

export type BaristaCallStatus = "open" | "acknowledged" | "done";

export type BaristaCall = {
  id: string;
  requestedBy: string;
  requestedByRole?: string;
  /** Empty = any available barista */
  baristaName: string;
  location: string;
  note: string;
  status: BaristaCallStatus;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
};

export function createBaristaCall(input: {
  requestedBy: string;
  requestedByRole?: string;
  baristaName?: string;
  location?: string;
  note?: string;
}): BaristaCall {
  const stamp = new Date().toISOString();
  return {
    id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    requestedBy: input.requestedBy.trim() || "Guest",
    requestedByRole: input.requestedByRole,
    baristaName: input.baristaName?.trim() || "",
    location: input.location?.trim() || "Service Desk",
    note: input.note?.trim() || "",
    status: "open",
    createdAt: stamp,
  };
}

export function acknowledgeBaristaCall(
  call: BaristaCall,
  acknowledgedBy: string,
): BaristaCall {
  return {
    ...call,
    status: "acknowledged",
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy: acknowledgedBy.trim() || "Barista",
  };
}

export function completeBaristaCall(call: BaristaCall): BaristaCall {
  return { ...call, status: "done" };
}

function callMatchesBarista(call: BaristaCall, baristaName: string) {
  const name = baristaName.trim().toLowerCase();
  if (!call.baristaName.trim()) return true;
  return call.baristaName.trim().toLowerCase() === name;
}

/** Unanswered calls stay visible until accepted — no time expiry. */
export function openBaristaCalls(calls: readonly BaristaCall[]) {
  return calls.filter((call) => call.status === "open");
}

/** Open calls never expire; acknowledged stay for a while; done are hidden. */
export function activeBaristaCalls(
  calls: readonly BaristaCall[],
  now = Date.now(),
  maxAgeMs = 45 * 60_000,
) {
  return calls.filter((call) => {
    if (call.status === "done") return false;
    if (call.status === "open") return true;
    const created = Date.parse(call.acknowledgedAt || call.createdAt);
    if (Number.isNaN(created)) return true;
    return now - created <= maxAgeMs;
  });
}

export function callsForBarista(
  calls: readonly BaristaCall[],
  baristaName: string,
) {
  return activeBaristaCalls(calls).filter((call) => callMatchesBarista(call, baristaName));
}

export function openCallsForBarista(
  calls: readonly BaristaCall[],
  baristaName: string,
) {
  const open = openBaristaCalls(calls);
  if (!baristaName.trim()) return open;
  return open.filter((call) => callMatchesBarista(call, baristaName));
}
