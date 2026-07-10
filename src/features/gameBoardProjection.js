export function parseCoordKey(key) {
  const [r, c] = key.split(",").map(Number);
  return { r, c };
}

export function projectSelectableUnitPositions(units, getReachableForUnit) {
  return units
    .filter((unit) => getReachableForUnit(unit).size > 0)
    .map((unit) => ({ r: unit.r, c: unit.c }));
}

export function projectReachablePositions(reachableActions) {
  return Array.from(reachableActions.keys()).map(parseCoordKey);
}

export function projectPathPreview(action, formatMovementPoints) {
  let costSpent = 0;
  const preview = [];

  action.trail.forEach((segment) => {
    costSpent += segment.cost;
    if (segment.movementKind === "BOARD" || segment.movementKind === "PARK") {
      preview.push({
        r: segment.r,
        c: segment.c,
        label: segment.movementKind === "BOARD" ? "上车" : "下车",
      });
      return;
    }

    preview.push({
      r: segment.r,
      c: segment.c,
      label: formatMovementPoints(costSpent),
    });
  });

  return preview;
}
