import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthContext, type AuthUser, type AuthUserInput } from "../lib/auth-context";
import { BRAND_NAME } from "../lib/brand";
import { LangContext, type AppCalendar, type AppLang } from "../lib/lang-context";
import { validateStoreRoleAssignment } from "../lib/staff-management";
import { isStoreAssignmentRole, type StockLocation } from "../lib/stock-management";
import { locationsFromAuthInput, validateAssignedInventoryLocations } from "../lib/inventory-access";
import {
  findUserByPassword,
  isValidStaffPin,
  loadUsers,
  makeAvatar,
  normalizeAuthUser,
  normalizeUserRole,
  saveUsers,
} from "../lib/users";
import { Toaster } from "../components/ui/sonner";
import { StoreProvider } from "@/lib/store";
import {
  restorePosPrinterLocalStorage,
  snapshotPosPrinterLocalStorage,
} from "@/lib/pos-printer";
import {
  apiAdminCreateUser,
  apiAuthDirectory,
  apiLogin,
  apiMe,
  apiRegisterPin,
  getApiToken,
  isExpressApiConfigured,
  setApiToken,
  type ApiUser,
} from "@/lib/api/express-client";

function apiUserToAuthUser(apiUser: ApiUser): AuthUser {
  return normalizeAuthUser({
    id: apiUser.id,
    email: apiUser.email,
    name: apiUser.name,
    role: normalizeUserRole(apiUser.role),
    branch: apiUser.branch || "Main Office",
    avatar: apiUser.avatar || makeAvatar(apiUser.name),
    password: apiUser.username || apiUser.password || "",
  });
}

