// SkiFree Clone
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');

// Game constants
const GAME_WIDTH = 640;
const GAME_HEIGHT = 480;
const SKIER_SIZE = 20;
const TREE_SPAWN_RATE = 0.03;
const ROCK_SPAWN_RATE = 0.015;
const JUMP_SPAWN_RATE = 0.008;

// Game state
let gameState = 'playing'; // 'playing', 'crashed', 'caught', 'jumping'
let distance = 0;
let speed = 5;
let baseSpeed = 5;
let maxSpeed = 15;
let jumpHeight = 0;
let jumpVelocity = 0;

// Skier
const skier = {
    x: GAME_WIDTH / 2,
    y: 150,
    angle: 0, // -2 to 2 (-2 = left, 0 = down, 2 = right)
    width: SKIER_SIZE,
    height: SKIER_SIZE * 1.5
};

// Mouse position
let mouseX = GAME_WIDTH / 2;
let useMouseControl = false;

// Obstacles array
let obstacles = [];

// Yeti
const yeti = {
    x: 0,
    y: -200,
    active: false,
    speed: 4,
    width: 40,
    height: 50,
    frame: 0
};

// Input state
const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    space: false,
    boost: false
};

// Initialize obstacles
function initObstacles() {
    obstacles = [];
    for (let i = 0; i < 30; i++) {
        spawnObstacle(Math.random() * GAME_HEIGHT + GAME_HEIGHT);
    }
}

// Spawn obstacle at given y position
function spawnObstacle(y) {
    const rand = Math.random();
    let type;
    if (rand < 0.6) type = 'tree';
    else if (rand < 0.85) type = 'rock';
    else type = 'jump';

    obstacles.push({
        x: Math.random() * (GAME_WIDTH - 40) + 20,
        y: y,
        type: type,
        width: type === 'tree' ? 30 : type === 'rock' ? 25 : 40,
        height: type === 'tree' ? 40 : type === 'rock' ? 20 : 10
    });
}

// Draw pixel art tree
function drawTree(x, y) {
    ctx.fillStyle = '#228B22';
    // Tree layers
    ctx.beginPath();
    ctx.moveTo(x, y - 35);
    ctx.lineTo(x - 15, y - 10);
    ctx.lineTo(x + 15, y - 10);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, y - 25);
    ctx.lineTo(x - 18, y + 5);
    ctx.lineTo(x + 18, y + 5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, y - 15);
    ctx.lineTo(x - 20, y + 20);
    ctx.lineTo(x + 20, y + 20);
    ctx.closePath();
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - 5, y + 15, 10, 15);

    // Snow on tree
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - 3, y - 33, 6, 4);
    ctx.fillRect(x - 8, y - 20, 5, 3);
    ctx.fillRect(x + 3, y - 18, 5, 3);
}

