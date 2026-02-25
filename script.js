// Constants
const GRID_SIZE = 10;
const TILE_TYPES = {
  GRASS: {
    id: "GRASS",
    name: "草地",
    emoji: "🌿",
    bgColor: "#a8e6cf",
    cost: 2,
    walkable: ["POLICE", "THIEF"],
  },
  BUILDING: {
    id: "BUILDING",
    name: "建筑物",
    emoji: "🏢",
    bgColor: "#dcdde1",
    cost: 0,
    walkable: [],
  },
  BARRIER: {
    id: "BARRIER",
    name: "路障",
    emoji: "🚧",
    bgColor: "#7f8fa6",
    cost: 0,
    walkable: [],
  },
  ROAD: {
    id: "ROAD",
    name: "道路",
    emoji: "⬜",
    bgColor: "#fdfdff",
    cost: 1,
    walkable: ["POLICE", "THIEF"],
  },
  POLICE_STATION: {
    id: "POLICE_STATION",
    name: "警察局",
    emoji: "🏛️",
    bgColor: "#c7ecee",
    cost: 1,
    walkable: ["POLICE"],
  },
  THIEF_BASE: {
    id: "THIEF_BASE",
    name: "小偷基地",
    emoji: "🏚️",
    bgColor: "#ffcccc",
    cost: 1,
    walkable: ["THIEF"],
  },
  POLICE_SPAWN: {
    id: "POLICE_SPAWN",
    name: "警察出生点",
    emoji: "🔵",
    bgColor: "",
    cost: 1,
    walkable: ["POLICE", "THIEF"],
    isSpawn: true,
    owner: "POLICE",
  },
  THIEF_SPAWN: {
    id: "THIEF_SPAWN",
    name: "小偷出生点",
    emoji: "🔴",
    bgColor: "",
    cost: 1,
    walkable: ["POLICE", "THIEF"],
    isSpawn: true,
    owner: "THIEF",
  },
};

// Application State
const state = {
  map: Array(GRID_SIZE)
    .fill()
    .map(() => Array(GRID_SIZE).fill("GRASS")),
  mode: "EDITOR", // EDITOR or GAME
  currentPaletteType: "GRASS",
};

// DOM Elements
const els = {
  editorView: document.getElementById("editor-view"),
  gameView: document.getElementById("game-view"),
  editorBoard: document.getElementById("editor-board"),
  gameBoard: document.getElementById("game-board"),
  palette: document.getElementById("palette"),
  btnSaveMap: document.getElementById("btn-save-map"),
  btnClearMap: document.getElementById("btn-clear-map"),
  btnStartGame: document.getElementById("btn-start-game"),
  btnBackEditor: document.getElementById("btn-back-editor"),
};

// Initialization
function init() {
  initEditor();
  loadMap();
  renderEditorBoard();

  // Bind global navigation
  els.btnStartGame.addEventListener("click", startGame);
  els.btnBackEditor.addEventListener("click", backToEditor);
}

// ========================
// Map Editor Module
// ========================

function initEditor() {
  // Generate Palette
  els.palette.innerHTML = "";
  Object.values(TILE_TYPES).forEach((type) => {
    const item = document.createElement("div");
    item.className = `palette-item ${type.id === state.currentPaletteType ? "active" : ""}`;
    item.dataset.type = type.id;
    item.innerHTML = `<span class="palette-icon">${type.emoji}</span><span class="palette-name">${type.name}</span>`;
    item.addEventListener("click", () => {
      document
        .querySelectorAll(".palette-item")
        .forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
      state.currentPaletteType = type.id;
    });
    els.palette.appendChild(item);
  });

  // Editor Actions
  els.btnSaveMap.addEventListener("click", saveMap);
  els.btnClearMap.addEventListener("click", clearMap);
}

function renderEditorBoard() {
  els.editorBoard.innerHTML = "";
  let isMouseDown = false;

  // Global tracking to ensure reliable drag painting
  document.addEventListener("mousedown", () => (isMouseDown = true));
  document.addEventListener("mouseup", () => (isMouseDown = false));

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement("div");

      const updateCellDOM = (element, r, c) => {
        const tileType = state.map[r][c];
        element.className = `cell type-${tileType}`;
        element.innerHTML = ""; // Clear existing markers

        if (
          TILE_TYPES[tileType].isSpawn ||
          (tileType !== "GRASS" && tileType !== "ROAD")
        ) {
          const marker = document.createElement("span");
          marker.className = "marker";
          marker.textContent = TILE_TYPES[tileType].emoji;
          element.appendChild(marker);
        }
      };

      updateCellDOM(cell, r, c);

      // Painting logic
      const paint = () => {
        if (state.map[r][c] !== state.currentPaletteType) {
          state.map[r][c] = state.currentPaletteType;
          updateCellDOM(cell, r, c);
        }
      };

      cell.addEventListener("mousedown", (e) => {
        e.preventDefault();
        paint();
      });

      cell.addEventListener("mouseenter", (e) => {
        if (isMouseDown) {
          paint();
        }
      });

      els.editorBoard.appendChild(cell);
    }
  }
}

