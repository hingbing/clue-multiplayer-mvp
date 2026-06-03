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

export interface PendingDisprove {
  suggesterId: string;
  disproverId: string;
  suggestion: Suggestion;
  matchingCards: Card[];
}

export interface PublicPlayer {
  id: string;
  nickname: string;
  isHost: boolean;
  location: string | null;
  eliminated: boolean;
}

export interface PublicPendingDisprove {
  suggesterId: string;
  disproverId: string;
  suggestion: Suggestion;
}

export interface PublicRoomState {
  roomCode: string;
  status: GameStatus;
  players: PublicPlayer[];
  currentTurnPlayerId: string | null;
  turnNumber: number;
  winnerId: string | null;
  lastMessage: string;
  diceValue: number | null;
  reachableRooms: string[];
  hasRolled: boolean;
  hasMoved: boolean;
  hasSuggested: boolean;
  pendingDisprove: PublicPendingDisprove | null;
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
  diceValue: number | null;
  reachableRooms: string[];
  hasRolled: boolean;
  hasMoved: boolean;
  hasSuggested: boolean;
  pendingDisprove: PendingDisprove | null;
}
