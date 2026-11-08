import { usesContinuousActions } from "../map/mapCompatibility.js";
import { getCellRuleAt } from "./cellRules.js";
import { hasAvailableCar, hasParkedCar } from "../game/sessionSelectors.js";

const OPERATION_COST = 4;
export const OPERATION_LABELS = Object.freeze({ BOARD: "上车", PARK: "下车", STEAL: "取钱", DELIVER: "交付小偷" });

// These are separate, stationary actions. Merely arriving never pays an operation
// or changes mode/money in continuous-action games.
export function getUnitOperations({ session, turn, unit, movementPoints = 0 }) {
  if (!session || !unit || !usesContinuousActions(session.mapDefinition) ||
      !Number.isSafeInteger(movementPoints) || movementPoints < 0 ||
      (turn === "THIEF" ? unit.state !== "ACTIVE" : !session.policeUnits.includes(unit))) return [];
  const rule = getCellRuleAt(session.mapDefinition, unit.r, unit.c), key = `${unit.r},${unit.c}`;
  const candidates = [];
  if (!unit.inCar && hasAvailableCar(session, unit.r, unit.c) && rule.drivableRoles.includes(turn)) candidates.push({ type: "BOARD", isDriving: true, carPickups: [key] });
  if (unit.inCar && rule.tileType === "PARKING" && !hasParkedCar(session, unit.r, unit.c)) candidates.push({ type: "PARK", isDriving: false, carDrops: [key] });
  if (unit.inCar && turn === "POLICE" && rule.tileType === "POLICE_STATION") candidates.push({ type: "PARK", isDriving: true, returnsVehicleToParking: true });
  if (turn === "THIEF" && !unit.hasMoney && rule.tileType === "BANK") candidates.push({ type: "STEAL", hasMoney: true });
  if (turn === "POLICE" && unit.state === "CARRYING" && rule.tileType === "POLICE_STATION") candidates.push({ type: "DELIVER", reason: unit.inCar ? "请先下车（1 点），再交付（1 点）" : "" });
  return candidates.map(candidate => {
    const reason = candidate.reason || (movementPoints < OPERATION_COST ? "剩余行动点不足 1 点" : "");
    return { r: unit.r, c: unit.c, from: { r: unit.r, c: unit.c }, to: { r: unit.r, c: unit.c },
      path: [{ r: unit.r, c: unit.c }], trail: [], costSpent: OPERATION_COST,
      pointsLeft: Math.max(0, movementPoints - OPERATION_COST), isDriving: !!unit.inCar,
      hasMoney: !!unit.hasMoney, carPickups: [], carDrops: [], ...candidate,
      stationary: true, enabled: !reason, reason, label: OPERATION_LABELS[candidate.type] };
  });
}
