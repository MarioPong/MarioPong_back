const roomReadyStatus = {};
const gameStates = {};
const gameIntervals = {};
const roomPlayers = {};
const ballSpeedUpTimeouts = {};

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

    // 패들 이동
    for (let i = 0; i < 2; i++) {
      if (typeof state.targetPaddleY[i] === 'number') {
        const diff = state.targetPaddleY[i] - state.paddleY[i];
        const maxMove = state.paddleSpeed[i];
        if (Math.abs(diff) <= maxMove) {
          state.paddleY[i] = state.targetPaddleY[i];
        } else {
          state.paddleY[i] += diff > 0 ? maxMove : -maxMove;
        }
      }
    }

    // 공 이동
    state.ballX += state.speedX;
    state.ballY += state.speedY;

    for (const ball of state.fakeBalls){
      ball.x += ball.vx;
      ball.y += ball.vy;
    }

    // 위/아래 벽 충돌 (반사)
    if (state.ballY < 0 && state.speedY < 0) state.speedY = -state.speedY;
    if (state.ballY > state.height && state.speedY > 0) state.speedY = -state.speedY;

    for (const ball of state.fakeBalls){
      if (ball.y < 0 && ball.y < 0) ball.vy = -ball.vy;
      if (ball.y > state.height && ball.vy > 0) ball.vy = -ball.vy;
    }

    // 왼쪽 패들(플레이어 0) 충돌
    if (
      state.ballX < state.paddleX[0] + state.paddleWidth[0] &&
      state.ballY + state.ballRadius > state.paddleY[0] &&
      state.ballY - state.ballRadius < state.paddleY[0] + state.paddleHeight[0] &&
      state.speedX < 0
    ) {
      state.speedX = -state.speedX;
      //쿠파 스킬
      if (state.pendingBallSpeedUp[0]){
        state.pendingBallSpeedUp[0] = false;
        state.speedX *=1.5;
        state.speedY *=1.5;

        if (ballSpeedUpTimeouts[room]) clearTimeout(ballSpeedUpTimeouts[room]);
        ballSpeedUpTimeouts[room] = setTimeout(() => {
          const norm = Math.sqrt(state.speedX * state.speedX + state.speedY * state.speedY);
          const base = 5;
          state.speedX = (state.speedX / norm) * base;
          state.speedY = (state.speedY / norm) * base;
          ballSpeedUpTimeouts[room] = null;
        }, 1500);
      }

      //돈키콩 스킬
      if (state.pendingFakeBalls[0]) {
        state.pendingFakeBalls[0] = false;
        const angle = Math.atan2(state.speedY, state.speedX);
        const speed = Math.sqrt(state.speedX * state.speedX + state.speedY * state.speedY);
        for (let i =-1; i<=1; i++){
          if(i===0) continue;
          const fakeAngle = angle + i*0.25;
          state.fakeBalls.push({
            x: state.ballX,
            y: state.ballY,
            vx: Math.cos(fakeAngle) * speed,
            vy: Math.sin(fakeAngle) * speed,
            life: 160
          });
        }
      }
      // 각도 조절
      const hitPoint = (state.ballY - (state.paddleY[0] + state.paddleHeight[0] / 2)) / (state.paddleHeight[0] / 2);
      state.speedY = hitPoint * 5;
    }

    for (const ball of state.fakeBalls){
      if (
        ball.x < state.paddleX[0] + state.paddleWidth[0] &&
        ball.y + state.ballRadius > state.paddleY[0] &&
        ball.y - state.ballRadius < state.paddleY[0] + state.paddleHeight[0] &&
        ball.vx < 0
      ) {
        ball.vx = -ball.vx;
        // 각도 조절
        const hitPoint = (ball.y - (state.paddleY[0] + state.paddleHeight[0] / 2)) / (state.paddleHeight[0] / 2);
        ball.vy = hitPoint * 5;
      }
    }  
    // 오른쪽 패들(플레이어 1) 충돌
    if (
      state.ballX > state.paddleX[1] &&
      state.ballY + state.ballRadius > state.paddleY[1] &&
      state.ballY - state.ballRadius < state.paddleY[1] + state.paddleHeight[1] &&
      state.speedX > 0
    ) {
      state.speedX = -state.speedX;

      if (state.pendingBallSpeedUp[1]){
        state.pendingBallSpeedUp[1] = false;
        state.speedX *=1.5;
        state.speedY *=1.5;

        if (ballSpeedUpTimeouts[room]) clearTimeout(ballSpeedUpTimeouts[room]);
        ballSpeedUpTimeouts[room] = setTimeout(() => {
          const norm = Math.sqrt(state.speedX * state.speedX + state.speedY * state.speedY);
          const base = 5;
          state.speedX = (state.speedX / norm) * base;
          state.speedY = (state.speedY / norm) * base;
          ballSpeedUpTimeouts[room] = null;
        }, 1500);
      }

      if (state.pendingFakeBalls[1]) {
        state.pendingFakeBalls[1] = false;
        const angle = Math.atan2(state.speedY, state.speedX);
        const speed = Math.sqrt(state.speedX * state.speedX + state.speedY * state.speedY);
        for (let i =-1; i<=1; i++){
          if(i===0) continue;
          const fakeAngle = angle + i*0.25;
          state.fakeBalls.push({
            x: state.ballX,
            y: state.ballY,
            vx: Math.cos(fakeAngle) * speed,
            vy: Math.sin(fakeAngle) * speed,
            life: 160
          });
        }
      }

      const hitPoint = (state.ballY - (state.paddleY[1] + state.paddleHeight[1] / 2)) / (state.paddleHeight[1] / 2);
      state.speedY = hitPoint * 5;
    }

    for (const ball of state.fakeBalls){
      if (
        ball.x > state.paddleX[1] &&
        ball.y + state.ballRadius > state.paddleY[1] &&
        ball.y - state.ballRadius < state.paddleY[1] + state.paddleHeight[1] &&
        ball.vx > 0
      ) {
        ball.vx = -ball.vx;

        const hitPoint = (ball.y - (state.paddleY[1] + state.paddleHeight[1] / 2)) / (state.paddleHeight[1] / 2);
        ball.vy = hitPoint * 5;
      }
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

      // 준비 상태 초기화
      for (const socketId in roomReadyStatus[room]) {
        roomReadyStatus[room][socketId] = false;
      }
      for (const player of roomPlayers[room]) {
        player.ready = false;
      }
    }

    state.fakeBalls = state.fakeBalls.filter(ball => (ball.life > 0));
    for (const ball of state.fakeBalls){
      ball.life--;
    }
  }

  // 공 리셋 (득점 후)
  function ballReset(state, scorer) {
    state.ballX = state.width / 2;
    state.ballY = state.height / 2;
    state.ballRadius = 10;
    state.speedX = scorer === 0 ? 5 : -5; // 득점한 방향으로 공 발사
    state.speedY = 0;
    state.fakeBalls = [];
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

      // 준비상태 및 게임상태 초기화
      if (!roomReadyStatus[room]) roomReadyStatus[room] = {};
      roomReadyStatus[room][socket.id] = false;

      if (!gameStates[room]) {
        gameStates[room] = {
          width: 700,
          height: 500,
          paddleX: [20, 670], 
          paddleY: [225, 225], 
          targetPaddleY: [225, 225],
          paddleWidth: [10, 10],       // 각 플레이어별 패들 너비
          paddleHeight: [75, 75],      // 각 플레이어별 패들 높이
          paddleSpeed: [8, 8],         // 각 플레이어별 패들 이동 속도
          pendingBallSpeedUp: [false, false],
          ballX: 350,
          ballY: 250,
          ballRadius: 10,
          fakeBalls: [],
          pendingFakeBalls: [false, false],
          speedX: 5,
          speedY: 0,
          score: [0, 0],
          p1: "",
          p2: "",
          p1_character: "",
          p2_character: ""
        };
      }

      if(!ballSpeedUpTimeouts[room]){
        ballSpeedUpTimeouts[room] = null;
      }

      if (!roomPlayers[room]) {
        roomPlayers[room] = [];
        gameStates[room].p1 = userName;
      } else {
        gameStates[room].p2 = userName;
      }
      roomPlayers[room].push({ id: socket.id, userName, ready: false, character: "" });

      const index = getPlayerIndex(room, socket.id)
      socket.emit('enteredRoom', index);

      pongNamespace.in(room).emit('roomInfo', roomPlayers[room]);
    });

    socket.on('leaveRoom', (currentRoom) => {
      socket.leave(currentRoom);
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
    });

    socket.on('ready', (character) => {
      if (room && roomPlayers[room]) {
        const player = roomPlayers[room].find(p => p.id === socket.id);
        if (player){
          player.ready = true;
          player.character = character;
        }
        pongNamespace.in(room).emit('roomInfo', roomPlayers[room]);
      }
      
      if (room && roomReadyStatus[room]) {
        roomReadyStatus[room][socket.id] = true;
        const allReady =
          Object.values(roomReadyStatus[room]).length === 2 &&
          Object.values(roomReadyStatus[room]).every(status => status);
        if (allReady) {
          // 각 플레이어 캐릭터 정보 저장
          gameStates[room].p1_character = roomPlayers[room][0].character;
          gameStates[room].p2_character = roomPlayers[room][1].character;
          // 패들 상태 초기화
          gameStates[room].paddleHeight = [75, 75];
          gameStates[room].paddleWidth = [10, 10];
          gameStates[room].paddleSpeed = [8, 8];
          gameStates[room].paddleY = [225, 225];
          // 점수/공 위치 등도 초기화
          gameStates[room].score = [0, 0];
          gameStates[room].ballX = 350;
          gameStates[room].ballY = 250;
          gameStates[room].speedX = 5;
          gameStates[room].speedY = 0;

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

    socket.on('requestRoomInfo', () =>{
      pongNamespace.in(room).emit('roomInfo', roomPlayers[room]);
    })

    socket.on('selectCharacter', (character) => {
      if (room && roomPlayers[room]) {
        const player = roomPlayers[room].find(p => p.id === socket.id);
        if (player) player.character = character;
        pongNamespace.in(room).emit('roomInfo', roomPlayers[room]);
      }
    });

    // 스킬 사용
    socket.on('useSkill', () => {
      const player = roomPlayers[room].find(p => p.id === socket.id);
      if (!player) return;
      const idx = getPlayerIndex(room, socket.id);
      if (idx !== 0 && idx !== 1) return;

      if (player.character === 'Mario') {
        // 패들 크기 증가
        gameStates[room].paddleHeight[idx] = 75 * 1.5;
        setTimeout(() => {
          // 스킬 효과 해제
          gameStates[room].paddleHeight[idx] = 75;
        }, 2000); // 2초간 유지
      }
      else if (player.character === 'Yoshi') {
        // 상대 패들 이동 속도 감소
        gameStates[room].paddleSpeed[1-idx] = 4;
        setTimeout(() => {
          gameStates[room].paddleSpeed[1-idx] = 8;
        }, 5000);
      } else if (player.character === 'PrincessPeach') {
        // 상대 패들 크기 감소
        gameStates[room].paddleHeight[1-idx] = 75 * 0.5;
        setTimeout(() => {
          // 스킬 효과 해제
          gameStates[room].paddleHeight[1-idx] = 75;
        }, 2000); // 2초간 유지
      } else if (player.character === 'Koopa') {
        // 공 속도 증가
        const idx = getPlayerIndex(room, socket.id);
        if(idx === 0 || idx === 1){
          gameStates[room].pendingBallSpeedUp[idx] = true;
        }
      } else if (player.character === 'Kinopio') {
        // 화면 가리기
        const idx = getPlayerIndex(room, socket.id);
        if(idx === 0 || idx === 1){
          const opponent = roomPlayers[room].find((p, i) => i !== idx);
          if (opponent) {
            pongNamespace.to(opponent.id).emit('blindEffect', { duration: 1000 });
          }
        }
      } else if (player.character === 'DonkeyKong') {
        // 분신 공 던지기
        const idx = getPlayerIndex(room, socket.id);
        if(idx === 0 || idx === 1){
          gameStates[room].pendingFakeBalls[idx] = true;
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
        // 패들 이동 제한: 패들 크기별로
        gameStates[room].targetPaddleY[idx] = Math.max(
          0,
          Math.min(data.yPosition, gameStates[room].height - gameStates[room].paddleHeight[idx])
        );
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
