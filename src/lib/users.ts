import { DEMO_USERS, type AuthUser, type UserRole } from "./auth-context";

/** Coffee-office selectable system roles. */
export const USER_ROLES: UserRole[] = [
  "Administrator",
  "Manager",
  "Barista",
  "User",
];

export const USERS_STORAGE_KEY = "ep_coffee_users_v2";

export const STAFF_PIN_LENGTH = 2;

export function isValidStaffPin(pin: string): boolean {
  return new RegExp(`^\\d{${STAFF_PIN_LENGTH}}$`).test(pin.trim());
}

export function makeAvatar(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "??";
}

/**
 * Map legacy restaurant roles onto coffee-office roles:
 * Administrator | Manager | Barista | User
 */
export function normalizeUserRole(role: string | null | undefined): UserRole {
  const value = (role ?? "").trim();
  if (value === "Administrator") return "Administrator";
  if (
    value === "Manager" ||
    value === "Branch Manager" ||
    value === "Supervisor" ||
    value === "Store Manager" ||
    value === "Department Manager" ||
    value === "Inventory Administrator"
  ) {
    return "Manager";
  }
  if (value === "Barista" || value === "Waiter") return "Barista";
  if (value === "User") return "User";
  // Cashiers and all other staff are ordering users.
  return "User";
}

export function normalizeAuthUser(user: AuthUser): AuthUser {
  return {
    ...user,
    role: normalizeUserRole(user.role),
    password: String(user.password ?? "").trim(),
  };
}

export function loadUsers(): AuthUser[] {
  if (typeof window === "undefined") return DEMO_USERS.map(normalizeAuthUser);
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AuthUser[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeAuthUser);
      }
    }
  } catch {
    /* ignore */
  }
  return DEMO_USERS.map(normalizeAuthUser);
}

export function saveUsers(users: AuthUser[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    USERS_STORAGE_KEY,
    JSON.stringify(users.map(normalizeAuthUser)),
  );
}

export function findUserByPassword(password: string, users: AuthUser[]): AuthUser | null {
  const pin = password.trim();
  if (!pin) return null;
  return users.find((u) => u.password === pin) ?? null;
}

export function findUserByPin(pin: string, users: AuthUser[]): AuthUser | null {
  if (!isValidStaffPin(pin)) return null;
  return findUserByPassword(pin, users);
}

export type NewAuthUser = {
  name: string;
  role: UserRole;
  branch: string;
  staffSalesAll?: boolean;
  password: string;
};
