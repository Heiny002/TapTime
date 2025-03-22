const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static('public'));

let players = [];
let gameStarted = false;

io.on('connection', (socket) => {
    console.log('A user connected with ID:', socket.id);

    socket.on('join', (username) => {
        console.log('Player joined:', username);
        const player = {
            id: socket.id,
            username: username,
            castle: null,
            health: 10
        };
        players.push(player);
        console.log('Current players:', players);
        io.emit('playerList', players);
    });

    socket.on('startGame', () => {
        console.log('Start game requested. Current players:', players);
        if (gameStarted) {
            console.log('Game already started');
            socket.emit('gameInProgress');
            return;
        }
        
        if (players.length < 1) {
            console.log('No players to start game');
            return;
        }
        
        console.log('Starting game with players:', players);
        gameStarted = true;
        
        // Remove any existing bots
        players = players.filter(p => !p.id.startsWith('bot_'));
        
        // Assign the yellow castle (bottom) to the real player
        players.forEach((player) => {
            if (!player.id.startsWith('bot_')) {
                player.castle = 3; // Player gets the yellow castle (index 3)
                player.color = 0xffff00; // Yellow color
                player.health = 10;
            }
        });

        // Add bots for the remaining positions
        const botColors = [0xff0000, 0x0000ff, 0x00ff00]; // Red, Blue, Green
        const botPositions = [0, 1, 2]; // Top, Right, Left positions
        
        botPositions.forEach((position, index) => {
            const botId = `bot_${index}`;
            const botUsername = `Bot ${index + 1}`;
            players.push({
                id: botId,
                username: botUsername,
                castle: position,
                health: 10,
                color: botColors[index]
            });
        });
        
        console.log('Final player list with castles:', players);
        io.emit('gameStart', players);
    });

    socket.on('attackCastle', (targetCastle) => {
        const attacker = players.find(p => p.id === socket.id);
        if (!attacker) return;

        const target = players.find(p => p.castle === targetCastle);
        if (!target || target.id === socket.id) return;

        target.health -= 1;
        io.emit('healthUpdate', { castle: targetCastle, health: target.health });

        // Check for game over
        const alivePlayers = players.filter(p => p.health > 0);
        if (alivePlayers.length === 1) {
            const winner = alivePlayers[0];
            io.emit('gameOver', { winner: winner.username });
            gameStarted = false;
            players = [];
        }
    });

    socket.on('restoreHealth', (castleIndex) => {
        const player = players.find(p => p.id === socket.id);
        if (!player || player.castle !== castleIndex) return;

        // Only restore health if it's less than 10
        if (player.health < 10) {
            player.health = Math.min(10, player.health + 1);
            io.emit('healthUpdate', { castle: castleIndex, health: player.health });
            console.log(`Restored health to castle ${castleIndex}. New health: ${player.health}`);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        players = players.filter(player => player.id !== socket.id);
        console.log('Updated players after disconnect:', players);
        io.emit('playerList', players);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 