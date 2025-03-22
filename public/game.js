let socket = io();
let currentUsername = '';
let scene, camera, renderer, ground;
let castles = [];
let healthBars = [];
let isGameStarted = false;
let currentPlayer = null;
let lastClickTime = 0;
const CLICK_COOLDOWN = 500; // 500ms cooldown between clicks

// Initialize socket connection
console.log('Initializing socket connection...');

// Socket.IO connection and event handlers
function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });

    socket.on('playerList', (players) => {
        console.log('Received player list:', players);
        updatePlayerList(players);
    });

    socket.on('teamAssigned', (data) => {
        console.log('Team assigned:', data);
        document.getElementById('waiting-room').style.display = 'none';
        document.getElementById('strategy-screen').style.display = 'block';
        
        // Store current player's team data
        currentPlayer = {
            team: data.team,
            teamColor: data.teamColor
        };
        
        // Assign random numbers to team members
        const teamSize = data.teamMembers.length;
        const numbers = Array.from({length: teamSize}, (_, i) => i + 1);
        // Shuffle numbers
        for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
        
        // Find current player's number
        const currentPlayerIndex = data.teamMembers.findIndex(m => m.username === currentUsername);
        const currentPlayerNumber = numbers[currentPlayerIndex];
        
        // Display team information with player number
        const teamInfo = document.getElementById('team-info');
        const teamColor = data.teamColor.toString(16).padStart(6, '0');
        teamInfo.innerHTML = `
            <div class="team-color" style="background-color: #${teamColor}"></div>
            <div class="player-info">
                <span>${currentUsername}</span>
                <span class="player-number">#${currentPlayerNumber}</span>
            </div>
            <span>Team ${['Red', 'Blue', 'Green', 'Yellow'][data.team]}</span>
        `;
        
        // Display team members
        const teamList = document.getElementById('team-list');
        teamList.innerHTML = '';
        
        data.teamMembers.forEach((member, index) => {
            const memberElement = document.createElement('div');
            memberElement.className = `team-member${member.username === currentUsername ? ' current-player' : ''}`;
            memberElement.innerHTML = `
                <span>${member.username}</span>
                <span class="member-number">#${numbers[index]}</span>
            `;
            teamList.appendChild(memberElement);
        });
    });

    socket.on('gameStart', (data) => {
        console.log('Game starting with data:', data);
        document.getElementById('strategy-screen').style.display = 'none';
        const gameScreen = document.getElementById('game-screen');
        gameScreen.style.display = 'block';
        gameScreen.style.width = '100vw';
        gameScreen.style.height = '100vh';
        gameScreen.style.position = 'fixed';
        gameScreen.style.overflow = 'hidden';
        gameScreen.style.backgroundColor = '#87CEEB';
        
        init(data.players);
    });

    socket.on('healthUpdate', (data) => {
        const { castle, health } = data;
        updateHealthBar(castle, health);
    });

    socket.on('gameOver', (winner) => {
        isGameStarted = false;
        alert(`Game Over! Team ${winner} wins!`);
        location.reload();
    });

    socket.on('gameInProgress', () => {
        alert('Game is already in progress!');
    });

    socket.on('castleUpdate', (data) => {
        const castle = castles.find(c => c.userData.team === data.team);
        if (castle) {
            castle.userData.health = data.health;
            updateHealthBar(castle, data.health);
        }
    });

    socket.on('error', (data) => {
        alert(data.message);
    });
}

// Set up socket listeners immediately
setupSocketListeners();

// Initialize Three.js scene
window.init = function(players) {
    console.log('Initializing game scene with players:', players);
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 15);
    camera.lookAt(0, 0, 0);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    
    // Clear any existing canvas
    const gameScreen = document.getElementById('game-screen');
    while (gameScreen.firstChild) {
        gameScreen.removeChild(gameScreen.firstChild);
    }
    
    // Add renderer to game screen
    gameScreen.appendChild(renderer.domElement);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Create ground
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x3a7e3a,
        roughness: 0.8,
        metalness: 0.2
    });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Create castles for each player
    createCastles(players);
    
    // Add window resize handler
    window.addEventListener('resize', onWindowResize, false);
    
    // Add click event listener
    renderer.domElement.addEventListener('click', onCastleClick, false);
    
    isGameStarted = true;
    
    // Start animation loop
    animate();
    
    // Force initial render
    renderer.render(scene, camera);
    
    console.log('Game scene initialized successfully');
};

