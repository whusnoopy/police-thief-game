import test from "node:test";
import assert from "node:assert/strict";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import {
  canAnimalOccupyCell,
  getAnimalCountForFarm,
  getFarmKey,
  moveAnimals,
  spawnAnimalsNearFarms,
} from "../src/domain/rules/npcRules.js";

function createSequenceRng(values) {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

test("farms spawn one animal on an orthogonal traversable terrain cell", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 1, 1, "FARM");
  setLegacyTileAt(mapDefinition, 0, 1, "BUILDING");
  setLegacyTileAt(mapDefinition, 1, 0, "BANK");
  setLegacyTileAt(mapDefinition, 1, 2, "THIEF_SPAWN");

  const session = createGameSession(mapDefinition);
  const result = spawnAnimalsNearFarms(session, {
    rng: createSequenceRng([0, 0]),
    animalEmojis: ["🐮"],
  });

  assert.equal(result.animalChanged, true);
  assert.equal(session.animalUnits.length, 1);
  assert.deepStrictEqual(
    {
      r: session.animalUnits[0].r,
      c: session.animalUnits[0].c,
      emoji: session.animalUnits[0].emoji,
      farmKey: session.animalUnits[0].farmKey,
    },
    {
      r: 2,
      c: 1,
      emoji: "🐮",
      farmKey: "1,1",
    },
  );
});

test("a farm does not spawn more than the configured number of animals", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 1, 1, "FARM");
  const session = createGameSession(mapDefinition);
  const farmKey = getFarmKey({ r: 1, c: 1 });
  session.animalUnits.push(
    { id: "A1", r: 2, c: 1, emoji: "🐷", farmKey },
    { id: "A2", r: 2, c: 2, emoji: "🐮", farmKey },
    { id: "A3", r: 2, c: 3, emoji: "🐷", farmKey },
  );

  const result = spawnAnimalsNearFarms(session, {
    rng: createSequenceRng([0, 0]),
    config: { FARM_MAX_ANIMALS: 3 },
  });

  assert.equal(result.animalChanged, false);
  assert.equal(getAnimalCountForFarm(session, { r: 1, c: 1 }), 3);
  assert.equal(session.animalUnits.length, 3);
});

test("animals move a random number of steps up to the configured maximum", () => {
  const session = createGameSession(createEmptyMapDefinition());
  session.animalUnits.push({ id: "A1", r: 1, c: 1, emoji: "🐷", farmKey: "farm" });

  const result = moveAnimals(session, {
    config: { ANIMAL_MAX_MOVE_STEPS: 2 },
    rng: createSequenceRng([0.99, 0.3, 0.3]),
  });

  assert.equal(result.animalChanged, true);
  assert.deepStrictEqual(
    { r: session.animalUnits[0].r, c: session.animalUnits[0].c },
    { r: 1, c: 3 },
  );
});

test("animals cannot occupy special cells, units, parked cars, or other animals", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "ROAD");
  setLegacyTileAt(mapDefinition, 0, 1, "FARM");
  setLegacyTileAt(mapDefinition, 0, 2, "BANK");
  setLegacyTileAt(mapDefinition, 0, 3, "POLICE_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 4, "PARKING");
  setLegacyTileAt(mapDefinition, 1, 0, "THIEF_SPAWN");

  const session = createGameSession(mapDefinition);
  session.animalUnits.push({ id: "A1", r: 1, c: 1, emoji: "🐷", farmKey: "farm" });

  assert.equal(canAnimalOccupyCell(session, 0, 0), true);
  assert.equal(canAnimalOccupyCell(session, 0, 1), false);
  assert.equal(canAnimalOccupyCell(session, 0, 2), false);
  assert.equal(canAnimalOccupyCell(session, 0, 3), false);
  assert.equal(canAnimalOccupyCell(session, 0, 4), false);
  assert.equal(canAnimalOccupyCell(session, 1, 0), false);
  assert.equal(canAnimalOccupyCell(session, 1, 1), false);
});
