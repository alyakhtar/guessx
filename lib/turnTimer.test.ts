import { describe, expect, it } from 'vitest';
import { getRemainingTimeMs } from './turnTimer';

describe('getRemainingTimeMs', () => {
  it('uses the server clock at turn start', () => {
    expect(getRemainingTimeMs(1_015_000, 1_000_000, 940_000, 940_000)).toBe(15_000);
  });

  it('hydrates from the absolute deadline partway through a turn', () => {
    expect(getRemainingTimeMs(1_015_000, 1_007_000, 1_127_000, 1_127_000)).toBe(8_000);
  });

  it('uses a fresh clock offset after reconnect', () => {
    expect(getRemainingTimeMs(1_015_000, 1_012_000, 982_000, 984_000)).toBe(1_000);
  });
});
