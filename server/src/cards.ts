import type { Card } from './types.js';

export const suspects = ['Green', 'Mustard', 'Peacock', 'Plum', 'Scarlet', 'White'];
export const weapons = ['Knife', 'Candlestick', 'Revolver', 'Rope', 'Lead Pipe', 'Wrench'];
export const rooms = ['Kitchen', 'Ballroom', 'Conservatory', 'Dining Room', 'Billiard Room', 'Library', 'Lounge', 'Hall', 'Study'];

export const roomGraph: Record<string, string[]> = {
  Kitchen: ['Ballroom', 'Dining Room'],
  Ballroom: ['Kitchen', 'Conservatory', 'Billiard Room'],
  Conservatory: ['Ballroom', 'Billiard Room'],
  'Dining Room': ['Kitchen', 'Billiard Room', 'Lounge'],
  'Billiard Room': ['Ballroom', 'Conservatory', 'Dining Room', 'Library'],
  Library: ['Billiard Room', 'Study'],
  Lounge: ['Dining Room', 'Hall'],
  Hall: ['Lounge', 'Study'],
  Study: ['Hall', 'Library'],
};

export const allCards: Card[] = [
  ...suspects.map((name) => ({ id: `suspect-${name}`, type: 'suspect' as const, name })),
  ...weapons.map((name) => ({ id: `weapon-${name}`, type: 'weapon' as const, name })),
  ...rooms.map((name) => ({ id: `room-${name}`, type: 'room' as const, name })),
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
    room: rooms[Math.floor(Math.random() * rooms.length)],
  };
}

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function getReachableRooms(startRoom: string, steps: number): string[] {
  if (!rooms.includes(startRoom) || steps <= 0) return [];

  const distances = new Map<string, number>();
  const queue: Array<{ room: string; distance: number }> = [{ room: startRoom, distance: 0 }];
  distances.set(startRoom, 0);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (current.distance >= steps) continue;

    for (const next of roomGraph[current.room] ?? []) {
      const nextDistance = current.distance + 1;
      const knownDistance = distances.get(next);
      if (knownDistance === undefined || nextDistance < knownDistance) {
        distances.set(next, nextDistance);
        queue.push({ room: next, distance: nextDistance });
      }
    }
  }

  return [...distances.entries()]
    .filter(([room, distance]) => room !== startRoom && distance <= steps)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([room]) => room);
}
