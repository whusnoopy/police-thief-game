import { GRID_SIZE, SIGNAL_PHASES, normalizeSignalPhase } from "../../config/constants.js";
import {
  getAllowedCrosswalkAxis,
  isCrosswalkTileType,
  isStepAlongAxis,
} from "../map/crosswalk.js";
import { getTileTypeAt, getFeaturePositionsByKind } from "../map/mapQueries.js";
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

function getNormalizedTileTypeAt(mapDefinition, r, c) {
  const cellRule = getCellRuleAt(mapDefinition, r, c);
  return cellRule.tileType;
}

function chooseBetterAction(existing, candidate) {
  if (!existing) return true;
  if (candidate.hasMoney !== existing.hasMoney) return candidate.hasMoney;
  if (candidate.costSpent !== existing.costSpent) {
    return candidate.costSpent < existing.costSpent;
  }
  return candidate.path.length < existing.path.length;
}

function getPossibleMoves(session, node, isThief) {
  const possibleMoves = [];
  const directions = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  directions.forEach(([dr, dc]) => {
    possibleMoves.push({
      nr: node.r + dr,
      nc: node.c + dc,
      isTeleport: false,
    });
  });

  if (isThief && !node.isDriving && getTileTypeAt(session.mapDefinition, node.r, node.c) === "MANHOLE") {
    getFeaturePositionsByKind(session.mapDefinition, "MANHOLE").forEach((position) => {
      if (position.r === node.r && position.c === node.c) return;
      possibleMoves.push({
        nr: position.r,
        nc: position.c,
        isTeleport: true,
      });
    });
  }

  return possibleMoves;
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

function shouldExpandState(frontiers, node) {
  const stateKey = getSearchStateKey(node);
  const frontier = frontiers.get(stateKey) || [];
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
    if (!shouldExpandState(stateFrontiers, current)) continue;

    if (current.trail.length > 0) {
      recordReachableAction(results, session, current);
    }

    if (current.pointsLeft === 0 || isTerminalAction(current)) {
      continue;
    }

    const possibleMoves = getPossibleMoves(session, current, isThief);
    for (const move of possibleMoves) {
      const { nr, nc } = move;
      const dr = nr - current.r;
      const dc = nc - current.c;

      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
      if (current.path.some((point) => point.r === nr && point.c === nc)) continue;
      if (hasAnimalAt(session, nr, nc)) continue;

      const cellRule = getCellRuleAt(session.mapDefinition, nr, nc);
      const tileType = cellRule.tileType;
      const currentTileType = getNormalizedTileTypeAt(session.mapDefinition, current.r, current.c);
      const destinationHasAvailableCar = hasAvailableCar(session, nr, nc);
      const destinationHasParkedCar = hasParkedCar(session, nr, nc);
      if (!canEnterCell(cellRule, role, current.isDriving)) continue;
      if (
        !move.isTeleport &&
        isCrosswalkMoveBlocked({
          session,
          fromTileType: currentTileType,
          toTileType: tileType,
          isDriving: current.isDriving,
          dr,
          dc,
        })
      ) {
        continue;
      }
      if (current.isDriving && !move.isTeleport && destinationHasParkedCar) continue;

      const cost = getMoveCost(current.isDriving, cellRule, move.isTeleport);
      if (cost === null || current.pointsLeft < cost) continue;

      const nextHasMoney = Boolean(current.hasMoney || (isThief && tileType === "BANK"));
      if (isThief && tileType === "THIEF_BASE" && !nextHasMoney) continue;

      const occupant = getUnitAt(session, nr, nc);
      const pointsLeftAfterMove = current.pointsLeft - cost;

      if (occupant) {
        if (isThief) continue;
        if (occupant.role === "POLICE" || unit.state === "CARRYING") continue;
      }

      let nextDriving = current.isDriving;
      let carPickups = current.carPickups;
      let boardedCar = false;
      if (
        !nextDriving &&
        !move.isTeleport &&
        destinationHasAvailableCar &&
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
        visitedMask: current.visitedMask | getVisitedBit(nr, nc),
        landingTileType: tileType,
      };

      queue.push(nextNode);
    }
  }

  return finalizeReachableActions(results);
}