// Draw pixel art rock
function drawRock(x, y) {
    ctx.fillStyle = '#696969';
    ctx.beginPath();
    ctx.ellipse(x, y, 15, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#808080';
    ctx.beginPath();
    ctx.ellipse(x - 3, y - 3, 8, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Snow patches
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(x + 5, y - 5, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
}

// Draw jump ramp
function drawJump(x, y) {
    ctx.fillStyle = '#DEB887';
    ctx.beginPath();
    ctx.moveTo(x - 20, y + 5);
    ctx.lineTo(x - 15, y - 5);
    ctx.lineTo(x + 15, y - 5);
    ctx.lineTo(x + 20, y + 5);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();
}

// Draw skier
function drawSkier() {
    ctx.save();
    ctx.translate(skier.x, skier.y - jumpHeight);

    // Shadow (only when jumping)
    if (jumpHeight > 0) {
        ctx.fillStyle = `rgba(0,0,0,${0.3 - jumpHeight / 200})`;
        ctx.beginPath();
        ctx.ellipse(0, jumpHeight + 10, 15 - jumpHeight / 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Crashed state
    if (gameState === 'crashed') {
        // Draw crashed skier
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(-15, -5, 30, 10);
        ctx.fillStyle = '#FFE4C4';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        // Skis scattered
        ctx.fillStyle = '#4169E1';
        ctx.save();
        ctx.rotate(0.5);
        ctx.fillRect(-20, 10, 25, 4);
        ctx.restore();
        ctx.save();
        ctx.rotate(-0.3);
        ctx.fillRect(5, 15, 25, 4);
        ctx.restore();
        ctx.restore();
        return;
    }

    // Rotate based on direction
    const rotation = skier.angle * 0.4;
    ctx.rotate(rotation);

    // Skis
    ctx.fillStyle = '#4169E1';
    if (skier.angle === 0) {
        // Straight down - skis parallel
        ctx.fillRect(-8, 5, 4, 20);
        ctx.fillRect(4, 5, 4, 20);
    } else {
        // Turning - skis angled
        ctx.save();
        ctx.rotate(skier.angle * 0.1);
        ctx.fillRect(-10, 5, 20, 4);
        ctx.restore();
    }

    // Body
    ctx.fillStyle = '#FF4500';
    ctx.fillRect(-6, -15, 12, 20);

    // Head
    ctx.fillStyle = '#FFE4C4';
    ctx.beginPath();
    ctx.arc(0, -20, 8, 0, Math.PI * 2);
    ctx.fill();

    // Hat
    ctx.fillStyle = '#1E90FF';
    ctx.beginPath();
    ctx.arc(0, -24, 6, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-6, -26, 12, 4);

    // Poles
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    if (skier.angle <= 0) {
        ctx.beginPath();
        ctx.moveTo(-8, -5);
        ctx.lineTo(-20, 15);
        ctx.stroke();
    }
    if (skier.angle >= 0) {
        ctx.beginPath();
        ctx.moveTo(8, -5);
        ctx.lineTo(20, 15);
        ctx.stroke();
    }

    ctx.restore();
}

// Draw yeti
function drawYeti() {
    if (!yeti.active) return;

    ctx.save();
    ctx.translate(yeti.x, yeti.y);

    // Animation frame
    const bounce = Math.sin(Date.now() / 100) * 3;

    // Body
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(0, bounce, 25, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    // Arms
    ctx.fillStyle = '#FFFFFF';
    const armSwing = Math.sin(Date.now() / 150) * 0.3;
    ctx.save();
    ctx.rotate(-0.5 + armSwing);
    ctx.beginPath();
    ctx.ellipse(-30, -10 + bounce, 12, 8, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.rotate(0.5 - armSwing);
    ctx.beginPath();
    ctx.ellipse(30, -10 + bounce, 12, 8, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Face
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(0, -25 + bounce, 18, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(-7, -28 + bounce, 5, 0, Math.PI * 2);
    ctx.arc(7, -28 + bounce, 5, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-7, -28 + bounce, 2, 0, Math.PI * 2);
    ctx.arc(7, -28 + bounce, 2, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.fillStyle = '#8B0000';
    ctx.beginPath();
    ctx.ellipse(0, -18 + bounce, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Teeth
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-6, -20 + bounce, 4, 4);
    ctx.fillRect(2, -20 + bounce, 4, 4);

    // Legs
    ctx.fillStyle = '#FFFFFF';
    const legSwing = Math.sin(Date.now() / 100) * 5;
    ctx.beginPath();
    ctx.ellipse(-10, 35 + bounce + legSwing, 10, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(10, 35 + bounce - legSwing, 10, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// Draw snow particles
let snowParticles = [];
function initSnow() {
    for (let i = 0; i < 50; i++) {
        snowParticles.push({
            x: Math.random() * GAME_WIDTH,
            y: Math.random() * GAME_HEIGHT,
            size: Math.random() * 3 + 1,
            speed: Math.random() * 2 + 1
        });
    }
}

function drawSnow() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    snowParticles.forEach(particle => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function updateSnow() {
    snowParticles.forEach(particle => {
        particle.y -= speed * 0.5;
        particle.x += Math.sin(Date.now() / 1000 + particle.y) * 0.5;

        if (particle.y < 0) {
            particle.y = GAME_HEIGHT;
            particle.x = Math.random() * GAME_WIDTH;
        }
        if (particle.x < 0) particle.x = GAME_WIDTH;
        if (particle.x > GAME_WIDTH) particle.x = 0;
    });
}

// Collision detection
function checkCollision(obj) {
    // Skip collision while jumping high enough
    if (jumpHeight > 20 && obj.type !== 'jump') return false;

    const skierBox = {
        x: skier.x - 10,
        y: skier.y - 20,
        width: 20,
        height: 30
    };

    const objBox = {
        x: obj.x - obj.width / 2,
        y: obj.y - obj.height / 2,
        width: obj.width,
        height: obj.height
    };

    return skierBox.x < objBox.x + objBox.width &&
           skierBox.x + skierBox.width > objBox.x &&
           skierBox.y < objBox.y + objBox.height &&
           skierBox.y + skierBox.height > objBox.y;
}

// Check yeti collision
function checkYetiCollision() {
    if (!yeti.active) return false;

    const dist = Math.sqrt(
        Math.pow(skier.x - yeti.x, 2) +
        Math.pow(skier.y - yeti.y, 2)
    );

    return dist < 40;
}

// Update game state
function update() {
    if (gameState === 'crashed') {
        // Allow restart after crash
        return;
    }

    if (gameState === 'caught') {
        return;
    }

    // Handle input
    if (useMouseControl) {
        const diff = mouseX - skier.x;
        if (Math.abs(diff) > 30) {
            skier.angle = diff > 0 ? Math.min(2, diff / 50) : Math.max(-2, diff / 50);
        } else {
            skier.angle = diff / 30;
        }
    } else {
        if (keys.left && skier.angle > -2) skier.angle -= 0.15;
        if (keys.right && skier.angle < 2) skier.angle += 0.15;
        if (!keys.left && !keys.right) {
            // Return to center gradually
            if (skier.angle > 0.1) skier.angle -= 0.05;
            else if (skier.angle < -0.1) skier.angle += 0.05;
            else skier.angle = 0;
        }
    }

    // Speed control
    if (keys.up) speed = Math.max(2, speed - 0.1);
    if (keys.down || keys.boost) speed = Math.min(maxSpeed, speed + 0.2);
    if (!keys.up && !keys.down && !keys.boost) {
        // Gradually return to base speed
        if (speed > baseSpeed) speed -= 0.05;
        if (speed < baseSpeed) speed += 0.02;
    }

    // Jumping physics
    if (jumpHeight > 0 || jumpVelocity > 0) {
        jumpHeight += jumpVelocity;
        jumpVelocity -= 0.8; // Gravity

        if (jumpHeight <= 0) {
            jumpHeight = 0;
            jumpVelocity = 0;
            gameState = 'playing';
        }
    }

    // Move skier horizontally based on angle
    skier.x += skier.angle * speed * 0.5;

    // Keep skier in bounds
    skier.x = Math.max(20, Math.min(GAME_WIDTH - 20, skier.x));

    // Update distance
    distance += speed * 0.5;

    // Move obstacles
    obstacles.forEach(obs => {
        obs.y -= speed;
    });

    // Remove off-screen obstacles and spawn new ones
    obstacles = obstacles.filter(obs => obs.y > -50);

    // Spawn new obstacles
    if (Math.random() < TREE_SPAWN_RATE * speed / 5) {
        spawnObstacle(GAME_HEIGHT + 50);
    }
    if (Math.random() < ROCK_SPAWN_RATE * speed / 5) {
        spawnObstacle(GAME_HEIGHT + 50);
    }
    if (Math.random() < JUMP_SPAWN_RATE * speed / 5) {
        spawnObstacle(GAME_HEIGHT + 50);
    }

    // Check collisions
    obstacles.forEach(obs => {
        if (checkCollision(obs)) {
            if (obs.type === 'jump') {
                if (jumpHeight === 0) {
                    jumpVelocity = 12;
                    gameState = 'jumping';
                }
            } else {
                gameState = 'crashed';
                speed = 0;
            }
        }
    });

    // Activate yeti after 2000m
    if (distance > 2000 && !yeti.active) {
        yeti.active = true;
        yeti.x = Math.random() * GAME_WIDTH;
        yeti.y = GAME_HEIGHT + 100;
    }

    // Update yeti
    if (yeti.active) {
        // Yeti chases skier
        const dx = skier.x - yeti.x;
        const dy = skier.y - yeti.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            yeti.x += (dx / dist) * yeti.speed;
            yeti.y += (dy / dist) * yeti.speed - speed * 0.7;
        }

        // Yeti gets faster over time
        yeti.speed = Math.min(8, 4 + (distance - 2000) / 1000);

        // Keep yeti from going too far off screen
        if (yeti.y < -100) {
            yeti.y = GAME_HEIGHT + 50;
            yeti.x = Math.random() * GAME_WIDTH;
        }

        if (checkYetiCollision() && jumpHeight < 20) {
            gameState = 'caught';
        }
    }

    // Update snow
    updateSnow();
}

// Render game
function render() {
    // Clear canvas with snow background
    ctx.fillStyle = '#E8E8E8';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw ski tracks (subtle effect)
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 2;

    // Sort obstacles by y position for proper layering
    const sortedObstacles = [...obstacles].sort((a, b) => a.y - b.y);

    // Draw obstacles
    sortedObstacles.forEach(obs => {
        if (obs.y > -50 && obs.y < GAME_HEIGHT + 50) {
            if (obs.type === 'tree') {
                drawTree(obs.x, obs.y);
            } else if (obs.type === 'rock') {
                drawRock(obs.x, obs.y);
            } else if (obs.type === 'jump') {
                drawJump(obs.x, obs.y);
            }
        }
    });

    // Draw skier
    drawSkier();

    // Draw yeti
    drawYeti();

    // Draw snow particles
    drawSnow();

    // Update score display
    scoreDisplay.textContent = `Distance: ${Math.floor(distance)}m | Speed: ${speed.toFixed(1)} ${yeti.active ? '| ⚠️ YETI!' : ''}`;

    // Draw game over overlay
    if (gameState === 'crashed') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 48px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('CRASHED!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);

        ctx.font = '24px Courier New';
        ctx.fillText(`Distance: ${Math.floor(distance)}m`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
        ctx.fillText('Press SPACE or CLICK to restart', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60);
    }

    if (gameState === 'caught') {
        ctx.fillStyle = 'rgba(139, 0, 0, 0.7)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 48px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('EATEN BY YETI!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);

        ctx.font = '24px Courier New';
        ctx.fillText(`Distance: ${Math.floor(distance)}m`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
        ctx.fillText('Press SPACE or CLICK to restart', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60);
    }
}

// Reset game
function resetGame() {
    gameState = 'playing';
    distance = 0;
    speed = baseSpeed;
    skier.x = GAME_WIDTH / 2;
    skier.angle = 0;
    jumpHeight = 0;
    jumpVelocity = 0;
    yeti.active = false;
    yeti.y = -200;
    initObstacles();
}

// Game loop
function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// Event listeners
document.addEventListener('keydown', (e) => {
    useMouseControl = false;
    switch (e.key.toLowerCase()) {
        case 'arrowleft':
        case 'a':
            keys.left = true;
            break;
        case 'arrowright':
        case 'd':
            keys.right = true;
            break;
        case 'arrowup':
        case 'w':
            keys.up = true;
            break;
        case 'arrowdown':
        case 's':
            keys.down = true;
            break;
        case ' ':
            if (gameState === 'crashed' || gameState === 'caught') {
                resetGame();
            } else {
                keys.space = true;
            }
            e.preventDefault();
            break;
        case 'f':
            keys.boost = true;
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch (e.key.toLowerCase()) {
        case 'arrowleft':
        case 'a':
            keys.left = false;
            break;
        case 'arrowright':
        case 'd':
            keys.right = false;
            break;
        case 'arrowup':
        case 'w':
            keys.up = false;
            break;
        case 'arrowdown':
        case 's':
            keys.down = false;
            break;
        case ' ':
            keys.space = false;
            break;
        case 'f':
            keys.boost = false;
            break;
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    useMouseControl = true;
});

canvas.addEventListener('click', () => {
    if (gameState === 'crashed' || gameState === 'caught') {
        resetGame();
    }
});

// Prevent context menu on right click
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Initialize and start game
initSnow();
initObstacles();
gameLoop();