function saveMap() {
  localStorage.setItem("policeThiefMap", JSON.stringify(state.map));
  showToast("地图已保存");
}

function loadMap() {
  const saved = localStorage.getItem("policeThiefMap");
  if (saved) {
    try {
      state.map = JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load map");
    }
  }
}

function clearMap() {
  if (confirm("确定要清空地图吗？所有地块将被重置为草地。")) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        state.map[r][c] = "GRASS";
      }
    }
    renderEditorBoard();
    localStorage.removeItem("policeThiefMap");
  }
}

function validateMap() {
  let hasPolice = false;
  let hasThief = false;

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (state.map[r][c] === "POLICE_SPAWN") hasPolice = true;
      if (state.map[r][c] === "THIEF_SPAWN") hasThief = true;
    }
  }

  if (!hasPolice || !hasThief) {
    alert("必须至少放置一个警察出生点和一个小偷出生点！");
    return false;
  }
  return true;
}

// Temporary showToast
function showToast(msg) {
  const btn = els.btnSaveMap;
  const oldText = btn.innerHTML;
  btn.innerHTML = `✅ ${msg}`;
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = oldText;
    btn.disabled = false;
  }, 1500);
}

// ========================
// Game Setup & Transitions
// ========================

function startGame() {
  if (!validateMap()) return;

  state.mode = "GAME";
  els.editorView.classList.add("hidden");
  els.gameView.classList.remove("hidden");
  document.getElementById("mode-indicator").textContent = "游戏模式";
  document.getElementById("mode-indicator").style.backgroundColor =
    "var(--success-color)";

  // Auto save
  saveMap();

  // Initialize Game engine
  gameEngine.init();
}

function backToEditor() {
  if (!confirm("返回编辑器将结束当前游戏进度，确定吗？")) return;

  state.mode = "EDITOR";
  els.gameView.classList.add("hidden");
  els.editorView.classList.remove("hidden");
  document.getElementById("mode-indicator").textContent = "地图编辑模式";
  document.getElementById("mode-indicator").style.backgroundColor =
    "var(--warning-color)";

  renderEditorBoard();
}

// ========================
// Game Engine
// ========================

