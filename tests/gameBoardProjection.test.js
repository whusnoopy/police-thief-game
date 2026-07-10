import test from "node:test";
import assert from "node:assert/strict";
import { projectPathPreview } from "../src/features/gameBoardProjection.js";

test("path preview labels automatic boarding and parking explicitly", () => {
  const preview = projectPathPreview({
    trail: [
      { r: 0, c: 1, cost: 4, movementKind: "BOARD" },
      { r: 0, c: 2, cost: 2, movementKind: "PARK" },
    ],
  }, (points) => `${points}`);

  assert.deepEqual(preview, [
    { r: 0, c: 1, label: "上车" },
    { r: 0, c: 2, label: "下车" },
  ]);
});
