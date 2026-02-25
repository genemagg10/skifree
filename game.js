// FrostByte - Enhanced with Mobile Support, Yeti Chase Mechanics & Power-ups
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
let gameState = 'charselect'; // 'charselect', 'playing', 'crashed', 'caught', 'jumping'
let playerType = 'skier';     // 'skier' or 'snowboarder'
let distance = 0;
let speed = 5;
let baseSpeed = 5;
let maxSpeed = 15;
let jumpHeight = 0;
let jumpVelocity = 0;

// High score (persisted in localStorage)
let highScore = parseInt(localStorage.getItem('frostbyte_highscore') || '0', 10);
let highScoreX = parseInt(localStorage.getItem('frostbyte_highscore_x') || String(GAME_WIDTH / 2), 10);
let tombstonePlaced = false;
let tombstoneObj = null;

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

// Mouse position (absolute steering – desktop only)
let mouseX = GAME_WIDTH / 2;
let useMouseControl = false;

// Relative touch steering – finger can start anywhere;
// angle is driven by horizontal drag delta, not absolute position
let touchStartX = null;
let touchDeltaX = 0;
let useRelativeTouch = false;

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

// Embossed coin metal palettes – derived from POWERUP_COLORS for visual consistency
const COIN_METALS = {
    boost:    { dark: '#B89A00', face: '#FFD700', hi: '#FFF0A0', rim: '#D4B400', letter: '#8A7000' },
    snowball: { dark: '#5A9AB0', face: '#87CEEB', hi: '#C4E8FF', rim: '#70B4D4', letter: '#3A7A98' },
    shield:   { dark: '#00AA55', face: '#00FF7F', hi: '#80FFB8', rim: '#00D468', letter: '#008040' },
    freeze:   { dark: '#0080AA', face: '#00BFFF', hi: '#80E0FF', rim: '#009CD8', letter: '#006090' },
    bomb:     { dark: '#B03828', face: '#FF6347', hi: '#FF9A88', rim: '#D8503A', letter: '#882818' }
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
        destroyed: false,
        snowy: type === 'tree' ? Math.random() < 0.55 : false  // 55% of trees get heavy snow (matching reference)
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

function drawTree(x, y, snowy) {
    const b = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x+dx, y+dy, w, h); };

    // ── Trunk ──────────────────────────────────────────────────────
    b(-3, 8,  6, 14, '#5C3D20');   // dark brown bark
    b(-2, 8,  2, 14, '#7A5234');   // left highlight
    b( 2, 9,  2, 12, '#3E2810');   // right shadow

    // ── Base foliage tier (widest) – dark forest green ──────────────
    b(-15, -3, 30, 12, '#1A4A2E');  // dark forest green base
    b(-13, -3,  9,  7, '#245838');  // left highlight
    b( -1, -3,  9,  7, '#245838');  // right highlight
    b(  9, -1,  6,  9, '#103820');  // right shadow
    b(-13, -3,  3,  3, '#2D6840');  // top-left accent

    // ── Middle tier ────────────────────────────────────────────────
    b(-11,-14, 22, 12, '#1C5030');
    b( -9,-14,  7,  7, '#265C3A');
    b(  1,-14,  7,  7, '#265C3A');
    b(  7,-12,  4,  9, '#124024');
    b( -9,-14,  3,  3, '#2D6840');

    // ── Upper tier ─────────────────────────────────────────────────
    b( -8,-24, 16, 11, '#1E5432');
    b( -6,-24,  5,  6, '#28663E');
    b(  1,-24,  5,  6, '#28663E');
    b(  5,-22,  3,  8, '#124024');

    // ── Tip ────────────────────────────────────────────────────────
    b( -5,-34, 10, 11, '#205836');
    b( -3,-34,  4,  7, '#2D6840');
    b(  2,-32,  2,  7, '#14442A');

    if (snowy) {
        // Heavy snow coverage – thick white shelves on each tier
        b(-15, -4, 30,  4, '#E8EEF4');  // base snow shelf – wide
        b(-15, -5, 12,  2, '#FFFFFF');
        b(  3, -5, 12,  2, '#FFFFFF');
        b(-11,-15, 22,  4, '#E8EEF4');  // middle snow shelf
        b(-11,-16, 10,  2, '#FFFFFF');
        b(  3,-16, 10,  2, '#FFFFFF');
        b( -8,-25, 16,  4, '#E8EEF4');  // upper snow shelf
        b( -8,-26,  7,  2, '#FFFFFF');
        b(  2,-26,  7,  2, '#FFFFFF');
        b( -5,-35, 10,  3, '#FFFFFF');   // tip snow
        b( -4,-37,  8,  2, '#F0F4FF');
        b( -3,-39,  6,  2, '#FFFFFF');
        b( -2,-41,  4,  2, '#FFFFFF');
        b( -1,-43,  2,  2, '#FFFFFF');   // snow peak
    } else {
        // Light snow on tips and edges
        b( -4,-34,  4,  2, '#E8EEF4');
        b( -3,-36,  6,  2, '#FFFFFF');
        b( -2,-38,  4,  2, '#FFFFFF');
        b( -1,-40,  2,  2, '#FFFFFF');   // peak
        // Light dusting on branch tips
        b(-14, -3,  4,  2, '#DDE4EC');
        b( 10, -3,  4,  2, '#DDE4EC');
        b(-10,-14,  3,  2, '#DDE4EC');
        b(  7,-14,  3,  2, '#DDE4EC');
    }
}

