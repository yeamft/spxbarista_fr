import { Outlet, Link, useRouterState, createFileRoute, useNavigate } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { formatEthiopic } from "@/lib/ethiopic";
import { useCalendar, useLang, useSetCalendar, useSetLang } from "@/lib/lang-context";
import { canApproveOrderReturns, ROLE_NAV, useAuth, type AuthUser } from "@/lib/auth-context";
import {
  BRANCH_PRINTERS_MODULE_KEY,
  cacheBranchPrinters,
  type BranchPrinterConfig,
} from "@/lib/branch-printers";
import { EMPTY_MODULE_RECORDS, useModuleRecords } from "@/lib/module-records";
import { useStore } from "@/lib/store";
import { getNotificationsForUser } from "@/lib/notifications";
import { BARISTA_CALLS_MODULE_KEY, type BaristaCall } from "@/lib/barista-call";
import {
  canUseServiceDesk,
  isAnyBaristaOnDuty,
  onDutyBaristas,
} from "@/lib/barista-availability";
import { useBaristaAvailability } from "@/lib/use-barista-availability";
import { useStockManagementModule } from "@/lib/stock-management";
import {
  connectOrdersSocket,
  subscribeOrdersSocket,
} from "@/lib/orders-realtime";
import { StockModuleBridge } from "@/components/stock-module-bridge";
import { ProfileHeaderMenu } from "@/components/dashboard/profile-header-menu";
import { BaristaCallAlert } from "@/components/barista-call-alert";
import { showInfo } from "@/lib/toast";

export const Route = createFileRoute("/app")({ component: AppShell });

const EMPTY_POS_SEARCH = {
  table: undefined,
  area: undefined,
  waiter: undefined,
  orderId: undefined,
  mode: undefined,
} as const;

function useNotificationCount(user: AuthUser) {
  const { orders, menuStations } = useStore();
  const stockModule = useStockManagementModule();
  const { records: baristaCalls } = useModuleRecords<BaristaCall>(
    BARISTA_CALLS_MODULE_KEY,
    EMPTY_MODULE_RECORDS,
  );
  const { shifts: baristaShifts } = useBaristaAvailability();
  return useMemo(
    () =>
      getNotificationsForUser(
        user,
        orders,
        stockModule.balances,
        stockModule.requests,
        stockModule.transfers,
        menuStations,
        [],
        "en",
        baristaCalls,
        baristaShifts,
      ).length,
    [
      user,
      orders,
      stockModule.balances,
      stockModule.requests,
      stockModule.transfers,
      menuStations,
      baristaCalls,
      baristaShifts,
    ],
  );
}

function NotificationBell({
  user,
  t,
}: {
  user: AuthUser;
  t: (en: string, am: string) => string;
}) {
  const notificationCount = useNotificationCount(user);
  return (
    <Link
      to="/app/notifications"
      className="relative size-8 grid place-items-center rounded-md border border-border bg-card hover:bg-surface-2"
      title={`${notificationCount} ${t("new notifications", "አዲስ ማሳወቂያዎች")}`}
    >
      <Icons.Bell className="size-3.5" />
      {notificationCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 rounded-full bg-ember text-ember-foreground text-[8px] font-bold grid place-items-center">
          {notificationCount > 9 ? "9+" : notificationCount}
        </span>
      )}
    </Link>
  );
}

function NavNotificationBadge({ user, active }: { user: AuthUser; active: boolean }) {
  const notificationCount = useNotificationCount(user);
  if (notificationCount <= 0) return null;
  return (
    <span
      className={`ml-auto grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold ${
        active ? "bg-background text-foreground" : "bg-ember text-ember-foreground"
      }`}
    >
      {notificationCount > 9 ? "9+" : notificationCount}
    </span>
  );
}

const NAV: { to: string; label: string; icon: string; group: string }[] = [
  { to: "/app", label: "Dashboard", icon: "LayoutDashboard", group: "Overview" },
  { to: "/app/notifications", label: "Notifications", icon: "BellRing", group: "Overview" },
  { to: "/app/pos", label: "Service Desk", icon: "Coffee", group: "Service" },
  { to: "/app/kds", label: "Stations", icon: "ChefHat", group: "Service" },
  { to: "/app/orders", label: "Orders", icon: "ClipboardList", group: "Service" },
  { to: "/app/digital-menu", label: "Digital Menu", icon: "QrCode", group: "Service" },
  { to: "/app/qr-scanner", label: "QR Scanner", icon: "ScanQrCode", group: "Service" },
  { to: "/app/menu", label: "Menu", icon: "BookOpen", group: "Catalog" },
  { to: "/app/stations", label: "Station Management", icon: "MapPin", group: "Catalog" },
  { to: "/app/staff", label: "Staff Management", icon: "IdCard", group: "People" },
  { to: "/app/reports", label: "Reports", icon: "BarChart3", group: "Insights" },
  { to: "/app/settings", label: "Settings", icon: "Settings2", group: "System" },
];

