import { canTakeCrosswalkStep, getSignalPhases } from "../map/crosswalk.js";
import { getFeaturePositionsByKind, getTerrainAt } from "../map/mapQueries.js";
import { getCellRuleAt } from "./cellRules.js";
import { getMapGameplayBlocker, usesRampRules, usesContinuousActions } from "../map/mapCompatibility.js";
import { areCellsConnected, getRampConnectionIssues } from "../map/bridgeTopology.js";

import { isWithinMap } from "../map/mapDimensions.js";

const DIRECTIONS = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const coordKey = ({ r, c }) => `${r},${c}`;
const positionLabel = ({ r, c }) => `第 ${r + 1} 行第 ${c + 1} 列`;

// This is an optimistic, multi-turn connectivity check, not a strategy solver.
// Ignore movable occupants and allow parking lots to be occupied or empty, since
// other players can take/return their cars. Only reject routes impossible even
// with those favorable conditions. Money and travel mode remain separate states.
export function getPotentialRoutes(mapDefinition, start, role, carTransferPositions = new Set()) {
  const queue = isWithinMap(mapDefinition, start.r, start.c) ? [{ ...start, inCar: false, hasMoney: false }] : [];
  const seen = new Set();
  const positions = new Set();
  const drivingPositions = new Set();
  let canGetMoney = false;
  let canEscape = false;
  let canDeliver = false;
  const manholes = getFeaturePositionsByKind(mapDefinition, "MANHOLE");
  const signalPhases = getSignalPhases(mapDefinition);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const key = `${coordKey(current)}|${current.inCar}|${current.hasMoney}`;
    if (seen.has(key)) continue;
    seen.add(key);
    positions.add(coordKey(current));
    if (current.inCar) drivingPositions.add(coordKey(current));
    // A walking officer can take over a thief's car when capturing them.
    if (!current.inCar && carTransferPositions.has(coordKey(current))) {
      queue.push({ ...current, inCar: true });
    }
    const fromRule = getCellRuleAt(mapDefinition, current.r, current.c);
    canGetMoney ||= current.hasMoney;
    if (role === "THIEF" && fromRule.tileType === "THIEF_BASE") {
      canEscape ||= current.hasMoney;
      continue;
    }
    canDeliver ||= role === "POLICE" && fromRule.tileType === "POLICE_STATION";
    const destinations = DIRECTIONS.map(([dr, dc]) => ({ r: current.r + dr, c: current.c + dc }));
    if (role === "THIEF" && !current.inCar && fromRule.tileType === "MANHOLE") {
      destinations.push(...manholes.map((position) => ({ ...position, teleport: true })));
    }
    for (const next of destinations) {
      if (!isWithinMap(mapDefinition, next.r, next.c)) continue;
      if (!next.teleport && usesRampRules(mapDefinition) && !areCellsConnected(mapDefinition, current, next)) continue;
      const rule = getCellRuleAt(mapDefinition, next.r, next.c);
      if (!(current.inCar ? rule.drivableRoles : rule.walkableRoles).includes(role)) continue;
      if (!next.teleport && !signalPhases.some((signalPhase) => canTakeCrosswalkStep({
        fromTileType: fromRule.tileType, toTileType: rule.tileType, isDriving: current.inCar,
        signalPhase, dr: next.r - current.r, dc: next.c - current.c, fromStartingCell: true,
      }))) continue;
      const hasMoney = current.hasMoney || (role === "THIEF" && rule.tileType === "BANK");
      if (rule.tileType === "THIEF_BASE" && !hasMoney) continue;
      const modes = rule.tileType === "PARKING"
        ? [false, true]
        : rule.tileType === "POLICE_STATION" ? (usesContinuousActions(mapDefinition) ? [false, current.inCar] : [false]) : [current.inCar];
      modes.forEach((inCar) => queue.push({ r: next.r, c: next.c, inCar, hasMoney }));
    }
  }
  return { positions, drivingPositions, canGetMoney, canEscape, canDeliver };
}

