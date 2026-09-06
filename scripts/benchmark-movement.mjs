import { performance } from "node:perf_hooks";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { calculateReachableActions } from "../src/domain/rules/moveGenerator.js";

// An opt-in diagnostic, not a timing assertion: results depend on the device.
for (const [turn, hasMoney] of [["POLICE", false], ["THIEF", true], ["THIEF", false]]) {
  const map = createEmptyMapDefinition({ terrain: Array.from({ length: 10 }, () => Array(10).fill("OVERPASS")) });
  setLegacyTileAt(map, 0, 0, "BANK");
  setLegacyTileAt(map, 0, 9, "THIEF_BASE");
  setLegacyTileAt(map, 9, 9, turn === "POLICE" ? "THIEF_SPAWN" : "POLICE_SPAWN");
  for (let c = 0; c < 8; c++) setLegacyTileAt(map, 8, c, turn === "POLICE" ? "POLICE_SPAWN" : "THIEF_SPAWN");
  const session = createGameSession(map);
  const units = turn === "POLICE" ? session.policeUnits : session.thiefUnits;
  units.forEach((unit) => { unit.inCar = true; unit.hasMoney = hasMoney; });
  const start = performance.now();
  let destinations = 0;
  for (const unit of units) destinations += calculateReachableActions({ session, turn, unit, diceValue: 6 }).size;
  console.log(`${turn} money=${hasMoney}: ${units.length} units, ${destinations} destinations, ${(performance.now() - start).toFixed(1)} ms`);
}
