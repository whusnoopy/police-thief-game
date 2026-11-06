import { GRID_SIZE } from "../../config/constants.js";
import { decodeMapDefinition } from "./mapCodec.js";
import { cloneMapDefinition } from "./mapModel.js";
import { MAP_RULESETS } from "./mapCompatibility.js";
import { BRIDGE_DIRECTIONS } from "./bridgeTopology.js";

// Lists old ground contacts for review; inserting ramps automatically could
// overwrite facilities or remove one of a bridge tile's existing entrances.
export function getLegacyBridgeContacts(mapDefinition) {
  const contacts = [];
  for (let r = 0; r < GRID_SIZE; r += 1) for (let c = 0; c < GRID_SIZE; c += 1) {
    if (mapDefinition.terrain[r][c] !== "OVERPASS") continue;
    for (const { dr, dc, direction } of BRIDGE_DIRECTIONS) {
      const terrain = mapDefinition.terrain[r + dr]?.[c + dc];
      if (terrain && ["ROAD", "CROSSWALK", "CROSSWALK_HORIZONTAL", "CROSSWALK_VERTICAL", "RIVER"].includes(terrain)) {
        contacts.push({ bridge: { r, c }, ground: { r: r + dr, c: c + dc }, direction });
      }
    }
  }
  return contacts;
}

export function createMapUpgradeDraft({ encodedMap, mapId, name }) {
  const original = decodeMapDefinition(encodedMap);
  if (original.ruleset !== MAP_RULESETS.LEGACY) throw new Error("Map already uses ramp rules");
  const draft = cloneMapDefinition(original);
  draft.ruleset = MAP_RULESETS.RAMPS;
  draft.upgrade = {
    status: draft.terrain.some((row) => row.includes("OVERPASS")) ? "pending" : "ready",
    source: { encodedMap, ...(mapId !== undefined ? { mapId } : {}), ...(name !== undefined ? { name } : {}) },
  };
  return cloneMapDefinition(draft);
}

export function beginMapUpgrade(mapDefinition) {
  const draft = cloneMapDefinition(mapDefinition);
  if (!draft.upgrade || draft.ruleset !== MAP_RULESETS.RAMPS) throw new Error("Map is not an upgrade draft");
  draft.upgrade.status = "editing";
  return draft;
}
