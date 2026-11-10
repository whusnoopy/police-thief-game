import { getMapDimensions } from "../domain/map/mapDimensions.js";
import { els, state } from "../app/state.js";
import { createGameSession } from "../domain/game/sessionFactory.js";
import {
  getActiveUnitsForTurn as getTurnUnits,
  getUnitAt as getSessionUnitAt,
} from "../domain/game/sessionSelectors.js";
import {
  calculateReachableActions,
  formatMovementPoints as formatRuleMovementPoints,
  getMovementPoints as getRuleMovementPoints,
} from "../domain/rules/moveGenerator.js";
import { resolveEndOfRoundEffects } from "../domain/rules/endOfRoundEffects.js";
import { applyResolvedAction } from "../domain/rules/interactionResolver.js";
import { getNextTurn, getWinState } from "../domain/rules/winResolver.js";
import { isPermanentStalemate } from "../domain/rules/stalemateResolver.js";
import { usesContinuousActions } from "../domain/map/mapCompatibility.js";
import { getUnitOperations } from "../domain/rules/unitOperations.js";
import { describeAction } from "./actionSummary.js";
import { startReachabilityJob } from "./reachabilityJob.js";
import {
  projectPathPreview,
  projectReachablePositions,
} from "./gameBoardProjection.js";
import { createGameBoardView } from "../ui/game/gameBoardView.js";
import { renderGameLayout } from "../ui/game/gameLayout.js";
import { getTrailFacing } from "../ui/isometric/assetMetadata.js";
import {
  getRandomDiceFace,
  renderAwaitDestinationSelection,
  renderAwaitUnitSelection,
  renderDiceResult,
  renderDiceRolling,
  renderCalculatingMoves,
  renderNoMovesAvailable,
  renderRollingDiceFace,
  renderTurnStart,
  renderVictory,
  renderUnitCounts,
  renderMovePreview,
  hideMovePreview,
  renderActionResult,
  resetActionResults,
  renderTurnBudget,
} from "../ui/game/statusRenderer.js";

export const GAME_PHASES = {
  AWAIT_ROLL: "AWAIT_ROLL",
  ROLLING: "ROLLING",
  CALCULATING: "CALCULATING",
  SELECT_UNIT: "SELECT_UNIT",
  SELECT_DESTINATION: "SELECT_DESTINATION",
  NO_MOVES: "NO_MOVES",
  FINISHED: "FINISHED",
};