export function validateMapDefinition(mapDefinition, options = {}) {
  const blocker = getMapGameplayBlocker(mapDefinition, options);
  if (blocker) return { valid: false, errors: [blocker] };
  const errors = [];
  const placements = [...(mapDefinition.features || []).map(f => f.position), ...(mapDefinition.spawns?.police || []), ...(mapDefinition.spawns?.thief || [])];
  if (placements.some(p => !isWithinMap(mapDefinition, p.r, p.c))) return { valid: false, errors: ["设施和出生点必须放在地图内，不能位于削角区域。"] };
  if (placements.some(({ r, c }) => getTerrainAt(mapDefinition, r, c) === "RIVER")) {
    return { valid: false, errors: ["设施和出生点必须放在陆地上，请移开水面上的设施或出生点。"] };
  }
  if (usesRampRules(mapDefinition)) {
    getRampConnectionIssues(mapDefinition).forEach(({ r, c, reason }) => {
      errors.push(`上下桥格（${positionLabel({ r, c })}）${reason === "RAMP_HIGH_END" ? "高端必须连接普通高架" : "低端必须连接可驾车的陆上地块"}，请检查方向与相邻地块。`);
    });
  }
  const police = mapDefinition.spawns.police;
  const thieves = mapDefinition.spawns.thief;
  const banks = getFeaturePositionsByKind(mapDefinition, "BANK");
  const bases = getFeaturePositionsByKind(mapDefinition, "THIEF_BASE");
  if (!police.length || !thieves.length) errors.push("必须至少放置一个警察出生点和一个小偷出生点！");
  if (!banks.length || !bases.length) errors.push("必须至少放置一个小偷基地和一个银行！");
  if (errors.length) return { valid: false, errors };

  const thiefRoutes = thieves.map((start) => getPotentialRoutes(mapDefinition, start, "THIEF"));
  const carTransferPositions = new Set(thiefRoutes.flatMap((route) => [...route.drivingPositions]));
  const policeRoutes = police.map((start) => getPotentialRoutes(mapDefinition, start, "POLICE", carTransferPositions));
  const overlaps = (a, b) => [...a.positions].some((key) => b.positions.has(key));
  [[police, policeRoutes, "警察"], [thieves, thiefRoutes, "小偷"]].forEach(([spawns, routes, label]) => {
    routes.forEach((route, index) => {
      if (route.positions.size < 2) errors.push(`${label}出生点（${positionLabel(spawns[index])}）没有可通行出口。`);
    });
  });
  thiefRoutes.forEach((route, index) => {
    const label = `小偷出生点（${positionLabel(thieves[index])}）`;
    if (!route.canGetMoney) errors.push(`${label}无法到达银行，请连接道路、停车场或井盖。`);
    else if (!route.canEscape) errors.push(`${label}取钱后无法到达小偷基地，请检查返程路线。`);
    if (!policeRoutes.some((policeRoute) => overlaps(route, policeRoute))) {
      errors.push(`${label}所在区域与所有警察隔绝，警察无法进行抓捕。`);
    }
  });
  if (thieves.length > police.length && !policeRoutes.some((route) => route.canDeliver)) {
    errors.push("小偷人数多于警察，必须设置至少一名警察可到达的警察局，才能押送后继续抓捕。");
  }
  // Officers who cannot reach a station have capacity for only one capture.
  // Match those officers to thieves; officers with a station can be reused.
  if (!errors.length) {
    const assignments = new Map();
    function assignThief(thiefIndex, visited = new Set()) {
      for (let policeIndex = 0; policeIndex < policeRoutes.length; policeIndex += 1) {
        const route = policeRoutes[policeIndex];
        if (visited.has(policeIndex) || !overlaps(route, thiefRoutes[thiefIndex])) continue;
        visited.add(policeIndex);
        if (route.canDeliver) return true;
        if (!assignments.has(policeIndex) || assignThief(assignments.get(policeIndex), visited)) {
          assignments.set(policeIndex, thiefIndex);
          return true;
        }
      }
      return false;
    }
    if (!thiefRoutes.every((_, index) => assignThief(index))) {
      errors.push("现有警察无法完成所有抓捕：请增加能到达小偷区域的警察，或连接可供重复押送的警察局。");
    }
  }
  return { valid: errors.length === 0, errors };
}
