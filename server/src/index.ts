import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server, Socket } from 'socket.io';
import { allCards, createSolution, rooms, suspects, weapons, shuffle } from './cards.js';
import type { Card, Player, PublicRoomState, Room, Suggestion } from './types.js';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.get('/', (_req, res) => res.json({ ok: true, name: 'clue-server' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

const roomMap = new Map<string, Room>();
const socketRoomMap = new Map<string, string>();

function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return roomMap.has(code) ? makeRoomCode() : code;
}

function publicRoom(room: Room): PublicRoomState {
  const current = room.status === 'playing' ? room.players[room.currentTurnIndex] : null;
  return {
    roomCode: room.roomCode,
    status: room.status,
    players: room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isHost: p.isHost,
      location: p.location,
      eliminated: p.eliminated
    })),
    currentTurnPlayerId: current?.id ?? null,
    turnNumber: room.turnNumber,
    winnerId: room.winnerId,
    lastMessage: room.lastMessage
  };
}

function emitRoom(room: Room) {
  io.to(room.roomCode).emit('room:state', publicRoom(room));
}

function emitHands(room: Room) {
  for (const player of room.players) {
    io.to(player.id).emit('game:your-cards', { cards: player.hand });
  }
}

function findRoomBySocket(socket: Socket): Room | null {
  const roomCode = socketRoomMap.get(socket.id);
  if (!roomCode) return null;
  return roomMap.get(roomCode) ?? null;
}

function nextTurn(room: Room) {
  if (room.status !== 'playing') return;
  const activePlayers = room.players.filter((p) => !p.eliminated);
  if (activePlayers.length <= 1) {
    const winner = activePlayers[0];
    room.status = 'finished';
    room.winnerId = winner?.id ?? null;
    room.lastMessage = winner ? `${winner.nickname}님이 마지막 생존자로 승리했습니다.` : '게임이 종료되었습니다.';
    io.to(room.roomCode).emit('game:win', { winner, solution: room.solution });
    emitRoom(room);
    return;
  }

  do {
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
  } while (room.players[room.currentTurnIndex].eliminated);

  room.turnNumber += 1;
  const current = room.players[room.currentTurnIndex];
  room.lastMessage = `${current.nickname}님의 턴입니다.`;
  io.to(room.roomCode).emit('game:turn-start', { playerId: current.id, turnNumber: room.turnNumber });
  emitRoom(room);
}

function assertMyTurn(socket: Socket, room: Room): string | null {
  const current = room.players[room.currentTurnIndex];
  if (!current || current.id !== socket.id) return '지금은 내 턴이 아닙니다.';
  if (current.eliminated) return '탈락한 플레이어는 행동할 수 없습니다.';
  return null;
}

function matchingCards(player: Player, suggestion: Suggestion): Card[] {
  return player.hand.filter((card) => card.name === suggestion.suspect || card.name === suggestion.weapon || card.name === suggestion.room);
}

