import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { calculateReachableActions } from "../src/domain/rules/moveGenerator.js";
import { describeAction } from "../src/features/actionSummary.js";

function makeSession(tiles) {
  const map = createEmptyMapDefinition();
  tiles.forEach(([r, c, tile]) => setLegacyTileAt(map, r, c, tile));
  return createGameSession(map);
}

function preview(session, turn, unit, key, diceValue = 6) {
  const before = structuredClone(session);
  const action = calculateReachableActions({ session, turn, unit, diceValue }).get(key);
  assert.ok(action, `Missing destination ${key}`);
  const message = describeAction({ session, turn, unit, action, diceValue });
  assert.deepEqual(session, before, "preview must not mutate units, money or vehicles");
  return message;
}

test("bank and base preview explains money then escape and unused steps", () => {
  const session = makeSession([[0, 0, "THIEF_SPAWN"], [0, 1, "BANK"], [0, 2, "THIEF_BASE"]]);
  assert.match(preview(session, "THIEF", session.thiefUnits[0], "0,2", 3), /拿到钱.*成功逃脱.*剩余 1 步作废/);
});

test("vehicle previews explain boarding, parking, return location and waiting off board", () => {
  const session = makeSession([[0, 0, "THIEF_SPAWN"], [0, 1, "PARKING"], [0, 2, "THIEF_BASE"]]);
  const thief = session.thiefUnits[0];
  assert.match(preview(session, "THIEF", thief, "0,1"), /自动上车.*本次行动结束/);
  session.parkingCars.clear(); session.parkedCars.clear();
  thief.inCar = true; thief.hasMoney = true;
  assert.match(preview(session, "THIEF", thief, "0,1"), /自动下车.*车辆停放在第 1 行 2 列/);
  assert.match(preview(session, "THIEF", thief, "0,2"), /成功逃脱.*车辆停放在第 1 行 2 列/);
  const blocked = makeSession([[0, 0, "THIEF_SPAWN"], [0, 2, "THIEF_BASE"]]);
  blocked.thiefUnits[0].inCar = true; blocked.thiefUnits[0].hasMoney = true;
  assert.match(preview(blocked, "THIEF", blocked.thiefUnits[0], "0,2"), /场外等候回库/);
});

test("capture identifies the thief and extra car, delivery identifies the jailed thief", () => {
  const session = makeSession([[0, 0, "POLICE_SPAWN"], [0, 1, "THIEF_SPAWN"], [0, 2, "POLICE_STATION"]]);
  const police = session.policeUnits[0];
  const thief = session.thiefUnits[0];
  police.inCar = true; thief.inCar = true;
  assert.match(preview(session, "POLICE", police, "0,1"), /抓住小偷 1.*接管小偷的车.*车辆停放在第 1 行 1 列/);
  police.state = "CARRYING";
  thief.state = "CARRIED"; thief.carrierId = police.id; thief.inCar = false;
  assert.match(preview(session, "POLICE", police, "0,2"), /小偷 1 已送入警局，可继续抓捕/);
});
