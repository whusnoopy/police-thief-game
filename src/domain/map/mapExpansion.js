import { decodeMapDefinition } from "./mapCodec.js";
import { cloneMapDefinition, createEmptyMapDefinition } from "./mapModel.js";
import { getMapDimensions } from "./mapDimensions.js";
import { validateMapDefinition } from "../rules/mapValidation.js";

// A new, explicit copy: the original 10×10 is centered, with a five-cell road
// border. Added roads can change connectivity, so completion requires review.
export function createMapExpansionDraft({ encodedMap, mapId, name }) {
  const original = decodeMapDefinition(encodedMap);
  if (getMapDimensions(original).rows !== 10) throw new Error("Only 10×10 maps can be expanded");
  const draft = createEmptyMapDefinition({
    ruleset: original.ruleset, actionRules: "single",
    meta: { ...original.meta, rows: 20, cols: 20 },
    ...(original.upgrade ? { upgrade: structuredClone(original.upgrade) } : {}),
    expansion: { status: "editing", offset: { r: 5, c: 5 }, source: {
      encodedMap, ...(mapId !== undefined ? { mapId } : {}), ...(name !== undefined ? { name } : {}),
    } },
  });
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) draft.terrain[r + 5][c + 5] = original.terrain[r][c];
  const shift = p => ({ r: p.r + 5, c: p.c + 5 });
  draft.features = original.features.map(f => ({ ...f, position: shift(f.position) }));
  for (const side of ["police", "thief"]) draft.spawns[side] = original.spawns[side].map(shift);
  // A boundary mountain now has new neighbors, which must keep its grass buffer.
  for (let r = 5; r < 15; r++) for (let c = 5; c < 15; c++) {
    if (draft.terrain[r][c] !== "MOUNTAIN") continue;
    for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {
      const rr = r + dr, cc = c + dc;
      if (rr < 5 || rr >= 15 || cc < 5 || cc >= 15) draft.terrain[rr][cc] = "GRASS";
    }
  }
  return cloneMapDefinition(draft);
}

export function completeMapExpansion(mapDefinition) {
  if (!mapDefinition.expansion) throw new Error("Map is not an expansion draft");
  const result = validateMapDefinition(mapDefinition, { allowExpansionDraft: true });
  if (!result.valid) return { ...result, mapDefinition: null };
  const reviewed = cloneMapDefinition(mapDefinition);
  reviewed.expansion.status = "ready";
  return { ...result, mapDefinition: reviewed };
}
