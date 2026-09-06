import { GRID_SIZE, SIGNAL_PHASES, normalizeSignalPhase } from "../../config/constants.js";
import {
  getAllowedCrosswalkAxis,
  isCrosswalkTileType,
  isStepAlongAxis,
} from "../map/crosswalk.js";
import { getFeaturePositionsByKind } from "../map/mapQueries.js";
import {
  getUnitAt,
  hasAnimalAt,
  hasAvailableCar,
  hasParkedCar,
} from "../game/sessionSelectors.js";
import { getCellRuleAt } from "./cellRules.js";

export const STEP_POINTS = 4;
export const HALF_STEP_POINTS = 2;
export const QUARTER_STEP_POINTS = 1;
export const DRIVE_COST_POINTS = HALF_STEP_POINTS;

// A full visited-set search can grow exponentially on large overpass areas. Keep a
// bounded Pareto frontier for each gameplay state: this preserves meaningfully
// different simple paths without allowing a 10x10 board to lock up the browser.
const MAX_STATE_PATH_VARIANTS = 64;

class MinCostQueue {
  constructor() {
    this.items = [];
  }

  get length() {
    return this.items.length;
  }

  push(value) {
    this.items.push(value);
    let index = this.items.length - 1;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.items[parentIndex].costSpent <= value.costSpent) break;
      this.items[index] = this.items[parentIndex];
      index = parentIndex;
    }
    this.items[index] = value;
  }

  shift() {
    if (this.items.length === 0) return null;
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length === 0) return first;

    let index = 0;
    while (true) {
      const leftIndex = index * 2 + 1;
      const rightIndex = leftIndex + 1;
      if (leftIndex >= this.items.length) break;
      const childIndex =
        rightIndex < this.items.length &&
        this.items[rightIndex].costSpent < this.items[leftIndex].costSpent
          ? rightIndex
          : leftIndex;
      if (this.items[childIndex].costSpent >= last.costSpent) break;
      this.items[index] = this.items[childIndex];
      index = childIndex;
    }
    this.items[index] = last;
    return first;
  }
}

function getCoordKey(r, c) {
  return `${r},${c}`;
}

function isCrosswalkMoveBlocked({ session, fromTileType, toTileType, isDriving, dr, dc }) {
  const signalPhase = normalizeSignalPhase(
    session?.signalPhase || SIGNAL_PHASES.PEDESTRIAN_GREEN,
  );
  const tileTypesToCheck = [fromTileType, toTileType].filter(isCrosswalkTileType);

  return tileTypesToCheck.some((tileType) => {
    const allowedAxis = getAllowedCrosswalkAxis(tileType, isDriving, signalPhase);
    return !allowedAxis || !isStepAlongAxis(dr, dc, allowedAxis);
  });
}

function chooseBetterAction(existing, candidate) {
  if (!existing) return true;
  if (candidate.hasMoney !== existing.hasMoney) return candidate.hasMoney;
  if (candidate.costSpent !== existing.costSpent) {
    return candidate.costSpent < existing.costSpent;
  }
  return candidate.path.length < existing.path.length;
}

function createSearchBoard(session, role, unit) {
  const cells = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
    const r = Math.floor(index / GRID_SIZE);
    const c = index % GRID_SIZE;
    return {
      r, c,
      rule: getCellRuleAt(session.mapDefinition, r, c),
      occupant: getUnitAt(session, r, c),
      animal: hasAnimalAt(session, r, c),
      availableCar: hasAvailableCar(session, r, c),
      parkedCar: hasParkedCar(session, r, c),
    };
  });
  const manholes = getFeaturePositionsByKind(session.mapDefinition, "MANHOLE");
  const directions = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  // These rules and occupants remain fixed for one search. Boarding/capture
  // ends the action, so no intermediate step changes the board's occupancy.
  return [false, true].map((isDriving) => cells.map((from) => {
    const candidates = directions.map(([dr, dc]) => ({ nr: from.r + dr, nc: from.c + dc, isTeleport: false }));
    if (role === "THIEF" && !isDriving && from.rule.tileType === "MANHOLE") {
      for (const position of manholes) {
        if (position.r !== from.r || position.c !== from.c) candidates.push({ nr: position.r, nc: position.c, isTeleport: true });
      }
    }
    return candidates.flatMap((move) => {
      const { nr, nc, isTeleport } = move;
      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) return [];
      const to = cells[nr * GRID_SIZE + nc];
      if (to.animal || !canEnterCell(to.rule, role, isDriving)) return [];
      if (to.occupant && (role === "THIEF" || to.occupant.role === "POLICE" || unit.state === "CARRYING")) return [];
      if (isDriving && !isTeleport && to.parkedCar) return [];
      if (!isTeleport && isCrosswalkMoveBlocked({
        session, fromTileType: from.rule.tileType, toTileType: to.rule.tileType,
        isDriving, dr: nr - from.r, dc: nc - from.c,
      })) return [];
      const cost = getMoveCost(isDriving, to.rule, isTeleport);
      if (cost === null) return [];
      return [{
        ...move, cost, cellRule: to.rule, occupant: to.occupant,
        availableCar: to.availableCar, bit: getVisitedBit(nr, nc),
      }];
    });
  }));
}

