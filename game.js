// SkiFree Clone - Enhanced with Mobile Support, Yeti Chase Mechanics & Power-ups
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');

// Game constants (logical resolution)
const GAME_WIDTH = 640;
const GAME_HEIGHT = 480;
const SKIER_SIZE = 20;
const TREE_SPAWN_RATE = 0.03;
const ROCK_SPAWN_RATE = 0.015;
const JUMP_SPAWN_RATE = 0.008;
const POWERUP_SPAWN_RATE = 0.004;

// Canvas scaling for responsive/mobile display
let scale = 1;
function resizeCanvas() {
    const maxW = window.innerWidth - 10;
    const maxH = window.innerHeight - 130;
    scale = Math.min(maxW / GAME_WIDTH, maxH / GAME_HEIGHT, 1.5);
    canvas.style.width  = (GAME_WIDTH  * scale) + 'px';
    canvas.style.height = (GAME_HEIGHT * scale) + 'px';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game state
let gameState = 'playing'; // 'playing', 'crashed', 'caught', 'jumping'
let distance = 0;
let speed = 5;
let baseSpeed = 5;
let maxSpeed = 15;
let jumpHeight = 0;
let jumpVelocity = 0;

// Power-up state
let heldPowerup = null;
let powerupPickups = [];
let powerupProjectiles = [];
let shieldActive = false;
let shieldTimer = 0;
let freezeActive = false;
let freezeTimer = 0;
let boostActive = false;
let boostTimer = 0;

// Skier
const skier = {
    x: GAME_WIDTH / 2,
    y: 150,
    angle: 0, // -2 to 2
    width: SKIER_SIZE,
    height: SKIER_SIZE * 1.5
};

// Mouse/touch position
let mouseX = GAME_WIDTH / 2;
let useMouseControl = false;

// Obstacles
let obstacles = [];

// Yeti
const yeti = {
    x: 0,
    y: -200,
    active: false,
    speed: 4,
    width: 40,
    height: 50,
    frozen: false,
    frozenTimer: 0,
    stunned: false,
    stunnedTimer: 0,
    retreatCooldown: 0  // distance remaining before yeti returns after being outskied
};

// Input state
const keys = {
    left: false, right: false, up: false, down: false, space: false, boost: false
};

// Touch state
let activeTouchId = null;
let touchCurrentX = null;

// Power-up types & visuals
const POWERUP_TYPES  = ['boost', 'snowball', 'shield', 'freeze', 'bomb'];
const POWERUP_COLORS = {
    boost:    '#FFD700',
    snowball: '#87CEEB',
    shield:   '#00FF7F',
    freeze:   '#00BFFF',
    bomb:     '#FF6347'
};
const POWERUP_LABELS = {
    boost: 'B', snowball: 'S', shield: 'SH', freeze: 'F', bomb: '!'
};

// ─── Initialisation ──────────────────────────────────────────────────────────

function initObstacles() {
    obstacles = [];
    powerupPickups = [];
    powerupProjectiles = [];
    for (let i = 0; i < 30; i++) {
        spawnObstacle(Math.random() * GAME_HEIGHT + GAME_HEIGHT);
    }
}

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
        width:  type === 'tree' ? 30 : type === 'rock' ? 25 : 40,
        height: type === 'tree' ? 40 : type === 'rock' ? 20 : 10,
        destroyed: false
    });
}

function spawnPowerup(y) {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerupPickups.push({
        x: Math.random() * (GAME_WIDTH - 60) + 30,
        y: y,
        type: type,
        radius: 15,
        bobOffset: Math.random() * Math.PI * 2
    });
}

// ─── Drawing helpers ─────────────────────────────────────────────────────────

