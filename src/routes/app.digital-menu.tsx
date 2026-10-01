import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Icons from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PageHeader, Card, Chip, Stat } from "@/components/ui-kit";
import { RealtimeBadge } from "@/components/realtime-badge";
import { SEATING_AREAS } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/date-time";
import { menuCategoryName, menuItemDisplayGlyph, menuItemName, useT } from "@/lib/i18n";
import { loadSystemSettings } from "@/lib/system-settings";
import { useLang } from "@/lib/lang-context";
import { useStore } from "@/lib/store";
import { isAnyBaristaOnDuty } from "@/lib/barista-availability";
import { useBaristaAvailability } from "@/lib/use-barista-availability";

export const Route = createFileRoute("/app/digital-menu")({ component: DigitalMenu });

function guestMenuUrl(baseUrl: string, area?: string) {
  if (!area) return `${baseUrl}/guest`;
  return `${baseUrl}/guest?area=${encodeURIComponent(area)}`;
}

function DigitalMenu() {
  const t = useT();
  const lang = useLang();
  const store = useStore();
  const { shifts } = useBaristaAvailability();
  const locations = useMemo(() => [...SEATING_AREAS], []);
  const [selectedArea, setSelectedArea] = useState<string>(locations[0] ?? "");
  const [previewCat, setPreviewCat] = useState("All");
  const [tab, setTab] = useState<"qr" | "preview" | "requests">("qr");
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const fromStore = store.menuCategories.filter((c) => c !== "All");
    return ["All", ...fromStore];
  }, [store.menuCategories]);
  const menuItems = store.menuItems.filter((item) => item.available !== false);
  const guestRequests = store.guestOrderRequests ?? [];
  const datePrefs = loadSystemSettings().calendar;
  const deskOpen = isAnyBaristaOnDuty(shifts);

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  useEffect(() => {
    if (locations.length === 0) {
      if (selectedArea) setSelectedArea("");
      return;
    }
    if (!locations.includes(selectedArea as (typeof SEATING_AREAS)[number])) {
      setSelectedArea(locations[0] ?? "");
    }
  }, [locations, selectedArea]);

  useEffect(() => {
    if (previewCat !== "All" && !categories.includes(previewCat)) {
      setPreviewCat("All");
    }
  }, [categories, previewCat]);

  const menuUrl = selectedArea ? guestMenuUrl(baseUrl, selectedArea) : guestMenuUrl(baseUrl);
  const hubUrl = guestMenuUrl(baseUrl);
  const usingHub = !selectedArea;

  const filteredItems = useMemo(() => {
    return menuItems.filter(
      (item) => previewCat === "All" || item.category === previewCat,
    );
  }, [menuItems, previewCat]);

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, typeof filteredItems>();
    for (const item of filteredItems) {
      const key = item.category || t("Other", "ሌላ");
      const rows = map.get(key) ?? [];
      rows.push(item);
      map.set(key, rows);
    }
    return [...map.entries()];
  }, [filteredItems, t]);

  const sentCount = useMemo(
    () => guestRequests.filter((request) => request.status === "SENT_TO_WAITER").length,
    [guestRequests],
  );

  const requestCountForArea = useMemo(() => {
    if (!selectedArea) return guestRequests.length;
    return guestRequests.filter(
      (request) => request.area === selectedArea || request.tableNumber === selectedArea,
    ).length;
  }, [guestRequests, selectedArea]);

  async function copyCurrentLink() {
    const url = usingHub ? hubUrl : menuUrl;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareCurrentLink() {
    const url = usingHub ? hubUrl : menuUrl;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${store.restaurantProfile.name}${selectedArea ? ` — ${selectedArea}` : ""}`,
          text: t(
            "Scan or open to order coffee for this location.",
            "ለዚህ ቦታ ቡና ለማዘዝ ይቃኙ ወይም ይክፈቱ።",
          ),
          url,
        });
        return;
      } catch {
        // fall back
      }
    }
    await copyCurrentLink();
  }

  function printQR() {
    const svgEl = qrRef.current?.querySelector("svg");
    if (!svgEl) return;
    const label = selectedArea || t("All locations", "ሁሉም ቦታዎች");
    const url = usingHub ? hubUrl : menuUrl;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const html = `<!DOCTYPE html><html><head><title>QR — ${label}</title>
<style>
  body { font-family: system-ui, sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; gap:14px; color:#1a1a1a; margin:0; padding:24px; }
  h1 { font-size:22px; font-weight:700; margin:0; }
  h2 { font-size:16px; font-weight:600; margin:0; color:#444; }
  p  { font-size:13px; color:#666; margin:0; text-align:center; max-width:280px; line-height:1.4; }
  @media print { @page { margin:12mm; } }
</style></head><body>
  <h1>${store.restaurantProfile.name}</h1>
  <h2>${label}</h2>
  <p>${t("Scan to view the menu and send your order.", "ሜኑውን ለማየት ይቃኙ እና ትዕዛዝዎን ይላኩ።")}</p>
  ${svgData}
  <p style="font-family:monospace;font-size:11px;word-break:break-all">${url}</p>
</body></html>`;
    const win = window.open("", "_blank", "width=420,height=560");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.print();
      win.close();
    };
  }

  const tabs = [
    { id: "qr" as const, label: t("QR codes", "QR ኮዶች"), icon: Icons.QrCode },
    { id: "preview" as const, label: t("Menu preview", "ሜኑ ቅድመ እይታ"), icon: Icons.Smartphone },
    {
      id: "requests" as const,
      label: t("Guest orders", "የእንግዳ ትዕዛዞች"),
      icon: Icons.Inbox,
      badge: sentCount || undefined,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-8">
      <PageHeader
        title={t("Digital Menu", "ዲጂታል ሜኑ")}
        subtitle={t(
          "Print a QR for each office location so staff can order from their phone.",
          "ሰራተኞች ከስልካቸው እንዲያዝዙ ለእያንዳንዱ ቦታ QR ያትሙ።",
        )}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <RealtimeBadge status={store.realtimeStatus} lastSyncAt={store.lastRealtimeSyncAt} />
            <Chip tone={deskOpen ? "teff" : "gold"}>
              {deskOpen ? t("Desk open", "ዴስክ ክፍት") : t("Desk closed", "ዴስክ ዝግ")}
            </Chip>
            <Link
              to="/app/menu"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm hover:bg-surface-2"
            >
              <Icons.BookOpen className="size-4" />
              {t("Edit menu", "ሜኑ አርትዕ")}
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label={t("Drinks", "መጠጦች")} value={String(menuItems.length)} icon="CupSoda" />
        <Stat label={t("Locations", "ቦታዎች")} value={String(locations.length)} icon="MapPin" />
        <Stat
          label={t("Guest orders", "የእንግዳ ትዕዛዞች")}
          value={String(sentCount)}
          tone="teff"
          icon="Send"
        />
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {tabs.map((option) => {
          const Icon = option.icon;
          const active = tab === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setTab(option.id)}
              className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                active
                  ? "bg-ember text-ember-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{option.label}</span>
              {option.badge ? (
                <span
                  className={`rounded-full px-1.5 text-[10px] font-semibold ${
                    active ? "bg-white/20" : "bg-ember/15 text-ember"
                  }`}
                >
                  {option.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "qr" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="!p-4 sm:!p-5">
            <div className="mb-4">
              <h2 className="font-display text-base font-semibold">
                {t("1. Choose a location", "1. ቦታ ይምረጡ")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  "Each QR opens the guest menu for that room or desk area.",
                  "እያንዳንዱ QR ለዚያ ክፍል ወይም ቦታ የእንግዳ ሜኑን ይከፍታል።",
                )}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSelectedArea("")}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                  usingHub
                    ? "border-ember bg-ember/5 ring-1 ring-ember/30"
                    : "border-border bg-card hover:bg-surface-2"
                }`}
              >
                <div
                  className={`grid size-10 shrink-0 place-items-center rounded-lg ${
                    usingHub ? "bg-ember/15 text-ember" : "bg-surface-2 text-muted-foreground"
                  }`}
                >
                  <Icons.Globe className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {t("Any location", "ማንኛውም ቦታ")}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {t("Guest picks where they are", "እንግዳ ቦታቸውን ይመርጣል")}
                  </div>
                </div>
              </button>

              {locations.map((area) => {
                const active = selectedArea === area;
                const count = guestRequests.filter(
                  (request) => request.area === area || request.tableNumber === area,
                ).length;
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setSelectedArea(area)}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                      active
                        ? "border-ember bg-ember/5 ring-1 ring-ember/30"
                        : "border-border bg-card hover:bg-surface-2"
                    }`}
                  >
                    <div
                      className={`grid size-10 shrink-0 place-items-center rounded-lg ${
                        active ? "bg-ember/15 text-ember" : "bg-surface-2 text-muted-foreground"
                      }`}
                    >
                      <Icons.MapPin className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{area}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {count > 0
                          ? t(`${count} recent orders`, `${count} የቅርብ ጊዜ ትዕዛዞች`)
                          : t("Tap to show QR", "QR ለማሳየት ይንኩ")}
                      </div>
                    </div>
                    {active ? <Icons.Check className="size-4 shrink-0 text-ember" /> : null}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="!p-5 lg:sticky lg:top-4 lg:self-start">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("2. Print or share", "2. አትሙ ወይም አጋሩ")}
            </div>
            <h3 className="font-display text-lg font-semibold leading-tight">
              {selectedArea || t("Any location", "ማንኛውም ቦታ")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {usingHub
                ? t(
                    "One code for the whole office — guests choose their area after scanning.",
                    "ለሙሉ ቢሮ አንድ ኮድ — እንግዶች ከቃኘ በኋላ ቦታቸውን ይመርጣሉ።",
                  )
                : t(
                    "Post this QR at the location so orders go to the right place.",
                    "ትዕዛዞች ወደ ትክክለኛው ቦታ እንዲሄዱ ይህን QR እዚያ ይለጥፉ።",
                  )}
            </p>

            <div
              ref={qrRef}
              className="mx-auto my-5 flex w-fit items-center justify-center rounded-2xl border border-border bg-white p-4 shadow-sm"
            >
              <QRCodeSVG
                value={usingHub ? hubUrl : menuUrl}
                size={200}
                level="H"
                includeMargin={false}
                fgColor="#1a1a1a"
                bgColor="#ffffff"
              />
            </div>

            <div className="mb-4 break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-[11px] text-muted-foreground">
              {usingHub ? hubUrl : menuUrl}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={printQR}
                className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ember text-sm font-semibold text-ember-foreground hover:opacity-95"
              >
                <Icons.Printer className="size-4" />
                {t("Print QR", "QR አትም")}
              </button>
              <button
                type="button"
                onClick={() => void copyCurrentLink()}
                className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border text-sm transition-colors ${
                  copied
                    ? "border-teff/40 bg-teff/10 text-teff"
                    : "border-border bg-card hover:bg-surface-2"
                }`}
              >
                {copied ? (
                  <>
                    <Icons.Check className="size-4" />
                    {t("Copied", "ተቀድቷል")}
                  </>
                ) : (
                  <>
                    <Icons.Copy className="size-4" />
                    {t("Copy link", "ሊንክ ቅዳ")}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => void shareCurrentLink()}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-sm hover:bg-surface-2"
              >
                <Icons.Share2 className="size-4" />
                {t("Share", "አጋራ")}
              </button>
            </div>

            <Link
              to="/guest"
              search={{ area: selectedArea || undefined }}
              target="_blank"
              className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-surface-2"
            >
              <Icons.ExternalLink className="size-4" />
              {t("Open guest menu", "የእንግዳ ሜኑ ክፈት")}
            </Link>

            {requestCountForArea > 0 ? (
              <button
                type="button"
                onClick={() => setTab("requests")}
                className="mt-3 w-full text-center text-xs font-medium text-ember hover:underline"
              >
                {t(
                  `View ${requestCountForArea} guest orders →`,
                  `${requestCountForArea} የእንግዳ ትዕዛዞችን ይመልከቱ →`,
                )}
              </button>
            ) : null}
          </Card>
        </div>
      ) : null}

      {tab === "preview" ? (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="!p-4">
            <h2 className="mb-3 font-display text-sm font-semibold">
              {t("Categories", "ምድቦች")}
            </h2>
            <div className="flex flex-wrap gap-2 lg:flex-col">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setPreviewCat(category)}
                  className={`h-9 rounded-full px-3 text-sm font-medium transition-colors lg:w-full lg:text-left ${
                    previewCat === category
                      ? "bg-ember text-ember-foreground"
                      : "border border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {category === "All" ? t("All drinks", "ሁሉም መጠጦች") : menuCategoryName(category, lang)}
                </button>
              ))}
            </div>
            <Link
              to="/guest"
              search={{ area: selectedArea || undefined }}
              target="_blank"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-ember text-sm font-semibold text-ember-foreground"
            >
              <Icons.Smartphone className="size-4" />
              {t("Try on phone", "በስልክ ይሞክሩ")}
            </Link>
          </Card>

          <Card className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2/50 px-4 py-3">
              <div>
                <div className="font-display text-sm font-semibold">
                  {t("What guests see", "እንግዶች የሚያዩት")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {filteredItems.length} {t("available drinks", "ያሉ መጠጦች")}
                </div>
              </div>
              <Chip tone={deskOpen ? "teff" : "gold"}>
                {deskOpen ? t("Ordering open", "ትዕዛዝ ክፍት") : t("Ordering paused", "ትዕዛዝ ቆሟል")}
              </Chip>
            </div>

            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-4">
              {itemsByCategory.map(([category, items]) => (
                <div key={category}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {menuCategoryName(category, lang)}
                  </h3>
                  <div className="space-y-1.5">
                    {items.map((item) => {
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                        >
                          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-lg">
                            {menuItemDisplayGlyph(item, lang)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {menuItemName(item, lang)}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {item.station || t("Coffee station", "የቡና ጣቢያ")}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {filteredItems.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {t("No drinks in this category.", "በዚህ ምድብ መጠጥ የለም።")}
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "requests" ? (
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="font-display text-base font-semibold">
                {t("Recent guest orders", "የቅርብ ጊዜ የእንግዳ ትዕዛዞች")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Orders placed from the digital menu QR.",
                  "ከዲጂታል ሜኑ QR የተላኩ ትዕዛዞች።",
                )}
              </p>
            </div>
            <Link
              to="/app/orders"
              className="text-xs font-medium text-ember hover:underline"
            >
              {t("All orders", "ሁሉም ትዕዛዞች")}
            </Link>
          </div>

          {guestRequests.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted-foreground">
                <Icons.Inbox className="size-5" />
              </div>
              <div className="font-display text-base font-semibold">
                {t("No guest orders yet", "እስካሁን የእንግዳ ትዕዛዝ የለም")}
              </div>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {t(
                  "When someone scans a location QR and sends an order, it shows up here.",
                  "አንድ ሰው የቦታ QR ቃኝቶ ትዕዛዝ ሲልክ እዚህ ይታያል።",
                )}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {guestRequests.slice(0, 20).map((request) => {
                const itemCount = request.items.reduce((sum, line) => sum + line.qty, 0);
                const drinkNames = request.items
                  .slice(0, 3)
                  .map((line) => `${line.qty}× ${menuItemName(line.item, lang)}`)
                  .join(", ");
                return (
                  <div key={request.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-ember/10 text-ember">
                      <Icons.MapPin className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">
                          {request.area || request.tableNumber}
                        </span>
                        <Chip
                          tone={
                            request.status === "SENT_TO_WAITER" || request.status === "IMPORTED"
                              ? "teff"
                              : "gold"
                          }
                        >
                          {request.status === "SENT_TO_WAITER"
                            ? t("Sent", "ተልኳል")
                            : request.status === "IMPORTED"
                              ? t("Imported", "ገብቷል")
                              : t("Pending", "በመጠባበቅ")}
                        </Chip>
                      </div>
                      <div className="mt-0.5 truncate text-sm text-muted-foreground">
                        {drinkNames || t("No items", "ንጥሎች የሉም")}
                        {request.items.length > 3 ? "…" : ""}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {itemCount} {t("items", "ንጥሎች")} ·{" "}
                        {formatDateTime(request.createdAt, datePrefs)}
                        {request.note ? ` · ${request.note}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
