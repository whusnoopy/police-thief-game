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
import { applyResolvedAction } from "../domain/rules/interactionResolver.js";
import { getNextTurn, getWinState } from "../domain/rules/winResolver.js";
import {
  projectPathPreview,
  projectReachablePositions,
  projectSelectableUnitPositions,
} from "./gameBoardProjection.js";
import { renderBoard } from "../ui/board/boardRenderer.js";
import {
  clearBoardHighlights,
  clearPathPreview,
  highlightReachableCells,
  highlightSelectableCells,
  highlightSelectedCell,
  renderPathPreview,
} from "../ui/game/highlightRenderer.js";
import { appendParkedCar, renderUnits } from "../ui/game/unitRenderer.js";
import {
  getRandomDiceFace,
  renderAwaitDestinationSelection,
  renderAwaitUnitSelection,
  renderDiceResult,
  renderDiceRolling,
  renderNoMovesAvailable,
  renderRollingDiceFace,
  renderTurnStart,
  renderVictory,
} from "../ui/game/statusRenderer.js";

const GAME_CELL_ID_PREFIX = "game-cell";

export const gameController = {
  session: null,
  turn: "THIEF",
  diceValue: 0,
  isRolling: false,
  policeUnits: [],
  thiefUnits: [],
  parkingCars: new Set(),
  parkedCars: new Set(),
  selectedUnit: null,
  reachable: new Map(),

  init(mapDefinition = state.mapDefinition) {
    this.session = createGameSession(mapDefinition);
    this.turn = this.session.turn;
    this.diceValue = this.session.diceValue;
    this.selectedUnit = null;
    this.reachable.clear();
    this.policeUnits = this.session.policeUnits;
    this.thiefUnits = this.session.thiefUnits;
    this.parkingCars = this.session.parkingCars;
    this.parkedCars = this.session.parkedCars;

    this.setupUI();
    this.renderGameBoard();
    this.updateTurnUI();
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
    ["btnRollDice", "btnSkipTurn"].forEach((key) => {
      const oldElement = els[key];
      const newElement = oldElement.cloneNode(true);
      oldElement.parentNode.replaceChild(newElement, oldElement);
      els[key] = newElement;
    });

    els.btnRollDice.addEventListener("click", () => this.rollDice());
    els.btnSkipTurn.addEventListener("click", () => this.skipTurn());
  },

  renderGameBoard() {
    renderBoard(els.gameBoard, {
      mapDefinition: this.session?.mapDefinition || state.mapDefinition,
      cellIdPrefix: GAME_CELL_ID_PREFIX,
      decorateCell: (cell, { r, c }) => {
        if (!this.hasParkedCar(r, c)) return;
        appendParkedCar(cell);
      },
      bindCell: (cell, { r, c }) => {
        cell.addEventListener("mouseenter", () => this.handleCellHover(r, c));
        cell.addEventListener("mouseleave", () => this.clearPathHover());
        cell.addEventListener("click", () => this.handleCellClick(r, c));
      },
    });

    renderUnits({
      cellIdPrefix: GAME_CELL_ID_PREFIX,
      policeUnits: this.policeUnits,
      thiefUnits: this.thiefUnits,
    });
  },

  updateTurnUI() {
    renderTurnStart(this.turn);
    this.diceValue = 0;
    if (this.session) {
      this.session.diceValue = 0;
      this.session.turn = this.turn;
    }
    this.selectedUnit = null;
    this.reachable.clear();
    this.clearHighlights();
  },

  rollDice() {
    if (this.isRolling) return;

    this.isRolling = true;
    renderDiceRolling();

    let rolls = 0;
    const interval = setInterval(() => {
      renderRollingDiceFace(getRandomDiceFace());
      rolls += 1;

      if (rolls <= 15) return;

      clearInterval(interval);
      this.isRolling = false;

      this.diceValue = Math.floor(Math.random() * 6) + 1;
      if (this.session) {
        this.session.diceValue = this.diceValue;
      }
      renderDiceResult(this.diceValue);

      this.onDiceRolled();
    }, 50);
  },

  getMovementPoints() {
    return getRuleMovementPoints(this.diceValue);
  },

  formatMovementPoints(points) {
    return formatRuleMovementPoints(points);
  },

  getActiveUnitsForTurn() {
    return getTurnUnits(this.session, this.turn);
  },

  onDiceRolled() {
    const activeUnits = this.getActiveUnitsForTurn();
    let hasMoves = false;

    for (const unit of activeUnits) {
      const moves = this.calculateReachableForUnit(unit);
      if (moves.size === 0) continue;
      hasMoves = true;
      break;
    }

    if (!hasMoves) {
      renderNoMovesAvailable();
      return;
    }

    renderAwaitUnitSelection(this.diceValue);
    this.highlightSelectableUnits(activeUnits);
  },

  highlightSelectableUnits(units) {
    highlightSelectableCells(
      GAME_CELL_ID_PREFIX,
      projectSelectableUnitPositions(units, (unit) => this.calculateReachableForUnit(unit)),
    );
  },

  calculateReachableForUnit(unit) {
    if (!this.session) return new Map();

    return calculateReachableActions({
      session: this.session,
      turn: this.turn,
      diceValue: this.diceValue,
      unit,
    });
  },

  getUnitAt(r, c) {
    return getSessionUnitAt(this.session, r, c);
  },

  handleCellClick(r, c) {
    if (this.diceValue === 0) return;

    if (!this.selectedUnit) {
      const clickedUnit = this.getUnitAt(r, c);
      if (!clickedUnit || clickedUnit.role !== this.turn) return;

      const moves = this.calculateReachableForUnit(clickedUnit.unit);
      if (moves.size === 0) return;

      this.selectedUnit = clickedUnit.unit;
      this.reachable = moves;

      this.clearHighlights();
      highlightSelectedCell(GAME_CELL_ID_PREFIX, { r, c });
      this.highlightReachable();
      renderAwaitDestinationSelection();
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
      if (moves.size === 0) return;

      this.selectedUnit = clickedUnit.unit;
      this.reachable = moves;
      this.clearHighlights();
      highlightSelectedCell(GAME_CELL_ID_PREFIX, { r, c });
      this.highlightReachable();
    }
  },

  moveSelectedUnit(r, c) {
    const unit = this.selectedUnit;
    const action = this.reachable.get(this.getCoordKey(r, c));
    if (!unit || !action || !this.session) return;

    this.clearHighlights();
    this.selectedUnit = null;
    this.reachable.clear();

    applyResolvedAction({
      session: this.session,
      turn: this.turn,
      unit,
      action,
    });

    this.renderGameBoard();
    this.checkWinCondition();
  },

  checkWinCondition() {
    const winState = getWinState(this.session);
    if (winState) {
      this.showVictory(winState.type);
      return;
    }

    this.turn = getNextTurn(this.turn);
    if (this.session) {
      this.session.turn = this.turn;
    }
    this.updateTurnUI();
  },

  showVictory(type) {
    const escaped = this.thiefUnits.filter((thief) => thief.state === "ESCAPED").length;
    const caught = this.thiefUnits.length - escaped;
    renderVictory({ type, escaped, caught });
  },

  skipTurn() {
    this.turn = getNextTurn(this.turn);
    if (this.session) {
      this.session.turn = this.turn;
    }
    this.updateTurnUI();
  },

  clearHighlights() {
    clearBoardHighlights(els.gameBoard);
  },

  highlightReachable() {
    highlightReachableCells(GAME_CELL_ID_PREFIX, projectReachablePositions(this.reachable));
  },

  handleCellHover(r, c) {
    if (this.diceValue === 0 || !this.selectedUnit) return;

    this.clearPathHover();
    const action = this.reachable.get(this.getCoordKey(r, c));
    if (!action) return;

    renderPathPreview(
      GAME_CELL_ID_PREFIX,
      projectPathPreview(action, (points) => this.formatMovementPoints(points)),
    );
  },

  clearPathHover() {
    clearPathPreview(els.gameBoard);
  },
};