function drawTree(x, y) {
    ctx.fillStyle = '#228B22';
    ctx.beginPath(); ctx.moveTo(x, y-35); ctx.lineTo(x-15, y-10); ctx.lineTo(x+15, y-10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y-25); ctx.lineTo(x-18, y+5);  ctx.lineTo(x+18, y+5);  ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y-15); ctx.lineTo(x-20, y+20); ctx.lineTo(x+20, y+20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8B4513'; ctx.fillRect(x-5, y+15, 10, 15);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x-3, y-33, 6, 4);
    ctx.fillRect(x-8, y-20, 5, 3);
    ctx.fillRect(x+3, y-18, 5, 3);
}

function drawRock(x, y) {
    ctx.fillStyle = '#696969';
    ctx.beginPath(); ctx.ellipse(x, y, 15, 10, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#808080';
    ctx.beginPath(); ctx.ellipse(x-3, y-3, 8, 5, 0.3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.ellipse(x+5, y-5, 4, 2, 0, 0, Math.PI*2); ctx.fill();
}

function drawJump(x, y) {
    ctx.fillStyle = '#DEB887';
    ctx.beginPath();
    ctx.moveTo(x-20, y+5); ctx.lineTo(x-15, y-5);
    ctx.lineTo(x+15, y-5); ctx.lineTo(x+20, y+5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(x, y+8, 18, 4, 0, 0, Math.PI*2); ctx.fill();
}

function drawPowerupPickup(p) {
    const bob = Math.sin(Date.now() / 400 + p.bobOffset) * 4;
    ctx.save();
    ctx.shadowColor = POWERUP_COLORS[p.type];
    ctx.shadowBlur = 16;
    ctx.fillStyle = POWERUP_COLORS[p.type];
    ctx.beginPath(); ctx.arc(p.x, p.y + bob, p.radius, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#FFF'; ctx.lineWidth = 2; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000';
    ctx.font = `bold ${p.radius * 0.9}px Courier New`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(POWERUP_LABELS[p.type], p.x, p.y + bob);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
}

function drawSkier() {
    ctx.save();
    ctx.translate(skier.x, skier.y - jumpHeight);

    // Shield glow
    if (shieldActive) {
        ctx.strokeStyle = `rgba(0,255,127,${0.5 + 0.5 * Math.sin(Date.now() / 100)})`;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, -10, 28, 0, Math.PI*2); ctx.stroke();
    }

    // Jump shadow
    if (jumpHeight > 0) {
        ctx.fillStyle = `rgba(0,0,0,${0.3 - jumpHeight / 200})`;
        ctx.beginPath(); ctx.ellipse(0, jumpHeight + 10, 15 - jumpHeight/10, 5, 0, 0, Math.PI*2); ctx.fill();
    }

    if (gameState === 'crashed') {
        ctx.fillStyle = '#FF0000'; ctx.fillRect(-15, -5, 30, 10);
        ctx.fillStyle = '#FFE4C4'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#4169E1';
        ctx.save(); ctx.rotate(0.5);  ctx.fillRect(-20, 10, 25, 4); ctx.restore();
        ctx.save(); ctx.rotate(-0.3); ctx.fillRect(5,  15, 25, 4); ctx.restore();
        ctx.restore(); return;
    }

    ctx.rotate(skier.angle * 0.4);

    // Skis
    ctx.fillStyle = '#4169E1';
    if (skier.angle === 0) {
        ctx.fillRect(-8, 5, 4, 20); ctx.fillRect(4, 5, 4, 20);
    } else {
        ctx.save(); ctx.rotate(skier.angle * 0.1); ctx.fillRect(-10, 5, 20, 4); ctx.restore();
    }

    // Body – orange when boosting
    ctx.fillStyle = boostActive ? '#FF8C00' : '#FF4500';
    ctx.fillRect(-6, -15, 12, 20);

    // Head
    ctx.fillStyle = '#FFE4C4'; ctx.beginPath(); ctx.arc(0, -20, 8, 0, Math.PI*2); ctx.fill();

    // Hat
    ctx.fillStyle = '#1E90FF'; ctx.beginPath(); ctx.arc(0, -24, 6, Math.PI, 0); ctx.fill();
    ctx.fillRect(-6, -26, 12, 4);

    // Poles
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    if (skier.angle <= 0) { ctx.beginPath(); ctx.moveTo(-8,-5); ctx.lineTo(-20,15); ctx.stroke(); }
    if (skier.angle >= 0) { ctx.beginPath(); ctx.moveTo(8,-5);  ctx.lineTo(20,15);  ctx.stroke(); }

    ctx.restore();
}

function drawYeti() {
    if (!yeti.active) return;
    ctx.save();
    ctx.translate(yeti.x, yeti.y);

    // Frozen overlay
    if (yeti.frozen) {
        ctx.fillStyle = 'rgba(0,191,255,0.35)';
        ctx.beginPath(); ctx.ellipse(0, 0, 35, 50, 0, 0, Math.PI*2); ctx.fill();
    }

    const bounce   = (yeti.frozen || yeti.stunned) ? 0 : Math.sin(Date.now() / 100) * 3;
    const bodyCol  = yeti.frozen ? '#ADD8E6' : '#FFFFFF';
    const armSwing = (yeti.frozen || yeti.stunned) ? 0 : Math.sin(Date.now() / 150) * 0.3;

    // Body
    ctx.fillStyle = bodyCol;
    ctx.beginPath(); ctx.ellipse(0, bounce, 25, 30, 0, 0, Math.PI*2); ctx.fill();

    // Arms
    ctx.save(); ctx.rotate(-0.5 + armSwing);
    ctx.beginPath(); ctx.ellipse(-30, -10+bounce, 12, 8, 0.5, 0, Math.PI*2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.rotate(0.5 - armSwing);
    ctx.beginPath(); ctx.ellipse(30, -10+bounce, 12, 8, -0.5, 0, Math.PI*2); ctx.fill(); ctx.restore();

    // Face
    ctx.fillStyle = bodyCol;
    ctx.beginPath(); ctx.ellipse(0, -25+bounce, 18, 15, 0, 0, Math.PI*2); ctx.fill();

    // Eyes
    ctx.fillStyle = yeti.frozen ? '#4169E1' : '#FF0000';
    ctx.beginPath(); ctx.arc(-7, -28+bounce, 5, 0, Math.PI*2); ctx.arc(7, -28+bounce, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-7, -28+bounce, 2, 0, Math.PI*2); ctx.arc(7, -28+bounce, 2, 0, Math.PI*2); ctx.fill();

    // Mouth
    ctx.fillStyle = '#8B0000'; ctx.beginPath(); ctx.ellipse(0, -18+bounce, 8, 5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-6, -20+bounce, 4, 4); ctx.fillRect(2, -20+bounce, 4, 4);

    // Legs
    const legSwing = (yeti.frozen || yeti.stunned) ? 0 : Math.sin(Date.now() / 100) * 5;
    ctx.fillStyle = bodyCol;
    ctx.beginPath();
    ctx.ellipse(-10, 35+bounce+legSwing, 10, 15, 0, 0, Math.PI*2);
    ctx.ellipse(10,  35+bounce-legSwing, 10, 15, 0, 0, Math.PI*2);
    ctx.fill();

    // Stunned stars
    if (yeti.stunned) {
        for (let i = 0; i < 3; i++) {
            const ang = Date.now()/300 + i * Math.PI * 2/3;
            ctx.fillStyle = '#FFD700';
            ctx.beginPath(); ctx.arc(Math.cos(ang)*30, -55+Math.sin(ang)*8, 5, 0, Math.PI*2); ctx.fill();
        }
    }

    ctx.restore();
}

function drawProjectiles() {
    powerupProjectiles.forEach(proj => {
        ctx.save();
        ctx.translate(proj.x, proj.y);
        if (proj.type === 'snowball') {
            ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#87CEEB'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        } else if (proj.type === 'bomb') {
            ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#FFD700'; ctx.fillRect(-2, -18, 4, 8);
            if (Math.random() < 0.5) {
                ctx.fillStyle = '#FF4500';
                ctx.beginPath(); ctx.arc(Math.random()*6-3, -20, 4, 0, Math.PI*2); ctx.fill();
            }
        }
        ctx.restore();
    });
}

// ─── Snow particles ───────────────────────────────────────────────────────────

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
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    snowParticles.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); });
}
function updateSnow() {
    snowParticles.forEach(p => {
        p.y -= speed * 0.5;
        p.x += Math.sin(Date.now()/1000 + p.y) * 0.5;
        if (p.y < 0)           { p.y = GAME_HEIGHT; p.x = Math.random() * GAME_WIDTH; }
        if (p.x < 0)             p.x = GAME_WIDTH;
        if (p.x > GAME_WIDTH)    p.x = 0;
    });
}

