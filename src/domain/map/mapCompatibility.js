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

export function usesRampRules(mapDefinition) {
  return mapDefinition.ruleset === MAP_RULESETS.RAMPS;
}

export function getMapGameplayBlocker(mapDefinition, { allowUpgradeDraft = false } = {}) {
  if (!usesRampRules(mapDefinition)) {
    if (mapDefinition.terrain?.some((row) => row.some(isRampTileType))) return "上下桥格需要新版规则，请先创建升级副本。";
    if (mapDefinition.terrain?.some((row) => row.includes("OVERPASS"))) {
      return "这张旧地图含高架桥，请先创建升级副本，调整上下桥入口并完成校验后再开始游戏。";
    }
  }
  if (!allowUpgradeDraft && mapDefinition.upgrade && mapDefinition.upgrade.status !== "ready") {
    return "这张地图还在升级，请调整上下桥入口，再点击“校验并完成升级”。";
  }
  return null;
}
