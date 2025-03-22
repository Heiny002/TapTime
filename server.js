const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const players = new Map();
let gameStarted = false;

io.on('connection', (socket) => {
    console.log('A user connected with ID:', socket.id);

    socket.on('join', (username) => {
        console.log('Player joined:', username);
        // Remove any existing entry for this username
        for (const [id, player] of players.entries()) {
            if (player.username === username) {
                players.delete(id);
                break;
            }
        }
        // Add the new player
        players.set(socket.id, {
            username: username,
            castle: null
        });
        const playerList = Array.from(players.values());
        console.log('Current players:', playerList);
        io.emit('playerList', playerList);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        players.delete(socket.id);
        const playerList = Array.from(players.values());
        console.log('Updated players after disconnect:', playerList);
        io.emit('playerList', playerList);
    });

    socket.on('startGame', () => {
        const playerList = Array.from(players.values());
        console.log('Start game requested. Current players:', playerList);
        if (!gameStarted) {
            gameStarted = true;
            console.log('Starting game with players:', playerList);
            io.emit('gameStart', playerList);
        } else {
            console.log('Game already started');
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 