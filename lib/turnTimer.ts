import type { TurnTimerSeconds } from '../types/game';

export const TURN_TIMER_OPTIONS = [0, 15, 30, 60] as const;
export function parseTurnTimerSeconds(raw: string | number | null | undefined): TurnTimerSeconds {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return (TURN_TIMER_OPTIONS as readonly number[]).includes(n) ? (n as TurnTimerSeconds) : 0;
}

export function getRemainingTimeMs(
  turnDeadline: number,
  serverNow: number,
  receivedAt: number,
  now: number,
): number {
  const clientClockOffsetMs = receivedAt - serverNow;
  return Math.max(0, turnDeadline + clientClockOffsetMs - now);
}
