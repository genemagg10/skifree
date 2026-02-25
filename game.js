// SkiFree Clone - Enhanced with Mobile Support, Yeti Chase Mechanics & Power-ups
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');

// Game constants (logical resolution)
const GAME_WIDTH = 640;
const GAME_HEIGHT = 480;
const SKIER_SIZE = 20;
const TREE_SPAWN_RATE    = 0.026;   // base rates; multiplied by difficulty below
const ROCK_SPAWN_RATE    = 0.012;
const JUMP_SPAWN_RATE    = 0.007;
const POWERUP_SPAWN_RATE = 0.004;

// Difficulty ramp – goes from 0.25 → 1.0 over the first 1200 m
// so new players get sparser terrain until they learn the controls
let difficulty = 0.25;

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
    difficulty = 0.25;
    // Start with only 10 obstacles so the slope feels open at first
    for (let i = 0; i < 10; i++) {
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
    // Pixel-art fir tree built from fillRect blocks only.
    // (x,y) = centre of trunk base; tree grows upward.
    const b = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x+dx, y+dy, w, h); };

    // ── Trunk ──────────────────────────────────────────────────────
    b(-4, 8,  8, 16, '#5B2E0A');   // main bark
    b(-3, 8,  3, 16, '#7A3D12');   // left highlight
    b( 2, 9,  2, 14, '#3A1D06');   // right shadow

    // ── Base foliage tier (widest) ─────────────────────────────────
    b(-16, -4, 32, 13, '#155A18'); // dark back fill
    b(-14, -4, 10,  8, '#1A7020'); // mid-left body
    b( -2, -4, 10,  8, '#1A7020'); // mid-right body
    b(  8, -2,  6, 10, '#0C3E0E'); // right shadow
    b(-14, -4,  6,  2, '#FFFFFF'); // snow left
    b(  2, -4,  6,  2, '#FFFFFF'); // snow right
    b( -2, -4,  2,  2, '#E4E4E4'); // snow centre gap
    b(-14, -4,  4,  4, '#22902C'); // lit highlight

    // ── Middle tier ────────────────────────────────────────────────
    b(-12,-16, 24, 13, '#166A1A');
    b(-10,-16,  8,  8, '#1C8224');
    b(  0,-16,  8,  8, '#1C8224');
    b(  8,-14,  4, 10, '#0D4410');
    b(-10,-16,  5,  2, '#FFFFFF'); // snow
    b(  2,-16,  5,  2, '#FFFFFF');
    b(-10,-16,  3,  4, '#23A22E'); // lit highlight

    // ── Upper tier ─────────────────────────────────────────────────
    b( -8,-28, 16, 13, '#178020');
    b( -6,-28,  6,  7, '#1E9A28');
    b(  1,-28,  5,  7, '#1E9A28');
    b(  5,-26,  4, 10, '#0E5212');
    b( -6,-28,  4,  2, '#FFFFFF'); // snow
    b(  0,-28,  4,  2, '#FFFFFF');
    b( -6,-28,  3,  4, '#27C033'); // lit highlight

    // ── Tip ────────────────────────────────────────────────────────
    b( -5,-39, 10, 12, '#199028');
    b( -3,-39,  4,  8, '#21B232');
    b(  2,-37,  2,  8, '#0F5E14');
    b( -3,-39,  3,  2, '#FFFFFF'); // snow cap
    b( -2,-41,  4,  2, '#FFFFFF');
    b( -1,-43,  2,  2, '#FFFFFF'); // peak
}

function drawRock(x, y) {
    // Chunky pixel-art boulder built from fillRect.
    const b = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x+dx, y+dy, w, h); };

    // Ground shadow
    b(-12, 8, 26, 4, 'rgba(0,0,0,0.18)');

    // Dark base outline
    b(-12, -2, 26, 14, '#2E2E2E');

    // Main body
    b(-10, -6, 22, 16, '#555555');
    b(-14, -2, 6,  10, '#555555');   // left bulge
    b( 10, -2, 6,  10, '#555555');   // right bulge

    // Mid highlight plane
    b( -8, -6, 10,  8, '#6A6A6A');
    b( -4, -8,  8,  4, '#787878');   // top face

    // Bright highlight (upper left catch-light)
    b( -8, -8,  6,  4, '#8C8C8C');
    b( -6, -8,  4,  2, '#A0A0A0');

    // Shadow underside / right
    b(  6,  2, 10, 10, '#383838');
    b( 10, -2,  4, 14, '#2A2A2A');

    // Snow on top
    b( -9, -9, 12,  3, '#F2F2F2');
    b(-11, -7,  4,  2, '#FFFFFF');
    b(  2, -8,  5,  2, '#E8E8E8');
    b( -7,-11,  6,  2, '#FFFFFF');   // fresh snow peak
}

