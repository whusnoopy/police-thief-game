import { GRID_SIZE } from "../../config/constants.js";
import { getTileTypeAt, getFeaturePositionsByKind } from "../map/mapQueries.js";
import { getUnitAt, hasAvailableCar } from "../game/sessionSelectors.js";
import { getCellRuleAt } from "./cellRules.js";

export const HALF_STEP_POINTS = 2;
export const DRIVE_COST_POINTS = 1;

function getCoordKey(r, c) {
  return `${r},${c}`;
}

function chooseBetterAction(existing, candidate) {
  if (!existing) return true;
  if (candidate.isDriving !== existing.isDriving) return candidate.isDriving;
  if (candidate.pointsLeft !== existing.pointsLeft) {
    return candidate.pointsLeft < existing.pointsLeft;
  }
  return candidate.path.length < existing.path.length;
}

function canThiefStopAtBaseWithHalfStepLeft(isThief, tileType, isDriving, pointsLeft) {
  return (
    isThief &&
    isDriving &&
    tileType === "THIEF_BASE" &&
    pointsLeft === DRIVE_COST_POINTS
  );
}

function canPoliceCaptureDrivingThiefWithHalfStepLeft(isThief, occupant, isDriving, pointsLeft) {
  return (
    !isThief &&
    isDriving &&
    occupant &&
    occupant.role === "THIEF" &&
    occupant.unit.inCar &&
    pointsLeft === DRIVE_COST_POINTS
  );
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
  if (isTeleport) return HALF_STEP_POINTS;
  if (isDriving) return cellRule.driveCost;
  return cellRule.entryCost * HALF_STEP_POINTS;
}

function getActionType({ turn, unit, occupant, tileType }) {
  if (turn === "POLICE" && occupant && occupant.role === "THIEF" && unit.state === "IDLE") {
    return "CAPTURE";
  }
  if (turn === "POLICE" && unit.state === "CARRYING" && tileType === "POLICE_STATION") {
    return "DELIVER";
  }
  if (turn === "THIEF" && tileType === "THIEF_BASE") {
    return "ESCAPE";
  }
  return "MOVE";
}

export function getMovementPoints(diceValue) {
  return diceValue * HALF_STEP_POINTS;
}

export function formatMovementPoints(points) {
  const steps = points / HALF_STEP_POINTS;
  return Number.isInteger(steps) ? `${steps}` : `${steps.toFixed(1)}`;
}

export function calculateReachableActions({ session, turn, diceValue, unit }) {
  const results = new Map();
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
      boardedCarAt: null,
    },
  ];

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.pointsLeft === 0) {
      const key = getCoordKey(current.r, current.c);
      if (chooseBetterAction(results.get(key), current)) {
        results.set(key, current);
      }
      continue;
    }

    const possibleMoves = getPossibleMoves(session, current, isThief);
    for (const move of possibleMoves) {
      const { nr, nc } = move;

      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
      if (current.path.some((point) => point.r === nr && point.c === nc)) continue;

      const cellRule = getCellRuleAt(session.mapDefinition, nr, nc);
      const tileType = cellRule.tileType;
      if (!cellRule.walkableRoles.includes(role)) continue;

      const cost = getMoveCost(current.isDriving, cellRule, move.isTeleport);
      if (cost === null || current.pointsLeft < cost) continue;

      const occupant = getUnitAt(session, nr, nc);
      const pointsLeftAfterMove = current.pointsLeft - cost;
      const canStopForHalfStepCapture = canPoliceCaptureDrivingThiefWithHalfStepLeft(
        isThief,
        occupant,
        current.isDriving,
        pointsLeftAfterMove,
      );

      if (occupant) {
        if (current.pointsLeft > cost && !canStopForHalfStepCapture) continue;
        if (isThief) continue;
        if (occupant.role === "POLICE" || unit.state === "CARRYING") continue;
      }

      let nextDriving = current.isDriving;
      let boardedCarAt = current.boardedCarAt;
      if (
        !nextDriving &&
        !move.isTeleport &&
        tileType === "PARKING" &&
        hasAvailableCar(session, nr, nc)
      ) {
        nextDriving = true;
        boardedCarAt = boardedCarAt || getCoordKey(nr, nc);
      }

      const nextNode = {
        type: getActionType({ turn, unit, occupant, tileType }),
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
        boardedCarAt,
        landingTileType: tileType,
      };

      const canStopForHalfStepBase = canThiefStopAtBaseWithHalfStepLeft(
        isThief,
        tileType,
        nextNode.isDriving,
        nextNode.pointsLeft,
      );

      if (canStopForHalfStepBase || canStopForHalfStepCapture) {
        const key = getCoordKey(nextNode.r, nextNode.c);
        if (chooseBetterAction(results.get(key), nextNode)) {
          results.set(key, nextNode);
        }
        continue;
      }

      queue.push(nextNode);
    }
  }

  return results;
}
