import { calculateReachableActions } from "../domain/rules/moveGenerator.js";

self.onmessage = ({ data: { session, turn, diceValue, movementPoints, units } }) => {
  const results = new Map(units.map((unit) => [
    unit.id,
    calculateReachableActions({ session, turn, diceValue, movementPoints, unit }),
  ]));
  self.postMessage(results);
};
