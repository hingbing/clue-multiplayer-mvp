export type CardType = 'suspect' | 'weapon' | 'room';
export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface Card {
  id: string;
  type: CardType;
  name: string;
}

export interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  hand: Card[];
  location: string | null;
  eliminated: boolean;
}

export interface Solution {
  suspect: string;
  weapon: string;
  room: string;
}

export interface Suggestion {
  suspect: string;
  weapon: string;
  room: string;
}

export interface PublicPlayer {
  id: string;
  nickname: string;
  isHost: boolean;
  location: string | null;
  eliminated: boolean;
}

export interface PublicRoomState {
  roomCode: string;
  status: GameStatus;
  players: PublicPlayer[];
  currentTurnPlayerId: string | null;
  turnNumber: number;
  winnerId: string | null;
  lastMessage: string;
}

export interface Room {
  roomCode: string;
  status: GameStatus;
  players: Player[];
  solution: Solution | null;
  currentTurnIndex: number;
  turnNumber: number;
  winnerId: string | null;
  lastMessage: string;
}
