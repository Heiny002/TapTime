let scene, camera, renderer;
let castles = [];
let socket;
let currentPlayer;
let isGameStarted = false;

// Initialize Three.js scene
function init() {
    console.log('Initializing Three.js scene...');
    if (isGameStarted) {
        console.log('Scene already initialized');
        return;
    }
    
    try {
        // Create scene
        scene = new THREE.Scene();
        console.log('Scene created');

        // Create camera with adjusted position
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 15, 20); // Moved camera back and up for better view
        camera.lookAt(0, 0, 0);
        console.log('Camera created and positioned');

        // Create renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x87CEEB); // Sky blue background
        console.log('Renderer created and configured');
        
        // Get game screen element
        const gameScreen = document.getElementById('gameScreen');
        if (!gameScreen) {
            console.error('Game screen element not found!');
            return;
        }
        
        // Clear existing content and ensure proper styling
        gameScreen.innerHTML = '';
        gameScreen.style.width = '100vw';
        gameScreen.style.height = '100vh';
        gameScreen.style.position = 'fixed';
        gameScreen.style.overflow = 'hidden';
        gameScreen.style.backgroundColor = '#000';
        
        // Add renderer canvas with proper styling
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.position = 'fixed';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        gameScreen.appendChild(renderer.domElement);
        console.log('Renderer canvas added to game screen');

        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        console.log('Ambient light added');

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 5);
        scene.add(directionalLight);
        console.log('Directional light added');

        // Add ground plane
        const groundGeometry = new THREE.PlaneGeometry(30, 30);
        const groundMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x3a7e3a,
            side: THREE.DoubleSide,
            shininess: 0
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -1.5;
        scene.add(ground);
        console.log('Ground plane added');

        // Create castles
        createCastles();
        console.log('Castles created');
        
        // Force initial render
        renderer.render(scene, camera);
        console.log('Initial render completed');
        
        // Start animation
        animate();
        console.log('Animation started');
    } catch (error) {
        console.error('Error initializing scene:', error);
    }
}

// Create castle models
function createCastles() {
    console.log('Creating castles...');
    const castleGeometry = new THREE.BoxGeometry(2, 3, 2);
    const castleMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x808080,
        shininess: 30
    });

    // Top castle
    const topCastle = new THREE.Mesh(castleGeometry, castleMaterial);
    topCastle.position.set(0, 1.5, -8);
    scene.add(topCastle);
    castles.push({ mesh: topCastle, health: 100 });
    console.log('Top castle added at position:', topCastle.position);

    // Left castle
    const leftCastle = new THREE.Mesh(castleGeometry, castleMaterial);
    leftCastle.position.set(-8, 1.5, 0);
    scene.add(leftCastle);
    castles.push({ mesh: leftCastle, health: 100 });
    console.log('Left castle added at position:', leftCastle.position);

    // Right castle
    const rightCastle = new THREE.Mesh(castleGeometry, castleMaterial);
    rightCastle.position.set(8, 1.5, 0);
    scene.add(rightCastle);
    castles.push({ mesh: rightCastle, health: 100 });
    console.log('Right castle added at position:', rightCastle.position);

    // Create health bars
    createHealthBars();
    console.log('Health bars created');
}

// Create health bars for castles
function createHealthBars() {
    const healthBarsContainer = document.createElement('div');
    healthBarsContainer.id = 'healthBars';
    document.getElementById('gameScreen').appendChild(healthBarsContainer);
    
    castles.forEach((castle, index) => {
        const healthBar = document.createElement('div');
        healthBar.className = 'health-bar';
        healthBar.style.left = index === 0 ? '50%' : index === 1 ? '20%' : '80%';
        healthBar.style.top = '20px';
        
        const healthBarFill = document.createElement('div');
        healthBarFill.className = 'health-bar-fill';
        healthBar.appendChild(healthBarFill);
        
        healthBarsContainer.appendChild(healthBar);
        castle.healthBar = healthBarFill;
    });
}

// Animation loop
function animate() {
    if (!isGameStarted) {
        console.log('Animation stopped - game not started');
        return;
    }
    
    requestAnimationFrame(animate);
    
    // Add some rotation to the castles to make them more visible
    castles.forEach(castle => {
        castle.mesh.rotation.y += 0.01;
    });
    
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    } else {
        console.error('Missing renderer, scene, or camera in animate function');
    }
}

// Socket.IO connection and event handlers
function connectSocket() {
    console.log('Connecting to socket...');
    socket = io();
    
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
        startBattle(players);
    });
}

// Update waiting room player list
function updatePlayerList(players) {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = players.map(player => `<div>${player.username}</div>`).join('');
    const startButton = document.getElementById('startButton');
    startButton.style.display = 'block';
    console.log('Updated player list, start button visible:', startButton.style.display);
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
    
    // Only set game started after scene is initialized
    isGameStarted = true;
    
    // Force a render to ensure scene is visible
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
        console.log('Initial render completed');
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

// Initialize socket connection when page loads
connectSocket(); 