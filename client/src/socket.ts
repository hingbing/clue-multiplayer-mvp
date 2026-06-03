import { io } from 'socket.io-client';

export const socket = io('https://clue-server-7few.onrender.com', {
  autoConnect: true,
});
