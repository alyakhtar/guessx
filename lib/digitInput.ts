export function emptyDigitBoxes(length: number) {
  return Array.from({ length }, () => '');
}

export function fillDigitBoxes(current: string[], startIndex: number, rawValue: string) {
  const digits = rawValue.replace(/\D/g, '');
  const next = [...current];

  if (!digits) {
    next[startIndex] = '';
    return { digits: next, filled: 0 };
  }

  const available = next.length - startIndex;
  const inserted = digits.slice(0, available);
  [...inserted].forEach((digit, offset) => { next[startIndex + offset] = digit; });
  return { digits: next, filled: inserted.length };
}

export function areDigitBoxesComplete(digits: string[]) {
  return digits.length > 0 && digits.every((digit) => /^\d$/.test(digit));
}
