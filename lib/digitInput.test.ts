import { describe, expect, it } from 'vitest';

import { areDigitBoxesComplete, emptyDigitBoxes, fillDigitBoxes } from './digitInput';

describe('digit-box input', () => {
  it('fills the remaining boxes from a pasted full number', () => {
    expect(fillDigitBoxes(emptyDigitBoxes(4), 0, '4904')).toEqual({
      digits: ['4', '9', '0', '4'],
      filled: 4,
    });
  });

  it('sanitizes pasted content and fills from the focused box', () => {
    expect(fillDigitBoxes(['1', '', '', ''], 1, '2a34')).toEqual({
      digits: ['1', '2', '3', '4'],
      filled: 3,
    });
  });

  it('clears only the focused box and detects a complete number', () => {
    expect(fillDigitBoxes(['1', '2', '3', '4'], 2, '')).toEqual({
      digits: ['1', '2', '', '4'],
      filled: 0,
    });
    expect(areDigitBoxesComplete(['1', '2', '3', '4'])).toBe(true);
    expect(areDigitBoxesComplete(['1', '', '3', '4'])).toBe(false);
  });
});
