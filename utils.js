function showToast(msg, targetBtn = null) {
  const btn = targetBtn || els.btnMapList;
  if (!btn) return;
  const oldText = btn.innerHTML;
  btn.innerHTML = `✅ ${msg}`;
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = oldText;
    btn.disabled = false;
  }, 1500);
}

function encodeMapToUrlSafeBase64(mapMatrix) {
  let chars = "";
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      let b6 = TILE_INT_MAP[mapMatrix[r][c]] || 0;
      chars += BASE64_ALPHABET[b6];
    }
  }
  return chars;
}

function decodeUrlSafeBase64ToMap(chars) {
  let mapMatrix = Array(GRID_SIZE)
    .fill()
    .map(() => Array(GRID_SIZE).fill("GRASS"));

  if (chars.length === 50) {
    let flat = [];
    for (let i = 0; i < chars.length; i++) {
      let b6 = BASE64_ALPHABET.indexOf(chars[i]);
      if (b6 === -1) b6 = 0;
      let t1 = b6 >> 3;
      let t2 = b6 & 7;
      flat.push(t1, t2);
    }
    let i = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (i < flat.length) {
          let type = INT_TILE_MAP[flat[i]] || "GRASS";
          mapMatrix[r][c] = type;
        }
        i++;
      }
    }
  } else {
    let i = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (i < chars.length) {
          let b6 = BASE64_ALPHABET.indexOf(chars[i]);
          if (b6 === -1) b6 = 0;
          let type = INT_TILE_MAP[b6] || "GRASS";
          mapMatrix[r][c] = type;
        }
        i++;
      }
    }
  }
  return mapMatrix;
}

function escapeHTML(str) {
  var p = document.createElement("p");
  p.appendChild(document.createTextNode(str));
  return p.innerHTML;
}
