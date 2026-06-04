import { useEffect, useMemo, useRef, useState } from 'react';
import { socket } from './socket';
import type { Card, CardMeta, NoteMark, PublicPlayer, PublicRoomState, Suggestion } from './types';

const emptyMeta: CardMeta = { suspects: [], weapons: [], rooms: [] };
const emptyPick: Suggestion = { suspect: '', weapon: '', room: '' };
const markCycle: NoteMark[] = ['unknown', 'no', 'maybe', 'yes'];

const STORAGE_PLAYER_ID = 'clue_player_id';
const STORAGE_ROOM_CODE = 'clue_room_code';
const STORAGE_NICKNAME = 'clue_nickname';

function App() {
  const [nickname, setNickname] = useState(() => localStorage.getItem(STORAGE_NICKNAME) ?? '');
  const [joinCode, setJoinCode] = useState(() => localStorage.getItem(STORAGE_ROOM_CODE) ?? '');
  const [myPlayerId, setMyPlayerId] = useState(() => localStorage.getItem(STORAGE_PLAYER_ID) ?? '');
  const [roomState, setRoomState] = useState<PublicRoomState | null>(null);
  const [myCards, setMyCards] = useState<Card[]>([]);
  const [meta, setMeta] = useState<CardMeta>(emptyMeta);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState<Suggestion>(emptyPick);
  const [accusation, setAccusation] = useState<Suggestion>(emptyPick);
  const [moveRoom, setMoveRoom] = useState('');
  const [privateMessage, setPrivateMessage] = useState('');
  const [solution, setSolution] = useState<Suggestion | null>(null);
  const [disproveChoices, setDisproveChoices] = useState<Card[]>([]);
  const [noteMarks, setNoteMarks] = useState<Record<string, NoteMark>>({});
  const [history, setHistory] = useState<string[]>([]);
  const [rejoinTried, setRejoinTried] = useState(false);
  const roomStateRef = useRef<PublicRoomState | null>(null);

  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  useEffect(() => {
    function saveSession(playerId: string, roomCode: string, nextNickname?: string) {
      localStorage.setItem(STORAGE_PLAYER_ID, playerId);
      localStorage.setItem(STORAGE_ROOM_CODE, roomCode);
      if (nextNickname) localStorage.setItem(STORAGE_NICKNAME, nextNickname);
      setMyPlayerId(playerId);
      setJoinCode(roomCode);
      if (nextNickname) setNickname(nextNickname);
    }

    function handleMeta(data: CardMeta) {
      setMeta(data);
      setSuggestion({ suspect: data.suspects[0] ?? '', weapon: data.weapons[0] ?? '', room: data.rooms[0] ?? '' });
      setAccusation({ suspect: data.suspects[0] ?? '', weapon: data.weapons[0] ?? '', room: data.rooms[0] ?? '' });
      setMoveRoom(data.rooms[0] ?? '');
    }

    function handleRoomState(state: PublicRoomState) {
      setRoomState(state);
      setMoveRoom((prev) => {
        if (state.reachableRooms.length > 0 && !state.reachableRooms.includes(prev)) {
          return state.reachableRooms[0];
        }
        return prev;
      });
    }

    function attemptRejoin() {
      const storedPlayerId = localStorage.getItem(STORAGE_PLAYER_ID);
      const storedRoomCode = localStorage.getItem(STORAGE_ROOM_CODE);
      if (storedPlayerId && storedRoomCode && !roomStateRef.current) {
        socket.emit('room:rejoin', { playerId: storedPlayerId, roomCode: storedRoomCode });
      }
      setRejoinTried(true);
    }

    socket.on('connect', attemptRejoin);

    if (socket.connected) {
      attemptRejoin();
    }

    socket.on('meta:cards', handleMeta);
    socket.on('room:state', handleRoomState);

    socket.on('room:created', ({ playerId, roomCode, roomState: state }: { playerId: string; roomCode: string; roomState: PublicRoomState }) => {
      saveSession(playerId, roomCode, nickname);
      setRoomState(state);
      setPrivateMessage('방이 생성되었습니다. 이 방 코드를 친구에게 공유하세요.');
      setHistory([]);
    });

    socket.on('room:joined', ({ playerId, roomCode, roomState: state }: { playerId: string; roomCode: string; roomState: PublicRoomState }) => {
      saveSession(playerId, roomCode, nickname);
      setRoomState(state);
      setPrivateMessage('방에 참가했습니다.');
      setHistory([]);
    });

    socket.on('room:rejoined', ({ playerId, roomCode, nickname: nextNickname, roomState: state }: { playerId: string; roomCode: string; nickname: string; roomState: PublicRoomState }) => {
      saveSession(playerId, roomCode, nextNickname);
      setRoomState(state);
      setPrivateMessage('새로고침 후 기존 플레이어로 복귀했습니다.');
    });

    socket.on('room:rejoin-failed', ({ message }: { message: string }) => {
      localStorage.removeItem(STORAGE_PLAYER_ID);
      localStorage.removeItem(STORAGE_ROOM_CODE);
      setMyPlayerId('');
      setRoomState(null);
      setMyCards([]);
      setPrivateMessage('');
      if (message) setError(message);
      setTimeout(() => setError(''), 3500);
    });

    socket.on('game:started', ({ gameState }: { gameState: PublicRoomState }) => {
      setRoomState(gameState);
      setPrivateMessage('게임이 시작되었습니다. 내 카드를 확인하고 추리 노트를 채워보세요.');
      setSolution(null);
      setHistory(['게임 시작']);
      setDisproveChoices([]);
    });

    socket.on('game:your-cards', ({ cards }: { cards: Card[] }) => {
      setMyCards(cards);
      setNoteMarks((prev) => {
        const next = { ...prev };
        for (const card of cards) next[`mine:${card.name}`] = 'yes';
        return next;
      });
    });

    socket.on('game:rolled', ({ diceValue, reachableRooms }: { diceValue: number; reachableRooms: string[] }) => {
      pushHistory(`주사위 ${diceValue}: ${reachableRooms.join(', ') || '이동 가능 장소 없음'}`);
    });

    socket.on('game:suggested', ({ suggestion: next }: { playerId: string; suggestion: Suggestion }) => {
      pushHistory(`추리: ${next.suspect} / ${next.weapon} / ${next.room}`);
    });

    socket.on('game:disprove-request', ({ matchingCards }: { matchingCards: Card[] }) => {
      setDisproveChoices(matchingCards);
      setPrivateMessage('내가 반증자입니다. 보여줄 카드 1장을 직접 선택하세요.');
    });

    socket.on('game:disprove-needed', () => {
      setPrivateMessage('반증자가 카드를 선택하는 중입니다.');
    });

    socket.on('game:card-revealed', ({ card, disproverId }: { card: Card; disproverId: string }) => {
      const name = playerName(disproverId, roomStateRef.current?.players ?? []);
      setPrivateMessage(`${name}님이 보여준 카드: ${card.name}`);
      pushHistory(`반증 공개: ${name} → ${card.name}`);
      setDisproveChoices([]);
      setNoteMarks((prev) => ({ ...prev, [`${disproverId}:${card.name}`]: 'yes' }));
    });

    socket.on('game:disproved', () => {
      setDisproveChoices([]);
    });

    socket.on('game:no-disprove', ({ suggestion: next }: { suggestion: Suggestion }) => {
      setDisproveChoices([]);
      setPrivateMessage(`아무도 반증하지 못했습니다: ${next.suspect} / ${next.weapon} / ${next.room}`);
      pushHistory(`반증 없음: ${next.suspect} / ${next.weapon} / ${next.room}`);
    });

    socket.on('game:win', ({ solution }: { solution: Suggestion }) => {
      setSolution(solution);
      setDisproveChoices([]);
      pushHistory(`게임 종료 정답: ${solution.suspect} / ${solution.weapon} / ${solution.room}`);
    });

    socket.on('game:error', ({ message }: { message: string }) => {
      setError(message);
      setTimeout(() => setError(''), 3500);
    });

    return () => {
      socket.removeAllListeners();
    };
  }, [nickname]);

  const allCards = useMemo<Card[]>(() => [
    ...meta.suspects.map((name) => ({ id: `suspect-${name}`, type: 'suspect' as const, name })),
    ...meta.weapons.map((name) => ({ id: `weapon-${name}`, type: 'weapon' as const, name })),
    ...meta.rooms.map((name) => ({ id: `room-${name}`, type: 'room' as const, name })),
  ], [meta]);

  const me = useMemo(() => roomState?.players.find((p) => p.id === myPlayerId) ?? null, [roomState, myPlayerId]);
  const isHost = Boolean(me?.isHost);
  const isMyTurn = Boolean(roomState?.currentTurnPlayerId === myPlayerId);
  const winner = roomState?.players.find((p) => p.id === roomState.winnerId) ?? null;
  const pendingForMe = roomState?.pendingDisprove?.disproverId === myPlayerId;
  const canAct = isMyTurn && !roomState?.pendingDisprove && !me?.disconnected;

  function pushHistory(message: string) {
    setHistory((prev) => [message, ...prev].slice(0, 12));
  }

  function createRoom() {
    setError('');
    localStorage.setItem(STORAGE_NICKNAME, nickname);
    socket.emit('room:create', { nickname, maxPlayers: 6 });
  }

  function joinRoom() {
    setError('');
    localStorage.setItem(STORAGE_NICKNAME, nickname);
    socket.emit('room:join', { roomCode: joinCode, nickname });
  }

  function leaveRoom() {
    socket.emit('room:leave');
    localStorage.removeItem(STORAGE_PLAYER_ID);
    localStorage.removeItem(STORAGE_ROOM_CODE);
    setMyPlayerId('');
    setRoomState(null);
    setMyCards([]);
    setPrivateMessage('');
    setSolution(null);
    setDisproveChoices([]);
    setHistory([]);
  }

  function startGame() {
    socket.emit('game:start');
  }

  function roll() {
    socket.emit('game:roll');
  }

  function move() {
    socket.emit('game:move', { room: moveRoom });
    setSuggestion((prev) => ({ ...prev, room: moveRoom }));
  }

  function suggest() {
    const currentRoom = me?.location ?? suggestion.room;
    socket.emit('game:suggest', { ...suggestion, room: currentRoom });
  }

  function disprove(cardId: string) {
    socket.emit('game:disprove', { cardId });
    setDisproveChoices([]);
  }

  function accuse() {
    socket.emit('game:accuse', accusation);
  }

  function passTurn() {
    socket.emit('game:pass');
    setDisproveChoices([]);
  }

  function updateMark(ownerId: string, cardName: string) {
    const key = `${ownerId}:${cardName}`;
    setNoteMarks((prev) => {
      const current = prev[key] ?? 'unknown';
      const next = markCycle[(markCycle.indexOf(current) + 1) % markCycle.length];
      return { ...prev, [key]: next };
    });
  }

  if (!roomState) {
    return (
      <main className="page home">
        <section className="hero card">
          <p className="eyebrow">Multiplayer Mystery Game</p>
          <h1>CLUE 온라인</h1>
          <p className="sub">방 코드로 접속해 주사위를 굴리고, 단서를 모아 범인·흉기·장소를 맞히는 실시간 클루 게임입니다.</p>
          {!rejoinTried && <p className="private">이전 게임 복귀를 확인하는 중입니다...</p>}
          <div className="formBox">
            <label>닉네임</label>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="예: 까유링" />
          </div>
          <div className="actions two">
            <button onClick={createRoom}>방 만들기</button>
            <div className="joinRow">
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="방 코드" maxLength={6} />
              <button onClick={joinRoom}>참가</button>
            </div>
          </div>
          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Room Code</p>
          <h1>{roomState.roomCode}</h1>
        </div>
        <button className="ghost" onClick={leaveRoom}>나가기</button>
      </header>

      {error && <div className="toast error">{error}</div>}

      <section className="layout">
        <aside className="card sidebar">
          <h2>플레이어</h2>
          <div className="players">
            {roomState.players.map((player) => (
              <div key={player.id} className={`player ${player.id === myPlayerId ? 'me' : ''} ${player.eliminated ? 'dead' : ''} ${player.disconnected ? 'offline' : ''}`}>
                <strong>{player.nickname}</strong>
                <span>{player.isHost ? '방장' : '참가자'}</span>
                <small>{player.location ?? '대기 중'}</small>
                {roomState.currentTurnPlayerId === player.id && <b>현재 턴</b>}
                {player.eliminated && <b>탈락</b>}
                {player.disconnected && <b>재접속 대기</b>}
              </div>
            ))}
          </div>

          {roomState.status === 'waiting' && (
            <div className="startBox">
              <p>2명 이상부터 시작할 수 있습니다.</p>
              <button disabled={!isHost || roomState.players.length < 2} onClick={startGame}>게임 시작</button>
            </div>
          )}
        </aside>

        <section className="mainArea">
          <div className="card statusCard">
            <div className="statusHeader">
              <div>
                <p className="eyebrow">Game Status</p>
                <h2>{roomState.status === 'waiting' ? '대기실' : roomState.status === 'playing' ? `${roomState.turnNumber}번째 턴` : '게임 종료'}</h2>
              </div>
              {roomState.status === 'playing' && (
                <button className="ghost passButton" onClick={passTurn} disabled={!canAct}>턴 넘기기</button>
              )}
            </div>
            <p>{roomState.lastMessage}</p>
            {privateMessage && <p className="private">{privateMessage}</p>}
            {roomState.status === 'finished' && (
              <div className="resultBox">
                <h3>승자: {winner?.nickname ?? '알 수 없음'}</h3>
                {solution && <p>정답: {solution.suspect} / {solution.weapon} / {solution.room}</p>}
              </div>
            )}
          </div>

          {roomState.status === 'playing' && (
            <div className="gameGrid">
              <div className="card actionCard">
                <h2>내 행동</h2>
                <p className={isMyTurn ? 'turn yes' : 'turn'}>{isMyTurn ? '지금 내 턴입니다.' : '다른 플레이어의 턴입니다.'}</p>

                <div className="turnSteps">
                  <span className={roomState.hasRolled ? 'done' : ''}>1 주사위</span>
                  <span className={roomState.hasMoved ? 'done' : ''}>2 이동</span>
                  <span className={roomState.hasSuggested ? 'done' : ''}>3 추리</span>
                </div>

                <button onClick={roll} disabled={!canAct || roomState.hasRolled}>주사위 굴리기</button>
                {roomState.diceValue && <p className="dice">🎲 {roomState.diceValue}</p>}

                <label>이동 가능 장소</label>
                <select value={moveRoom} onChange={(e) => setMoveRoom(e.target.value)} disabled={!canAct || !roomState.hasRolled || roomState.hasMoved || roomState.reachableRooms.length === 0}>
                  {roomState.reachableRooms.length === 0 ? <option value="">이동 가능 장소 없음</option> : roomState.reachableRooms.map((room) => <option key={room} value={room}>{room}</option>)}
                </select>
                <button onClick={move} disabled={!canAct || !roomState.hasRolled || roomState.hasMoved || roomState.reachableRooms.length === 0}>이동</button>

                <hr />

                <h3>추리하기</h3>
                <Picker meta={meta} value={{ ...suggestion, room: me?.location ?? suggestion.room }} onChange={setSuggestion} disabled={!canAct || !roomState.hasMoved || roomState.hasSuggested} lockRoom={me?.location ?? ''} />
                <button onClick={suggest} disabled={!canAct || !roomState.hasMoved || roomState.hasSuggested}>추리하기</button>

                {pendingForMe && disproveChoices.length > 0 && (
                  <div className="disproveBox">
                    <h3>반증 카드 선택</h3>
                    <p>상대에게 보여줄 카드 1장을 선택하세요.</p>
                    {disproveChoices.map((card) => (
                      <button key={card.id} className="choice" onClick={() => disprove(card.id)}>{card.name}</button>
                    ))}
                  </div>
                )}

              </div>

              <div className="rightColumn">
                <div className="card handCard">
                  <h2>내 카드</h2>
                  <div className="cards">
                    {myCards.map((card) => (
                      <div key={card.id} className={`miniCard ${card.type}`}>
                        <span>{card.type === 'suspect' ? '인물' : card.type === 'weapon' ? '무기' : '장소'}</span>
                        <strong>{card.name}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card accusationCard">
                  <div className="accuseHeader">
                    <div>
                      <p className="eyebrow">Final Accusation</p>
                      <h2>최종 고발</h2>
                    </div>
                    <span className="warningText">신중하게 선택하세요</span>
                  </div>
                  <p className="muted">정답을 맞히면 승리, 틀리면 탈락합니다.</p>
                  <Picker meta={meta} value={accusation} onChange={setAccusation} disabled={!canAct} />
                  <button className="danger full" onClick={accuse} disabled={!canAct}>최종 고발하기</button>
                </div>
              </div>

              <Notebook cards={allCards} players={roomState.players} marks={noteMarks} onToggle={updateMark} />

              <div className="card logCard">
                <h2>게임 기록</h2>
                {history.length === 0 ? <p className="muted">아직 기록이 없습니다.</p> : history.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function Picker({ meta, value, onChange, disabled, lockRoom }: { meta: CardMeta; value: Suggestion; onChange: (v: Suggestion) => void; disabled: boolean; lockRoom?: string }) {
  return (
    <div className="picker">
      <select value={value.suspect} disabled={disabled} onChange={(e) => onChange({ ...value, suspect: e.target.value })}>
        {meta.suspects.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select value={value.weapon} disabled={disabled} onChange={(e) => onChange({ ...value, weapon: e.target.value })}>
        {meta.weapons.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select value={lockRoom || value.room} disabled={Boolean(lockRoom) || disabled} onChange={(e) => onChange({ ...value, room: e.target.value })}>
        {(lockRoom ? [lockRoom] : meta.rooms).map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </div>
  );
}

function Notebook({ cards, players, marks, onToggle }: { cards: Card[]; players: PublicPlayer[]; marks: Record<string, NoteMark>; onToggle: (ownerId: string, cardName: string) => void }) {
  const owners = [{ id: 'mine', nickname: '내 카드' }, ...players.map((p) => ({ id: p.id, nickname: p.disconnected ? `${p.nickname}(오프라인)` : p.nickname })), { id: 'solution', nickname: '정답 후보' }];

  return (
    <div className="card notebookCard">
      <h2>추리 노트</h2>
      <p className="muted">칸을 누르면 ? → X → △ → O 순서로 바뀝니다.</p>
      <div className="noteTableWrap">
        <table className="noteTable">
          <thead>
            <tr>
              <th>카드</th>
              {owners.map((owner) => <th key={owner.id}>{owner.nickname}</th>)}
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.id}>
                <td><span className={`typeDot ${card.type}`}>{typeLabel(card.type)}</span>{card.name}</td>
                {owners.map((owner) => {
                  const mark = marks[`${owner.id}:${card.name}`] ?? 'unknown';
                  return (
                    <td key={`${owner.id}-${card.name}`}>
                      <button className={`mark ${mark}`} onClick={() => onToggle(owner.id, card.name)}>{markLabel(mark)}</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function typeLabel(type: Card['type']): string {
  if (type === 'suspect') return '인';
  if (type === 'weapon') return '무';
  return '장';
}

function markLabel(mark: NoteMark): string {
  if (mark === 'yes') return 'O';
  if (mark === 'no') return 'X';
  if (mark === 'maybe') return '△';
  return '?';
}

function playerName(id: string, players: PublicPlayer[]): string {
  return players.find((player) => player.id === id)?.nickname ?? id.slice(0, 5);
}

export default App;
