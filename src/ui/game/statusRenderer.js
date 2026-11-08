import { els } from "../../app/state.js";
import { SIGNAL_PHASES, normalizeSignalPhase } from "../../config/constants.js";
import { renderRoleIcon, renderRoleLabel } from "./roleArtwork.js";

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
let actionTurn = null;
let actionTurnLabel = "";

function setTurnIndicator(turn) {
  const isThief = turn === "THIEF";
  renderRoleLabel(els.turnIndicator, isThief ? "thief" : "police", isThief ? "小偷回合" : "警察回合");
  renderRoleIcon(els.policeRoleIcon, "police");
  renderRoleIcon(els.thiefRoleIcon, "thief");
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

function setActionButtons({ rollHidden = false, rollDisabled = false, skipHidden = true, selectionHidden = true } = {}) {
  els.btnRollDice.disabled = rollDisabled;
  els.btnRollDice.classList.toggle("hidden", rollHidden);
  els.btnSkipTurn.classList.toggle("hidden", skipHidden);
  els.btnCancelSelection.classList.toggle("hidden", selectionHidden);
}

export function getRandomDiceFace() {
  return DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
}

export function renderTurnStart(turn, signalPhase) {
  actionTurn = null;
  actionTurnLabel = turn === "THIEF" ? "小偷回合" : "警察回合";
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
  els.gameMessage.textContent = "选择高亮落点，或点击其他己方角色换人；再次点击已选角色可取消。触屏落点需确认。";
  setActionButtons({ rollHidden: true, rollDisabled: true, selectionHidden: false });
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

export function resetActionResults() {
  actionTurn = null;
  els.lastAction.textContent = "行动结果会显示在这里。";
  els.lastAction.scrollTop = 0;
}

export function renderActionResult(text) {
  if (!actionTurn) {
    if (els.lastAction.children.length === 0) els.lastAction.textContent = "";
    actionTurn = document.createElement("div");
    actionTurn.className = "action-turn";
    actionTurn.setAttribute("role", "group");
    actionTurn.setAttribute("aria-label", actionTurnLabel);
    els.lastAction.appendChild(actionTurn);
  }
  const entry = document.createElement("div");
  entry.className = "action-result-entry";
  text.split("；").forEach((part, index) => {
    if (index) {
      const separator = document.createElement("span");
      separator.className = "action-result-separator";
      separator.textContent = "；";
      entry.appendChild(separator);
    }
    const line = document.createElement("span");
    line.className = "action-result-line";
    line.textContent = part;
    entry.appendChild(line);
  });
  actionTurn.appendChild(entry);
  els.lastAction.scrollTop = els.lastAction.scrollHeight;
}

export function renderTurnBudget({ continuous, active, points, unitId, formatPoints, operations, onOperation }) {
  els.remainingPoints.classList.toggle("hidden", !continuous || !active);
  els.remainingPoints.textContent = `剩余 ${formatPoints(points)} 行动点${unitId ? ` · 本回合锁定 ${unitId}` : " · 首次行动前可换人"}`;
  els.btnEndTurn.classList.toggle("hidden", !continuous || !active);
  els.btnEndTurn.textContent = `结束回合${points ? `（放弃 ${formatPoints(points)} 点）` : ""}`;
  if (unitId) els.btnCancelSelection.classList.add("hidden");
  els.unitOperations.innerHTML = "";
  els.unitOperations.classList.toggle("hidden", operations.length === 0);
  for (const operation of operations) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "btn secondary";
    button.dataset.operation = operation.type;
    button.textContent = `${operation.label}（1 点）${operation.reason ? ` · ${operation.reason}` : ""}`;
    button.disabled = !operation.enabled;
    button.onclick = () => onOperation(operation.type);
    els.unitOperations.appendChild(button);
  }
}

export function renderVictory({ type, escaped = 0, caught = 0 }) {
  els.btnCancelSelection.classList.add("hidden");
  els.victoryModal.classList.remove("hidden");

  if (type === "DRAW") {
    els.victoryTitle.textContent = "🤝 平局";
    els.victoryTitle.style.color = "var(--warning-color)";
    els.victoryMessage.textContent = "双方都已无路可走，即使掷出 6 或切换红绿灯也无法行动。可以编辑地图后再玩。";
    return;
  }

  if (type === "POLICE") {
    renderRoleLabel(els.victoryTitle, "police", "警察胜利！");
    els.victoryTitle.style.color = "var(--primary-color)";
    els.victoryMessage.textContent = "所有小偷都已被抓住（含押送中），警察获胜，无需继续押回警局。";
    return;
  }

  if (type === "THIEF") {
    renderRoleLabel(els.victoryTitle, "thief", "小偷胜利！");
    els.victoryTitle.style.color = "var(--danger-color)";
    els.victoryMessage.textContent = "所有小偷都带着钱成功逃脱！";
    return;
  }

  els.victoryTitle.textContent = "🏁 游戏结束";
  els.victoryTitle.style.color = "#f39c12";
  els.victoryMessage.textContent = `${escaped} 名小偷逃脱，${caught} 名被抓捕。`;
}