const GROUP_LABELS = {
  Overview: { en: "Overview", am: "አጠቃላይ" },
  Service: { en: "Service", am: "አገልግሎት" },
  Catalog: { en: "Catalog", am: "ካታሎግ" },
  People: { en: "People", am: "ሰራተኛ" },
  Insights: { en: "Insights", am: "ትንታኔ" },
  System: { en: "System", am: "ስርዓት" },
} as const;

const NAV_LABELS = {
  Dashboard: { en: "Dashboard", am: "ዳሽቦርድ" },
  Notifications: { en: "Notifications", am: "ማሳወቂያዎች" },
  POS: { en: "POS", am: "POS" },
  "Coffee POS": { en: "Service Desk", am: "ሰርቪስ ዴስክ" },
  "Service Desk": { en: "Service Desk", am: "ሰርቪስ ዴስክ" },
  Stations: { en: "Stations", am: "ጣቢያዎች" },
  Tables: { en: "Tables", am: "ጠረጴዛዎች" },
  Orders: { en: "Orders", am: "ትዕዛዞች" },
  "Digital Menu": { en: "Digital Menu", am: "ዲጂታል ሜኑ" },
  "QR Scanner": { en: "QR Scanner", am: "QR ስካነር" },
  Menu: { en: "Menu", am: "ሜኑ" },
  "Station Management": { en: "Station Management", am: "የጣቢያ አስተዳደር" },
  Staff: { en: "Staff Management", am: "የሰራተኞች አስተዳደር" },
  "Staff Management": { en: "Staff Management", am: "የሰራተኞች አስተዳደር" },
  Reports: { en: "Reports", am: "ሪፖርቶች" },
  Settings: { en: "Settings", am: "ቅንብሮች" },
} as const;

const ROLE_LABELS = {
  Administrator: { en: "System Admin", am: "የስርዓት አስተዳዳሪ" },
  Manager: { en: "Manager", am: "አስተዳዳሪ" },
  "Branch Manager": { en: "Manager", am: "አስተዳዳሪ" },
  Barista: { en: "Barista", am: "ባሪስታ" },
  User: { en: "User", am: "ተጠቃሚ" },
  Cashier: { en: "User", am: "ተጠቃሚ" },
  "Coffee House Staff": { en: "User", am: "ተጠቃሚ" },
} as const;

function NavIcon({ name, className }: { name: string; className?: string }) {
  const Cmp =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] ??
    Icons.Circle;
  return <Cmp className={className} />;
}

function isNavActive(path: string, to: string) {
  if (to === "/app") return path === to;
  return path === to || path.startsWith(`${to}/`);
}

function isDepartmentInventoryRole(role: AuthUser["role"]) {
  return [
    "Bartender",
    "Bar Staff",
    "Kitchen Staff",
    "Butcher Staff",
    "Butcher House Staff",
    "Coffee House Staff",
  ].includes(role);
}

function AppShell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (auth.loading && !auth.user) return;
    if (!auth.user) navigate({ to: "/login" });
  }, [auth.loading, auth.user, navigate]);

  if (auth.loading && !auth.user) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 rounded-full border-4 border-ember/20 border-t-ember animate-spin" />
          <p className="text-sm text-muted-foreground">Restoring session</p>
        </div>
      </div>
    );
  }

  if (!auth.user) return null;

  return (
    <StockModuleBridge>
      <Inner
        user={auth.user}
        onLogout={() => {
          auth.logout();
          navigate({ to: "/login" });
        }}
        path={path}
      />
    </StockModuleBridge>
  );
}

/** Keeps branch network printer config available to POS print calls on every device. */
function BranchPrinterCacheSync() {
  const { records } = useModuleRecords<BranchPrinterConfig>(BRANCH_PRINTERS_MODULE_KEY, EMPTY_MODULE_RECORDS);
  useEffect(() => {
    cacheBranchPrinters(records);
  }, [records]);
  return null;
}

