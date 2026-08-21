'use client';

import { useEffect, useState } from 'react';
import { getRemainingTimeMs } from '../lib/turnTimer';

interface TurnTimerProps {
  currentTurn: string;
  durationMs: number;
  prominent?: boolean;
  serverNow?: number;
  turnDeadline?: number;
}

export default function TurnTimer({
  currentTurn,
  durationMs,
  prominent = false,
  serverNow,
  turnDeadline,
}: TurnTimerProps) {
  if (!durationMs || turnDeadline === undefined || serverNow === undefined) {
    return null;
  }

  return (
    <SyncedTurnTimer
      key={`${currentTurn}:${turnDeadline}:${serverNow}`}
      durationMs={durationMs}
      prominent={prominent}
      serverNow={serverNow}
      turnDeadline={turnDeadline}
    />
  );
}

function SyncedTurnTimer({
  durationMs,
  prominent,
  serverNow,
  turnDeadline,
}: Required<Omit<TurnTimerProps, 'currentTurn'>>) {
  const [receivedAt] = useState(Date.now);
  const [now, setNow] = useState(receivedAt);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  const remainingMs = getRemainingTimeMs(
    turnDeadline,
    serverNow,
    receivedAt,
    now,
  );
  const seconds = Math.ceil(remainingMs / 1000);
  const percent = Math.min(100, (remainingMs / durationMs) * 100);

  return (
    <div className={prominent ? 'card border-success p-3 mb-3 text-center shadow-sm' : 'd-flex align-items-center gap-2 mb-3'}>
      <span className={prominent ? 'display-5 fw-bold text-success font-monospace' : 'badge text-bg-warning fs-6 font-monospace'} role="timer">
        {seconds}s
      </span>
      <div
        className={prominent ? 'progress mt-2' : 'progress flex-grow-1'}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={Math.ceil(durationMs / 1000)}
        aria-valuenow={seconds}
        style={{ height: prominent ? '12px' : '6px' }}
      >
        <div
          className={`progress-bar ${prominent ? 'bg-success' : 'bg-warning'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
