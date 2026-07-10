import { cloneMapDefinition, createEmptyMapDefinition } from "../domain/map/mapModel.js";

const initialMapDefinition = createEmptyMapDefinition();

export const state = {
  mapDefinition: initialMapDefinition,
  mode: "EDITOR",
  currentPaletteType: "GRASS",
};

export function setMapDefinition(mapDefinition) {
  state.mapDefinition = cloneMapDefinition(mapDefinition);
  return state.mapDefinition;
}

export const els = {
  editorView: document.getElementById("editor-view"),
  gameView: document.getElementById("game-view"),
  mapListView: document.getElementById("map-list-view"),
  editorBoard: document.getElementById("editor-board"),
  gameBoard: document.getElementById("game-board"),
  palette: document.getElementById("palette"),
  modeIndicator: document.getElementById("mode-indicator"),
  btnClearMap: document.getElementById("btn-clear-map"),
  btnStartGame: document.getElementById("btn-start-game"),
  editorHelpWrapper: document.getElementById("editor-help-wrapper"),
  btnEditorHelp: document.getElementById("btn-editor-help"),
  editorHelpTooltip: document.getElementById("editor-help-tooltip"),
  btnBackEditor: document.getElementById("btn-back-editor"),
  turnIndicator: document.getElementById("turn-indicator"),
  signalIndicator: document.getElementById("signal-indicator"),
  policeStat: document.getElementById("police-stat"),
  thiefStat: document.getElementById("thief-stat"),
  diceEl: document.getElementById("dice"),
  diceValueEl: document.getElementById("dice-value"),
  gameMessage: document.getElementById("game-message"),
  btnRollDice: document.getElementById("btn-roll-dice"),
  btnSkipTurn: document.getElementById("btn-skip-turn"),
  btnViewRules: document.getElementById("btn-view-rules"),
  rulesModal: document.getElementById("rules-modal"),
  btnCloseRulesModal: document.getElementById("btn-close-rules-modal"),
  btnCloseRulesModalFooter: document.getElementById("btn-close-rules-modal-footer"),
  victoryModal: document.getElementById("victory-modal"),
  victoryTitle: document.getElementById("victory-title"),
  victoryMessage: document.getElementById("victory-message"),
  btnPlayAgain: document.getElementById("btn-play-again"),
  btnModalEditor: document.getElementById("btn-modal-editor"),
  btnMapList: document.getElementById("btn-map-list"),
  btnBackFromList: document.getElementById("btn-back-from-list"),
  btnCreateMap: document.getElementById("btn-create-map"),
  mapListGrid: document.getElementById("map-list-grid"),
  mapListEmpty: document.getElementById("map-list-empty"),
  shareLinkModal: document.getElementById("share-link-modal"),
  shareLinkMessage: document.getElementById("share-link-message"),
  shareLinkInput: document.getElementById("share-link-input"),
  btnCopyShareLink: document.getElementById("btn-copy-share-link"),
  btnCloseShareLinkModal: document.getElementById("btn-close-share-link-modal"),
};
