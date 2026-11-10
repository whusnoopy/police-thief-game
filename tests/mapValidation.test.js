import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { validateMapDefinition } from "../src/domain/rules/mapValidation.js";

function mapWith(tiles, terrain = "BUILDING", ruleset = "legacy") {
  const map = createEmptyMapDefinition({ ruleset, terrain: Array.from({ length: 10 }, () => Array(10).fill(terrain)) });
  tiles.forEach(([r, c, type]) => setLegacyTileAt(map, r, c, type));
  return map;
}
const required = [[0, 0, "POLICE_SPAWN"], [9, 9, "THIEF_SPAWN"], [0, 9, "BANK"], [9, 0, "THIEF_BASE"]];

test("rejects missing requirements and sealed spawn points with coordinates", () => {
  assert.equal(validateMapDefinition(createEmptyMapDefinition()).valid, false);
  const result = validateMapDefinition(mapWith(required));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes("第 1 行第 1 列") && message.includes("出口")));
  assert.ok(result.errors.some((message) => message.includes("第 10 行第 10 列") && message.includes("银行")));
});

test("accepts an open map and does not require a station for a single thief", () => {
  assert.deepEqual(validateMapDefinition(mapWith(required, "ROAD")), { valid: true, errors: [] });
});

test("requires a reachable station when police must make repeated captures", () => {
  const map = mapWith([...required, [9, 8, "THIEF_SPAWN"]], "ROAD");
  assert.ok(validateMapDefinition(map).errors.some((message) => message.includes("警察局")));
  setLegacyTileAt(map, 5, 5, "POLICE_STATION");
  [[4, 5], [5, 4], [5, 6], [6, 5]].forEach(([r, c]) => setLegacyTileAt(map, r, c, "BUILDING"));
  assert.equal(validateMapDefinition(map).valid, false);
  setLegacyTileAt(map, 4, 5, "ROAD");
  assert.equal(validateMapDefinition(map).valid, true);
});

test("checks the bank-to-base route as well as reaching the bank", () => {
  const map = mapWith(required, "ROAD");
  setLegacyTileAt(map, 8, 0, "BUILDING");
  setLegacyTileAt(map, 9, 1, "BUILDING");
  assert.ok(validateMapDefinition(map).errors.some((message) => message.includes("返程")));
});

test("allows a return through a chokepoint on a later turn", () => {
  const map = mapWith([[0, 0, "BANK"], [0, 1, "ROAD"], [0, 2, "THIEF_SPAWN"],
    [0, 3, "THIEF_BASE"], [1, 2, "POLICE_SPAWN"]]);
  assert.equal(validateMapDefinition(map).valid, true);
});

test("uses walking manholes to connect disconnected islands", () => {
  const map = mapWith([[0, 0, "THIEF_SPAWN"], [0, 1, "MANHOLE"], [9, 5, "MANHOLE"],
    [9, 6, "BANK"], [9, 7, "THIEF_BASE"], [8, 6, "POLICE_SPAWN"]]);
  assert.equal(validateMapDefinition(map).valid, true);
  setLegacyTileAt(map, 0, 1, "ROAD");
  assert.equal(validateMapDefinition(map).valid, false);
});

test("water cuts routes even with a car, while parking connects a bridge route to a grass exit", () => {
  const map = mapWith([[0, 0, "THIEF_SPAWN"], [1, 0, "POLICE_SPAWN"], [0, 1, "ROAD"],
    [0, 2, "RIVER"], [0, 3, "ROAD"], [0, 4, "OVERPASS_RAMP_E"], [0, 5, "OVERPASS"],
    [0, 6, "OVERPASS_RAMP_W"], [0, 7, "BANK"], [0, 8, "PARKING"], [0, 9, "GRASS"], [1, 9, "THIEF_BASE"]], "BUILDING", "ramps");
  assert.equal(validateMapDefinition(map).valid, false);
  setLegacyTileAt(map, 0, 1, "PARKING");
  assert.ok(validateMapDefinition(map).errors.some(message => message.includes("无法到达银行")));
  setLegacyTileAt(map, 0, 2, "ROAD");
  assert.equal(validateMapDefinition(map).valid, true);
  setLegacyTileAt(map, 0, 1, "ROAD");
  assert.equal(validateMapDefinition(map).valid, false);
});

test("a layered import with a facility on water is blocked with an editing hint", () => {
  const map = mapWith(required, "ROAD");
  map.terrain[0][9] = "RIVER";
  const validation = validateMapDefinition(map);
  assert.equal(validation.valid, false);
  assert.match(validation.errors[0], /水面/);
});

test("respects crosswalk direction but does not reject a route just because lights will change", () => {
  const map = mapWith([[0, 0, "THIEF_SPAWN"], [1, 0, "POLICE_SPAWN"],
    [0, 1, "CROSSWALK_HORIZONTAL"], [0, 2, "BANK"], [0, 3, "THIEF_BASE"]]);
  assert.equal(validateMapDefinition(map).valid, true);
  setLegacyTileAt(map, 0, 1, "CROSSWALK_VERTICAL");
  assert.equal(validateMapDefinition(map).valid, false);
});

test("counts capture capacity by reachable region instead of just total police count", () => {
  const map = mapWith([[0, 0, "POLICE_SPAWN"], [0, 1, "THIEF_SPAWN"], [0, 2, "THIEF_SPAWN"],
    [0, 3, "BANK"], [0, 4, "THIEF_BASE"], [9, 9, "POLICE_SPAWN"], [9, 8, "ROAD"]]);
  assert.ok(validateMapDefinition(map).errors.some((message) => message.includes("完成所有抓捕")));
  setLegacyTileAt(map, 1, 0, "POLICE_STATION");
  assert.equal(validateMapDefinition(map).valid, true);
});
