import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";
import { createRampScenario } from "./helpers/rampScenario.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { createIsometricGameView } from "../src/ui/isometric/isometricRenderer.js";
import { createIsometricProjection, projectSurfacePoint } from "../src/ui/isometric/projection.js";

function setup() {
  const env = createTestEnvironment();
  env.installGlobals();
  const { map, positions } = createRampScenario();
  const clicks = [], viewState = { zoom: 1 };
  const view = createIsometricGameView(env.elements["game-board"], { viewState, onCellClick: (r, c) => clicks.push({ r, c }), onCellHover() {}, onLeave() {} });
  view.render(createGameSession(map));
  view.setSelectable([positions.start]);
  const viewport = env.elements["game-board"].querySelectorAll(".iso-viewport")[0];
  const svg = viewport.querySelectorAll(".iso-canvas")[0];
  svg.getBoundingClientRect = () => ({ left: parseFloat(svg.style.left) - viewport.scrollLeft, top: parseFloat(svg.style.top) - viewport.scrollTop, width: parseFloat(svg.style.width), height: parseFloat(svg.style.height) });
  const at = (position) => {
    const point = projectSurfacePoint({ ...position, tileType: map.terrain[position.r][position.c] }, 0, 0, createIsometricProjection());
    const rect = svg.getBoundingClientRect();
    return { x: rect.left + point.x, y: rect.top + point.y };
  };
  const pointer = (type, point, properties = {}) => viewport.dispatchEvent({ type, pointerType: "mouse", pointerId: 1, button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: point.x, clientY: point.y, ...properties });
  const click = (point) => svg.dispatchEvent({ type: "click", pointerType: "mouse", clientX: point.x, clientY: point.y });
  return { view, viewState, positions, viewport, svg, at, pointer, click, clicks };
}

test("fitted isometric maps pan from blank space and inactive tiles, suppressing drag release but preserving the next click", () => {
  const { view, viewState, positions, viewport, at, pointer, click, clicks } = setup();
  for (const start of [{ x: 20, y: 20 }, at({ r: 1, c: 1 })]) {
    const before = { left: viewport.scrollLeft, top: viewport.scrollTop };
    pointer("pointerdown", start);
    pointer("pointermove", { x: start.x - 80, y: start.y - 40 });
    assert.equal(viewport.scrollLeft, before.left + 80);
    assert.equal(viewport.scrollTop, before.top + 40);
    assert.ok(viewport.classList.contains("is-panning"));
    pointer("pointerup", { x: start.x - 80, y: start.y - 40 });
    click(at(positions.start));
    assert.deepEqual(clicks, []);
    assert.ok(!viewport.classList.contains("is-panning"));
  }
  assert.equal(viewState.zoom, 1);
  const point = at(positions.start);
  pointer("pointerdown", point);
  pointer("pointerup", point);
  click(point);
  assert.deepEqual(clicks, [positions.start]);
  view.setZoom(1);
  const reset = at(positions.start);
  assert.ok(reset.x >= 0 && reset.y >= 0);
  view.dispose();
});

test("clickable presses, right clicks, tiny motion and cancelled drags cannot become unintended pans or moves", () => {
  const { view, positions, viewport, at, pointer, click, clicks } = setup();
  const origin = [viewport.scrollLeft, viewport.scrollTop];
  const point = at(positions.start);
  pointer("pointerdown", point);
  pointer("pointermove", { x: point.x + 70, y: point.y + 40 });
  pointer("pointerup", { x: point.x + 70, y: point.y + 40 });
  click(point);
  assert.deepEqual([viewport.scrollLeft, viewport.scrollTop], origin);
  assert.deepEqual(clicks, []);
  pointer("pointerdown", { x: 20, y: 20 }, { button: 2, buttons: 2 });
  pointer("pointermove", { x: 90, y: 70 }, { buttons: 2 });
  pointer("pointerup", { x: 90, y: 70 }, { button: 2 });
  assert.deepEqual([viewport.scrollLeft, viewport.scrollTop], origin);
  pointer("pointerdown", { x: 20, y: 20 });
  pointer("pointermove", { x: 23, y: 22 });
  assert.deepEqual([viewport.scrollLeft, viewport.scrollTop], origin);
  pointer("pointermove", { x: 90, y: 70 });
  pointer("pointercancel", { x: 90, y: 70 });
  const cancelled = [viewport.scrollLeft, viewport.scrollTop];
  pointer("pointermove", { x: 140, y: 100 });
  assert.deepEqual([viewport.scrollLeft, viewport.scrollTop], cancelled);
  assert.ok(!viewport.classList.contains("is-panning"));
  view.dispose();
});

test("resizing keeps the map centre when native scrolling is clamped before the observer callback", () => {
  const previous = globalThis.ResizeObserver;
  let resize;
  globalThis.ResizeObserver = class {
    constructor(callback) { resize = callback; }
    observe() {}
    disconnect() {}
  };
  try {
    const { view, viewState, viewport, svg } = setup();
    viewport.clientWidth = 822;
    viewport.clientHeight = 1100;
    resize();
    const expected = { x: viewState.centerX, y: viewState.centerY };
    viewport.clientWidth = 1602;
    viewport.clientHeight = 580;
    viewport.scrollLeft = 42; // old scrollable width minus the new viewport
    resize();
    assert.ok(Math.abs(viewState.centerX - expected.x) < 1e-7);
    assert.ok(Math.abs(viewState.centerY - expected.y) < 1e-7);
    const bounds = svg.getBoundingClientRect();
    assert.ok(bounds.left >= 0 && bounds.top >= 0);
    assert.ok(bounds.left + bounds.width <= 1602 && bounds.top + bounds.height <= 580);
    view.setZoom(1.75);
    viewport.scrollLeft += 60;
    viewport.dispatchEvent({ type: "scroll" });
    const panned = { x: viewState.centerX, y: viewState.centerY };
    viewport.clientWidth = 732;
    viewport.clientHeight = 1121;
    resize();
    assert.ok(Math.abs(viewState.centerX - panned.x) < 1e-7);
    assert.ok(Math.abs(viewState.centerY - panned.y) < 1e-7);
    view.dispose();
  } finally {
    if (previous === undefined) delete globalThis.ResizeObserver;
    else globalThis.ResizeObserver = previous;
  }
});
