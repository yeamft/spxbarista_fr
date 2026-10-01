import * as Icons from "lucide-react";
import { Chip } from "@/components/ui-kit";
import { menuItemName, useT } from "@/lib/i18n";
import { useLang } from "@/lib/lang-context";
import type { MenuItemInsight } from "@/lib/menu-analytics";
import { stationTone } from "@/lib/stations";
import { StationIcon } from "@/components/menu/menu-shared";

type ChipTone = "default" | "ember" | "teff" | "gold" | "muted" | "destructive";

export type MenuItemDrawerProps = {
  insight: MenuItemInsight | null;
  onClose: () => void;
  onEdit?: () => void;
  readOnly?: boolean;
};

function availabilityTone(status: MenuItemInsight["availability"]): ChipTone {
  if (status === "Available") return "teff";
  if (status === "Low Stock") return "gold";
  if (status === "Out of Stock") return "destructive";
  return "muted";
}

export function MenuItemDrawer({ insight, onClose, onEdit, readOnly }: MenuItemDrawerProps) {
  const t = useT();
  const lang = useLang();
  if (!insight) return null;

  const { item, availability } = insight;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/30" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-card border-l border-border shadow-xl flex flex-col">
        <header className="flex items-start justify-between gap-3 p-4 border-b border-border shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="size-12 rounded-lg bg-surface-2 grid place-items-center text-lg font-semibold shrink-0">
              {item.emoji || item.name_en.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold truncate">{menuItemName(item, lang)}</h2>
              <p className="text-sm text-muted-foreground truncate">{item.emoji || item.id}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Chip tone={stationTone(item.station) as ChipTone}>
                  <StationIcon station={item.station as never} className="size-3" />
                  {item.station}
                </Chip>
                <Chip tone={availabilityTone(availability)}>{availability}</Chip>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="size-8 grid place-items-center rounded-lg hover:bg-surface-2 shrink-0">
            <Icons.X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{t("General", "አጠቃላይ")}</h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div><dt className="text-muted-foreground text-xs">{t("Category", "ምድብ")}</dt><dd>{item.category}</dd></div>
              <div><dt className="text-muted-foreground text-xs">{t("Station", "ጣቢያ")}</dt><dd>{item.station}</dd></div>
              <div><dt className="text-muted-foreground text-xs">{t("Unit", "መለኪያ")}</dt><dd>{item.unitLabel ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground text-xs">{t("Diet", "አመጋገብ")}</dt><dd>{item.veg ? t("Vegetarian", "አትክልታማ") : t("Standard", "መደበኛ")}</dd></div>
              <div className="col-span-2"><dt className="text-muted-foreground text-xs">{t("English name", "እንግሊዝኛ ስም")}</dt><dd>{item.name_en}</dd></div>
              {item.name_am && (
                <div className="col-span-2"><dt className="text-muted-foreground text-xs">{t("Amharic name", "አማርኛ ስም")}</dt><dd>{item.name_am}</dd></div>
              )}
            </dl>
          </section>
        </div>

        {!readOnly && onEdit && (
          <footer className="p-4 border-t border-border shrink-0 flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 h-11 rounded-lg bg-ember text-ember-foreground text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              <Icons.Pencil className="size-4" />
              {t("Edit item", "እቃ አስተካክል")}
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}
