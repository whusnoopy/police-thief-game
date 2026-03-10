export function getUnitAt(session, r, c) {
  const police = session?.policeUnits?.find((unit) => unit.r === r && unit.c === c);
  if (police) return { role: "POLICE", unit: police };

  const thief = session?.thiefUnits?.find(
    (unit) => unit.r === r && unit.c === c && unit.state === "ACTIVE",
  );
  if (thief) return { role: "THIEF", unit: thief };

  return null;
}

export function getCarriedThiefByCarrier(session, carrierId) {
  return (
    session?.thiefUnits?.find(
      (unit) => unit.state === "CARRIED" && unit.carrierId === carrierId,
    ) || null
  );
}

export function getActiveUnitsForTurn(session, turn) {
  if (turn === "THIEF") {
    return (session?.thiefUnits || []).filter((unit) => unit.state === "ACTIVE");
  }
  return session?.policeUnits || [];
}

export function hasAvailableCar(session, r, c) {
  return session?.parkingCars?.has(`${r},${c}`) || false;
}

export function hasParkedCar(session, r, c) {
  return session?.parkedCars?.has(`${r},${c}`) || false;
}