export const gameController = {
  session: null,
  fallbackTurn: "THIEF",
  fallbackDiceValue: 0,
  isRolling: false,
  rollIntervalId: null,
  phase: GAME_PHASES.AWAIT_ROLL,
  selectedUnit: null,
  reachable: new Map(),
  reachabilityCache: new Map(),
  cacheContext: null,
  pendingDestination: null,
  searchJob: null,
  createSearchJob: startReachabilityJob,
  boardView: null,
  boardMode: "isometric",
  boardViewState: { zoom: 1, left: 0, top: 0 },
  pathDestination: null,
  unitDirections: new Map(),
  vehicleDirections: new Map(),

  get turn() {
    return this.session?.turn || this.fallbackTurn;
  },

  set turn(turn) {
    this.fallbackTurn = turn;
    if (this.session) this.session.turn = turn;
  },

  get diceValue() {
    return this.session?.diceValue ?? this.fallbackDiceValue;
  },

  set diceValue(diceValue) {
    this.fallbackDiceValue = diceValue;
    if (this.session) this.session.diceValue = diceValue;
  },

  get policeUnits() {
    return this.session?.policeUnits || [];
  },

  get thiefUnits() {
    return this.session?.thiefUnits || [];
  },

  get animalUnits() {
    return this.session?.animalUnits || [];
  },

  get parkingCars() {
    return this.session?.parkingCars || new Set();
  },

  get parkedCars() {
    return this.session?.parkedCars || new Set();
  },

  init(mapDefinition = state.mapDefinition) {
    this.cancelPendingRoll();
    this.cancelPendingSearch();
    this.boardView?.dispose(); this.boardView = null;
    this.boardViewState = { zoom: 1, left: 0, top: 0 };
    this.session = createGameSession(mapDefinition);
    this.unitDirections = new Map();
    this.vehicleDirections = new Map();
    this.turn = this.session.turn;
    this.diceValue = this.session.diceValue;
    this.selectedUnit = null;
    this.reachable = new Map();
    this.invalidateReachability();
    this.pendingDestination = null;
    this.pathDestination = null;
    resetActionResults();
    this.phase = GAME_PHASES.AWAIT_ROLL;

    this.setupUI();
    this.renderGameBoard();
    this.updateTurnUI();
  },

  cancelPendingRoll() {
    if (this.rollIntervalId !== null) {
      clearInterval(this.rollIntervalId);
      this.rollIntervalId = null;
    }
    this.isRolling = false;
  },

  dispose() {
    this.cancelPendingRoll();
    this.cancelPendingSearch();
    this.phase = GAME_PHASES.FINISHED;
    this.diceValue = 0;
    if (this.session) this.session.remainingPoints = null;
    this.selectedUnit = null;
    this.reachable = new Map();
    this.invalidateReachability();
    this.cancelMovePreview();
    els.btnCancelSelection.classList.add("hidden");
    this.boardView?.dispose();
    this.boardView = null;
    renderGameLayout(false);
  },

  getCoordKey(r, c) {
    return `${r},${c}`;
  },

  hasAvailableCar(r, c) {
    return this.parkingCars.has(this.getCoordKey(r, c));
  },

  hasParkedCar(r, c) {
    return this.parkedCars.has(this.getCoordKey(r, c));
  },

  setupUI() {
    ["btnRollDice", "btnSkipTurn", "btnConfirmMove", "btnCancelMove", "btnCancelSelection", "btnEndTurn"].forEach((key) => {
      const oldElement = els[key];
      const newElement = oldElement.cloneNode(true);
      oldElement.parentNode.replaceChild(newElement, oldElement);
      els[key] = newElement;
    });

    els.btnRollDice.addEventListener("click", () => this.rollDice());
    els.btnSkipTurn.addEventListener("click", () => this.skipTurn());
    els.btnConfirmMove.addEventListener("click", () => this.confirmMove());
    els.btnCancelMove.addEventListener("click", () => this.cancelMovePreview());
    els.btnCancelSelection.addEventListener("click", () => this.cancelUnitSelection());
    els.btnEndTurn.addEventListener("click", () => this.endTurn());
    // Assignment keeps one handler when a new game is started.
    if (els.btnViewTopdown) els.btnViewTopdown.onclick = () => this.setBoardMode("topdown");
    if (els.btnViewIsometric) els.btnViewIsometric.onclick = () => this.setBoardMode("isometric");
    if (els.btnBoardZoomIn) els.btnBoardZoomIn.onclick = () => this.setBoardZoom(this.boardViewState.zoom + 0.25);
    if (els.btnBoardZoomOut) els.btnBoardZoomOut.onclick = () => this.setBoardZoom(this.boardViewState.zoom - 0.25);
    if (els.btnBoardFit) els.btnBoardFit.onclick = () => this.setBoardZoom(1);
    if (els.btnBoardFocus) els.btnBoardFocus.onclick = () => {
      const unit = this.selectedUnit || this.getActiveUnitsForTurn()[0];
      if (unit) { this.boardView?.focusCell?.(unit); this.updateBoardControls(); }
    };
  },

  renderGameBoard() {
    document.body.classList.toggle("continuous-actions", this.isContinuous());
    this.boardView?.dispose();
    renderGameLayout(this.boardMode === "isometric");
    this.boardView = createGameBoardView(els.gameBoard, {
      mode: this.boardMode,
      viewState: this.boardViewState,
      unitDirections: this.unitDirections,
      vehicleDirections: this.vehicleDirections,
      onCellClick: (r, c, options) => this.handleCellClick(r, c, options),
      onCellHover: (r, c) => this.handleCellHover(r, c),
      onLeave: () => this.clearPathHover(),
    });
    this.boardView.render(this.session);
    this.updateBoardControls();
    renderUnitCounts(this.session);
  },

  setBoardMode(mode) {
    if (!["topdown", "isometric"].includes(mode) || mode === this.boardMode || !this.session) return;
    this.boardMode = mode;
    this.renderGameBoard();
    if ([GAME_PHASES.SELECT_UNIT, GAME_PHASES.SELECT_DESTINATION].includes(this.phase)) {
      this.highlightSelectableUnits(this.getActiveUnitsForTurn());
    }
    if (this.selectedUnit) {
      this.boardView.setSelected(this.selectedUnit);
      this.highlightReachable();
      if (this.pathDestination) this.previewAction(this.pathDestination.r, this.pathDestination.c, !!this.pendingDestination);
    }
  },

  setBoardZoom(zoom) {
    if (this.boardMode !== "isometric") return;
    this.boardView?.setZoom(zoom);
    this.updateBoardControls();
  },

  updateBoardControls() {
    const iso = this.boardMode === "isometric";
    els.btnViewTopdown?.setAttribute("aria-pressed", String(!iso));
    els.btnViewIsometric?.setAttribute("aria-pressed", String(iso));
    els.boardZoomControls?.classList.toggle("hidden", !iso);
    if (els.boardZoomValue) els.boardZoomValue.textContent = `${Math.round(this.boardViewState.zoom * 100)}%`;
    if (els.btnBoardZoomIn) els.btnBoardZoomIn.disabled = this.boardViewState.zoom >= (getMapDimensions(this.session.mapDefinition).rows > 10 ? 5 : 2.5);
    if (els.btnBoardZoomOut) els.btnBoardZoomOut.disabled = this.boardViewState.zoom <= 1;
  },

  updateTurnUI() {
    this.phase = GAME_PHASES.AWAIT_ROLL;
    renderTurnStart(this.turn, this.session?.signalPhase);
    this.diceValue = 0;
    if (this.session) this.session.remainingPoints = null;
    if (this.session) this.session.actingUnitId = null;
    this.selectedUnit = null;
    this.reachable = new Map();
    this.invalidateReachability();
    this.pendingDestination = null;
    this.pathDestination = null;
    hideMovePreview();
    this.clearHighlights();
    this.refreshTurnControls();
  },

  rollDice() {
    if (this.phase !== GAME_PHASES.AWAIT_ROLL || this.isRolling) return;

    this.isRolling = true;
    this.phase = GAME_PHASES.ROLLING;
    renderDiceRolling();

    let rolls = 0;
    this.rollIntervalId = setInterval(() => {
      renderRollingDiceFace(getRandomDiceFace());
      rolls += 1;

      if (rolls <= 15) return;

      clearInterval(this.rollIntervalId);
      this.rollIntervalId = null;
      this.isRolling = false;

      this.diceValue = Math.floor(Math.random() * 6) + 1;
      renderDiceResult(this.diceValue);

      this.onDiceRolled();
    }, 50);
  },

  getMovementPoints() {
    return this.session?.remainingPoints ?? getRuleMovementPoints(this.diceValue);
  },

  getSearchContext() {
    return { session: this.session, turn: this.turn, diceValue: this.diceValue,
      movementPoints: this.getMovementPoints(), revision: this.session?.revision || 0 };
  },

  isSearchContextCurrent(context) {
    return !!context && context.session === this.session && context.turn === this.turn &&
      context.diceValue === this.diceValue && context.movementPoints === this.getMovementPoints() &&
      context.revision === (this.session?.revision || 0);
  },

  formatMovementPoints(points) {
    return formatRuleMovementPoints(points);
  },

  getActiveUnitsForTurn() {
    const units = getTurnUnits(this.session, this.turn);
    return this.isContinuous() && this.session.actingUnitId ? units.filter(unit => unit.id === this.session.actingUnitId) : units;
  },

  isContinuous() { return usesContinuousActions(this.session?.mapDefinition); },

  operationsFor(unit) {
    return getUnitOperations({ session: this.session, turn: this.turn, unit, movementPoints: this.getMovementPoints() });
  },

  refreshTurnControls() {
    const active = this.diceValue > 0 && ![GAME_PHASES.AWAIT_ROLL, GAME_PHASES.ROLLING, GAME_PHASES.NO_MOVES, GAME_PHASES.FINISHED].includes(this.phase);
    renderTurnBudget({ continuous: this.isContinuous(), active, points: this.getMovementPoints(),
      unitId: this.session?.actingUnitId, formatPoints: formatRuleMovementPoints,
      operations: this.phase === GAME_PHASES.SELECT_DESTINATION ? this.operationsFor(this.selectedUnit) : [],
      onOperation: type => this.performOperation(type) });
  },

  onDiceRolled() {
    if (this.isContinuous() && this.session.remainingPoints === null) this.session.remainingPoints = getRuleMovementPoints(this.diceValue);
    this.cancelPendingSearch();
    const activeUnits = this.getActiveUnitsForTurn();
    const context = this.getSearchContext();
    const job = this.createSearchJob({ ...context, units: activeUnits });
    if (!job) return this.finishDiceSelection(activeUnits);
    this.searchJob = job;
    this.phase = GAME_PHASES.CALCULATING;
    renderCalculatingMoves();
    this.refreshTurnControls();
    return job.promise.then((results) => {
      if (this.searchJob !== job) return;
      this.searchJob = null;
      if (!this.isSearchContextCurrent(context)) return;
      this.invalidateReachability();
      this.cacheContext = context;
      if (results) {
        for (const unit of activeUnits) {
          const moves = results.get(unit.id);
          if (moves instanceof Map) this.reachabilityCache.set(unit, moves);
        }
      }
      this.finishDiceSelection(activeUnits);
    });
  },

  cancelPendingSearch() {
    this.searchJob?.cancel();
    this.searchJob = null;
  },

  finishDiceSelection(activeUnits) {
    let hasMoves = false;

    for (const unit of activeUnits) {
      const moves = this.calculateReachableForUnit(unit);
      if (moves.size === 0 && !this.operationsFor(unit).some(op => op.enabled)) continue;
      hasMoves = true;
      break;
    }

    if (!hasMoves) {
      if (this.isContinuous() && this.session.actingUnitId) {
        renderActionResult(`剩余 ${this.formatMovementPoints(this.getMovementPoints())} 点无法支付合法行动，本回合结束。`);
        this.advanceTurn();
        return;
      }
      this.phase = GAME_PHASES.NO_MOVES;
      renderNoMovesAvailable();
      this.refreshTurnControls();
      return;
    }

    if (this.isContinuous() && this.session.actingUnitId) {
      this.selectedUnit = activeUnits[0];
      this.reachable = this.calculateReachableForUnit(this.selectedUnit);
      this.phase = GAME_PHASES.SELECT_DESTINATION;
      this.boardView?.setSelected(this.selectedUnit);
      this.highlightSelectableUnits(activeUnits); this.highlightReachable();
      renderAwaitDestinationSelection();
      els.gameMessage.textContent = "继续移动或选择操作；也可结束回合。触屏落点需确认。";
      this.refreshTurnControls();
      return;
    }

    this.phase = GAME_PHASES.SELECT_UNIT;
    renderAwaitUnitSelection(this.diceValue);
    this.highlightSelectableUnits(activeUnits);
    this.refreshTurnControls();
  },

  highlightSelectableUnits(units) {
    this.boardView?.setSelectable(
      units.filter(unit => this.calculateReachableForUnit(unit).size > 0 || this.operationsFor(unit).some(op => op.enabled)).map(unit => ({ r: unit.r, c: unit.c })),
    );
  },

  calculateReachableForUnit(unit) {
    if (!this.session) return new Map();
    const context = this.cacheContext;
    if (!this.isSearchContextCurrent(context)) {
      this.invalidateReachability();
      this.cacheContext = this.getSearchContext();
    }
    if (!this.reachabilityCache.has(unit)) {
      this.reachabilityCache.set(unit, this.computeReachableForUnit(unit));
    }
    return this.reachabilityCache.get(unit);
  },

  invalidateReachability() {
    this.reachabilityCache.clear();
    this.cacheContext = null;
  },

  computeReachableForUnit(unit) {
    return calculateReachableActions({
      session: this.session,
      turn: this.turn,
      diceValue: this.diceValue,
      movementPoints: this.getMovementPoints(),
      unit,
    });
  },

  getUnitAt(r, c) {
    return getSessionUnitAt(this.session, r, c);
  },

  handleCellClick(r, c, { previewOnly = false } = {}) {
    if (
      this.diceValue === 0 ||
      ![GAME_PHASES.SELECT_UNIT, GAME_PHASES.SELECT_DESTINATION].includes(this.phase)
    ) {
      return;
    }

    // A friendly actor remains a selection target while choosing a destination.
    const clickedUnit = this.getUnitAt(r, c);
    if (clickedUnit?.role === this.turn) {
      if (this.isContinuous() && this.session.actingUnitId) {
        if (clickedUnit.unit.id !== this.session.actingUnitId) return;
        this.cancelMovePreview();
        return;
      }
      if (clickedUnit.unit === this.selectedUnit) {
        this.cancelUnitSelection();
        return;
      }
      const moves = this.calculateReachableForUnit(clickedUnit.unit);
      if (moves.size === 0 && !this.operationsFor(clickedUnit.unit).some(op => op.enabled)) return;

      this.cancelMovePreview();
      this.selectedUnit = clickedUnit.unit;
      this.reachable = moves;
      this.phase = GAME_PHASES.SELECT_DESTINATION;

      this.clearHighlights();
      this.highlightSelectableUnits(this.getActiveUnitsForTurn());
      this.boardView?.setSelected({ r, c });
      this.highlightReachable();
      renderAwaitDestinationSelection();
      this.refreshTurnControls();
      return;
    }

    if (!this.selectedUnit) return;
    const key = this.getCoordKey(r, c);
    if (this.reachable.has(key)) {
      if (previewOnly) {
        this.pendingDestination = { r, c };
        this.previewAction(r, c, true);
      } else {
        this.moveSelectedUnit(r, c);
      }
      return;
    }
  },

  cancelUnitSelection() {
    if (this.isContinuous() && this.session.actingUnitId) { this.cancelMovePreview(); return; }
    if (this.phase !== GAME_PHASES.SELECT_DESTINATION || !this.selectedUnit) return;
    this.cancelMovePreview();
    this.selectedUnit = null;
    this.reachable = new Map();
    this.phase = GAME_PHASES.SELECT_UNIT;
    this.clearHighlights();
    this.highlightSelectableUnits(this.getActiveUnitsForTurn());
    renderAwaitUnitSelection(this.diceValue);
    this.refreshTurnControls();
  },

  moveSelectedUnit(r, c) {
    const action = this.reachable.get(this.getCoordKey(r, c));
    return this.executeAction(action);
  },

  performOperation(type) {
    const action = this.operationsFor(this.selectedUnit).find(op => op.type === type && op.enabled);
    return this.executeAction(action);
  },

  executeAction(action) {
    const unit = this.selectedUnit;
    if (!unit || !action || !this.session) return;
    if (this.phase !== GAME_PHASES.SELECT_DESTINATION) return;
    if (this.isContinuous() && (action.costSpent > this.getMovementPoints() ||
        (this.session.actingUnitId && unit.id !== this.session.actingUnitId))) return;

    const summary = describeAction({ session: this.session, turn: this.turn, unit, action, diceValue: this.diceValue, movementPoints: this.getMovementPoints() });
    const direction = getTrailFacing(action, unit, this.unitDirections.get(unit.id));
    const previousCars = new Set(this.session.parkedCars);
    this.phase = GAME_PHASES.CALCULATING;
    this.cancelPendingSearch();
    if (this.isContinuous()) {
      this.session.actingUnitId ||= unit.id;
      this.session.remainingPoints -= action.costSpent;
    }

    this.clearHighlights();
    this.selectedUnit = null;
    this.reachable = new Map();
    this.invalidateReachability();
    this.pendingDestination = null;
    this.pathDestination = null;
    hideMovePreview();

    applyResolvedAction({
      session: this.session,
      turn: this.turn,
      unit,
      action,
    });
    this.unitDirections.set(unit.id, direction);
    for (const key of previousCars) if (!this.session.parkedCars.has(key)) this.vehicleDirections.delete(key);
    for (const key of this.session.parkedCars) if (!previousCars.has(key)) this.vehicleDirections.set(key, direction);

    renderActionResult(summary);

    this.renderGameBoard();
    return this.checkWinCondition();
  },

  checkWinCondition() {
    const winState = getWinState(this.session);
    if (winState) {
      this.showVictory(winState.type);
      return;
    }

    if (this.isContinuous() && this.session.remainingPoints > 0 && this.getActiveUnitsForTurn().length) return this.onDiceRolled();
    this.advanceTurn();
  },

  showVictory(type) {
    this.cancelPendingRoll();
    this.phase = GAME_PHASES.FINISHED;
    this.cancelMovePreview();
    const escaped = this.thiefUnits.filter((thief) => thief.state === "ESCAPED").length;
    const caught = this.thiefUnits.length - escaped;
    renderVictory({ type, escaped, caught });
    this.refreshTurnControls();
  },

  endTurn() {
    if (this.phase === GAME_PHASES.NO_MOVES) return this.skipTurn();
    if (!this.isContinuous() || !this.diceValue || [GAME_PHASES.AWAIT_ROLL, GAME_PHASES.ROLLING, GAME_PHASES.FINISHED].includes(this.phase)) return;
    renderActionResult(`${this.turn === "THIEF" ? "小偷" : "警察"}主动结束回合，放弃 ${this.formatMovementPoints(this.getMovementPoints())} 点。`);
    if (!this.session?.actingUnitId && isPermanentStalemate(this.session)) {
      this.showVictory("DRAW");
      return;
    }
    this.advanceTurn();
  },

  skipTurn() {
    if (this.phase !== GAME_PHASES.NO_MOVES) return;
    renderActionResult(`${this.turn === "THIEF" ? "小偷" : "警察"}本轮无路可走，跳过行动。`);
    if (isPermanentStalemate(this.session)) {
      this.showVictory("DRAW");
      return;
    }
    this.advanceTurn();
  },

  advanceTurn() {
    this.cancelPendingRoll();
    this.cancelPendingSearch();
    this.invalidateReachability();
    const nextTurn = getNextTurn(this.turn);
    let boardChanged = false;
    if (this.session && this.turn === "POLICE") {
      boardChanged = resolveEndOfRoundEffects(this.session).boardChanged;
    }
    this.turn = nextTurn;
    if (boardChanged) {
      this.renderGameBoard();
    }
    this.updateTurnUI();
  },

  clearHighlights() {
    this.boardView?.clearHighlights();
  },

  highlightReachable() {
    this.boardView?.setReachable(projectReachablePositions(this.reachable));
  },

  handleCellHover(r, c) {
    if (this.diceValue === 0 || !this.selectedUnit || this.pendingDestination) return;
    this.previewAction(r, c);
  },

  previewAction(r, c, needsConfirmation = false) {
    this.boardView?.clearPath();
    this.pathDestination = null;
    const action = this.reachable.get(this.getCoordKey(r, c));
    if (!action) { hideMovePreview(); return; }

    this.pathDestination = { r, c };
    this.boardView?.setPath(
      projectPathPreview(action, (points) => this.formatMovementPoints(points)),
    );
    renderMovePreview(describeAction({ session: this.session, turn: this.turn, unit: this.selectedUnit, action, diceValue: this.diceValue, movementPoints: this.getMovementPoints() }), needsConfirmation);
    if (needsConfirmation && this.boardMode === "isometric") {
      els.moveConfirmActions.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
  },

  confirmMove() {
    if (this.phase !== GAME_PHASES.SELECT_DESTINATION || !this.pendingDestination) return;
    const { r, c } = this.pendingDestination;
    this.moveSelectedUnit(r, c);
  },

  cancelMovePreview() {
    this.pendingDestination = null;
    this.pathDestination = null;
    this.boardView?.clearPath();
    hideMovePreview();
  },

  clearPathHover() {
    if (this.pendingDestination) return;
    this.pathDestination = null;
    this.boardView?.clearPath();
    hideMovePreview();
  },
};
