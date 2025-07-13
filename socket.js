// socket.js (가로 전체화면, 좌우 패들 구조)
const roomReadyStatus = {};
const gameStates = {};
const gameIntervals = {};
const roomPlayers = {};

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
    state.ballX += state.speedX;
    state.ballY += state.speedY;

    // 위/아래 벽 충돌 (반사)
    if (state.ballY < 0 && state.speedY < 0) state.speedY = -state.speedY;
    if (state.ballY > state.height && state.speedY > 0) state.speedY = -state.speedY;

    // 왼쪽 패들(플레이어 0) 충돌
    if (
      state.ballX < state.paddleX[0] + state.paddleWidth &&
      state.ballY + state.ballRadius > state.paddleY[0] &&
      state.ballY - state.ballRadius < state.paddleY[0] + state.paddleHeight &&
      state.speedX < 0
    ) {
      state.speedX = -state.speedX;
      // 각도 조절
      const hitPoint = (state.ballY - (state.paddleY[0] + state.paddleHeight / 2)) / (state.paddleHeight / 2);
      state.speedY = hitPoint * 5;
    }
    // 오른쪽 패들(플레이어 1) 충돌
    if (
      state.ballX > state.paddleX[1] &&
      state.ballY + state.ballRadius > state.paddleY[1] &&
      state.ballY - state.ballRadius < state.paddleY[1] + state.paddleHeight &&
      state.speedX > 0
    ) {
      state.speedX = -state.speedX;
      const hitPoint = (state.ballY - (state.paddleY[1] + state.paddleHeight / 2)) / (state.paddleHeight / 2);
      state.speedY = hitPoint * 5;
    }

    // 득점 (좌우 벽)
    if (state.ballX < 0) {
      state.score[1]++;
      ballReset(state, 1);
    }
    if (state.ballX > state.width) {
      state.score[0]++;
      ballReset(state, 0);
    }

    // 10점 도달 시 게임종료
    if (state.score[0] >= 10 || state.score[1] >= 10) {
      clearInterval(gameIntervals[room]);
      delete gameIntervals[room];
      pongNamespace.in(room).emit('gameOver', {
        winner: state.score[0] > state.score[1] ? 0 : 1,
        score: state.score
      });
    }
  }

  // 공 리셋 (득점 후)
  function ballReset(state, scorer) {
    state.ballX = state.width / 2;
    state.ballY = state.height / 2;
    state.ballRadius = 10;
    state.speedX = scorer === 0 ? 5 : -5; // 득점한 방향으로 공 발사
    state.speedY = 0;
  }

  pongNamespace.on('connection', (socket) => {
    let room = null;

    socket.on('joinRoom', (roomName, userName) => {
      const clients = pongNamespace.adapter.rooms.get(roomName);
      const numClients = clients ? clients.size : 0;
      if (numClients >= 2) {
        socket.emit('roomFull', { message: '방이 가득 찼습니다.' });
        return;
      }
      room = roomName;
      socket.join(room);

      if (!roomPlayers[room]) roomPlayers[room] = [];
      roomPlayers[room].push({ id: socket.id, userName, ready: false });

      // 준비상태 및 게임상태 초기화
      if (!roomReadyStatus[room]) roomReadyStatus[room] = {};
      roomReadyStatus[room][socket.id] = false;

      if (!gameStates[room]) {
        gameStates[room] = {
          width: 700,
          height: 500,
          paddleX: [20, 670], // 왼쪽, 오른쪽 패들 X좌표 (여유를 두고)
          paddleY: [225, 225], // 두 패들의 Y좌표
          paddleWidth: 10,
          paddleHeight: 75,
          ballX: 350,
          ballY: 250,
          ballRadius: 10,
          speedX: 5,
          speedY: 0,
          score: [0, 0]
        };
      }

      const index = getPlayerIndex(room, socket.id)
      socket.emit('enteredRoom', index);

      pongNamespace.in(room).emit('roomInfo', roomPlayers[room]);
    });

    socket.on('leaveRoom', (currentRoom) => {
      if (currentRoom && roomPlayers[currentRoom]) {
        roomPlayers[currentRoom] = roomPlayers[currentRoom].filter(p => p.id !== socket.id);
        if (roomPlayers[currentRoom].length === 0) delete roomPlayers[currentRoom];
        else pongNamespace.in(currentRoom).emit('roomInfo', roomPlayers[currentRoom]);
      }

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
          pongNamespace.in(room).emit('componentLeft', { id: socket.id });
        }
        delete gameStates[currentRoom];
      }
      socket.leave(currentRoom);
    });

    socket.on('ready', () => {
      if (room && roomPlayers[room]) {
        const player = roomPlayers[room].find(p => p.id === socket.id);
        if (player) player.ready = true;
        pongNamespace.in(room).emit('roomInfo', roomPlayers[room]);
      }
      
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

    socket.on('paddleMove', (data) => {
      if (!room || !gameStates[room]) return;
      const idx = getPlayerIndex(room, socket.id);
      if (idx === 0 || idx === 1) {
        gameStates[room].paddleY[idx] = Math.max(0, Math.min(data.yPosition, gameStates[room].height - gameStates[room].paddleHeight));
      }
    });

    socket.on('disconnect', () => {
      if (room && roomPlayers[room]) {
        roomPlayers[room] = roomPlayers[room].filter(p => p.id !== socket.id);
        if (roomPlayers[room].length === 0) delete roomPlayers[room];
        else pongNamespace.in(room).emit('roomInfo', roomPlayers[room]);
      }
      
      if (room && roomReadyStatus[room]) {
        delete roomReadyStatus[room][socket.id];
        if (Object.keys(roomReadyStatus[room]).length === 0) {
          delete roomReadyStatus[room];
        }
        else{
          pongNamespace.in(room).emit('componentLeft', { id: socket.id });
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
