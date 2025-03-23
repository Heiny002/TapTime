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
            if (port > startPort + 10) {
                console.error('Could not find available port in range. Using default port 3000.');
                resolve(3000);
                return;
            }
            
            const testServer = http.createServer();
            testServer.listen(port, () => {
                testServer.once('close', () => {
                    resolve(port);
                });
                testServer.close();
            });
            testServer.on('error', () => {
                // Kill any existing process on port 3000 if that's what we're trying
                if (port === 3000) {
                    require('child_process').exec(`lsof -ti:${port} | xargs kill -9`, (err) => {
                        if (!err) {
                            // Try port 3000 again after killing the process
                            setTimeout(() => tryPort(port), 1000);
                        } else {
                            tryPort(port + 1);
                        }
                    });
                } else {
                    tryPort(port + 1);
                }
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

// Dummy player manager with balanced team distribution
const DummyPlayerManager = {
    template: {
        castle: null,
        health: 10,
        isDummy: true,
        team: null
    },
    
    // Shuffle array with deduplication of consecutive names
    shuffleAndDeduplicate(array) {
        const result = [];
        const available = [...array];
        let lastUsername = null;
        
        while (available.length > 0) {
            // Filter out usernames that match the last one used
            const validChoices = available.filter(dummy => dummy.username !== lastUsername);
            
            // If no valid choices (only duplicates left), reset lastUsername
            if (validChoices.length === 0) {
                lastUsername = null;
                continue;
            }
            
            // Pick random valid dummy
            const index = Math.floor(Math.random() * validChoices.length);
            const chosen = validChoices[index];
            
            // Remove the chosen dummy from available pool
            const availableIndex = available.findIndex(d => d.id === chosen.id);
            available.splice(availableIndex, 1);
            
            // Add to result and update lastUsername
            result.push(chosen);
            lastUsername = chosen.username;
        }
        
        return result;
    },
    
    getTeamDummies(team, count) {
        const dummies = [];
        const usedUsernames = new Set();
        
        for (let i = 0; i < count; i++) {
            // Get random username, avoiding recent duplicates if possible
            let username;
            const availableUsernames = dummyUsernames.filter(name => !usedUsernames.has(name));
            
            if (availableUsernames.length > 0) {
                username = availableUsernames[Math.floor(Math.random() * availableUsernames.length)];
                usedUsernames.add(username);
                // Keep set size manageable to allow reuse of names
                if (usedUsernames.size > 20) {
                    usedUsernames.clear();
                }
            } else {
                username = dummyUsernames[Math.floor(Math.random() * dummyUsernames.length)];
            }
            
            const dummy = {
                ...this.template,
                id: `dummy_${Math.floor(Math.random() * 10000)}`,
                username,
                team
            };
            dummies.push(dummy);
        }
        
        return this.shuffleAndDeduplicate(dummies);
    },
    
    // Get a balanced set of dummy players for all teams
    getBalancedDummies(realPlayerTeam, playersPerTeam) {
        const dummies = [];
        for (let team = 0; team < 4; team++) {
            const count = team === realPlayerTeam ? playersPerTeam - 1 : playersPerTeam;
            dummies.push(...this.getTeamDummies(team, count));
        }
        return this.shuffleAndDeduplicate(dummies);
    }
};

// Assign teams to players
function assignTeams(socketId) {
    console.log('Assigning teams...');
    
    // Find the real player
    const realPlayer = players.find(p => p.id === socketId);
    if (!realPlayer) {
        console.error('Real player not found');
        return null;
    }
    
    // Randomly assign the real player to a team
    const realPlayerTeam = Math.floor(Math.random() * 4);
    realPlayer.team = realPlayerTeam;
    
    // Get balanced dummy players for all teams
    const PLAYERS_PER_TEAM = 25; // 25 players per team = 100 total - 1 real player = 99 dummies
    const dummyPlayers = DummyPlayerManager.getBalancedDummies(realPlayerTeam, PLAYERS_PER_TEAM);
    
    // Update players array with real player and balanced dummies
    players = [realPlayer, ...dummyPlayers];
    
    // Get team members for the real player's team
    const teamMembers = players.filter(p => p.team === realPlayerTeam);
    
    return {
        team: realPlayerTeam,
        teamMembers: teamMembers,
        teamColor: Object.values(TEAM_COLORS)[realPlayerTeam]
    };
}

// Optimize player list for display
function getDisplayPlayers() {
    // Show all players in the waiting room
    return players;
}

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
        
        // Clear existing players when a new real player joins
        players = [player];
        
        // Add dummy players to reach 99 (plus 1 real player = 100 total)
        const PLAYERS_PER_TEAM = 25; // 25 players per team = 100 total - 1 real player = 99 dummies
        const dummyPlayers = DummyPlayerManager.getBalancedDummies(null, PLAYERS_PER_TEAM);
        players = [...players, ...dummyPlayers];
        
        console.log('Current players:', players.length);
        // Send the complete player list to all clients
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
        // Send the complete player list to all clients
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
        // Always try to use port 3000 first
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