import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnvironment } from './helpers/fakeDom.js';
import { createEmptyMapDefinition, setLegacyTileAt } from '../src/domain/map/mapModel.js';
import { renderBoard } from '../src/ui/board/boardRenderer.js';
import { renderUnits } from '../src/ui/game/unitRenderer.js';
const env = createTestEnvironment();
env.installGlobals();

test('production art preserves driving, money, escort, animal and occupied building semantics', () => {
  const map = createEmptyMapDefinition();
  setLegacyTileAt(map, 0, 0, 'BANK');
  renderBoard(env.elements['game-board'], { mapDefinition: map, cellIdPrefix: 'art' });
  renderUnits({ cellIdPrefix: 'art',
    policeUnits: [{ id: 'P1', r: 0, c: 1, inCar: true, state: 'CARRYING' }],
    thiefUnits: [{ id: 'T1', r: 0, c: 0, state: 'ACTIVE', inCar: true, hasMoney: true },
      { id: 'T2', r: 0, c: 1, state: 'CARRIED' }],
    animalUnits: [{ id: 'A1', r: 1, c: 1, emoji: '🐮' }],
  });
  const bank = env.document.getElementById('art-0-0');
  assert.equal(bank.classList.contains('occupied-feature'), true);
  assert.equal(bank.querySelectorAll('.tile-art').length, 1);
  assert.equal(bank.querySelectorAll('.money').length, 1);
  assert.match(bank.querySelectorAll('.unit-art')[0].src, /car\.webp/);
  const police = env.document.getElementById('art-0-1');
  assert.equal(police.querySelectorAll('.character').length, 1);
  assert.equal(police.querySelectorAll('.escort').length, 1);
  assert.match(police.querySelectorAll('.unit-art')[0].src, /police-car\.webp/);
  assert.match(env.document.getElementById('art-1-1').querySelectorAll('.unit-art')[0].src, /cow\.webp/);
});

test('missing sprite falls back to readable text and rerender clears old units', () => {
  const map = createEmptyMapDefinition();
  setLegacyTileAt(map, 0, 0, 'BANK');
  renderBoard(env.elements['game-board'], { mapDefinition: map, cellIdPrefix: 'art' });
  renderUnits({ cellIdPrefix: 'art', policeUnits: [], thiefUnits: [{ id: 'T1', r: 0, c: 0, state: 'ACTIVE' }] });
  const bank = env.document.getElementById('art-0-0');
  bank.querySelectorAll('.tile-art')[0].dispatchEvent({ type: 'error' });
  assert.equal(bank.querySelectorAll('.story-fallback')[0].textContent, '银行');
  renderBoard(env.elements['game-board'], { mapDefinition: createEmptyMapDefinition(), cellIdPrefix: 'art' });
  assert.equal(env.elements['game-board'].querySelectorAll('.character').length, 0);
  assert.equal(env.elements['game-board'].querySelectorAll('.occupied-feature').length, 0);
});
