import test from 'node:test';
import assert from 'node:assert/strict';
import { neighborMask, terrainArt, terrainFamily } from '../experiments/storybook/visuals.js';

const makeMap = () => ({ terrain: Array.from({ length: 10 }, () => Array(10).fill('GRASS')) });

test('storybook: all 16 cardinal connections, without diagonal connections', () => {
  const directions = [[-1, 0], [0, 1], [1, 0], [0, -1]];
  for (let mask = 0; mask < 16; mask++) {
    const map = makeMap();
    map.terrain[4][4] = 'ROAD';
    directions.forEach(([r, c], bit) => { if (mask & (1 << bit)) map.terrain[4 + r][4 + c] = 'ROAD'; });
    for (const [r, c] of [[3, 3], [3, 5], [5, 3], [5, 5]]) map.terrain[r][c] = 'ROAD';
    assert.equal(neighborMask(map, 4, 4), mask);
  }
});

test('storybook: crosswalks join roads, while rivers and overpasses stay separate', () => {
  const map = makeMap();
  map.terrain[0][0] = 'CROSSWALK_HORIZONTAL';
  map.terrain[0][1] = 'ROAD';
  map.terrain[1][0] = 'CROSSWALK_VERTICAL';
  assert.equal(neighborMask(map, 0, 0), 6);
  assert.equal(terrainFamily('CROSSWALK_VERTICAL'), 'ROAD');
  map.terrain[0][1] = 'OVERPASS';
  map.terrain[1][0] = 'RIVER';
  assert.equal(neighborMask(map, 0, 0), 0);
});

test('storybook: inner corners fill only grass and rendering preserves map data', () => {
  const map = makeMap();
  for (const [r, c] of [[3, 3], [3, 4], [4, 3]]) map.terrain[r][c] = 'RIVER';
  const before = structuredClone(map);
  const svg = terrainArt(map);
  assert.match(svg, /data-inner-corner="4,4"/);
  assert.equal(terrainArt(map), svg);
  assert.deepEqual(map, before);
  map.terrain[4][4] = 'ROAD';
  assert.doesNotMatch(terrainArt(map), /data-inner-corner="4,4"/);
});
