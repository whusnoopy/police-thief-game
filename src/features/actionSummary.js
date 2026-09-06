import { applyResolvedAction } from "../domain/rules/interactionResolver.js";
import { formatMovementPoints, getMovementPoints } from "../domain/rules/moveGenerator.js";

const positionLabel = ({ r, c }) => `第 ${r + 1} 行 ${c + 1} 列`;
const unitLabel = (id) => `${id.startsWith("P") ? "警察" : "小偷"} ${id.slice(1)}`;

// Resolve on a copy so previews describe the same rules as the eventual move,
// including automatic vehicle placement, without changing the live game.
export function describeAction({ session, turn, unit, action, diceValue }) {
  const after = structuredClone(session);
  const nextUnit = [...after.policeUnits, ...after.thiefUnits].find((item) => item.id === unit.id);
  applyResolvedAction({ session: after, turn, unit: nextUnit, action });
  const messages = [`${unitLabel(unit.id)} 到达${positionLabel(action.to)}`];
  if (turn === "THIEF" && !unit.hasMoney && nextUnit.hasMoney) messages.push("经过银行拿到钱");
  if (action.trail.some((segment) => segment.movementKind === "TELEPORT")) messages.push("使用井盖传送");
  if (action.type === "BOARD") messages.push("自动上车");
  if (action.type === "PARK") messages.push("在停车场自动下车");
  if (action.type === "ESCAPE") messages.push("带钱回到基地，成功逃脱");
  if (action.type === "CAPTURE") {
    const caught = after.thiefUnits.find((thief) => thief.carrierId === unit.id);
    if (caught) {
      messages.push(`抓住${unitLabel(caught.id)}，开始押送`);
      if (session.thiefUnits.find((thief) => thief.id === caught.id)?.inCar) messages.push("接管小偷的车");
    }
  }
  if (action.type === "DELIVER") {
    const carried = session.thiefUnits.find((thief) => thief.carrierId === unit.id);
    messages.push(`${carried ? unitLabel(carried.id) : "小偷"} 已送入警局，可继续抓捕`);
  }
  if (action.type === "ENTER_STATION") messages.push("进入警局并下车");
  for (const key of after.parkedCars) {
    if (session.parkedCars.has(key)) continue;
    const [r, c] = key.split(",").map(Number);
    messages.push(`车辆停放在${positionLabel({ r, c })}`);
  }
  if (after.pendingCars.length > session.pendingCars.length) messages.push("暂无空停车位，车辆在场外等候回库");
  const unused = Math.max(0, getMovementPoints(diceValue) - action.costSpent);
  messages.push(`消耗 ${formatMovementPoints(action.costSpent)} 步，本次行动结束${unused ? `，剩余 ${formatMovementPoints(unused)} 步作废` : ""}`);
  return `${messages.join("；")}。`;
}
