export const TRACKED_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export type DigitTrackerState = 'unknown' | 'eliminated' | 'confirmed';

export function nextDigitTrackerState(state: DigitTrackerState): DigitTrackerState {
  if (state === 'unknown') return 'eliminated';
  if (state === 'eliminated') return 'confirmed';
  return 'unknown';
}
