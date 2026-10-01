import { PRODUCTION_STATIONS, type MenuItem, type ProductionStation } from "./demo-data.ts";

const STORAGE_KEY = "bl_production_stations";

export type StationTone = "default" | "ember" | "teff" | "gold" | "muted" | "destructive";

const LEGACY_STATION_MAP: Record<string, ProductionStation> = {
  Hot: "Coffee Station Pickup",
  Cold: "Coffee Station Pickup",
  Bakery: "Coffee Station Pickup",
  Grill: "Coffee Station Pickup",
  Bar: "Coffee Station Pickup",
  Butcher: "Coffee Station Pickup",
  Kitchen: "Coffee Station Pickup",
  "Main Bar": "Coffee Station Pickup",
  "VIP Bar": "Coffee Station Pickup",
  "Butcher House": "Coffee Station Pickup",
  "Coffee House": "Coffee Station Pickup",
  "Main Hall": "Main Office",
  VIP: "Executive Office",
  Rooftop: "Reception",
  VVIP: "Boardroom",
};

const LEGACY_RESTAURANT_KEYS = new Set([
  "kitchen",
  "main bar",
  "vip bar",
  "butcher house",
  "coffee house",
  "main hall",
  "rooftop",
  "vvip",
]);

export function normalizeStationName(station: string) {
  return station.trim().replace(/\s+/g, " ");
}

export function sameStation(left?: string | null, right?: string | null) {
  if (!left || !right) return false;
  return (
    aliasLegacyStation(left).toLowerCase() === aliasLegacyStation(right).toLowerCase()
  );
}

export function uniqueStations(stations: readonly string[]) {
  const seen = new Set<string>();
  return stations.reduce<ProductionStation[]>((items, station) => {
    const value = normalizeStationName(station);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return items;
    seen.add(key);
    return [...items, value];
  }, []);
}

export function aliasLegacyStation(station: string) {
  const normalized = normalizeStationName(station);
  if (!normalized) return normalized;
  const mapped = LEGACY_STATION_MAP[normalized];
  if (mapped) return mapped;
  const key = normalized.toLowerCase();
  if (key === "bar") return "Coffee Station Pickup";
  if (key === "butcher") return "Coffee Station Pickup";
  return normalized;
}

export function isVipBarStation(station: string) {
  const key = station.toLowerCase();
  return key.includes("vip") && (key.includes("bar") || key.includes("drink") || key.includes("beverage"));
}

export function isMainBarStation(station: string) {
  const key = station.toLowerCase();
  if (isVipBarStation(station)) return false;
  return key === "bar" || (key.includes("main") && key.includes("bar")) || key.includes("beverage");
}

export function isBarStation(station: string) {
  const key = station.toLowerCase();
  return key.includes("bar") || key.includes("drink") || key.includes("beverage");
}

export function vipBarStation(stations: readonly string[]) {
  return (
    stations.find((station) => isVipBarStation(station)) ??
    findStation("Coffee Station Pickup", stations)
  );
}

export function mainBarStation(stations: readonly string[]) {
  return (
    stations.find((station) => isMainBarStation(station)) ??
    findStation("Coffee Station Pickup", stations) ??
    findStation("Bar", stations)
  );
}

export function canonicalizeStationName(
  station: string,
  stations: readonly string[] = [],
) {
  const aliased = aliasLegacyStation(station);
  return findStation(aliased, stations) ?? findStation(station, stations) ?? aliased;
}

export function defaultProductionStations() {
  return uniqueStations(PRODUCTION_STATIONS);
}

export function migrateProductionStations(stations: readonly string[]) {
  const raw = uniqueStations(stations.map((station) => normalizeStationName(station)).filter(Boolean));
  const looksLegacy = raw.some((station) => {
    const key = station.toLowerCase();
    return LEGACY_RESTAURANT_KEYS.has(key) || Boolean(LEGACY_STATION_MAP[station]);
  });
  if (looksLegacy || raw.length === 0) {
    return defaultProductionStations();
  }
  return uniqueStations([...raw.map((station) => aliasLegacyStation(station)), ...defaultProductionStations()]);
}

export function loadProductionStations() {
  const fallback = defaultProductionStations();
  if (typeof window === "undefined") return fallback;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return fallback;
    const stations = migrateProductionStations(
      parsed.filter((item): item is string => typeof item === "string"),
    );
    const next = stations.length > 0 ? stations : fallback;
    if (JSON.stringify(next) !== JSON.stringify(parsed)) {
      saveProductionStations(next);
    }
    return next;
  } catch {
    return fallback;
  }
}

export function saveProductionStations(stations: readonly string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(migrateProductionStations(stations)));
}

export function findStation(station: string, stations: readonly string[]) {
  const key = normalizeStationName(station).toLowerCase();
  return stations.find((item) => item.toLowerCase() === key);
}

export function isConfiguredStation(station: string, stations: readonly string[]) {
  return Boolean(findStation(canonicalizeStationName(station, stations), stations));
}

function findStationByKeyword(stations: readonly string[], keywords: string[]) {
  return stations.find((station) => {
    const key = station.toLowerCase();
    return keywords.some((keyword) => key.includes(keyword));
  });
}

export function fallbackStation(stations: readonly string[]) {
  return (
    findStation("Coffee Station Pickup", stations) ??
    stations[0] ??
    defaultProductionStations()[0] ??
    "Coffee Station Pickup"
  );
}

export function isSpiritMenuItem(_item: Pick<MenuItem, "category" | "station" | "stockDeductionLocation">) {
  return false;
}

export function resolveProductionStation(
  item: MenuItem,
  stations: readonly string[] = defaultProductionStations(),
  area?: string,
) {
  const configured = stations.length > 0 ? stations : defaultProductionStations();

  if (area?.trim()) {
    const fromArea = findStation(canonicalizeStationName(area, configured), configured);
    if (fromArea) return fromArea;
  }

  const canonical = canonicalizeStationName(item.station, configured);
  const exact = findStation(canonical, configured);
  if (exact) return exact;

  return (
    findStationByKeyword(configured, ["coffee", "pickup"]) ??
    findStation("Coffee Station Pickup", configured) ??
    fallbackStation(configured)
  );
}

export function stationTone(station: string): StationTone {
  const key = station.toLowerCase();
  if (key.includes("pickup") || key.includes("coffee")) return "teff";
  if (key.includes("executive") || key.includes("board")) return "gold";
  if (key.includes("meeting") || key.includes("office")) return "ember";
  if (key.includes("reception")) return "default";
  return "muted";
}

export function stationIconName(station: string) {
  const key = station.toLowerCase();
  if (key.includes("pickup") || key.includes("coffee")) return "Coffee";
  if (key.includes("meeting") || key.includes("board")) return "Users";
  if (key.includes("reception")) return "Bell";
  if (key.includes("executive") || key.includes("office")) return "Briefcase";
  return "MapPin";
}

export function stationHelp(station: string) {
  const key = station.toLowerCase();
  if (key.includes("pickup") || key.includes("coffee")) return "Coffee bar prep and walk-up pickup";
  if (key.includes("meeting") || key.includes("board")) return "Meeting and boardroom refreshment delivery";
  if (key.includes("reception")) return "Reception desk service";
  if (key.includes("executive")) return "Executive office delivery";
  if (key.includes("office")) return "Office desk delivery";
  return "Serving location for coffee office orders";
}

export function stationPrinter(station: string) {
  return `${station} ticket printer`;
}
