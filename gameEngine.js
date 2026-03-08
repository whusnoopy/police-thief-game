const HALF_STEP_POINTS = 2;
const DRIVE_COST_POINTS = 1;

const gameEngine = {
  turn: "THIEF", // 'THIEF' or 'POLICE'
  diceValue: 0,
  isRolling: false,

  // State arrays for multiple units
  policeUnits: [], // { id, r, c, state: 'IDLE' | 'CARRYING', inCar: boolean }
  thiefUnits: [], // { id, r, c, state: 'ACTIVE' | 'ESCAPED' | 'JAILED' | 'CARRIED', inCar: boolean, carrierId: string | null }
  parkingCars: new Set(), // "r,c" of parking tiles that still have an empty car

  selectedUnit: null,
  reachable: new Map(), // "r,c" => { r,c, path, trail, isDriving, boardedCarAt }

  init: function () {
    this.turn = "THIEF";
    this.diceValue = 0;
    this.selectedUnit = null;
    this.reachable.clear();
    this.policeUnits = [];
    this.thiefUnits = [];
    this.parkingCars = new Set();

    let pid = 0,
      tid = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const tileType = state.map[r][c];
        if (tileType === "PARKING") {
          this.parkingCars.add(this.getCoordKey(r, c));
        }
        if (tileType === "POLICE_SPAWN") {
          this.policeUnits.push({
            id: `P${pid++}`,
            r,
            c,
            state: "IDLE",
            inCar: false,
          });
        }
        if (tileType === "THIEF_SPAWN") {
          this.thiefUnits.push({
            id: `T${tid++}`,
            r,
            c,
            state: "ACTIVE",
            inCar: false,
            carrierId: null,
          });
        }
      }
    }

    this.setupUI();
    this.renderGameBoard();
    this.updateTurnUI();
  },

  getCoordKey: function (r, c) {
    return `${r},${c}`;
  },

  hasAvailableCar: function (r, c) {
    return this.parkingCars.has(this.getCoordKey(r, c));
  },

  consumeParkingCar: function (coordKey) {
    if (coordKey) this.parkingCars.delete(coordKey);
  },

  setupUI: function () {
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

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = document.createElement("div");
        const tileType = state.map[r][c];
        cell.className = `cell type-${tileType}`;
        cell.id = `game-cell-${r}-${c}`;

        if (this.shouldShowTileMarker(tileType)) {
          const marker = document.createElement("span");
          marker.className = "marker";
          marker.textContent = TILE_TYPES[tileType].emoji;
          cell.appendChild(marker);
        }

        if (tileType === "PARKING" && this.hasAvailableCar(r, c)) {
          const parkedCar = document.createElement("span");
          parkedCar.className = "parked-car";
          parkedCar.textContent = "🚗";
          cell.appendChild(parkedCar);
        }

        cell.addEventListener("mouseenter", () => this.handleCellHover(r, c));
        cell.addEventListener("mouseleave", () => this.clearPathHover());
        cell.addEventListener("click", () => this.handleCellClick(r, c));

        els.gameBoard.appendChild(cell);
      }
    }

    this.policeUnits.forEach((police) => {
      this.renderUnit(
        police.r,
        police.c,
        this.getPoliceEmoji(police),
        "police-token",
        police.id,
        police.inCar,
      );
    });

    this.thiefUnits.forEach((thief) => {
      if (thief.state === "ACTIVE") {
        this.renderUnit(
          thief.r,
          thief.c,
          this.getThiefEmoji(thief),
          "thief-token",
          thief.id,
          thief.inCar,
        );
      }
    });
  },

  shouldShowTileMarker: function (tileType) {
    return !TILE_TYPES[tileType].isSpawn && tileType !== "GRASS" && tileType !== "ROAD";
  },

  getPoliceEmoji: function (unit) {
    if (unit.inCar) return unit.state === "CARRYING" ? "🚔" : "🚓";
    return unit.state === "CARRYING" ? "👮🎒" : "👮";
  },

  getThiefEmoji: function (unit) {
    return unit.inCar ? "🚗" : "🏃";
  },

  renderUnit: function (r, c, emoji, cssClass, id, isDriving = false) {
    const cell = document.getElementById(`game-cell-${r}-${c}`);
    if (!cell) return;

    const token = document.createElement("div");
    token.className = `character ${cssClass}${isDriving ? " driving-token" : ""}`;
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
    this.reachable.clear();
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

  getMovementPoints: function () {
    return this.diceValue * HALF_STEP_POINTS;
  },

  formatMovementPoints: function (points) {
    const steps = points / HALF_STEP_POINTS;
    return Number.isInteger(steps) ? `${steps}` : `${steps.toFixed(1)}`;
  },

  getActiveUnitsForTurn: function () {
    if (this.turn === "THIEF") {
      return this.thiefUnits.filter((unit) => unit.state === "ACTIVE");
    }
    return this.policeUnits;
  },

  onDiceRolled: function () {
    const activeUnits = this.getActiveUnitsForTurn();

    let hasMoves = false;
    for (const unit of activeUnits) {
      const moves = this.calculateReachableForUnit(unit);
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
      this.highlightSelectableUnits(activeUnits);
    }
  },

  highlightSelectableUnits: function (units) {
    units.forEach((unit) => {
      const moves = this.calculateReachableForUnit(unit);
      if (moves.size > 0) {
        const cell = document.getElementById(`game-cell-${unit.r}-${unit.c}`);
        if (cell) cell.classList.add("selectable-unit");
      }
    });
  },

  chooseBetterRoute: function (existing, candidate) {
    if (!existing) return true;
    if (candidate.isDriving !== existing.isDriving) return candidate.isDriving;
    if (candidate.pointsLeft !== existing.pointsLeft) {
      return candidate.pointsLeft < existing.pointsLeft;
    }
    return candidate.path.length < existing.path.length;
  },

  canThiefStopAtBaseWithHalfStepLeft: function (isThief, tileType, isDriving, pointsLeft) {
    return (
      isThief &&
      isDriving &&
      tileType === "THIEF_BASE" &&
      pointsLeft === DRIVE_COST_POINTS
    );
  },

  canPoliceCaptureDrivingThiefWithHalfStepLeft: function (
    isThief,
    occupant,
    isDriving,
    pointsLeft,
  ) {
    return (
      !isThief &&
      isDriving &&
      occupant &&
      occupant.role === "THIEF" &&
      occupant.unit.inCar &&
      pointsLeft === DRIVE_COST_POINTS
    );
  },

  getPossibleMoves: function (node, isThief) {
    const possibleMoves = [];
    const dirs = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];

    for (const [dr, dc] of dirs) {
      possibleMoves.push({
        nr: node.r + dr,
        nc: node.c + dc,
        isTeleport: false,
      });
    }

    if (isThief && !node.isDriving && state.map[node.r][node.c] === "MANHOLE") {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (state.map[r][c] === "MANHOLE" && (r !== node.r || c !== node.c)) {
            possibleMoves.push({ nr: r, nc: c, isTeleport: true });
          }
        }
      }
    }

    return possibleMoves;
  },

  getMoveCost: function (isDriving, tileType, isTeleport) {
    if (isTeleport) return HALF_STEP_POINTS;
    if (isDriving) {
      if (tileType === "GRASS") return null;
      return DRIVE_COST_POINTS;
    }
    return TILE_TYPES[tileType].cost * HALF_STEP_POINTS;
  },

  calculateReachableForUnit: function (unit) {
    const results = new Map();
    const isThief = this.turn === "THIEF";
    const role = isThief ? "THIEF" : "POLICE";
    const queue = [
      {
        r: unit.r,
        c: unit.c,
        pointsLeft: this.getMovementPoints(),
        path: [{ r: unit.r, c: unit.c }],
        trail: [],
        costSpent: 0,
        isDriving: !!unit.inCar,
        boardedCarAt: null,
      },
    ];

    while (queue.length > 0) {
      const curr = queue.shift();

      if (curr.pointsLeft === 0) {
        const key = this.getCoordKey(curr.r, curr.c);
        if (this.chooseBetterRoute(results.get(key), curr)) {
          results.set(key, curr);
        }
        continue;
      }

      const possibleMoves = this.getPossibleMoves(curr, isThief);

      for (const move of possibleMoves) {
        const nr = move.nr;
        const nc = move.nc;

        if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
        if (curr.path.some((point) => point.r === nr && point.c === nc)) continue;

        const tileType = state.map[nr][nc];
        const tile = TILE_TYPES[tileType];
        if (!tile.walkable.includes(role)) continue;

        const cost = this.getMoveCost(curr.isDriving, tileType, move.isTeleport);
        if (cost === null || curr.pointsLeft < cost) continue;

        const occupant = this.getUnitAt(nr, nc);
        const pointsLeftAfterMove = curr.pointsLeft - cost;
        const canStopForHalfStepCapture =
          this.canPoliceCaptureDrivingThiefWithHalfStepLeft(
            isThief,
            occupant,
            curr.isDriving,
            pointsLeftAfterMove,
          );
        if (occupant) {
          if (curr.pointsLeft > cost && !canStopForHalfStepCapture) continue;
          if (isThief) continue;
          if (occupant.role === "POLICE" || unit.state === "CARRYING") continue;
        }

        let nextDriving = curr.isDriving;
        let boardedCarAt = curr.boardedCarAt;
        if (
          !nextDriving &&
          !move.isTeleport &&
          tileType === "PARKING" &&
          this.hasAvailableCar(nr, nc)
        ) {
          nextDriving = true;
          boardedCarAt = boardedCarAt || this.getCoordKey(nr, nc);
        }

        const nextNode = {
          r: nr,
          c: nc,
          pointsLeft: pointsLeftAfterMove,
          path: [...curr.path, { r: nr, c: nc }],
          trail: [...curr.trail, { r: nr, c: nc, cost }],
          costSpent: curr.costSpent + cost,
          isDriving: nextDriving,
          boardedCarAt,
        };

        const canStopForHalfStepBase = this.canThiefStopAtBaseWithHalfStepLeft(
          isThief,
          tileType,
          nextNode.isDriving,
          nextNode.pointsLeft,
        );

        if (canStopForHalfStepBase || canStopForHalfStepCapture) {
          const key = this.getCoordKey(nextNode.r, nextNode.c);
          if (this.chooseBetterRoute(results.get(key), nextNode)) {
            results.set(key, nextNode);
          }
          continue;
        }

        queue.push(nextNode);
      }
    }

    return results;
  },

  getUnitAt: function (r, c) {
    const police = this.policeUnits.find((unit) => unit.r === r && unit.c === c);
    if (police) return { role: "POLICE", unit: police };

    const thief = this.thiefUnits.find(
      (unit) => unit.r === r && unit.c === c && unit.state === "ACTIVE",
    );
    if (thief) return { role: "THIEF", unit: thief };

    return null;
  },

  getCarriedThiefByCarrier: function (carrierId) {
    return (
      this.thiefUnits.find(
        (unit) => unit.state === "CARRIED" && unit.carrierId === carrierId,
      ) || null
    );
  },

  syncCarriedThiefPosition: function (policeUnit) {
    const carriedThief = this.getCarriedThiefByCarrier(policeUnit.id);
    if (!carriedThief) return;
    carriedThief.r = policeUnit.r;
    carriedThief.c = policeUnit.c;
    carriedThief.inCar = false;
  },

  jailCarriedThief: function (policeUnit) {
    const carriedThief = this.getCarriedThiefByCarrier(policeUnit.id);
    if (!carriedThief) return;
    carriedThief.state = "JAILED";
    carriedThief.carrierId = null;
    carriedThief.r = policeUnit.r;
    carriedThief.c = policeUnit.c;
    carriedThief.inCar = false;
  },

  handleCellClick: function (r, c) {
    if (this.diceValue === 0) return;

    if (!this.selectedUnit) {
      const clickedUnit = this.getUnitAt(r, c);
      if (!clickedUnit || clickedUnit.role !== this.turn) return;

      const moves = this.calculateReachableForUnit(clickedUnit.unit);
      if (moves.size === 0) return;

      this.selectedUnit = clickedUnit.unit;
      this.reachable = moves;

      this.clearHighlights();
      document.getElementById(`game-cell-${r}-${c}`).classList.add("unit-selected");
      this.highlightReachable();
      els.gameMessage.textContent = "请点击高亮格子移动";
      return;
    }

    const key = this.getCoordKey(r, c);
    if (this.reachable.has(key)) {
      this.moveSelectedUnit(r, c);
      return;
    }

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
        document.getElementById(`game-cell-${r}-${c}`).classList.add("unit-selected");
        this.highlightReachable();
      }
    }
  },

  moveSelectedUnit: function (r, c) {
    const unit = this.selectedUnit;
    const route = this.reachable.get(this.getCoordKey(r, c));
    if (!unit || !route) return;

    if (route.boardedCarAt) {
      this.consumeParkingCar(route.boardedCarAt);
    }

    unit.r = r;
    unit.c = c;
    unit.inCar = route.isDriving;

    this.clearHighlights();
    this.selectedUnit = null;
    this.reachable.clear();

    if (this.turn === "POLICE") {
      this.syncCarriedThiefPosition(unit);

      const caughtThief = this.thiefUnits.find(
        (thief) => thief.r === r && thief.c === c && thief.state === "ACTIVE",
      );
      if (caughtThief && unit.state === "IDLE") {
        caughtThief.state = "CARRIED";
        caughtThief.carrierId = unit.id;
        caughtThief.r = r;
        caughtThief.c = c;
        unit.state = "CARRYING";

        if (caughtThief.inCar) {
          unit.inCar = true;
        }
        caughtThief.inCar = false;
      }

      if (unit.state === "CARRYING" && state.map[r][c] === "POLICE_STATION") {
        this.jailCarriedThief(unit);
        unit.state = "IDLE";
      }

      this.syncCarriedThiefPosition(unit);
    } else if (state.map[r][c] === "THIEF_BASE") {
      unit.state = "ESCAPED";
    }

    this.renderGameBoard();
    this.checkWinCondition();
  },

  checkWinCondition: function () {
    const allCaught = this.thiefUnits.every(
      (thief) => thief.state === "CARRIED" || thief.state === "JAILED",
    );
    if (this.thiefUnits.length > 0 && allCaught) {
      this.showVictory("POLICE");
      return;
    }

    const allEscaped = this.thiefUnits.every((thief) => thief.state === "ESCAPED");
    if (this.thiefUnits.length > 0 && allEscaped) {
      this.showVictory("THIEF");
      return;
    }

    const hasActive = this.thiefUnits.some((thief) => thief.state === "ACTIVE");
    if (!hasActive) {
      this.showVictory("MIXED");
      return;
    }

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
      const escaped = this.thiefUnits.filter((thief) => thief.state === "ESCAPED").length;
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
    document.querySelectorAll(".reachable").forEach((el) => el.classList.remove("reachable"));
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
    const route = this.reachable.get(this.getCoordKey(r, c));
    if (!route) return;

    let currentCostSpent = 0;
    route.trail.forEach((segment) => {
      const cell = document.getElementById(`game-cell-${segment.r}-${segment.c}`);
      if (!cell) return;

      cell.classList.add("path-hover");
      currentCostSpent += segment.cost;

      const badge = document.createElement("div");
      badge.className = "step-badge path-badge-temp";
      badge.textContent = this.formatMovementPoints(currentCostSpent);
      cell.appendChild(badge);
    });
  },

  clearPathHover: function () {
    document.querySelectorAll(".path-hover").forEach((el) => el.classList.remove("path-hover"));
    document.querySelectorAll(".path-badge-temp").forEach((el) => el.remove());
  },
};