// ─── Collision detection ──────────────────────────────────────────────────────

function checkCollision(obj) {
    if (jumpHeight > 20 && obj.type !== 'jump') return false;
    const sx = skier.x - 10, sy = skier.y - 20;
    const ox = obj.x - obj.width/2, oy = obj.y - obj.height/2;
    return sx < ox + obj.width && sx + 20 > ox && sy < oy + obj.height && sy + 30 > oy;
}

function checkYetiCollision() {
    if (!yeti.active) return false;
    const dx = skier.x - yeti.x, dy = skier.y - yeti.y;
    return Math.sqrt(dx*dx + dy*dy) < 40;
}

function checkPowerupCollision(p) {
    const dx = skier.x - p.x, dy = skier.y - p.y;
    return Math.sqrt(dx*dx + dy*dy) < p.radius + 15;
}

// ─── Power-up actions ─────────────────────────────────────────────────────────

function usePowerup() {
    if (!heldPowerup) return;
    const type = heldPowerup;
    heldPowerup = null;

    if (type === 'boost') {
        boostActive = true;
        boostTimer = 300;
        speed = Math.min(maxSpeed, speed + 4);

    } else if (type === 'shield') {
        shieldActive = true;
        shieldTimer = 360;

    } else if (type === 'snowball') {
        // Aimed toward yeti if active, otherwise straight up
        let vx = 0, vy = -10;
        if (yeti.active) {
            const dx = yeti.x - skier.x;
            const dy = yeti.y - skier.y;
            const d  = Math.sqrt(dx*dx + dy*dy) || 1;
            vx = (dx/d) * 10;
            vy = (dy/d) * 10 - speed * 0.5;
        }
        powerupProjectiles.push({ type: 'snowball', x: skier.x, y: skier.y, vx, vy, scrollCompensation: true });

    } else if (type === 'freeze') {
        freezeActive = true;
        freezeTimer = 240;
        if (yeti.active) { yeti.frozen = true; yeti.frozenTimer = 240; }

    } else if (type === 'bomb') {
        powerupProjectiles.push({
            type: 'bomb', x: skier.x, y: skier.y,
            vx: skier.angle * 2, vy: -6,
            timer: 60, scrollCompensation: true
        });
    }
}

