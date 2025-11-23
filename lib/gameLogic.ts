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