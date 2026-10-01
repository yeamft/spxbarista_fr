import { createContext, useContext } from "react";
import type { CentralStockLocation, StockLocation } from "./stock-management.ts";

export type UserRole =
  | "Administrator"
  | "Manager"
  | "Barista"
  | "User"
  // Legacy roles kept for type-compat with older inventory helpers; normalized at load.
  | "Inventory Administrator"
  | "Branch Manager"
  | "Store Manager"
  | "Supervisor"
  | "Cashier"
  | "Kitchen Staff"
  | "Bar Staff"
  | "Bartender"
  | "Butcher Staff"
  | "Butcher House Staff"
  | "Coffee House Staff"
  | "Department Manager"
  | "Inventory Staff"
  | "Storekeeper"
  | "Reception"
  | "Hotel Staff"
  | "Procurement Officer"
  | "Chef"
  | "Event Coordinator"
  | "Accountant"
  | "Auditor";

export interface AuthUser {
  id: string;
  email?: string;
  name: string;
  role: UserRole;
  branch: string;
  staffSalesAll?: boolean;
  assignedStore?: CentralStockLocation;
  assignedInventoryLocations?: StockLocation[];
  avatar: string; // initials
  password: string; // demo only — plain text
}

export type AuthUserInput = {
  email?: string;
  name: string;
  role: UserRole;
  branch: string;
  staffSalesAll?: boolean;
  assignedStore?: CentralStockLocation;
  assignedInventoryLocations?: StockLocation[];
  password: string;
};

export type AuthUserMutationResult = { ok: true; user: AuthUser } | { ok: false; error: string };

/** Roles that can approve/post/reverse staff consumption and breakage. */
export const STAFF_CONSUMPTION_MANAGER_ROLES: UserRole[] = [
  "Administrator",
  "Manager",
  "Branch Manager",
  "Supervisor",
];

/** Every signed-in role can open Staff Consumption and submit their own records. */
export function canAccessStaffConsumption(_role?: UserRole | string | null) {
  return true;
}

export function canManageStaffConsumption(role?: UserRole | string | null) {
  return Boolean(role && STAFF_CONSUMPTION_MANAGER_ROLES.includes(role as UserRole));
}

/** Roles that can approve (or directly post) an order return. */
export const ORDER_RETURN_APPROVER_ROLES: UserRole[] = [
  "Administrator",
  "Manager",
  "Branch Manager",
  "Supervisor",
];

export function canApproveOrderReturns(role?: UserRole | string | null) {
  return Boolean(role && ORDER_RETURN_APPROVER_ROLES.includes(role as UserRole));
}

/** Same roles approve waiter open-bill handoffs. */
export function canApproveWaiterBillTransfers(role?: UserRole | string | null) {
  return canApproveOrderReturns(role);
}

export function isAdminOrManager(role?: UserRole | string | null) {
  return (
    role === "Administrator" ||
    role === "Manager" ||
    role === "Branch Manager" ||
    role === "Supervisor"
  );
}

const ADMIN_MANAGER_NAV = [
  "/app",
  "/app/notifications",
  "/app/pos",
  "/app/orders",
  "/app/kds",
  "/app/kds-history",
  "/app/digital-menu",
  "/app/menu",
  "/app/stations",
  "/app/staff",
  "/app/reports",
  "/app/settings",
];

const BARISTA_NAV = [
  "/app",
  "/app/notifications",
  "/app/pos",
  "/app/orders",
  "/app/kds",
  "/app/kds-history",
  "/app/qr-scanner",
  "/app/digital-menu",
  "/app/menu",
];

const USER_NAV = [
  "/app",
  "/app/notifications",
  "/app/pos",
  "/app/orders",
];

/** Nav routes each role can access */
export const ROLE_NAV: Record<string, string[]> = {
  Administrator: [...ADMIN_MANAGER_NAV],
  Manager: [...ADMIN_MANAGER_NAV],
  "Branch Manager": [...ADMIN_MANAGER_NAV],
  Supervisor: [...ADMIN_MANAGER_NAV],
  Barista: [...BARISTA_NAV],
  User: [...USER_NAV],
  // Legacy aliases → coffee office access
  Cashier: [...USER_NAV],
  "Coffee House Staff": [...USER_NAV],
  Accountant: ["/app", "/app/notifications", "/app/reports"],
  Auditor: ["/app", "/app/notifications", "/app/reports"],
};

export const DEMO_USERS: AuthUser[] = [
  {
    id: "u1",
    name: "Liya Demeke",
    role: "Administrator",
    branch: "Main Office",
    avatar: "LD",
    password: "11",
  },
  {
    id: "u2",
    name: "Sara Bekele",
    role: "Manager",
    branch: "Main Office",
    avatar: "SB",
    password: "12",
  },
  {
    id: "u3",
    name: "Amir",
    role: "Barista",
    branch: "Main Office",
    avatar: "AM",
    password: "21",
  },
  {
    id: "u3b",
    name: "Alem",
    role: "Barista",
    branch: "Main Office",
    avatar: "AL",
    password: "22",
  },
  {
    id: "u4",
    name: "Genet Tilahun",
    role: "User",
    branch: "Main Office",
    avatar: "GT",
    password: "31",
  },
  {
    id: "u5",
    name: "Marta Yohannes",
    role: "User",
    branch: "Main Office",
    avatar: "MY",
    password: "32",
  },
];

export const AuthContext = createContext<{
  user: AuthUser | null;
  users: AuthUser[];
  authMode: "demo" | "api";
  loading: boolean;
  login: (user: AuthUser) => void;
  signInWithPassword: (email: string, password: string) => Promise<AuthUserMutationResult>;
  signInWithPasswordOnly: (password: string) => Promise<AuthUserMutationResult>;
  logout: () => void;
  addUser: (input: AuthUserInput) => Promise<AuthUserMutationResult>;
  updateUser: (id: string, input: AuthUserInput) => Promise<AuthUserMutationResult>;
  removeUser: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}>({
  user: null,
  users: DEMO_USERS,
  authMode: "demo",
  loading: false,
  login: () => {},
  signInWithPassword: async () => ({ ok: false, error: "Not available" }),
  signInWithPasswordOnly: async () => ({ ok: false, error: "Not available" }),
  logout: () => {},
  addUser: async () => ({ ok: false, error: "Not available" }),
  updateUser: async () => ({ ok: false, error: "Not available" }),
  removeUser: async () => ({ ok: false, error: "Not available" }),
});

export const useAuth = () => useContext(AuthContext);
