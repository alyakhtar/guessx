export type DailyChallengeShareGuess = {
  correctPositions: number;
};

export type DailyChallengeShareAttempt = {
  challengeNumber: number;
  numberLength: number;
  maxGuesses: number;
  guesses: DailyChallengeShareGuess[];
  status: 'won' | 'exhausted';
  streak?: number;
};

export function dailyChallengeFeedbackRow(correctPositions: number, numberLength: number) {
  const correct = Math.min(Math.max(correctPositions, 0), numberLength);
  return `${'🟩'.repeat(correct)}${'⬛'.repeat(numberLength - correct)}`;
}

export function buildDailyChallengeShareText(attempt: DailyChallengeShareAttempt) {
  const result = attempt.status === 'won'
    ? `${attempt.guesses.length}/${attempt.maxGuesses}`
    : `X/${attempt.maxGuesses}`;
  const header = `GuessX Daily #${attempt.challengeNumber} · ${result}${attempt.streak ? ` · 🔥 ${attempt.streak}` : ''}`;
  const rows = attempt.guesses.map((guess) => dailyChallengeFeedbackRow(guess.correctPositions, attempt.numberLength));

  return [header, ...rows].join('\n');
}

export function buildDailyChallengeShareMessage(attempt: DailyChallengeShareAttempt, url: string) {
  return `${buildDailyChallengeShareText(attempt)}\n${url}`;
}
