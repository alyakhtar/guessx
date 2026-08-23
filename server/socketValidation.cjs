const NAME_MAX_LENGTH = 32;
const ROOM_ID_PATTERN = /^[A-Z0-9]{6}$/;
const ACCESS_CODE_PATTERN = /^[A-Z2-9]{3}$/;
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const NUMBER_LENGTHS = new Set([3, 4, 5, 6]);
const TIMER_VALUES = new Set([0, 15, 30, 60]);

function normalizePlayerName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().normalize('NFKC');
  if (!name || [...name].length > NAME_MAX_LENGTH) return null;
  return name;
}

function isValidNumberLength(value) { return Number.isInteger(value) && NUMBER_LENGTHS.has(value); }
function isValidDifficulty(value) { return typeof value === 'string' && DIFFICULTIES.has(value); }
function isValidTimerSeconds(value) { return Number.isInteger(value) && TIMER_VALUES.has(value); }
function isValidRoomId(value) { return typeof value === 'string' && ROOM_ID_PATTERN.test(value.trim().toUpperCase()); }
function normalizeAccessCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return ACCESS_CODE_PATTERN.test(code) ? code : null;
}
function isValidNumber(value, length) {
  return typeof value === 'string' && Number.isInteger(length) && value.length === length &&
    /^\d+$/.test(value) && Number(value) >= 10 ** (length - 1) && Number(value) <= 10 ** length - 1;
}

class ExpiringRateLimiter {
  constructor() { this.entries = new Map(); }
  consume(key, limit, windowMs) {
    const now = Date.now();
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= now) {
      const next = { count: 1, expiresAt: now + windowMs };
      this.entries.set(key, next);
      const timer = setTimeout(() => {
        if (this.entries.get(key) === next) this.entries.delete(key);
      }, windowMs);
      timer.unref?.();
      return true;
    }
    if (entry.count >= limit) return false;
    entry.count += 1;
    return true;
  }
  clear(key) { this.entries.delete(key); }
}

const RATE_LIMITS = {
  roomCreation: { limit: 5, windowMs: 60_000 },
  roomJoin: { limit: 12, windowMs: 60_000 },
  privateCode: { limit: 8, windowMs: 60_000 },
  gameplay: { limit: 60, windowMs: 10_000 },
  hydration: { limit: 30, windowMs: 10_000 },
  rematch: { limit: 10, windowMs: 60_000 },
};

module.exports = {
  ExpiringRateLimiter, RATE_LIMITS, isValidDifficulty, isValidNumber,
  isValidNumberLength, isValidRoomId, isValidTimerSeconds, normalizeAccessCode,
  normalizePlayerName,
};
