import type { Card } from './types.js';

export const suspects = ['Green', 'Mustard', 'Peacock', 'Plum', 'Scarlet', 'White'];
export const weapons = ['Knife', 'Candlestick', 'Revolver', 'Rope', 'Lead Pipe', 'Wrench'];
export const rooms = ['Kitchen', 'Ballroom', 'Conservatory', 'Dining Room', 'Billiard Room', 'Library', 'Lounge', 'Hall', 'Study'];

export const allCards: Card[] = [
  ...suspects.map((name) => ({ id: `suspect-${name}`, type: 'suspect' as const, name })),
  ...weapons.map((name) => ({ id: `weapon-${name}`, type: 'weapon' as const, name })),
  ...rooms.map((name) => ({ id: `room-${name}`, type: 'room' as const, name }))
];

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createSolution() {
  return {
    suspect: suspects[Math.floor(Math.random() * suspects.length)],
    weapon: weapons[Math.floor(Math.random() * weapons.length)],
    room: rooms[Math.floor(Math.random() * rooms.length)]
  };
}
