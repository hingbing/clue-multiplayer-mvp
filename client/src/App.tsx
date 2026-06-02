import { useEffect, useMemo, useState } from 'react';
import { socket } from './socket';
import type { Card, CardMeta, PublicRoomState, Suggestion } from './types';

const emptyMeta: CardMeta = { suspects: [], weapons: [], rooms: [] };
const emptyPick: Suggestion = { suspect: '', weapon: '', room: '' };

function App() {
  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [roomState, setRoomState] = useState<PublicRoomState | null>(null);
  const [myCards, setMyCards] = useState<Card[]>([]);
  const [meta, setMeta] = useState<CardMeta>(emptyMeta);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState<Suggestion>(emptyPick);
  const [accusation, setAccusation] = useState<Suggestion>(emptyPick);
  const [moveRoom, setMoveRoom] = useState('');
  const [privateMessage, setPrivateMessage] = useState('');
  const [solution, setSolution] = useState<Suggestion | null>(null);

  useEffect(() => {
    socket.on('meta:cards', (data: CardMeta) => {
      setMeta(data);
      setSuggestion({ suspect: data.suspects[0] ?? '', weapon: data.weapons[0] ?? '', room: data.rooms[0] ?? '' });
      setAccusation({ suspect: data.suspects[0] ?? '', weapon: data.weapons[0] ?? '', room: data.rooms[0] ?? '' });
      setMoveRoom(data.rooms[0] ?? '');
    });

    socket.on('room:state', (state: PublicRoomState) => setRoomState(state));
    socket.on('room:created', ({ roomState: state }: { roomState: PublicRoomState }) => setRoomState(state));
    socket.on('room:joined', ({ roomState: state }: { roomState: PublicRoomState }) => setRoomState(state));
    socket.on('game:started', ({ gameState }: { gameState: PublicRoomState }) => {
      setRoomState(gameState);
      setPrivateMessage('게임이 시작되었습니다. 내 카드를 확인하세요.');
      setSolution(null);
    });
    socket.on('game:your-cards', ({ cards }: { cards: Card[] }) => setMyCards(cards));
    socket.on('game:disprove-request', ({ matchingCards, disproverId }: { matchingCards: Card[]; disproverId: string }) => {
      const card = matchingCards[0];
      setPrivateMessage(`반증 카드 공개: ${card.type.toUpperCase()} - ${card.name} / 반증자 ID: ${disproverId.slice(0, 5)}`);
    });
    socket.on('game:win', ({ solution }: { solution: Suggestion }) => {
      setSolution(solution);
    });
    socket.on('game:error', ({ message }: { message: string }) => {
      setError(message);
      setTimeout(() => setError(''), 3500);
    });

    return () => {
      socket.off('meta:cards');
      socket.off('room:state');
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('game:started');
      socket.off('game:your-cards');
      socket.off('game:disprove-request');
      socket.off('game:win');
      socket.off('game:error');
    };
  }, []);

  const me = useMemo(() => roomState?.players.find((p) => p.id === socket.id) ?? null, [roomState]);
  const isHost = Boolean(me?.isHost);
  const isMyTurn = Boolean(roomState?.currentTurnPlayerId === socket.id);
  const winner = roomState?.players.find((p) => p.id === roomState.winnerId) ?? null;

  function createRoom() {
    setError('');
    socket.emit('room:create', { nickname, maxPlayers: 6 });
  }

  function joinRoom() {
    setError('');
    socket.emit('room:join', { roomCode: joinCode, nickname });
  }

  function leaveRoom() {
    socket.emit('room:leave');
    setRoomState(null);
    setMyCards([]);
    setPrivateMessage('');
    setSolution(null);
  }

  function startGame() {
    socket.emit('game:start');
  }

  function move() {
    socket.emit('game:move', { room: moveRoom });
  }

  function suggest() {
    socket.emit('game:suggest', suggestion);
  }

  function accuse() {
    socket.emit('game:accuse', accusation);
  }

  function passTurn() {
    socket.emit('game:pass');
  }

  if (!roomState) {
    return (
      <main className="page home">
        <section className="hero card">
          <p className="eyebrow">Multiplayer Mystery Game</p>
          <h1>CLUE 온라인 MVP</h1>
          <p className="sub">친구와 방 코드로 접속해서 범인, 흉기, 장소를 맞히는 실시간 클루 게임입니다.</p>
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
              <div key={player.id} className={`player ${player.id === socket.id ? 'me' : ''} ${player.eliminated ? 'dead' : ''}`}>
                <strong>{player.nickname}</strong>
                <span>{player.isHost ? '방장' : '참가자'}</span>
                <small>{player.location ?? '대기 중'}</small>
                {roomState.currentTurnPlayerId === player.id && <b>현재 턴</b>}
                {player.eliminated && <b>탈락</b>}
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
            <p className="eyebrow">Game Status</p>
            <h2>{roomState.status === 'waiting' ? '대기실' : roomState.status === 'playing' ? `${roomState.turnNumber}번째 턴` : '게임 종료'}</h2>
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
            <div className="grid2">
              <div className="card actionCard">
                <h2>내 행동</h2>
                <p className={isMyTurn ? 'turn yes' : 'turn'}>{isMyTurn ? '지금 내 턴입니다.' : '다른 플레이어의 턴입니다.'}</p>

                <label>이동할 장소</label>
                <select value={moveRoom} onChange={(e) => setMoveRoom(e.target.value)} disabled={!isMyTurn}>
                  {meta.rooms.map((room) => <option key={room} value={room}>{room}</option>)}
                </select>
                <button onClick={move} disabled={!isMyTurn}>이동</button>

                <hr />

                <h3>추리하기</h3>
                <Picker meta={meta} value={suggestion} onChange={setSuggestion} disabled={!isMyTurn} />
                <button onClick={suggest} disabled={!isMyTurn}>추리하기</button>

                <hr />

                <h3>최종 고발</h3>
                <Picker meta={meta} value={accusation} onChange={setAccusation} disabled={!isMyTurn} />
                <button className="danger" onClick={accuse} disabled={!isMyTurn}>고발하기</button>
                <button className="ghost full" onClick={passTurn} disabled={!isMyTurn}>턴 넘기기</button>
              </div>

              <div className="card handCard">
                <h2>내 카드</h2>
                <div className="cards">
                  {myCards.map((card) => (
                    <div key={card.id} className={`miniCard ${card.type}`}>
                      <span>{card.type}</span>
                      <strong>{card.name}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function Picker({ meta, value, onChange, disabled }: { meta: CardMeta; value: Suggestion; onChange: (v: Suggestion) => void; disabled: boolean }) {
  return (
    <div className="picker">
      <select value={value.suspect} disabled={disabled} onChange={(e) => onChange({ ...value, suspect: e.target.value })}>
        {meta.suspects.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select value={value.weapon} disabled={disabled} onChange={(e) => onChange({ ...value, weapon: e.target.value })}>
        {meta.weapons.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select value={value.room} disabled={disabled} onChange={(e) => onChange({ ...value, room: e.target.value })}>
        {meta.rooms.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </div>
  );
}

export default App;
