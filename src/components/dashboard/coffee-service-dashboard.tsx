import { Link } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { useMemo } from "react";
import { BaristaClockInButton } from "@/components/barista-clock-in-button";
import { CallBaristaButton } from "@/components/call-barista-button";
import { Card, Chip, PageHeader, Stat } from "@/components/ui-kit";
import { useAuth } from "@/lib/auth-context";
import {
  canUseServiceDesk,
  isAnyBaristaOnDuty,
  onDutyBaristas,
} from "@/lib/barista-availability";
import {
  buildCoffeeServiceOverview,
  findUserQueuePlace,
  formatDurationMinutes,
  type CoffeeServicePhase,
} from "@/lib/coffee-service-dashboard";
import { useLang } from "@/lib/lang-context";
import { useStore } from "@/lib/store";
import { useBaristaAvailability } from "@/lib/use-barista-availability";

const EMPTY_POS_SEARCH = {
  table: undefined,
  area: undefined,
  waiter: undefined,
  orderId: undefined,
  mode: undefined,
} as const;

const PHASE_LABEL: Record<CoffeeServicePhase, { en: string; am: string }> = {
  new: { en: "New", am: "አዲስ" },
  accepted: { en: "Accepted", am: "ተቀባይነት" },
  preparing: { en: "Preparing", am: "በዝግጅት" },
  ready: { en: "Ready", am: "ዝግጁ" },
  completed: { en: "Completed", am: "ተጠናቋል" },
  cancelled: { en: "Cancelled", am: "ተሰርዟል" },
};

const PHASE_TONE: Record<CoffeeServicePhase, "default" | "ember" | "teff" | "gold" | "muted"> = {
  new: "gold",
  accepted: "teff",
  preparing: "ember",
  ready: "teff",
  completed: "muted",
  cancelled: "muted",
};

function greetingForNow(lang: "en" | "am") {
  const hour = new Date().getHours();
  if (hour < 12) return lang === "am" ? "እንደምን አደሩ" : "Good morning";
  if (hour < 17) return lang === "am" ? "እንደምን አረፈዱ" : "Good afternoon";
  return lang === "am" ? "እንደምን ዋሉ" : "Good evening";
}

