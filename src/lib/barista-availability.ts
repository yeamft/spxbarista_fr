/** Shared barista on-duty / clock-in state for Service Desk gating. */

export const BARISTA_AVAILABILITY_MODULE_KEY = "barista_availability";

export type BaristaShiftStatus = "clocked_in" | "clocked_out";

export type BaristaShift = {
  /** Same as baristaId — stable record id for module_records. */
  id: string;
  baristaId: string;
  baristaName: string;
  status: BaristaShiftStatus;
  clockedInAt?: string;
  clockedOutAt?: string;
  updatedAt: string;
};

export function onDutyBaristas(shifts: readonly BaristaShift[]): BaristaShift[] {
  return shifts.filter((shift) => shift.status === "clocked_in");
}

export function isAnyBaristaOnDuty(shifts: readonly BaristaShift[]): boolean {
  return onDutyBaristas(shifts).length > 0;
}

export function findBaristaShift(
  shifts: readonly BaristaShift[],
  baristaId: string,
): BaristaShift | undefined {
  return shifts.find((shift) => shift.id === baristaId || shift.baristaId === baristaId);
}

export function isBaristaClockedIn(
  shifts: readonly BaristaShift[],
  baristaId: string,
): boolean {
  return findBaristaShift(shifts, baristaId)?.status === "clocked_in";
}

export function clockInBarista(input: {
  baristaId: string;
  baristaName: string;
  at?: string;
}): BaristaShift {
  const stamp = input.at ?? new Date().toISOString();
  return {
    id: input.baristaId,
    baristaId: input.baristaId,
    baristaName: input.baristaName.trim() || "Barista",
    status: "clocked_in",
    clockedInAt: stamp,
    clockedOutAt: undefined,
    updatedAt: stamp,
  };
}

export function clockOutBarista(
  shift: BaristaShift,
  at = new Date().toISOString(),
): BaristaShift {
  return {
    ...shift,
    status: "clocked_out",
    clockedOutAt: at,
    updatedAt: at,
  };
}

export function upsertBaristaShift(
  shifts: readonly BaristaShift[],
  next: BaristaShift,
): BaristaShift[] {
  const without = shifts.filter(
    (shift) => shift.id !== next.id && shift.baristaId !== next.baristaId,
  );
  return [next, ...without].slice(0, 50);
}

/** Roles that may place Service Desk orders only when a barista is on duty. */
export function roleRequiresBaristaOnDuty(role: string): boolean {
  return role === "User" || role === "Cashier" || role === "Coffee House Staff";
}

/** Managers / baristas can always open Service Desk (baristas need Menu + station work). */
export function canBypassBaristaDutyGate(role: string): boolean {
  return (
    role === "Barista" ||
    role === "Administrator" ||
    role === "Manager" ||
    role === "Branch Manager" ||
    role === "Supervisor"
  );
}

export function canUseServiceDesk(
  role: string,
  shifts: readonly BaristaShift[],
): boolean {
  if (canBypassBaristaDutyGate(role)) return true;
  if (!roleRequiresBaristaOnDuty(role)) return true;
  return isAnyBaristaOnDuty(shifts);
}
