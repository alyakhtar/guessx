export function getRemainingTimeMs(
  turnDeadline: number,
  serverNow: number,
  receivedAt: number,
  now: number,
): number {
  const clientClockOffsetMs = receivedAt - serverNow;
  return Math.max(0, turnDeadline + clientClockOffsetMs - now);
}
