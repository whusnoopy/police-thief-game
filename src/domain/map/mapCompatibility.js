import { isRampTileType } from "./bridgeTopology.js";

export const MAP_RULESETS = Object.freeze({ LEGACY: "legacy", RAMPS: "ramps" });
const UPGRADE_STATUSES = new Set(["pending", "editing", "ready"]);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function normalizeMapCompatibility(mapDefinition) {
  const ruleset = mapDefinition.ruleset ?? MAP_RULESETS.LEGACY;
  if (!Object.values(MAP_RULESETS).includes(ruleset)) throw new Error("Unsupported map ruleset");
  if (mapDefinition.upgrade === undefined) return { ruleset };
  const { upgrade } = mapDefinition;
  if (ruleset !== MAP_RULESETS.RAMPS || !isObject(upgrade) || !UPGRADE_STATUSES.has(upgrade.status) ||
      !isObject(upgrade.source) || typeof upgrade.source.encodedMap !== "string" || !upgrade.source.encodedMap ||
      (upgrade.source.mapId !== undefined && typeof upgrade.source.mapId !== "string") ||
      (upgrade.source.name !== undefined && typeof upgrade.source.name !== "string")) {
    throw new Error("Invalid map upgrade data");
  }
  return {
    ruleset,
    upgrade: {
      status: upgrade.status,
      source: {
        encodedMap: upgrade.source.encodedMap,
        ...(upgrade.source.mapId !== undefined ? { mapId: upgrade.source.mapId } : {}),
        ...(upgrade.source.name !== undefined ? { name: upgrade.source.name } : {}),
      },
    },
  };
}

// 5.0.1 supplies the data contract. Gameplay activation belongs to 5.0.2, after
// both reachability and start-of-game validation use the shared edge checks.
export function getMapGameplayBlocker(mapDefinition) {
  if (mapDefinition.ruleset === MAP_RULESETS.RAMPS || mapDefinition.terrain?.some((row) => row.some(isRampTileType))) {
    return "上下桥地图尚在测试，当前版本暂时只能查看和编辑，请保留地图等待后续版本开放游玩。";
  }
  return null;
}
