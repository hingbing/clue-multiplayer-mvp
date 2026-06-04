# Clue Multiplayer MVP

React + TypeScript + Vite + Node.js + Express + Socket.IO 기반 클루 멀티플레이 MVP입니다.

## 주요 기능

- 방 생성 / 방 코드 참가
- 서버 메모리 기반 실시간 멀티플레이
- 한글 카드명: 인물, 무기, 장소
- 주사위 기반 이동 가능 장소 계산
- 한 턴에 추리 1회 제한
- 반증자가 보여줄 카드 직접 선택
- 추리 노트
- 새로고침 재접속 복구
  - 프론트: playerId, roomCode를 localStorage 저장
  - 서버: disconnect 후 60초 동안 기존 플레이어 보존

## 로컬 실행

```bash
npm install
npm run install:all
npm run dev
```

프론트: http://localhost:5173
백엔드: http://localhost:4000

## 배포

- client: Vercel
- server: Render

Render 환경변수:

```txt
CLIENT_URL=https://clue-client-new.vercel.app
PORT=4000
```

프론트 서버 주소는 `client/src/socket.ts`의 기본값 또는 Vercel 환경변수 `VITE_SERVER_URL`로 설정할 수 있습니다.
