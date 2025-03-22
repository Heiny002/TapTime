let scene, camera, renderer, castles = [], healthBars = [];
let isGameStarted = false;
let currentPlayer = null;

// Initialize socket connection
console.log('Initializing socket connection...');
const socket = io();

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

    socket.on('gameStart', (players) => {
        console.log('Game starting with players:', players);
        // Find current player
        currentPlayer = players.find(p => p.id === socket.id);
        console.log('Current player:', currentPlayer);
        startBattle(players);
    });

    socket.on('healthUpdate', (data) => {
        console.log('Health update received:', data);
        updateHealthBar(data.castle, data.health);
    });

    socket.on('gameOver', (data) => {
        console.log('Game over! Winner:', data.winner);
        alert(`Game Over! ${data.winner} wins!`);
        isGameStarted = false;
        currentPlayer = null;
    });

    socket.on('gameInProgress', () => {
        alert('Game is already in progress!');
    });
}

// Set up socket listeners immediately
setupSocketListeners();

// Initialize Three.js scene
function init() {
    console.log('Initializing Three.js scene...');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background

    // Position camera higher and further back for better view
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, 25); // Increased height and distance
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('gameScreen').appendChild(renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Increased light intensity
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Add ground plane
    const groundGeometry = new THREE.PlaneGeometry(30, 30); // Increased ground size
    const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x259521 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    console.log('Scene initialized with camera at:', camera.position);

    // Start animation loop
    animate();
}

// Create castle models
function createCastles(players) {
    console.log('Creating castles for players:', players);
    // Remove existing castles and health bars
    castles.forEach(castle => scene.remove(castle));
    castles = [];
    healthBars = [];

    // Create castles for each player
    players.forEach((player) => {
        // Create castle
        const castleGeometry = new THREE.BoxGeometry(2, 3, 2);
        const castleMaterial = new THREE.MeshPhongMaterial({ 
            color: player.color || 0x808080, // Default to gray if no color
            shininess: 100
        });
        const castle = new THREE.Mesh(castleGeometry, castleMaterial);
        castle.castShadow = true;
        castle.receiveShadow = true;

        // Position castles in a square formation
        switch(player.castle) {
            case 0: // Top castle (Red)
                castle.position.set(0, 1.5, -8);
                break;
            case 1: // Right castle (Blue)
                castle.position.set(8, 1.5, 0);
                break;
            case 2: // Left castle (Green)
                castle.position.set(-8, 1.5, 0);
                break;
            case 3: // Bottom castle (Yellow - Player's castle)
                castle.position.set(0, 1.5, 8);
                break;
        }

        scene.add(castle);
        castles[player.castle] = castle; // Store castle at its index position

        // Create health bar background (white)
        const healthBarGeometry = new THREE.PlaneGeometry(5, 0.5);
        const healthBarMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const healthBar = new THREE.Mesh(healthBarGeometry, healthBarMaterial);
        healthBar.position.copy(castle.position);
        healthBar.position.y += 2.5;
        healthBar.rotation.x = -Math.PI / 2;

        // Create health bar outline (black)
        const outlineGeometry = new THREE.PlaneGeometry(5.1, 0.6);
        const outlineMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000,
            side: THREE.DoubleSide
        });
        const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
        outline.position.copy(healthBar.position);
        outline.rotation.x = -Math.PI / 2;

        // Create health fill
        const healthFillGeometry = new THREE.PlaneGeometry(5, 0.5);
        const healthFillMaterial = new THREE.MeshBasicMaterial({ 
            color: player.color || 0xff0000 // Use castle color for health bar
        });
        const healthFill = new THREE.Mesh(healthFillGeometry, healthFillMaterial);
        healthFill.position.copy(healthBar.position);
        healthFill.scale.x = player.health / 10; // Set initial health
        healthFill.rotation.x = -Math.PI / 2;

        scene.add(outline);
        scene.add(healthBar);
        scene.add(healthFill);
        healthBars[player.castle] = healthFill; // Store health bar at castle's index

        console.log(`Castle ${player.castle} created at position:`, castle.position, 'with color:', player.color, 'for player:', player.username, 'health:', player.health);
    });

    // Force a render after creating castles
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
        console.log('Rendered scene after castle creation');
    }
}

