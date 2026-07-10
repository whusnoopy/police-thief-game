import { formatDefaultMapName, generateMapId } from "./mapStore.js";

export function upsertMapRecordInList({
  maps,
  currentMapId = "",
  encodedMap,
  forceNew = false,
  name = null,
  now = Date.now(),
  createId = generateMapId,
}) {
  let currentMap =
    !forceNew && currentMapId ? maps.find((mapItem) => mapItem.id === currentMapId) : null;

  if (!currentMap) {
    currentMap = {
      id: createId(),
      name: name?.trim() ? name.trim() : formatDefaultMapName(new Date(now)),
      encodedMap,
      updatedAt: now,
      schemaVersion: 3,
    };
    currentMapId = currentMap.id;
  } else {
    currentMap = {
      ...currentMap,
      encodedMap,
      updatedAt: now,
      schemaVersion: 3,
      name: name?.trim() ? name.trim() : currentMap.name,
    };
  }

  return {
    currentMapId,
    currentMap,
    maps: [currentMap, ...maps.filter((mapItem) => mapItem.id !== currentMapId)],
  };
}
