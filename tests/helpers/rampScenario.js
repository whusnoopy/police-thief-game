import { BRIDGE_DIRECTIONS } from "../../src/domain/map/bridgeTopology.js";
import { createRampMapDefinition, setLegacyTileAt } from "../../src/domain/map/mapModel.js";

export function createRampScenario(direction = "E") {
  const index = BRIDGE_DIRECTIONS.findIndex((item) => item.direction === direction);
  const { dr, dc } = BRIDGE_DIRECTIONS[index];
  const center = { r: 4, c: 4 };
  const at = (distance, side = 0) => ({ r: center.r + dr * distance - dc * side, c: center.c + dc * distance + dr * side });
  const positions = { start: at(-2), up: at(-1), deck: center, down: at(1), end: at(2), police: at(-2, 1), parking: at(-2, -1), base: at(2, 1), side: at(0, 1) };
  const map = createRampMapDefinition({ terrain: Array.from({ length: 10 }, () => Array(10).fill("BUILDING")) });
  const put = (position, type) => setLegacyTileAt(map, position.r, position.c, type);
  put(positions.start, "THIEF_SPAWN");
  put(positions.up, `OVERPASS_RAMP_${direction}`);
  put(positions.deck, "OVERPASS");
  put(positions.down, `OVERPASS_RAMP_${BRIDGE_DIRECTIONS[(index + 2) % 4].direction}`);
  put(positions.end, "BANK");
  put(positions.police, "POLICE_SPAWN");
  put(positions.parking, "PARKING");
  put(positions.base, "THIEF_BASE");
  return { map, positions, put };
}
