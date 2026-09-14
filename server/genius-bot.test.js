import { describe, expect, it } from 'vitest';

import GameServer from './socket-server.js';

const { generateGeniusBotGuess } = GameServer;

function correctPositions(guess, secret) {
  return [...guess].filter((digit, index) => digit === secret[index]).length;
}

describe('Genius bot solver', () => {
  it('chooses a new candidate consistent with only its own observed feedback', () => {
    const history = [
      { playerName: 'Bot', guess: '1111', correctPositions: 0 },
      { playerName: 'Bot', guess: '2000', correctPositions: 1 },
      // This is a human guess against the bot secret. Genius must not use it.
      { playerName: 'Alice', guess: '2222', correctPositions: 4 },
    ];
    const botHistory = history.filter((entry) => entry.playerName === 'Bot');
    const guess = generateGeniusBotGuess(4, botHistory);

    expect(guess).not.toBe('1111');
    expect(guess).not.toBe('2000');
    expect(correctPositions('1111', guess)).toBe(0);
    expect(correctPositions('2000', guess)).toBe(1);
  });
});