// Create castle models
function createCastles(players) {
    console.log('Creating team castles for players:', players);
    
    // Clear existing castles and health bars
    castles.forEach(castle => {
        scene.remove(castle);
        castle.geometry.dispose();
        castle.material.dispose();
    });
    
    healthBars.forEach(bar => {
        if (bar && bar.parentNode) {
            bar.parentNode.removeChild(bar);
        }
    });
    
    castles = [];
    healthBars = [];
    
    const healthBarsContainer = document.getElementById('health-bars');
    if (healthBarsContainer) {
        healthBarsContainer.innerHTML = '';
    }

    // Fixed team colors
    const teamColors = {
        0: 0xff0000,  // Red
        1: 0x0000ff,  // Blue
        2: 0x00ff00,  // Green
        3: 0xffff00   // Yellow
    };

    // Find current player's team
    const currentPlayerData = players.find(p => p.username === currentUsername);
    if (!currentPlayerData) {
        console.error('Current player not found in players list');
        return;
    }

    // Create castles for each team
    for (let team = 0; team < 4; team++) {
        // Create castle geometry
        const castleGeometry = new THREE.BoxGeometry(2, 4, 2);
        const castleMaterial = new THREE.MeshStandardMaterial({ 
            color: teamColors[team],
            roughness: 0.7,
            metalness: 0.3
        });
        const castle = new THREE.Mesh(castleGeometry, castleMaterial);
        
        // Position castle in a circle, with current player's team castle at bottom
        const adjustedTeam = (team - currentPlayerData.team + 4) % 4; // Rotate so player's team is at bottom
        const angle = ((adjustedTeam + 2) / 4) * Math.PI * 2; // +2 to start from bottom
        const radius = 8;
        castle.position.x = Math.cos(angle) * radius;
        castle.position.z = Math.sin(angle) * radius;
        castle.position.y = 2; // Half the height of the castle
        castle.castShadow = true;
        castle.receiveShadow = true;
        
        // Get team members
        const teamMembers = players.filter(p => p.team === team);
        
        // Store team info in castle object
        castle.userData = {
            team: team,
            health: 10,
            teamMembers: teamMembers,
            teamColor: teamColors[team],
            isActive: true // Add active state
        };

        scene.add(castle);
        castles.push(castle);

        // Create health bar for team
        createHealthBar(castle, {
            username: `Team ${['Red', 'Blue', 'Green', 'Yellow'][team]}`,
            color: teamColors[team]
        });
    }
    
    console.log('Created team castles:', castles.length);
}

function createHealthBar(castle, player) {
    const healthBarContainer = document.createElement('div');
    healthBarContainer.className = 'health-bar-container';
    healthBarContainer.style.position = 'absolute';
    healthBarContainer.style.width = '100px';
    healthBarContainer.style.height = '20px';
    healthBarContainer.style.backgroundColor = '#333';
    healthBarContainer.style.borderRadius = '5px';
    healthBarContainer.style.overflow = 'hidden';
    healthBarContainer.style.display = 'flex';
    healthBarContainer.style.flexDirection = 'column';
    healthBarContainer.style.alignItems = 'center';

    // Add player name
    const playerName = document.createElement('div');
    playerName.style.color = '#fff';
    playerName.style.fontSize = '12px';
    playerName.style.marginBottom = '2px';
    playerName.textContent = player.username;
    healthBarContainer.appendChild(playerName);

    // Add health bar
    const healthBar = document.createElement('div');
    healthBar.className = 'health-bar';
    healthBar.style.width = '100%';
    healthBar.style.height = '8px';
    healthBar.style.backgroundColor = '#4CAF50';
    healthBar.style.transition = 'width 0.3s ease-in-out, background-color 0.3s ease-in-out';
    healthBarContainer.appendChild(healthBar);

    const healthBarsContainer = document.getElementById('health-bars');
    if (healthBarsContainer) {
        healthBarsContainer.appendChild(healthBarContainer);
    } else {
        document.body.appendChild(healthBarContainer);
    }
    
    healthBars.push(healthBarContainer);
    updateHealthBarPosition(castle, healthBarContainer);
}

function updateHealthBarPosition(castle, healthBar) {
    const vector = castle.position.clone();
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

    healthBar.style.left = `${x - 50}px`;
    healthBar.style.top = `${y - 20}px`;
}

