import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { loadRestaurantProfile } from "@/lib/brand";
import { isMenuItemAvailable } from "@/lib/coffee-service-dashboard";
import { SEATING_AREAS, type MenuItem } from "@/lib/demo-data";
import { upsertGuestOrderRequest, type GuestOrderRequest } from "@/lib/guest-ordering";
import { menuCategoryName, menuItemDisplayGlyph, menuItemName } from "@/lib/i18n";
import { useLang } from "@/lib/lang-context";
import { isAnyBaristaOnDuty } from "@/lib/barista-availability";
import { useBaristaAvailability } from "@/lib/use-barista-availability";
import { useStore } from "@/lib/store";
import { showError, showSuccess } from "@/lib/toast";

type GuestSearch = {
  area?: string;
};

export const Route = createFileRoute("/guest")({
  validateSearch: (search: Record<string, unknown>): GuestSearch => ({
    area: typeof search.area === "string" ? search.area : undefined,
  }),
  component: GuestOrderPage,
});

type CartLine = { item: MenuItem; qty: number };

const CATEGORY_ORDER = [
  "Espresso Coffee",
  "Milk Coffee",
  "Black Coffee",
  "Ethiopian Coffee",
  "Iced Coffee",
  "Tea",
  "Hot Drinks",
  "Cold Drinks",
  "Pastries",
  "Snacks",
  "Meeting Service",
] as const;

function sortCategories(cats: string[]) {
  return [...cats].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a as (typeof CATEGORY_ORDER)[number]);
    const bi = CATEGORY_ORDER.indexOf(b as (typeof CATEGORY_ORDER)[number]);
    const aRank = ai === -1 ? 999 : ai;
    const bRank = bi === -1 ? 999 : bi;
    return aRank - bRank || a.localeCompare(b);
  });
}