// Update health bar
function updateHealthBar(castleIndex, health) {
    console.log('Updating health bar for castle', castleIndex, 'to', health);
    if (healthBars[castleIndex]) {
        const percentage = Math.max(0, health / 10); // Ensure percentage is between 0 and 1
        healthBars[castleIndex].scale.x = percentage;
        console.log(`Updated health bar for castle ${castleIndex} to ${percentage * 100}%`);
        
        // Force a render to ensure the health bar update is visible
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    } else {
        console.error('Health bar not found for castle index:', castleIndex);
    }
}

// Animation loop
function animate() {
    if (!isGameStarted) {
        console.log('Animation stopped - game not started');
        return;
    }
    
    requestAnimationFrame(animate);
    
    // Rotate castles slowly
    castles.forEach(castle => {
        castle.rotation.y += 0.005;
    });
    
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    } else {
        console.error('Missing renderer, scene, or camera in animate function');
    }
}

// Update waiting room player list
function updatePlayerList(players) {
    console.log('Updating player list with:', players);
    const playerList = document.getElementById('playerList');
    if (!playerList) {
        console.error('Player list element not found');
        return;
    }
    
    playerList.innerHTML = players.map(player => `<li>${player.username}</li>`).join('');
    
    // Show/hide start button based on player count
    const startButton = document.getElementById('startButton');
    if (startButton) {
        const shouldShow = players.length >= 1;
        startButton.style.display = shouldShow ? 'block' : 'none';
        console.log('Start button visibility:', shouldShow ? 'visible' : 'hidden', 'for', players.length, 'players');
    } else {
        console.error('Start button element not found');
    }
}

// Join game
function joinGame() {
    const username = document.getElementById('username').value;
    if (username.trim()) {
        currentPlayer = username;
        console.log('Joining game with username:', username);
        socket.emit('join', username);
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('waitingRoom').style.display = 'flex';
    }
}

// Add event listener for return key on username input
document.getElementById('username').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        joinGame();
    }
});

// Start game
function startGame() {
    console.log('Emitting startGame event');
    socket.emit('startGame');
}

// Start battle
function startBattle(players) {
    console.log('Starting battle with players:', players);
    
    // Hide waiting room and show game screen
    const waitingRoom = document.getElementById('waitingRoom');
    const gameScreen = document.getElementById('gameScreen');
    
    if (waitingRoom && gameScreen) {
        waitingRoom.style.display = 'none';
        gameScreen.style.display = 'block';
        
        // Ensure game screen is visible and has proper dimensions
        gameScreen.style.width = '100vw';
        gameScreen.style.height = '100vh';
        gameScreen.style.position = 'fixed';
        gameScreen.style.overflow = 'hidden';
        gameScreen.style.backgroundColor = '#000';
        
        console.log('Waiting room hidden, game screen shown');
        
        // Initialize Three.js scene first
        init();
        
        // Create castles after scene is initialized
        createCastles(players);
        
        // Only set game started after scene is initialized
        isGameStarted = true;
        
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
window.addEventListener('resize', () => {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});

// Add click handler for castles
function onCastleClick(event) {
    if (!isGameStarted || !currentPlayer) {
        console.log('Game not started or no current player');
        return;
    }

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(castles);

    if (intersects.length > 0) {
        const clickedCastle = intersects[0].object;
        const castleIndex = castles.indexOf(clickedCastle);
        console.log('Clicked castle index:', castleIndex, 'Current player castle:', currentPlayer.castle);
        
        // If clicking your own castle (yellow castle), restore health
        if (castleIndex === currentPlayer.castle) {
            console.log('Restoring health to player castle');
            socket.emit('restoreHealth', castleIndex);
            return;
        }
        
        // Emit attack event for enemy castles
        socket.emit('attackCastle', castleIndex);
    }
}

// Add event listener for castle clicks
window.addEventListener('click', onCastleClick); 