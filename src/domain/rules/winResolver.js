export function getNextTurn(turn) {
  return turn === "THIEF" ? "POLICE" : "THIEF";
}

export function getWinState(session) {
  const thiefUnits = session?.thiefUnits || [];

  const allCaught = thiefUnits.every(
    (thief) => thief.state === "CARRIED" || thief.state === "JAILED",
  );
  if (thiefUnits.length > 0 && allCaught) {
    return { type: "POLICE" };
  }

  const allEscaped = thiefUnits.every((thief) => thief.state === "ESCAPED");
  if (thiefUnits.length > 0 && allEscaped) {
    return { type: "THIEF" };
  }

  const hasActive = thiefUnits.some((thief) => thief.state === "ACTIVE");
  if (!hasActive) {
    return { type: "MIXED" };
  }

  return null;
}