function Inner({ user, onLogout, path }: { user: AuthUser; onLogout: () => void; path: string }) {
  const { restaurantProfile } = useStore();
  const lang = useLang();
  const setLang = useSetLang();
  const calendar = useCalendar();
  const setCalendar = useSetCalendar();
  const navigate = useNavigate();
  const { shifts: baristaShifts } = useBaristaAvailability();
  const serviceDeskOpen = canUseServiceDesk(user.role, baristaShifts);
  const anyBaristaOnDuty = isAnyBaristaOnDuty(baristaShifts);
  const onDutyNames = onDutyBaristas(baristaShifts)
    .map((shift) => shift.baristaName)
    .join(", ");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [dark, setDark] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const nextDark =
      savedTheme === "dark" ||
      (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);

    setDark(nextDark);
    setSidebarHidden(localStorage.getItem("sidebarHidden") === "true");
    document.documentElement.classList.toggle("dark", nextDark);
    setToday(new Date());
    setPreferencesReady(true);
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark, preferencesReady]);

  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem("sidebarHidden", sidebarHidden ? "true" : "false");
  }, [sidebarHidden, preferencesReady]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!mobileMenuRef.current?.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    let active = true;
    let disconnect: (() => void) | undefined;
    void connectOrdersSocket().then((fn) => {
      if (active) disconnect = fn;
      else fn?.();
    });
    const unsubscribe = subscribeOrdersSocket((event) => {
      if (event.type !== "order:return-requested") return;
      if (!canApproveOrderReturns(user.role) && user.role !== "Branch Manager") return;
      if (event.actor && event.actor === user.name) return;
      showInfo(
        lang === "am" ? "የትዕዛዝ መልስ ተጠይቋል" : "Order return requested",
        [event.orderNo, event.actor, event.message].filter(Boolean).join(" · "),
      );
    });
    return () => {
      active = false;
      unsubscribe();
      disconnect?.();
    };
  }, [lang, user.name, user.role]);

  const t = (en: string, am: string) => (lang === "am" ? am : en);
  const formatHeaderDate = (date: Date) =>
    calendar === "ethiopian"
      ? formatEthiopic(date, lang)
      : date.toLocaleDateString(lang === "am" ? "am-ET" : "en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  const groupLabel = (group: string) =>
    GROUP_LABELS[group as keyof typeof GROUP_LABELS]?.[lang] ?? group;
  const navLabel = (label: string) => NAV_LABELS[label as keyof typeof NAV_LABELS]?.[lang] ?? label;
  const roleLabel = ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]?.[lang] ?? user.role;
  const allowed = ROLE_NAV[user.role] ?? [];
  const visibleNav = NAV.filter((n) => allowed.includes(n.to));
  const departmentInventoryRole = isDepartmentInventoryRole(user.role);
  const groups = Array.from(new Set(visibleNav.map((n) => n.group)));

  const isDashboard = path === "/app" || path === "/app/";
  // Plain menu — avoid Radix DropdownMenu (React 19 composeRefs max-update-depth crash).
  const mobileActions = (
    <div ref={mobileMenuRef} className="relative lg:hidden">
      <button
        type="button"
        className="size-8 grid place-items-center rounded-md border border-border bg-card hover:bg-surface-2 transition-colors"
        title={t("More actions", "ተጨማሪ እርምጃዎች")}
        aria-label={t("More actions", "ተጨማሪ እርምጃዎች")}
        aria-expanded={mobileMenuOpen}
        aria-haspopup="menu"
        onClick={() => setMobileMenuOpen((open) => !open)}
      >
        <Icons.MoreVertical className="size-3.5" />
      </button>
      {mobileMenuOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <div className="px-2 py-1.5">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs text-muted-foreground">
              {roleLabel} · {user.branch}
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          <div className="px-2 py-1 text-xs text-muted-foreground">{t("Language", "ቋንቋ")}</div>
          <button
            type="button"
            role="menuitem"
            className={`flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${lang === "en" ? "font-medium" : ""}`}
            onClick={() => {
              setLang("en");
              setMobileMenuOpen(false);
            }}
          >
            {t("English", "እንግሊዝኛ")}
          </button>
          <button
            type="button"
            role="menuitem"
            className={`flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${lang === "am" ? "font-medium" : ""}`}
            onClick={() => {
              setLang("am");
              setMobileMenuOpen(false);
            }}
          >
            አማርኛ
          </button>
          <div className="my-1 h-px bg-border" />
          <div className="px-2 py-1 text-xs text-muted-foreground">{t("Calendar", "የቀን መቁጠሪያ")}</div>
          <button
            type="button"
            role="menuitem"
            className={`flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${calendar === "gregorian" ? "font-medium" : ""}`}
            onClick={() => {
              setCalendar("gregorian");
              setMobileMenuOpen(false);
            }}
          >
            {t("Gregorian", "ጎርጎርዮሳዊ")}
          </button>
          <button
            type="button"
            role="menuitem"
            className={`flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${calendar === "ethiopian" ? "font-medium" : ""}`}
            onClick={() => {
              setCalendar("ethiopian");
              setMobileMenuOpen(false);
            }}
          >
            {t("Ethiopian", "ኢትዮጵያዊ")}
          </button>
          <div className="my-1 h-px bg-border" />
          {!isDashboard ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => {
                setMobileMenuOpen(false);
                void navigate({ to: "/app" });
              }}
            >
              <Icons.Home className="size-4" />
              {t("Dashboard", "ዳሽቦርድ")}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={() => {
              setDark((value) => !value);
              setMobileMenuOpen(false);
            }}
          >
            {dark ? <Icons.Sun className="size-4" /> : <Icons.Moon className="size-4" />}
            {dark ? t("Light mode", "ብርሃን ሁነታ") : t("Dark mode", "ጨለማ ሁነታ")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
            onClick={() => {
              setMobileMenuOpen(false);
              onLogout();
            }}
          >
            <Icons.LogOut className="size-4" />
            {t("Sign out", "ውጣ")}
          </button>
        </div>
      ) : null}
    </div>
  );

  const sidebar = (
    <>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-2">
          <img
            src={restaurantProfile.logoUrl}
            alt={`${restaurantProfile.name} logo`}
            className="size-7 shrink-0 rounded-lg border border-border bg-card object-cover shadow-[var(--shadow-glow)]"
          />
          <div className="min-w-0 leading-tight">
            <div className="truncate font-display text-sm font-semibold">{restaurantProfile.shortName}</div>
            <div className="truncate text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              {restaurantProfile.tagline}
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-2.5">
        {groups.map((g) => (
          <div key={g}>
            <div className="mb-1 px-2.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              {groupLabel(g)}
            </div>
            <div className="space-y-0.5">
              {visibleNav
                .filter((n) => n.group === g)
                .map((n) => {
                  const active = isNavActive(path, n.to);
                  const isServiceDesk = n.to === "/app/pos";
                  const deskLocked = isServiceDesk && !serviceDeskOpen;
                  if (deskLocked) {
                    return (
                      <div
                        key={n.to}
                        title={t(
                          "Waiting for a barista to clock in",
                          "ባሪስታ እስኪገባ በመጠባበቅ ላይ",
                        )}
                        className="flex min-h-11 cursor-not-allowed items-center gap-2 rounded-md px-2.5 text-[13px] text-muted-foreground/50"
                      >
                        <NavIcon name={n.icon} className="size-3.5 shrink-0" />
                        <span className="truncate font-medium">{navLabel(n.label)}</span>
                        <span className="ml-auto text-[9px] uppercase tracking-wide">
                          {t("Closed", "ዝግ")}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      {...(isServiceDesk ? { search: EMPTY_POS_SEARCH } : {})}
                      onClick={() => setMobileOpen(false)}
                      className={`flex min-h-11 items-center gap-2 rounded-md px-2.5 text-[13px] transition-colors ${
                        active
                          ? "bg-ember text-ember-foreground shadow-[var(--shadow-soft)]"
                          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      }`}
                    >
                      <NavIcon name={n.icon} className="size-3.5 shrink-0" />
                      <span className="truncate font-medium">
                        {navLabel(n.label)}
                      </span>
                      {n.to === "/app/notifications" ? (
                        <NavNotificationBadge user={user} active={active} />
                      ) : null}
                      {isServiceDesk && anyBaristaOnDuty ? (
                        <span
                          className="ml-auto size-1.5 shrink-0 rounded-full bg-teff"
                          title={onDutyNames || t("Barista on duty", "ባሪስታ ተገኝቷል")}
                        />
                      ) : null}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen flex bg-surface/40">
        <BranchPrinterCacheSync />
        <BaristaCallAlert />
        {/* Desktop sidebar */}
        {!sidebarHidden && (
          <aside className="hidden lg:flex h-screen w-56 shrink-0 flex-col sticky top-0 border-r border-border bg-card">
            {sidebar}
          </aside>
        )}

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative z-50 flex h-full w-[min(14rem,86vw)] flex-col border-r border-border bg-card">
              {sidebar}
            </aside>
          </div>
        )}

        <main className="flex-1 min-w-0">
          <header className="sticky top-0 z-20 h-12 backdrop-blur-md bg-background/85 border-b border-border">
            <div className="flex h-12 items-center justify-between gap-1.5 px-3 min-[380px]:gap-2 min-[380px]:px-4 sm:px-5 lg:px-6">
              <div className="flex min-w-0 items-center gap-1 min-[380px]:gap-1.5">
                <button
                  onClick={() => setMobileOpen(true)}
                  title={t("Open navigation", "አሰሳ ክፈት")}
                  aria-label={t("Open navigation", "አሰሳ ክፈት")}
                  className="lg:hidden size-8 grid shrink-0 place-items-center rounded-md border border-border bg-card hover:bg-surface-2"
                >
                  <Icons.Menu className="size-3.5" />
                </button>
                {!isDashboard ? (
                  <Link
                    to="/app"
                    title={t("Dashboard", "ዳሽቦርድ")}
                    aria-label={t("Back to dashboard", "ወደ ዳሽቦርድ ተመለስ")}
                    className="lg:hidden inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-1.5 text-[10px] font-medium hover:bg-surface-2"
                  >
                    <Icons.Home className="size-3" />
                    <span className="hidden min-[380px]:inline">{t("Home", "መነሻ")}</span>
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSidebarHidden((hidden) => !hidden)}
                  className="hidden lg:grid size-8 place-items-center rounded-md border border-border bg-card hover:bg-surface-2 transition-colors"
                  title={sidebarHidden ? t("Show navigation", "አሰሳ አሳይ") : t("Hide navigation", "አሰሳ ደብቅ")}
                >
                  {sidebarHidden ? (
                    <Icons.PanelLeftOpen className="size-3.5" />
                  ) : (
                    <Icons.PanelLeftClose className="size-3.5" />
                  )}
                </button>
                <div className="hidden min-[360px]:block min-w-0">
                  <div className="max-w-[7.5rem] min-[420px]:max-w-[10rem] truncate text-[10px] text-muted-foreground">
                    {today ? formatHeaderDate(today) : ""}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 min-[380px]:gap-1.5">
                <div className="hidden lg:flex items-center rounded border border-border p-px bg-card text-[10px]">
                  <button
                    onClick={() => setLang("en")}
                    className={`px-1.5 h-5 rounded-sm font-medium ${lang === "en" ? "bg-ember text-ember-foreground" : "text-muted-foreground"}`}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => setLang("am")}
                    className={`px-1.5 h-5 rounded-sm font-medium ${lang === "am" ? "bg-ember text-ember-foreground" : "text-muted-foreground"}`}
                  >
                    አማ
                  </button>
                </div>
                <div className="hidden lg:flex items-center rounded border border-border p-px bg-card text-[10px]">
                  <button
                    onClick={() => setCalendar("gregorian")}
                    className={`px-1.5 h-5 rounded-sm font-medium ${calendar === "gregorian" ? "bg-ember text-ember-foreground" : "text-muted-foreground"}`}
                    title={t("Gregorian calendar", "ጎርጎርዮሳዊ ቀን መቁጠሪያ")}
                  >
                    {t("GR", "ጎር")}
                  </button>
                  <button
                    onClick={() => setCalendar("ethiopian")}
                    className={`px-1.5 h-5 rounded-sm font-medium ${calendar === "ethiopian" ? "bg-ember text-ember-foreground" : "text-muted-foreground"}`}
                    title={t("Ethiopian calendar", "የኢትዮጵያ ቀን መቁጠሪያ")}
                  >
                    {t("ET", "ኢት")}
                  </button>
                </div>
                <button
                  onClick={() => setDark((d) => !d)}
                  className="hidden lg:grid size-8 place-items-center rounded-md border border-border bg-card hover:bg-surface-2 transition-colors"
                  title={dark ? t("Switch to light mode", "ወደ ብርሃን ሁነታ ቀይር") : t("Switch to dark mode", "ወደ ጨለማ ሁነታ ቀይር")}
                >
                  {dark ? <Icons.Sun className="size-3.5" /> : <Icons.Moon className="size-3.5" />}
                </button>
                <NotificationBell user={user} t={t} />
                <ProfileHeaderMenu roleLabel={roleLabel} onLogout={onLogout} />
                {mobileActions}
              </div>
            </div>
          </header>

          <div
            className={
              path.startsWith("/app/pos")
                ? "w-full max-w-none p-3 sm:p-4"
                : "mx-auto w-full max-w-[1440px] px-3 py-3 sm:px-5 sm:py-4 lg:px-6"
            }
          >
            <Outlet />
          </div>
        </main>
      </div>
  );
}
