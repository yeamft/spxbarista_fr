import * as Icons from "lucide-react";
import { Card } from "@/components/ui-kit";
import { useT } from "@/lib/i18n";
import { type StaffFiltersState, type StaffQuickFilter } from "@/lib/staff-management";

const QUICK_FILTERS: Array<{ id: StaffQuickFilter; labelEn: string; labelAm: string }> = [
  { id: "all", labelEn: "All", labelAm: "ሁሉም" },
  { id: "no_login", labelEn: "No Login", labelAm: "መለያ የለም" },
  { id: "disabled_account", labelEn: "Disabled", labelAm: "እንቅስቃሴ የለውም" },
];

export type StaffFiltersPanelProps = {
  filters: StaffFiltersState;
  onChange: (next: StaffFiltersState) => void;
  branches: string[];
  jobTitles: string[];
  shifts: string[];
  stations: string[];
  expanded: boolean;
  onToggleExpanded: () => void;
};

export function StaffFiltersPanel({
  filters,
  onChange,
  branches,
  jobTitles,
  expanded,
  onToggleExpanded,
}: StaffFiltersPanelProps) {
  const t = useT();

  function set<K extends keyof StaffFiltersState>(key: K, value: StaffFiltersState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="sticky top-0 z-20 -mx-1 px-1 pb-3 bg-background/95 backdrop-blur-sm border-b border-border mb-4 space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder={t("Search staff by name or role", "በስም ወይም ሚና ፈልግ")}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <button
          type="button"
          onClick={onToggleExpanded}
          className="h-10 px-3 rounded-lg border border-border bg-card text-sm inline-flex items-center gap-2 hover:bg-surface-2 shrink-0"
        >
          <Icons.SlidersHorizontal className="size-4" />
          {expanded ? t("Hide filters", "ማጣሪያዎችን ደብቅ") : t("More filters", "ተጨማሪ ማጣሪያ")}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => set("quick", item.id)}
            className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
              filters.quick === item.id
                ? "bg-ember text-ember-foreground border-ember"
                : "border-border bg-card text-muted-foreground hover:bg-surface-2"
            }`}
          >
            {t(item.labelEn, item.labelAm)}
          </button>
        ))}
      </div>

      {expanded && (
        <Card className="!p-3 grid grid-cols-2 md:grid-cols-3 gap-3">
          <FilterSelect label={t("Branch", "ቅርንጫፍ")} value={filters.branch} options={branches} onChange={(v) => set("branch", v)} />
          <FilterSelect label={t("Role", "ሚና")} value={filters.jobTitle} options={jobTitles} onChange={(v) => set("jobTitle", v)} />
          <FilterSelect
            label={t("Account", "መለያ")}
            value={filters.account}
            options={["All", "Active", "Disabled", "Pending Activation", "No Account"]}
            onChange={(v) => set("account", v)}
          />
        </Card>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 h-9 px-2 rounded-lg border border-border bg-card text-xs focus:outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}
