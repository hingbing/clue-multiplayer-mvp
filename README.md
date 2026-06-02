# Clue Multiplayer MVP

React + TypeScript + Vite + Node.js + Express + Socket.IO로 만든 클루 보드게임 MVP입니다.

## 실행 방법

```bash
npm install
npm run install:all
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## 기능

- 닉네임 입력
- 방 생성
- 6자리 코드로 방 참가
- 플레이어 목록
- 2명 이상 게임 시작
- 정답 봉투 생성
- 카드 랜덤 분배
- 자기 카드만 보기
- 턴 진행
- 방 선택 이동
- 추리하기
- 자동 반증 처리
- 고발하기
- 승리 / 탈락 / 게임 종료

## 친구와 테스트하는 방법

같은 와이파이에서 테스트하려면 `client/src/socket.ts`의 서버 주소를 본인 PC IP로 바꾸세요.

예:

```ts
export const socket = io("http://192.168.0.10:4000");
```
