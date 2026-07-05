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
  if (candidate.isDriving !== existing.isDriving) return candidate.isDriving;
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

function getActionType({ turn, unit, occupant, tileType, hasMoney }) {
  if (turn === "POLICE" && occupant && occupant.role === "THIEF" && unit.state === "IDLE") {
    return "CAPTURE";
  }
  if (turn === "POLICE" && unit.state === "CARRYING" && tileType === "POLICE_STATION") {
    return "DELIVER";
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
  return action.type === "CAPTURE" || action.type === "DELIVER" || action.type === "ESCAPE";
}

function recordReachableAction(results, action) {
  const key = getCoordKey(action.r, action.c);
  if (chooseBetterAction(results.get(key), action)) {
    results.set(key, action);
  }
}

function canDisembarkAt(session, node, role) {
  if (!node.isDriving || node.droppedCarAt) return false;

  const cellRule = getCellRuleAt(session.mapDefinition, node.r, node.c);
  return canEnterCell(cellRule, role, false) && cellRule.walkCost !== null;
}

function createDisembarkNode(node) {
  const droppedCarAt = getCoordKey(node.r, node.c);
  return {
    ...node,
    movementKind: "DISEMBARK",
    isDriving: false,
    droppedCarAt,
    trail: [
      ...node.trail,
      {
        r: node.r,
        c: node.c,
        cost: 0,
        movementKind: "DISEMBARK",
      },
    ],
  };
}

function getSearchStateKey(node) {
  return [
    node.r,
    node.c,
    node.isDriving ? "D" : "W",
    node.hasMoney ? "M" : "N",
    node.boardedCarAt || "",
    node.droppedCarAt || "",
  ].join("|");
}

export function calculateReachableActions({ session, turn, diceValue, unit }) {
  const results = new Map();
  const bestCostByState = new Map();
  const isThief = turn === "THIEF";
  const role = isThief ? "THIEF" : "POLICE";
  const queue = [
    {
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
    },
  ];

  while (queue.length > 0) {
    queue.sort((a, b) => a.costSpent - b.costSpent);
    const current = queue.shift();
    const stateKey = getSearchStateKey(current);
    const bestKnownCost = bestCostByState.get(stateKey);
    if (bestKnownCost !== undefined && bestKnownCost <= current.costSpent) {
      continue;
    }
    bestCostByState.set(stateKey, current.costSpent);

    if (current.trail.length > 0) {
      recordReachableAction(results, current);
    }

    if (current.pointsLeft === 0 || isTerminalAction(current)) {
      continue;
    }

    if (canDisembarkAt(session, current, role)) {
      queue.push(createDisembarkNode(current));
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
      let boardedCarAt = current.boardedCarAt;
      if (
        !nextDriving &&
        !move.isTeleport &&
        destinationHasAvailableCar &&
        canEnterCell(cellRule, role, true) &&
        cellRule.driveCost !== null
      ) {
        nextDriving = true;
        boardedCarAt = boardedCarAt || getCoordKey(nr, nc);
      }

      const nextNode = {
        type: getActionType({ turn, unit, occupant, tileType, hasMoney: nextHasMoney }),
        movementKind: move.isTeleport ? "TELEPORT" : nextDriving && !current.isDriving ? "BOARD" : "STEP",
        from: { r: unit.r, c: unit.c },
        to: { r: nr, c: nc },
        r: nr,
        c: nc,
        pointsLeft: pointsLeftAfterMove,
        path: [...current.path, { r: nr, c: nc }],
        trail: [...current.trail, { r: nr, c: nc, cost }],
        costSpent: current.costSpent + cost,
        isDriving: nextDriving,
        hasMoney: nextHasMoney,
        boardedCarAt,
        droppedCarAt: current.droppedCarAt,
        landingTileType: tileType,
      };

      queue.push(nextNode);
    }
  }

  return results;
}