io.on('connection', (socket) => {
  socket.emit('meta:cards', { suspects, weapons, rooms });

  socket.on('room:create', ({ nickname, maxPlayers }: { nickname: string; maxPlayers?: number }) => {
    const cleanNickname = String(nickname ?? '').trim().slice(0, 16);
    if (!cleanNickname) {
      socket.emit('game:error', { message: '닉네임을 입력해주세요.' });
      return;
    }

    const roomCode = makeRoomCode();
    const host: Player = { id: socket.id, nickname: cleanNickname, isHost: true, hand: [], location: null, eliminated: false };
    const room: Room = {
      roomCode,
      status: 'waiting',
      players: [host],
      solution: null,
      currentTurnIndex: 0,
      turnNumber: 0,
      winnerId: null,
      lastMessage: `방이 생성되었습니다. 최대 인원 ${maxPlayers ?? 6}명`
    };

    roomMap.set(roomCode, room);
    socketRoomMap.set(socket.id, roomCode);
    socket.join(roomCode);
    socket.emit('room:created', { roomCode, roomState: publicRoom(room) });
    emitRoom(room);
  });

  socket.on('room:join', ({ roomCode, nickname }: { roomCode: string; nickname: string }) => {
    const code = String(roomCode ?? '').trim().toUpperCase();
    const cleanNickname = String(nickname ?? '').trim().slice(0, 16);
    const room = roomMap.get(code);
    if (!room) return socket.emit('game:error', { message: '존재하지 않는 방 코드입니다.' });
    if (!cleanNickname) return socket.emit('game:error', { message: '닉네임을 입력해주세요.' });
    if (room.status !== 'waiting') return socket.emit('game:error', { message: '이미 시작된 방입니다.' });
    if (room.players.length >= 6) return socket.emit('game:error', { message: '방이 가득 찼습니다.' });

    const player: Player = { id: socket.id, nickname: cleanNickname, isHost: false, hand: [], location: null, eliminated: false };
    room.players.push(player);
    socketRoomMap.set(socket.id, code);
    socket.join(code);
    room.lastMessage = `${cleanNickname}님이 입장했습니다.`;
    socket.emit('room:joined', { roomState: publicRoom(room) });
    socket.to(code).emit('room:player-joined', { player });
    emitRoom(room);
  });

  socket.on('room:leave', () => {
    handleLeave(socket);
  });

  socket.on('game:start', () => {
    const room = findRoomBySocket(socket);
    if (!room) return socket.emit('game:error', { message: '방에 먼저 입장해주세요.' });
    const player = room.players.find((p) => p.id === socket.id);
    if (!player?.isHost) return socket.emit('game:error', { message: '방장만 게임을 시작할 수 있습니다.' });
    if (room.players.length < 2) return socket.emit('game:error', { message: '2명 이상이어야 시작할 수 있습니다.' });

    room.solution = createSolution();
    const remainingCards = allCards.filter((card) => card.name !== room.solution?.suspect && card.name !== room.solution?.weapon && card.name !== room.solution?.room);
    const deck = shuffle(remainingCards);
    room.players.forEach((p) => {
      p.hand = [];
      p.location = 'Hall';
      p.eliminated = false;
    });
    deck.forEach((card, index) => room.players[index % room.players.length].hand.push(card));
    room.status = 'playing';
    room.currentTurnIndex = 0;
    room.turnNumber = 1;
    room.winnerId = null;
    room.lastMessage = `${room.players[0].nickname}님의 턴입니다.`;

    io.to(room.roomCode).emit('game:started', { gameState: publicRoom(room) });
    io.to(room.roomCode).emit('game:turn-start', { playerId: room.players[0].id, turnNumber: 1 });
    emitHands(room);
    emitRoom(room);
  });

  socket.on('game:move', ({ room: targetRoom }: { room: string }) => {
    const gameRoom = findRoomBySocket(socket);
    if (!gameRoom) return socket.emit('game:error', { message: '방에 먼저 입장해주세요.' });
    const err = assertMyTurn(socket, gameRoom);
    if (err) return socket.emit('game:error', { message: err });
    if (!rooms.includes(targetRoom)) return socket.emit('game:error', { message: '존재하지 않는 장소입니다.' });
    const player = gameRoom.players[gameRoom.currentTurnIndex];
    player.location = targetRoom;
    gameRoom.lastMessage = `${player.nickname}님이 ${targetRoom}(으)로 이동했습니다.`;
    io.to(gameRoom.roomCode).emit('game:moved', { playerId: player.id, room: targetRoom });
    emitRoom(gameRoom);
  });

  socket.on('game:suggest', (suggestion: Suggestion) => {
    const room = findRoomBySocket(socket);
    if (!room) return socket.emit('game:error', { message: '방에 먼저 입장해주세요.' });
    const err = assertMyTurn(socket, room);
    if (err) return socket.emit('game:error', { message: err });
    if (!suspects.includes(suggestion.suspect) || !weapons.includes(suggestion.weapon) || !rooms.includes(suggestion.room)) {
      return socket.emit('game:error', { message: '잘못된 추리입니다.' });
    }

    const suggester = room.players[room.currentTurnIndex];
    room.lastMessage = `${suggester.nickname}님의 추리: ${suggestion.suspect} / ${suggestion.weapon} / ${suggestion.room}`;
    io.to(room.roomCode).emit('game:suggested', { playerId: suggester.id, suggestion });

    const orderedOthers = [...room.players.slice(room.currentTurnIndex + 1), ...room.players.slice(0, room.currentTurnIndex)].filter((p) => !p.eliminated && p.id !== suggester.id);
    const disprover = orderedOthers.find((p) => matchingCards(p, suggestion).length > 0);

    if (!disprover) {
      room.lastMessage = '아무도 반증하지 못했습니다.';
      io.to(room.roomCode).emit('game:no-disprove', { suggestion });
      emitRoom(room);
      return;
    }

    const matches = matchingCards(disprover, suggestion);
    const shownCard = matches[Math.floor(Math.random() * matches.length)];
    io.to(suggester.id).emit('game:disprove-request', { matchingCards: [shownCard], disproverId: disprover.id });
    io.to(room.roomCode).emit('game:disproved', { disproverId: disprover.id });
    room.lastMessage = `${disprover.nickname}님이 반증했습니다. 카드는 추리한 사람에게만 공개됩니다.`;
    emitRoom(room);
  });

  socket.on('game:disprove', () => {
    socket.emit('game:error', { message: 'MVP에서는 반증 카드가 자동으로 1장 공개됩니다.' });
  });

  socket.on('game:accuse', (accusation: Suggestion) => {
    const room = findRoomBySocket(socket);
    if (!room || !room.solution) return socket.emit('game:error', { message: '진행 중인 게임이 없습니다.' });
    const err = assertMyTurn(socket, room);
    if (err) return socket.emit('game:error', { message: err });
    const player = room.players[room.currentTurnIndex];
    io.to(room.roomCode).emit('game:accused', { playerId: player.id, accusation });

    const correct = room.solution.suspect === accusation.suspect && room.solution.weapon === accusation.weapon && room.solution.room === accusation.room;
    if (correct) {
      room.status = 'finished';
      room.winnerId = player.id;
      room.lastMessage = `${player.nickname}님이 정답을 맞혔습니다.`;
      io.to(room.roomCode).emit('game:win', { winner: player, solution: room.solution });
      emitRoom(room);
      return;
    }

    player.eliminated = true;
    room.lastMessage = `${player.nickname}님이 고발에 실패하여 탈락했습니다.`;
    io.to(room.roomCode).emit('game:eliminated', { playerId: player.id });
    nextTurn(room);
  });

  socket.on('game:pass', () => {
    const room = findRoomBySocket(socket);
    if (!room) return socket.emit('game:error', { message: '방에 먼저 입장해주세요.' });
    const err = assertMyTurn(socket, room);
    if (err) return socket.emit('game:error', { message: err });
    nextTurn(room);
  });

  socket.on('disconnect', () => handleLeave(socket));
});

function handleLeave(socket: Socket) {
  const roomCode = socketRoomMap.get(socket.id);
  if (!roomCode) return;
  const room = roomMap.get(roomCode);
  if (!room) return;

  const leaving = room.players.find((p) => p.id === socket.id);
  room.players = room.players.filter((p) => p.id !== socket.id);
  socketRoomMap.delete(socket.id);
  socket.leave(roomCode);

  if (room.players.length === 0) {
    roomMap.delete(roomCode);
    return;
  }

  if (leaving?.isHost) room.players[0].isHost = true;
  if (room.currentTurnIndex >= room.players.length) room.currentTurnIndex = 0;
  room.lastMessage = `${leaving?.nickname ?? '플레이어'}님이 나갔습니다.`;
  io.to(roomCode).emit('room:player-left', { playerId: socket.id });
  emitRoom(room);
}

server.listen(4000, () => {
  console.log('Clue server running on http://localhost:4000');
});
