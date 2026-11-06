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

  // New bridge semantics must be saved as a copy of an old-format record.
  // Subsequent saves of that v4 copy can update it normally.
  if (encodedMap.startsWith("v4.") && currentMap && !currentMap.encodedMap.startsWith("v4.")) currentMap = null;
  const schemaVersion = encodedMap.startsWith("v4.") ? 4 : 3;

  if (!currentMap) {
    const baseId = createId();
    let nextId = baseId;
    for (let suffix = 2; maps.some((record) => record.id === nextId); suffix += 1) nextId = `${baseId}_${suffix}`;
    currentMap = {
      id: nextId,
      name: name?.trim() ? name.trim() : formatDefaultMapName(new Date(now)),
      encodedMap,
      updatedAt: now,
      schemaVersion,
    };
    currentMapId = currentMap.id;
  } else {
    currentMap = {
      ...currentMap,
      encodedMap,
      updatedAt: now,
      schemaVersion,
      name: name?.trim() ? name.trim() : currentMap.name,
    };
  }

  return {
    currentMapId,
    currentMap,
    maps: [currentMap, ...maps.filter((mapItem) => mapItem.id !== currentMapId)],
  };
}