function explodeBomb(bx, by) {
    const R = 80;
    obstacles.forEach(obs => {
        const dx = bx - obs.x, dy = by - obs.y;
        if (Math.sqrt(dx*dx + dy*dy) < R) obs.destroyed = true;
    });
    if (yeti.active) {
        const dx = bx - yeti.x, dy = by - yeti.y;
        if (Math.sqrt(dx*dx + dy*dy) < R) { yeti.stunned = true; yeti.stunnedTimer = 300; }
    }
}

// ─── HUD ──────────────────────────────────────────────────────────────────────

function drawPowerupHUD() {
    const hx = 10, hy = GAME_HEIGHT - 52;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(hx, hy, 130, 42);
    ctx.strokeStyle = heldPowerup ? POWERUP_COLORS[heldPowerup] : '#555';
    ctx.lineWidth = 2; ctx.strokeRect(hx, hy, 130, 42);

    ctx.fillStyle = '#CCC'; ctx.font = '11px Courier New'; ctx.textAlign = 'left';
    ctx.fillText('POWER-UP:', hx + 5, hy + 14);

    if (heldPowerup) {
        ctx.fillStyle = POWERUP_COLORS[heldPowerup];
        ctx.fillRect(hx + 5, hy + 18, 120, 18);
        ctx.fillStyle = '#000'; ctx.font = 'bold 12px Courier New';
        ctx.fillText(heldPowerup.toUpperCase() + ' – USE [E]', hx + 8, hy + 31);
    } else {
        ctx.fillStyle = '#666'; ctx.font = '11px Courier New';
        ctx.fillText('none', hx + 5, hy + 31);
    }

    // Active timers
    let ty = hy - 6;
    const badge = (label, col, sec) => {
        ctx.fillStyle = col; ctx.fillRect(hx, ty - 15, 100, 16);
        ctx.fillStyle = '#000'; ctx.font = 'bold 11px Courier New';
        ctx.fillText(label + ' ' + sec + 's', hx + 3, ty - 2);
        ty -= 19;
    };
    if (shieldActive) badge('SHIELD',   'rgba(0,255,127,0.85)', Math.ceil(shieldTimer/60));
    if (boostActive)  badge('BOOST',    'rgba(255,200,0,0.85)', Math.ceil(boostTimer/60));
    if (yeti.frozen)  badge('YT FROZE', 'rgba(0,191,255,0.85)', Math.ceil(yeti.frozenTimer/60));
    if (yeti.stunned) badge('YT STUN',  'rgba(255,215,0,0.85)', Math.ceil(yeti.stunnedTimer/60));
}

