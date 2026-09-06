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
  resolveAnimalTurn,
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

test("does not spawn an animal in an isolated bank entrance", () => {
  const map = createEmptyMapDefinition({ terrain: Array.from({ length: 10 }, () => Array(10).fill("BUILDING")) });
  [[0, 0, "BANK"], [0, 1, "ROAD"], [0, 2, "THIEF_SPAWN"], [1, 1, "FARM"]]
    .forEach(([r, c, type]) => setLegacyTileAt(map, r, c, type));
  const session = createGameSession(map);
  assert.equal(spawnAnimalsNearFarms(session, { rng: () => 0 }).spawnedAnimals.length, 0);
});

test("trapped animals return after three rounds", () => {
  const map = createEmptyMapDefinition({ terrain: Array.from({ length: 10 }, () => Array(10).fill("BUILDING")) });
  setLegacyTileAt(map, 0, 0, "ROAD");
  setLegacyTileAt(map, 1, 0, "FARM");
  const session = createGameSession(map);
  session.animalUnits.push({ id: "A1", r: 0, c: 0, farmKey: "1,0" });
  resolveAnimalTurn(session);
  resolveAnimalTurn(session);
  assert.equal(session.animalUnits.length, 1);
  const result = resolveAnimalTurn(session);
  assert.equal(result.animalChanged, true);
  assert.equal(result.returnedAnimals.length, 1);
  assert.equal(session.animalUnits.length, 0);
});

test("moving animals also return after six rounds and their farm rests for a full player round", () => {
  const map = createEmptyMapDefinition();
  setLegacyTileAt(map, 1, 1, "FARM");
  const session = createGameSession(map);
  const options = { rng: () => 0.3, config: { FARM_MAX_ANIMALS: 1, ANIMAL_MAX_MOVE_STEPS: 1 } };
  resolveAnimalTurn(session, options);
  const firstId = session.animalUnits[0].id;
  for (let round = 0; round < 5; round += 1) resolveAnimalTurn(session, options);
  assert.equal(session.animalUnits[0].id, firstId);
  const result = resolveAnimalTurn(session, options);
  assert.equal(result.returnedAnimals[0].id, firstId);
  assert.equal(session.animalUnits.length, 0);
  assert.equal(result.spawnedAnimals.length, 0);
  resolveAnimalTurn(session, options);
  assert.equal(session.animalUnits.length, 1);
  assert.notEqual(session.animalUnits[0].id, firstId);
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
  setLegacyTileAt(mapDefinition, 2, 2, "MOUNTAIN");

  const session = createGameSession(mapDefinition);
  session.animalUnits.push({ id: "A1", r: 1, c: 1, emoji: "🐷", farmKey: "farm" });

  assert.equal(canAnimalOccupyCell(session, 0, 0), true);
  assert.equal(canAnimalOccupyCell(session, 0, 1), false);
  assert.equal(canAnimalOccupyCell(session, 0, 2), false);
  assert.equal(canAnimalOccupyCell(session, 0, 3), false);
  assert.equal(canAnimalOccupyCell(session, 0, 4), false);
  assert.equal(canAnimalOccupyCell(session, 1, 0), false);
  assert.equal(canAnimalOccupyCell(session, 1, 1), false);
  assert.equal(canAnimalOccupyCell(session, 2, 2), false);
});