export function CoffeeServiceDashboard() {
  const { user } = useAuth();
  const lang = useLang();
  const t = (en: string, am: string) => (lang === "am" ? am : en);
  const store = useStore();
  const { shifts } = useBaristaAvailability();

  const overview = useMemo(
    () => buildCoffeeServiceOverview(store.orders, store.menuItems),
    [store.orders, store.menuItems],
  );

  if (!user) return null;

  const firstName = user.name.split(" ")[0] ?? user.name;
  const deskOpen = canUseServiceDesk(user.role, shifts);
  const onDuty = onDutyBaristas(shifts);
  const anyOnDuty = isAnyBaristaOnDuty(shifts);
  const isRequestor =
    user.role === "User" || user.role === "Cashier" || user.role === "Coffee House Staff";
  const myPlace = isRequestor ? findUserQueuePlace(overview.queue, user.name) : null;

  return (
    <div className="min-w-0 space-y-4 pb-6">
      <PageHeader
        title={`${greetingForNow(lang)}, ${firstName}`}
        subtitle={
          anyOnDuty
            ? t(
                `On duty: ${onDuty.map((s) => s.baristaName).join(", ")}`,
                `ተገኝተዋል: ${onDuty.map((s) => s.baristaName).join(", ")}`,
              )
            : t("Waiting for barista to clock in", "ባሪስታ እስኪገባ በመጠባበቅ ላይ")
        }
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <BaristaClockInButton />
            {user.role !== "Barista" ? <CallBaristaButton location="Coffee Service" /> : null}
            {deskOpen ? (
              <Link
                to="/app/pos"
                search={EMPTY_POS_SEARCH}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-surface-2 sm:w-auto"
              >
                <Icons.Plus className="size-4" />
                {t("Place Order", "ትዕዛዝ አስገባ")}
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex h-9 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm font-medium text-muted-foreground sm:w-auto"
                title={t(
                  "Service Desk opens when a barista clocks in",
                  "ባሪስታ ሲገባ ሰርቪስ ዴስክ ይከፈታል",
                )}
              >
                <Icons.Lock className="size-4" />
                {t("Service Desk closed", "ሰርቪስ ዴስክ ዝግ ነው")}
              </button>
            )}
          </div>
        }
      />

      {isRequestor ? (
        <Card className="border-ember/25 bg-ember/5 !p-4">
          {myPlace ? (
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("Your queue", "የእርስዎ ወረፋ")}
                </div>
                <div className="mt-1 font-display text-2xl font-semibold leading-none">
                  {myPlace.row.phase === "ready"
                    ? t("Ready for pickup", "ለመውሰድ ዝግጁ")
                    : myPlace.aheadCount === 0
                      ? t("You're next", "እርስዎ ቀጣይ ነዎት")
                      : t(
                          `${myPlace.aheadCount} ahead of you`,
                          `${myPlace.aheadCount} ከእርስዎ በፊት`,
                        )}
                </div>
                <div className="mt-1.5 truncate text-sm text-muted-foreground">
                  {myPlace.row.orderNo} · {myPlace.row.itemsLabel} · #
                  {myPlace.position} {t("of", "ከ")} {myPlace.totalInQueue}
                </div>
              </div>
              <Chip tone={PHASE_TONE[myPlace.row.phase]}>
                {lang === "am" ? PHASE_LABEL[myPlace.row.phase].am : PHASE_LABEL[myPlace.row.phase].en}
              </Chip>
            </div>
          ) : (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("Your queue", "የእርስዎ ወረፋ")}
              </div>
              <div className="mt-1 font-display text-lg font-semibold">
                {t("No active order", "ንቁ ትዕዛዝ የለዎትም")}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {t(
                  `${overview.queue.length} in queue right now`,
                  `አሁን ${overview.queue.length} በወረፋ ላይ ናቸው`,
                )}
              </div>
            </div>
          )}
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <Stat
          label={t("Orders Today", "የዛሬ ትዕዛዞች")}
          value={String(overview.ordersToday)}
          tone="ember"
          icon="ShoppingBag"
          to="/app/orders"
        />
        <Stat
          label={t("Active", "ንቁ")}
          value={String(overview.activeOrders)}
          tone="gold"
          icon="Timer"
          to="/app/orders"
        />
        <Stat
          label={t("Ready", "ዝግጁ")}
          value={String(overview.readyForService)}
          tone="teff"
          icon="CheckCircle2"
          to="/app/kds"
        />
        <Stat
          label={t("Completed", "ተጠናቋል")}
          value={String(overview.completedToday)}
          icon="CircleCheck"
          to="/app/orders"
        />
        <Stat
          label={t("Avg Prep", "አማካኝ ዝግጅት")}
          value={formatDurationMinutes(overview.avgPrepMinutes)}
          icon="Hourglass"
        />
        <Stat
          label={t("Employees", "ሰራተኞች")}
          value={String(overview.employeesServed)}
          icon="Users"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { to: "/app/pos" as const, label: t("Place Order", "ትዕዛዝ አስገባ"), icon: Icons.Coffee, primary: true },
          { to: "/app/orders" as const, label: t("Orders", "ትዕዛዞች"), icon: Icons.ClipboardList },
          { to: "/app/menu" as const, label: t("Menu", "ሜኑ"), icon: Icons.BookOpen },
          { to: "/app/kds" as const, label: t("Station", "ጣቢያ"), icon: Icons.ChefHat },
        ].map((action) => {
          const Icon = action.icon;
          const className = action.primary
            ? "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ember px-3 text-sm font-medium text-ember-foreground"
            : "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-surface-2";
          if (action.to === "/app/pos") {
            return (
              <Link key={action.to} to={action.to} search={EMPTY_POS_SEARCH} className={className}>
                <Icon className="size-4" />
                {action.label}
              </Link>
            );
          }
          return (
            <Link key={action.to} to={action.to} className={className}>
              <Icon className="size-4" />
              {action.label}
            </Link>
          );
        })}
      </div>

      <Card className="!p-0 flex w-full min-w-0 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4">
          <h2 className="font-display text-base font-semibold">{t("Current Queue", "የአሁን ወረፋ")}</h2>
          <Link to="/app/orders" className="text-xs font-medium text-ember hover:underline">
            {t("View all", "ሁሉንም ይመልከቱ")}
          </Link>
        </div>
        <div className="divide-y divide-border">
          {overview.queue.slice(0, 8).map((row) => {
            const isMine = Boolean(myPlace && myPlace.row.id === row.id);
            return (
              <div
                key={row.id}
                className={`flex items-center gap-3 px-3 py-2.5 sm:px-4 ${
                  isMine ? "bg-ember/5" : ""
                }`}
              >
                <span className="w-7 shrink-0 font-mono text-xs font-semibold text-muted-foreground">
                  #{row.position}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {row.orderNo} · {row.employee}
                    {isMine ? (
                      <span className="ml-1.5 text-xs font-medium text-ember">
                        {t("you", "እርስዎ")}
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {row.itemsLabel} ·{" "}
                    {row.aheadCount === 0
                      ? t("Next up", "ቀጣይ")
                      : t(`${row.aheadCount} ahead`, `${row.aheadCount} በፊት`)}
                  </div>
                </div>
                <Chip tone={PHASE_TONE[row.phase]}>
                  {lang === "am" ? PHASE_LABEL[row.phase].am : PHASE_LABEL[row.phase].en}
                </Chip>
                <span className="w-12 shrink-0 text-right font-mono text-xs text-muted-foreground">
                  {row.waitingMinutes}m
                </span>
              </div>
            );
          })}
          {overview.queue.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("No active orders.", "ንቁ ትዕዛዞች የሉም።")}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
