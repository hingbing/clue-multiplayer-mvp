export const suspects = ['Green', 'Mustard', 'Peacock', 'Plum', 'Scarlet', 'White'];
export const weapons = ['Knife', 'Candlestick', 'Revolver', 'Rope', 'Lead Pipe', 'Wrench'];
export const rooms = ['Kitchen', 'Ballroom', 'Conservatory', 'Dining Room', 'Billiard Room', 'Library', 'Lounge', 'Hall', 'Study'];
export const allCards = [
    ...suspects.map((name) => ({ id: `suspect-${name}`, type: 'suspect', name })),
    ...weapons.map((name) => ({ id: `weapon-${name}`, type: 'weapon', name })),
    ...rooms.map((name) => ({ id: `room-${name}`, type: 'room', name }))
];
export function shuffle(items) {
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
