import { getBoardCellElement } from '../board/boardRenderer.js';
import { appendSprite, appendStateBadge, TILE_ASSETS } from '../board/storybookArt.js';

export function appendUnitToken(cell, unit, side, { appendArtwork = appendSprite, showBadges = true } = {}) {
  const animal = side === 'animal';
  const role = animal ? (unit.emoji === '🐮' || unit.emoji === '🐄' ? 'cow' : 'pig') : side;
  const asset = unit.inCar ? (side === 'police' ? 'police-car' : 'car') : role;
  const name = animal ? (role === 'cow' ? '牛' : '猪') : `${side === 'police' ? '警察' : '小偷'} ${unit.id.slice(1)}`;
  const status = `${unit.inCar ? '，驾车' : ''}${unit.hasMoney ? '，携款' : ''}${unit.state === 'CARRYING' ? '，押送小偷' : ''}`;
  const token = document.createElement('div');
  token.className = `character ${side}-token${unit.inCar ? ' driving-token' : ''}`;
  token.dataset.id = unit.id;
  token.title = `${name}${status}`;
  token.setAttribute('role', 'img');
  token.setAttribute('aria-label', token.title);
  appendArtwork(token, asset, 'unit-art', name);
  if (!animal && showBadges) {
    const badge = document.createElement('span');
    badge.className = 'unit-id-badge';
    badge.textContent = unit.id;
    badge.setAttribute('aria-hidden', 'true');
    token.appendChild(badge);
  }
  if (showBadges && unit.hasMoney) appendStateBadge(token, 'money');
  if (showBadges && unit.state === 'CARRYING') appendStateBadge(token, 'escort');
  if (Object.keys(TILE_ASSETS).some(type => cell.classList.contains(`type-${type}`))) cell.classList.add('occupied-feature');
  cell.appendChild(token);
  return token;
}

export function appendParkedCar(cell, { appendArtwork = appendSprite } = {}) {
  const parkedCar = document.createElement('span');
  parkedCar.className = 'parked-car';
  parkedCar.setAttribute('role', 'img');
  parkedCar.setAttribute('aria-label', '空车');
  appendArtwork(parkedCar, 'car', 'parked-art', '空车');
  cell.appendChild(parkedCar);
  return parkedCar;
}

export function renderUnits({ cellIdPrefix, policeUnits, thiefUnits, animalUnits = [] }) {
  for (const [side, units] of [['animal', animalUnits], ['police', policeUnits], ['thief', thiefUnits]]) {
    units.forEach(unit => {
      if (side === 'thief' && unit.state !== 'ACTIVE') return;
      const cell = getBoardCellElement(cellIdPrefix, unit.r, unit.c);
      if (cell) appendUnitToken(cell, unit, side);
    });
  }
}