function drawRock(x, y) {
    const b = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x+dx, y+dy, w, h); };

    // Ground shadow
    b(-12, 8, 26, 4, 'rgba(0,0,0,0.16)');

    // Dark outline
    b(-12, -2, 26, 14, '#4A4038');

    // Main body – warm brown/grey like mountain rocks
    b(-10, -6, 22, 16, '#6E6458');
    b(-14, -2, 6,  10, '#665C50');   // left bulge
    b( 10, -2, 6,  10, '#665C50');   // right bulge

    // Mid highlight – warm stone
    b( -8, -6, 10,  8, '#847868');
    b( -4, -8,  8,  4, '#948878');   // top face

    // Bright highlight
    b( -8, -8,  6,  4, '#A89888');
    b( -6, -9,  4,  2, '#B8A898');

    // Shadow side – cooler
    b(  6,  2, 10, 10, '#504840');
    b( 10, -2,  4, 14, '#3E3830');

    // Snow on top – heavier
    b(-10, -9, 14,  4, '#EEF2F8');
    b(-12, -7,  5,  2, '#FFFFFF');
    b(  2, -8,  6,  2, '#F4F8FF');
    b( -8,-12,  8,  3, '#FFFFFF');
    b( -6,-14,  4,  2, '#F4F8FF');
}

function drawJump(x, y) {
    const b = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x+dx, y+dy, w, h); };

    // Shadow on snow
    b(-22, 6, 44, 5, 'rgba(0,0,0,0.10)');

    // Ramp surface – cool snow/ice tones
    b(-10, -8,  22, 3, '#C8D4E0');
    b(-13, -5,  28, 3, '#D4DEE8');
    b(-16, -2,  34, 3, '#DEE6EE');
    b(-20,  1,  40, 4, '#E8EEF4');   // bottom/widest

    // Left edge – blue-grey shadow
    b(-20,  1,   4, 4, '#8A9AAC');
    b(-16, -2,   4, 3, '#94A4B4');
    b(-13, -5,   3, 3, '#9EAEC0');
    b(-10, -8,   2, 3, '#A8B4C4');

    // Top highlight stripe
    b( -8, -8,  18, 2, '#F0F4FA');

    // Right shading
    b( 16, -5,   4, 6, '#B0BCC8');

    // Arrow markers on ramp surface
    b( -2, -6,   4, 2, '#8898A8');
    b( -3, -3,   6, 2, '#8898A8');
}

function drawTombstone(x, y, score) {
    const b = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x+dx, y+dy, w, h); };

    // Ground shadow
    b(-16, 6, 32, 5, 'rgba(0,0,0,0.18)');

    // Ground mound – cool grey
    b(-18, 2, 36, 8, '#808890');
    b(-16, 0, 32, 4, '#909AA0');

    // Tombstone body – blue-grey stone
    b(-11, -24, 22, 28, '#687078');
    b(-9, -28, 18, 6, '#727A82');
    b(-7, -30, 14, 4, '#7C848C');
    b(-5, -32, 10, 4, '#868E96');

    // Left highlight
    b(-11, -24, 4, 24, '#808890');
    b(-7, -30, 4, 8, '#8A9298');

    // Right shadow
    b(5, -24, 6, 26, '#505860');
    b(7, -28, 4, 6, '#485058');

    // Snow on top
    b(-6, -32, 12, 2, '#F0F4FA');
    b(-8, -30, 16, 2, '#E4E8EE');

    // Cross
    b(-1, -26, 2, 16, '#384048');
    b(-5, -22, 10, 2, '#384048');

    // Small flowers at base
    b(-14, -1, 3, 3, '#CC5878');
    b(-10, 0, 3, 3, '#D4AA44');
    b(8, -1, 3, 3, '#CC5878');

    // Text
    ctx.fillStyle = '#2A3038';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RIP', x, y - 10);
    ctx.font = '6px monospace';
    ctx.fillText(Math.floor(score) + 'm', x, y - 2);
    ctx.textBaseline = 'alphabetic';
}

