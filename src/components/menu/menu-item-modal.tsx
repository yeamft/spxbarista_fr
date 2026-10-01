import { useMemo, useState } from "react";
import * as Icons from "lucide-react";
import type { MenuItem, ProductionStation } from "@/lib/demo-data";
import { useT } from "@/lib/i18n";

function resolveSingleStation(stations: readonly ProductionStation[]) {
  return (
    stations.find((station) => station.toLowerCase().includes("coffee")) ??
    stations[0] ??
    "Coffee House"
  );
}

export type MenuItemModalProps = {
  item?: MenuItem;
  categories: string[];
  stations: readonly ProductionStation[];
  stockItems?: unknown;
  balances?: unknown;
  lots?: unknown;
  onClose: () => void;
  onSave: (m: MenuItem) => void;
};

export function MenuItemModal({
  item,
  categories,
  stations,
  onClose,
  onSave,
}: MenuItemModalProps) {
  const t = useT();
  const singleStation = resolveSingleStation(stations);
  const [form, setForm] = useState<MenuItem>(
    item
      ? {
          ...item,
          station: singleStation,
        }
      : {
          id: `m${Date.now()}`,
          name_en: "",
          name_am: "",
          category: categories[0] ?? "Coffee",
          price: 0,
          cost: 0,
          station: singleStation,
          emoji: "",
          pricingMode: "unit",
          unitLabel: "Cup",
        },
  );

  const categoryOptions = useMemo(() => {
    const base = categories.filter(Boolean);
    if (!base.some((row) => row.trim().toLowerCase() === "coffee")) base.push("Coffee");
    return base;
  }, [categories]);

  function submit() {
    if (!form.name_en.trim()) return;
    if (!form.category.trim()) return;
    onSave({
      ...form,
      name_en: form.name_en.trim(),
      name_am: form.name_am.trim(),
      category: form.category.trim(),
      station: singleStation,
      price: Math.max(0, form.price ?? 0),
      cost: Math.max(0, form.cost ?? 0),
      pricingMode: "unit",
      unitLabel: form.unitLabel?.trim() || "Cup",
      sellingUnit: form.unitLabel?.trim() || "Cup",
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm grid place-items-center p-4">
      <div className="surface-card max-w-lg w-full !p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl font-semibold">
            {item ? t("Edit item", "እቃ አስተካክል") : t("Add item", "እቃ ያክሉ")}
          </h3>
          <button
            onClick={onClose}
            className="size-8 grid place-items-center rounded-lg hover:bg-surface-2"
          >
            <Icons.X className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs text-muted-foreground">{t("Name (English)", "ስም (እንግሊዝኛ)")}</label>
            <input
              value={form.name_en}
              onChange={(event) => setForm({ ...form, name_en: event.target.value })}
              className="w-full mt-1 h-9 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs text-muted-foreground">{t("Name (AM)", "ስም (አማርኛ)")}</label>
            <input
              value={form.name_am}
              onChange={(event) => setForm({ ...form, name_am: event.target.value })}
              className="w-full mt-1 h-9 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("Category", "ምድብ")}</label>
            <select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              className="w-full mt-1 h-9 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none"
            >
              {categoryOptions.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("Station", "ጣቢያ")}</label>
            <input
              value={singleStation}
              readOnly
              className="w-full mt-1 h-9 px-3 rounded-lg border border-border bg-surface-2 text-sm text-muted-foreground"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("Unit label", "የመለኪያ ስም")}</label>
            <select
              value={
                ["Cup", "Glass", "Bottle", "Plate", "Bowl"].includes(form.unitLabel ?? "")
                  ? (form.unitLabel ?? "Cup")
                  : "__custom"
              }
              onChange={(event) => {
                if (event.target.value !== "__custom") setForm({ ...form, unitLabel: event.target.value });
                else setForm({ ...form, unitLabel: "" });
              }}
              className="w-full mt-1 h-9 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none"
            >
              {["Cup", "Glass", "Bottle", "Plate", "Bowl"].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              <option value="__custom">{t("Custom…", "ሌላ…")}</option>
            </select>
            {!["Cup", "Glass", "Bottle", "Plate", "Bowl"].includes(form.unitLabel ?? "") && (
              <input
                value={form.unitLabel ?? ""}
                placeholder={t("e.g. Pot, Tray", "ለምሳሌ Pot, Tray")}
                onChange={(event) => setForm({ ...form, unitLabel: event.target.value || undefined })}
                className="w-full mt-1 h-9 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("Short code", "አጭር ኮድ")}</label>
            <input
              value={form.emoji}
              placeholder={t("e.g. AF, TJ, MW", "ለምሳሌ AF, TJ, MW")}
              onChange={(event) => setForm({ ...form, emoji: event.target.value })}
              className="w-full mt-1 h-9 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div className="col-span-2 flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="veg"
              checked={form.veg ?? false}
              onChange={(event) => setForm({ ...form, veg: event.target.checked })}
              className="size-4 rounded"
            />
            <label htmlFor="veg" className="text-sm">
              {t("Vegetarian", "አትክልታማ")}
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 min-h-12 rounded-lg border border-border bg-card text-sm hover:bg-surface-2"
          >
            {t("Cancel", "ሰርዝ")}
          </button>
          <button
            onClick={submit}
            className="flex-1 min-h-12 rounded-lg bg-ember text-ember-foreground text-sm font-semibold"
          >
            {t("Save", "አስቀምጥ")}
          </button>
        </div>
      </div>
    </div>
  );
}
