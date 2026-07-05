import { ANIMAL_EMOJIS, GRID_SIZE, NPC_CONFIG } from "../../config/constants.js";
import { getUnitAt, hasParkedCar } from "../game/sessionSelectors.js";
import { getFeaturePositionsByKind } from "../map/mapQueries.js";
import { getCellRuleAt } from "./cellRules.js";

const ORTHOGONAL_DIRECTIONS = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];

function getCoordKey(r, c) {
  return `${r},${c}`;
}

function isWithinBounds(r, c) {
  return r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;
}

function getRandomIndex(length, rng) {
  if (length <= 0) return -1;
  return Math.min(length - 1, Math.floor(rng() * length));
}

function pickRandom(items, rng) {
  return items[getRandomIndex(items.length, rng)] || null;
}

function getConfigValue(config, key) {
  return Number.isFinite(config?.[key]) ? config[key] : NPC_CONFIG[key];
}

export function getFarmKey(position) {
  return getCoordKey(position.r, position.c);
}

function hasAnimalAt(session, r, c, ignoredAnimalId = null) {
  return (session?.animalUnits || []).some(
    (animal) => animal.id !== ignoredAnimalId && animal.r === r && animal.c === c,
  );
}

function getNextAnimalId(session) {
  session.nextAnimalId ||= 1;

  while ((session.animalUnits || []).some((animal) => animal.id === `A${session.nextAnimalId}`)) {
    session.nextAnimalId += 1;
  }

  const id = `A${session.nextAnimalId}`;
  session.nextAnimalId += 1;
  return id;
}

export function isAnimalTraversableCell(mapDefinition, r, c) {
  if (!isWithinBounds(r, c)) return false;

  const cellRule = getCellRuleAt(mapDefinition, r, c);
  return (
    cellRule.category === "TERRAIN" &&
    cellRule.walkableRoles.includes("POLICE") &&
    cellRule.walkableRoles.includes("THIEF")
  );
}

export function canAnimalOccupyCell(session, r, c, options = {}) {
  const ignoredAnimalId = options.ignoredAnimalId || null;

  return (
    isAnimalTraversableCell(session?.mapDefinition, r, c) &&
    !getUnitAt(session, r, c) &&
    !hasParkedCar(session, r, c) &&
    !hasAnimalAt(session, r, c, ignoredAnimalId)
  );
}

export function getFarmSpawnCandidates(session, farmPosition) {
  return ORTHOGONAL_DIRECTIONS
    .map(([dr, dc]) => ({
      r: farmPosition.r + dr,
      c: farmPosition.c + dc,
    }))
    .filter((position) => canAnimalOccupyCell(session, position.r, position.c));
}

export function getAnimalCountForFarm(session, farmPosition) {
  const farmKey = getFarmKey(farmPosition);
  return (session?.animalUnits || []).filter((animal) => animal.farmKey === farmKey).length;
}

export function spawnAnimalsNearFarms(session, options = {}) {
  const rng = options.rng || Math.random;
  const config = options.config || NPC_CONFIG;
  const animalEmojis = options.animalEmojis || ANIMAL_EMOJIS;
  const maxAnimalsPerFarm = getConfigValue(config, "FARM_MAX_ANIMALS");
  const spawnedAnimals = [];

  getFeaturePositionsByKind(session?.mapDefinition, "FARM").forEach((farmPosition) => {
    if (getAnimalCountForFarm(session, farmPosition) >= maxAnimalsPerFarm) return;

    const spawnCandidates = getFarmSpawnCandidates(session, farmPosition);
    const spawnPosition = pickRandom(spawnCandidates, rng);
    if (!spawnPosition) return;

    const animal = {
      id: getNextAnimalId(session),
      r: spawnPosition.r,
      c: spawnPosition.c,
      emoji: pickRandom(animalEmojis, rng) || ANIMAL_EMOJIS[0],
      farmKey: getFarmKey(farmPosition),
    };

    session.animalUnits.push(animal);
    spawnedAnimals.push(animal);
  });

  return {
    animalChanged: spawnedAnimals.length > 0,
    spawnedAnimals,
  };
}

function getRandomMoveStepCount(maxMoveSteps, rng) {
  if (maxMoveSteps <= 0) return 0;
  return getRandomIndex(maxMoveSteps, rng) + 1;
}

function getAnimalMoveCandidates(session, animal) {
  return ORTHOGONAL_DIRECTIONS
    .map(([dr, dc]) => ({
      r: animal.r + dr,
      c: animal.c + dc,
    }))
    .filter((position) => (
      canAnimalOccupyCell(session, position.r, position.c, {
        ignoredAnimalId: animal.id,
      })
    ));
}

export function moveAnimals(session, options = {}) {
  const rng = options.rng || Math.random;
  const config = options.config || NPC_CONFIG;
  const maxMoveSteps = getConfigValue(config, "ANIMAL_MAX_MOVE_STEPS");
  const movedAnimals = [];

  (session?.animalUnits || []).forEach((animal) => {
    const startPosition = { r: animal.r, c: animal.c };
    const stepCount = getRandomMoveStepCount(maxMoveSteps, rng);

    for (let step = 0; step < stepCount; step += 1) {
      const moveCandidates = getAnimalMoveCandidates(session, animal);
      const nextPosition = pickRandom(moveCandidates, rng);
      if (!nextPosition) break;

      animal.r = nextPosition.r;
      animal.c = nextPosition.c;
    }

    if (animal.r !== startPosition.r || animal.c !== startPosition.c) {
      movedAnimals.push(animal);
    }
  });

  return {
    animalChanged: movedAnimals.length > 0,
    movedAnimals,
  };
}

export function resolveAnimalTurn(session, options = {}) {
  const moveResult = moveAnimals(session, options);
  const spawnResult = spawnAnimalsNearFarms(session, options);

  return {
    animalChanged: moveResult.animalChanged || spawnResult.animalChanged,
    movedAnimals: moveResult.movedAnimals,
    spawnedAnimals: spawnResult.spawnedAnimals,
  };
}