function GuestOrderPage() {
  const navigate = useNavigate({ from: "/guest" });
  const { area: areaParam } = Route.useSearch();
  const lang = useLang();
  const t = (en: string, am: string) => (lang === "am" ? am : en);
  const store = useStore();
  const { shifts } = useBaristaAvailability();
  const profile = loadRestaurantProfile();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [category, setCategory] = useState("All");

  const area = areaParam?.trim() || "";
  const deskOpen = isAnyBaristaOnDuty(shifts);

  const items = useMemo(
    () =>
      store.menuItems.filter(
        (item) => item.available !== false && isMenuItemAvailable(item),
      ),
    [store.menuItems],
  );

  const categories = useMemo(() => {
    const set = new Set(items.map((item) => item.category).filter(Boolean));
    return ["All", ...sortCategories([...set])];
  }, [items]);

  const visible = useMemo(
    () => items.filter((item) => category === "All" || item.category === category),
    [items, category],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of visible) {
      const key = item.category || t("Other", "ሌላ");
      const rows = map.get(key) ?? [];
      rows.push(item);
      map.set(key, rows);
    }
    return sortCategories([...map.keys()]).map((key) => [key, map.get(key) ?? []] as const);
  }, [visible, t]);

  const totalQty = cart.reduce((sum, line) => sum + line.qty, 0);
  const cartQty = (id: string) => cart.find((line) => line.item.id === id)?.qty ?? 0;

  function pickLocation(nextArea: string) {
    void navigate({
      search: { area: nextArea },
      replace: true,
    });
    setSent(false);
    setCart([]);
    setCategory("All");
  }

  function addItem(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((line) => line.item.id === item.id);
      if (existing) {
        return prev.map((line) =>
          line.item.id === item.id ? { ...line, qty: line.qty + 1 } : line,
        );
      }
      return [...prev, { item, qty: 1 }];
    });
  }

  function changeQty(itemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((line) =>
          line.item.id === itemId ? { ...line, qty: line.qty + delta } : line,
        )
        .filter((line) => line.qty > 0),
    );
  }

  function submitOrder() {
    if (!area) {
      showError(t("Choose where you are first.", "መጀመሪያ የት እንደሚገኙ ይምረጡ።"));
      return;
    }
    if (!deskOpen) {
      showError(
        t(
          "No barista is on duty yet. Please wait.",
          "ባሪስታ እስካሁን አልገባም። እባክዎ ይጠብቁ።",
        ),
      );
      return;
    }
    if (cart.length === 0) {
      showError(t("Add at least one drink.", "ቢያንስ አንድ መጠጥ ያክሉ።"));
      return;
    }
    setSending(true);
    try {
      const request: GuestOrderRequest = {
        id: `guest-${Date.now()}`,
        tableNumber: area,
        area,
        waiter: "Guest",
        status: "SENT_TO_WAITER",
        note: note.trim(),
        createdAt: new Date().toISOString(),
        total: 0,
        items: cart.map((line) => ({ item: line.item, qty: line.qty })),
      };
      upsertGuestOrderRequest(request);
      store.upsertGuestOrderRequest(request);
      setSent(true);
      setCart([]);
      setNote("");
      showSuccess(
        t(
          "Order sent. A barista will prepare it for your location.",
          "ትዕዛዝ ተልኳል። ባሪስታ በቦታዎ ያዘጋጀዋል።",
        ),
      );
    } finally {
      setSending(false);
    }
  }

  if (!area) {
    return (
      <div className="min-h-dvh bg-[var(--gradient-warm)] px-4 py-10">
        <div className="mx-auto w-full max-w-sm space-y-5">
          <div className="text-center">
            <img
              src={profile.logoUrl}
              alt=""
              className="mx-auto mb-4 size-14 rounded-2xl border border-border object-cover shadow-sm"
            />
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {profile.shortName || profile.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Where should we bring your order?", "ትዕዛዝዎን ወዴት እናድርስ?")}
            </p>
          </div>
          <div className="grid gap-2">
            {SEATING_AREAS.map((location) => (
              <button
                key={location}
                type="button"
                onClick={() => pickLocation(location)}
                className="flex h-12 items-center justify-between rounded-2xl border border-border bg-card px-4 text-left text-sm font-semibold shadow-sm hover:bg-surface-2 active:scale-[0.99]"
              >
                <span className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-ember/10 text-ember">
                    <Icons.MapPin className="size-4" />
                  </span>
                  {location}
                </span>
                <Icons.ChevronRight className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
          <Link
            to="/login"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm text-muted-foreground hover:text-foreground"
          >
            <Icons.ArrowLeft className="size-4" />
            {t("Staff login", "የሰራተኛ መግቢያ")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-dvh bg-surface/50 ${cart.length > 0 ? "pb-36" : "pb-8"}`}>
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() =>
              void navigate({ search: { area: undefined }, replace: true })
            }
            className="grid size-9 place-items-center rounded-xl border border-border hover:bg-surface-2"
            aria-label={t("Change location", "ቦታ ቀይር")}
          >
            <Icons.ArrowLeft className="size-4" />
          </button>
          <img
            src={profile.logoUrl}
            alt=""
            className="size-9 rounded-xl border border-border object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-bold">
              {profile.shortName || profile.name}
            </div>
            <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Icons.MapPin className="size-3 shrink-0" />
              {area}
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              deskOpen ? "bg-teff/15 text-teff" : "bg-gold/20 text-gold-foreground"
            }`}
          >
            {deskOpen ? t("Open", "ክፍት") : t("Closed", "ዝግ")}
          </span>
        </div>

        <div className="mx-auto max-w-lg overflow-x-auto px-4 pb-3">
          <div className="flex gap-1.5">
            {categories.map((cat) => {
              const active = category === cat;
              const label =
                cat === "All"
                  ? t("All", "ሁሉም")
                  : menuCategoryName(cat, lang);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-ember text-ember-foreground"
                      : "border border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
        {!deskOpen ? (
          <div className="rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm leading-relaxed">
            {t(
              "Service is paused until a barista clocks in. You can still browse the menu.",
              "ባሪስታ እስኪገባ ድረስ አገልግሎት ቆሟል። ሜኑውን ማየት ይችላሉ።",
            )}
          </div>
        ) : null}

        {sent ? (
          <div className="rounded-2xl border border-teff/30 bg-teff/10 px-4 py-3 text-sm leading-relaxed">
            {t(
              "Order sent — a barista will prepare it for your location.",
              "ትዕዛዝ ተልኳል — ባሪስታ በቦታዎ ያዘጋጀዋል።",
            )}
          </div>
        ) : null}

        {grouped.map(([cat, catItems]) => (
          <section key={cat} className="space-y-2">
            {category === "All" ? (
              <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {menuCategoryName(cat, lang)}
              </h2>
            ) : null}
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {catItems.map((item, index) => {
                const qty = cartQty(item.id);
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-3 py-3 ${
                      index > 0 ? "border-t border-border" : ""
                    }`}
                  >
                    <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl">
                      {menuItemDisplayGlyph(item, lang)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {menuItemName(item, lang)}
                      </div>
                      {item.unitLabel ? (
                        <div className="text-xs text-muted-foreground">{item.unitLabel}</div>
                      ) : null}
                    </div>
                    {qty > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="grid size-8 place-items-center rounded-lg border border-border hover:bg-surface-2"
                          onClick={() => changeQty(item.id, -1)}
                          aria-label={t("Remove one", "አንድ አሳንስ")}
                        >
                          <Icons.Minus className="size-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-bold">{qty}</span>
                        <button
                          type="button"
                          disabled={!deskOpen}
                          className="grid size-8 place-items-center rounded-lg bg-ember text-ember-foreground disabled:opacity-40"
                          onClick={() => addItem(item)}
                          aria-label={t("Add one", "አንድ ጨምር")}
                        >
                          <Icons.Plus className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!deskOpen}
                        onClick={() => addItem(item)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ember/30 bg-ember/10 px-3 text-xs font-semibold text-ember disabled:opacity-40"
                      >
                        <Icons.Plus className="size-3.5" />
                        {t("Add", "ጨምር")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {t("No drinks in this category.", "በዚህ ምድብ መጠጥ የለም።")}
          </p>
        ) : null}
      </div>

      {cart.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.15)] backdrop-blur">
          <div className="mx-auto max-w-lg space-y-2.5">
            <div className="max-h-24 space-y-1 overflow-y-auto">
              {cart.map((line) => (
                <div key={line.item.id} className="flex items-center gap-2 text-sm">
                  <span className="text-base">{menuItemDisplayGlyph(line.item, lang)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {menuItemName(line.item, lang)}
                  </span>
                  <button
                    type="button"
                    className="grid size-7 place-items-center rounded-md border border-border"
                    onClick={() => changeQty(line.item.id, -1)}
                  >
                    <Icons.Minus className="size-3.5" />
                  </button>
                  <span className="w-5 text-center text-xs font-bold">{line.qty}</span>
                  <button
                    type="button"
                    className="grid size-7 place-items-center rounded-md border border-border"
                    onClick={() => changeQty(line.item.id, 1)}
                  >
                    <Icons.Plus className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("Note for barista (optional)", "ለባሪስታ ማስታወሻ (አማራጭ)")}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
            <button
              type="button"
              disabled={sending || !deskOpen}
              onClick={submitOrder}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ember text-sm font-semibold text-ember-foreground shadow-[var(--shadow-glow)] disabled:opacity-40"
            >
              {sending ? (
                <Icons.Loader2 className="size-4 animate-spin" />
              ) : (
                <Icons.Send className="size-4" />
              )}
              {t(`Send order · ${totalQty}`, `ትዕዛዝ ላክ · ${totalQty}`)}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
