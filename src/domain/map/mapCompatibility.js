import { isRampTileType } from "./bridgeTopology.js";
import { NEW_GRID_SIZE } from "../../config/constants.js";
import { getMapDimensions } from "./mapDimensions.js";

export const MAP_RULESETS = Object.freeze({ LEGACY: "legacy", RAMPS: "ramps" });
export const ACTION_RULES = Object.freeze({ SINGLE: "single", CONTINUOUS: "continuous" });
export const DIRECTIONAL_SIGNAL_RULES = "directional";
const UPGRADE_STATUSES = new Set(["pending", "editing", "ready"]);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function normalizeMapCompatibility(mapDefinition) {
  const ruleset = mapDefinition.ruleset ?? MAP_RULESETS.LEGACY;
  if (!Object.values(MAP_RULESETS).includes(ruleset)) throw new Error("Unsupported map ruleset");
  const actionRules = mapDefinition.actionRules ?? (mapDefinition.meta?.rows === 20 ? "single" : undefined);
  if (actionRules !== undefined && !Object.values(ACTION_RULES).includes(actionRules)) throw new Error("Unsupported action rules");
  const signalRules = mapDefinition.signalRules;
  if (signalRules !== undefined) {
    if (signalRules !== DIRECTIONAL_SIGNAL_RULES) throw new Error("Unsupported signal rules");
    if (!supportsDirectionalSignals(mapDefinition)) throw new Error("Directional signal rules require a 20×20 map");
  }
  const compatibility = {
    ruleset,
    ...(actionRules !== undefined ? { actionRules } : {}),
    ...(signalRules !== undefined ? { signalRules } : {}),
  };
  if (mapDefinition.actionUpgrade !== undefined) {
    const source = mapDefinition.actionUpgrade?.source;
    if (actionRules !== ACTION_RULES.CONTINUOUS || !isObject(source) || typeof source.encodedMap !== "string" || !source.encodedMap ||
        (source.mapId !== undefined && typeof source.mapId !== "string") || (source.name !== undefined && typeof source.name !== "string")) throw new Error("Invalid action upgrade source");
    compatibility.actionUpgrade = { source: { encodedMap: source.encodedMap,
      ...(source.mapId !== undefined ? { mapId: source.mapId } : {}), ...(source.name !== undefined ? { name: source.name } : {}) } };
  }
  if (mapDefinition.expansion !== undefined) {
    const e = mapDefinition.expansion;
    if (!isObject(e) || !["editing", "ready"].includes(e.status) || !isObject(e.source) ||
        typeof e.source.encodedMap !== "string" || !e.source.encodedMap ||
        (e.source.mapId !== undefined && typeof e.source.mapId !== "string") ||
        (e.source.name !== undefined && typeof e.source.name !== "string") ||
        e.offset?.r !== 5 || e.offset?.c !== 5 || mapDefinition.meta?.rows !== 20 || mapDefinition.meta?.cols !== 20) {
      throw new Error("Invalid map expansion data");
    }
    compatibility.expansion = { status: e.status, source: { encodedMap: e.source.encodedMap,
      ...(e.source.mapId !== undefined ? { mapId: e.source.mapId } : {}),
      ...(e.source.name !== undefined ? { name: e.source.name } : {}) }, offset: { r: 5, c: 5 } };
  }
  if (mapDefinition.upgrade === undefined) return compatibility;
  const { upgrade } = mapDefinition;
  if (ruleset !== MAP_RULESETS.RAMPS || !isObject(upgrade) || !UPGRADE_STATUSES.has(upgrade.status) ||
      !isObject(upgrade.source) || typeof upgrade.source.encodedMap !== "string" || !upgrade.source.encodedMap ||
      (upgrade.source.mapId !== undefined && typeof upgrade.source.mapId !== "string") ||
      (upgrade.source.name !== undefined && typeof upgrade.source.name !== "string")) {
    throw new Error("Invalid map upgrade data");
  }
  return {
    ...compatibility,
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

export function usesContinuousActions(mapDefinition) {
  return mapDefinition?.actionRules === ACTION_RULES.CONTINUOUS;
}

export function supportsDirectionalSignals(mapDefinition) {
  return getMapDimensions(mapDefinition).rows === NEW_GRID_SIZE;
}

export function getMapGameplayBlocker(mapDefinition, { allowUpgradeDraft = false, allowExpansionDraft = false } = {}) {
  if (mapDefinition.expansion && mapDefinition.expansion.status !== "ready" && !allowExpansionDraft) {
    return "扩展副本需要检查路线，请点击“校验并完成扩展”。";
  }
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