function drawJump(x, y) {
    // Pixel-art snow ramp built from fillRect rows (stepped profile).
    const b = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x+dx, y+dy, w, h); };

    // Shadow on snow
    b(-22, 6, 44, 5, 'rgba(0,0,0,0.15)');

    // Ramp surface – stacked rows, widening as we go down
    b(-10, -8,  22, 3, '#C8B090');   // top row (narrower)
    b(-13, -5,  28, 3, '#D4BC9A');
    b(-16, -2,  34, 3, '#DEBFA0');
    b(-20,  1,  40, 4, '#E8C8AA');   // bottom/widest

    // Left edge (thick vertical face of ramp)
    b(-20,  1,   4, 4, '#A8885A');
    b(-16, -2,   4, 3, '#B09060');
    b(-13, -5,   3, 3, '#B89468');
    b(-10, -8,   2, 3, '#C0A070');

    // Top highlight stripe
    b( -8, -8,  18, 2, '#F0D8B8');

    // Right shading
    b( 16, -5,   4, 6, '#C0A878');

    // Arrow markers on ramp surface (show it's a jump)
    b( -2, -6,   4, 2, '#A07840');
    b( -3, -3,   6, 2, '#A07840');
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

    // Shield glow ring
    if (shieldActive) {
        ctx.strokeStyle = `rgba(0,255,127,${0.5 + 0.5 * Math.sin(Date.now() / 100)})`;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, -10, 30, 0, Math.PI*2); ctx.stroke();
    }

    // Jump shadow on snow below
    if (jumpHeight > 0) {
        const alpha = Math.max(0, 0.28 - jumpHeight / 180);
        ctx.fillStyle = `rgba(0,0,0,${alpha})`;
        ctx.fillRect(-12 + jumpHeight/20, jumpHeight + 6, Math.max(4, 24 - jumpHeight/8), 4);
    }

    // ── Crashed state ─────────────────────────────────────────────────────────
    if (gameState === 'crashed') {
        const b = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(dx, dy, w, h); };
        // Sprawled body
        b(-16, -6, 32,  8, '#1B52C0');   // jacket flat
        b( -6, -8, 12,  6, '#FFCC88');   // face sideways
        b( -4,-10,  8,  4, '#CC0000');   // hat above head
        b( -3,-12,  6,  2, '#FFFFFF');   // pom pom
        // Scattered skis
        ctx.save(); ctx.rotate( 0.45); b(-18, 12, 26, 3, '#CC1100'); ctx.restore();
        ctx.save(); ctx.rotate(-0.35); b(  4, 14, 26, 3, '#CC1100'); ctx.restore();
        ctx.restore();
        return;
    }

    // ── Body rotation for turning ─────────────────────────────────────────────
    ctx.rotate(skier.angle * 0.36);

    const b = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(dx, dy, w, h); };
    const ang = skier.angle;
    const hardTurn = Math.abs(ang) > 1.0;

    // ── SKI POLES ─────────────────────────────────────────────────────────────
    // Draw behind body first.  Each pole is a row of 2×2 px dots.
    const drawPole = (startX, startY, stepX, stepY, steps) => {
        for (let i = 0; i < steps; i++) {
            b(startX + i*stepX, startY + i*stepY, 2, 2, '#9B8B30');
        }
    };
    // Left pole (visible unless hard-turning right)
    if (ang <= 0.8) {
        drawPole(-10, -8,  -2, 2, 9);   // shaft
        b(-28, 9, 6, 2, '#B0B070');      // basket
    }
    // Right pole (visible unless hard-turning left)
    if (ang >= -0.8) {
        drawPole( 8, -8,  2, 2, 9);
        b( 22, 9, 6, 2, '#B0B070');
    }

    // ── SKIS ─────────────────────────────────────────────────────────────────
    if (!hardTurn) {
        // Parallel skis pointing downhill
        b(-12, 13, 2, 4, '#EE3311');   // left tip (raised, lighter)
        b(-10, 15, 8, 2, '#CC1100');   // left ski
        b(  2, 15, 8, 2, '#CC1100');   // right ski
        b( 10, 13, 2, 4, '#EE3311');   // right tip
        b( -9, 15, 2, 2, '#FF4422');   // binding highlight L
        b(  3, 15, 2, 2, '#FF4422');   // binding highlight R
    } else {
        // Edging turn: skis appear foreshortened / angled
        const dir = ang > 0 ? 1 : -1;
        b(-10 * dir - 5, 14, 24, 2, '#CC1100');  // wide single ski strip
        b(-10 * dir - 5, 12,  4, 4, '#EE3311');  // uphill tip
    }

    // ── BOOTS ────────────────────────────────────────────────────────────────
    b(-7, 9, 5, 6, '#1A1A30');   // left boot
    b( 2, 9, 5, 6, '#1A1A30');   // right boot
    b(-6, 9, 2, 3, '#2E2E50');   // boot highlight L
    b( 3, 9, 2, 3, '#2E2E50');   // boot highlight R

    // ── PANTS / LEGS ─────────────────────────────────────────────────────────
    b(-6,  1, 4, 9, '#0B3484');
    b( 2,  1, 4, 9, '#0B3484');
    b(-5,  1, 2, 5, '#1448A8');   // highlight L
    b( 3,  1, 2, 5, '#1448A8');   // highlight R
    b(-6,  8, 4, 2, '#09286E');   // cuff shadow
    b( 2,  8, 4, 2, '#09286E');

    // ── JACKET ───────────────────────────────────────────────────────────────
    const jMain = boostActive ? '#D06000' : '#1B52C0';
    const jHi   = boostActive ? '#F08820' : '#2868E0';
    const jSh   = boostActive ? '#904000' : '#112E80';
    b( -7,-14, 14, 16, jMain);   // main torso
    b( -7,-14,  2, 16, jSh);     // left shadow
    b(  5,-14,  2, 16, jSh);     // right shadow
    b( -5,-14, 10,  2, jHi);     // shoulder highlight
    b( -3, -6,  6,  2, jSh);     // chest pocket line
    // Sleeves (arms extend out toward poles)
    b(-12, -9,  6,  6, jMain);   // left sleeve
    b(  6, -9,  6,  6, jMain);   // right sleeve
    b(-12, -9,  2,  6, jSh);     // sleeve shadow L
    b( 10, -9,  2,  6, jSh);     // sleeve shadow R
    // Gloves
    b(-12, -5,  4,  4, '#E8D8B0');  // left glove
    b(  8, -5,  4,  4, '#E8D8B0');  // right glove

    // ── NECK ─────────────────────────────────────────────────────────────────
    b( -2,-16,  4,  4, '#FFCC88');

    // ── HEAD / FACE ──────────────────────────────────────────────────────────
    b( -5,-24, 10,  9, '#FFCC88');  // face
    b( -5,-24,  2,  9, '#E8A866');  // left shadow
    b(  3,-24,  2,  9, '#E8A866');  // right shadow
    b( -5,-16, 10,  1, '#C88040');  // chin shadow

    // ── GOGGLES ──────────────────────────────────────────────────────────────
    b( -5,-23, 10,  1, '#1A1A1A');  // strap top
    b( -5,-19,  1,  4, '#1A1A1A');  // frame left edge
    b(  4,-19,  1,  4, '#1A1A1A');  // frame right edge
    b( -4,-22,  3,  4, '#D4A800');  // left lens
    b(  1,-22,  3,  4, '#D4A800');  // right lens
    b( -1,-22,  2,  3, '#222222');  // nose bridge
    b( -3,-22,  1,  1, '#FFE860');  // left glint
    b(  2,-22,  1,  1, '#FFE860');  // right glint
    b( -5,-19, 10,  1, '#1A1A1A');  // strap bottom

    // ── HAT (knit cap) ───────────────────────────────────────────────────────
    b( -5,-26, 10,  3, '#AA0000');  // brim band / cuff
    b( -4,-32,  8,  6, '#CC0000');  // hat body
    b( -3,-32,  4,  6, '#DD1111');  // highlight stripe
    b( -4,-28,  8,  2, '#FF6666');  // white stripe on hat
    // Pom pom
    b( -3,-35,  6,  3, '#F8F8F8');
    b( -2,-37,  4,  2, '#E0E0E0');
    b( -1,-38,  2,  1, '#FFFFFF');

    ctx.restore();
}

