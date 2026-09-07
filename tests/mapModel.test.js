import test from "node:test";
import assert from "node:assert/strict";
import { GRID_SIZE } from "../src/config/constants.js";
import {
  createEmptyMapDefinition,
  getTilePlacementPlan,
  setLegacyTileAt,
  legacyTileMatrixToMapDefinition,
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

function assertMountainBuffer(map) {
  for (let r = 0; r < GRID_SIZE; r++) for (let c = 0; c < GRID_SIZE; c++) {
    if (map.terrain[r][c] !== 'MOUNTAIN') continue;
    for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {
      const tile = map.terrain[r + dr]?.[c + dc];
      assert.ok(tile === undefined || tile === 'MOUNTAIN' || tile === 'GRASS');
    }
  }
}

test('mountain ranges preserve adjacent mountains and grass around edges and concavities', () => {
  for (const cells of [
    [[4, 4], [4, 5], [4, 6]],
    [[4, 4], [4, 5], [5, 4], [5, 5]],
    [[0, 0], [0, 1], [1, 0]],
    [[4, 3], [4, 5], [4, 4]],
    [[4, 4], [5, 5]],
  ]) {
    const map = createEmptyMapDefinition();
    for (const [r, c] of cells) {
      assert.equal(getTilePlacementPlan(map, r, c, 'MOUNTAIN').canPlace, true);
      setLegacyTileAt(map, r, c, 'MOUNTAIN');
      assertMountainBuffer(map);
    }
    for (const [r, c] of cells) assert.equal(map.terrain[r][c], 'MOUNTAIN');
    const before = JSON.stringify(map);
    setLegacyTileAt(map, ...cells[0], 'MOUNTAIN');
    assert.equal(JSON.stringify(map), before);
  }
});

test('extending a mountain protects special cells atomically and previews existing mountains', () => {
  for (const type of ['BANK', 'FARM', 'PARKING', 'POLICE_SPAWN', 'THIEF_SPAWN']) {
    const map = createEmptyMapDefinition();
    setLegacyTileAt(map, 4, 4, 'MOUNTAIN');
    setLegacyTileAt(map, 4, 6, type);
    const before = JSON.stringify(map);
    const plan = getTilePlacementPlan(map, 4, 5, 'MOUNTAIN');
    assert.equal(plan.canPlace, false);
    assert.deepEqual(plan.blockers, [{ r: 4, c: 6, reason: 'SPECIAL_CELL' }]);
    assert.equal(plan.placements.find(p => p.r === 4 && p.c === 4).tileType, 'MOUNTAIN');
    setLegacyTileAt(map, 4, 5, 'MOUNTAIN');
    assert.equal(JSON.stringify(map), before);
  }
});

test('removing a mountain leaves grass while adjacent mountains remain and releases old buffer', () => {
  const map = createEmptyMapDefinition();
  setLegacyTileAt(map, 4, 4, 'MOUNTAIN');
  setLegacyTileAt(map, 4, 5, 'MOUNTAIN');
  for (const type of ['ROAD', 'RIVER', 'BUILDING', 'BANK']) {
    assert.equal(getTilePlacementPlan(map, 4, 4, type).canPlace, false);
    assert.equal(getTilePlacementPlan(map, 3, 4, type).canPlace, false);
  }
  setLegacyTileAt(map, 4, 4, 'GRASS');
  assertMountainBuffer(map);
  assert.equal(getTilePlacementPlan(map, 4, 4, 'ROAD').canPlace, false);
  setLegacyTileAt(map, 4, 5, 'ROAD');
  assert.equal(map.terrain[4][5], 'ROAD');
  assert.equal(getTilePlacementPlan(map, 4, 4, 'ROAD').canPlace, true);
});

test('legacy matrix migration retains adjacent mountain tiles', () => {
  const tiles = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('GRASS'));
  tiles[4][4] = tiles[4][5] = tiles[5][4] = 'MOUNTAIN';
  const map = legacyTileMatrixToMapDefinition(tiles);
  assert.deepEqual(map.terrain, tiles);
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
