import { decodeMapDefinition, encodeMapDefinition, normalizeEncodedMap } from "../domain/map/mapCodec.js";
import { createNewMapDefinition } from "../domain/map/mapModel.js";
import { createBuiltInMap } from "../domain/map/builtInMaps.js";

function tryDecodeMapDefinition(encodedMap) {
  if (!encodedMap) return null;

  try {
    return decodeMapDefinition(encodedMap);
  } catch (error) {
    return null;
  }
}

export function resolveInitialMapLoad({ savedEncodedMap = null, sharedEncodedMap = null, exampleId = null } = {}) {
  const example = sharedEncodedMap ? null : createBuiltInMap(exampleId);
  const sharedMapDefinition = example ?? tryDecodeMapDefinition(sharedEncodedMap);
  const savedMapDefinition = tryDecodeMapDefinition(savedEncodedMap);
  if (sharedMapDefinition) {
    return {
      source: example ? "example" : "url",
      mapDefinition: sharedMapDefinition,
      forceNewMap: Boolean(
        savedEncodedMap &&
          (!savedMapDefinition || normalizeEncodedMap(savedEncodedMap) !== encodeMapDefinition(sharedMapDefinition)),
      ),
    };
  }

  if (savedMapDefinition) {
    return {
      source: "storage",
      mapDefinition: savedMapDefinition,
      forceNewMap: false,
    };
  }

  return {
    source: "empty",
    mapDefinition: createNewMapDefinition(),
    forceNewMap: false,
  };
}
