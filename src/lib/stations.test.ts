import test from "node:test";
import assert from "node:assert/strict";

import type { MenuItem } from "./demo-data.ts";
import {
  aliasLegacyStation,
  migrateProductionStations,
  resolveProductionStation,
  sameStation,
} from "./stations.ts";

const LIVE_STATIONS = [
  "Main Office",
  "Meeting Room 1",
  "Reception",
  "Boardroom",
  "Executive Office",
  "Coffee Station Pickup",
];

const menuItem = (overrides: Partial<MenuItem>): MenuItem => ({
  id: "item",
  name_en: "Test",
  name_am: "",
  category: "Milk Coffee",
  price: 100,
  cost: 0,
  station: "Coffee Station Pickup",
  emoji: "T",
  ...overrides,
});

test("aliasLegacyStation maps restaurant stations to coffee pickup", () => {
  assert.equal(aliasLegacyStation("Bar"), "Coffee Station Pickup");
  assert.equal(aliasLegacyStation("Kitchen"), "Coffee Station Pickup");
  assert.equal(aliasLegacyStation("Main Hall"), "Main Office");
});

test("sameStation treats legacy Kitchen as Coffee Station Pickup", () => {
  assert.equal(sameStation("Kitchen", "Coffee Station Pickup"), true);
  assert.equal(sameStation("Main Office", "Reception"), false);
});

test("migrateProductionStations replaces restaurant stations", () => {
  const migrated = migrateProductionStations(["Kitchen", "Main Bar", "Coffee House"]);
  assert.deepEqual(migrated, LIVE_STATIONS);
});

test("resolveProductionStation prefers order area when configured", () => {
  const item = menuItem({ name_en: "Cappuccino", category: "Milk Coffee" });
  assert.equal(resolveProductionStation(item, LIVE_STATIONS, "Boardroom"), "Boardroom");
  assert.equal(
    resolveProductionStation(item, LIVE_STATIONS),
    "Coffee Station Pickup",
  );
});
