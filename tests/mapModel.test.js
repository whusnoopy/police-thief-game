import test from "node:test";
import assert from "node:assert/strict";
import { GRID_SIZE } from "../src/config/constants.js";
import {
  createEmptyMapDefinition,
  getTilePlacementPlan,
  setLegacyTileAt,
} from "../src/domain/map/mapModel.js";

test("new empty maps default every terrain cell to road", () => {
  const mapDefinition = createEmptyMapDefinition();

  assert.equal(mapDefinition.terrain.length, GRID_SIZE);
  mapDefinition.terrain.forEach((row) => {
    assert.equal(row.length, GRID_SIZE);
    row.forEach((tileType) => {
      assert.equal(tileType, "ROAD");
    });
  });
});

test("mountain placement forces orthogonal cells to grass", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 4, 4, "MOUNTAIN");

  assert.equal(mapDefinition.terrain[4][4], "MOUNTAIN");
  assert.equal(mapDefinition.terrain[3][4], "GRASS");
  assert.equal(mapDefinition.terrain[4][5], "GRASS");
  assert.equal(mapDefinition.terrain[5][4], "GRASS");
  assert.equal(mapDefinition.terrain[4][3], "GRASS");
});

test("mountain placement is rejected when its footprint would cover special cells", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 4, 5, "BANK");

  const plan = getTilePlacementPlan(mapDefinition, 4, 4, "MOUNTAIN");

  assert.equal(plan.canPlace, false);
  assert.deepEqual(
    plan.blockers.map((blocker) => blocker.reason),
    ["SPECIAL_CELL"],
  );

  setLegacyTileAt(mapDefinition, 4, 4, "MOUNTAIN");
  assert.equal(mapDefinition.terrain[4][4], "ROAD");
});

test("mountain grass buffer rejects non-grass placements but allows clearing the mountain", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 4, 4, "MOUNTAIN");

  const blockedPlan = getTilePlacementPlan(mapDefinition, 4, 5, "ROAD");
  assert.equal(blockedPlan.canPlace, false);
  setLegacyTileAt(mapDefinition, 4, 5, "ROAD");
  assert.equal(mapDefinition.terrain[4][5], "GRASS");

  const clearingPlan = getTilePlacementPlan(mapDefinition, 4, 4, "ROAD");
  assert.equal(clearingPlan.canPlace, true);
  setLegacyTileAt(mapDefinition, 4, 4, "ROAD");
  assert.equal(mapDefinition.terrain[4][4], "ROAD");
});
