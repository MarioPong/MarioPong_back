const roomReadyStatus = {}

function listen(io) {
  const pongNamespace = io.of('/pong')
  pongNamespace.on('connection', (socket) => {
    let room

    console.log('a user connected', socket.id)

    socket.on('joinRoom', (roomName) => {
      const clients = pongNamespace.adapter.rooms.get(roomName)
      const numClients = clients ? clients.size : 0

      if (numClients >= 2) {
        socket.emit('roomFull', { message: '방이 가득 찼습니다.' })
        return
      }

      room = roomName
      socket.join(room)

      if (!roomReadyStatus[room]) roomReadyStatus[room] = {}
      roomReadyStatus[room][socket.id] = false

      console.log(`User ${socket.id} joined room ${room}`)
      socket.emit('enteredRoom', {message : '방에 입장했습니다'})
    })

    socket.on('ready', () => {
      if (room && roomReadyStatus[room]) {
        roomReadyStatus[room][socket.id] = true
        console.log('Player ready', socket.id, room)
        pongNamespace.in(room).emit('checkReady')
      }
    })

    socket.on('checkReady', () => {
      if (room && roomReadyStatus[room]) {
        const allReady = Object.values(roomReadyStatus[room]).length >= 2 &&
                        Object.values(roomReadyStatus[room]).every(status => status)

        if (allReady) {
          pongNamespace.in(room).emit('startGame')
        }
        else {
          pongNamespace.in(room).emit('notReady')
        }
      }
    })

    socket.on('componentLeft', (currentRoom) => {
      if (currentRoom && roomReadyStatus[currentRoom]) {
        roomReadyStatus[currentRoom][socket.id] = false
        console.log('Component left', socket.id, currentRoom)
        pongNamespace.in(currentRoom).emit('leftWhenReady')
      }
    })

    socket.on('leaveRoom', (currentRoom) => {
      console.log(`Client ${socketId} left`);
      delete roomReadyStatus[currentRoom][socket.id];
      if (Object.keys(roomReadyStatus[currentRoom]).length === 0) {
        delete roomReadyStatus[currentRoom];
      }
      pongNamespace.in(room).emit('checkReady')
      pongNamespace.in(currentRoom).emit('leftWhenReady')
    
      socket.leave(room)
    })

    socket.on('paddleMove', (paddleData) => {
      socket.to(room).emit('paddleMove', paddleData)
    })

    socket.on('ballMove', (ballData) => {
      socket.to(room).emit('ballMove', ballData);
    })

    socket.on('disconnect', (reason) => {
      console.log(`Client ${socket.id} disconnected: ${reason}`)
      socket.leave(room)
    })   
  })
}

module.exports = {
  listen,
}
