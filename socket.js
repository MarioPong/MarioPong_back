// socket.js
const roomReadyStatus = {};
const gameStates = {};
const gameIntervals = {};

function listen(io) {
  const pongNamespace = io.of('/pong');

  function getPlayerIndex(room, socketId) {
    const sockets = Array.from(pongNamespace.adapter.rooms.get(room) || []);
    return sockets.indexOf(socketId);
  }

  // 게임 상태 업데이트 (공 이동, 충돌, 점수 등)
  function updateGameState(room) {
    const state = gameStates[room];
    if (!state) return;

    // 공 이동
    state.ballY += state.speedY * state.ballDirection;
    state.ballX += state.speedX;

    // 벽 충돌
    if (state.ballX < 0 && state.speedX < 0) state.speedX = -state.speedX;
    if (state.ballX > state.width && state.speedX > 0) state.speedX = -state.speedX;

    // 바닥 패들 충돌
    if (state.ballY > state.height - state.paddleDiff) {
      if (state.ballX >= state.paddleX[0] && state.ballX <= state.paddleX[0] + state.paddleWidth) {
        state.speedY = Math.min(state.speedY + 1, 5);
        state.ballDirection = -state.ballDirection;
        state.trajectoryX[0] = state.ballX - (state.paddleX[0] + state.paddleDiff);
        state.speedX = state.trajectoryX[0] * 0.3;
      } else {
        // 득점
        state.score[1]++;
        ballReset(state);
      }
    }
    // 천장 패들 충돌
    if (state.ballY < state.paddleDiff) {
      if (state.ballX >= state.paddleX[1] && state.ballX <= state.paddleX[1] + state.paddleWidth) {
        state.speedY = Math.min(state.speedY + 1, 5);
        state.ballDirection = -state.ballDirection;
        state.trajectoryX[1] = state.ballX - (state.paddleX[1] + state.paddleDiff);
        state.speedX = state.trajectoryX[1] * 0.3;
      } else {
        state.score[0]++;
        ballReset(state);
      }
    }
  }

  // 공 리셋
  function ballReset(state) {
    state.ballX = state.width / 2;
    state.ballY = state.height / 2;
    state.speedY = 3;
    state.speedX = 0;
    state.ballDirection = 1;
  }

  pongNamespace.on('connection', (socket) => {
    let room = null;

    socket.on('joinRoom', (roomName) => {
      const clients = pongNamespace.adapter.rooms.get(roomName);
      const numClients = clients ? clients.size : 0;
      if (numClients >= 2) {
        socket.emit('roomFull', { message: '방이 가득 찼습니다.' });
        return;
      }
      room = roomName;
      socket.join(room);

      // 준비상태 및 게임상태 초기화
      if (!roomReadyStatus[room]) roomReadyStatus[room] = {};
      roomReadyStatus[room][socket.id] = false;

      if (!gameStates[room]) {
        gameStates[room] = {
          width: 500,
          height: 700,
          paddleX: [225, 225],
          paddleWidth: 50,
          paddleHeight: 10,
          paddleDiff: 25,
          trajectoryX: [0, 0],
          ballX: 250,
          ballY: 350,
          ballRadius: 5,
          ballDirection: 1,
          speedY: 2,
          speedX: 0,
          score: [0, 0]
        };
      }

      socket.emit('enteredRoom');
    });

    socket.on('leaveRoom', (currentRoom) => {
      if (currentRoom && roomReadyStatus[currentRoom]) {
        delete roomReadyStatus[currentRoom][socket.id];
        if (Object.keys(roomReadyStatus[currentRoom]).length === 0) {
          delete roomReadyStatus[currentRoom];
        }
      }
      if (currentRoom && gameStates[currentRoom]) {
        if (gameIntervals[currentRoom]) {
          clearInterval(gameIntervals[currentRoom]);
          delete gameIntervals[currentRoom];
        }
        delete gameStates[currentRoom];
      }
      socket.leave(currentRoom);
    });

    socket.on('ready', () => {
      if (room && roomReadyStatus[room]) {
        roomReadyStatus[room][socket.id] = true;
        const allReady =
          Object.values(roomReadyStatus[room]).length === 2 &&
          Object.values(roomReadyStatus[room]).every(status => status);
        if (allReady) {
          pongNamespace.in(room).emit('startGame');
          // 게임 루프 시작
          if (!gameIntervals[room]) {
            gameIntervals[room] = setInterval(() => {
              updateGameState(room);
              pongNamespace.in(room).emit('gameState', gameStates[room]);
            }, 1000 / 60); // 60 FPS
          }
        } else {
          pongNamespace.in(room).emit('waiting', { id: socket.id });
        }
      }
    });

    // 내 패들 인덱스 요청 처리
    socket.on('getPaddleIndex', (roomName) => {
      const idx = getPlayerIndex(roomName, socket.id);
      socket.emit('paddleIndex', idx);
    });

    // 패들 이동 입력
    socket.on('paddleMove', (data) => {
      if (!room || !gameStates[room]) return;
      const idx = getPlayerIndex(room, socket.id);
      if (idx === 0 || idx === 1) {
        // 패들이 캔버스를 넘지 않게
        gameStates[room].paddleX[idx] = Math.max(0, Math.min(data.xPosition, gameStates[room].width - gameStates[room].paddleWidth));
      }
    });

    socket.on('disconnect', () => {
      if (room && roomReadyStatus[room]) {
        delete roomReadyStatus[room][socket.id];
        if (Object.keys(roomReadyStatus[room]).length === 0) {
          delete roomReadyStatus[room];
        }
      }
      if (room && gameStates[room]) {
        if (gameIntervals[room]) {
          clearInterval(gameIntervals[room]);
          delete gameIntervals[room];
        }
        delete gameStates[room];
      }
      socket.leave(room);
    });
  });
}

module.exports = { listen };
