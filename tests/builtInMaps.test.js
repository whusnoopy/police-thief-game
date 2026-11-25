import test from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_MAPS, createBuiltInMap } from "../src/domain/map/builtInMaps.js";
import { isWithinMap } from "../src/domain/map/mapDimensions.js";
import { getFeaturePositionsByKind } from "../src/domain/map/mapQueries.js";
import { getBridgeWarnings, getRampConnectionIssues } from "../src/domain/map/bridgeTopology.js";
import { validateMapDefinition } from "../src/domain/rules/mapValidation.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { getFarmSpawnCandidates } from "../src/domain/rules/npcRules.js";

test("all system built-in maps are valid 376-cell continuous ramp maps with intact terrain constraints", () => {
  assert.deepEqual(BUILT_IN_MAPS.map((entry) => entry.id), ["river-city-many", "river-city-duel"]);
  assert.equal(createBuiltInMap("river-city"), null, "retired single-action prototype map is removed");

  for (const { id, createMap } of BUILT_IN_MAPS) {
    const map = createMap();
    const session = createGameSession(map);
    assert.deepEqual(validateMapDefinition(map), { valid: true, errors: [] }, `${id} passes validation`);
    assert.deepEqual(getRampConnectionIssues(map), [], `${id} has valid ramp connections`);
    assert.deepEqual(getBridgeWarnings(map), [], `${id} has no isolated bridge warnings`);
    assert.equal(map.ruleset, "ramps");
    assert.equal(map.actionRules, "continuous");
    assert.equal(map.terrain.flat().filter((t) => t !== "VOID").length, 376);
    assert.ok(map.meta.name.length > 0);
    for (const farm of getFeaturePositionsByKind(map, "FARM")) {
      assert.ok(getFarmSpawnCandidates(session, farm).length >= 1, `${id} farm at ${farm.r},${farm.c} has spawn exits`);
    }
    for (let r = 0; r < 20; r += 1) {
      for (let c = 0; c < 20; c += 1) {
        if (map.terrain[r][c] !== "MOUNTAIN") continue;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          if (isWithinMap(map, r + dr, c + dc)) {
            assert.ok(["GRASS", "MOUNTAIN"].includes(map.terrain[r + dr][c + dc]), `${id} mountain buffer at ${r + dr},${c + dc}`);
          }
        }
      }
    }
  }
});
