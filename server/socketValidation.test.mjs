import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  ExpiringRateLimiter, isValidDifficulty, isValidNumber, isValidNumberLength,
  isValidRoomId, isValidTimerSeconds, normalizeAccessCode, normalizePlayerName,
} = require('./socketValidation.cjs');

describe('Socket.IO input validation', () => {
  it('normalizes names and rejects empty or oversized values', () => {
    expect(normalizePlayerName('  Alice  ')).toBe('Alice');
    expect(normalizePlayerName('   ')).toBeNull();
    expect(normalizePlayerName('x'.repeat(33))).toBeNull();
    expect(normalizePlayerName('Alice\u200B')).toBeNull();
  });

  it('accepts only supported game configuration values', () => {
    expect(isValidNumberLength(3)).toBe(true);
    expect(isValidNumberLength(7)).toBe(false);
    expect(isValidDifficulty('hard')).toBe(true);
    expect(isValidDifficulty('cheat')).toBe(false);
    expect(isValidTimerSeconds(60)).toBe(true);
    expect(isValidTimerSeconds(10)).toBe(false);
  });

  it('validates identifiers, codes, and exact-length numbers', () => {
    expect(isValidRoomId('ABC123')).toBe(true);
    expect(isValidRoomId('bad room')).toBe(false);
    expect(normalizeAccessCode(' ab2 ')).toBe('AB2');
    expect(normalizeAccessCode('AB1')).toBeNull();
    expect(normalizeAccessCode('A0B')).toBeNull();
    expect(isValidNumber('1234', 4)).toBe(true);
    expect(isValidNumber('0123', 4)).toBe(false);
    expect(isValidNumber('12345', 4)).toBe(false);
  });
});

describe('ExpiringRateLimiter', () => {
  it('blocks after the limit and permits again after expiry', () => {
    const limiter = new ExpiringRateLimiter();
    expect(limiter.consume('socket:event', 2, 20)).toBe(true);
    expect(limiter.consume('socket:event', 2, 20)).toBe(true);
    expect(limiter.consume('socket:event', 2, 20)).toBe(false);
    return new Promise(resolve => setTimeout(() => {
      expect(limiter.consume('socket:event', 2, 20)).toBe(true);
      resolve();
    }, 30));
  });
});
