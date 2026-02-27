const gameEngine = {
  turn: "THIEF", // 'THIEF' or 'POLICE'
  diceValue: 0,
  isRolling: false,

  // State arrays for multiple units
  policeUnits: [], // { id, r, c, state: 'IDLE' | 'CARRYING' }
  thiefUnits: [], // { id, r, c, state: 'ACTIVE' | 'ESCAPED' | 'JAILED' | 'CARRIED' }

  selectedUnit: null,
  reachable: new Map(), // "r,c" => { r,c, path, remainingSteps }

  init: function () {
    this.turn = "THIEF";
    this.diceValue = 0;
    this.selectedUnit = null;
    this.reachable.clear();
    this.policeUnits = [];
    this.thiefUnits = [];

    // Scan map for spawns
    let pid = 0,
      tid = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (state.map[r][c] === "POLICE_SPAWN") {
          this.policeUnits.push({ id: `P${pid++}`, r, c, state: "IDLE" });
        }
        if (state.map[r][c] === "THIEF_SPAWN") {
          this.thiefUnits.push({ id: `T${tid++}`, r, c, state: "ACTIVE" });
        }
      }
    }

    this.setupUI();
    this.renderGameBoard();
    this.updateTurnUI();
  },

  setupUI: function () {
    // Clear old event listeners by cloning
    ["btnRollDice", "btnSkipTurn"].forEach((key) => {
      const el = els[key];
      const newEl = el.cloneNode(true);
      el.parentNode.replaceChild(newEl, el);
      els[key] = newEl;
    });

    els.btnRollDice.addEventListener("click", () => this.rollDice());
    els.btnSkipTurn.addEventListener("click", () => this.skipTurn());
  },

  renderGameBoard: function () {
    els.gameBoard.innerHTML = "";

    // Render Grid
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = document.createElement("div");
        const tileType = state.map[r][c];
        cell.className = `cell type-${tileType}`;
        cell.id = `game-cell-${r}-${c}`;

        // Show markers (exclude spawns in game mode as requested)
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

        cell.addEventListener("mouseenter", () => this.handleCellHover(r, c));
        cell.addEventListener("mouseleave", () => this.clearPathHover());
        cell.addEventListener("click", () => this.handleCellClick(r, c));

        els.gameBoard.appendChild(cell);
      }
    }

    // Render Units
    this.policeUnits.forEach((p) => {
      // Police visually stays on board even if Carrying
      this.renderUnit(
        p.r,
        p.c,
        p.state === "CARRYING" ? "👮🎒" : "👮",
        "police-token",
        p.id,
      );
    });

    this.thiefUnits.forEach((t) => {
      if (t.state === "ACTIVE") {
        this.renderUnit(t.r, t.c, "🏃", "thief-token", t.id);
      }
    });
  },

  renderUnit: function (r, c, emoji, cssClass, id) {
    const cell = document.getElementById(`game-cell-${r}-${c}`);
    if (!cell) return;

    const token = document.createElement("div");
    token.className = `character ${cssClass}`;
    token.textContent = emoji;
    token.dataset.id = id;
    cell.appendChild(token);
  },

  updateTurnUI: function () {
    const isThief = this.turn === "THIEF";
    els.turnIndicator.textContent = isThief ? "🏃 小偷回合" : "🚓 警察回合";
    els.policeStat.classList.toggle("active", !isThief);
    els.thiefStat.classList.toggle("active", isThief);

    els.diceEl.textContent = "🎲";
    els.diceValueEl.textContent = "?";
    els.gameMessage.textContent = "点击骰子投掷";

    els.btnRollDice.disabled = false;
    els.btnRollDice.classList.remove("hidden");
    els.btnSkipTurn.classList.add("hidden");

    this.diceValue = 0;
    this.selectedUnit = null;
    this.clearHighlights();
  },

  rollDice: function () {
    if (this.isRolling) return;
    this.isRolling = true;
    els.btnRollDice.disabled = true;
    els.diceEl.classList.add("rolling");
    els.gameMessage.textContent = "掷骰子中...";

    let rolls = 0;
    const interval = setInterval(() => {
      els.diceEl.textContent = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][
        Math.floor(Math.random() * 6)
      ];
      rolls++;
      if (rolls > 15) {
        clearInterval(interval);
        this.isRolling = false;
        els.diceEl.classList.remove("rolling");

        this.diceValue = Math.floor(Math.random() * 6) + 1;
        els.diceEl.textContent = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][
          this.diceValue - 1
        ];
        els.diceValueEl.textContent = this.diceValue;

        this.onDiceRolled();
      }
    }, 50);
  },

  onDiceRolled: function () {
    // Check if ANY unit has valid moves
    const units = this.turn === "THIEF" ? this.thiefUnits : this.policeUnits;
    const activeUnits = units.filter((u) =>
      this.turn === "THIEF" ? u.state === "ACTIVE" : true,
    );

    let hasMoves = false;
    for (const u of activeUnits) {
      const moves = this.calculateReachableForUnit(u);
      if (moves.size > 0) {
        hasMoves = true;
        break;
      }
    }

    if (!hasMoves) {
      els.gameMessage.textContent = "无路可走！所有角色均无法行动。";
      els.btnRollDice.classList.add("hidden");
      els.btnSkipTurn.classList.remove("hidden");
    } else {
      els.gameMessage.textContent = `点数 ${this.diceValue}！请点击己方角色移动`;
      els.btnRollDice.classList.add("hidden");
      // Highlight selectables
      this.highlightSelectableUnits(activeUnits);
    }
  },

  highlightSelectableUnits: function (units) {
    units.forEach((u) => {
      const moves = this.calculateReachableForUnit(u);
      if (moves.size > 0) {
        const cell = document.getElementById(`game-cell-${u.r}-${u.c}`);
        if (cell) cell.classList.add("selectable-unit");
      }
    });
  },

  calculateReachableForUnit: function (unit) {
    const results = new Map();
    const startNode = {
      r: unit.r,
      c: unit.c,
      stepsLeft: this.diceValue,
      path: [{ r: unit.r, c: unit.c }],
      costSpent: 0,
    };
    const queue = [startNode];

    // Define obstacles based on who is moving
    const isThief = this.turn === "THIEF";

    while (queue.length > 0) {
      const curr = queue.shift();

      // Success condition
      if (curr.stepsLeft === 0) {
        const key = `${curr.r},${curr.c}`;
        if (!results.has(key)) results.set(key, curr);
        continue;
      }

      let possibleMoves = [];

      // 1. Adjacent tiles
      const dirs = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ];
      for (const [dr, dc] of dirs) {
        possibleMoves.push({
          nr: curr.r + dr,
          nc: curr.c + dc,
          isTeleport: false,
        });
      }

      // 2. Manhole teleports
      if (isThief && state.map[curr.r][curr.c] === "MANHOLE") {
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (
              state.map[r][c] === "MANHOLE" &&
              (r !== curr.r || c !== curr.c)
            ) {
              possibleMoves.push({ nr: r, nc: c, isTeleport: true });
            }
          }
        }
      }

      for (const move of possibleMoves) {
        const nr = move.nr;
        const nc = move.nc;
        const isTeleport = move.isTeleport;

        // Boundaries
        if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;

        // No backtracking in single move
        if (curr.path.some((p) => p.r === nr && p.c === nc)) continue;

        const tileType = state.map[nr][nc];
        const tile = TILE_TYPES[tileType];

        // Static terrain walkability
        if (!tile.walkable.includes(isThief ? "THIEF" : "POLICE")) continue;

        // Special Rule: Carrying Police can only enter Police Station to drop off, but can walk on roads
        // Actually they are just Police units. The destination logic is handled at end.
        // But wait, "Carrying Police" cannot capture another thief.
        // "Escorting" police must return to Station.

        const cost = isTeleport ? 1 : tile.cost;
        if (curr.stepsLeft < cost) continue;

        // UNIT COLLISION AND INTERACTION RULES

        // 1. Cannot PASS THROUGH any unit (Ally or Enemy)
        // Check if any unit is at (nr, nc)
        const occupant = this.getUnitAt(nr, nc);

        if (occupant) {
          // Interaction only possible on FINAL step (Capture or Jail)
          // If not final step, it's a block
          if (curr.stepsLeft > cost) continue;

          // Final Step Logic:
          if (isThief) {
            // Thief cannot land on any unit (no capturing)
            continue;
          } else {
            // Police moving
            const isPolice = occupant.role === "POLICE";
            if (isPolice) continue; // Cannot land on ally

            // Landing on Thief (Capture)
            // Requirement: Police must be IDLE (not carrying)
            if (unit.state === "CARRYING") continue;

            // Valid capture! Allow move.
          }
        }

        queue.push({
          r: nr,
          c: nc,
          stepsLeft: curr.stepsLeft - cost,
          path: [...curr.path, { r: nr, c: nc }],
          costSpent: curr.costSpent + cost,
        });
      }
    }
    return results;
  },

  getUnitAt: function (r, c) {
    const p = this.policeUnits.find((u) => u.r === r && u.c === c);
    if (p) return { role: "POLICE", unit: p };

    const t = this.thiefUnits.find(
      (u) => u.r === r && u.c === c && u.state === "ACTIVE",
    );
    if (t) return { role: "THIEF", unit: t };

    return null;
  },

  handleCellClick: function (r, c) {
    if (this.diceValue === 0) return;

    // 1. Select Unit Mode
    if (!this.selectedUnit) {
      const clickedUnit = this.getUnitAt(r, c);
      if (!clickedUnit) return;

      // Must be own unit
      if (clickedUnit.role !== this.turn) return;

      // Check if selectable (has moves)
      const moves = this.calculateReachableForUnit(clickedUnit.unit);
      if (moves.size === 0) return;

      this.selectedUnit = clickedUnit.unit;
      this.reachable = moves;

      this.clearHighlights();
      // Highlight selected unit
      document
        .getElementById(`game-cell-${r}-${c}`)
        .classList.add("unit-selected");
      this.highlightReachable();
      els.gameMessage.textContent = "请点击高亮格子移动";
      return;
    }

    // 2. Move Unit Mode
    const key = `${r},${c}`;
    if (this.reachable.has(key)) {
      this.moveSelectedUnit(r, c);
    } else {
      // Deselect or switch unit
      const clickedUnit = this.getUnitAt(r, c);
      if (
        clickedUnit &&
        clickedUnit.role === this.turn &&
        clickedUnit.unit !== this.selectedUnit
      ) {
        const moves = this.calculateReachableForUnit(clickedUnit.unit);
        if (moves.size > 0) {
          this.selectedUnit = clickedUnit.unit;
          this.reachable = moves;
          this.clearHighlights();
          document
            .getElementById(`game-cell-${r}-${c}`)
            .classList.add("unit-selected");
          this.highlightReachable();
        }
      }
    }
  },

  moveSelectedUnit: function (r, c) {
    const u = this.selectedUnit;
    u.r = r;
    u.c = c;

    this.clearHighlights();

    // Post-Move Interaction Logic
    if (this.turn === "POLICE") {
      const tileType = state.map[r][c];

      // 1. Jailing Logic (Carrying Police enters Station)
      if (u.state === "CARRYING" && tileType === "POLICE_STATION") {
        u.state = "IDLE";
        // Find visible notification? Maybe toast.
      }

      // 2. Capture Logic (Idle Police lands on Thief)
      // Note: getUnitAt won't find the thief anymore because Police is now on top of it?
      // Actually u is updated. So check against thief array.
      const caughtThief = this.thiefUnits.find(
        (t) => t.r === r && t.c === c && t.state === "ACTIVE",
      );
      if (caughtThief && u.state === "IDLE") {
        caughtThief.state = "CARRIED";
        u.state = "CARRYING";
      }
    } else {
      // Thief Logic
      const tileType = state.map[r][c];
      if (tileType === "THIEF_BASE") {
        u.state = "ESCAPED";
      }
    }

    this.renderGameBoard();
    this.checkWinCondition();
  },

  checkWinCondition: function () {
    // Police Win: All thieves are CAUGHT (CARRIED or JAILED)
    const allCaught = this.thiefUnits.every(
      (t) => t.state === "CARRIED" || t.state === "JAILED",
    );
    if (this.thiefUnits.length > 0 && allCaught) {
      this.showVictory("POLICE");
      return;
    }

    // Thief Win: All thieves ESCAPED
    const allEscaped = this.thiefUnits.every((t) => t.state === "ESCAPED");
    if (this.thiefUnits.length > 0 && allEscaped) {
      this.showVictory("THIEF");
      return;
    }

    // Mixed End Game: If no ACTIVE thieves left (some escaped, some jailed)
    // This is a partial state. Usually game ends when last active thief is resolved.
    const hasActive = this.thiefUnits.some((t) => t.state === "ACTIVE");
    if (!hasActive) {
      // Game Over - Calculate who did better?
      // User requirement: "小偷...胜利条件为所有小偷都到达"
      // So if mixed, it's technically a Police win (prevented full escape)?
      // Or just a "Game Over" summary.
      // Let's declare Police Win if any caught, Thief Win only if ALL escaped.
      // Wait, if 1 escaped and 1 caught, the game stops.
      // Let's show a summary message.
      this.showVictory("MIXED");
      return;
    }

    // Next Turn
    this.turn = this.turn === "THIEF" ? "POLICE" : "THIEF";
    this.updateTurnUI();
  },

  showVictory: function (type) {
    els.victoryModal.classList.remove("hidden");
    if (type === "POLICE") {
      els.victoryTitle.textContent = "🚓 警察胜利！";
      els.victoryTitle.style.color = "var(--primary-color)";
      els.victoryMessage.textContent = "所有小偷都被抓捕归案！";
    } else if (type === "THIEF") {
      els.victoryTitle.textContent = "🏃 小偷胜利！";
      els.victoryTitle.style.color = "var(--danger-color)";
      els.victoryMessage.textContent = "所有小偷都成功逃脱！";
    } else {
      // Mixed
      const escaped = this.thiefUnits.filter(
        (t) => t.state === "ESCAPED",
      ).length;
      const caught = this.thiefUnits.length - escaped;
      els.victoryTitle.textContent = "🏁 游戏结束";
      els.victoryTitle.style.color = "#f39c12";
      els.victoryMessage.textContent = `${escaped} 名小偷逃脱，${caught} 名被抓捕。`;
    }
  },

  skipTurn: function () {
    this.turn = this.turn === "THIEF" ? "POLICE" : "THIEF";
    this.updateTurnUI();
  },

  clearHighlights: function () {
    document
      .querySelectorAll(".reachable")
      .forEach((el) => el.classList.remove("reachable"));
    document
      .querySelectorAll(".selectable-unit")
      .forEach((el) => el.classList.remove("selectable-unit"));
    document
      .querySelectorAll(".unit-selected")
      .forEach((el) => el.classList.remove("unit-selected"));
    this.clearPathHover();
  },

  highlightReachable: function () {
    this.reachable.forEach((data, key) => {
      const [r, c] = key.split(",").map(Number);
      const cell = document.getElementById(`game-cell-${r}-${c}`);
      if (cell) cell.classList.add("reachable");
    });
  },

  handleCellHover: function (r, c) {
    if (this.diceValue === 0 || !this.selectedUnit) return;

    this.clearPathHover();
    const key = `${r},${c}`;

    if (this.reachable.has(key)) {
      const route = this.reachable.get(key);
      let currentCostSpent = 0;

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
};
