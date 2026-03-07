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
  btnShareMap: document.getElementById("btn-share-map"),
  btnClearMap: document.getElementById("btn-clear-map"),
  btnStartGame: document.getElementById("btn-start-game"),
  btnBackEditor: document.getElementById("btn-back-editor"),
  turnIndicator: document.getElementById("turn-indicator"),
  policeStat: document.getElementById("police-stat"),
  thiefStat: document.getElementById("thief-stat"),
  diceEl: document.getElementById("dice"),
  diceValueEl: document.getElementById("dice-value"),
  gameMessage: document.getElementById("game-message"),
  btnRollDice: document.getElementById("btn-roll-dice"),
  btnSkipTurn: document.getElementById("btn-skip-turn"),
  victoryModal: document.getElementById("victory-modal"),
  victoryTitle: document.getElementById("victory-title"),
  victoryMessage: document.getElementById("victory-message"),
  btnPlayAgain: document.getElementById("btn-play-again"),
  btnModalEditor: document.getElementById("btn-modal-editor"),
  mapListView: document.getElementById("map-list-view"),
  btnMapList: document.getElementById("btn-map-list"),
  btnBackFromList: document.getElementById("btn-back-from-list"),
  btnCreateMap: document.getElementById("btn-create-map"),
  mapListGrid: document.getElementById("map-list-grid"),
  mapListEmpty: document.getElementById("map-list-empty"),
};