function drawYeti() {
    if (!yeti.active) return;
    ctx.save();
    ctx.translate(yeti.x, yeti.y);

    const still  = yeti.frozen || yeti.stunned;
    const bounce = still ? 0 : Math.sin(Date.now() / 110) * 4;
    const bk = bounce | 0;   // integer offset for fillRect

    const fur  = yeti.frozen ? '#B8D8EE' : '#E8E8F4';
    const fur2 = yeti.frozen ? '#8AB8D0' : '#C0C0D0';   // shadow/underside
    const fur3 = yeti.frozen ? '#D4ECF8' : '#F4F4FF';   // highlight
    const eyeC = yeti.frozen ? '#4488FF' : '#FF2200';

    const b = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(dx, dy + bk, w, h); };

    // ── GROUND SHADOW ────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(-26, 52 + bk, 52, 6);

    // ── LEGS ─────────────────────────────────────────────────────────────────
    const ls = still ? 0 : Math.sin(Date.now() / 105) * 7;
    // Left leg
    b(-20, 24 + (ls|0), 16, 28, fur);
    b(-20, 24 + (ls|0),  4, 28, fur2);   // inner shadow
    b(-20, 48 + (ls|0), 18,  6, fur2);   // foot
    b(-22, 50 + (ls|0),  6,  4, '#606070'); // claws
    b(-16, 52 + (ls|0),  4,  4, '#606070');
    b(-10, 51 + (ls|0),  4,  4, '#606070');
    // Right leg
    b(  4, 24 - (ls|0), 16, 28, fur);
    b( 16, 24 - (ls|0),  4, 28, fur2);
    b(  2, 48 - (ls|0), 18,  6, fur2);
    b( 16, 50 - (ls|0),  6,  4, '#606070');
    b( 12, 52 - (ls|0),  4,  4, '#606070');
    b(  6, 51 - (ls|0),  4,  4, '#606070');

    // ── TORSO ────────────────────────────────────────────────────────────────
    b(-24, -14, 48, 40, fur);            // main body
    b(-24, -14,  6, 40, fur2);           // left shadow
    b( 18, -12,  6, 38, fur2);           // right shadow
    b(-18, -14, 36,  6, fur3);           // shoulder highlight
    b(-10,   4, 20, 16, fur2);           // belly

    // ── ARMS ─────────────────────────────────────────────────────────────────
    const as = still ? 0 : Math.sin(Date.now() / 160) * 8;
    // Left arm
    b(-44, -10 + (as|0), 22, 14, fur);
    b(-44, -10 + (as|0),  6, 14, fur2);
    // Left claws
    b(-50,   0 + (as|0),  8,  4, '#606070');
    b(-44,   2 + (as|0),  4,  5, '#606070');
    b(-38,   1 + (as|0),  4,  5, '#606070');
    // Right arm
    b( 22, -10 - (as|0), 22, 14, fur);
    b( 38, -10 - (as|0),  6, 14, fur2);
    // Right claws
    b( 42,   0 - (as|0),  8,  4, '#606070');
    b( 40,   2 - (as|0),  4,  5, '#606070');
    b( 34,   1 - (as|0),  4,  5, '#606070');

    // ── HEAD ─────────────────────────────────────────────────────────────────
    b(-22, -52, 44, 40, fur);            // head block
    b(-22, -52,  6, 40, fur2);           // left shadow
    b( 16, -50,  6, 38, fur2);           // right shadow
    b(-16, -52, 32,  4, fur3);           // forehead highlight
    // Ears
    b(-30, -44, 10, 12, fur);
    b(-30, -44,  4, 12, fur2);
    b( 20, -44, 10, 12, fur);
    b( 26, -44,  4, 12, fur2);
    // Ear inner
    b(-28, -42,  6,  8, '#E8A0B0');
    b( 22, -42,  6,  8, '#E8A0B0');

    // ── BROW (menacing angled ridge) ─────────────────────────────────────────
    b(-18, -40, 14,  5, fur2);
    b(  4, -40, 14,  5, fur2);
    b(-14, -42,  8,  3, '#909099');   // angled highlight
    b(  6, -42,  8,  3, '#909099');

    // ── EYES ─────────────────────────────────────────────────────────────────
    b(-16, -38, 12, 12, '#111');       // left socket
    b(  4, -38, 12, 12, '#111');       // right socket
    b(-14, -36,  8,  8, eyeC);         // left iris
    b(  6, -36,  8,  8, eyeC);         // right iris
    b(-13, -35,  3,  3, '#FF8888');    // left glint
    b(  7, -35,  3,  3, '#FF8888');
    b(-12, -34,  2,  2, '#FFFFFF');    // pupil reflection
    b(  8, -34,  2,  2, '#FFFFFF');

    // ── NOSE ─────────────────────────────────────────────────────────────────
    b( -8, -24, 16, 10, fur2);
    b( -6, -24, 12,  8, '#B090B0');
    b( -4, -24,  8,  4, '#C8A0C8');
    b( -6, -18,  4,  4, '#555');       // nostrils
    b(  2, -18,  4,  4, '#555');

    // ── MOUTH ────────────────────────────────────────────────────────────────
    b(-14, -14, 28, 12, '#1A1A1A');    // mouth cavity
    b(-12, -14, 24,  4, '#2A1010');    // upper lip
    // Fangs
    b(-12, -14,  4, 10, '#F4F0EC');
    b( -6, -14,  3,  8, '#F4F0EC');
    b(  3, -14,  3,  8, '#F4F0EC');
    b(  8, -14,  4, 10, '#F4F0EC');
    // Lower teeth row
    b( -8,  -6, 16,  4, '#E0DCD8');
    // Tongue
    b( -4,  -2,  8,  4, '#CC4466');

    // ── FROZEN ICE OVERLAY ───────────────────────────────────────────────────
    if (yeti.frozen) {
        ctx.fillStyle = 'rgba(100,200,255,0.25)';
        ctx.fillRect(-46, -58 + bk, 92, 118);
        // Ice cracks
        ctx.strokeStyle = 'rgba(180,230,255,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-10, -50+bk); ctx.lineTo(5, -30+bk); ctx.lineTo(-5, -10+bk);
        ctx.moveTo(15, -40+bk);  ctx.lineTo(0, -20+bk);
        ctx.stroke();
    }

    // ── STUNNED STARS ────────────────────────────────────────────────────────
    if (yeti.stunned) {
        for (let i = 0; i < 3; i++) {
            const ang = Date.now()/280 + i * Math.PI * 2/3;
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(Math.cos(ang)*32 - 5, -68 + Math.sin(ang)*10 - 5, 10, 10);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(Math.cos(ang)*32 - 2, -68 + Math.sin(ang)*10 - 2,  4,  4);
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

    // Difficulty ramp: sparse start, full density by 1200 m
    difficulty = Math.min(1.0, 0.25 + (distance / 1200) * 0.75);

    // Move obstacles (frozen = paused)
    if (!freezeActive) {
        obstacles.forEach(obs => { obs.y -= speed; });
        powerupPickups.forEach(p  => { p.y  -= speed; });
    }

    // Cull off-screen
    obstacles     = obstacles.filter(o => o.y > -50 && !o.destroyed);
    powerupPickups = powerupPickups.filter(p => p.y > -50);

    // Spawn obstacles & power-ups (scaled by difficulty so start feels open)
    const spd = speed / 5;
    if (Math.random() < TREE_SPAWN_RATE    * spd * difficulty) spawnObstacle(GAME_HEIGHT + 50);
    if (Math.random() < ROCK_SPAWN_RATE    * spd * difficulty) spawnObstacle(GAME_HEIGHT + 50);
    if (Math.random() < JUMP_SPAWN_RATE    * spd * difficulty) spawnObstacle(GAME_HEIGHT + 50);
    if (Math.random() < POWERUP_SPAWN_RATE * spd)              spawnPowerup(GAME_HEIGHT + 50);

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
    distance = 0; speed = baseSpeed; difficulty = 0.25;
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