const gameEngine = {
  turn: "THIEF",
  diceValue: 0,
  reachable: new Map(), // "r,c" => path[]
  policeInfo: { r: -1, c: -1, el: null },
  thiefInfo: { r: -1, c: -1, el: null },
  isRolling: false,

  init: function () {
    this.turn = "THIEF";
    this.diceValue = 0;
    this.reachable.clear();

    // Find spawns
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (state.map[r][c] === "POLICE_SPAWN") {
          this.policeInfo.r = r;
          this.policeInfo.c = c;
        }
        if (state.map[r][c] === "THIEF_SPAWN") {
          this.thiefInfo.r = r;
          this.thiefInfo.c = c;
        }
      }
    }

    this.renderGameBoard();
    this.updateTurnUI();

    // Bind events
    const btnRoll = document.getElementById("btn-roll-dice");
    const btnSkip = document.getElementById("btn-skip-turn");

    // Remove old listeners by cloning
    const newBtnRoll = btnRoll.cloneNode(true);
    const newBtnSkip = btnSkip.cloneNode(true);
    btnRoll.parentNode.replaceChild(newBtnRoll, btnRoll);
    btnSkip.parentNode.replaceChild(newBtnSkip, btnSkip);

    newBtnRoll.addEventListener("click", () => this.rollDice());
    newBtnSkip.addEventListener("click", () => this.skipTurn());

    document.getElementById("btn-play-again").onclick = () => {
      document.getElementById("victory-modal").classList.add("hidden");
      this.init();
    };
    document.getElementById("btn-modal-editor").onclick = () => {
      document.getElementById("victory-modal").classList.add("hidden");
      backToEditor();
    };
  },

  renderGameBoard: function () {
    els.gameBoard.innerHTML = "";
    const boardFragment = document.createDocumentFragment();

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = document.createElement("div");
        const tileType = state.map[r][c];
        cell.className = `cell type-${tileType}`;
        cell.id = `game-cell-${r}-${c}`;

        // Keep markers for visual, but hide spawn markers during gameplay
        if (
          !TILE_TYPES[tileType].isSpawn &&
          tileType !== "GRASS" &&
          tileType !== "ROAD"
        ) {
          const marker = document.createElement("span");
          marker.className = "marker";
          marker.textContent = TILE_TYPES[tileType].emoji;
          cell.appendChild(marker);
        }

        // Interaction
        cell.addEventListener("mouseenter", () => this.handleCellHover(r, c));
        cell.addEventListener("mouseleave", () => this.clearPathHover());
        cell.addEventListener("click", () => this.movePlayer(r, c));

        boardFragment.appendChild(cell);
      }
    }
    els.gameBoard.appendChild(boardFragment);

    // Add tokens
    this.policeInfo.el = document.createElement("div");
    this.policeInfo.el.className = "character police-token";
    this.policeInfo.el.textContent = "🚓";

    this.thiefInfo.el = document.createElement("div");
    this.thiefInfo.el.className = "character thief-token";
    this.thiefInfo.el.textContent = "🏃";

    this.updateTokenPositions();
  },

  updateTokenPositions: function () {
    // Place police
    const pCell = document.getElementById(
      `game-cell-${this.policeInfo.r}-${this.policeInfo.c}`,
    );
    if (pCell && !pCell.contains(this.policeInfo.el)) {
      pCell.appendChild(this.policeInfo.el);
    }
    // Place thief
    const tCell = document.getElementById(
      `game-cell-${this.thiefInfo.r}-${this.thiefInfo.c}`,
    );
    if (tCell && !tCell.contains(this.thiefInfo.el)) {
      tCell.appendChild(this.thiefInfo.el);
    }
  },

  updateTurnUI: function () {
    const turnText = this.turn === "THIEF" ? "🏃 小偷回合" : "🚓 警察回合";
    document.getElementById("turn-indicator").textContent = turnText;

    document
      .getElementById("police-stat")
      .classList.toggle("active", this.turn === "POLICE");
    document
      .getElementById("thief-stat")
      .classList.toggle("active", this.turn === "THIEF");

    document.getElementById("dice-value").textContent = "?";
    document.getElementById("dice").textContent = "🎲";
    document.getElementById("game-message").textContent = "点击骰子投掷";

    document.getElementById("btn-roll-dice").disabled = false;
    document.getElementById("btn-roll-dice").classList.remove("hidden");
    document.getElementById("btn-skip-turn").classList.add("hidden");

    this.diceValue = 0;
    this.clearHighlights();
  },

  rollDice: function () {
    if (this.isRolling) return;
    this.isRolling = true;

    const diceEl = document.getElementById("dice");
    const btnRoll = document.getElementById("btn-roll-dice");
    btnRoll.disabled = true;

    diceEl.classList.add("rolling");
    document.getElementById("game-message").textContent = "骰子投掷中...";

    let rolls = 0;
    const rollInterval = setInterval(() => {
      const faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
      diceEl.textContent = faces[Math.floor(Math.random() * 6)];
      rolls++;
      if (rolls > 15) {
        clearInterval(rollInterval);
        diceEl.classList.remove("rolling");

        // Final value
        this.diceValue = Math.floor(Math.random() * 6) + 1;
        const finalFaces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
        diceEl.textContent = finalFaces[this.diceValue - 1];
        document.getElementById("dice-value").textContent = this.diceValue;

        this.isRolling = false;
        this.calculateReachable();
      }
    }, 50);
  },

  calculateReachable: function () {
    this.reachable.clear();
    this.clearHighlights();

    const startR =
      this.turn === "POLICE" ? this.policeInfo.r : this.thiefInfo.r;
    const startC =
      this.turn === "POLICE" ? this.policeInfo.c : this.thiefInfo.c;
    const role = this.turn;

    const queue = [
      {
        r: startR,
        c: startC,
        stepsLeft: this.diceValue,
        path: [{ r: startR, c: startC }],
        costSpent: 0,
      },
    ];

    while (queue.length > 0) {
      const current = queue.shift();

      if (current.stepsLeft === 0) {
        const key = `${current.r},${current.c}`;
        // Keep the first found path
        if (!this.reachable.has(key)) {
          this.reachable.set(key, current);
        }
        continue;
      }

      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dr, dc] of dirs) {
        const nr = current.r + dr;
        const nc = current.c + dc;

        if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
        if (current.path.some((p) => p.r === nr && p.c === nc)) continue;

        const tileType = state.map[nr][nc];
        const tile = TILE_TYPES[tileType];

        if (!tile.walkable.includes(role)) continue;

        const cost = tile.cost;
        if (current.stepsLeft < cost) continue; // Cannot enter

        // Character collision
        const otherR = role === "POLICE" ? this.thiefInfo.r : this.policeInfo.r;
        const otherC = role === "POLICE" ? this.thiefInfo.c : this.policeInfo.c;
        if (nr === otherR && nc === otherC) {
          if (role === "POLICE" && current.stepsLeft === cost) {
            // Police catches Thief on final step - Valid!
          } else {
            // Cannot pass through or thief cannot land on police
            continue;
          }
        }

        queue.push({
          r: nr,
          c: nc,
          stepsLeft: current.stepsLeft - cost,
          path: [...current.path, { r: nr, c: nc }],
          costSpent: current.costSpent + cost,
        });
      }
    }

    this.highlightReachable();
  },

  highlightReachable: function () {
    if (this.reachable.size === 0) {
      document.getElementById("game-message").textContent =
        "无法移动！必须恰巧走完，请跳过回合。";
      document.getElementById("btn-roll-dice").classList.add("hidden");
      document.getElementById("btn-skip-turn").classList.remove("hidden");
      return;
    }

    document.getElementById("game-message").textContent = "请选择高亮格子移动";
    document.getElementById("btn-roll-dice").classList.add("hidden");

    for (const [key] of this.reachable) {
      const [r, c] = key.split("-"); // whoops, used comma in calculateReachable
    }

    // Fix key iteration
    this.reachable.forEach((data, key) => {
      const [r, c] = key.split(",").map(Number);
      const cell = document.getElementById(`game-cell-${r}-${c}`);
      if (cell) cell.classList.add("reachable");
    });
  },

  handleCellHover: function (r, c) {
    if (this.diceValue === 0 || this.isRolling) return;

    this.clearPathHover();
    const key = `${r},${c}`;

    if (this.reachable.has(key)) {
      const route = this.reachable.get(key);
      let currentCostSpent = 0;

      // Draw path lines
      for (let i = 1; i < route.path.length; i++) {
        const p = route.path[i];
        const cell = document.getElementById(`game-cell-${p.r}-${p.c}`);
        if (cell) {
          cell.classList.add("path-hover");

          const tileType = state.map[p.r][p.c];
          currentCostSpent += TILE_TYPES[tileType].cost;

          const badge = document.createElement("div");
          badge.className = "step-badge path-badge-temp";
          badge.textContent = currentCostSpent;
          cell.appendChild(badge);
        }
      }
    }
  },

  clearPathHover: function () {
    document
      .querySelectorAll(".path-hover")
      .forEach((el) => el.classList.remove("path-hover"));
    document.querySelectorAll(".path-badge-temp").forEach((el) => el.remove());
  },

  clearHighlights: function () {
    document
      .querySelectorAll(".reachable")
      .forEach((el) => el.classList.remove("reachable"));
    this.clearPathHover();
  },

  movePlayer: function (r, c) {
    const key = `${r},${c}`;
    if (!this.reachable.has(key)) return;

    this.clearHighlights();

    if (this.turn === "POLICE") {
      this.policeInfo.r = r;
      this.policeInfo.c = c;
    } else {
      this.thiefInfo.r = r;
      this.thiefInfo.c = c;
    }

    this.updateTokenPositions();
    this.checkWinCondition();
  },

  skipTurn: function () {
    this.turn = this.turn === "THIEF" ? "POLICE" : "THIEF";
    this.updateTurnUI();
  },

  checkWinCondition: function () {
    // Police wins if on same tile as thief
    if (
      this.policeInfo.r === this.thiefInfo.r &&
      this.policeInfo.c === this.thiefInfo.c
    ) {
      this.showVictory("POLICE");
      return;
    }

    // Thief wins if reaches base
    const thiefCellType = state.map[this.thiefInfo.r][this.thiefInfo.c];
    if (thiefCellType === "THIEF_BASE") {
      this.showVictory("THIEF");
      return;
    }

    // Otherwise next turn
    this.turn = this.turn === "THIEF" ? "POLICE" : "THIEF";
    this.updateTurnUI();
  },

  showVictory: function (winner) {
    const modal = document.getElementById("victory-modal");
    const title = document.getElementById("victory-title");
    const msg = document.getElementById("victory-message");

    modal.classList.remove("hidden");
    if (winner === "POLICE") {
      title.textContent = "🚓 警察胜利！";
      title.style.color = "var(--primary-color)";
      msg.textContent = "警察成功抓住了小偷！";
    } else {
      title.textContent = "🏃 小偷胜利！";
      title.style.color = "var(--danger-color)";
      msg.textContent = "小偷成功逃回了基地！";
    }
  },
};

// Start app
document.addEventListener("DOMContentLoaded", init);
