import { decodeMapDefinition } from "./mapCodec.js";
import mapCodes from "./builtInMapCodes.json" with { type: "json" };

export const BUILT_IN_MAPS = Object.entries(mapCodes).map(([id, code]) => ({
  id,
  createMap: () => decodeMapDefinition(code),
}));

export function createBuiltInMap(id) {
  return BUILT_IN_MAPS.find((map) => map.id === id)?.createMap() ?? null;
}