// Update health bar
function updateHealthBar(castle, health) {
    const healthBar = healthBars[castles.indexOf(castle)];
    if (healthBar && castle.userData.isActive) {
        const healthPercent = Math.max(0, Math.min(100, (health / 10) * 100));
        healthBar.querySelector('.health-bar').style.width = `${healthPercent}%`;
        
        // Update color based on health
        const color = healthPercent > 60 ? '#4CAF50' : 
                     healthPercent > 30 ? '#FFA500' : '#FF0000';
        healthBar.querySelector('.health-bar').style.backgroundColor = color;

        // Update castle active state
        if (health <= 0) {
            castle.userData.isActive = false;
            healthBar.style.opacity = 0.5;
            castle.material.opacity = 0.5;
            castle.material.transparent = true;
        }
    }
}

// Animation loop
function animate() {
    if (!isGameStarted) {
        console.log('Animation stopped - game not started');
        return;
    }
    
    requestAnimationFrame(animate);
    
    // Update health bar positions
    castles.forEach((castle, index) => {
        updateHealthBarPosition(castle, healthBars[index]);
    });
    
    renderer.render(scene, camera);
}

// Update waiting room player list
function updatePlayerList(players) {
    const playersList = document.getElementById('players-list');
    if (!playersList) {
        console.error('Player list element not found');
        return;
    }
    
    playersList.innerHTML = '';
    
    // Calculate number of players per column (about 10 players per column)
    const playersPerColumn = 10;
    let currentColumn = document.createElement('div');
    currentColumn.className = 'tapper-column';
    
    players.forEach((player, index) => {
        if (index % playersPerColumn === 0 && index !== 0) {
            playersList.appendChild(currentColumn);
            currentColumn = document.createElement('div');
            currentColumn.className = 'tapper-column';
        }
        
        const playerElement = document.createElement('div');
        playerElement.className = 'tapper-name';
        if (player.username === currentUsername) {
            playerElement.classList.add('current-player');
        }
        playerElement.textContent = player.username;
        currentColumn.appendChild(playerElement);
    });
    
    // Append the last column
    if (currentColumn.children.length > 0) {
        playersList.appendChild(currentColumn);
    }
}

// Strategize function
window.strategize = function() {
    console.log('Strategizing...');
    socket.emit('strategize');
};

// Join game
window.joinGame = function() {
    const username = document.getElementById('username').value;
    if (username.trim() !== '') {
        console.log('Joining game with username:', username);
        currentUsername = username;
        socket.emit('join', username);
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('waiting-room').style.display = 'block';
    }
};

// Start game
window.startGame = function() {
    console.log('Starting game...');
    socket.emit('startGame');
};

// Start battle
function startBattle(players) {
    console.log('Starting battle with players:', players);
    
    // Hide waiting room and show game screen
    const waitingRoom = document.getElementById('waiting-room');
    const gameScreen = document.getElementById('game-screen');
    
    if (waitingRoom && gameScreen) {
        waitingRoom.style.display = 'none';
        gameScreen.style.display = 'block';
        
        // Ensure game screen is visible and has proper dimensions
        gameScreen.style.width = '100vw';
        gameScreen.style.height = '100vh';
        gameScreen.style.position = 'fixed';
        gameScreen.style.overflow = 'hidden';
        gameScreen.style.backgroundColor = '#87CEEB';
        
        console.log('Waiting room hidden, game screen shown');
        
        // Initialize Three.js scene first
        init(socket, players);
        
        // Force a render to ensure scene is visible
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
            console.log('Initial render completed');
        }
    } else {
        console.error('Could not find waiting room or game screen elements');
    }
}

// Handle window resize
function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Add click handler for castles
function onCastleClick(event) {
    if (!isGameStarted || !currentPlayer) {
        console.log('Game not started or no current player');
        return;
    }

    const currentTime = Date.now();
    if (currentTime - lastClickTime < CLICK_COOLDOWN) return;
    lastClickTime = currentTime;
    
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObjects(castles);
    if (intersects.length > 0) {
        const clickedCastle = intersects[0].object;
        
        // Only allow interaction with active castles
        if (!clickedCastle.userData.isActive) return;
        
        if (clickedCastle.userData.team === currentPlayer.team) {
            socket.emit('repair', { castleId: clickedCastle.userData.team });
        } else {
            socket.emit('attack', { castleId: clickedCastle.userData.team });
        }
    }
}

// Add event listener for castle clicks
window.addEventListener('click', onCastleClick); 