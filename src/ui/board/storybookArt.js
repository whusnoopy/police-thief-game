import { TILE_TYPES } from '../../config/constants.js';
import { BRIDGE_DIRECTIONS, getRampDirection } from '../../domain/map/bridgeTopology.js';

export const TILE_ASSETS = {
  BANK: 'bank', POLICE_STATION: 'police-station', THIEF_BASE: 'thief-base',
  FARM: 'farm', BUILDING: 'building', CONSTRUCTION_SITE: 'construction-site',
  BARRIER: 'barrier', MOUNTAIN: 'mountain',
};

export function appendSprite(container, name, className, label) {
  const image = document.createElement('img');
  image.className = `story-sprite ${className}`;
  image.src = new URL(`../../assets/storybook/${name}.webp`, import.meta.url).href;
  image.alt = '';
  image.draggable = false;
  image.addEventListener('error', () => {
    image.remove();
    const fallback = document.createElement('span');
    fallback.className = 'story-fallback';
    fallback.textContent = label;
    container.appendChild(fallback);
  }, { once: true });
  container.appendChild(image);
  return image;
}

export function appendTileArt(container, tileType) {
  const ramp = getRampDirection(tileType);
  if (ramp) {
    const sign = document.createElement('span');
    sign.className = 'bridge-ramp-sign';
    sign.dataset.direction = ramp.direction;
    sign.textContent = ramp.arrow;
    sign.title = `向${ramp.name}上坡，反向下桥，两侧不通行`;
    sign.setAttribute('aria-hidden', 'true');
    container.appendChild(sign);
    const opposite = BRIDGE_DIRECTIONS[(BRIDGE_DIRECTIONS.indexOf(ramp) + 2) % 4];
    for (const [direction, text] of [[ramp.direction, '高'], [opposite.direction, '低']]) {
      const label = document.createElement('span');
      label.className = `ramp-end-label end-${direction}`;
      label.textContent = text;
      label.setAttribute('aria-hidden', 'true');
      container.appendChild(label);
    }
    return;
  }
  const asset = TILE_ASSETS[tileType];
  if (asset) {
    appendSprite(container, asset, 'tile-art', TILE_TYPES[tileType].name);
    const label = document.createElement('span');
    label.className = 'tile-label';
    label.textContent = TILE_TYPES[tileType].name;
    container.appendChild(label);
    return;
  }
  const marker = document.createElement('span');
  marker.setAttribute('aria-hidden', 'true');
  if (tileType === 'POLICE_SPAWN' || tileType === 'THIEF_SPAWN') {
    marker.className = `spawn-sign ${tileType === 'POLICE_SPAWN' ? 'police-sign' : 'thief-sign'}`;
    marker.textContent = tileType === 'POLICE_SPAWN' ? 'P' : 'T';
  } else if (tileType === 'PARKING') {
    marker.className = 'parking-sign'; marker.textContent = 'P';
  } else if (tileType === 'MANHOLE') {
    marker.className = 'manhole-sign';
  } else if (tileType === 'TRAFFIC_LIGHT') {
    marker.className = 'legacy-signal-sign'; marker.textContent = '●';
  } else return;
  container.appendChild(marker);
}

export function renderTileIcon(container, tileType) {
  container.classList.add('story-icon', `type-${tileType}`);
  appendTileArt(container, tileType);
  if (tileType === 'POLICE_SPAWN' || tileType === 'THIEF_SPAWN') {
    appendSprite(container, tileType === 'POLICE_SPAWN' ? 'police' : 'thief', 'spawn-art', TILE_TYPES[tileType].name);
  }
}

export function appendStateBadge(container, kind) {
  const badge = document.createElement('span');
  badge.className = `unit-state-badge ${kind}`;
  badge.title = kind === 'money' ? '携款' : '押送小偷';
  badge.setAttribute('role', 'img');
  badge.setAttribute('aria-label', badge.title);
  badge.innerHTML = kind === 'money'
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9 7 3h10l-2 6c6 4 8 12-3 12S3 13 9 9Z" fill="#e7c36f" stroke="#84693d" stroke-width="1.6"/><path d="M8 9h8" stroke="#84693d" stroke-width="2"/><circle cx="12" cy="15" r="2" fill="none" stroke="#84693d"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#54768d" stroke-width="2.5"><circle cx="6" cy="14" r="4"/><circle cx="18" cy="9" r="4"/><path d="m9 11 6-1"/></g></svg>';
  container.appendChild(badge);
}
