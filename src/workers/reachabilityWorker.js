import { calculateReachableActions } from "../domain/rules/moveGenerator.js";

self.onmessage = ({ data: { session, turn, diceValue, units } }) => {
  const results = new Map(units.map((unit) => [
    unit.id,
    calculateReachableActions({ session, turn, diceValue, unit }),
  ]));
  self.postMessage(results);
};