function drawMobileButtons() {
    // Jump button – bottom right
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.arc(GAME_WIDTH - 40, GAME_HEIGHT - 40, 28, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#FFF'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 12px Courier New';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('JUMP', GAME_WIDTH - 40, GAME_HEIGHT - 40);
    ctx.textBaseline = 'alphabetic';
}

// ─── Update ───────────────────────────────────────────────────────────────────

function update() {
    if (gameState === 'crashed' || gameState === 'caught') return;

    // Steering – follow touch/mouse X position
    if (useMouseControl) {
        const diff = mouseX - skier.x;
        skier.angle = Math.abs(diff) > 30
            ? (diff > 0 ? Math.min(2, diff/50) : Math.max(-2, diff/50))
            : diff / 30;
    } else {
        if (keys.left  && skier.angle > -2) skier.angle -= 0.15;
        if (keys.right && skier.angle <  2) skier.angle += 0.15;
        if (!keys.left && !keys.right) {
            if (skier.angle >  0.1) skier.angle -= 0.05;
            else if (skier.angle < -0.1) skier.angle += 0.05;
            else skier.angle = 0;
        }
    }

    // Speed
    if (keys.up) speed = Math.max(2, speed - 0.1);
    if (keys.down || keys.boost) speed = Math.min(maxSpeed, speed + 0.2);
    if (!keys.up && !keys.down && !keys.boost) {
        if (speed > baseSpeed) speed -= 0.05;
        if (speed < baseSpeed) speed += 0.02;
    }

    // Active power-up timers
    if (boostActive)  { boostTimer--;  if (boostTimer  <= 0) boostActive  = false; }
    if (shieldActive) { shieldTimer--; if (shieldTimer <= 0) shieldActive = false; }
    if (yeti.frozen)  { yeti.frozenTimer--;  if (yeti.frozenTimer  <= 0) yeti.frozen  = false; }
    if (yeti.stunned) { yeti.stunnedTimer--; if (yeti.stunnedTimer <= 0) yeti.stunned = false; }
    if (freezeActive) { freezeTimer--; if (freezeTimer <= 0) freezeActive = false; }

    // Jump physics
    if (jumpHeight > 0 || jumpVelocity > 0) {
        jumpHeight += jumpVelocity;
        jumpVelocity -= 0.8;
        if (jumpHeight <= 0) { jumpHeight = 0; jumpVelocity = 0; gameState = 'playing'; }
    }

    // Horizontal movement
    skier.x += skier.angle * speed * 0.5;
    skier.x = Math.max(20, Math.min(GAME_WIDTH - 20, skier.x));

    // Distance
    distance += speed * 0.5;

    // Move obstacles (frozen = paused)
    if (!freezeActive) {
        obstacles.forEach(obs => { obs.y -= speed; });
        powerupPickups.forEach(p  => { p.y  -= speed; });
    }

    // Cull off-screen
    obstacles     = obstacles.filter(o => o.y > -50 && !o.destroyed);
    powerupPickups = powerupPickups.filter(p => p.y > -50);

    // Spawn obstacles & power-ups
    if (Math.random() < TREE_SPAWN_RATE   * speed/5) spawnObstacle(GAME_HEIGHT + 50);
    if (Math.random() < ROCK_SPAWN_RATE   * speed/5) spawnObstacle(GAME_HEIGHT + 50);
    if (Math.random() < JUMP_SPAWN_RATE   * speed/5) spawnObstacle(GAME_HEIGHT + 50);
    if (Math.random() < POWERUP_SPAWN_RATE * speed/5) spawnPowerup(GAME_HEIGHT + 50);

    // Collect power-ups
    for (let i = powerupPickups.length - 1; i >= 0; i--) {
        if (checkPowerupCollision(powerupPickups[i])) {
            heldPowerup = powerupPickups[i].type;
            powerupPickups.splice(i, 1);
        }
    }

    // Obstacle collisions
    if (!shieldActive) {
        for (const obs of obstacles) {
            if (checkCollision(obs)) {
                if (obs.type === 'jump') {
                    if (jumpHeight === 0) { jumpVelocity = 12; gameState = 'jumping'; }
                } else {
                    gameState = 'crashed'; speed = 0;
                }
            }
        }
    }

    // Power-up projectiles
    for (let i = powerupProjectiles.length - 1; i >= 0; i--) {
        const proj = powerupProjectiles[i];
        proj.x += proj.vx;
        // scrollCompensation keeps projectile at same world-position as it flies
        proj.y += proj.vy - speed * 0.5;

        // Bomb fuse countdown
        if (proj.type === 'bomb') {
            proj.timer--;
            if (proj.timer <= 0) {
                explodeBomb(proj.x, proj.y);
                powerupProjectiles.splice(i, 1);
                continue;
            }
        }

        // Hit yeti
        if (yeti.active && !yeti.frozen && !yeti.stunned) {
            const dx = proj.x - yeti.x, dy = proj.y - yeti.y;
            if (Math.sqrt(dx*dx + dy*dy) < 50) {
                if (proj.type === 'snowball') { yeti.stunned = true; yeti.stunnedTimer = 180; }
                else if (proj.type === 'bomb') { explodeBomb(proj.x, proj.y); }
                powerupProjectiles.splice(i, 1); continue;
            }
        }

        // Hit obstacle
        let hitObstacle = false;
        for (const obs of obstacles) {
            if (obs.type === 'jump') continue;
            const dx = proj.x - obs.x, dy = proj.y - obs.y;
            if (Math.sqrt(dx*dx + dy*dy) < 25) {
                obs.destroyed = true; hitObstacle = true; break;
            }
        }
        if (hitObstacle) { powerupProjectiles.splice(i, 1); continue; }

        // Cull
        if (proj.y < -80 || proj.y > GAME_HEIGHT + 80 || proj.x < -80 || proj.x > GAME_WIDTH + 80) {
            powerupProjectiles.splice(i, 1);
        }
    }

    // ── Yeti logic ────────────────────────────────────────────────────────────

    // Yeti first appears at 5000 m
    if (distance > 5000 && !yeti.active && yeti.retreatCooldown <= 0) {
        yeti.active = true;
        yeti.x = Math.random() * GAME_WIDTH;
        yeti.y = GAME_HEIGHT + 100;
        yeti.stunned = false;
        yeti.frozen  = false;
    }

    // Tick retreat cooldown (distance-based)
    if (!yeti.active && yeti.retreatCooldown > 0) {
        yeti.retreatCooldown -= speed * 0.5;
        if (yeti.retreatCooldown < 0) yeti.retreatCooldown = 0;
    }

    if (yeti.active) {
        if (!yeti.frozen && !yeti.stunned) {
            const dx = skier.x - yeti.x, dy = skier.y - yeti.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0) {
                yeti.x += (dx/dist) * yeti.speed;
                yeti.y += (dy/dist) * yeti.speed - speed * 0.7;
            }
        } else if (yeti.stunned) {
            // Stumble backward while stunned
            yeti.y -= speed * 0.4;
        }

        // Yeti gradually speeds up the longer it chases
        yeti.speed = Math.min(8, 4 + (distance - 5000) / 2000);

        // Skier outran yeti – yeti goes far off the top of the screen
        if (yeti.y < -350) {
            yeti.active = false;
            yeti.retreatCooldown = 3000; // skier must travel 3000 m before yeti returns
        }

        // Catch the skier
        if (checkYetiCollision() && jumpHeight < 20 && !shieldActive) {
            gameState = 'caught';
        }
    }

    updateSnow();
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
    // Snow background
    ctx.fillStyle = '#E8E8E8';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Obstacles (sorted by depth)
    const sorted = [...obstacles].sort((a, b) => a.y - b.y);
    sorted.forEach(obs => {
        if (obs.y > -50 && obs.y < GAME_HEIGHT + 50) {
            if      (obs.type === 'tree') drawTree(obs.x, obs.y);
            else if (obs.type === 'rock') drawRock(obs.x, obs.y);
            else if (obs.type === 'jump') drawJump(obs.x, obs.y);
        }
    });

    // Power-up pickups
    powerupPickups.forEach(p => {
        if (p.y > -50 && p.y < GAME_HEIGHT + 50) drawPowerupPickup(p);
    });

    // Projectiles
    drawProjectiles();

    // Skier
    drawSkier();

    // Yeti
    drawYeti();

    // Snow
    drawSnow();

    // HUD
    drawPowerupHUD();
    drawMobileButtons();

    // "Yeti returning" warning banner
    if (!yeti.active && yeti.retreatCooldown > 0 && distance > 5000) {
        const pulse = 0.4 + 0.4 * Math.sin(Date.now() / 200);
        ctx.fillStyle = `rgba(139,0,0,${pulse})`;
        ctx.fillRect(GAME_WIDTH/2 - 100, 5, 200, 26);
        ctx.fillStyle = '#FFF'; ctx.font = 'bold 13px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('YETI IS COMING BACK...', GAME_WIDTH/2, 23);
    }

    // Score bar
    let status = '';
    if (yeti.active) {
        if      (yeti.frozen)  status = ' | YETI FROZEN!';
        else if (yeti.stunned) status = ' | YETI STUNNED!';
        else                   status = ' | YETI CHASING!';
    } else if (yeti.retreatCooldown > 0 && distance > 5000) {
        status = ' | Yeti regrouping...';
    } else if (distance < 5000) {
        const mLeft = Math.ceil((5000 - distance) / 1);
        status = ` | Yeti at ${Math.floor(mLeft)}m`;
    }
    scoreDisplay.textContent =
        `Distance: ${Math.floor(distance)}m | Speed: ${speed.toFixed(1)}${status}`;

    // Game-over overlays
    if (gameState === 'crashed' || gameState === 'caught') {
        ctx.fillStyle = gameState === 'caught' ? 'rgba(139,0,0,0.7)' : 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#FFF'; ctx.font = 'bold 48px Courier New'; ctx.textAlign = 'center';
        ctx.fillText(gameState === 'caught' ? 'EATEN BY YETI!' : 'CRASHED!', GAME_WIDTH/2, GAME_HEIGHT/2 - 20);
        ctx.font = '24px Courier New';
        ctx.fillText(`Distance: ${Math.floor(distance)}m`, GAME_WIDTH/2, GAME_HEIGHT/2 + 20);
        ctx.fillText('Tap / SPACE to restart', GAME_WIDTH/2, GAME_HEIGHT/2 + 60);
    }
}