function NotFoundComponent() {
  const lang = typeof window !== "undefined" && window.localStorage.getItem("lang") === "am" ? "am" : "en";
  const t = (en: string, am: string) => (lang === "am" ? am : en);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("Page not found", "ገጹ አልተገኘም")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "The page you're looking for doesn't exist or has been moved.",
            "የፈለጉት ገጽ የለም ወይም ተንቀሳቅሷል።",
          )}
        </p>
        <div className="mt-6">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("Go to login", "ወደ መግቢያ ሂድ")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const lang = typeof window !== "undefined" && window.localStorage.getItem("lang") === "am" ? "am" : "en";
  const t = (en: string, am: string) => (lang === "am" ? am : en);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("This page didn't load", "ይህ ገጽ አልተጫነም")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "Something went wrong on our end. You can try refreshing or head back home.",
            "በእኛ በኩል ችግር ተፈጥሯል። እባክዎ ዳግም ይሞክሩ ወይም ወደ መነሻ ይመለሱ።",
          )}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("Try again", "ደግመው ይሞክሩ")}
          </button>
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("Go to login", "ወደ መግቢያ ሂድ")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: BRAND_NAME },
      { name: "description", content: "spx Service Desk — coffee office orders, stations, and staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Noto+Sans+Ethiopic:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function useAuthState() {
  const authMode = isExpressApiConfigured() ? ("api" as const) : ("demo" as const);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    async function boot() {
      try {
        if (isExpressApiConfigured()) {
          const token = getApiToken();
          if (token) {
            try {
              const me = await apiMe();
              if (!cancelled) {
                const next = apiUserToAuthUser(me);
                sessionStorage.setItem("bl_user", JSON.stringify(next));
                setUser(next);
              }
            } catch {
              setApiToken(null);
              sessionStorage.removeItem("bl_user");
              if (!cancelled) setUser(null);
            }
          } else {
            const raw = sessionStorage.getItem("bl_user");
            if (raw) {
              try {
                const parsed = JSON.parse(raw) as AuthUser;
                if (!cancelled) setUser(normalizeAuthUser(parsed));
              } catch {
                if (!cancelled) setUser(null);
              }
            }
          }

          try {
            const directory = await apiAuthDirectory();
            if (!cancelled) {
              const mapped = directory.users.map(apiUserToAuthUser);
              setUsers(mapped);
              saveUsers(mapped);
            }
          } catch {
            if (!cancelled) setUsers(loadUsers());
          }
          return;
        }

        const raw = sessionStorage.getItem("bl_user");
        const parsed = raw ? (JSON.parse(raw) as AuthUser) : null;
        if (!cancelled) {
          setUser(parsed ? normalizeAuthUser(parsed) : null);
          setUsers(loadUsers());
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setUsers(loadUsers());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((u: AuthUser) => {
    sessionStorage.setItem("bl_user", JSON.stringify(u));
    setUser(u);
  }, []);

  const signInWithPasswordOnly = useCallback(async (password: string) => {
    const loginPassword = password.trim();
    if (!isValidStaffPin(loginPassword)) {
      return { ok: false as const, error: "Enter your 2-digit PIN." };
    }

    if (isExpressApiConfigured()) {
      try {
        const result = await apiLogin(loginPassword, loginPassword);
        const next = apiUserToAuthUser(result.user);
        sessionStorage.setItem("bl_user", JSON.stringify(next));
        setUser(next);
        try {
          const directory = await apiAuthDirectory();
          const mapped = directory.users.map(apiUserToAuthUser);
          setUsers(mapped);
          saveUsers(mapped);
        } catch {
          // keep existing directory
        }
        return { ok: true as const, user: next };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Wrong PIN.";
        return { ok: false as const, error: /invalid|unauthorized|401/i.test(message) ? "Wrong PIN." : message };
      }
    }

    const match = findUserByPassword(loginPassword, loadUsers());
    if (!match) return { ok: false as const, error: "Wrong PIN." };
    sessionStorage.setItem("bl_user", JSON.stringify(match));
    setUser(match);
    return { ok: true as const, user: match };
  }, []);

  const logout = useCallback(() => {
    const printerSnapshot = snapshotPosPrinterLocalStorage();
    sessionStorage.removeItem("bl_user");
    try {
      window.localStorage.removeItem("bl_user");
    } catch {
      // ignore
    }
    setApiToken(null);
    setUser(null);
    restorePosPrinterLocalStorage(printerSnapshot);
  }, []);

  const addUser = useCallback(async (input: AuthUserInput) => {
    const name = input.name.trim();
    const password = input.password.trim();
    if (!name) return { ok: false as const, error: "Name is required." };
    if (!isValidStaffPin(password)) {
      return { ok: false as const, error: "Login PIN must be exactly 2 digits." };
    }
    const storeAssignmentError = validateStoreRoleAssignment(input.role, input.assignedStore);
    if (storeAssignmentError) return { ok: false as const, error: storeAssignmentError };
    const locationAssignmentError = validateAssignedInventoryLocations(
      input.role,
      locationsFromAuthInput(input) as StockLocation[],
    );
    if (locationAssignmentError) return { ok: false as const, error: locationAssignmentError };

    if (isExpressApiConfigured()) {
      try {
        // Self-register (login page) issues a session. Admin staff create must not.
        const selfRegister = !user;
        if (selfRegister) {
          const result = await apiRegisterPin({
            name,
            pin: password,
            role: input.role,
            branch: input.branch.trim() || "Main Office",
          });
          const next = apiUserToAuthUser(result.user);
          setUsers((prev) => {
            const filtered = prev.filter((row) => row.id !== next.id && row.password !== password);
            const merged = [...filtered, next];
            saveUsers(merged);
            return merged;
          });
          return { ok: true as const, user: next };
        }

        const created = await apiAdminCreateUser({
          name,
          pin: password,
          role: input.role,
          branch: input.branch.trim() || "Main Office",
        });
        const next = apiUserToAuthUser(created);
        setUsers((prev) => {
          const filtered = prev.filter((row) => row.id !== next.id && row.password !== password);
          const merged = [...filtered, next];
          saveUsers(merged);
          return merged;
        });
        return { ok: true as const, user: next };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not create user.";
        return {
          ok: false as const,
          error: /already in use|already taken|409/i.test(message)
            ? "That PIN is already in use. Choose a different PIN."
            : message,
        };
      }
    }

    const assignedInventoryLocations = locationsFromAuthInput(input);
    const newUser: AuthUser = {
      id: `u${Date.now()}`,
      name,
      role: input.role,
      branch: input.branch.trim() || "Main Office",
      staffSalesAll: input.staffSalesAll ?? false,
      assignedStore: isStoreAssignmentRole(input.role)
        ? input.assignedStore ??
          (assignedInventoryLocations.find((loc) => loc === "Store 1" || loc === "Store 2") as AuthUser["assignedStore"])
        : undefined,
      assignedInventoryLocations: assignedInventoryLocations.length ? assignedInventoryLocations : undefined,
      avatar: makeAvatar(name),
      password,
    };

    let created: AuthUser | null = null;
    let pinTaken = false;
    setUsers((prev) => {
      const persisted = loadUsers();
      const byId = new Map<string, AuthUser>();
      for (const row of [...persisted, ...prev]) byId.set(row.id, row);
      const latest = Array.from(byId.values());
      if (findUserByPassword(password, latest)) {
        pinTaken = true;
        return latest;
      }
      created = newUser;
      const next = [...latest, newUser];
      saveUsers(next);
      return next;
    });

    if (pinTaken || !created) {
      return { ok: false as const, error: "That PIN is already in use. Choose a different PIN." };
    }

    return { ok: true as const, user: created };
  }, [user]);

  const updateUser = useCallback(async (id: string, input: AuthUserInput) => {
    const target = users.find((u) => u.id === id);
    if (!target) return { ok: false as const, error: "User not found." };

    const name = input.name.trim();
    const password = input.password.trim();
    if (!name) return { ok: false as const, error: "Name is required." };
    if (!isValidStaffPin(password)) {
      return { ok: false as const, error: "Login PIN must be exactly 2 digits." };
    }
    if (users.some((u) => u.id !== id && u.password === password)) {
      return { ok: false as const, error: "That PIN is already in use." };
    }
    const storeAssignmentError = validateStoreRoleAssignment(input.role, input.assignedStore);
    if (storeAssignmentError) return { ok: false as const, error: storeAssignmentError };
    const locationAssignmentError = validateAssignedInventoryLocations(
      input.role,
      locationsFromAuthInput(input) as StockLocation[],
    );
    if (locationAssignmentError) return { ok: false as const, error: locationAssignmentError };
    const isManagerLike = (role: string) =>
      role === "Administrator" || role === "Manager" || role === "Branch Manager";
    if (
      isManagerLike(target.role) &&
      !isManagerLike(input.role) &&
      users.filter((u) => isManagerLike(u.role)).length <= 1
    ) {
      return { ok: false as const, error: "At least one admin or manager account is required." };
    }
    const assignedInventoryLocations = locationsFromAuthInput(input);

    const updated: AuthUser = {
      ...target,
      name,
      role: input.role,
      branch: input.branch.trim() || "Main Office",
      staffSalesAll: input.staffSalesAll ?? false,
      assignedStore: isStoreAssignmentRole(input.role)
        ? input.assignedStore ??
          (assignedInventoryLocations.find((loc) => loc === "Store 1" || loc === "Store 2") as AuthUser["assignedStore"])
        : undefined,
      assignedInventoryLocations: assignedInventoryLocations.length ? assignedInventoryLocations : undefined,
      avatar: makeAvatar(name),
      password,
    };

    setUsers((prev) => {
      const next = prev.map((u) => (u.id === id ? updated : u));
      saveUsers(next);
      return next;
    });

    if (user?.id === id) {
      sessionStorage.setItem("bl_user", JSON.stringify(updated));
      setUser(updated);
    }

    return { ok: true as const, user: updated };
  }, [user, users]);

  const removeUser = useCallback(async (id: string) => {
    if (user?.id === id) return { ok: false as const, error: "You cannot remove your own account." };
    const target = users.find((u) => u.id === id);
    if (!target) return { ok: false as const, error: "User not found." };
    if (
      (target.role === "Branch Manager" ||
        target.role === "Administrator" ||
        target.role === "Manager") &&
      users.filter(
        (u) =>
          u.role === "Branch Manager" ||
          u.role === "Administrator" ||
          u.role === "Manager",
      ).length <= 1
    ) {
      return { ok: false as const, error: "At least one admin or manager account is required." };
    }

    setUsers((prev) => {
      const next = prev.filter((u) => u.id !== id);
      saveUsers(next);
      return next;
    });

    return { ok: true as const };
  }, [user, users]);

  const signInWithPasswordFixed = useCallback(
    async (_email: string, password: string) => signInWithPasswordOnly(password),
    [signInWithPasswordOnly],
  );

  return useMemo(
    () => ({
      user,
      users,
      authMode,
      loading,
      login,
      signInWithPassword: signInWithPasswordFixed,
      signInWithPasswordOnly,
      logout,
      addUser,
      updateUser,
      removeUser,
    }),
    [
      user,
      users,
      authMode,
      loading,
      login,
      signInWithPasswordFixed,
      signInWithPasswordOnly,
      logout,
      addUser,
      updateUser,
      removeUser,
    ],
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const auth = useAuthState();
  const [lang, setLang] = useState<AppLang>("en");
  const [calendar, setCalendar] = useState<AppCalendar>("gregorian");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedLang = window.localStorage.getItem("lang");
    if (savedLang === "am" || savedLang === "en") {
      setLang(savedLang);
    }
    const savedCalendar = window.localStorage.getItem("calendar");
    if (savedCalendar === "ethiopian" || savedCalendar === "gregorian") {
      setCalendar(savedCalendar);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("lang", lang);
    }
    if (lang === "am") {
      setCalendar("ethiopian");
    }
  }, [lang]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("calendar", calendar);
    }
  }, [calendar]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "lang" && (event.newValue === "am" || event.newValue === "en")) {
        setLang(event.newValue);
      }
      if (event.key === "calendar" && (event.newValue === "ethiopian" || event.newValue === "gregorian")) {
        setCalendar(event.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <LangContext.Provider value={{ lang, setLang, calendar, setCalendar }}>
      <AuthContext.Provider value={auth}>
        <QueryClientProvider client={queryClient}>
          <StoreProvider>
            <Outlet />
          </StoreProvider>
          <Toaster richColors closeButton position="bottom-right" />
        </QueryClientProvider>
      </AuthContext.Provider>
    </LangContext.Provider>
  );
}