function drawPowerupPickup(p) {
    // Embossed metallic coin
    const bob = Math.sin(Date.now() / 400 + p.bobOffset) * 3;
    const cx = p.x, cy = p.y + bob;
    const r = p.radius;

    ctx.save();
    const m = COIN_METALS[p.type];

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(cx + 1, cy + 2, r + 1, 0, Math.PI*2); ctx.fill();

    // Bottom-right raised edge (dark = shadow side)
    ctx.fillStyle = m.dark;
    ctx.beginPath(); ctx.arc(cx + 1, cy + 1, r, 0, Math.PI*2); ctx.fill();

    // Top-left raised edge (light = catch-light)
    ctx.fillStyle = m.hi;
    ctx.beginPath(); ctx.arc(cx - 0.5, cy - 0.5, r, 0, Math.PI*2); ctx.fill();

    // Main coin face
    ctx.fillStyle = m.face;
    ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, Math.PI*2); ctx.fill();

    // Inner stamped rim
    ctx.strokeStyle = m.rim;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r - 5, 0, Math.PI*2); ctx.stroke();

    // Embossed letter (shadow then highlight for raised effect)
    ctx.font = `bold ${r * 0.9}px "Orbitron", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = m.letter;
    ctx.fillText(POWERUP_LABELS[p.type], cx + 0.8, cy + 0.8);
    ctx.fillStyle = m.hi;
    ctx.fillText(POWERUP_LABELS[p.type], cx - 0.3, cy - 0.3);

    ctx.textBaseline = 'alphabetic';
    ctx.restore();
}

// ─── Character drawing ───────────────────────────────────────────────────────

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

    const isSB = playerType === 'snowboarder';

    // ── Crashed state ─────────────────────────────────────────────────────────
    if (gameState === 'crashed') {
        const b = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(dx, dy, w, h); };
        const jCol = isSB ? '#2878C8' : '#2878C8';
        b(-16, -6, 32,  8, jCol);        // jacket flat
        b( -6, -8, 12,  6, '#F0B880');   // face sideways
        b( -4,-10,  8,  4, '#606878');   // helmet piece
        b( -3,-12,  6,  2, '#808890');   // helmet top
        if (isSB) {
            ctx.save(); ctx.rotate(0.3); b(-15, 14, 30, 3, '#3A3A44'); ctx.restore();
        } else {
            ctx.save(); ctx.rotate( 0.45); b(-18, 12, 26, 3, '#CC1100'); ctx.restore();
            ctx.save(); ctx.rotate(-0.35); b(  4, 14, 26, 3, '#CC1100'); ctx.restore();
        }
        ctx.restore();
        return;
    }

    // ── Body rotation for turning ─────────────────────────────────────────────
    ctx.rotate(skier.angle * 0.36);

    const b = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(dx, dy, w, h); };
    const ang = skier.angle;
    const hardTurn = Math.abs(ang) > 1.0;

    // ── EQUIPMENT: SKI POLES (skier only) ─────────────────────────────────────
    if (!isSB) {
        const drawPole = (startX, startY, stepX, stepY, steps) => {
            for (let i = 0; i < steps; i++) {
                b(startX + i*stepX, startY + i*stepY, 2, 2, '#808890');
            }
        };
        if (ang <= 0.8)  { drawPole(-10, -8, -2, 2, 9); b(-28, 9, 6, 2, '#A0A8B4'); }
        if (ang >= -0.8) { drawPole(  8, -8,  2, 2, 9); b( 22, 9, 6, 2, '#A0A8B4'); }
    }

    // ── FOOTWEAR ──────────────────────────────────────────────────────────────
    if (isSB) {
        // Snowboard – dark grey/charcoal like reference
        if (!hardTurn) {
            b(-14, 16, 28, 3, '#3A3A44');   // board main dark
            b(-14, 16, 28, 1, '#505860');   // top edge highlight
            b(-14, 18, 28, 1, '#2A2A30');   // bottom edge shadow
            b(-16, 16,  3, 3, '#505860');   // nose
            b( 13, 16,  3, 3, '#505860');   // tail
            b( -5, 14,  4, 3, '#222');      // front binding
            b(  3, 14,  4, 3, '#222');      // rear binding
        } else {
            const dir = ang > 0 ? 1 : -1;
            b(-12 * dir - 3, 15, 28, 2, '#3A3A44');
            b(-12 * dir - 3, 14,  4, 3, '#505860');
        }
    } else {
        // Skis – red
        if (!hardTurn) {
            b(-12, 13, 2, 4, '#EE4422');
            b(-10, 15, 8, 2, '#DD2200');
            b(  2, 15, 8, 2, '#DD2200');
            b( 10, 13, 2, 4, '#EE4422');
            b( -9, 15, 2, 2, '#FF5533');
            b(  3, 15, 2, 2, '#FF5533');
        } else {
            const dir = ang > 0 ? 1 : -1;
            b(-10 * dir - 5, 14, 24, 2, '#DD2200');
            b(-10 * dir - 5, 12,  4, 4, '#EE4422');
        }
    }

    // ── BOOTS ────────────────────────────────────────────────────────────────
    if (isSB) {
        b(-5, 10, 4, 6, '#2A2A30');   // left boot
        b( 2, 10, 4, 6, '#2A2A30');   // right boot
        b(-4, 10, 2, 3, '#3A3A44');
        b( 3, 10, 2, 3, '#3A3A44');
    } else {
        b(-7, 9, 5, 6, '#2A2A30');
        b( 2, 9, 5, 6, '#2A2A30');
        b(-6, 9, 2, 3, '#3A3A44');
        b( 3, 9, 2, 3, '#3A3A44');
    }

    // ── PANTS / LEGS ─────────────────────────────────────────────────────────
    const pMain = isSB ? '#1858C0' : '#1858C0';
    const pHi   = isSB ? '#2870D8' : '#2870D8';
    const pSh   = isSB ? '#0E3A88' : '#0E3A88';
    b(-6,  1, 4, 9, pMain);
    b( 2,  1, 4, 9, pMain);
    b(-5,  1, 2, 5, pHi);    // highlight L
    b( 3,  1, 2, 5, pHi);    // highlight R
    b(-6,  8, 4, 2, pSh);    // cuff shadow
    b( 2,  8, 4, 2, pSh);

    // ── JACKET ───────────────────────────────────────────────────────────────
    let jMain, jHi, jSh;
    if (boostActive) {
        jMain = '#D06000'; jHi = '#F08820'; jSh = '#904000';
    } else if (isSB) {
        jMain = '#2878C8'; jHi = '#3C90E0'; jSh = '#1858A0';
    } else {
        jMain = '#2878C8'; jHi = '#3C90E0'; jSh = '#1858A0';
    }
    b( -7,-14, 14, 16, jMain);   // main torso
    b( -7,-14,  2, 16, jSh);     // left shadow
    b(  5,-14,  2, 16, jSh);     // right shadow
    b( -5,-14, 10,  2, jHi);     // shoulder highlight
    b( -3, -6,  6,  2, jSh);     // chest pocket line
    b( -1, -4,  2,  2, '#FFD700'); // small zipper pull detail

    // Sleeves
    if (isSB) {
        b(-14, -10,  8,  6, jMain);
        b(  6, -10,  8,  6, jMain);
        b(-14, -10,  2,  6, jSh);
        b( 12, -10,  2,  6, jSh);
        // Dark gloves (matching reference)
        b(-16, -6,  6,  5, '#2A2A30');
        b(-15, -6,  2,  2, '#3A3A44');
        b( 10, -6,  6,  5, '#2A2A30');
        b( 11, -6,  2,  2, '#3A3A44');
    } else {
        b(-12, -9,  6,  6, jMain);
        b(  6, -9,  6,  6, jMain);
        b(-12, -9,  2,  6, jSh);
        b( 10, -9,  2,  6, jSh);
        // Dark gloves (matching reference)
        b(-14, -5,  6,  5, '#2A2A30');
        b(-13, -5,  2,  2, '#3A3A44');
        b(  8, -5,  6,  5, '#2A2A30');
        b(  9, -5,  2,  2, '#3A3A44');
    }

    // ── NECK ─────────────────────────────────────────────────────────────────
    b( -2,-16,  4,  4, '#F0B880');

    // ── HEAD / FACE ──────────────────────────────────────────────────────────
    b( -5,-24, 10,  9, '#F0B880');  // face – warm peach
    b( -5,-24,  2,  9, '#D8A068');  // left shadow
    b(  3,-24,  2,  9, '#D8A068');  // right shadow
    b( -5,-16, 10,  1, '#C08848');  // chin shadow

    // ── GOGGLES (blue/purple tinted – matching reference) ────────────────────
    b( -6,-23, 12,  1, '#333');     // strap top
    b( -6,-19,  1,  4, '#333');     // frame left
    b(  5,-19,  1,  4, '#333');     // frame right
    b( -5,-22,  4,  4, '#4488CC');  // left lens – blue tint
    b(  1,-22,  4,  4, '#4488CC');  // right lens – blue tint
    b( -1,-22,  2,  3, '#333');     // nose bridge
    b( -4,-21,  1,  1, '#88CCFF');  // left glint
    b(  3,-21,  1,  1, '#88CCFF');  // right glint
    b( -6,-19, 12,  1, '#333');     // strap bottom

    // ── HELMET (grey, rounded – matching reference) ──────────────────────────
    b( -6,-26, 12,  4, '#606878');  // helmet base/brim
    b( -5,-32, 10,  7, '#707880');  // helmet body
    b( -4,-33,  8,  2, '#808890');  // helmet top
    b( -3,-34,  6,  2, '#909AA0');  // helmet crown
    b( -4,-32,  3,  5, '#808890');  // left highlight
    b(  3,-30,  2,  4, '#585E68');  // right shadow
    // Ear pads
    b( -7,-28,  2,  6, '#585E68');
    b(  5,-28,  2,  6, '#585E68');

    ctx.restore();
}

function drawYeti() {
    if (!yeti.active) return;
    ctx.save();
    ctx.translate(yeti.x, yeti.y);

    const still  = yeti.frozen || yeti.stunned;
    const bounce = still ? 0 : Math.sin(Date.now() / 110) * 4;
    const bk = bounce | 0;

    const fur  = yeti.frozen ? '#B8D8EE' : '#E8E8F4';
    const fur2 = yeti.frozen ? '#8AB8D0' : '#C0C0D0';
    const fur3 = yeti.frozen ? '#D4ECF8' : '#F4F4FF';
    const eyeC = yeti.frozen ? '#4488FF' : '#FF2200';

    const b = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(dx, dy + bk, w, h); };

    // ── GROUND SHADOW ────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(-26, 52 + bk, 52, 6);

    // ── LEGS ─────────────────────────────────────────────────────────────────
    const ls = still ? 0 : Math.sin(Date.now() / 105) * 7;
    b(-20, 24 + (ls|0), 16, 28, fur);
    b(-20, 24 + (ls|0),  4, 28, fur2);
    b(-20, 48 + (ls|0), 18,  6, fur2);
    b(-22, 50 + (ls|0),  6,  4, '#606070');
    b(-16, 52 + (ls|0),  4,  4, '#606070');
    b(-10, 51 + (ls|0),  4,  4, '#606070');
    b(  4, 24 - (ls|0), 16, 28, fur);
    b( 16, 24 - (ls|0),  4, 28, fur2);
    b(  2, 48 - (ls|0), 18,  6, fur2);
    b( 16, 50 - (ls|0),  6,  4, '#606070');
    b( 12, 52 - (ls|0),  4,  4, '#606070');
    b(  6, 51 - (ls|0),  4,  4, '#606070');

    // ── TORSO ────────────────────────────────────────────────────────────────
    b(-24, -14, 48, 40, fur);
    b(-24, -14,  6, 40, fur2);
    b( 18, -12,  6, 38, fur2);
    b(-18, -14, 36,  6, fur3);
    b(-10,   4, 20, 16, fur2);

    // ── ARMS ─────────────────────────────────────────────────────────────────
    const as = still ? 0 : Math.sin(Date.now() / 160) * 8;
    b(-44, -10 + (as|0), 22, 14, fur);
    b(-44, -10 + (as|0),  6, 14, fur2);
    b(-50,   0 + (as|0),  8,  4, '#606070');
    b(-44,   2 + (as|0),  4,  5, '#606070');
    b(-38,   1 + (as|0),  4,  5, '#606070');
    b( 22, -10 - (as|0), 22, 14, fur);
    b( 38, -10 - (as|0),  6, 14, fur2);
    b( 42,   0 - (as|0),  8,  4, '#606070');
    b( 40,   2 - (as|0),  4,  5, '#606070');
    b( 34,   1 - (as|0),  4,  5, '#606070');

    // ── HEAD ─────────────────────────────────────────────────────────────────
    b(-22, -52, 44, 40, fur);
    b(-22, -52,  6, 40, fur2);
    b( 16, -50,  6, 38, fur2);
    b(-16, -52, 32,  4, fur3);
    b(-30, -44, 10, 12, fur);
    b(-30, -44,  4, 12, fur2);
    b( 20, -44, 10, 12, fur);
    b( 26, -44,  4, 12, fur2);
    b(-28, -42,  6,  8, '#E8A0B0');
    b( 22, -42,  6,  8, '#E8A0B0');

    // ── BROW ─────────────────────────────────────────────────────────────────
    b(-18, -40, 14,  5, fur2);
    b(  4, -40, 14,  5, fur2);
    b(-14, -42,  8,  3, '#909099');
    b(  6, -42,  8,  3, '#909099');

    // ── EYES ─────────────────────────────────────────────────────────────────
    b(-16, -38, 12, 12, '#111');
    b(  4, -38, 12, 12, '#111');
    b(-14, -36,  8,  8, eyeC);
    b(  6, -36,  8,  8, eyeC);
    b(-13, -35,  3,  3, '#FF8888');
    b(  7, -35,  3,  3, '#FF8888');
    b(-12, -34,  2,  2, '#FFFFFF');
    b(  8, -34,  2,  2, '#FFFFFF');

    // ── NOSE ─────────────────────────────────────────────────────────────────
    b( -8, -24, 16, 10, fur2);
    b( -6, -24, 12,  8, '#B090B0');
    b( -4, -24,  8,  4, '#C8A0C8');
    b( -6, -18,  4,  4, '#555');
    b(  2, -18,  4,  4, '#555');

    // ── MOUTH ────────────────────────────────────────────────────────────────
    b(-14, -14, 28, 12, '#1A1A1A');
    b(-12, -14, 24,  4, '#2A1010');
    b(-12, -14,  4, 10, '#F4F0EC');
    b( -6, -14,  3,  8, '#F4F0EC');
    b(  3, -14,  3,  8, '#F4F0EC');
    b(  8, -14,  4, 10, '#F4F0EC');
    b( -8,  -6, 16,  4, '#E0DCD8');
    b( -4,  -2,  8,  4, '#CC4466');

    // ── FROZEN ICE OVERLAY ───────────────────────────────────────────────────
    if (yeti.frozen) {
        ctx.fillStyle = 'rgba(100,200,255,0.25)';
        ctx.fillRect(-46, -58 + bk, 92, 118);
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
    snowParticles.forEach(p => {
        ctx.fillStyle = p.size > 2 ? 'rgba(255,255,255,0.85)' : 'rgba(220,230,245,0.7)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    });
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

// ─── High score ───────────────────────────────────────────────────────────────

function checkAndSaveHighScore() {
    if (distance > highScore) {
        highScore = Math.floor(distance);
        highScoreX = Math.round(skier.x);
        localStorage.setItem('frostbyte_highscore', String(highScore));
        localStorage.setItem('frostbyte_highscore_x', String(highScoreX));
    }
}

// ─── Character selection screen ───────────────────────────────────────────────

function drawCharSelect() {
    // Background
    ctx.fillStyle = '#0E1628';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle snow ground
    ctx.fillStyle = '#121C30';
    ctx.fillRect(0, GAME_HEIGHT * 0.72, GAME_WIDTH, GAME_HEIGHT * 0.28);

    // Mountain silhouettes in background
    ctx.fillStyle = '#1A2844';
    ctx.beginPath();
    ctx.moveTo(0, GAME_HEIGHT * 0.55);
    ctx.lineTo(80, GAME_HEIGHT * 0.35);
    ctx.lineTo(160, GAME_HEIGHT * 0.45);
    ctx.lineTo(260, GAME_HEIGHT * 0.28);
    ctx.lineTo(340, GAME_HEIGHT * 0.42);
    ctx.lineTo(440, GAME_HEIGHT * 0.30);
    ctx.lineTo(540, GAME_HEIGHT * 0.38);
    ctx.lineTo(GAME_WIDTH, GAME_HEIGHT * 0.48);
    ctx.lineTo(GAME_WIDTH, GAME_HEIGHT * 0.72);
    ctx.lineTo(0, GAME_HEIGHT * 0.72);
    ctx.closePath();
    ctx.fill();

    // Snow caps on mountains
    ctx.fillStyle = '#2A3858';
    ctx.beginPath();
    ctx.moveTo(245, GAME_HEIGHT * 0.28);
    ctx.lineTo(260, GAME_HEIGHT * 0.28);
    ctx.lineTo(275, GAME_HEIGHT * 0.32);
    ctx.lineTo(245, GAME_HEIGHT * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(425, GAME_HEIGHT * 0.30);
    ctx.lineTo(440, GAME_HEIGHT * 0.30);
    ctx.lineTo(455, GAME_HEIGHT * 0.34);
    ctx.lineTo(425, GAME_HEIGHT * 0.34);
    ctx.closePath();
    ctx.fill();

    // Animated snow
    drawSnow();

    // Title with glow
    ctx.save();
    ctx.shadowColor = '#00AAFF';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#00DDFF';
    ctx.font = 'bold 44px "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FROSTBYTE', GAME_WIDTH/2, 68);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Subtitle
    ctx.fillStyle = '#88BBDD';
    ctx.font = '16px "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CHOOSE YOUR RIDE', GAME_WIDTH/2, 100);

    // High score display
    if (highScore > 0) {
        ctx.fillStyle = '#556688';
        ctx.font = '12px "Orbitron", sans-serif';
        ctx.fillText('Best: ' + highScore + 'm', GAME_WIDTH/2, 120);
    }

    // Panel dimensions
    const pw = 170, ph = 250;
    const gap = 30;
    const leftX = GAME_WIDTH/2 - pw - gap/2;
    const rightX = GAME_WIDTH/2 + gap/2;
    const panelY = 140;

    // Draw panels
    drawSelectPanel(leftX, panelY, pw, ph, 'skier');
    drawSelectPanel(rightX, panelY, pw, ph, 'snowboarder');

    // Bottom text
    ctx.fillStyle = '#5588AA';
    ctx.font = '13px "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Click / Tap to select', GAME_WIDTH/2, panelY + ph + 30);
}

function drawSelectPanel(x, y, w, h, type) {
    // Hover detection (simple highlight for whichever side the mouse is on)
    const isLeft = type === 'skier';
    const hovered = isLeft ? (lastPointerX < GAME_WIDTH/2) : (lastPointerX >= GAME_WIDTH/2);

    // Panel background
    ctx.fillStyle = hovered ? 'rgba(0,60,100,0.5)' : 'rgba(10,25,50,0.6)';
    ctx.fillRect(x, y, w, h);

    // Panel border
    ctx.strokeStyle = hovered ? '#00CCFF' : '#2A5A7A';
    ctx.lineWidth = hovered ? 2.5 : 1.5;
    ctx.strokeRect(x, y, w, h);

    // Draw character preview at 2x scale
    ctx.save();
    ctx.translate(x + w/2, y + h/2 - 15);
    ctx.scale(2.2, 2.2);
    drawCharPreview(type);
    ctx.restore();

    // Label
    ctx.fillStyle = hovered ? '#FFFFFF' : '#AACCDD';
    ctx.font = 'bold 16px "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(type === 'skier' ? 'SKIER' : 'SNOWBOARD', x + w/2, y + h - 16);
}

// Track last pointer position for hover effects on char select
let lastPointerX = GAME_WIDTH / 2;

function drawCharPreview(type) {
    const b = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(dx, dy, w, h); };
    const isSB = type === 'snowboarder';

    // Equipment
    if (isSB) {
        // Snowboard – dark charcoal
        b(-14, 16, 28, 3, '#3A3A44');
        b(-14, 16, 28, 1, '#505860');
        b(-16, 16,  3, 3, '#505860');
        b( 13, 16,  3, 3, '#505860');
        b( -5, 14,  4, 3, '#222');
        b(  3, 14,  4, 3, '#222');
    } else {
        // Poles – silver/grey
        for (let i = 0; i < 9; i++) { b(-10 + i*-2, -8 + i*2, 2, 2, '#808890'); }
        b(-28, 9, 6, 2, '#A0A8B4');
        for (let i = 0; i < 9; i++) { b(8 + i*2, -8 + i*2, 2, 2, '#808890'); }
        b( 22, 9, 6, 2, '#A0A8B4');
        // Skis
        b(-12, 13, 2, 4, '#EE4422');
        b(-10, 15, 8, 2, '#DD2200');
        b(  2, 15, 8, 2, '#DD2200');
        b( 10, 13, 2, 4, '#EE4422');
    }

    // Boots – dark
    b(isSB ? -5 : -7, isSB ? 10 : 9, isSB ? 4 : 5, 6, '#2A2A30');
    b(2, isSB ? 10 : 9, isSB ? 4 : 5, 6, '#2A2A30');

    // Pants – blue
    b(-6, 1, 4, 9, '#1858C0');
    b( 2, 1, 4, 9, '#1858C0');
    b(-5, 1, 2, 5, '#2870D8');
    b( 3, 1, 2, 5, '#2870D8');

    // Jacket – blue (both types)
    const jMain = '#2878C8';
    const jHi   = '#3C90E0';
    const jSh   = '#1858A0';
    b(-7,-14, 14, 16, jMain);
    b(-7,-14,  2, 16, jSh);
    b( 5,-14,  2, 16, jSh);
    b(-5,-14, 10,  2, jHi);
    b(-1, -4,  2,  2, '#FFD700'); // zipper detail

    // Arms + dark gloves
    if (isSB) {
        b(-14,-10, 8, 6, jMain); b( 6,-10, 8, 6, jMain);
        b(-16, -6, 6, 5, '#2A2A30'); b(10, -6, 6, 5, '#2A2A30');
    } else {
        b(-12, -9, 6, 6, jMain); b( 6, -9, 6, 6, jMain);
        b(-14, -5, 6, 5, '#2A2A30'); b( 8, -5, 6, 5, '#2A2A30');
    }

    // Neck + Head – warm peach skin
    b(-2,-16, 4, 4, '#F0B880');
    b(-5,-24, 10, 9, '#F0B880');
    b(-5,-24, 2, 9, '#D8A068');
    b( 3,-24, 2, 9, '#D8A068');

    // Goggles – blue tinted
    b(-5,-22, 4, 4, '#4488CC');
    b( 1,-22, 4, 4, '#4488CC');
    b(-1,-22, 2, 3, '#333');
    b(-4,-21, 1, 1, '#88CCFF');
    b( 3,-21, 1, 1, '#88CCFF');

    // Helmet – grey rounded
    b(-6,-26, 12, 4, '#606878');
    b(-5,-32, 10, 7, '#707880');
    b(-4,-33, 8, 2, '#808890');
    b(-3,-34, 6, 2, '#909AA0');
    b(-4,-32, 3, 5, '#808890');
    b( 3,-30, 2, 4, '#585E68');
    b(-7,-28, 2, 6, '#585E68');
    b( 5,-28, 2, 6, '#585E68');
}

// ─── HUD ──────────────────────────────────────────────────────────────────────

function drawPowerupHUD() {
    // Positioned right of the jump button (both on the left side of screen)
    const hx = 85, hy = GAME_HEIGHT - 52;

    // Background
    ctx.fillStyle = 'rgba(5,15,30,0.72)';
    ctx.fillRect(hx, hy, 130, 44);

    // Border
    ctx.strokeStyle = heldPowerup ? POWERUP_COLORS[heldPowerup] : '#2A6080';
    ctx.lineWidth = 2; ctx.strokeRect(hx, hy, 130, 44);
    ctx.strokeStyle = heldPowerup
        ? POWERUP_COLORS[heldPowerup] + '33'
        : 'rgba(42,96,128,0.2)';
    ctx.lineWidth = 1; ctx.strokeRect(hx + 2, hy + 2, 126, 40);

    // Label
    ctx.fillStyle = '#66BBDD'; ctx.font = 'bold 10px "Orbitron", "Courier New", monospace'; ctx.textAlign = 'left';
    ctx.fillText('POWER-UP', hx + 6, hy + 14);

    if (heldPowerup) {
        const col = POWERUP_COLORS[heldPowerup];
        ctx.fillStyle = col;
        ctx.fillRect(hx + 5, hy + 19, 120, 19);
        ctx.fillStyle = '#000'; ctx.font = 'bold 11px "Orbitron", "Courier New", monospace';
        ctx.fillText(heldPowerup.toUpperCase() + '  [E]', hx + 9, hy + 33);
    } else {
        ctx.fillStyle = '#334455'; ctx.font = '10px "Orbitron", "Courier New", monospace';
        ctx.fillText('- empty -', hx + 6, hy + 33);
    }

    // Active timer badges – colors match their power-up type consistently
    let ty = hy - 6;
    const badge = (label, col, sec) => {
        ctx.fillStyle = 'rgba(5,15,30,0.6)';
        ctx.fillRect(hx, ty - 16, 110, 18);
        ctx.fillStyle = col;
        ctx.fillRect(hx, ty - 16, 110, 18);
        ctx.fillStyle = '#000'; ctx.font = 'bold 10px "Orbitron", "Courier New", monospace';
        ctx.fillText(label + ' ' + sec + 's', hx + 4, ty - 3);
        ty -= 21;
    };
    if (shieldActive) badge('SHIELD',   'rgba(0,255,127,0.8)',  Math.ceil(shieldTimer/60));
    if (boostActive)  badge('BOOST',    'rgba(255,215,0,0.8)',  Math.ceil(boostTimer/60));
    if (yeti.frozen)  badge('YT FROZE', 'rgba(0,191,255,0.8)',  Math.ceil(yeti.frozenTimer/60));
    if (yeti.stunned) badge('YT STUN',  'rgba(255,140,0,0.85)', Math.ceil(yeti.stunnedTimer/60));
}

function drawMobileButtons() {
    // Jump button – bottom-left so both buttons are on the same side for one-handed use
    const x = 44;
    const y = GAME_HEIGHT - 38;
    const r = 30;

    ctx.save();

    ctx.shadowColor = '#00AADD';
    ctx.shadowBlur = 14;

    ctx.fillStyle = 'rgba(0,30,60,0.6)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();

    ctx.strokeStyle = '#00CCFF'; ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(0,180,255,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r - 6, 0, Math.PI*2); ctx.stroke();

    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 12px "Orbitron", "Courier New", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('JUMP', x, y);
    ctx.textBaseline = 'alphabetic';

    ctx.restore();
}

// ─── Update ───────────────────────────────────────────────────────────────────

function update() {
    // Always animate snow (even on menus)
    updateSnow();

    if (gameState === 'charselect' || gameState === 'crashed' || gameState === 'caught') return;

    // Steering – relative touch takes priority, then mouse, then keyboard
    if (useRelativeTouch) {
        skier.angle = Math.max(-2, Math.min(2, touchDeltaX / 40));
    } else if (useMouseControl) {
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

    // ── High-score tombstone ──────────────────────────────────────────────────
    if (!tombstonePlaced && highScore > 0 && distance >= highScore - 250) {
        tombstoneObj = {
            x: highScoreX,
            y: GAME_HEIGHT + 60,
            score: highScore
        };
        tombstonePlaced = true;
    }
    if (tombstoneObj) {
        if (!freezeActive) tombstoneObj.y -= speed;
        if (tombstoneObj.y < -80) tombstoneObj = null;
    }

    // Move obstacles (frozen = paused)
    if (!freezeActive) {
        obstacles.forEach(obs => { obs.y -= speed; });
        powerupPickups.forEach(p  => { p.y  -= speed; });
    }

    // Cull off-screen
    obstacles     = obstacles.filter(o => o.y > -50 && !o.destroyed);
    powerupPickups = powerupPickups.filter(p => p.y > -50);

    // Spawn obstacles & power-ups
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
                    checkAndSaveHighScore();
                }
            }
        }
    }

    // Power-up projectiles
    for (let i = powerupProjectiles.length - 1; i >= 0; i--) {
        const proj = powerupProjectiles[i];
        proj.x += proj.vx;
        proj.y += proj.vy - speed * 0.5;

        if (proj.type === 'bomb') {
            proj.timer--;
            if (proj.timer <= 0) {
                explodeBomb(proj.x, proj.y);
                powerupProjectiles.splice(i, 1);
                continue;
            }
        }

        if (yeti.active && !yeti.frozen && !yeti.stunned) {
            const dx = proj.x - yeti.x, dy = proj.y - yeti.y;
            if (Math.sqrt(dx*dx + dy*dy) < 50) {
                if (proj.type === 'snowball') { yeti.stunned = true; yeti.stunnedTimer = 180; }
                else if (proj.type === 'bomb') { explodeBomb(proj.x, proj.y); }
                powerupProjectiles.splice(i, 1); continue;
            }
        }

        let hitObstacle = false;
        for (const obs of obstacles) {
            if (obs.type === 'jump') continue;
            const dx = proj.x - obs.x, dy = proj.y - obs.y;
            if (Math.sqrt(dx*dx + dy*dy) < 25) {
                obs.destroyed = true; hitObstacle = true; break;
            }
        }
        if (hitObstacle) { powerupProjectiles.splice(i, 1); continue; }

        if (proj.y < -80 || proj.y > GAME_HEIGHT + 80 || proj.x < -80 || proj.x > GAME_WIDTH + 80) {
            powerupProjectiles.splice(i, 1);
        }
    }

    // ── Yeti logic ────────────────────────────────────────────────────────────

    if (distance > 5000 && !yeti.active && yeti.retreatCooldown <= 0) {
        yeti.active = true;
        yeti.x = Math.random() * GAME_WIDTH;
        yeti.y = GAME_HEIGHT + 100;
        yeti.stunned = false;
        yeti.frozen  = false;
    }

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
            yeti.y -= speed * 0.4;
        }

        yeti.speed = Math.min(8, 4 + (distance - 5000) / 2000);

        if (yeti.y < -350) {
            yeti.active = false;
            yeti.retreatCooldown = 3000;
        }

        if (checkYetiCollision() && jumpHeight < 20 && !shieldActive) {
            gameState = 'caught';
            checkAndSaveHighScore();
        }
    }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
    // Character selection screen
    if (gameState === 'charselect') {
        drawCharSelect();
        return;
    }

    // Snow background – cool white with slight blue tint
    ctx.fillStyle = '#E8ECF2';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Obstacles (sorted by depth)
    const sorted = [...obstacles].sort((a, b) => a.y - b.y);
    sorted.forEach(obs => {
        if (obs.y > -50 && obs.y < GAME_HEIGHT + 50) {
            if      (obs.type === 'tree') drawTree(obs.x, obs.y, obs.snowy);
            else if (obs.type === 'rock') drawRock(obs.x, obs.y);
            else if (obs.type === 'jump') drawJump(obs.x, obs.y);
        }
    });

    // Power-up pickups
    powerupPickups.forEach(p => {
        if (p.y > -50 && p.y < GAME_HEIGHT + 50) drawPowerupPickup(p);
    });

    // High-score tombstone
    if (tombstoneObj && tombstoneObj.y > -50 && tombstoneObj.y < GAME_HEIGHT + 50) {
        drawTombstone(tombstoneObj.x, tombstoneObj.y, tombstoneObj.score);
    }

    // Projectiles
    drawProjectiles();

    // Skier / Snowboarder
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
        ctx.fillStyle = '#FFF'; ctx.font = 'bold 12px "Orbitron", "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('YETI INCOMING...', GAME_WIDTH/2, 23);
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
        `Distance: ${Math.floor(distance)}m | Best: ${Math.floor(highScore)}m | Speed: ${speed.toFixed(1)}${status}`;

    // Game-over overlays
    if (gameState === 'crashed' || gameState === 'caught') {
        ctx.fillStyle = gameState === 'caught' ? 'rgba(100,0,0,0.75)' : 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        ctx.fillStyle = '#FFF'; ctx.font = 'bold 36px "Orbitron", "Courier New", monospace'; ctx.textAlign = 'center';
        ctx.fillText(gameState === 'caught' ? 'EATEN BY YETI!' : 'CRASHED!', GAME_WIDTH/2, GAME_HEIGHT/2 - 40);

        ctx.font = '20px "Orbitron", "Courier New", monospace';
        ctx.fillText(`Distance: ${Math.floor(distance)}m`, GAME_WIDTH/2, GAME_HEIGHT/2 + 5);

        if (distance >= highScore && highScore > 0) {
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 18px "Orbitron", "Courier New", monospace';
            ctx.fillText('NEW HIGH SCORE!', GAME_WIDTH/2, GAME_HEIGHT/2 + 35);
        } else if (highScore > 0) {
            ctx.fillStyle = '#66CCEE';
            ctx.font = '16px "Orbitron", "Courier New", monospace';
            ctx.fillText(`Best: ${Math.floor(highScore)}m`, GAME_WIDTH/2, GAME_HEIGHT/2 + 35);
        }

        ctx.fillStyle = '#AAA';
        ctx.font = '16px "Orbitron", "Courier New", monospace';
        ctx.fillText('Tap / SPACE to restart', GAME_WIDTH/2, GAME_HEIGHT/2 + 70);
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
    tombstonePlaced = false;
    tombstoneObj = null;
    highScore = parseInt(localStorage.getItem('frostbyte_highscore') || '0', 10);
    highScoreX = parseInt(localStorage.getItem('frostbyte_highscore_x') || String(GAME_WIDTH / 2), 10);
    initObstacles();
}

function selectCharacter(type) {
    playerType = type;
    gameState = 'playing';
    resetGame();
}

// ─── Game loop ────────────────────────────────────────────────────────────────

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// ─── Keyboard input ───────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
    if (gameState === 'charselect') {
        if (e.key === '1') { selectCharacter('skier'); return; }
        if (e.key === '2') { selectCharacter('snowboarder'); return; }
        return;
    }

    useMouseControl = false;
    useRelativeTouch = false;
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
    const mx = (e.clientX - rect.left) / scale;
    lastPointerX = mx;  // for char select hover
    if (gameState === 'charselect') return;
    mouseX = mx;
    useMouseControl = true;
    useRelativeTouch = false;
});

canvas.addEventListener('click', e => {
    if (gameState === 'charselect') {
        const rect = canvas.getBoundingClientRect();
        const clickX = (e.clientX - rect.left) / scale;
        selectCharacter(clickX < GAME_WIDTH / 2 ? 'skier' : 'snowboarder');
        return;
    }
    if (gameState === 'crashed' || gameState === 'caught') { resetGame(); return; }
    if (heldPowerup) usePowerup();
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

// ─── Touch input (relative steering) ─────────────────────────────────────────

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

    lastPointerX = pos.x;  // for char select hover

    if (gameState === 'charselect') {
        selectCharacter(pos.x < GAME_WIDTH / 2 ? 'skier' : 'snowboarder');
        return;
    }

    if (gameState === 'crashed' || gameState === 'caught') { resetGame(); return; }

    // Tap JUMP button area (bottom-left circle, center at 44, GAME_HEIGHT-38)
    const jdx = pos.x - 44, jdy = pos.y - (GAME_HEIGHT - 38);
    if (Math.sqrt(jdx*jdx + jdy*jdy) < 44) {
        if (jumpHeight === 0) { jumpVelocity = 12; gameState = 'jumping'; }
        return;
    }

    // Tap power-up HUD area (right of jump button, x=85..215, bottom strip)
    if (pos.x >= 80 && pos.x < 220 && pos.y > GAME_HEIGHT - 58) {
        usePowerup(); return;
    }

    // Begin relative drag steering
    activeTouchId   = touch.identifier;
    touchStartX     = pos.x;
    touchDeltaX     = 0;
    useRelativeTouch = true;
    useMouseControl  = false;
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
        if (touch.identifier === activeTouchId) {
            const pos = getTouchPos(touch);
            touchDeltaX = pos.x - touchStartX;
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
        if (touch.identifier === activeTouchId) {
            activeTouchId    = null;
            touchStartX      = null;
            touchDeltaX      = 0;
            useRelativeTouch = false;
        }
    }
}, { passive: false });

// ─── Boot ─────────────────────────────────────────────────────────────────────

initSnow();
initObstacles();
gameLoop();