// ─── Reset ────────────────────────────────────────────────────────────────────

function resetGame() {
    gameState = 'playing';
    distance = 0; speed = baseSpeed;
    skier.x = GAME_WIDTH / 2; skier.angle = 0;
    jumpHeight = 0; jumpVelocity = 0;
    yeti.active = false; yeti.y = -200;
    yeti.retreatCooldown = 0;
    yeti.frozen = false; yeti.stunned = false;
    heldPowerup = null;
    boostActive = shieldActive = freezeActive = false;
    boostTimer = shieldTimer = freezeTimer = 0;
    powerupProjectiles = []; powerupPickups = [];
    initObstacles();
}

// ─── Game loop ────────────────────────────────────────────────────────────────

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// ─── Keyboard input ───────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
    useMouseControl = false;
    switch (e.key.toLowerCase()) {
        case 'arrowleft': case 'a':  keys.left  = true; break;
        case 'arrowright': case 'd': keys.right = true; break;
        case 'arrowup': case 'w':    keys.up    = true; break;
        case 'arrowdown': case 's':  keys.down  = true; break;
        case 'f': keys.boost = true; break;
        case ' ':
            if (gameState === 'crashed' || gameState === 'caught') { resetGame(); }
            else if (heldPowerup) { usePowerup(); }
            else { keys.space = true; }
            e.preventDefault(); break;
        case 'e': case 'q': usePowerup(); break;
    }
});
document.addEventListener('keyup', e => {
    switch (e.key.toLowerCase()) {
        case 'arrowleft': case 'a':  keys.left  = false; break;
        case 'arrowright': case 'd': keys.right = false; break;
        case 'arrowup': case 'w':    keys.up    = false; break;
        case 'arrowdown': case 's':  keys.down  = false; break;
        case 'f': keys.boost = false; break;
        case ' ': keys.space = false; break;
    }
});

