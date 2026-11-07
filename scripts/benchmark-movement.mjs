import { performance } from "node:perf_hooks";
import { createRampMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { calculateReachableActions } from "../src/domain/rules/moveGenerator.js";

// An opt-in diagnostic, not a timing assertion: results depend on the device.
for (const size of [10, 20]) for (const [turn, hasMoney] of [["POLICE", false], ["THIEF", true], ["THIEF", false]]) {
  const map = createRampMapDefinition({ meta: { rows: size, cols: size }, terrain: Array.from({ length: size }, () => Array(size).fill("OVERPASS")) });
  const first = size === 20 ? 3 : 0, last = size === 20 ? 16 : size - 1;
  setLegacyTileAt(map, 0, first, "BANK");
  setLegacyTileAt(map, 0, last, "THIEF_BASE");
  setLegacyTileAt(map, 0, first + 1, "OVERPASS_RAMP_W");
  setLegacyTileAt(map, 0, last - 1, "OVERPASS_RAMP_E");
  setLegacyTileAt(map, size - 1, last, turn === "POLICE" ? "THIEF_SPAWN" : "POLICE_SPAWN");
  setLegacyTileAt(map, size - 2, last, "OVERPASS_RAMP_N");
  for (let c = 0; c < 8; c++) {
    setLegacyTileAt(map, size - 2, c + first, turn === "POLICE" ? "POLICE_SPAWN" : "THIEF_SPAWN");
    setLegacyTileAt(map, size - 3, c + first, "OVERPASS_RAMP_N");
  }
  const session = createGameSession(map);
  const units = turn === "POLICE" ? session.policeUnits : session.thiefUnits;
  units.forEach((unit) => { unit.inCar = true; unit.hasMoney = hasMoney; });
  const start = performance.now();
  let destinations = 0;
  for (const unit of units) destinations += calculateReachableActions({ session, turn, unit, diceValue: 6 }).size;
  console.log(`${size}x${size} ${turn} money=${hasMoney}: ${units.length} units, ${destinations} destinations, ${(performance.now() - start).toFixed(1)} ms`);
}
