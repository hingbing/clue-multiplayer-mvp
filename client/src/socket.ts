import { io } from 'socket.io-client';

const env = import.meta as unknown as { env?: { VITE_SERVER_URL?: string } };
const serverUrl = env.env?.VITE_SERVER_URL || 'https://clue-server-7few.onrender.com';

export const socket = io(serverUrl, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 800,
});
