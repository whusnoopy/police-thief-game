import { els } from "../../app/state.js";
import { SIGNAL_PHASES, normalizeSignalPhase } from "../../config/constants.js";

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function setTurnIndicator(turn) {
  const isThief = turn === "THIEF";
  els.turnIndicator.textContent = isThief ? "🏃 小偷回合" : "🚓 警察回合";
  els.policeStat.classList.toggle("active", !isThief);
  els.thiefStat.classList.toggle("active", isThief);
}

function getSignalLabel(signalPhase) {
  return normalizeSignalPhase(signalPhase) === SIGNAL_PHASES.PEDESTRIAN_RED
    ? "行人红灯"
    : "行人绿灯";
}

function setSignalIndicator(signalPhase) {
  if (!els.signalIndicator) return;
  const isPedestrianRed = normalizeSignalPhase(signalPhase) === SIGNAL_PHASES.PEDESTRIAN_RED;
  els.signalIndicator.textContent = `🚥 当前：${getSignalLabel(signalPhase)}`;
  els.signalIndicator.classList.toggle("car-go", isPedestrianRed);
  els.signalIndicator.classList.toggle("pedestrian-go", !isPedestrianRed);
}

function setActionButtons({ rollHidden = false, rollDisabled = false, skipHidden = true } = {}) {
  els.btnRollDice.disabled = rollDisabled;
  els.btnRollDice.classList.toggle("hidden", rollHidden);
  els.btnSkipTurn.classList.toggle("hidden", skipHidden);
}

export function getRandomDiceFace() {
  return DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
}

export function renderTurnStart(turn, signalPhase) {
  setTurnIndicator(turn);
  setSignalIndicator(signalPhase);
  els.diceEl.classList.remove("rolling");
  els.diceEl.textContent = "🎲";
  els.diceValueEl.textContent = "?";
  els.gameMessage.textContent = "点击下方按钮掷骰子";
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

export function renderCalculatingMoves() {
  els.gameMessage.textContent = "正在计算可走路线…";
  setActionButtons({ rollHidden: true, rollDisabled: true, skipHidden: true });
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
  els.gameMessage.textContent = "选择高亮落点；触屏先预览，再确认移动。";
}

export function renderUnitCounts(session) {
  const thieves = session.thiefUnits;
  const count = (status) => thieves.filter((unit) => unit.state === status).length;
  const carrying = session.policeUnits.filter((unit) => unit.state === "CARRYING").length;
  els.unitCounts.textContent = `警察 ${session.policeUnits.length}（押送中 ${carrying}）\n小偷：活动 ${count("ACTIVE")} · 押送中 ${count("CARRIED")} · 入狱 ${count("JAILED")} · 逃脱 ${count("ESCAPED")}`;
}

export function renderMovePreview(text, needsConfirmation) {
  els.movePreview.classList.remove("hidden");
  els.movePreviewText.textContent = `预计：${text}`;
  els.moveConfirmActions.classList.toggle("hidden", !needsConfirmation);
}

export function hideMovePreview() {
  els.movePreview.classList.add("hidden");
  els.moveConfirmActions.classList.add("hidden");
}

export function renderVictory({ type, escaped = 0, caught = 0 }) {
  els.victoryModal.classList.remove("hidden");

  if (type === "DRAW") {
    els.victoryTitle.textContent = "🤝 平局";
    els.victoryTitle.style.color = "var(--warning-color)";
    els.victoryMessage.textContent = "双方都已无路可走，即使掷出 6 或切换红绿灯也无法行动。可以编辑地图后再玩。";
    return;
  }

  if (type === "POLICE") {
    els.victoryTitle.textContent = "🚓 警察胜利！";
    els.victoryTitle.style.color = "var(--primary-color)";
    els.victoryMessage.textContent = "所有小偷都已被抓住（含押送中），警察获胜，无需继续押回警局。";
    return;
  }

  if (type === "THIEF") {
    els.victoryTitle.textContent = "🏃 小偷胜利！";
    els.victoryTitle.style.color = "var(--danger-color)";
    els.victoryMessage.textContent = "所有小偷都带着钱成功逃脱！";
    return;
  }

  els.victoryTitle.textContent = "🏁 游戏结束";
  els.victoryTitle.style.color = "#f39c12";
  els.victoryMessage.textContent = `${escaped} 名小偷逃脱，${caught} 名被抓捕。`;
}
