import test from "node:test";
import assert from "node:assert/strict";
import { GRID_SIZE } from "../src/config/constants.js";
import { createEmptyMapDefinition } from "../src/domain/map/mapModel.js";

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
