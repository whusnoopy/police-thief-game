import test from "node:test";
import assert from "node:assert/strict";
import { projectPathPreview } from "../src/features/gameBoardProjection.js";

test("path preview labels disembark segments explicitly", () => {
  const preview = projectPathPreview({
    trail: [
      { r: 0, c: 1, cost: 2 },
      { r: 0, c: 1, cost: 0, movementKind: "DISEMBARK" },
      { r: 0, c: 2, cost: 4 },
    ],
  }, (points) => `${points}`);

  assert.deepEqual(preview, [
    { r: 0, c: 1, label: "下车" },
    { r: 0, c: 2, label: "6" },
  ]);
});
