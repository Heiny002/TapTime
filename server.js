const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static('public'));

let players = [];
let gameStarted = false;

// Castle colors and positions
const CASTLE_COLORS = [
    0xff0000, // Red
    0x0000ff, // Blue
    0x00ff00, // Green
    0xffff00  // Yellow
];

// Fixed castle positions (these never change)
const CASTLE_POSITIONS = {
    TOP: 0,
    RIGHT: 1,
    LEFT: 2,
    BOTTOM: 3
};

// Shuffle array randomly
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

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

        // Get the real player
        const realPlayer = players.find(p => !p.id.startsWith('bot_'));
        
        // Randomly assign a color to the real player
        const availableColors = [...CASTLE_COLORS];
        shuffleArray(availableColors);
        const playerColor = availableColors[0]; // Player gets first random color
        
        // Assign the player's color to the bottom castle
        realPlayer.castle = CASTLE_POSITIONS.BOTTOM;
        realPlayer.color = playerColor;
        realPlayer.health = 10;

        // Remove the player's color from available colors
        availableColors.shift();
        
        // Create bots for the remaining positions (TOP, RIGHT, LEFT)
        const remainingPositions = [
            CASTLE_POSITIONS.TOP,
            CASTLE_POSITIONS.RIGHT,
            CASTLE_POSITIONS.LEFT
        ];

        // Clear existing bots
        players = players.filter(p => !p.id.startsWith('bot_'));
        
        // Add bots with remaining colors
        remainingPositions.forEach((position, index) => {
            const botId = `bot_${index}`;
            const botUsername = `Bot ${index + 1}`;
            players.push({
                id: botId,
                username: botUsername,
                castle: position,
                health: 10,
                color: availableColors[index]
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
            // Convert color value to team name
            let teamName;
            switch (winner.color) {
                case 0xff0000: // Red
                    teamName = "Red Team";
                    break;
                case 0x0000ff: // Blue
                    teamName = "Blue Team";
                    break;
                case 0x00ff00: // Green
                    teamName = "Green Team";
                    break;
                case 0xffff00: // Yellow
                    teamName = "Yellow Team";
                    break;
                default:
                    teamName = "Unknown Team";
            }
            io.emit('gameOver', { winner: teamName });
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

        // If all human players have left, end the game
        const humanPlayers = players.filter(p => !p.id.startsWith('bot_'));
        if (humanPlayers.length === 0) {
            gameStarted = false;
            players = [];
            io.emit('gameOver', { winner: 'No winner - all players disconnected' });
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 