// ─── Mouse input ──────────────────────────────────────────────────────────────

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) / scale;
    useMouseControl = true;
});
canvas.addEventListener('click', () => {
    if (gameState === 'crashed' || gameState === 'caught') { resetGame(); return; }
    if (heldPowerup) usePowerup();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ─── Touch input ──────────────────────────────────────────────────────────────

function getTouchPos(touch) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (touch.clientX - rect.left)  / scale,
        y: (touch.clientY - rect.top)   / scale
    };
}

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const pos   = getTouchPos(touch);

    if (gameState === 'crashed' || gameState === 'caught') { resetGame(); return; }

    // Tap JUMP button area (bottom-right circle ~28px radius)
    if (Math.abs(pos.x - (GAME_WIDTH - 40)) < 40 && Math.abs(pos.y - (GAME_HEIGHT - 40)) < 40) {
        if (jumpHeight === 0) { jumpVelocity = 12; gameState = 'jumping'; }
        return;
    }

    // Tap power-up HUD area (bottom-left box)
    if (pos.x < 145 && pos.y > GAME_HEIGHT - 58) {
        usePowerup(); return;
    }

    activeTouchId  = touch.identifier;
    touchCurrentX  = pos.x;
    useMouseControl = true;
    mouseX = pos.x;
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
        if (touch.identifier === activeTouchId) {
            const pos = getTouchPos(touch);
            touchCurrentX = pos.x;
            mouseX = pos.x;
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
        if (touch.identifier === activeTouchId) {
            activeTouchId = null; touchCurrentX = null;
        }
    }
}, { passive: false });

// ─── Boot ─────────────────────────────────────────────────────────────────────

initSnow();
initObstacles();
gameLoop();
