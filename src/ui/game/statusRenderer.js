import { els } from "../../app/state.js";

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function setTurnIndicator(turn) {
  const isThief = turn === "THIEF";
  els.turnIndicator.textContent = isThief ? "🏃 小偷回合" : "🚓 警察回合";
  els.policeStat.classList.toggle("active", !isThief);
  els.thiefStat.classList.toggle("active", isThief);
}

function setActionButtons({ rollHidden = false, rollDisabled = false, skipHidden = true } = {}) {
  els.btnRollDice.disabled = rollDisabled;
  els.btnRollDice.classList.toggle("hidden", rollHidden);
  els.btnSkipTurn.classList.toggle("hidden", skipHidden);
}

export function getRandomDiceFace() {
  return DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
}

export function renderTurnStart(turn) {
  setTurnIndicator(turn);
  els.diceEl.classList.remove("rolling");
  els.diceEl.textContent = "🎲";
  els.diceValueEl.textContent = "?";
  els.gameMessage.textContent = "点击骰子投掷";
  setActionButtons({ rollHidden: false, rollDisabled: false, skipHidden: true });
}

export function renderDiceRolling() {
  els.btnRollDice.disabled = true;
  els.diceEl.classList.add("rolling");
  els.gameMessage.textContent = "掷骰子中...";
}

export function renderRollingDiceFace(face) {
  els.diceEl.textContent = face;
}

export function renderDiceResult(diceValue) {
  els.diceEl.classList.remove("rolling");
  els.diceEl.textContent = DICE_FACES[diceValue - 1];
  els.diceValueEl.textContent = String(diceValue);
}

export function renderNoMovesAvailable() {
  els.gameMessage.textContent = "无路可走！所有角色均无法行动。";
  setActionButtons({ rollHidden: true, rollDisabled: true, skipHidden: false });
}

export function renderAwaitUnitSelection(diceValue) {
  els.gameMessage.textContent = `点数 ${diceValue}！请点击己方角色移动`;
  setActionButtons({ rollHidden: true, rollDisabled: true, skipHidden: true });
}

export function renderAwaitDestinationSelection() {
  els.gameMessage.textContent = "请点击高亮格子移动";
}

export function renderVictory({ type, escaped = 0, caught = 0 }) {
  els.victoryModal.classList.remove("hidden");

  if (type === "POLICE") {
    els.victoryTitle.textContent = "🚓 警察胜利！";
    els.victoryTitle.style.color = "var(--primary-color)";
    els.victoryMessage.textContent = "所有小偷都被抓捕归案！";
    return;
  }

  if (type === "THIEF") {
    els.victoryTitle.textContent = "🏃 小偷胜利！";
    els.victoryTitle.style.color = "var(--danger-color)";
    els.victoryMessage.textContent = "所有小偷都成功逃脱！";
    return;
  }

  els.victoryTitle.textContent = "🏁 游戏结束";
  els.victoryTitle.style.color = "#f39c12";
  els.victoryMessage.textContent = `${escaped} 名小偷逃脱，${caught} 名被抓捕。`;
}
