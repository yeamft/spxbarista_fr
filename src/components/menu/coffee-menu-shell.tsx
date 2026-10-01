import { useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { Card, PageHeader } from "@/components/ui-kit";
import { useAuth } from "@/lib/auth-context";
import type { MenuItem } from "@/lib/demo-data";
import { menuItemName, useT } from "@/lib/i18n";
import { useLang } from "@/lib/lang-context";
import { showSuccess } from "@/lib/toast";
import { useStore } from "@/lib/store";

const COFFEE_CATEGORIES = [
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

type Draft = {
  id?: string;
  name_en: string;
  name_am: string;
  category: string;
  price: number;
  description: string;
  available: boolean;
  emoji: string;
  station: string;
};

function blankDraft(station: string): Draft {
  return {
    name_en: "",
    name_am: "",
    category: "Espresso Coffee",
    price: 0,
    description: "",
    available: true,
    emoji: "☕",
    station,
  };
}

function toDraft(item: MenuItem): Draft {
  return {
    id: item.id,
    name_en: item.name_en,
    name_am: item.name_am || item.name_en,
    category: item.category || "Espresso Coffee",
    price: item.price,
    description: "",
    available: (item as MenuItem & { available?: boolean }).available !== false,
    emoji: item.emoji || "☕",
    station: item.station || "Coffee Station Pickup",
  };
}

export function CoffeeMenuShell() {
  const t = useT();
  const lang = useLang();
  const { user } = useAuth();
  const store = useStore();
  const canManage =
    user?.role === "Administrator" ||
    user?.role === "Branch Manager" ||
    user?.role === "Supervisor";
  const canToggleStock =
    canManage || user?.role === "Barista" || user?.role === "Coffee House Staff";

  const stations = store.menuStations;
  const defaultStation =
    stations.find((s) => s.toLowerCase().includes("pickup") || s.toLowerCase().includes("coffee")) ??
    stations[0] ??
    "Coffee Station Pickup";

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [draft, setDraft] = useState<Draft | null>(null);

  const categories = useMemo(() => {
    const fromItems = store.menuCategories.length
      ? store.menuCategories
      : [...COFFEE_CATEGORIES];
    return ["All", ...fromItems];
  }, [store.menuCategories]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.menuItems.filter((item) => {
      if (category !== "All" && item.category !== category) return false;
      if (!q) return true;
      return (
        item.name_en.toLowerCase().includes(q) ||
        item.name_am.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [store.menuItems, category, query]);

  async function toggleAvailability(item: MenuItem) {
    if (!canToggleStock) return;
    const nextAvailable = item.available === false;
    const next = { ...item, available: nextAvailable };
    store.saveMenuItem(next);
    showSuccess(
      nextAvailable
        ? t("Marked available", "ይገኛል ተብሏል")
        : t("Marked out of stock", "አልቋል ተብሏል"),
    );
    try {
      const { apiSetMenuAvailability, isExpressApiConfigured } = await import("@/lib/api/express-client");
      if (isExpressApiConfigured()) {
        await apiSetMenuAvailability(item.id, nextAvailable);
      }
    } catch {
      // Keep local change; remote sync is best-effort.
    }
  }

  function openNew() {
    setDraft(blankDraft(defaultStation));
  }

  function openEdit(item: MenuItem) {
    setDraft(toDraft(item));
  }

  function saveDraft() {
    if (!draft || !draft.name_en.trim()) return;
    const id = draft.id ?? `coffee-${Date.now()}`;
    const next: MenuItem = {
      id,
      name_en: draft.name_en.trim(),
      name_am: draft.name_am.trim() || draft.name_en.trim(),
      category: draft.category || "Espresso Coffee",
      price: Number.isFinite(draft.price) ? Math.max(0, draft.price) : 0,
      cost: 0,
      station: draft.station || defaultStation,
      emoji: draft.emoji || "☕",
      pricingMode: "unit",
      defaultQty: 1,
      qtyStep: 1,
      available: draft.available,
    };
    store.saveMenuItem(next);
    if (!store.menuCategories.includes(next.category)) {
      store.addMenuCategory(next.category);
    }
    setDraft(null);
    showSuccess(t("Menu item saved", "ምግብ ተቀምጧል"));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("Coffee Menu", "የቡና ሜኑ")}
        subtitle={t("Drink catalog — name, category, availability", "የመጠጥ ዝርዝር — ስም፣ ምድብ፣ ተገኝነት")}
        actions={
          canManage ? (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-2 rounded-xl bg-ember px-4 py-2 text-sm font-semibold text-ember-foreground"
            >
              <Icons.Plus className="size-4" />
              {t("Add drink", "መጠጥ ጨምር")}
            </button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search drinks…", "መጠጦችን ፈልግ…")}
          className="h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                category === cat ? "bg-ember text-ember-foreground" : "bg-surface-2 text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-surface-2/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">{t("Item", "እቃ")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("Category", "ምድብ")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("Station", "ጣቢያ")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("Status", "ሁኔታ")}</th>
                {(canToggleStock || canManage) && (
                  <th className="px-4 py-3 text-right font-semibold">{t("Actions", "እርምጃዎች")}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => {
                const unavailable = item.available === false;
                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-surface-2/40 ${unavailable ? "opacity-70" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-lg">
                          {item.emoji || "☕"}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{menuItemName(item, lang)}</div>
                          {item.unitLabel ? (
                            <div className="text-xs text-muted-foreground">{item.unitLabel}</div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.station}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          unavailable
                            ? "bg-destructive/10 text-destructive"
                            : "bg-teff/10 text-teff"
                        }`}
                      >
                        {unavailable
                          ? t("Out of stock", "አልቋል")
                          : t("Available", "ይገኛል")}
                      </span>
                    </td>
                    {(canToggleStock || canManage) && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {canToggleStock ? (
                            <button
                              type="button"
                              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                                unavailable
                                  ? "border-teff/40 bg-teff/10 text-teff"
                                  : "border-destructive/30 bg-destructive/10 text-destructive"
                              }`}
                              onClick={() => void toggleAvailability(item)}
                            >
                              {unavailable
                                ? t("Mark available", "ይገኛል አድርግ")
                                : t("Out of stock", "አልቋል")}
                            </button>
                          ) : null}
                          {canManage ? (
                            <button
                              type="button"
                              className="rounded-lg border border-border p-2 hover:bg-surface-2"
                              onClick={() => openEdit(item)}
                              aria-label={t("Edit", "አርትዕ")}
                            >
                              <Icons.Pencil className="size-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!items.length ? (
                <tr>
                  <td
                    colSpan={canToggleStock || canManage ? 5 : 4}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    {t("No drinks match your filters.", "ምንም መጠጥ አልተገኘም።")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {draft ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-lift sm:max-w-md sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">
                {draft.id ? t("Edit drink", "መጠጥ አርትዕ") : t("Add drink", "መጠጥ ጨምር")}
              </h2>
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg p-2 hover:bg-surface-2">
                <Icons.X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t("Name (English)", "ስም (እንግሊዝኛ)")}</span>
                <input
                  className="h-11 w-full rounded-xl border border-border bg-background px-3"
                  value={draft.name_en}
                  onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t("Name (Amharic)", "ስም (አማርኛ)")}</span>
                <input
                  className="h-11 w-full rounded-xl border border-border bg-background px-3"
                  value={draft.name_am}
                  onChange={(e) => setDraft({ ...draft, name_am: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t("Category", "ምድብ")}</span>
                <select
                  className="h-11 w-full rounded-xl border border-border bg-background px-3"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                >
                  {COFFEE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  {store.menuCategories
                    .filter((c) => !(COFFEE_CATEGORIES as readonly string[]).includes(c))
                    .map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t("Price (ETB)", "ዋጋ (ብር)")}</span>
                <input
                  type="number"
                  min={0}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                <input
                  type="checkbox"
                  checked={draft.available}
                  onChange={(e) => setDraft({ ...draft, available: e.target.checked })}
                />
                <span className="text-xs">{t("Available for ordering", "ለትዕዛዝ ይገኛል")}</span>
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-border py-3 text-sm"
                onClick={() => setDraft(null)}
              >
                {t("Cancel", "ሰርዝ")}
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-ember py-3 text-sm font-semibold text-ember-foreground"
                onClick={saveDraft}
              >
                {t("Save", "አስቀምጥ")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
