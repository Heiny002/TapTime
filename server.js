const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');

app.use(express.static('public'));

// Port handling
function findAvailablePort(startPort) {
    return new Promise((resolve, reject) => {
        const tryPort = (port) => {
            const testServer = http.createServer();
            testServer.listen(port, () => {
                testServer.once('close', () => {
                    resolve(port);
                });
                testServer.close();
            });
            testServer.on('error', () => {
                tryPort(port + 1);
            });
        };
        tryPort(startPort);
    });
}

// List of fun dummy usernames
const dummyUsernames = [
    'Dingus', 'Bobo', 'CoolCat', 'NinjaMaster', 'PixelPirate',
    'WizardKing', 'DragonSlayer', 'MemeQueen', 'CyberPunk', 'GalaxyGamer',
    'RainbowWarrior', 'SpaceNinja', 'TacoMaster', 'UnicornRider', 'ZombieHunter',
    'BananaBoss', 'CheeseWizard', 'DoodleMaster', 'EpicGamer', 'FortressKeeper',
    'GhostRider', 'HamburgerHero', 'IceCreamKing', 'JellyBean', 'KittenMaster',
    'LavaLord', 'MoonWalker', 'NoodleNinja', 'OrangePeel', 'PizzaPrince',
    'QuackMaster', 'RobotRider', 'SushiSamurai', 'ThunderThief', 'UfoHunter',
    'VirtualViking', 'WaffleWarrior', 'XtremeGamer', 'YetiYeller', 'ZenMaster',
    'AstroAce', 'BubbleBuddy', 'CosmicCowboy', 'DanceKing', 'ElectroNinja',
    'FrogPrince', 'GummyBear', 'HotSauce', 'IcyPhoenix', 'JumpMaster',
    'KarateKid', 'LemonLord', 'MagicMuffin', 'NeonKnight', 'OceanRider',
    'PandaPal', 'QuantumQuester', 'RainMaker', 'SnowboardKing', 'TigerTamer',
    'UmbrellaDude', 'VortexViper', 'WildWizard', 'XrayRider', 'YarnMaster',
    'ZigZagZombie', 'ArcadeKing', 'BattleBoss', 'CandyCrusher', 'DuckMaster',
    'EagleEye', 'FireFighter', 'GlowWorm', 'HyperHero', 'IronMaster',
    'JungleKing', 'KoalaKing', 'LightningLord', 'MountainMaster', 'NinjaKnight',
    'OrbitRider', 'PixelPuncher', 'QuicksilverKid', 'RocketRider', 'StarLord',
    'TreasureHunter', 'UltraGamer', 'VaporKing', 'WaveRider', 'XenonMaster',
    'YoYoMaster', 'ZenWarrior', 'AlphaGamer', 'BetaBlaster', 'CrystalKnight',
    'DinoRider', 'EchoFighter', 'FrostKing', 'GalaxyRider', 'HeroMaster',
    'IceWarrior', 'JetRider', 'KingPin', 'LaserLord', 'MetalMaster', 'NeonNinja'
];

// Game state
let players = [];
let gameStarted = false;
let castleHealth = {
    0: 10, // Yellow team (1)
    1: 10, // Red team (2)
    2: 10, // Blue team (3)
    3: 10  // Green team (4)
};
let activeCastles = new Set([0, 1, 2, 3]);

// Team colors (constants)
const TEAM_COLORS = {
    YELLOW: 0xE9D229,  // Team 0 (Key 1)
    RED: 0xCC1F11,     // Team 1 (Key 2)
    BLUE: 0x0A48A2,    // Team 2 (Key 3)
    GREEN: 0x3BA226    // Team 3 (Key 4)
};

// Shuffle array randomly
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Initialize dummy players
function initializeDummyPlayers() {
    players = [];
    // Add exactly 2196 dummy players (549 * 4 teams = 2196)
    for (let i = 0; i < 2196; i++) {
        players.push({
            id: `dummy_${i}`,
            username: dummyUsernames[i % dummyUsernames.length], // Cycle through usernames
            castle: null,
            health: 10,
            isDummy: true,
            team: null
        });
    }
}