function getMoveCost(isDriving, cellRule, isTeleport) {
  if (isTeleport) return STEP_POINTS;
  if (isDriving) return cellRule.driveCost;
  return cellRule.walkCost;
}

function canEnterCell(cellRule, role, isDriving) {
  const allowedRoles = isDriving ? cellRule.drivableRoles : cellRule.walkableRoles;
  return Array.isArray(allowedRoles) && allowedRoles.includes(role);
}

function getActionType({ turn, unit, occupant, tileType, hasMoney, isDriving }) {
  if (turn === "POLICE" && occupant && occupant.role === "THIEF" && unit.state === "IDLE") {
    return "CAPTURE";
  }
  if (turn === "POLICE" && unit.state === "CARRYING" && tileType === "POLICE_STATION") {
    return "DELIVER";
  }
  if (turn === "POLICE" && isDriving && tileType === "POLICE_STATION") {
    return "ENTER_STATION";
  }
  if (turn === "THIEF" && tileType === "THIEF_BASE" && hasMoney) {
    return "ESCAPE";
  }
  return "MOVE";
}

export function getMovementPoints(diceValue) {
  return diceValue * STEP_POINTS;
}

export function formatMovementPoints(points) {
  const steps = points / STEP_POINTS;
  return Number.isInteger(steps) ? `${steps}` : `${Number(steps.toFixed(2))}`;
}

function isTerminalAction(action) {
  return ["BOARD", "CAPTURE", "DELIVER", "ENTER_STATION", "ESCAPE"].includes(action.type);
}

function replaceLastTrailMovementKind(trail, movementKind) {
  if (trail.length === 0) return trail;
  return trail.map((segment, index) =>
    index === trail.length - 1 ? { ...segment, movementKind } : segment,
  );
}

function createReachableAction(session, node) {
  if (
    node.type === "MOVE" &&
    node.isDriving &&
    node.landingTileType === "PARKING" &&
    !hasParkedCar(session, node.r, node.c)
  ) {
    const droppedCarAt = getCoordKey(node.r, node.c);
    return {
      ...node,
      type: "PARK",
      movementKind: "PARK",
      pointsLeft: 0,
      isDriving: false,
      droppedCarAt,
      carDrops: [droppedCarAt],
      trail: replaceLastTrailMovementKind(node.trail, "PARK"),
    };
  }

  if (isTerminalAction(node)) {
    return {
      ...node,
      pointsLeft: 0,
      returnsVehicleToParking:
        node.isDriving && ["DELIVER", "ENTER_STATION", "ESCAPE"].includes(node.type),
    };
  }

  return node;
}

function recordReachableAction(results, session, node) {
  const action = createReachableAction(session, node);
  const key = getCoordKey(action.r, action.c);
  if (chooseBetterAction(results.get(key), action)) {
    results.set(key, action);
  }
}

function getSearchStateKey(node) {
  return [
    node.r,
    node.c,
    node.isDriving ? "D" : "W",
    node.hasMoney ? "M" : "N",
    node.carPickups.join(">"),
  ].join("|");
}

function getVisitedBit(r, c) {
  return 1n << BigInt(r * GRID_SIZE + c);
}

function isVisitedSubset(subset, superset) {
  return (subset & superset) === subset;
}

