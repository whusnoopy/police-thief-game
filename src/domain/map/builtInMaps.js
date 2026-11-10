import { createExampleMap, EXAMPLE_MAP_ID } from "./exampleMap.js";
import { decodeMapDefinition } from "./mapCodec.js";
import mapCodes from "./builtInMapCodes.json" with { type: "json" };

export const BUILT_IN_MAPS = [
  { id: EXAMPLE_MAP_ID, createMap: createExampleMap },
  ...Object.entries(mapCodes).map(([id, code]) => ({
    id,
    createMap: () => decodeMapDefinition(code),
  })),
];

export function createBuiltInMap(id) {
  return BUILT_IN_MAPS.find((map) => map.id === id)?.createMap() ?? null;
}