// Assign teams to all players
function assignTeams(realPlayerId) {
    // Shuffle all players
    let allPlayers = shuffleArray([...players]);
    
    // Find and remove the real player
    const realPlayerIndex = allPlayers.findIndex(p => p.id === realPlayerId);
    const realPlayer = allPlayers[realPlayerIndex];
    allPlayers.splice(realPlayerIndex, 1);
    
    // Randomly assign the real player to a team (0-3)
    const realPlayerTeam = Math.floor(Math.random() * 4);
    realPlayer.team = realPlayerTeam;
    
    // Calculate players per team (should be 549 for each team)
    const playersPerTeam = Math.floor(allPlayers.length / 4);
    
    // Create team arrays
    const teams = [[], [], [], []];
    teams[realPlayerTeam].push(realPlayer);
    
    // Distribute remaining players evenly
    for (let team = 0; team < 4; team++) {
        const targetCount = team === realPlayerTeam ? playersPerTeam : playersPerTeam + 1;
        while (teams[team].length < targetCount && allPlayers.length > 0) {
            const player = allPlayers.pop();
            player.team = team;
            teams[team].push(player);
        }
    }
    
    // Flatten teams back into players array
    players = teams.flat();
    
    // Return the team info for the real player
    return {
        team: realPlayerTeam,
        teamMembers: teams[realPlayerTeam],
        teamColor: Object.values(TEAM_COLORS)[realPlayerTeam]
    };
}

// Initialize dummy players at server start
initializeDummyPlayers();

io.on('connection', (socket) => {
    console.log('A user connected with ID:', socket.id);

    socket.on('join', (username) => {
        console.log('Player joined:', username);
        const player = {
            id: socket.id,
            username: username,
            castle: null,
            health: 10,
            isDummy: false,
            team: null
        };
        players.push(player);
        console.log('Current players:', players);
        io.emit('playerList', players);
    });

    socket.on('strategize', () => {
        const player = players.find(p => p.id === socket.id);
        if (!player) return;

        // Reset game state when entering strategy screen
        gameStarted = false;
        castleHealth = {
            0: 10,
            1: 10,
            2: 10,
            3: 10
        };
        activeCastles = new Set([0, 1, 2, 3]);

        const teamAssignment = assignTeams(socket.id);
        socket.emit('teamAssigned', teamAssignment);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        players = players.filter(player => player.id !== socket.id);
        console.log('Updated players after disconnect:', players);
        io.emit('playerList', players);
    });

    // Handle game start
    socket.on('startGame', () => {
        console.log('Game start requested');
        
        // Check if there are enough players
        if (players.length < 2) {
            console.log('Not enough players to start game');
            socket.emit('error', { message: 'Need at least 2 players to start the game' });
            return;
        }
        
        // Set game as started
        gameStarted = true;
        
        // Initialize game state
        castleHealth = {
            0: 10,
            1: 10,
            2: 10,
            3: 10
        };
        activeCastles = new Set([0, 1, 2, 3]);
        
        // Broadcast game start to all players
        io.emit('gameStart', {
            players: players,
            castleHealth: castleHealth
        });
        
        console.log('Game started with players:', players);
    });

    // Handle castle attack
    socket.on('attack', ({ castleId }) => {
        if (!gameStarted) return;
        
        const player = players.find(p => p.id === socket.id);
        if (!player || player.team === castleId || !activeCastles.has(castleId)) return;
        
        castleHealth[castleId] -= 1;
        
        // Check if castle is destroyed
        if (castleHealth[castleId] <= 0) {
            activeCastles.delete(castleId);
            
            // Check if game is over
            if (activeCastles.size === 1) {
                const winningTeam = Array.from(activeCastles)[0];
                io.emit('gameOver', ['Yellow', 'Red', 'Blue', 'Green'][winningTeam]);
                gameStarted = false;
            }
        }
        
        // Broadcast health update
        io.emit('castleUpdate', {
            team: castleId,
            health: castleHealth[castleId]
        });
    });

    // Handle castle repair
    socket.on('repair', ({ castleId }) => {
        if (!gameStarted) return;
        
        const player = players.find(p => p.id === socket.id);
        if (!player || player.team !== castleId || !activeCastles.has(castleId)) return;
        
        castleHealth[castleId] = Math.min(10, castleHealth[castleId] + 1);
        
        // Broadcast health update
        io.emit('castleUpdate', {
            team: castleId,
            health: castleHealth[castleId]
        });
    });
});

// Start server with automatic port finding
async function startServer() {
    try {
        const port = await findAvailablePort(3000);
        server.listen(port, () => {
            console.log(`\nServer running on port ${port}`);
            console.log('\nAccess from other devices using:');
            console.log(`http://${require('os').networkInterfaces()['en0']?.[1]?.address || 'localhost'}:${port}`);
            console.log('\nOr use localhost on this machine:');
            console.log(`http://localhost:${port}\n`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
    }
}

startServer(); 