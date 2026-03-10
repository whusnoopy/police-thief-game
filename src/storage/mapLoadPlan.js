import { decodeMapDefinition, normalizeEncodedMap } from "../domain/map/mapCodec.js";
import { createEmptyMapDefinition } from "../domain/map/mapModel.js";

function tryDecodeMapDefinition(encodedMap) {
  if (!encodedMap) return null;

  try {
    return decodeMapDefinition(encodedMap);
  } catch (error) {
    return null;
  }
}

export function resolveInitialMapLoad({ savedEncodedMap = null, sharedEncodedMap = null } = {}) {
  const sharedMapDefinition = tryDecodeMapDefinition(sharedEncodedMap);
  if (sharedMapDefinition) {
    return {
      source: "url",
      mapDefinition: sharedMapDefinition,
      forceNewMap: Boolean(
        savedEncodedMap &&
          normalizeEncodedMap(savedEncodedMap) !== normalizeEncodedMap(sharedEncodedMap),
      ),
    };
  }

  const savedMapDefinition = tryDecodeMapDefinition(savedEncodedMap);
  if (savedMapDefinition) {
    return {
      source: "storage",
      mapDefinition: savedMapDefinition,
      forceNewMap: false,
    };
  }

  return {
    source: "empty",
    mapDefinition: createEmptyMapDefinition(),
    forceNewMap: false,
  };
}
