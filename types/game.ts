export interface Player {
  id: string;
  name: string;
  secretNumber?: string;
  isReady: boolean;
  isConnected: boolean;
  isBot?: boolean;
  botDifficulty?: BotDifficulty;
}

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface Guess {
  playerName: string;
  guess: string;
  correctPositions: number;
  timestamp: string | Date; // Allow both string and Date
}

export interface GameRoom {
  id: string;
  players: Player[];
  currentTurn: string; // playerId
  gameHistory: Guess[];
  gameStatus: 'waiting' | 'setup' | 'playing' | 'finished';
  winner?: string;
  numberLength: number;
  spectatorModeEnabled: boolean;
  isSinglePlayer?: boolean;
}

export interface GameState {
  room: GameRoom;
  currentPlayer: Player;
}
