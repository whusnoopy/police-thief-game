import { generateMapId, normalizeMapRecord } from "./mapStore.js";

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const fingerprint = (record) => record.isCorrupt
  ? `raw:${JSON.stringify(record.rawRecord)}` : `map:${record.encodedMap}`;

// Build the entire import before writing anything. Existing records and the
// current editor are never replaced, including when an imported id collides.
export function planMapImport(text, existingMaps, { createId = generateMapId, now = Date.now() } = {}) {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) {
    throw new Error("备份文件超过 5 MB，请拆分后导入。");
  }
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error("文件不是完整的 JSON 备份，未导入任何地图。"); }
  let candidates;
  if (isObject(payload) && Object.hasOwn(payload, "maps")) {
    if (payload.version !== 1 || !Array.isArray(payload.maps)) {
      throw new Error("无法识别此备份版本或地图列表，未导入任何地图。");
    }
    candidates = [...payload.maps];
    if (isObject(payload.currentMap) && typeof payload.currentMap.encodedMap === "string") {
      const current = normalizeMapRecord(payload.currentMap);
      if (!candidates.some((record) => fingerprint(normalizeMapRecord(record)) === fingerprint(current))) {
        candidates.push({ ...payload.currentMap, name: payload.currentMap.name || "备份中的当前地图" });
      }
    }
    if (isObject(payload.unreadableStorage) && Object.keys(payload.unreadableStorage).length) {
      candidates.push({ name: "未解析的地图库原文", rawRecord: { unreadableStorage: payload.unreadableStorage } });
    }
  } else if (isObject(payload) && (
    typeof payload.encodedMap === "string" || typeof payload.data === "string" ||
    Object.hasOwn(payload, "rawRecord") || Object.hasOwn(payload, "unreadableStorage")
  )) {
    candidates = [payload];
  } else {
    throw new Error("请选择游戏导出的地图备份 JSON 文件，未导入任何地图。");
  }

  const seen = new Set(existingMaps.map(fingerprint));
  const usedIds = new Set(existingMaps.map((record) => record.id));
  const names = new Set(existingMaps.map((record) => record.name));
  const additions = [];
  let duplicates = 0;
  let corrupt = 0;
  for (const candidate of candidates) {
    const record = normalizeMapRecord(candidate);
    const key = fingerprint(record);
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    const baseId = createId();
    let id = baseId;
    for (let suffix = 2; usedIds.has(id); suffix++) id = `${baseId}_${suffix}`;
    usedIds.add(id);
    const baseName = typeof record.name === "string" && record.name.trim() ? record.name.trim() : "导入的地图";
    let name = baseName;
    for (let suffix = 1; names.has(name); suffix++) name = `${baseName}（导入${suffix === 1 ? "" : suffix}）`;
    names.add(name);
    if (record.isCorrupt) corrupt++;
    additions.push({ ...record, id, name, updatedAt: now });
  }
  return {
    maps: [...additions, ...existingMaps],
    imported: additions.length - corrupt,
    corrupt,
    duplicates,
  };
}
