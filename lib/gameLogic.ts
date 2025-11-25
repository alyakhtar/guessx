export const validateNumber = (number: string, length: number = 4): boolean => {
  if (number.length !== length) return false;
  if (!/^\d+$/.test(number)) return false;

  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const num = parseInt(number);

  return num >= min && num <= max;
};

export const calculateCorrectPositions = (guess: string, secret: string): number => {
  if (guess.length !== secret.length) return 0;

  let correct = 0;
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) {
      correct++;
    }
  }
  return correct;
};

export const generateRoomId = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const generateBotSecretNumber = (length: number): string => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return (min + Math.floor(Math.random() * (max - min + 1))).toString();
};

export const generateBotGuess = (difficulty: 'easy' | 'medium' | 'hard', length: number, gameHistory: any[], botGuessCount: number): string => {
  switch (difficulty) {
    case 'easy':
      return generateEasyBotGuess(length, gameHistory, botGuessCount);
    case 'medium':
      return generateMediumBotGuess(length, gameHistory, botGuessCount);
    case 'hard':
      return generateHardBotGuess(length, gameHistory, botGuessCount);
    default:
      return generateRandomGuess(length, gameHistory);
  }
};

const generateRandomGuess = (length: number, gameHistory: any[]): string => {
  const allPossible = [];
  const max = Math.pow(10, length);
  for (let i = Math.pow(10, length - 1); i < max; i++) {
    const numStr = i.toString().padStart(length, '0');
    if (!gameHistory.some(h => h.guess === numStr)) {
      allPossible.push(numStr);
    }
  }
  if (allPossible.length === 0) {
    // Fallback to any random number
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }
  return allPossible[Math.floor(Math.random() * allPossible.length)];
};

const generateEasyBotGuess = (length: number, gameHistory: any[], botGuessCount: number): string => {
  if (botGuessCount + 1 >= 9) {
    // Use intelligent guessing after 10 guesses
    let possibleCandidates = [];
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    for (let i = min; i <= max; i++) {
      possibleCandidates.push(i.toString());
    }

    // Filter based on history
    gameHistory.forEach(history => {
      const guess = history.guess;
      const correctPos = history.correctPositions;
      possibleCandidates = possibleCandidates.filter(candidate =>
        calculateCorrectPositions(guess, candidate) === correctPos
      );
    });

    if (possibleCandidates.length > 0) {
      return possibleCandidates[Math.floor(Math.random() * possibleCandidates.length)];
    }
  }

  // Before 11 guesses: random
  return generateRandomGuess(length, gameHistory);
};

const generateMediumBotGuess = (length: number, gameHistory: any[], botGuessCount: number): string => {
  if (botGuessCount + 1 >= 6) {
    // Use intelligent guessing after 7 guesses
    const possible = [];
    const max = Math.pow(10, length);
    for (let i = Math.pow(10, length - 1); i < max; i++) {
      const numStr = i.toString().padStart(length, '0');
      if (gameHistory.every(h => h.guess !== numStr)) {
        if (isConsistentWithHistory(numStr, gameHistory)) {
          possible.push(numStr);
        }
      }
    }
    if (possible.length > 0) {
      return possible[Math.floor(Math.random() * possible.length)];
    }
  }

  // Before 8 guesses: random
  return generateRandomGuess(length, gameHistory);
};

const generateHardBotGuess = (length: number, gameHistory: any[], botGuessCount: number): string => {
  if (botGuessCount + 1 >= 5) {
    // Use optimal strategy after 4 guesses
    let possibleCandidates = [];
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    for (let i = min; i <= max; i++) {
      possibleCandidates.push(i.toString());
    }

    // Filter based on all previous guesses
    gameHistory.forEach(history => {
      const guess = history.guess;
      const correctPos = history.correctPositions;
      possibleCandidates = possibleCandidates.filter(candidate =>
        calculateCorrectPositions(guess, candidate) === correctPos
      );
    });

    if (possibleCandidates.length > 0) {
      return possibleCandidates[Math.floor(Math.random() * possibleCandidates.length)];
    }
  }

  // Before 5 guesses: random guesses to avoid winning too early
  return generateRandomGuess(length, gameHistory);
};

const isConsistentWithHistory = (numStr: string, gameHistory: any[]): boolean => {
  // Simple check: for each previous guess, this number would give same or better feedback
  // This is a simplification for medium difficulty
  return gameHistory.every(history => {
    const correctPosForThis = calculateCorrectPositions(history.guess, numStr);
    return correctPosForThis >= history.correctPositions; // Not worse than actual
  });
};
