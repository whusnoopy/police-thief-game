import test from "node:test";
import assert from "node:assert/strict";
import { createRampMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { getCellRuleAt } from "../src/domain/rules/cellRules.js";
import { isAnimalTraversableCell } from "../src/domain/rules/npcRules.js";
import {
  BRIDGE_DIRECTIONS, RAMP_TILE_TYPES, areCellsConnected, getBridgeConnectionMask,
  getRampConnectionIssues, getSurfaceHeight,
} from "../src/domain/map/bridgeTopology.js";

const center = { r: 4, c: 4 };
const offset = ({ dr, dc }, sign = 1) => ({ r: center.r + sign * dr, c: center.c + sign * dc });
function place(map, position, type) { setLegacyTileAt(map, position.r, position.c, type); }
function connectedBothWays(map, from, to, expected) {
  assert.equal(areCellsConnected(map, from, to), expected);
  assert.equal(areCellsConnected(map, to, from), expected);
}

test("all four ramps connect their high and low ends bidirectionally, closing both sides", () => {
  BRIDGE_DIRECTIONS.forEach((direction, index) => {
    const map = createRampMapDefinition();
    place(map, center, RAMP_TILE_TYPES[index]);
    const high = offset(direction);
    const low = offset(direction, -1);
    place(map, high, "OVERPASS");
    connectedBothWays(map, center, high, true);
    connectedBothWays(map, center, low, true);
    for (const side of BRIDGE_DIRECTIONS.filter(({ dr, dc }) => dr * direction.dr + dc * direction.dc === 0)) {
      const neighbor = offset(side);
      for (const type of ["ROAD", "OVERPASS", ...RAMP_TILE_TYPES]) {
        place(map, neighbor, type);
        connectedBothWays(map, center, neighbor, false);
      }
    }
    place(map, high, "ROAD");
    place(map, low, "OVERPASS");
    connectedBothWays(map, center, high, false);
    connectedBothWays(map, center, low, false);
  });
});

test("ramps reject water, grass, obstacles and consecutive ramps, accepting land facility bases", () => {
  for (const [index, direction] of BRIDGE_DIRECTIONS.entries()) {
    const map = createRampMapDefinition();
    place(map, center, RAMP_TILE_TYPES[index]);
    const low = offset(direction, -1);
    const high = offset(direction);
    for (const type of ["RIVER", "GRASS", "BUILDING", "BARRIER", "CONSTRUCTION_SITE", ...RAMP_TILE_TYPES]) {
      place(map, low, type);
      connectedBothWays(map, center, low, false);
    }
    // Check every possible neighbor orientation at both ends, not only sides.
    for (const type of RAMP_TILE_TYPES) {
      place(map, high, type);
      connectedBothWays(map, center, high, false);
    }
    for (const type of ["ROAD", "CROSSWALK_HORIZONTAL", "CROSSWALK_VERTICAL", "BANK", "POLICE_STATION", "PARKING", "MANHOLE", "FARM", "POLICE_SPAWN"]) {
      place(map, low, type);
      connectedBothWays(map, center, low, true);
    }
  }
});

test("ordinary bridges close ground contacts and preserve all 16 bridge connection combinations", () => {
  for (let mask = 0; mask < 16; mask += 1) {
    const map = createRampMapDefinition();
    place(map, center, "OVERPASS");
    BRIDGE_DIRECTIONS.forEach((direction, index) => {
      const neighbor = offset(direction);
      place(map, neighbor, mask & (1 << index) ? "OVERPASS" : "ROAD");
      connectedBothWays(map, center, neighbor, Boolean(mask & (1 << index)));
    });
    assert.equal(getBridgeConnectionMask(map, center.r, center.c), mask);
  }
  const map = createRampMapDefinition();
  place(map, center, "OVERPASS");
  for (const type of ["RIVER", "CROSSWALK_HORIZONTAL", "BANK", "GRASS"]) {
    place(map, { r: 4, c: 5 }, type);
    connectedBothWays(map, center, { r: 4, c: 5 }, false);
  }
});

test("bridge masks include only correctly oriented ramp high ends", () => {
  const map = createRampMapDefinition();
  place(map, center, "OVERPASS");
  BRIDGE_DIRECTIONS.forEach((direction, index) => {
    place(map, offset(direction), RAMP_TILE_TYPES[(index + 2) % 4]);
  });
  assert.equal(getBridgeConnectionMask(map, 4, 4), 15);
  BRIDGE_DIRECTIONS.forEach((direction, index) => place(map, offset(direction), RAMP_TILE_TYPES[index]));
  assert.equal(getBridgeConnectionMask(map, 4, 4), 0);
});

test("topology rejects diagonal, same-cell, fractional and off-board positions and reports invalid ramp ends", () => {
  const map = createRampMapDefinition();
  for (const to of [{ r: 4, c: 4 }, { r: 5, c: 5 }, { r: -1, c: 4 }, { r: 10, c: 4 }, { r: 4.5, c: 4 }]) {
    connectedBothWays(map, center, to, false);
  }
  place(map, { r: 0, c: 0 }, "OVERPASS_RAMP_N");
  assert.deepEqual(getRampConnectionIssues(map), [{ r: 0, c: 0, reason: "RAMP_HIGH_END", neighbor: { r: -1, c: 0 } }]);
  place(map, { r: 1, c: 0 }, "RIVER");
  assert.equal(getRampConnectionIssues(map).length, 2);
});

test("ramp surface heights and driving costs keep one logical position per tile", () => {
  const map = createRampMapDefinition();
  assert.equal(getSurfaceHeight("ROAD"), 0);
  assert.equal(getSurfaceHeight("OVERPASS"), 1);
  for (const type of RAMP_TILE_TYPES) {
    place(map, center, type);
    assert.equal(getSurfaceHeight(type), 0.5);
    const rule = getCellRuleAt(map, 4, 4);
    assert.equal(rule.driveCost, 1);
    assert.equal(rule.walkCost, null);
    assert.deepEqual(rule.walkableRoles, []);
    assert.deepEqual(rule.drivableRoles, ["POLICE", "THIEF"]);
    assert.equal(isAnimalTraversableCell(map, 4, 4), false);
  }
});