function shouldExpandState(frontiers, node, needsPathVariants) {
  const stateKey = getSearchStateKey(node);
  const frontier = frontiers.get(stateKey) || [];
  if (!needsPathVariants) {
    // With money status fixed, all nonterminal edges have positive costs and
    // cannot change travel mode. A cheapest route is simple, so keeping other
    // visited sets cannot improve any destination. Equal costs prefer fewer cells.
    const best = frontier[0];
    if (best && (best.costSpent < node.costSpent ||
      (best.costSpent === node.costSpent && best.pathLength <= node.path.length))) return false;
    frontiers.set(stateKey, [{ costSpent: node.costSpent, pathLength: node.path.length }]);
    return true;
  }
  if (
    frontier.some(
      (entry) =>
        entry.costSpent <= node.costSpent &&
        isVisitedSubset(entry.visitedMask, node.visitedMask),
    )
  ) {
    return false;
  }

  const entry = {
    costSpent: node.costSpent,
    visitedMask: node.visitedMask,
  };
  const nextFrontier = frontier.filter(
    (known) =>
      !(
        entry.costSpent <= known.costSpent &&
        isVisitedSubset(entry.visitedMask, known.visitedMask)
      ),
  );
  nextFrontier.push(entry);
  nextFrontier.sort((a, b) => a.costSpent - b.costSpent);

  if (nextFrontier.length > MAX_STATE_PATH_VARIANTS) {
    nextFrontier.length = MAX_STATE_PATH_VARIANTS;
  }
  frontiers.set(stateKey, nextFrontier);
  return nextFrontier.includes(entry);
}

function finalizeReachableActions(results) {
  return new Map(
    Array.from(results, ([key, action]) => [
      key,
      (({ visitedMask: _visitedMask, ...publicAction }) => publicAction)(action),
    ]),
  );
}

export function calculateReachableActions({ session, turn, diceValue, unit }) {
  const results = new Map();
  const stateFrontiers = new Map();
  const isThief = turn === "THIEF";
  const role = isThief ? "THIEF" : "POLICE";
  const searchBoard = createSearchBoard(session, role, unit);
  const needsPathVariants = isThief && !unit.hasMoney;
  const queue = new MinCostQueue();
  queue.push({
    type: "MOVE",
    movementKind: "START",
    from: { r: unit.r, c: unit.c },
    to: { r: unit.r, c: unit.c },
    r: unit.r,
    c: unit.c,
    pointsLeft: getMovementPoints(diceValue),
    path: [{ r: unit.r, c: unit.c }],
    trail: [],
    costSpent: 0,
    isDriving: Boolean(unit.inCar),
    hasMoney: Boolean(unit.hasMoney),
    boardedCarAt: null,
    droppedCarAt: null,
    carPickups: [],
    visitedMask: getVisitedBit(unit.r, unit.c),
  });

  while (queue.length > 0) {
    const current = queue.shift();
    if (!shouldExpandState(stateFrontiers, current, needsPathVariants)) continue;

    if (current.trail.length > 0) {
      recordReachableAction(results, session, current);
    }

    if (current.pointsLeft === 0 || isTerminalAction(current)) {
      continue;
    }

    const possibleMoves = searchBoard[Number(current.isDriving)][current.r * GRID_SIZE + current.c];
    for (const move of possibleMoves) {
      const { nr, nc, cellRule, cost, occupant } = move;
      if ((current.visitedMask & move.bit) !== 0n) continue;
      const tileType = cellRule.tileType;
      if (current.pointsLeft < cost) continue;

      const nextHasMoney = Boolean(current.hasMoney || (isThief && tileType === "BANK"));
      if (isThief && tileType === "THIEF_BASE" && !nextHasMoney) continue;

      const pointsLeftAfterMove = current.pointsLeft - cost;

      let nextDriving = current.isDriving;
      let carPickups = current.carPickups;
      let boardedCar = false;
      if (
        !nextDriving &&
        !move.isTeleport &&
        move.availableCar &&
        canEnterCell(cellRule, role, true) &&
        cellRule.driveCost !== null
      ) {
        nextDriving = true;
        boardedCar = true;
        carPickups = [...carPickups, getCoordKey(nr, nc)];
      }

      const actionType = getActionType({
        turn,
        unit,
        occupant,
        tileType,
        hasMoney: nextHasMoney,
        isDriving: nextDriving,
      });
      const movementKind = move.isTeleport ? "TELEPORT" : boardedCar ? "BOARD" : "STEP";

      const nextNode = {
        type: boardedCar && actionType === "MOVE" ? "BOARD" : actionType,
        movementKind,
        from: { r: unit.r, c: unit.c },
        to: { r: nr, c: nc },
        r: nr,
        c: nc,
        pointsLeft: pointsLeftAfterMove,
        path: [...current.path, { r: nr, c: nc }],
        trail: [...current.trail, { r: nr, c: nc, cost, movementKind }],
        costSpent: current.costSpent + cost,
        isDriving: nextDriving,
        hasMoney: nextHasMoney,
        boardedCarAt: carPickups[0] || null,
        droppedCarAt: null,
        carPickups,
        carDrops: [],
        visitedMask: current.visitedMask | move.bit,
        landingTileType: tileType,
      };

      queue.push(nextNode);
    }
  }

  return finalizeReachableActions(results);
}
