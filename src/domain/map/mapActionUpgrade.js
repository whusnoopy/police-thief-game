import { decodeMapDefinition } from "./mapCodec.js";
import { cloneMapDefinition } from "./mapModel.js";
import { usesContinuousActions } from "./mapCompatibility.js";

export function createActionUpgradeCopy({ encodedMap, mapId, name }) {
  const original = decodeMapDefinition(encodedMap);
  if (usesContinuousActions(original)) throw new Error("Map already uses continuous actions");
  const map = cloneMapDefinition(original);
  map.actionRules = "continuous";
  map.actionUpgrade = { source: { encodedMap,
    ...(mapId !== undefined ? { mapId } : {}), ...(name !== undefined ? { name } : {}) } };
  return map;
}
