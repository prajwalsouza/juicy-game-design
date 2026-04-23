(() => {
  "use strict";

  const STAGE_W = 900;
  const STAGE_H = 1000;

  const C = {
    ink: "#24323b",
    paper: "#f1fbef",
    paper2: "#dff2e1",
    line: "#9bc9ad",
    grid: "#c7dfcf",
    teal: "#2aa88f",
    tealDark: "#177465",
    coral: "#ef6a4c",
    coralDark: "#bc3f31",
    sun: "#f2c84b",
    blue: "#438fe1",
    plum: "#a24783",
    white: "#fbfff9",
    danger: "#e34d4d"
  };

  const PIECE_COLORS = {
    I: "#34adc2",
    O: "#f2c84b",
    T: "#a24783",
    S: "#45b96f",
    Z: "#ef6a4c",
    J: "#438fe1",
    L: "#f09a3e"
  };

  const PIECE_BASE = {
    I: [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
    O: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    T: [{ x: 0, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    S: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 }],
    Z: [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    J: [{ x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    L: [{ x: 1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 }]
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function choose(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawFittedText(ctx, text, x, y, maxWidth, baseSize, minSize, align = "center") {
    let size = baseSize;
    for (; size > minSize; size -= 1) {
      ctx.font = `900 ${size}px Avenir Next, Trebuchet MS, sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) break;
    }
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    return size;
  }

  function normalizeCells(cells) {
    const minX = Math.min(...cells.map((cell) => cell.x));
    const minY = Math.min(...cells.map((cell) => cell.y));
    return cells
      .map((cell) => ({ x: cell.x - minX, y: cell.y - minY }))
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }

  function buildRotations(cells) {
    const rotations = [];
    let current = cells.map((cell) => ({ x: cell.x, y: cell.y }));

    for (let i = 0; i < 4; i += 1) {
      const normalized = normalizeCells(current);
      const key = normalized.map((cell) => `${cell.x},${cell.y}`).join("|");
      if (!rotations.some((rotation) => rotation.key === key)) {
        rotations.push({ key, cells: normalized });
      }
      current = current.map((cell) => ({ x: cell.y, y: -cell.x }));
    }

    while (rotations.length < 4) {
      rotations.push({ key: rotations[rotations.length - 1].key, cells: rotations[rotations.length - 1].cells });
    }

    return rotations.map((rotation) => rotation.cells);
  }

  const PIECES = Object.fromEntries(
    Object.keys(PIECE_BASE).map((type) => [type, buildRotations(PIECE_BASE[type])])
  );

  const SHARED_RANGE_GUARDS = {
    particleAmount: "particles",
    shakePower: "screenShake",
    freezePower: "hitStop",
    soundVolume: "sounds"
  };

  const SHARED_TOGGLE_DEPENDENTS = Object.entries(SHARED_RANGE_GUARDS).reduce((groups, [rangeKey, toggleKey]) => {
    (groups[toggleKey] ||= []).push(rangeKey);
    return groups;
  }, {});

  const CANVAS_THEME = {
    tetris: {
      bg: "hsl(222 70% 96%)",
      bits: "hsl(222 42% 88%)",
      board: "hsl(222 48% 93%)",
      grid: "hsl(222 28% 80%)"
    },
    flappy: {
      sky: "hsl(204 80% 92%)",
      sun: "hsl(45 94% 67%)",
      waves: "hsla(204, 26%, 24%, 0.08)",
      ground: "hsl(145 34% 88%)"
    },
    pong: {
      bg: "hsl(14 76% 95%)",
      grid: "hsla(14, 18%, 24%, 0.12)"
    },
    breakout: {
      bg: "hsl(275 74% 96%)",
      arena: "hsl(275 46% 93%)",
      grid: "hsla(275, 18%, 24%, 0.1)"
    },
    snake: {
      bg: "hsl(102 54% 96%)",
      board: "hsl(102 36% 92%)",
      shadow: "hsla(102, 16%, 22%, 0.06)",
      tileHue: 102,
      grid: "hsla(102, 16%, 22%, 0.1)"
    }
  };

  const DEFAULT_JUICE = {
    shared: {
      intensity: 1,
      color: true,
      particles: true,
      particleAmount: 1,
      rings: true,
      scorePops: true,
      screenShake: true,
      shakePower: 1,
      hitStop: true,
      freezePower: 1,
      screenFlash: true,
      sounds: true,
      soundVolume: 0.8
    },
    tetris: {
      backgroundBits: true,
      ghostPiece: true,
      nextPreview: true,
      moveNudge: true,
      pieceSquash: true,
      rotationBurst: true,
      hardDropSlam: true,
      lockDust: true,
      lineFlash: true,
      lineShards: true,
      comboPitch: true
    },
    tetrisPotential: {
      potentiality: true,
      stressFields: true,
      fieldCount: 6,
      stressThreshold: 6,
      overloadTiles: true,
      starterOverload: true,
      overloadBlast: true,
      collapseSettle: true,
      lineBatteries: true
    },
    flappy: {
      parallax: true,
      backgroundWaves: true,
      birdTrail: true,
      birdSquash: true,
      flapBurst: true,
      passConfetti: true,
      nearMissSparks: true,
      pipeWobble: true,
      crashBurst: true
    },
    flappyPotential: {
      potentiality: true,
      rubberBands: true,
      bandStretch: 1,
      bandsForShield: 3,
      protectiveShield: true,
      pipeCollapse: true
    },
    pong: {
      courtGrid: true,
      ballTrail: true,
      paddleSquash: true,
      hitSparks: true,
      wallThump: true,
      scoreFlash: true,
      aiWobble: true
    },
    pongPotential: {
      potentiality: true,
      paddleSling: true,
      ballHeat: true,
      chargeRate: 1,
      releaseThreshold: 4,
      breakHeat: 2.6,
      riskSlowdown: true,
      snapRelease: true,
      aiPaddleBreak: true
    },
    dino: {
      parallax: true,
      dinoTrail: true,
      dinoSquash: true,
      jumpBurst: true,
      landDust: true,
      obstacleWobble: true,
      crashBurst: true,
      scorePulse: true
    },
    dinoPotential: {
      potentiality: true,
      springLoad: true,
      fossilCores: true,
      fossilsForQuake: 3,
      stompCrack: true,
      quakeRelease: true
    },
    breakout: {
      wallGrid: true,
      ballTrail: true,
      paddleSquash: true,
      brickWobble: true,
      impactSparks: true,
      brickShards: true,
      scorePulse: true
    },
    breakoutPotential: {
      potentiality: true,
      paddleSling: true,
      coreBricks: true,
      cascadeLimit: 5,
      breakerBall: true,
      adjacentBurst: true
    },
    snake: {
      boardPulse: true,
      trailEcho: true,
      headSquash: true,
      biteBurst: true,
      chargePips: true,
      blockWobble: true,
      scorePulse: true
    },
    snakePotential: {
      potentiality: true,
      sparkFruit: true,
      breakerBlocks: true,
      wallBreak: true,
      blockRewards: true
    }
  };

  const JUICE_SCHEMA = {
    shared: {
      title: "Global",
      controls: [
        { type: "range", key: "intensity", label: "Master juice", min: 0, max: 1, step: 0.01, main: true },
        { type: "toggle", key: "color", label: "Color", main: true },
        { type: "toggle", key: "particles", label: "Particles", main: true },
        { type: "range", key: "particleAmount", label: "Particle count", min: 0, max: 2, step: 0.01 },
        { type: "toggle", key: "rings", label: "Impact rings" },
        { type: "toggle", key: "scorePops", label: "Score pops" },
        { type: "toggle", key: "screenShake", label: "Screen shake", main: true },
        { type: "range", key: "shakePower", label: "Shake power", min: 0, max: 2, step: 0.01 },
        { type: "toggle", key: "hitStop", label: "Freeze frames" },
        { type: "range", key: "freezePower", label: "Freeze power", min: 0, max: 2, step: 0.01 },
        { type: "toggle", key: "screenFlash", label: "Screen flash" },
        { type: "toggle", key: "sounds", label: "Sounds", main: true },
        { type: "range", key: "soundVolume", label: "Sound volume", min: 0, max: 1, step: 0.01 }
      ]
    },
    tetris: {
      title: "Tetris",
      controls: [
        { type: "toggle", key: "backgroundBits", label: "Background bits" },
        { type: "toggle", key: "ghostPiece", label: "Ghost piece" },
        { type: "toggle", key: "nextPreview", label: "Next preview" },
        { type: "toggle", key: "moveNudge", label: "Move nudge" },
        { type: "toggle", key: "pieceSquash", label: "Squash/stretch" },
        { type: "toggle", key: "rotationBurst", label: "Rotate burst" },
        { type: "toggle", key: "hardDropSlam", label: "Hard drop slam" },
        { type: "toggle", key: "lockDust", label: "Lock dust" },
        { type: "toggle", key: "lineFlash", label: "Line flash" },
        { type: "toggle", key: "lineShards", label: "Line shards" },
        { type: "toggle", key: "comboPitch", label: "Combo pitch" }
      ]
    },
    tetrisPotential: {
      title: "Potentiality",
      controls: [
        { type: "toggle", key: "potentiality", label: "World potential" },
        { type: "toggle", key: "stressFields", label: "Stress fields" },
        { type: "range", key: "fieldCount", label: "Field count", min: 0, max: 12, step: 1 },
        { type: "range", key: "stressThreshold", label: "Stress threshold", min: 3, max: 12, step: 1 },
        { type: "toggle", key: "overloadTiles", label: "Overload tiles" },
        { type: "toggle", key: "starterOverload", label: "Starter overload" },
        { type: "toggle", key: "overloadBlast", label: "Overload blast" },
        { type: "toggle", key: "collapseSettle", label: "Collapse settle" },
        { type: "toggle", key: "lineBatteries", label: "Line batteries" }
      ]
    },
    flappy: {
      title: "Flappy",
      controls: [
        { type: "toggle", key: "parallax", label: "Parallax" },
        { type: "toggle", key: "backgroundWaves", label: "Sky waves" },
        { type: "toggle", key: "birdTrail", label: "Bird trail" },
        { type: "toggle", key: "birdSquash", label: "Bird squash" },
        { type: "toggle", key: "flapBurst", label: "Flap burst" },
        { type: "toggle", key: "passConfetti", label: "Pass confetti" },
        { type: "toggle", key: "nearMissSparks", label: "Near-miss sparks" },
        { type: "toggle", key: "pipeWobble", label: "Pipe wobble" },
        { type: "toggle", key: "crashBurst", label: "Crash burst" }
      ]
    },
    flappyPotential: {
      title: "Potentiality",
      controls: [
        { type: "toggle", key: "potentiality", label: "World potential" },
        { type: "toggle", key: "rubberBands", label: "Rubber bands" },
        { type: "range", key: "bandStretch", label: "Band stretch", min: 0.25, max: 2, step: 0.01 },
        { type: "range", key: "bandsForShield", label: "Bands for shield", min: 1, max: 6, step: 1 },
        { type: "toggle", key: "protectiveShield", label: "Protective shield" },
        { type: "toggle", key: "pipeCollapse", label: "Pipe collapse" }
      ]
    },
    pong: {
      title: "Pong",
      controls: [
        { type: "toggle", key: "courtGrid", label: "Court grid" },
        { type: "toggle", key: "ballTrail", label: "Ball trail" },
        { type: "toggle", key: "paddleSquash", label: "Paddle squash" },
        { type: "toggle", key: "hitSparks", label: "Hit sparks" },
        { type: "toggle", key: "wallThump", label: "Wall thump" },
        { type: "toggle", key: "scoreFlash", label: "Score flash" },
        { type: "toggle", key: "aiWobble", label: "AI wobble" }
      ]
    },
    pongPotential: {
      title: "Potentiality",
      controls: [
        { type: "toggle", key: "potentiality", label: "World potential" },
        { type: "toggle", key: "paddleSling", label: "Rubber sling" },
        { type: "toggle", key: "ballHeat", label: "Hot ball" },
        { type: "range", key: "chargeRate", label: "Charge rate", min: 0.25, max: 2, step: 0.01 },
        { type: "range", key: "releaseThreshold", label: "Charge hits", min: 2, max: 8, step: 1 },
        { type: "range", key: "breakHeat", label: "Break heat", min: 1.4, max: 4, step: 0.1 },
        { type: "toggle", key: "riskSlowdown", label: "Charge slowdown" },
        { type: "toggle", key: "snapRelease", label: "Snap release" },
        { type: "toggle", key: "aiPaddleBreak", label: "AI paddle break" }
      ]
    },
    dino: {
      title: "Dino",
      controls: [
        { type: "toggle", key: "parallax", label: "Parallax" },
        { type: "toggle", key: "dinoTrail", label: "Dino trail" },
        { type: "toggle", key: "dinoSquash", label: "Dino squash" },
        { type: "toggle", key: "jumpBurst", label: "Jump burst" },
        { type: "toggle", key: "landDust", label: "Land dust" },
        { type: "toggle", key: "obstacleWobble", label: "Obstacle wobble" },
        { type: "toggle", key: "crashBurst", label: "Crash burst" },
        { type: "toggle", key: "scorePulse", label: "Score pulse" }
      ]
    },
    dinoPotential: {
      title: "Potentiality",
      controls: [
        { type: "toggle", key: "potentiality", label: "World potential" },
        { type: "toggle", key: "springLoad", label: "Spring load" },
        { type: "toggle", key: "fossilCores", label: "Fossil cores" },
        { type: "range", key: "fossilsForQuake", label: "Fossils for quake", min: 1, max: 6, step: 1 },
        { type: "toggle", key: "stompCrack", label: "Stomp crack" },
        { type: "toggle", key: "quakeRelease", label: "Quake release" }
      ]
    },
    breakout: {
      title: "Breakout",
      controls: [
        { type: "toggle", key: "wallGrid", label: "Wall grid" },
        { type: "toggle", key: "ballTrail", label: "Ball trail" },
        { type: "toggle", key: "paddleSquash", label: "Paddle squash" },
        { type: "toggle", key: "brickWobble", label: "Brick wobble" },
        { type: "toggle", key: "impactSparks", label: "Impact sparks" },
        { type: "toggle", key: "brickShards", label: "Brick shards" },
        { type: "toggle", key: "scorePulse", label: "Score pulse" }
      ]
    },
    breakoutPotential: {
      title: "Potentiality",
      controls: [
        { type: "toggle", key: "potentiality", label: "World potential" },
        { type: "toggle", key: "paddleSling", label: "Paddle sling" },
        { type: "toggle", key: "coreBricks", label: "Core bricks" },
        { type: "range", key: "cascadeLimit", label: "Cascade limit", min: 2, max: 9, step: 1 },
        { type: "toggle", key: "breakerBall", label: "Breaker ball" },
        { type: "toggle", key: "adjacentBurst", label: "Adjacent burst" }
      ]
    },
    snake: {
      title: "Snake",
      controls: [
        { type: "toggle", key: "boardPulse", label: "Board pulse" },
        { type: "toggle", key: "trailEcho", label: "Trail echo" },
        { type: "toggle", key: "headSquash", label: "Head squash" },
        { type: "toggle", key: "biteBurst", label: "Bite burst" },
        { type: "toggle", key: "chargePips", label: "Body charge" },
        { type: "toggle", key: "blockWobble", label: "Block wobble" },
        { type: "toggle", key: "scorePulse", label: "Score pulse" }
      ]
    },
    snakePotential: {
      title: "Potentiality",
      controls: [
        { type: "toggle", key: "potentiality", label: "World potential" },
        { type: "toggle", key: "sparkFruit", label: "Spark pickups" },
        { type: "toggle", key: "breakerBlocks", label: "Breaker blocks" },
        { type: "toggle", key: "wallBreak", label: "Wall break" },
        { type: "toggle", key: "blockRewards", label: "Block rewards" }
      ]
    }
  };

  const CONTROL_HELP = {
    shared: {
      intensity: "Scales every juice effect up or down at once.",
      color: "Keeps the distinct color palette; off turns effects into ink-toned feedback.",
      particles: "Enables small debris, sparks, confetti, and burst fragments.",
      particleAmount: "Changes how many particles each burst creates.",
      rings: "Adds expanding circles at impacts and releases.",
      scorePops: "Shows floating labels for points, charges, and releases.",
      screenShake: "Moves the camera briefly when something hits hard.",
      shakePower: "Controls how strong the camera shake can get.",
      hitStop: "Adds tiny freeze frames so impacts feel heavier.",
      freezePower: "Controls the length of those impact pauses.",
      screenFlash: "Flashes the playfield color on major events.",
      sounds: "Enables the simple generated sound effects.",
      soundVolume: "Controls the volume of generated sound effects."
    },
    byKey: {
      backgroundBits: "Animates small background details behind the Tetris board.",
      ghostPiece: "Shows where the falling Tetris piece will land.",
      nextPreview: "Shows the next Tetris piece before it enters.",
      moveNudge: "Adds a tiny motion push when the Tetris piece shifts.",
      pieceSquash: "Squashes and stretches pieces on movement, landing, and impact.",
      rotationBurst: "Adds sparks when a piece rotates.",
      hardDropSlam: "Makes hard drops land with a stronger impact.",
      lockDust: "Adds dust when a piece locks into the stack.",
      lineFlash: "Flashes completed Tetris lines before they clear.",
      lineShards: "Adds fragments when completed lines break apart.",
      comboPitch: "Raises the sound energy as line clears chain together.",
      potentiality: "Turns on the extra stored-energy systems for this game.",
      stressFields: "Adds charged zones that falling Tetris blocks can pass through.",
      fieldCount: "Sets how many Tetris stress fields can appear.",
      stressThreshold: "Sets how much stress must be gathered before an overload appears.",
      overloadTiles: "Creates special charged Tetris blocks after enough stress is gathered.",
      starterOverload: "Seeds early overload promise so the system is visible from the start.",
      overloadBlast: "Lets overload blocks explode when they lock.",
      collapseSettle: "Lets Tetris cells settle downward after overload blasts.",
      lineBatteries: "Lets charged Tetris cells add extra energy to line clears.",
      parallax: "Moves background layers at different speeds for depth.",
      backgroundWaves: "Adds soft moving waves in the Flappy sky.",
      birdTrail: "Leaves a fading trail behind the bird.",
      birdSquash: "Squashes the bird on flap, drift, and collision.",
      flapBurst: "Adds a burst when the bird flaps.",
      passConfetti: "Adds confetti when a pipe is passed.",
      nearMissSparks: "Shows sparks when the bird barely clears a pipe.",
      pipeWobble: "Makes pipes wobble after tension or impact.",
      crashBurst: "Adds a larger burst when the run crashes.",
      rubberBands: "Places stretchable bands in Flappy pipe gaps.",
      bandStretch: "Controls how dramatically Flappy bands stretch and snap.",
      bandsForShield: "Sets how many bands must be collected for a one-use shield.",
      protectiveShield: "Stores collected band energy as a shield around the bird.",
      pipeCollapse: "Lets a charged shield break pipes into falling fragments.",
      courtGrid: "Shows a subtle Pong court grid for speed and position.",
      ballTrail: "Leaves a fading trail behind the Pong ball.",
      paddleSquash: "Squashes paddles and ball when they collide.",
      hitSparks: "Adds sparks on Pong paddle hits.",
      wallThump: "Adds rings and shake when the Pong ball hits a wall.",
      scoreFlash: "Flashes the Pong court when a point is scored.",
      aiWobble: "Adds a small imperfect wobble to the AI paddle.",
      paddleSling: "Lets the player hold a rubber sling before impact to create charge.",
      ballHeat: "Makes charged Pong returns heat the ball from blue to yellow to red.",
      chargeRate: "Controls how quickly the Pong sling loads while held.",
      releaseThreshold: "Sets how many charged Pong hits are needed for a snap release.",
      breakHeat: "Sets how hot the Pong ball must get to break the AI paddle.",
      riskSlowdown: "Slows the Pong paddle while the sling is being stretched.",
      snapRelease: "Releases stored Pong charge as a speed and heat spike.",
      aiPaddleBreak: "Lets an overheated Pong ball shatter the AI paddle.",
      dinoTrail: "Leaves a fading trail behind the dino.",
      dinoSquash: "Squashes the dino when jumping, charging, and landing.",
      jumpBurst: "Adds dust and rings when the dino jumps.",
      landDust: "Adds ground dust when the dino lands or stomps.",
      obstacleWobble: "Makes Dino obstacles wobble when cracked or hit.",
      scorePulse: "Adds pop labels for Dino scoring moments.",
      springLoad: "Lets holding jump compress spring energy before takeoff.",
      fossilCores: "Adds visible fossil cores inside Dino obstacles.",
      fossilsForQuake: "Sets how many cracked fossils fill the quake meter.",
      stompCrack: "Lets airborne stomps crack fossil cores.",
      quakeRelease: "Lets a full quake meter spend itself to shatter obstacles.",
      wallGrid: "Adds subtle wall markings behind the Breakout bricks.",
      brickWobble: "Makes Breakout bricks shake when they are hit or charged.",
      impactSparks: "Adds sparks when the Breakout ball hits paddle, wall, or bricks.",
      brickShards: "Breaks destroyed Breakout bricks into small fragments.",
      paddleSling: "Lets holding the paddle store elastic energy before the next return.",
      coreBricks: "Adds charged core bricks that fill the cascade meter when broken.",
      cascadeLimit: "Sets how many core hits are needed before a cascade release is ready.",
      breakerBall: "Turns a full cascade meter into a temporary brick-piercing ball.",
      adjacentBurst: "Lets breaker impacts crack nearby bricks for a chain reaction.",
      boardPulse: "Breathes light through the Snake board as risk and energy build.",
      trailEcho: "Leaves fading body echoes behind the snake during turns and near misses.",
      headSquash: "Squashes and stretches the Snake head on bites, turns, and impacts.",
      biteBurst: "Adds bursts when the Snake eats fruit, sparks, or smashes a threat.",
      chargePips: "Stores collected sparks visibly inside the snake body.",
      blockWobble: "Makes crash blocks tremble when the snake approaches with a full charge.",
      sparkFruit: "Adds simple spark pickups that fill the snake with stored energy.",
      breakerBlocks: "Places crash blocks that can be destroyed instead of ending the run when fully charged.",
      wallBreak: "Lets a full spark charge punch through one wall and wrap to the other side.",
      blockRewards: "Makes broken crash blocks spill new fruit and sparks back into the board."
    }
  };

  function cloneJuiceSettings() {
    return JSON.parse(JSON.stringify(DEFAULT_JUICE));
  }

  function mergeJuiceSettings(saved) {
    const settings = cloneJuiceSettings();
    if (!saved || typeof saved !== "object") return settings;
    for (const [scope, defaults] of Object.entries(settings)) {
      const savedScope = saved[scope];
      if (!savedScope || typeof savedScope !== "object") continue;
      for (const key of Object.keys(defaults)) {
        if (key in savedScope && typeof savedScope[key] === typeof defaults[key]) {
          settings[scope][key] = savedScope[key];
        }
      }
    }
    return settings;
  }

  function makeDrySettings() {
    const settings = cloneJuiceSettings();
    for (const section of Object.values(settings)) {
      for (const key of Object.keys(section)) {
        if (typeof section[key] === "boolean") section[key] = false;
      }
    }
    settings.shared.intensity = 0;
    settings.shared.shakePower = 0;
    settings.shared.freezePower = 0;
    settings.shared.soundVolume = 0;
    return settings;
  }

  class TinyAudio {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.volume = 0.8;
    }

    unlock() {
      if (!this.enabled) return;
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          this.enabled = false;
          return;
        }
        this.ctx = new AudioContextClass();
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    }

    tone(freq, duration, type = "sine", gainValue = 0.035, delay = 0) {
      if (!this.ctx || !this.enabled || this.volume <= 0) return;
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(gainValue * this.volume, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.025);
    }

    play(name, amount = 1) {
      const power = clamp(amount, 0.25, 2.5);
      if (name === "move") this.tone(180 + power * 35, 0.045, "square", 0.018);
      if (name === "rotate") this.tone(340 + power * 40, 0.07, "triangle", 0.03);
      if (name === "drop") this.tone(95, 0.12, "sawtooth", 0.045);
      if (name === "lock") this.tone(145, 0.08, "triangle", 0.032);
      if (name === "clear") {
        this.tone(330 * power, 0.08, "triangle", 0.035, 0);
        this.tone(440 * power, 0.08, "triangle", 0.035, 0.055);
        this.tone(660 * power, 0.12, "triangle", 0.04, 0.11);
      }
      if (name === "flap") this.tone(390 + power * 110, 0.075, "sine", 0.035);
      if (name === "pass") {
        this.tone(520 + power * 55, 0.075, "triangle", 0.035, 0);
        this.tone(780 + power * 80, 0.12, "triangle", 0.038, 0.06);
      }
      if (name === "crash") {
        this.tone(95, 0.18, "sawtooth", 0.06, 0);
        this.tone(55, 0.22, "square", 0.035, 0.035);
      }
    }
  }

  class JuiceFX {
    constructor() {
      this.particles = [];
      this.rings = [];
      this.pops = [];
      this.flash = null;
      this.freeze = 0;
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakeVX = 0;
      this.shakeVY = 0;
      this.intensity = 1;
      this.audio = new TinyAudio();
      this.settings = cloneJuiceSettings();
      this.reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    setSettings(settings) {
      this.settings = settings;
      this.audio.volume = this.scalar("soundVolume", 0.8);
      if (!this.setting("particles", true)) this.particles.length = 0;
      if (!this.setting("rings", true)) this.rings.length = 0;
      if (!this.setting("scorePops", true)) this.pops.length = 0;
      if (!this.setting("screenFlash", true)) this.flash = null;
    }

    setting(key, fallback = true) {
      return this.settings?.shared?.[key] ?? fallback;
    }

    scalar(key, fallback = 1) {
      const value = this.settings?.shared?.[key];
      return typeof value === "number" ? value : fallback;
    }

    gameSetting(game, key, fallback = true) {
      return this.settings?.[game]?.[key] ?? fallback;
    }

    color(color, fallback = C.ink) {
      return this.setting("color", true) ? color : fallback;
    }

    get amount() {
      const intensity = this.scalar("intensity", this.intensity);
      return this.reducedMotion ? Math.min(intensity, 0.35) : intensity;
    }

    clear() {
      this.particles.length = 0;
      this.rings.length = 0;
      this.pops.length = 0;
      this.flash = null;
      this.freeze = 0;
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakeVX = 0;
      this.shakeVY = 0;
    }

    unlockAudio() {
      this.audio.unlock();
    }

    hitStop(seconds) {
      if (!this.setting("hitStop", true) || this.amount <= 0) return;
      this.freeze = Math.max(this.freeze, seconds * this.amount * this.scalar("freezePower", 1));
    }

    gameScale() {
      return this.freeze > 0 ? 0.06 : 1;
    }

    shake(x, y) {
      const amount = this.amount;
      if (!this.setting("screenShake", true) || amount <= 0) return;
      const power = this.scalar("shakePower", 1);
      this.shakeVX += x * amount * power * 42;
      this.shakeVY += y * amount * power * 42;
    }

    screenFlash(color, alpha, duration) {
      const amount = this.amount;
      if (!this.setting("screenFlash", true) || amount <= 0) return;
      this.flash = {
        color,
        alpha: alpha * amount,
        maxAlpha: alpha * amount,
        age: 0,
        life: duration
      };
    }

    ring(x, y, color, radius = 34, life = 0.36) {
      const amount = this.amount;
      if (!this.setting("rings", true) || amount <= 0) return;
      this.rings.push({ x, y, color, radius, age: 0, life: life * (0.8 + amount * 0.2) });
    }

    popText(text, x, y, color = C.ink, size = 32) {
      const amount = this.amount;
      if (!this.setting("scorePops", true) || amount <= 0) return;
      this.pops.push({ text, x, y, color, size, age: 0, life: 0.72, vy: -58 * amount });
    }

    burst(x, y, count, options = {}) {
      const amount = this.amount;
      const particleAmount = this.scalar("particleAmount", 1);
      if (!this.setting("particles", true) || amount <= 0 || particleAmount <= 0) return;
      const total = Math.max(1, Math.round(count * amount * particleAmount));
      const spread = options.spread ?? Math.PI * 2;
      const base = options.angle ?? 0;
      const speed = options.speed ?? 230;
      const colors = options.colors ?? [C.coral, C.sun, C.teal, C.blue];
      const gravity = options.gravity ?? 260;
      const size = options.size ?? 7;
      const life = options.life ?? 0.58;

      for (let i = 0; i < total; i += 1) {
        const angle = base + rand(-spread / 2, spread / 2);
        const velocity = speed * rand(0.38, 1.12);
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          color: this.color(choose(colors), C.ink),
          size: size * rand(0.65, 1.35),
          age: 0,
          life: life * rand(0.65, 1.25),
          gravity,
          drag: options.drag ?? 0.86,
          rot: rand(0, Math.PI),
          spin: rand(-8, 8),
          shape: options.shape ?? "square"
        });
      }
    }

    sound(name, amount = 1) {
      if (!this.setting("sounds", true)) return;
      this.audio.volume = this.scalar("soundVolume", 0.8);
      this.audio.play(name, amount);
    }

    update(dt) {
      this.freeze = Math.max(0, this.freeze - dt);

      const spring = 44;
      const drag = Math.pow(0.001, dt);
      this.shakeVX += -this.shakeX * spring * dt;
      this.shakeVY += -this.shakeY * spring * dt;
      this.shakeVX *= drag;
      this.shakeVY *= drag;
      this.shakeX += this.shakeVX * dt;
      this.shakeY += this.shakeVY * dt;

      for (let i = this.particles.length - 1; i >= 0; i -= 1) {
        const p = this.particles[i];
        p.age += dt;
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy *= Math.pow(p.drag, dt * 60);
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        if (p.age >= p.life) this.particles.splice(i, 1);
      }

      for (let i = this.rings.length - 1; i >= 0; i -= 1) {
        const ring = this.rings[i];
        ring.age += dt;
        if (ring.age >= ring.life) this.rings.splice(i, 1);
      }

      for (let i = this.pops.length - 1; i >= 0; i -= 1) {
        const pop = this.pops[i];
        pop.age += dt;
        pop.y += pop.vy * dt;
        pop.vy *= Math.pow(0.8, dt * 60);
        if (pop.age >= pop.life) this.pops.splice(i, 1);
      }

      if (this.flash) {
        this.flash.age += dt;
        this.flash.alpha = this.flash.maxAlpha * (1 - this.flash.age / this.flash.life);
        if (this.flash.age >= this.flash.life) this.flash = null;
      }
    }

    draw(ctx) {
      for (const ring of this.rings) {
        const t = ring.age / ring.life;
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.65;
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 8 * (1 - t) + 1;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius * (0.45 + t * 1.35), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      for (const p of this.particles) {
        const t = p.age / p.life;
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          roundRect(ctx, -p.size / 2, -p.size / 2, p.size, p.size, 2);
          ctx.fill();
        }
        ctx.restore();
      }

      for (const pop of this.pops) {
        const t = pop.age / pop.life;
        ctx.save();
        ctx.globalAlpha = Math.sin((1 - t) * Math.PI * 0.5);
        ctx.fillStyle = pop.color;
        ctx.font = `900 ${pop.size * (1 + 0.18 * (1 - t))}px Avenir Next, Trebuchet MS, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 7;
        ctx.strokeStyle = C.paper;
        ctx.strokeText(pop.text, pop.x, pop.y);
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      }

      if (this.flash) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.flash.alpha);
        ctx.fillStyle = this.flash.color;
        ctx.fillRect(0, 0, STAGE_W, STAGE_H);
        ctx.restore();
      }
    }
  }

  class JuicyTetris {
    constructor(fx) {
      this.fx = fx;
      this.name = "tetris";
      this.paused = false;
      this.reset();
    }

    juice(key, fallback = true) {
      return this.fx.gameSetting(this.name, key, fallback);
    }

    potential(key, fallback = true) {
      return this.fx.gameSetting(`${this.name}Potential`, key, fallback);
    }

    potentialActive() {
      return this.potential("potentiality") && this.potential("stressFields") && this.potential("fieldCount", 6) > 0;
    }

    reset() {
      this.board = Array.from({ length: 20 }, () => Array(10).fill(null));
      this.bag = [];
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.combo = -1;
      this.gameOver = false;
      this.paused = false;
      this.fallTimer = 0;
      this.clearFlashes = [];
      this.stressFields = [];
      this.stress = 0;
      this.stressPulse = 0;
      this.overloadStock = this.potential("starterOverload") ? 2 : 0;
      this.next = this.randomPiece();
      this.syncStressFields();
      this.spawn();
    }

    randomPiece() {
      if (this.bag.length === 0) {
        this.bag = Object.keys(PIECES);
        for (let i = this.bag.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
      }
      const type = this.bag.pop();
      return { type, rot: 0, cells: PIECES[type][0], color: PIECE_COLORS[type] };
    }

    spawn() {
      const type = this.next.type;
      this.active = {
        type,
        rot: 0,
        cells: PIECES[type][0],
        color: PIECE_COLORS[type],
        x: 3,
        y: -1,
        nudge: 0,
        pulse: 0,
        stretch: 0,
        stressGlow: 0,
        specialCells: []
      };
      const width = Math.max(...this.active.cells.map((cell) => cell.x)) + 1;
      this.active.x = Math.floor((10 - width) / 2);
      if (this.shouldSpawnOverload()) this.assignOverloadToActive();
      this.next = this.randomPiece();
      if (!this.valid(this.active, 0, 0, this.active.cells)) {
        this.gameOver = true;
        this.fx.hitStop(0.16);
        this.fx.shake(0, 10);
        this.fx.screenFlash(C.danger, 0.22, 0.34);
      }
    }

    getStats() {
      return {
        score: this.score,
        middleLabel: "Lines",
        middle: this.lines,
        lowerLabel: this.potentialActive() ? "Stress" : "Level",
        lower: this.potentialActive() ? `${this.stress}/${this.stressLimit()}` : this.level
      };
    }

    stressLimit() {
      return Math.max(1, Math.round(this.potential("stressThreshold", 6)));
    }

    shouldSpawnOverload() {
      return this.potentialActive() && this.potential("overloadTiles") && this.overloadStock > 0;
    }

    assignOverloadToActive() {
      if (!this.active || !this.potential("overloadTiles")) return false;
      const current = new Set(this.active.specialCells || []);
      if (current.size >= this.active.cells.length) return false;
      let index = Math.floor(rand(0, this.active.cells.length));
      for (let i = 0; i < this.active.cells.length; i += 1) {
        const candidate = (index + i) % this.active.cells.length;
        if (!current.has(candidate)) {
          index = candidate;
          break;
        }
      }
      this.active.specialCells = [...current, index];
      this.active.pulse = Math.max(this.active.pulse, 1.1);
      this.active.stressGlow = 1.2;
      if (this.overloadStock > 0) this.overloadStock -= 1;
      return true;
    }

    grantOverloadTile(layout = this.layout()) {
      if (!this.potential("overloadTiles")) return;
      const placedNow = this.assignOverloadToActive();
      if (!placedNow) this.overloadStock += 1;
      this.stressPulse = 1.35;
      this.fx.popText("overload", STAGE_W / 2, layout.y - 46, C.ink, 36);
      this.fx.burst(STAGE_W / 2, layout.y + 24, 28, {
        colors: [C.ink, C.sun, C.coral, C.white],
        speed: 240,
        size: 7,
        gravity: 130
      });
      this.fx.ring(STAGE_W / 2, layout.y + 28, C.ink, 58, 0.36);
      this.fx.shake(0, 4.5);
      this.fx.sound("clear", 0.8);
    }

    fallInterval() {
      return Math.max(0.11, 0.78 - (this.level - 1) * 0.065);
    }

    valid(piece, dx, dy, cells) {
      for (const cell of cells) {
        const x = piece.x + dx + cell.x;
        const y = piece.y + dy + cell.y;
        if (x < 0 || x >= 10 || y >= 20) return false;
        if (y >= 0 && this.board[y][x]) return false;
      }
      return true;
    }

    syncStressFields() {
      if (!this.potentialActive()) {
        this.stressFields.length = 0;
        return;
      }

      const target = Math.round(this.potential("fieldCount", 6));
      this.stressFields = this.stressFields.filter((field) => {
        return field.x >= 0 && field.x < 10 && field.y >= 0 && field.y < 20 && !this.board[field.y][field.x];
      }).slice(0, target);

      let attempts = 0;
      while (this.stressFields.length < target && attempts < 400) {
        attempts += 1;
        const x = Math.floor(rand(0, 10));
        const y = Math.floor(rand(3, 19));
        if (this.board[y][x]) continue;
        if (this.stressFields.some((field) => field.x === x && field.y === y)) continue;
        this.stressFields.push({ x, y, phase: rand(0, Math.PI * 2), bend: 0 });
      }
    }

    fieldAt(x, y) {
      if (!this.potentialActive()) return -1;
      return this.stressFields.findIndex((field) => field.x === x && field.y === y);
    }

    collectStressFields(layout = this.layout()) {
      if (!this.potentialActive()) return 0;
      let collected = 0;
      for (const cell of this.active.cells) {
        const x = this.active.x + cell.x;
        const y = this.active.y + cell.y;
        if (y < 0) continue;
        const fieldIndex = this.fieldAt(x, y);
        if (fieldIndex < 0) continue;
        this.stressFields.splice(fieldIndex, 1);
        collected += 1;
        this.stress += 1;
        this.stressPulse = 1;
        this.active.stressGlow = 1;

        const px = layout.x + x * layout.cell + layout.cell / 2;
        const py = layout.y + y * layout.cell + layout.cell / 2;
        this.fx.popText("+stress", px, py - 18, C.sun, 22);
        this.fx.burst(px, py, 12, {
          colors: [C.sun, C.coral, C.white],
          speed: 155,
          size: 5,
          gravity: 95,
          shape: "circle"
        });
        this.fx.ring(px, py, C.sun, 28, 0.26);
        this.fx.sound("rotate", 0.65);
      }

      if (collected > 0) {
        this.score += collected * 12;
        this.syncStressFields();
        while (this.stress >= this.stressLimit()) {
          this.stress -= this.stressLimit();
          this.grantOverloadTile(layout);
        }
      }
      return collected;
    }

    settleBoard() {
      let moved = 0;
      for (let x = 0; x < 10; x += 1) {
        const stack = [];
        for (let y = 19; y >= 0; y -= 1) {
          if (this.board[y][x]) stack.push(this.board[y][x]);
        }
        for (let y = 19; y >= 0; y -= 1) {
          const next = stack[19 - y] || null;
          if (this.board[y][x] !== next) moved += 1;
          this.board[y][x] = next;
          if (next) {
            next.pulse = Math.max(next.pulse, 0.85);
            next.wobble = rand(-0.55, 0.55);
          }
        }
      }
      return moved;
    }

    move(dx) {
      if (this.gameOver) return;
      if (this.valid(this.active, dx, 0, this.active.cells)) {
        this.active.x += dx;
        this.collectStressFields();
        this.active.nudge = this.juice("moveNudge") ? dx * 9 : 0;
        this.fx.sound("move", 0.7);
      } else {
        this.fx.shake(dx * 0.8, 0);
        this.fx.ring(...this.pieceCenter(), C.line, 18, 0.2);
      }
    }

    softDrop() {
      if (this.gameOver) return;
      if (this.valid(this.active, 0, 1, this.active.cells)) {
        this.active.y += 1;
        this.collectStressFields();
        this.score += 1;
        if (this.juice("pieceSquash")) this.active.stretch = Math.max(this.active.stretch, 0.35);
      } else {
        this.lockPiece();
      }
      this.fallTimer = 0;
    }

    rotate() {
      if (this.gameOver) return;
      const nextRot = (this.active.rot + 1) % PIECES[this.active.type].length;
      const nextCells = PIECES[this.active.type][nextRot];
      const kicks = [0, -1, 1, -2, 2];
      for (const kick of kicks) {
        if (this.valid(this.active, kick, 0, nextCells)) {
          this.active.x += kick;
          this.active.rot = nextRot;
          this.active.cells = nextCells;
          this.collectStressFields();
          if (this.juice("pieceSquash")) this.active.pulse = 1;
          const [cx, cy] = this.pieceCenter();
          if (this.juice("rotationBurst")) {
            this.fx.burst(cx, cy, 8, {
              colors: [this.fx.color(this.active.color), C.sun, C.white],
              speed: 130,
              size: 5,
              gravity: 80
            });
            this.fx.ring(cx, cy, this.fx.color(this.active.color), 24, 0.24);
          }
          this.fx.sound("rotate", 1);
          return;
        }
      }
      this.fx.shake(0, 2);
    }

    hardDrop() {
      if (this.gameOver) return;
      let distance = 0;
      while (this.valid(this.active, 0, 1, this.active.cells)) {
        this.active.y += 1;
        distance += 1;
        this.collectStressFields();
      }
      this.score += distance * 2;
      if (this.juice("pieceSquash")) this.active.stretch = 1;
      if (this.juice("hardDropSlam")) {
        this.fx.shake(0, 7 + distance * 0.22);
        this.fx.hitStop(0.035);
      }
      this.fx.sound("drop", clamp(distance / 10, 0.7, 1.8));
      this.lockPiece();
    }

    lockPiece() {
      let above = false;
      const layout = this.layout();
      const overloads = [];
      for (let i = 0; i < this.active.cells.length; i += 1) {
        const cell = this.active.cells[i];
        const x = this.active.x + cell.x;
        const y = this.active.y + cell.y;
        if (y < 0) {
          above = true;
          continue;
        }
        const overload = this.active.specialCells?.includes(i);
        this.board[y][x] = {
          color: overload ? C.ink : this.active.color,
          pulse: this.juice("pieceSquash") ? 1 : 0,
          wobble: this.juice("pieceSquash") ? rand(-0.2, 0.2) : 0,
          charged: this.active.stressGlow > 0.08,
          overload
        };
        if (overload) overloads.push({ x, y });
        if (this.juice("lockDust")) {
          this.fx.burst(
            layout.x + x * layout.cell + layout.cell / 2,
            layout.y + y * layout.cell + layout.cell,
            3,
            { colors: [this.fx.color(this.active.color), C.paper, C.line], angle: -Math.PI / 2, spread: Math.PI * 0.85, speed: 80, size: 4, gravity: 150 }
          );
        }
      }

      if (above) {
        this.gameOver = true;
        this.fx.shake(0, 9);
        this.fx.screenFlash(C.danger, 0.24, 0.35);
        this.fx.sound("crash", 1);
        return;
      }

      this.fx.sound("lock", 1);
      this.fx.shake(0, 1.7);
      for (const overload of overloads) {
        this.detonateOverload(overload.x, overload.y, layout);
      }
      this.clearLines();
      this.syncStressFields();
      if (!this.gameOver) this.spawn();
    }

    detonateOverload(x, y, layout = this.layout()) {
      if (!this.potential("overloadBlast")) return;
      const targets = new Set();
      for (let yy = y; yy <= Math.min(19, y + 3); yy += 1) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(9, x + 1); xx += 1) {
          targets.add(`${xx},${yy}`);
        }
      }
      for (let xx = Math.max(0, x - 2); xx <= Math.min(9, x + 2); xx += 1) {
        targets.add(`${xx},${y}`);
      }

      let removed = 0;
      for (const target of targets) {
        const [tx, ty] = target.split(",").map(Number);
        const cell = this.board[ty]?.[tx];
        if (!cell) continue;
        const px = layout.x + tx * layout.cell + layout.cell / 2;
        const py = layout.y + ty * layout.cell + layout.cell / 2;
        this.fx.burst(px, py, cell.overload ? 14 : 5, {
          colors: [C.ink, C.sun, this.fx.color(cell.color), C.white],
          speed: cell.overload ? 300 : 205,
          size: cell.overload ? 8 : 5,
          gravity: 210,
          life: 0.68
        });
        this.board[ty][tx] = null;
        removed += 1;
      }

      const px = layout.x + x * layout.cell + layout.cell / 2;
      const py = layout.y + y * layout.cell + layout.cell / 2;
      this.score += removed * 18 + 120;
      this.fx.popText("blast", px, py - 28, C.ink, 34);
      this.fx.ring(px, py, C.ink, 68, 0.42);
      this.fx.screenFlash(C.sun, 0.16, 0.3);
      this.fx.shake(0, 8);
      this.fx.hitStop(0.085);
      this.fx.sound("crash", 0.8);
      if (this.potential("collapseSettle")) this.settleBoard();
    }

    clearLines() {
      const fullRows = [];
      for (let y = 0; y < 20; y += 1) {
        if (this.board[y].every(Boolean)) fullRows.push(y);
      }

      if (fullRows.length === 0) {
        this.combo = -1;
        return;
      }

      const layout = this.layout();
      let chargedClears = 0;
      for (const row of fullRows) {
        if (this.juice("lineFlash")) this.clearFlashes.push({ row, age: 0, life: 0.36 });
        for (let x = 0; x < 10; x += 1) {
          const px = layout.x + x * layout.cell + layout.cell / 2;
          const py = layout.y + row * layout.cell + layout.cell / 2;
          if (this.board[row][x]?.charged) {
            chargedClears += 1;
            if (this.potential("lineBatteries")) {
              this.fx.burst(px, py, 8, {
                colors: [C.sun, C.white, C.coral],
                speed: 240,
                size: 6,
                gravity: 180,
                life: 0.72
              });
            }
          }
          if (this.juice("lineShards")) {
            this.fx.burst(px, py, 5, {
              colors: [this.fx.color(this.board[row][x].color), C.sun, C.coral, C.white],
              speed: 210,
              size: 5,
              gravity: 210,
              life: 0.62
            });
          }
        }
      }

      this.board = this.board.filter((row) => !row.every(Boolean));
      while (this.board.length < 20) this.board.unshift(Array(10).fill(null));

      this.combo += 1;
      const clearScores = [0, 100, 300, 500, 800];
      const comboBonus = Math.max(0, this.combo) * 60;
      const points = (clearScores[fullRows.length] + comboBonus) * this.level;
      this.score += points;
      if (chargedClears > 0 && this.potential("lineBatteries")) {
        const batteryBonus = chargedClears * 80;
        this.score += batteryBonus;
        this.fx.popText(`+${batteryBonus}`, STAGE_W / 2, layout.y + fullRows[0] * layout.cell - 34, C.sun, 34);
        this.fx.ring(STAGE_W / 2, layout.y + fullRows[0] * layout.cell, C.sun, 58, 0.42);
      }
      this.lines += fullRows.length;
      this.level = 1 + Math.floor(this.lines / 10);

      if (this.juice("lineFlash")) {
        this.fx.hitStop(0.055 + fullRows.length * 0.035);
        this.fx.shake(0, 8 + fullRows.length * 3);
        this.fx.screenFlash(C.sun, 0.18 + fullRows.length * 0.03, 0.32);
      }
      this.fx.popText(`+${points}`, STAGE_W / 2, layout.y + fullRows[0] * layout.cell, C.coral, 38 + fullRows.length * 5);
      this.fx.sound("clear", 1 + fullRows.length * 0.2 + (this.juice("comboPitch") ? Math.max(0, this.combo) * 0.08 : 0));
    }

    pieceCenter() {
      const layout = this.layout();
      let sx = 0;
      let sy = 0;
      for (const cell of this.active.cells) {
        sx += this.active.x + cell.x + 0.5;
        sy += this.active.y + cell.y + 0.5;
      }
      return [
        layout.x + (sx / this.active.cells.length) * layout.cell,
        layout.y + (sy / this.active.cells.length) * layout.cell
      ];
    }

    handleInput(input) {
      if (input === "left") this.move(-1);
      if (input === "right") this.move(1);
      if (input === "down") this.softDrop();
      if (input === "rotate") this.rotate();
      if (input === "drop") this.hardDrop();
    }

    update(dt) {
      if (this.paused || this.gameOver) return;
      this.fallTimer += dt;
      if (this.fallTimer >= this.fallInterval()) {
        this.fallTimer = 0;
        if (this.valid(this.active, 0, 1, this.active.cells)) {
          this.active.y += 1;
          this.collectStressFields();
        } else {
          this.lockPiece();
        }
      }

      this.active.nudge *= Math.pow(0.001, dt);
      this.active.pulse *= Math.pow(0.004, dt);
      this.active.stretch *= Math.pow(0.01, dt);
      this.active.stressGlow *= Math.pow(0.006, dt);
      this.stressPulse *= Math.pow(0.02, dt);

      for (const row of this.board) {
        for (const cell of row) {
          if (!cell) continue;
          cell.pulse *= Math.pow(0.03, dt);
          cell.wobble *= Math.pow(0.02, dt);
        }
      }

      for (let i = this.clearFlashes.length - 1; i >= 0; i -= 1) {
        const flash = this.clearFlashes[i];
        flash.age += dt;
        if (flash.age >= flash.life) this.clearFlashes.splice(i, 1);
      }
    }

    layout() {
      const cell = 34;
      return {
        cell,
        x: (STAGE_W - cell * 10) / 2,
        y: 128,
        w: cell * 10,
        h: cell * 20
      };
    }

    drawCell(ctx, x, y, size, color, options = {}) {
      const pulse = options.pulse ?? 0;
      const stretch = options.stretch ?? 0;
      const alpha = options.alpha ?? 1;
      const wobble = options.wobble ?? 0;
      const sx = 1 + pulse * 0.13 + stretch * 0.08;
      const sy = 1 + pulse * 0.13 - stretch * 0.07;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x + size / 2 + wobble * 3, y + size / 2);
      ctx.scale(sx, sy);
      ctx.translate(-size / 2, -size / 2);
      roundRect(ctx, 2, 2, size - 4, size - 4, 5);
      ctx.fillStyle = color;
      if (!this.fx.setting("color", true)) ctx.fillStyle = C.ink;
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.24)";
      roundRect(ctx, 6, 6, size - 12, Math.max(4, size * 0.18), 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(36,50,59,0.18)";
      ctx.lineWidth = 2;
      roundRect(ctx, 2, 2, size - 4, size - 4, 5);
      ctx.stroke();
      if (options.charged) {
        ctx.fillStyle = this.fx.color(C.sun);
        ctx.beginPath();
        ctx.moveTo(size - 13, 7);
        ctx.lineTo(size - 6, 14);
        ctx.lineTo(size - 13, 21);
        ctx.lineTo(size - 20, 14);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(36,50,59,0.32)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (options.overload) {
        const time = performance.now() / 1000;
        const pulse = 0.72 + Math.sin(time * 7) * 0.22;
        ctx.save();
        ctx.globalAlpha = 0.86;
        ctx.strokeStyle = this.fx.color(C.sun);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size * (0.24 + pulse * 0.08), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = this.fx.color(C.sun);
        ctx.beginPath();
        ctx.moveTo(size / 2, size * 0.22);
        ctx.lineTo(size * 0.72, size / 2);
        ctx.lineTo(size / 2, size * 0.78);
        ctx.lineTo(size * 0.28, size / 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = C.white;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    drawStressFields(ctx, layout) {
      if (!this.potentialActive()) return;
      const time = performance.now() / 1000;
      for (const field of this.stressFields) {
        if (this.board[field.y][field.x]) continue;
        const cx = layout.x + field.x * layout.cell + layout.cell / 2;
        const cy = layout.y + field.y * layout.cell + layout.cell / 2;
        const pulse = 0.5 + Math.sin(time * 3 + field.phase) * 0.5;
        const lean = Math.sin(time * 2.2 + field.phase) * 7;
        ctx.save();
        ctx.globalAlpha = 0.68 + pulse * 0.24;
        ctx.strokeStyle = this.fx.color(C.sun);
        ctx.lineWidth = 3.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy + 10);
        ctx.quadraticCurveTo(cx + lean, cy, cx + 10, cy - 10);
        ctx.stroke();
        ctx.strokeStyle = this.fx.color(C.coral);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 10 + pulse * 2, -0.2, Math.PI * 1.55);
        ctx.stroke();
        ctx.fillStyle = this.fx.color(C.sun, "rgba(36,50,59,0.28)");
        ctx.beginPath();
        ctx.arc(cx, cy, 3.8 + pulse * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    drawStressMeter(ctx, layout) {
      if (!this.potentialActive()) return;
      const limit = this.stressLimit();
      const filled = clamp(this.stress / limit, 0, 1);
      const x = layout.x - 92;
      const y = layout.y + 18;
      const h = 178;
      const w = 18;
      ctx.save();
      ctx.translate(this.stressPulse * rand(-1.5, 1.5), 0);
      ctx.fillStyle = "rgba(255,255,255,0.42)";
      roundRect(ctx, x - 14, y - 14, 58, h + 56, 8);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      roundRect(ctx, x - 14, y - 14, 58, h + 56, 8);
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.font = "900 14px Avenir Next, Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("STRESS", x + 15, y + h + 27);
      ctx.fillStyle = "rgba(36,50,59,0.12)";
      roundRect(ctx, x + 6, y, w, h, 9);
      ctx.fill();
      ctx.fillStyle = this.fx.color(C.coral);
      const fillH = h * filled;
      roundRect(ctx, x + 6, y + h - fillH, w, fillH, 9);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      roundRect(ctx, x + 6, y, w, h, 9);
      ctx.stroke();
      for (let i = 1; i < limit; i += 1) {
        const tickY = y + h - (i / limit) * h;
        ctx.beginPath();
        ctx.moveTo(x + 2, tickY);
        ctx.lineTo(x + 28, tickY);
        ctx.stroke();
      }
      ctx.restore();
    }

    draw(ctx) {
      const layout = this.layout();
      this.syncStressFields();
      ctx.clearRect(0, 0, STAGE_W, STAGE_H);
      ctx.fillStyle = this.fx.color(CANVAS_THEME.tetris.bg, C.paper);
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);

      if (this.juice("backgroundBits")) {
        ctx.save();
        ctx.fillStyle = this.fx.color(CANVAS_THEME.tetris.bits, "rgba(36,50,59,0.08)");
        for (let i = 0; i < 12; i += 1) {
          const x = (i * 91 + 40) % STAGE_W;
          const y = 55 + (i % 5) * 180;
          ctx.globalAlpha = 0.42;
          roundRect(ctx, x, y, 48, 12, 6);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.save();
      roundRect(ctx, layout.x - 18, layout.y - 18, layout.w + 36, layout.h + 36, 8);
      ctx.fillStyle = this.fx.color(CANVAS_THEME.tetris.board, "#ecf8ed");
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.strokeStyle = this.fx.color(CANVAS_THEME.tetris.grid, C.grid);
      ctx.lineWidth = 1;
      for (let x = 0; x <= 10; x += 1) {
        ctx.beginPath();
        ctx.moveTo(layout.x + x * layout.cell, layout.y);
        ctx.lineTo(layout.x + x * layout.cell, layout.y + layout.h);
        ctx.stroke();
      }
      for (let y = 0; y <= 20; y += 1) {
        ctx.beginPath();
        ctx.moveTo(layout.x, layout.y + y * layout.cell);
        ctx.lineTo(layout.x + layout.w, layout.y + y * layout.cell);
        ctx.stroke();
      }
      ctx.restore();

      this.drawStressFields(ctx, layout);
      this.drawStressMeter(ctx, layout);

      for (let y = 0; y < 20; y += 1) {
        for (let x = 0; x < 10; x += 1) {
          const cell = this.board[y][x];
          if (!cell) continue;
          this.drawCell(
            ctx,
            layout.x + x * layout.cell,
            layout.y + y * layout.cell,
            layout.cell,
            cell.color,
            {
              pulse: this.juice("pieceSquash") ? cell.pulse : 0,
              wobble: this.juice("pieceSquash") ? cell.wobble : 0,
              charged: cell.charged && this.potential("lineBatteries"),
              overload: cell.overload
            }
          );
        }
      }

      if (this.juice("ghostPiece")) {
        const ghostY = this.getGhostY();
        for (const cell of this.active.cells) {
          const gx = layout.x + (this.active.x + cell.x) * layout.cell;
          const gy = layout.y + (ghostY + cell.y) * layout.cell;
          if (ghostY + cell.y >= 0) {
            this.drawCell(ctx, gx, gy, layout.cell, this.active.color, { alpha: 0.18 });
          }
        }
      }

      for (let i = 0; i < this.active.cells.length; i += 1) {
        const cell = this.active.cells[i];
        const x = layout.x + (this.active.x + cell.x) * layout.cell + this.active.nudge;
        const y = layout.y + (this.active.y + cell.y) * layout.cell;
        if (this.active.y + cell.y >= 0) {
          const overload = this.active.specialCells?.includes(i);
          this.drawCell(ctx, x, y, layout.cell, overload ? C.ink : this.active.color, {
            pulse: this.juice("pieceSquash") ? this.active.pulse : 0,
            stretch: this.juice("pieceSquash") ? this.active.stretch : 0,
            charged: this.active.stressGlow > 0.08 && this.potential("lineBatteries"),
            overload
          });
        }
      }

      if (this.juice("lineFlash")) {
        for (const flash of this.clearFlashes) {
          const t = flash.age / flash.life;
          ctx.save();
          ctx.globalAlpha = (1 - t) * 0.75;
          ctx.fillStyle = C.white;
          roundRect(ctx, layout.x - 10, layout.y + flash.row * layout.cell + 3, layout.w + 20, layout.cell - 6, 6);
          ctx.fill();
          ctx.restore();
        }
      }

      if (this.juice("nextPreview")) this.drawNext(ctx);

      if (this.paused || this.gameOver) {
        this.drawOverlay(ctx, this.gameOver ? "Game Over" : "Paused");
      }
    }

    getGhostY() {
      let y = this.active.y;
      while (this.valid({ ...this.active, y }, 0, 1, this.active.cells)) y += 1;
      return y;
    }

    drawNext(ctx) {
      const originX = 672;
      const originY = 132;
      ctx.save();
      ctx.fillStyle = C.ink;
      ctx.font = "900 18px Avenir Next, Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("NEXT", originX + 58, originY - 24);
      roundRect(ctx, originX, originY, 116, 116, 8);
      ctx.fillStyle = "rgba(255,255,255,0.46)";
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      ctx.stroke();
      const cells = PIECES[this.next.type][0];
      const minX = Math.min(...cells.map((cell) => cell.x));
      const maxX = Math.max(...cells.map((cell) => cell.x));
      const minY = Math.min(...cells.map((cell) => cell.y));
      const maxY = Math.max(...cells.map((cell) => cell.y));
      const cellSize = 24;
      const dx = originX + 58 - ((maxX - minX + 1) * cellSize) / 2;
      const dy = originY + 58 - ((maxY - minY + 1) * cellSize) / 2;
      for (const cell of cells) {
        this.drawCell(ctx, dx + (cell.x - minX) * cellSize, dy + (cell.y - minY) * cellSize, cellSize, this.next.color);
      }
      ctx.restore();
    }

    drawOverlay(ctx, label) {
      ctx.save();
      ctx.fillStyle = "rgba(241,251,239,0.72)";
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      ctx.fillStyle = C.ink;
      ctx.font = "900 64px Avenir Next, Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, STAGE_W / 2, STAGE_H / 2);
      ctx.restore();
    }

    serialize() {
      return {
        board: this.board,
        bag: this.bag,
        score: this.score,
        lines: this.lines,
        level: this.level,
        combo: this.combo,
        gameOver: this.gameOver,
        paused: this.paused,
        fallTimer: this.fallTimer,
        stressFields: this.stressFields,
        stress: this.stress,
        overloadStock: this.overloadStock,
        next: this.next ? { type: this.next.type, rot: this.next.rot || 0 } : null,
        active: this.active ? {
          type: this.active.type,
          rot: this.active.rot,
          x: this.active.x,
          y: this.active.y,
          nudge: this.active.nudge,
          pulse: this.active.pulse,
          stretch: this.active.stretch,
          stressGlow: this.active.stressGlow,
          specialCells: this.active.specialCells || []
        } : null
      };
    }

    deserialize(state) {
      if (!state || typeof state !== "object") return;
      const cleanRow = (row) => Array.from({ length: 10 }, (_, x) => {
        const cell = Array.isArray(row) ? row[x] : null;
        if (!cell || typeof cell !== "object") return null;
        return {
          color: typeof cell.color === "string" ? cell.color : C.teal,
          pulse: Number(cell.pulse) || 0,
          wobble: Number(cell.wobble) || 0,
          charged: Boolean(cell.charged),
          overload: Boolean(cell.overload)
        };
      });
      if (Array.isArray(state.board)) {
        this.board = Array.from({ length: 20 }, (_, y) => cleanRow(state.board[y]));
      }
      this.bag = Array.isArray(state.bag) ? state.bag.filter((type) => PIECES[type]) : [];
      this.score = Number(state.score) || 0;
      this.lines = Number(state.lines) || 0;
      this.level = Number(state.level) || 1;
      this.combo = Number.isFinite(Number(state.combo)) ? Number(state.combo) : -1;
      this.gameOver = Boolean(state.gameOver);
      this.paused = Boolean(state.paused);
      this.fallTimer = Number(state.fallTimer) || 0;
      this.stress = Number(state.stress) || 0;
      this.overloadStock = Number(state.overloadStock) || 0;
      this.stressFields = Array.isArray(state.stressFields) ? state.stressFields.filter((field) => {
        return Number.isFinite(field.x) && Number.isFinite(field.y);
      }).map((field) => ({
        x: clamp(Math.round(field.x), 0, 9),
        y: clamp(Math.round(field.y), 0, 19),
        phase: Number(field.phase) || 0,
        bend: Number(field.bend) || 0
      })) : [];

      const makePiece = (piece, fallbackY = -1) => {
        const type = piece && PIECES[piece.type] ? piece.type : choose(Object.keys(PIECES));
        const rot = clamp(Math.round(piece?.rot || 0), 0, PIECES[type].length - 1);
        return {
          type,
          rot,
          cells: PIECES[type][rot],
          color: PIECE_COLORS[type],
          x: Number.isFinite(piece?.x) ? piece.x : 3,
          y: Number.isFinite(piece?.y) ? piece.y : fallbackY,
          nudge: Number(piece?.nudge) || 0,
          pulse: Number(piece?.pulse) || 0,
          stretch: Number(piece?.stretch) || 0,
          stressGlow: Number(piece?.stressGlow) || 0,
          specialCells: Array.isArray(piece?.specialCells)
            ? piece.specialCells.map((index) => clamp(Math.round(index), 0, PIECES[type][rot].length - 1))
            : []
        };
      };

      this.next = makePiece(state.next, 0);
      this.active = makePiece(state.active, -1);
      this.syncStressFields();
    }
  }

  class JuicyFlappy {
    constructor(fx) {
      this.fx = fx;
      this.name = "flappy";
      this.paused = false;
      this.best = this.loadBest();
      this.reset();
    }

    juice(key, fallback = true) {
      return this.fx.gameSetting(this.name, key, fallback);
    }

    potential(key, fallback = true) {
      return this.fx.gameSetting(`${this.name}Potential`, key, fallback);
    }

    potentialActive() {
      return this.potential("potentiality");
    }

    loadBest() {
      try {
        return Number(window.localStorage.getItem("juicy-flappy-best") || 0);
      } catch {
        return 0;
      }
    }

    saveBest() {
      try {
        window.localStorage.setItem("juicy-flappy-best", String(this.best));
      } catch {
        // Local storage can be unavailable in strict browser modes.
      }
    }

    reset() {
      this.score = 0;
      this.speed = 260;
      this.state = "ready";
      this.paused = false;
      this.spawnTimer = 0;
      this.scroll = 0;
      this.cloudScroll = 0;
      this.pipes = [];
      this.bandCharge = 0;
      this.shield = 0;
      this.shieldPulse = 0;
      this.bird = {
        x: 250,
        y: 430,
        baseY: 430,
        vy: 0,
        rot: 0,
        squash: 0,
        trail: []
      };
    }

    getStats() {
      return {
        score: this.score,
        middleLabel: "Best",
        middle: this.best,
        lowerLabel: this.potentialActive() && this.potential("rubberBands") ? "Shield" : "Speed",
        lower: this.potentialActive() && this.potential("rubberBands") ? `${this.bandCharge}/${this.bandsForShield()}${this.shield > 0 ? " ready" : ""}` : Math.round(this.speed)
      };
    }

    bandsForShield() {
      return Math.max(1, Math.round(this.potential("bandsForShield", 3)));
    }

    handleInput(input) {
      if (input !== "flap") return;
      if (this.state === "dead") {
        this.reset();
      }
      this.state = "running";
      this.bird.vy = -590;
      if (this.juice("birdSquash")) this.bird.squash = 1;
      if (this.juice("flapBurst")) {
        this.fx.burst(this.bird.x - 18, this.bird.y + 12, 14, {
          colors: [C.sun, C.coral, C.white],
          angle: Math.PI,
          spread: Math.PI * 0.85,
          speed: 145,
          size: 5,
          gravity: 140,
          shape: "circle"
        });
        this.fx.ring(this.bird.x, this.bird.y, C.sun, 28, 0.25);
      }
      this.fx.sound("flap", 1 + this.score * 0.02);
    }

    spawnPipe() {
      const gap = clamp(280 - this.score * 2.2, 215, 280);
      const margin = 170;
      const gapY = rand(margin + gap / 2, STAGE_H - 170 - gap / 2);
      this.pipes.push({
        x: STAGE_W + 60,
        w: 112,
        gap,
        gapY,
        scored: false,
        near: false,
        bandStretch: 0,
        bandPulse: 0,
        tensionReleased: false,
        wobble: 0,
        broken: false,
        fragments: []
      });
    }

    stretchRubberBand(pipe) {
      if (!this.potentialActive() || !this.potential("rubberBands") || pipe.tensionReleased || pipe.broken) return;
      const top = pipe.gapY - pipe.gap / 2;
      const bottom = pipe.gapY + pipe.gap / 2;
      const insideGap = this.bird.y > top + 18 && this.bird.y < bottom - 18;
      if (!insideGap) return;

      const centered = 1 - Math.abs(this.bird.y - pipe.gapY) / (pipe.gap * 0.5);
      const stretch = clamp(centered * this.potential("bandStretch", 1), 0, 1.35);
      pipe.bandStretch = Math.max(pipe.bandStretch, stretch);
      pipe.bandPulse = Math.max(pipe.bandPulse, stretch);
      pipe.wobble = Math.max(pipe.wobble, stretch * 0.7);
    }

    collectRubberBand(pipe) {
      if (!this.potentialActive() || !this.potential("rubberBands")) return;
      const stretch = pipe.bandStretch || 0;
      if (pipe.tensionReleased || stretch < 0.18) return;
      pipe.tensionReleased = true;
      pipe.wobble = 0.9 + stretch * 1.8;
      const x = pipe.x + pipe.w + 18;
      const y = pipe.gapY;
      this.bandCharge += 1;
      if (this.bandCharge >= this.bandsForShield() && this.potential("protectiveShield")) {
        this.bandCharge = 0;
        this.shield = 1;
        this.shieldPulse = 1.4;
        this.fx.popText("shield ready", this.bird.x + 90, this.bird.y - 52, C.sun, 30);
        this.fx.ring(this.bird.x, this.bird.y, C.sun, 70, 0.48);
        this.fx.screenFlash(C.sun, 0.12, 0.28);
      }
      const bonus = Math.max(1, Math.round(2 + stretch * 4));
      this.score += bonus;
      this.best = Math.max(this.best, this.score);
      this.saveBest();
      this.fx.popText("+band", x, y - 26, C.sun, 30);
      this.fx.burst(x, y, 12 + stretch * 30, {
        colors: [C.sun, C.teal, C.white, C.coral],
        speed: 190 + stretch * 120,
        size: 6,
        gravity: 135
      });
      this.fx.ring(x, y, C.sun, 34 + stretch * 40, 0.38);
      this.fx.shake(0, -2 - stretch * 4);
      this.fx.sound("clear", 0.75 + stretch * 0.25);
    }

    update(dt, realDt) {
      if (this.paused) return;
      this.scroll += this.speed * realDt;
      if (this.juice("parallax")) this.cloudScroll += 32 * realDt;

      if (this.state === "ready") {
        this.bird.y = this.bird.baseY + Math.sin(performance.now() / 260) * 13;
        this.bird.rot = Math.sin(performance.now() / 380) * 0.05;
        this.addTrail(realDt);
        return;
      }

      this.speed = Math.min(380, 260 + this.score * 5);
      this.bird.vy += 1640 * dt;
      this.bird.y += this.bird.vy * dt;
      this.bird.rot = clamp(this.bird.vy / 900, -0.65, 0.95);
      this.bird.squash *= this.juice("birdSquash") ? Math.pow(0.005, realDt) : 0;
      this.shieldPulse *= Math.pow(0.035, realDt);
      this.addTrail(realDt);

      if (this.state === "running") {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnPipe();
          this.spawnTimer = rand(1.18, 1.45);
        }

        for (const pipe of this.pipes) {
          pipe.x -= this.speed * dt;
          pipe.wobble *= this.juice("pipeWobble") ? Math.pow(0.004, realDt) : 0;
          pipe.bandPulse *= Math.pow(0.025, realDt);
          if (pipe.broken) this.updatePipeFragments(pipe, dt);
          const inPipeX = this.bird.x > pipe.x && this.bird.x < pipe.x + pipe.w;
          if (inPipeX) this.stretchRubberBand(pipe);
          if (!pipe.scored && pipe.x + pipe.w < this.bird.x - 10) {
            pipe.scored = true;
            pipe.wobble = this.juice("pipeWobble") ? 1 : 0;
            this.score += 1;
            this.best = Math.max(this.best, this.score);
            this.saveBest();
            if (this.juice("passConfetti")) {
              this.fx.hitStop(0.035);
              this.fx.shake(0, -2.2);
              this.fx.screenFlash(C.teal, 0.11, 0.22);
            }
            this.fx.popText("+1", this.bird.x + 96, this.bird.y - 46, C.teal, 42);
            if (this.juice("passConfetti")) {
              this.fx.burst(this.bird.x + 34, this.bird.y, 18, {
                colors: [C.teal, C.sun, C.white, C.blue],
                speed: 180,
                size: 6,
                gravity: 160
              });
            }
            this.collectRubberBand(pipe);
            this.fx.sound("pass", 1 + this.score * 0.03);
          }
        }

        this.pipes = this.pipes.filter((pipe) => pipe.x + pipe.w > -120);
        const collision = this.getCollision();
        if (collision) this.handleCollision(collision);
      } else {
        if (this.bird.y > STAGE_H - 112) {
          this.bird.y = STAGE_H - 112;
          this.bird.vy *= -0.12;
        }
      }
    }

    addTrail(dt) {
      if (!this.juice("birdTrail")) {
        this.bird.trail.length = 0;
        return;
      }
      if (this.bird.trail.length === 0 || Math.hypot(this.bird.x - this.bird.trail[this.bird.trail.length - 1].x, this.bird.y - this.bird.trail[this.bird.trail.length - 1].y) > 12) {
        this.bird.trail.push({ x: this.bird.x, y: this.bird.y, age: 0 });
      }
      for (let i = this.bird.trail.length - 1; i >= 0; i -= 1) {
        this.bird.trail[i].age += dt;
        if (this.bird.trail[i].age > 0.55) this.bird.trail.splice(i, 1);
      }
    }

    collides() {
      return Boolean(this.getCollision());
    }

    getCollision() {
      const r = 32;
      if (this.bird.y - r < 16 || this.bird.y + r > STAGE_H - 112) return { type: "world" };
      for (const pipe of this.pipes) {
        if (pipe.broken) continue;
        const overlapsX = this.bird.x + r > pipe.x && this.bird.x - r < pipe.x + pipe.w;
        if (!overlapsX) continue;
        const top = pipe.gapY - pipe.gap / 2;
        const bottom = pipe.gapY + pipe.gap / 2;
        if (this.bird.y - r < top) return { type: "pipe", pipe, side: "top" };
        if (this.bird.y + r > bottom) return { type: "pipe", pipe, side: "bottom" };
      }
      return null;
    }

    handleCollision(collision) {
      if (collision.type === "pipe" && this.shield > 0 && this.potentialActive() && this.potential("protectiveShield")) {
        this.breakPipe(collision.pipe, collision.side);
        return;
      }
      this.crash();
    }

    updatePipeFragments(pipe, dt) {
      const groundY = STAGE_H - 112;
      for (const fragment of pipe.fragments) {
        fragment.vy += 1500 * dt;
        fragment.x += fragment.vx * dt;
        fragment.y += fragment.vy * dt;
        fragment.rot += fragment.vr * dt;
        if (fragment.y + fragment.h / 2 > groundY) {
          fragment.y = groundY - fragment.h / 2;
          fragment.vy *= -0.18;
          fragment.vx *= 0.82;
          fragment.vr *= 0.72;
        }
      }
    }

    breakPipe(pipe, side) {
      if (pipe.broken) return;
      pipe.broken = true;
      pipe.wobble = 2.2;
      this.shield = 0;
      this.shieldPulse = 1.5;
      this.bird.vy = -430;
      this.bird.squash = 1.2;

      const top = pipe.gapY - pipe.gap / 2;
      const bottom = pipe.gapY + pipe.gap / 2;
      const chunks = this.potential("pipeCollapse") ? [
        { x: pipe.x + pipe.w / 2, y: top / 2, w: pipe.w, h: Math.max(30, top), color: C.teal },
        { x: pipe.x + pipe.w / 2, y: bottom + (STAGE_H - 112 - bottom) / 2, w: pipe.w, h: Math.max(30, STAGE_H - 112 - bottom), color: C.tealDark },
        { x: pipe.x + pipe.w / 2, y: side === "top" ? top - 12 : bottom + 12, w: pipe.w + 24, h: 34, color: C.sun }
      ] : [];
      pipe.fragments = chunks.map((chunk, index) => ({
        ...chunk,
        vx: rand(80, 230) * (index === 0 ? -0.35 : 0.65),
        vy: rand(-420, -180),
        rot: rand(-0.2, 0.2),
        vr: rand(-4.2, 4.2)
      }));

      const impactY = side === "top" ? top : bottom;
      this.score += 12;
      this.best = Math.max(this.best, this.score);
      this.saveBest();
      this.fx.popText("shield break", this.bird.x + 76, this.bird.y - 50, C.sun, 34);
      this.fx.burst(pipe.x + pipe.w / 2, impactY, 56, {
        colors: [C.teal, C.tealDark, C.sun, C.white],
        speed: 360,
        size: 8,
        gravity: 320,
        life: 0.8
      });
      this.fx.ring(this.bird.x, this.bird.y, C.sun, 82, 0.46);
      this.fx.screenFlash(C.sun, 0.2, 0.32);
      this.fx.hitStop(0.12);
      this.fx.shake(14, 11);
      this.fx.sound("crash", 0.85);
    }

    crash() {
      if (this.state === "dead") return;
      this.state = "dead";
      if (this.juice("crashBurst")) {
        this.fx.hitStop(0.16);
        this.fx.shake(15, 16);
        this.fx.screenFlash(C.danger, 0.28, 0.38);
        this.fx.burst(this.bird.x, this.bird.y, 42, {
          colors: [C.coral, C.sun, C.white, C.plum],
          speed: 320,
          size: 8,
          gravity: 380
        });
        this.fx.ring(this.bird.x, this.bird.y, C.danger, 64, 0.42);
      }
      this.fx.sound("crash", 1);
    }

    draw(ctx) {
      ctx.clearRect(0, 0, STAGE_W, STAGE_H);
      this.drawSky(ctx);
      this.drawPipes(ctx);
      this.drawBird(ctx);
      this.drawGround(ctx);
      this.drawScore(ctx);
      if (this.paused || this.state === "dead" || this.state === "ready") {
        this.drawOverlay(ctx);
      }
    }

    drawSky(ctx) {
      ctx.fillStyle = this.fx.color(CANVAS_THEME.flappy.sky, C.paper);
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      ctx.fillStyle = this.fx.color(CANVAS_THEME.flappy.sun, "rgba(36,50,59,0.14)");
      ctx.beginPath();
      ctx.arc(720, 130, 62, 0, Math.PI * 2);
      ctx.fill();

      if (this.juice("parallax")) {
        ctx.fillStyle = "rgba(255,255,255,0.66)";
        for (let i = 0; i < 7; i += 1) {
          const x = ((i * 220 - this.cloudScroll) % (STAGE_W + 260)) - 130;
          const y = 120 + (i % 4) * 90;
          roundRect(ctx, x, y, 124, 28, 14);
          ctx.fill();
          roundRect(ctx, x + 34, y - 22, 72, 32, 16);
          ctx.fill();
        }
      }

      if (this.juice("backgroundWaves")) {
        ctx.strokeStyle = this.fx.color(CANVAS_THEME.flappy.waves, "rgba(36,50,59,0.08)");
        ctx.lineWidth = 2;
        for (let y = 70; y < STAGE_H - 150; y += 80) {
          ctx.beginPath();
          ctx.moveTo(0, y + Math.sin((this.scroll + y) / 130) * 8);
          for (let x = 0; x <= STAGE_W; x += 80) {
            ctx.lineTo(x, y + Math.sin((this.scroll + x + y) / 130) * 8);
          }
          ctx.stroke();
        }
      }
    }

    drawPipes(ctx) {
      for (const pipe of this.pipes) {
        if (pipe.broken) {
          this.drawPipeFragments(ctx, pipe);
          continue;
        }
        const top = pipe.gapY - pipe.gap / 2;
        const bottom = pipe.gapY + pipe.gap / 2;
        const wobble = this.juice("pipeWobble") ? pipe.wobble * Math.sin(performance.now() / 65) * 6 : 0;
        this.drawPipe(ctx, pipe.x + wobble, 0, pipe.w, top, true);
        this.drawPipe(ctx, pipe.x - wobble, bottom, pipe.w, STAGE_H - 112 - bottom, false);
        this.drawTensionGate(ctx, pipe, wobble);
      }
    }

    drawTensionGate(ctx, pipe, wobble) {
      if (!this.potentialActive() || !this.potential("rubberBands") || pipe.tensionReleased) return;
      const tension = pipe.bandStretch || 0;
      const top = pipe.gapY - pipe.gap / 2;
      const bottom = pipe.gapY + pipe.gap / 2;
      const x = pipe.x + pipe.w / 2 + wobble;
      const inPipeX = this.bird.x > pipe.x && this.bird.x < pipe.x + pipe.w;
      const pullX = inPipeX ? (this.bird.x - x) * 0.88 : Math.sin(performance.now() / 120) * 4;
      const pullY = inPipeX ? (this.bird.y - pipe.gapY) * 0.42 : Math.sin(performance.now() / 135) * 5;
      const stretch = tension * this.potential("bandStretch", 1);
      ctx.save();
      ctx.globalAlpha = 0.58 + Math.min(0.32, stretch * 0.22);
      ctx.strokeStyle = this.fx.color(C.sun);
      ctx.lineWidth = 3 + stretch * 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, top + 10);
      ctx.quadraticCurveTo(x + pullX, pipe.gapY + pullY, x, bottom - 10);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,255,255,0.68)";
      ctx.lineWidth = 1.5 + stretch * 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 8, top + 12);
      ctx.quadraticCurveTo(x + pullX * 0.9 + 8, pipe.gapY + pullY, x + 8, bottom - 12);
      ctx.stroke();

      ctx.fillStyle = this.fx.color(C.sun);
      ctx.beginPath();
      ctx.arc(x, top + 10, 6 + stretch * 3, 0, Math.PI * 2);
      ctx.arc(x, bottom - 10, 6 + stretch * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawPipe(ctx, x, y, w, h, topPipe) {
      if (h <= 0) return;
      ctx.save();
      ctx.fillStyle = this.fx.color(C.teal);
      roundRect(ctx, x, y, w, h, 8);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      roundRect(ctx, x + 14, y + 12, 18, Math.max(0, h - 24), 8);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4;
      roundRect(ctx, x, y, w, h, 8);
      ctx.stroke();

      const lipY = topPipe ? y + h - 26 : y;
      ctx.fillStyle = this.fx.color(C.tealDark);
      roundRect(ctx, x - 10, lipY, w + 20, 34, 7);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4;
      roundRect(ctx, x - 10, lipY, w + 20, 34, 7);
      ctx.stroke();
      ctx.restore();
    }

    drawPipeFragments(ctx, pipe) {
      for (const fragment of pipe.fragments) {
        ctx.save();
        ctx.translate(fragment.x, fragment.y);
        ctx.rotate(fragment.rot);
        ctx.fillStyle = this.fx.color(fragment.color);
        roundRect(ctx, -fragment.w / 2, -fragment.h / 2, fragment.w, fragment.h, 8);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        roundRect(ctx, -fragment.w / 2 + 12, -fragment.h / 2 + 12, 16, Math.max(0, fragment.h - 24), 7);
        ctx.fill();
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 4;
        roundRect(ctx, -fragment.w / 2, -fragment.h / 2, fragment.w, fragment.h, 8);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawBird(ctx) {
      const bird = this.bird;
      if (this.potentialActive() && this.potential("protectiveShield") && (this.shield > 0 || this.bandCharge > 0)) {
        const ready = this.shield > 0;
        const progress = ready ? 1 : this.bandCharge / this.bandsForShield();
        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate(Math.sin(performance.now() / 150) * 0.035 * (ready ? 1 : progress));
        ctx.globalAlpha = ready ? 0.78 : 0.3 + progress * 0.28;
        ctx.strokeStyle = this.fx.color(ready ? C.sun : C.white);
        ctx.lineWidth = ready ? 6 : 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 56 + progress * 16 + this.shieldPulse * 8, 44 + progress * 12 + this.shieldPulse * 6, 0, -Math.PI * 0.45, Math.PI * 1.72);
        ctx.stroke();
        ctx.strokeStyle = this.fx.color(C.teal);
        ctx.lineWidth = ready ? 3 : 2;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.ellipse(0, 0, 64 + progress * 12, 50 + progress * 10, 0.15, Math.PI * 0.1, Math.PI * 1.92);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      if (this.juice("birdTrail")) {
        ctx.save();
        for (const point of bird.trail) {
          const t = point.age / 0.55;
          ctx.globalAlpha = (1 - t) * 0.34;
          ctx.fillStyle = this.fx.color(C.coral);
          ctx.beginPath();
          ctx.ellipse(point.x - 8 - t * 24, point.y + 4, 22 * (1 - t), 9 * (1 - t), -0.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      const speedStretch = clamp(bird.vy / 900, -0.35, 0.45);
      const squash = this.juice("birdSquash") ? bird.squash : 0;
      const fallStretch = this.juice("birdSquash") ? Math.max(0, speedStretch) : 0;
      const sx = 1 + squash * 0.18 - fallStretch * 0.1;
      const sy = 1 - squash * 0.16 + fallStretch * 0.22;

      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.rotate(bird.rot);
      ctx.scale(sx, sy);

      ctx.fillStyle = this.fx.color(C.coral);
      ctx.beginPath();
      ctx.ellipse(0, 0, 42, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = this.fx.color(C.sun);
      ctx.beginPath();
      ctx.moveTo(34, -5);
      ctx.lineTo(65, 4);
      ctx.lineTo(34, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = C.white;
      ctx.beginPath();
      ctx.arc(17, -14, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(21, -12, 4.4, 0, Math.PI * 2);
      ctx.fill();

      const wingLift = Math.sin(performance.now() / 70) * 0.5 + bird.squash * 0.8;
      ctx.fillStyle = this.fx.color("#d94d42");
      ctx.save();
      ctx.rotate(-0.35 - wingLift * 0.25);
      ctx.beginPath();
      ctx.ellipse(-16, 9, 24, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }

    drawGround(ctx) {
      const groundY = STAGE_H - 112;
      ctx.fillStyle = this.fx.color(CANVAS_THEME.flappy.ground, "#e9f1eb");
      ctx.fillRect(0, groundY, STAGE_W, 112);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      for (let x = 0; x <= STAGE_W; x += 34) {
        ctx.lineTo(x, groundY + Math.sin((x + this.scroll) / 40) * 5);
      }
      ctx.stroke();

      for (let x = -80; x < STAGE_W + 80; x += 84) {
        const ox = x - (this.scroll % 84);
        ctx.fillStyle = this.fx.color(x % 2 === 0 ? C.teal : C.sun);
        roundRect(ctx, ox, groundY + 36, 48, 12, 6);
        ctx.fill();
      }
    }

    drawScore(ctx) {
      ctx.save();
      ctx.fillStyle = C.ink;
      ctx.font = "900 84px Avenir Next, Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 9;
      ctx.strokeStyle = "rgba(255,255,255,0.64)";
      ctx.strokeText(String(this.score), STAGE_W / 2, 94);
      ctx.fillText(String(this.score), STAGE_W / 2, 94);
      ctx.restore();
    }

    drawOverlay(ctx) {
      if (this.state === "running") return;
      const label = this.paused ? "Paused" : this.state === "dead" ? "Game Over" : "Ready";
      ctx.save();
      ctx.fillStyle = "rgba(241,251,239,0.42)";
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      ctx.fillStyle = C.ink;
      ctx.font = "900 62px Avenir Next, Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, STAGE_W / 2, STAGE_H / 2);
      ctx.restore();
    }

    serialize() {
      return {
        score: this.score,
        best: this.best,
        speed: this.speed,
        state: this.state,
        paused: this.paused,
        spawnTimer: this.spawnTimer,
        scroll: this.scroll,
        cloudScroll: this.cloudScroll,
        bandCharge: this.bandCharge,
        shield: this.shield,
        shieldPulse: this.shieldPulse,
        pipes: this.pipes,
        bird: this.bird
      };
    }

    deserialize(state) {
      if (!state || typeof state !== "object") return;
      this.score = Number(state.score) || 0;
      this.best = Math.max(Number(state.best) || 0, this.loadBest());
      this.speed = Number(state.speed) || 260;
      this.state = ["ready", "running", "dead"].includes(state.state) ? state.state : "ready";
      this.paused = Boolean(state.paused);
      this.spawnTimer = Number(state.spawnTimer) || 0;
      this.scroll = Number(state.scroll) || 0;
      this.cloudScroll = Number(state.cloudScroll) || 0;
      this.bandCharge = Number(state.bandCharge) || 0;
      this.shield = Number(state.shield) || 0;
      this.shieldPulse = Number(state.shieldPulse) || 0;
      this.pipes = Array.isArray(state.pipes) ? state.pipes.map((pipe) => ({
        x: Number(pipe.x) || 0,
        w: Number(pipe.w) || 112,
        gap: Number(pipe.gap) || 260,
        gapY: Number(pipe.gapY) || STAGE_H / 2,
        scored: Boolean(pipe.scored),
        near: Boolean(pipe.near),
        bandStretch: Number(pipe.bandStretch) || 0,
        bandPulse: Number(pipe.bandPulse) || 0,
        tensionReleased: Boolean(pipe.tensionReleased),
        wobble: Number(pipe.wobble) || 0,
        broken: Boolean(pipe.broken),
        fragments: Array.isArray(pipe.fragments) ? pipe.fragments.map((fragment) => ({
          x: Number(fragment.x) || 0,
          y: Number(fragment.y) || 0,
          w: Number(fragment.w) || 0,
          h: Number(fragment.h) || 0,
          color: typeof fragment.color === "string" ? fragment.color : C.teal,
          vx: Number(fragment.vx) || 0,
          vy: Number(fragment.vy) || 0,
          rot: Number(fragment.rot) || 0,
          vr: Number(fragment.vr) || 0
        })) : []
      })) : [];
      this.bird = {
        ...this.bird,
        ...(state.bird || {}),
        trail: Array.isArray(state.bird?.trail) ? state.bird.trail.slice(0, 36) : []
      };
      this.saveBest();
    }
  }

  class JuicyPong {
    constructor(fx) {
      this.fx = fx;
      this.name = "pong";
      this.paused = false;
      this.reset();
    }

    juice(key, fallback = true) {
      return this.fx.gameSetting(this.name, key, fallback);
    }

    potential(key, fallback = true) {
      return this.fx.gameSetting(`${this.name}Potential`, key, fallback);
    }

    potentialActive() {
      return this.potential("potentiality") && this.potential("paddleSling");
    }

    tensionLimit() {
      return Math.max(1, Math.round(this.potential("releaseThreshold", 4)));
    }

    courtTop() {
      return 156;
    }

    courtBottom() {
      return STAGE_H - 72;
    }

    paddleMinY(paddle = this.player) {
      return this.courtTop() + paddle.h / 2 + 10;
    }

    paddleMaxY(paddle = this.player) {
      return this.courtBottom() - paddle.h / 2 - 10;
    }

    breakHeatThreshold() {
      return Math.max(1, Number(this.potential("breakHeat", 2.6)) || 2.6);
    }

    ballHeat() {
      return Math.max(0, Number(this.ball?.heat) || 0);
    }

    heatLevel() {
      return clamp(this.ballHeat() / this.breakHeatThreshold(), 0, 1.35);
    }

    heatColor(heat = this.ballHeat()) {
      const level = heat / this.breakHeatThreshold();
      if (!this.potential("ballHeat", true) || level <= 0.08) return C.blue;
      if (level < 0.45) return C.sun;
      if (level < 0.88) return C.coral;
      return C.danger;
    }

    reset() {
      this.leftScore = 0;
      this.rightScore = 0;
      this.score = 0;
      this.rally = 0;
      this.tension = 0;
      this.tensionPulse = 0;
      this.scoreFlash = 0;
      this.paddleCharge = 0;
      this.releasedCharge = 0;
      this.snapWindow = 0;
      this.chargeHeld = false;
      this.chargePulse = 0;
      this.breakPause = 0;
      this.paused = false;
      this.player = { x: 72, y: STAGE_H / 2, w: 24, h: 196, squash: 0, lean: 0 };
      this.ai = { x: STAGE_W - 94, y: STAGE_H / 2, w: 22, h: 142, squash: 0, lean: 0, broken: false, fragments: [] };
      this.resetBall(1);
    }

    resetBall(direction) {
      this.serveDir = direction;
      this.rally = 0;
      this.ball = {
        x: STAGE_W / 2,
        y: STAGE_H / 2,
        r: 16,
        vx: 0,
        vy: 0,
        speed: 350,
        served: false,
        heat: 0,
        squash: 0,
        trail: []
      };
    }

    getStats() {
      return {
        score: `${this.leftScore}-${this.rightScore}`,
        middleLabel: "Rally",
        middle: this.rally,
        lowerLabel: this.potentialActive() ? "Charge" : "Speed",
        lower: this.potentialActive() ? `${this.tension}/${this.tensionLimit()}` : Math.round(this.ball.speed)
      };
    }

    handleInput(input) {
      if (input === "up") this.movePlayer(-1);
      if (input === "down") this.movePlayer(1);
      if (input === "serve") this.serveBall();
      if (input === "charge" || input === "charge-start") this.startCharge();
      if (input === "charge-end") this.releaseCharge();
    }

    movePlayer(direction) {
      const chargeDrag = this.chargeHeld && this.potential("riskSlowdown") ? 0.55 : 1;
      const next = clamp(this.player.y + direction * 62 * chargeDrag, this.paddleMinY(this.player), this.paddleMaxY(this.player));
      this.player.lean = direction * 1;
      this.player.squash = this.juice("paddleSquash") ? 0.65 : 0;
      this.player.y = next;
      this.fx.sound("move", 0.7);
    }

    setPlayerY(y) {
      const next = clamp(y, this.paddleMinY(this.player), this.paddleMaxY(this.player));
      const diff = next - this.player.y;
      this.player.y = next;
      this.player.lean = clamp(diff / 80, -1, 1);
      if (Math.abs(diff) > 2 && this.juice("paddleSquash")) {
        this.player.squash = Math.max(this.player.squash, 0.35);
      }
    }

    serveBall() {
      if (this.ball.served) return;
      const angle = rand(-0.32, 0.32);
      this.ball.served = true;
      this.ball.vx = this.serveDir * this.ball.speed * Math.cos(angle);
      this.ball.vy = this.ball.speed * Math.sin(angle);
      this.fx.ring(this.ball.x, this.ball.y, C.teal, 32, 0.24);
      this.fx.sound("drop", 0.65);
    }

    startCharge() {
      if (!this.potentialActive()) {
        this.serveBall();
        return;
      }
      if (!this.ball.served) {
        this.serveBall();
        if (!this.ball.served) return;
      }
      this.chargeHeld = true;
      this.snapWindow = 0;
      this.chargePulse = Math.max(this.chargePulse, 0.5);
    }

    releaseCharge() {
      if (!this.potentialActive()) return;
      if (!this.chargeHeld) return;
      this.chargeHeld = false;
      if (this.paddleCharge > 0.12) {
        this.releasedCharge = this.paddleCharge;
        this.snapWindow = 0.24;
        this.chargePulse = 1;
        this.fx.ring(this.player.x + this.player.w, this.player.y, C.sun, 28 + this.paddleCharge * 28, 0.24);
        this.fx.sound("rotate", 0.6 + this.paddleCharge * 0.35);
      }
    }

    updateCharge(realDt) {
      if (!this.potentialActive()) {
        this.paddleCharge = 0;
        this.chargeHeld = false;
        this.snapWindow = 0;
        if (this.ball) this.ball.heat = 0;
        return;
      }

      this.chargePulse *= Math.pow(0.03, realDt);
      this.snapWindow = Math.max(0, this.snapWindow - realDt);
      if (this.ball?.heat) this.ball.heat *= Math.pow(0.9, realDt);
      if (this.chargeHeld && this.ball.served) {
        this.paddleCharge = clamp(this.paddleCharge + realDt * 0.82 * this.potential("chargeRate", 1), 0, 1.25);
        this.chargePulse = Math.max(this.chargePulse, Math.min(0.85, this.paddleCharge));
      } else if (this.snapWindow <= 0) {
        this.paddleCharge *= Math.pow(0.18, realDt);
        this.releasedCharge *= Math.pow(0.08, realDt);
      }
    }

    applyHeatDrive(realDt) {
      if (!this.ball.served || !this.potentialActive() || !this.potential("ballHeat", true)) return;
      const heat = this.ballHeat();
      if (heat <= 0.04) return;
      const speed = Math.hypot(this.ball.vx, this.ball.vy);
      if (speed <= 0) return;
      const target = Math.min(1460, 430 + heat * 265);
      if (speed >= target) return;
      const next = Math.min(target, speed * (1 + realDt * (0.52 + heat * 0.18)) + realDt * heat * 28);
      const scale = next / speed;
      this.ball.vx *= scale;
      this.ball.vy *= scale;
      this.ball.speed = next;
    }

    updateBrokenAi(realDt) {
      if (!this.ai.broken) return;
      this.breakPause = Math.max(0, this.breakPause - realDt);
      for (const fragment of this.ai.fragments) {
        fragment.vy += 520 * realDt;
        fragment.vx *= Math.pow(0.985, realDt * 60);
        fragment.x += fragment.vx * realDt;
        fragment.y += fragment.vy * realDt;
        fragment.rot += fragment.vr * realDt;
      }
      if (this.breakPause <= 0) {
        this.restoreAiPaddle();
        this.resetBall(1);
      }
    }

    restoreAiPaddle() {
      this.ai.broken = false;
      this.ai.fragments = [];
      this.ai.y = STAGE_H / 2;
      this.ai.squash = 0;
      this.ai.lean = 0;
      this.breakPause = 0;
    }

    update(dt, realDt) {
      if (this.paused) return;
      this.player.squash *= Math.pow(0.01, realDt);
      this.player.lean *= Math.pow(0.02, realDt);
      this.ai.squash *= Math.pow(0.01, realDt);
      this.ai.lean *= Math.pow(0.02, realDt);
      this.ball.squash *= Math.pow(0.01, realDt);
      this.tensionPulse *= Math.pow(0.025, realDt);
      this.scoreFlash = Math.max(0, this.scoreFlash - realDt * 2.4);
      this.updateCharge(realDt);
      this.applyHeatDrive(realDt);
      this.updateBrokenAi(realDt);
      if (this.ai.broken) return;

      this.updateAi(dt);
      this.addTrail(realDt);
      if (!this.ball.served) {
        this.ball.x = STAGE_W / 2;
        this.ball.y = STAGE_H / 2 + Math.sin(performance.now() / 320) * 18;
        return;
      }

      this.ball.x += this.ball.vx * dt;
      this.ball.y += this.ball.vy * dt;

      this.checkWallBounce();
      this.checkPaddleHit(this.player, 1);
      this.checkPaddleHit(this.ai, -1);
      this.checkScore();
    }

    updateAi(dt) {
      const target = this.ball.served && this.ball.vx > 0 ? this.ball.y : STAGE_H / 2;
      const wobble = this.juice("aiWobble") ? Math.sin(performance.now() / 180) * 16 : 0;
      const diff = target + wobble - this.ai.y;
      this.ai.y = clamp(this.ai.y + clamp(diff, -520 * dt, 520 * dt), this.paddleMinY(this.ai), this.paddleMaxY(this.ai));
      this.ai.lean = clamp(diff / 160, -1, 1);
    }

    addTrail(dt) {
      if (!this.juice("ballTrail")) {
        this.ball.trail.length = 0;
        return;
      }
      if (this.ball.trail.length === 0 || Math.hypot(this.ball.x - this.ball.trail[this.ball.trail.length - 1].x, this.ball.y - this.ball.trail[this.ball.trail.length - 1].y) > 18) {
        this.ball.trail.push({ x: this.ball.x, y: this.ball.y, age: 0 });
      }
      for (let i = this.ball.trail.length - 1; i >= 0; i -= 1) {
        this.ball.trail[i].age += dt;
        if (this.ball.trail[i].age > 0.42) this.ball.trail.splice(i, 1);
      }
    }

    releaseCourtSnap(load = 1) {
      if (!this.potential("snapRelease")) {
        this.tension %= this.tensionLimit();
        return;
      }

      const released = this.tension;
      this.tension = 0;
      this.tensionPulse = 1.4;
      const speed = Math.hypot(this.ball.vx, this.ball.vy) || this.ball.speed;
      const boost = Math.min(1380, speed + released * 86 + load * 260);
      const direction = Math.atan2(this.ball.vy, this.ball.vx);
      this.ball.vx = Math.cos(direction) * boost;
      this.ball.vy = Math.sin(direction) * boost;
      this.ball.speed = boost;
      this.ball.heat = Math.max(this.ballHeat(), 0.75 + released * 0.38 + load * 0.9);
      this.ball.squash = 1;
      const bonus = released * 22;
      this.score += bonus;
      this.fx.popText("overheat", STAGE_W / 2, 138, C.coral, 42);
      this.fx.popText(`+${bonus}`, STAGE_W / 2, 184, C.sun, 28);
      this.fx.burst(this.player.x + this.player.w + 30, this.player.y, 44 + released * 5, {
        colors: [C.sun, C.teal, C.white, C.coral],
        speed: 280 + load * 90,
        size: 7,
        gravity: 120
      });
      this.fx.ring(this.player.x + this.player.w, this.player.y, C.coral, 82 + load * 54, 0.48);
      this.fx.hitStop(0.085);
      this.fx.shake(0, 8);
      this.fx.screenFlash(C.sun, 0.16, 0.28);
      this.fx.sound("clear", 1.1);
    }

    checkWallBounce() {
      const top = this.courtTop();
      const bottom = this.courtBottom();
      if (this.ball.y - this.ball.r < top) {
        this.ball.y = top + this.ball.r;
        this.ball.vy = Math.abs(this.ball.vy);
        this.wallBounce(this.ball.x, top);
      }
      if (this.ball.y + this.ball.r > bottom) {
        this.ball.y = bottom - this.ball.r;
        this.ball.vy = -Math.abs(this.ball.vy);
        this.wallBounce(this.ball.x, bottom);
      }
    }

    wallBounce(x, y) {
      if (this.juice("wallThump")) {
        this.fx.ring(x, y, C.line, 22, 0.18);
        this.fx.shake(0, y < STAGE_H / 2 ? -1.8 : 1.8);
      }
      this.fx.sound("move", 0.55);
    }

    checkPaddleHit(paddle, direction) {
      const ball = this.ball;
      const withinY = ball.y + ball.r > paddle.y - paddle.h / 2 && ball.y - ball.r < paddle.y + paddle.h / 2;
      const withinX = direction > 0
        ? ball.x - ball.r < paddle.x + paddle.w && ball.x > paddle.x
        : ball.x + ball.r > paddle.x && ball.x < paddle.x + paddle.w;
      const movingToward = direction > 0 ? ball.vx < 0 : ball.vx > 0;
      if (!withinX || !withinY || !movingToward) return;
      if (paddle.broken) return;

      if (direction < 0 && this.shouldBreakAiPaddle()) {
        this.breakAiPaddle(ball);
        return;
      }

      const offset = clamp((ball.y - paddle.y) / (paddle.h / 2), -1, 1);
      const angle = offset * 0.74;
      const speedCap = this.potentialActive() && this.potential("ballHeat", true) ? 1280 : 790;
      const speed = Math.min(speedCap, Math.hypot(ball.vx, ball.vy) * 1.045 + 18 + this.ballHeat() * 8);
      ball.x = direction > 0 ? paddle.x + paddle.w + ball.r : paddle.x - ball.r;
      ball.vx = direction * speed * Math.cos(angle);
      ball.vy = speed * Math.sin(angle);
      ball.speed = speed;
      ball.squash = this.juice("paddleSquash") ? 1 : 0;
      paddle.squash = this.juice("paddleSquash") ? 1 : 0;
      paddle.lean = direction * 1.4;
      this.rally += 1;
      this.score += 2 + Math.floor(this.rally / 4);

      let chargedReturn = 0;
      if (direction > 0 && this.potentialActive()) {
        chargedReturn = this.chargeHeld ? this.paddleCharge : (this.snapWindow > 0 ? this.releasedCharge : 0);
        if (chargedReturn > 0.14) {
          this.tension += 1;
          this.ball.heat = Math.min(5.2, this.ballHeat() + 0.34 + chargedReturn * 0.78 + this.tension * 0.08);
          const boost = 1 + chargedReturn * 0.5 + Math.min(this.tension, this.tensionLimit()) * 0.045;
          ball.vx *= boost;
          ball.vy *= 1 + chargedReturn * 0.16;
          ball.speed = Math.hypot(ball.vx, ball.vy);
          ball.squash = 1 + chargedReturn * 0.5;
          paddle.squash = 1 + chargedReturn * 0.35;
          this.tensionPulse = 1;
          this.score += Math.round(10 + chargedReturn * 28);
          this.fx.popText("charged", paddle.x + paddle.w + 34, ball.y - 34, this.heatColor(), 28 + chargedReturn * 8);
          this.fx.burst(paddle.x + paddle.w, ball.y, 18 + chargedReturn * 18, {
            colors: [C.sun, C.coral, C.danger, C.white],
            angle: 0,
            spread: Math.PI * 0.72,
            speed: 235 + chargedReturn * 120,
            size: 6,
            gravity: 70
          });
          this.fx.ring(paddle.x + paddle.w, ball.y, C.sun, 34 + chargedReturn * 38, 0.28);
          this.fx.shake(3 + chargedReturn * 4, 0);
          this.fx.hitStop(0.03 + chargedReturn * 0.035);
          this.paddleCharge = 0;
          this.releasedCharge = 0;
          this.snapWindow = 0;
          this.chargeHeld = false;
          if (this.tension >= this.tensionLimit()) this.releaseCourtSnap(chargedReturn);
        }
      }

      if (this.juice("hitSparks")) {
        const hitX = direction > 0 ? paddle.x + paddle.w : paddle.x;
        this.fx.hitStop(0.025);
        this.fx.shake(direction * 2.4, 0);
        this.fx.ring(hitX, ball.y, C.coral, 30, 0.2);
        this.fx.burst(hitX, ball.y, 14, {
          colors: [C.coral, C.sun, C.white],
          angle: direction > 0 ? 0 : Math.PI,
          spread: Math.PI * 0.7,
          speed: 185,
          size: 5,
          gravity: 80
        });
      }
      this.fx.sound("pass", 0.75 + this.rally * 0.035 + chargedReturn * 0.2);
    }

    shouldBreakAiPaddle() {
      if (!this.potentialActive() || !this.potential("aiPaddleBreak", true) || this.ai.broken) return false;
      const heat = this.ballHeat();
      const speed = Math.hypot(this.ball.vx, this.ball.vy);
      const threshold = this.breakHeatThreshold();
      return heat >= threshold * 0.92
        || (heat >= threshold * 0.68 && speed >= 980)
        || (heat >= threshold * 0.55 && speed >= 1140);
    }

    breakAiPaddle(ball) {
      const impactX = this.ai.x;
      const impactY = clamp(ball.y, this.ai.y - this.ai.h / 2, this.ai.y + this.ai.h / 2);
      const heat = this.ballHeat();
      this.ai.broken = true;
      this.breakPause = 1.15;
      this.ai.fragments = [];
      for (let i = 0; i < 8; i += 1) {
        const row = i - 3.5;
        this.ai.fragments.push({
          x: this.ai.x + this.ai.w / 2,
          y: this.ai.y + row * 18,
          w: rand(10, 22),
          h: rand(18, 34),
          vx: rand(120, 330) + heat * 34,
          vy: rand(-360, 160) + row * 18,
          rot: rand(-0.5, 0.5),
          vr: rand(-7, 7),
          color: i % 2 === 0 ? C.teal : C.blue
        });
      }

      this.leftScore += 1;
      const bonus = Math.round(180 + heat * 90 + Math.hypot(ball.vx, ball.vy) * 0.08);
      this.score += bonus;
      this.tension = 0;
      this.tensionPulse = 1.5;
      this.paddleCharge = 0;
      this.releasedCharge = 0;
      this.snapWindow = 0;
      this.chargeHeld = false;
      ball.x = impactX - ball.r;
      ball.y = impactY;
      ball.vx = 0;
      ball.vy = 0;
      ball.served = false;
      ball.squash = 1.5;

      this.fx.popText("paddle break", impactX - 54, impactY - 54, C.danger, 38);
      this.fx.popText(`+${bonus}`, impactX - 58, impactY - 12, C.sun, 28);
      this.fx.burst(impactX, impactY, 72, {
        colors: [C.teal, C.blue, C.sun, C.coral, C.danger, C.white],
        angle: 0,
        spread: Math.PI * 0.95,
        speed: 360 + heat * 95,
        size: 8,
        gravity: 420,
        life: 0.78
      });
      this.fx.ring(impactX, impactY, C.danger, 92 + heat * 22, 0.42);
      this.fx.screenFlash(C.danger, 0.18, 0.3);
      this.fx.shake(12 + heat * 2.5, -4);
      this.fx.hitStop(0.12);
      this.fx.sound("clear", 1.15);
    }

    checkScore() {
      if (this.ball.x < -48) {
        this.rightScore += 1;
        this.pointScored(-1);
      }
      if (this.ball.x > STAGE_W + 48) {
        this.leftScore += 1;
        this.pointScored(1);
      }
    }

    pointScored(direction) {
      this.scoreFlash = this.juice("scoreFlash") ? 1 : 0;
      this.fx.popText(direction > 0 ? "+1" : "AI +1", STAGE_W / 2, STAGE_H / 2 - 72, direction > 0 ? C.teal : C.coral, 44);
      if (this.juice("scoreFlash")) {
        this.fx.hitStop(0.09);
        this.fx.shake(direction * 8, 0);
        this.fx.screenFlash(direction > 0 ? C.teal : C.coral, 0.16, 0.32);
      }
      this.fx.sound("clear", 0.85);
      this.paddleCharge = 0;
      this.releasedCharge = 0;
      this.snapWindow = 0;
      this.chargeHeld = false;
      this.tension = 0;
      this.breakPause = 0;
      if (this.ai.broken) this.restoreAiPaddle();
      this.resetBall(direction);
    }

    draw(ctx) {
      ctx.clearRect(0, 0, STAGE_W, STAGE_H);
      this.drawCourt(ctx);
      this.drawBands(ctx);
      this.drawPaddle(ctx, this.player, C.coral);
      this.drawPaddle(ctx, this.ai, C.teal);
      this.drawBall(ctx);
      this.drawScore(ctx);
      if (this.paused || (!this.ball.served && !this.ai.broken)) this.drawOverlay(ctx);
    }

    drawCourt(ctx) {
      ctx.fillStyle = this.fx.color(CANVAS_THEME.pong.bg, C.paper);
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      if (this.scoreFlash > 0) {
        ctx.save();
        ctx.globalAlpha = this.scoreFlash * 0.18;
        ctx.fillStyle = C.sun;
        ctx.fillRect(0, 0, STAGE_W, STAGE_H);
        ctx.restore();
      }
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4;
      roundRect(ctx, 46, this.courtTop(), STAGE_W - 92, this.courtBottom() - this.courtTop(), 8);
      ctx.stroke();

      if (this.juice("courtGrid")) {
        ctx.save();
        ctx.strokeStyle = this.fx.color(CANVAS_THEME.pong.grid, "rgba(36,50,59,0.12)");
        ctx.lineWidth = 2;
        for (let y = this.courtTop() + 32; y < this.courtBottom() - 24; y += 46) {
          ctx.beginPath();
          ctx.moveTo(STAGE_W / 2, y);
          ctx.lineTo(STAGE_W / 2, y + 24);
          ctx.stroke();
        }
        for (let x = 96; x < STAGE_W - 96; x += 96) {
          ctx.beginPath();
          ctx.moveTo(x, STAGE_H / 2 - 6);
          ctx.lineTo(x + 42, STAGE_H / 2 - 6);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    drawBands(ctx) {
      if (!this.potentialActive()) return;
      const activeCharge = Math.max(this.paddleCharge, this.snapWindow > 0 ? this.releasedCharge : 0);
      const anchorX = 48;
      const topAnchor = this.player.y - 66;
      const bottomAnchor = this.player.y + 66;
      const paddleX = this.player.x + this.player.w / 2;
      const pull = activeCharge * 62 + Math.sin(performance.now() / 70) * this.chargePulse * 5;
      ctx.save();
      ctx.globalAlpha = 0.32 + activeCharge * 0.58;
      ctx.strokeStyle = this.fx.color(C.sun);
      ctx.lineWidth = 2.5 + activeCharge * 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(anchorX, topAnchor);
      ctx.quadraticCurveTo(anchorX + pull, this.player.y - 28, paddleX, this.player.y);
      ctx.quadraticCurveTo(anchorX + pull, this.player.y + 28, anchorX, bottomAnchor);
      ctx.stroke();
      ctx.fillStyle = this.fx.color(C.sun);
      ctx.beginPath();
      ctx.arc(anchorX, topAnchor, 6 + activeCharge * 3, 0, Math.PI * 2);
      ctx.arc(anchorX, bottomAnchor, 6 + activeCharge * 3, 0, Math.PI * 2);
      ctx.fill();
      if (this.chargeHeld) {
        ctx.fillStyle = C.ink;
        ctx.font = "900 14px Avenir Next, Trebuchet MS, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("STRETCH", anchorX + 12, this.player.y - 78);
      }
      ctx.restore();

      const limit = this.tensionLimit();
      const filled = clamp(this.tension / limit, 0, 1);
      const heat = this.ballHeat();
      const heatFill = clamp(heat / this.breakHeatThreshold(), 0, 1);
      const chargeLabel = heatFill >= 1 ? "PADDLE BREAK READY" : `CHARGE ${this.tension}/${limit}`;
      ctx.save();
      ctx.translate(0, this.tensionPulse * rand(-1.2, 1.2));
      ctx.fillStyle = C.ink;
      drawFittedText(ctx, chargeLabel, STAGE_W / 2, 28, 320, 16, 13);
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      roundRect(ctx, STAGE_W / 2 - 132, 40, 264, 22, 8);
      ctx.fill();
      ctx.fillStyle = this.fx.color(this.heatColor(Math.max(heat, filled * this.breakHeatThreshold())));
      roundRect(ctx, STAGE_W / 2 - 132, 40, 264 * Math.max(filled, heatFill), 22, 8);
      ctx.fill();
      if (heatFill > 0.05) {
        ctx.globalAlpha = 0.34 + heatFill * 0.3;
        ctx.fillStyle = this.fx.color(C.danger);
        roundRect(ctx, STAGE_W / 2 - 132, 40, 264 * heatFill, 22, 8);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      roundRect(ctx, STAGE_W / 2 - 132, 40, 264, 22, 8);
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.font = "900 12px Avenir Next, Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`HEAT ${Math.round(heatFill * 100)}%`, STAGE_W / 2, 84);

      const chargeFill = clamp(activeCharge / 1.25, 0, 1);
      ctx.fillStyle = "rgba(255,255,255,0.48)";
      roundRect(ctx, 54, 32, 138, 18, 8);
      ctx.fill();
      ctx.fillStyle = this.fx.color(C.sun);
      roundRect(ctx, 54, 32, 138 * chargeFill, 18, 8);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      roundRect(ctx, 54, 32, 138, 18, 8);
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.font = "900 11px Avenir Next, Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SLING", 123, 65);
      ctx.restore();
    }

    drawPaddle(ctx, paddle, color) {
      if (paddle.broken) {
        this.drawBrokenPaddle(ctx, paddle);
        return;
      }
      const squash = this.juice("paddleSquash") ? paddle.squash : 0;
      ctx.save();
      ctx.translate(paddle.x + paddle.w / 2, paddle.y);
      ctx.rotate(paddle.lean * 0.035);
      ctx.scale(1 + squash * 0.22, 1 - squash * 0.08);
      roundRect(ctx, -paddle.w / 2, -paddle.h / 2, paddle.w, paddle.h, 8);
      ctx.fillStyle = this.fx.color(color);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      roundRect(ctx, -paddle.w / 2 + 5, -paddle.h / 2 + 10, 6, paddle.h - 20, 4);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4;
      roundRect(ctx, -paddle.w / 2, -paddle.h / 2, paddle.w, paddle.h, 8);
      ctx.stroke();
      ctx.restore();
    }

    drawBrokenPaddle(ctx, paddle) {
      ctx.save();
      for (const fragment of paddle.fragments) {
        ctx.save();
        ctx.translate(fragment.x, fragment.y);
        ctx.rotate(fragment.rot);
        roundRect(ctx, -fragment.w / 2, -fragment.h / 2, fragment.w, fragment.h, 5);
        ctx.fillStyle = this.fx.color(fragment.color, C.ink);
        ctx.fill();
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 3;
        roundRect(ctx, -fragment.w / 2, -fragment.h / 2, fragment.w, fragment.h, 5);
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 0.28 + Math.sin(performance.now() / 64) * 0.08;
      ctx.strokeStyle = this.fx.color(C.danger);
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);
      roundRect(ctx, paddle.x - 8, paddle.y - paddle.h / 2 - 8, paddle.w + 16, paddle.h + 16, 10);
      ctx.stroke();
      ctx.restore();
    }

    drawBall(ctx) {
      if (this.juice("ballTrail")) {
        ctx.save();
        const trailColor = this.heatColor();
        for (const point of this.ball.trail) {
          const t = point.age / 0.42;
          ctx.globalAlpha = (1 - t) * (0.34 + this.heatLevel() * 0.26);
          ctx.fillStyle = this.fx.color(trailColor);
          ctx.beginPath();
          ctx.arc(point.x, point.y, this.ball.r * (1 - t * 0.45 + this.heatLevel() * 0.16), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      const speed = Math.hypot(this.ball.vx, this.ball.vy);
      const angle = Math.atan2(this.ball.vy, this.ball.vx);
      const stretch = this.ball.served ? clamp(speed / 780, 0, 0.38) : 0;
      const squash = this.juice("paddleSquash") ? this.ball.squash : 0;
      const heat = this.ballHeat();
      const heatLevel = this.heatLevel();
      ctx.save();
      ctx.translate(this.ball.x, this.ball.y);
      ctx.rotate(angle);
      ctx.scale(1 + stretch + squash * 0.12, 1 - stretch * 0.32 + squash * 0.08);
      if (heatLevel > 0.04) {
        ctx.save();
        ctx.globalAlpha = 0.24 + heatLevel * 0.26;
        ctx.shadowColor = this.fx.color(C.danger);
        ctx.shadowBlur = 24 + heatLevel * 30;
        ctx.fillStyle = this.fx.color(this.heatColor(heat));
        ctx.beginPath();
        ctx.arc(0, 0, this.ball.r * (1.55 + heatLevel * 0.55), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = this.fx.color(this.heatColor(heat));
      ctx.beginPath();
      ctx.arc(0, 0, this.ball.r, 0, Math.PI * 2);
      ctx.fill();
      if (heatLevel > 0.18) {
        ctx.globalAlpha = 0.42 + heatLevel * 0.22;
        ctx.fillStyle = this.fx.color(C.sun);
        ctx.beginPath();
        ctx.arc(4, 3, this.ball.r * clamp(heatLevel, 0.2, 0.78), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = "rgba(255,255,255,0.42)";
      ctx.beginPath();
      ctx.arc(-5, -5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, this.ball.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawScore(ctx) {
      ctx.save();
      ctx.fillStyle = C.ink;
      ctx.font = "900 64px Avenir Next, Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 0.9;
      ctx.fillText(String(this.leftScore), STAGE_W / 2 - 100, this.courtTop() - 38);
      ctx.fillText(String(this.rightScore), STAGE_W / 2 + 100, this.courtTop() - 38);
      ctx.font = "900 20px Avenir Next, Trebuchet MS, sans-serif";
      ctx.fillText(String(this.rally), STAGE_W / 2, STAGE_H - 44);
      ctx.restore();
    }

    drawOverlay(ctx) {
      const label = this.paused ? "Paused" : "Serve";
      ctx.save();
      ctx.fillStyle = "rgba(241,251,239,0.38)";
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      ctx.fillStyle = C.ink;
      ctx.font = "900 62px Avenir Next, Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, STAGE_W / 2, STAGE_H / 2);
      ctx.restore();
    }

    serialize() {
      return {
        leftScore: this.leftScore,
        rightScore: this.rightScore,
        score: this.score,
        rally: this.rally,
        tension: this.tension,
        paddleCharge: this.paddleCharge,
        releasedCharge: this.releasedCharge,
        snapWindow: this.snapWindow,
        chargeHeld: false,
        breakPause: this.breakPause,
        paused: this.paused,
        player: this.player,
        ai: this.ai,
        ball: this.ball,
        serveDir: this.serveDir
      };
    }

    deserialize(state) {
      if (!state || typeof state !== "object") return;
      this.leftScore = Number(state.leftScore) || 0;
      this.rightScore = Number(state.rightScore) || 0;
      this.score = Number(state.score) || 0;
      this.rally = Number(state.rally) || 0;
      this.tension = Number(state.tension) || 0;
      this.paddleCharge = Number(state.paddleCharge) || 0;
      this.releasedCharge = Number(state.releasedCharge) || 0;
      this.snapWindow = Number(state.snapWindow) || 0;
      this.chargeHeld = false;
      this.breakPause = Number(state.breakPause) || 0;
      this.paused = Boolean(state.paused);
      this.player = { ...this.player, ...(state.player || {}) };
      this.ai = { ...this.ai, ...(state.ai || {}) };
      this.ai.fragments = Array.isArray(this.ai.fragments) ? this.ai.fragments.map((fragment) => ({
        x: Number(fragment.x) || 0,
        y: Number(fragment.y) || 0,
        w: Number(fragment.w) || 12,
        h: Number(fragment.h) || 24,
        vx: Number(fragment.vx) || 0,
        vy: Number(fragment.vy) || 0,
        rot: Number(fragment.rot) || 0,
        vr: Number(fragment.vr) || 0,
        color: typeof fragment.color === "string" ? fragment.color : C.teal
      })).slice(0, 12) : [];
      this.ball = { ...this.ball, ...(state.ball || {}) };
      this.ball.trail = Array.isArray(this.ball.trail) ? this.ball.trail.slice(0, 24) : [];
      if (this.ai.broken && this.breakPause <= 0) this.restoreAiPaddle();
      this.serveDir = state.serveDir === -1 ? -1 : 1;
    }
  }

  class JuicyBreakout {
    constructor(fx) {
      this.fx = fx;
      this.name = "breakout";
      this.best = this.loadBest();
      this.paused = false;
      this.reset();
    }

    juice(key, fallback = true) {
      return this.fx.gameSetting(this.name, key, fallback);
    }

    potential(key, fallback = true) {
      return this.fx.gameSetting(`${this.name}Potential`, key, fallback);
    }

    potentialActive() {
      return this.potential("potentiality") && (this.potential("paddleSling") || this.potential("coreBricks"));
    }

    cascadeLimit() {
      return Math.max(1, Math.round(this.potential("cascadeLimit", 5)));
    }

    arenaLeft() {
      return 52;
    }

    arenaRight() {
      return STAGE_W - 52;
    }

    arenaTop() {
      return 96;
    }

    arenaBottom() {
      return STAGE_H - 48;
    }

    loadBest() {
      try {
        return Number(window.localStorage.getItem("juicy-breakout-best") || 0);
      } catch {
        return 0;
      }
    }

    saveBest() {
      try {
        window.localStorage.setItem("juicy-breakout-best", String(this.best));
      } catch {
        // Local storage can be unavailable in private or locked-down browser modes.
      }
    }

    reset() {
      this.score = 0;
      this.level = 1;
      this.lives = 3;
      this.state = "ready";
      this.paused = false;
      this.cascade = 0;
      this.cascadeReady = false;
      this.cascadePulse = 0;
      this.chargeHeld = false;
      this.paddleCharge = 0;
      this.releasedCharge = 0;
      this.snapWindow = 0;
      this.paddle = { x: STAGE_W / 2, y: STAGE_H - 118, w: 184, h: 24, squash: 0, lean: 0 };
      this.ball = {
        x: this.paddle.x,
        y: this.paddle.y - 25,
        r: 14,
        vx: 0,
        vy: 0,
        speed: 470,
        served: false,
        heat: 0,
        breaker: 0,
        squash: 0,
        trail: []
      };
      this.bricks = [];
      this.buildBricks();
      this.best = Math.max(this.best, this.loadBest());
    }

    buildBricks() {
      const cols = 9;
      const rows = 6;
      const gap = 8;
      const left = 72;
      const top = this.arenaTop() + 46;
      const w = (STAGE_W - left * 2 - gap * (cols - 1)) / cols;
      const h = 38;
      const colors = [C.teal, C.blue, C.sun, C.coral, C.plum, C.teal];
      this.bricks = [];
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const core = (row + col + this.level) % 7 === 0 || (row === 0 && col % 4 === 1);
          this.bricks.push({
            x: left + col * (w + gap),
            y: top + row * (h + gap),
            w,
            h,
            hp: core ? 2 : 1,
            maxHp: core ? 2 : 1,
            core,
            broken: false,
            wobble: 0,
            pulse: core ? 0.4 : 0,
            color: colors[row % colors.length]
          });
        }
      }
    }

    getStats() {
      return {
        score: Math.floor(this.score),
        middleLabel: "Best",
        middle: this.best,
        lowerLabel: this.potentialActive() && this.potential("coreBricks") ? "Cascade" : "Lives",
        lower: this.potentialActive() && this.potential("coreBricks")
          ? `${this.cascade}/${this.cascadeLimit()}${this.cascadeReady ? " ready" : ""}`
          : this.lives
      };
    }

    handleInput(input) {
      if (input === "breakout-left" || input === "left") this.movePaddle(-1);
      if (input === "breakout-right" || input === "right") this.movePaddle(1);
      if (input === "breakout-charge" || input === "breakout-charge-start" || input === "charge-start" || input === "serve") this.startCharge();
      if (input === "breakout-charge-end" || input === "charge-end") this.releaseCharge();
    }

    ensureRunning() {
      if (this.state === "dead") this.reset();
      if (this.state === "ready") this.state = "running";
    }

    movePaddle(direction) {
      this.setPaddleX(this.paddle.x + direction * 74);
      this.fx.sound("move", 0.6);
    }

    setPaddleX(x) {
      const next = clamp(x, 66 + this.paddle.w / 2, STAGE_W - 66 - this.paddle.w / 2);
      const diff = next - this.paddle.x;
      this.paddle.x = next;
      this.paddle.lean = clamp(diff / 95, -1, 1);
      if (Math.abs(diff) > 2 && this.juice("paddleSquash")) this.paddle.squash = Math.max(this.paddle.squash, 0.32);
      if (!this.ball.served) {
        this.ball.x = this.paddle.x;
        this.ball.y = this.paddle.y - 25;
      }
    }

    startCharge() {
      this.ensureRunning();
      if (!this.potentialActive() || !this.potential("paddleSling")) {
        if (!this.ball.served) this.launchBall(0.2);
        return;
      }
      this.chargeHeld = true;
      this.snapWindow = 0;
      this.paddleCharge = Math.max(this.paddleCharge, 0.08);
    }

    releaseCharge() {
      if (!this.potentialActive() || !this.potential("paddleSling")) return;
      if (!this.chargeHeld) return;
      this.chargeHeld = false;
      if (!this.ball.served) {
        this.launchBall(clamp(this.paddleCharge, 0.18, 1.25));
      } else if (this.paddleCharge > 0.12) {
        this.releasedCharge = this.paddleCharge;
        this.snapWindow = 0.28;
      }
      this.paddleCharge = 0;
    }

    launchBall(charge = 0) {
      this.ensureRunning();
      if (this.ball.served) return;
      const angle = rand(-0.34, 0.34);
      const speed = 470 + charge * 240;
      this.ball.served = true;
      this.ball.speed = speed;
      this.ball.vx = Math.sin(angle) * speed;
      this.ball.vy = -Math.cos(angle) * speed;
      this.ball.heat = Math.max(this.ball.heat, charge * 0.55);
      this.ball.squash = 1;
      this.fx.ring(this.ball.x, this.ball.y, C.sun, 30 + charge * 22, 0.26);
      this.fx.sound("drop", 0.7 + charge * 0.25);
    }

    updateCharge(realDt) {
      this.cascadePulse *= Math.pow(0.025, realDt);
      this.paddle.squash *= Math.pow(0.01, realDt);
      this.paddle.lean *= Math.pow(0.02, realDt);
      this.ball.squash *= Math.pow(0.01, realDt);
      this.ball.heat *= Math.pow(0.93, realDt);
      this.ball.breaker = Math.max(0, this.ball.breaker - realDt);
      this.snapWindow = Math.max(0, this.snapWindow - realDt);
      if (this.chargeHeld && this.potentialActive() && this.potential("paddleSling")) {
        this.paddleCharge = clamp(this.paddleCharge + realDt * 0.9, 0, 1.25);
      } else if (this.snapWindow <= 0) {
        this.releasedCharge *= Math.pow(0.08, realDt);
      }
      for (const brick of this.bricks) {
        brick.wobble *= Math.pow(0.015, realDt);
        brick.pulse = Math.max(0, brick.pulse - realDt);
      }
    }

    update(dt, realDt) {
      if (this.paused) return;
      this.updateCharge(realDt);
      this.addTrail(realDt);
      if (!this.ball.served) {
        this.ball.x = this.paddle.x;
        this.ball.y = this.paddle.y - 25 + Math.sin(performance.now() / 260) * 4;
        return;
      }

      const speed = Math.hypot(this.ball.vx, this.ball.vy);
      const steps = Math.max(1, Math.ceil((speed * dt) / 18));
      const stepDt = dt / steps;
      for (let i = 0; i < steps; i += 1) {
        this.ball.x += this.ball.vx * stepDt;
        this.ball.y += this.ball.vy * stepDt;
        this.checkWallBounce();
        this.checkPaddleHit();
        this.checkBrickHit();
        if (!this.ball.served) break;
      }
      this.checkDrain();
    }

    addTrail(dt) {
      if (!this.juice("ballTrail")) {
        this.ball.trail.length = 0;
        return;
      }
      if (this.ball.trail.length === 0 || Math.hypot(this.ball.x - this.ball.trail[this.ball.trail.length - 1].x, this.ball.y - this.ball.trail[this.ball.trail.length - 1].y) > 18) {
        this.ball.trail.push({ x: this.ball.x, y: this.ball.y, age: 0, heat: this.ball.heat, breaker: this.ball.breaker });
      }
      for (let i = this.ball.trail.length - 1; i >= 0; i -= 1) {
        this.ball.trail[i].age += dt;
        if (this.ball.trail[i].age > 0.42) this.ball.trail.splice(i, 1);
      }
    }

    checkWallBounce() {
      const left = this.arenaLeft();
      const right = this.arenaRight();
      const top = this.arenaTop();
      if (this.ball.x - this.ball.r < left) {
        this.ball.x = left + this.ball.r;
        this.ball.vx = Math.abs(this.ball.vx);
        this.wallHit(left, this.ball.y);
      }
      if (this.ball.x + this.ball.r > right) {
        this.ball.x = right - this.ball.r;
        this.ball.vx = -Math.abs(this.ball.vx);
        this.wallHit(right, this.ball.y);
      }
      if (this.ball.y - this.ball.r < top) {
        this.ball.y = top + this.ball.r;
        this.ball.vy = Math.abs(this.ball.vy);
        this.wallHit(this.ball.x, top);
      }
    }

    wallHit(x, y) {
      if (this.juice("impactSparks")) {
        this.fx.ring(x, y, C.line, 20, 0.18);
        this.fx.shake(0, -1.5);
      }
      this.fx.sound("move", 0.5);
    }

    checkPaddleHit() {
      const ball = this.ball;
      const p = this.paddle;
      const withinX = ball.x + ball.r > p.x - p.w / 2 && ball.x - ball.r < p.x + p.w / 2;
      const withinY = ball.y + ball.r > p.y - p.h / 2 && ball.y - ball.r < p.y + p.h / 2;
      if (!withinX || !withinY || ball.vy <= 0) return;

      const offset = clamp((ball.x - p.x) / (p.w / 2), -1, 1);
      const activeCharge = this.chargeHeld ? this.paddleCharge : (this.snapWindow > 0 ? this.releasedCharge : 0);
      const speed = Math.min(1180, Math.hypot(ball.vx, ball.vy) * 1.035 + 18 + activeCharge * 180);
      ball.x = clamp(ball.x, p.x - p.w / 2, p.x + p.w / 2);
      ball.y = p.y - p.h / 2 - ball.r;
      ball.vx = Math.sin(offset * 0.92) * speed;
      ball.vy = -Math.cos(offset * 0.92) * speed;
      ball.speed = speed;
      ball.squash = this.juice("paddleSquash") ? 1 + activeCharge * 0.45 : 0;
      ball.heat = Math.max(ball.heat, activeCharge * 0.9);
      p.squash = this.juice("paddleSquash") ? 1 + activeCharge * 0.35 : 0;
      p.lean = offset * 0.9;
      if (this.cascadeReady && activeCharge > 0.08 && this.potential("breakerBall")) this.releaseBreaker(activeCharge);
      if (activeCharge > 0.12) {
        this.fx.popText("loaded", ball.x, ball.y - 30, C.sun, 28);
        this.fx.ring(ball.x, ball.y, C.sun, 34 + activeCharge * 32, 0.26);
      }
      this.releasedCharge = 0;
      this.paddleCharge = 0;
      this.snapWindow = 0;
      this.chargeHeld = false;
      this.fx.sound("pass", 0.75 + activeCharge * 0.3);
    }

    releaseBreaker(load = 1) {
      this.cascadeReady = false;
      this.cascade = 0;
      this.cascadePulse = 1.4;
      this.ball.breaker = 2.6 + load * 0.4;
      this.ball.heat = Math.max(this.ball.heat, 1.7 + load * 0.8);
      this.ball.vx *= 1.18 + load * 0.12;
      this.ball.vy *= 1.18 + load * 0.12;
      this.fx.popText("breaker", this.ball.x, this.ball.y - 42, C.coral, 40);
      this.fx.burst(this.ball.x, this.ball.y, 52, {
        colors: [C.sun, C.coral, C.teal, C.white],
        speed: 310 + load * 90,
        size: 7,
        gravity: 130
      });
      this.fx.screenFlash(C.sun, 0.16, 0.28);
      this.fx.shake(0, 7);
      this.fx.hitStop(0.08);
      this.fx.sound("clear", 1.05);
    }

    checkBrickHit() {
      let breakerHits = 0;
      for (const brick of this.bricks) {
        if (brick.broken) continue;
        const hit = this.circleRectHit(this.ball, brick);
        if (!hit) continue;
        const breaker = this.ball.breaker > 0;
        const wall = this.bricks;
        this.damageBrick(brick, breaker ? 3 : 1, breaker);
        if (!breaker) {
          if (hit.axis === "x") this.ball.vx *= -1;
          else this.ball.vy *= -1;
          this.ball.squash = 1;
          return;
        }
        if (this.bricks !== wall) return;
        breakerHits += 1;
        this.ball.squash = Math.max(this.ball.squash, 1.12);
        this.breakerTunnel(brick);
        if (breakerHits >= 2) return;
      }
    }

    breakerTunnel(originBrick) {
      if (this.ball.breaker <= 0) return;
      const speed = Math.hypot(this.ball.vx, this.ball.vy);
      if (speed <= 0.001) return;
      const dirX = this.ball.vx / speed;
      const dirY = this.ball.vy / speed;
      const originX = originBrick.x + originBrick.w / 2;
      const originY = originBrick.y + originBrick.h / 2;
      const reach = 128 + this.ball.breaker * 24 + this.ball.heat * 18;
      let pierced = 0;

      const candidates = this.bricks
        .filter((brick) => !brick.broken && brick !== originBrick)
        .map((brick) => {
          const centerX = brick.x + brick.w / 2;
          const centerY = brick.y + brick.h / 2;
          const relX = centerX - originX;
          const relY = centerY - originY;
          const forward = relX * dirX + relY * dirY;
          const lateral = Math.abs(relX * dirY - relY * dirX);
          return { brick, forward, lateral };
        })
        .filter(({ brick, forward, lateral }) => forward > 6 && forward <= reach && lateral <= brick.h / 2 + this.ball.r + 10)
        .sort((a, b) => a.forward - b.forward);

      for (const { brick } of candidates) {
        const wall = this.bricks;
        this.damageBrick(brick, 3, true);
        pierced += 1;
        if (this.bricks !== wall) break;
        if (pierced >= 3) break;
      }

      if (pierced > 0) {
        this.fx.popText(`pierce x${pierced + 1}`, originX, originY - 34, C.coral, 24);
        this.fx.ring(originX, originY, C.coral, 30 + pierced * 18, 0.2);
      }
    }

    circleRectHit(ball, rect) {
      const cx = clamp(ball.x, rect.x, rect.x + rect.w);
      const cy = clamp(ball.y, rect.y, rect.y + rect.h);
      const dx = ball.x - cx;
      const dy = ball.y - cy;
      if (dx * dx + dy * dy > ball.r * ball.r) return null;
      const sideX = Math.min(Math.abs(ball.x - rect.x), Math.abs(ball.x - (rect.x + rect.w)));
      const sideY = Math.min(Math.abs(ball.y - rect.y), Math.abs(ball.y - (rect.y + rect.h)));
      return { axis: sideX < sideY ? "x" : "y" };
    }

    damageBrick(brick, amount = 1, breaker = false) {
      brick.hp -= amount;
      brick.wobble = 1;
      brick.pulse = 0.35;
      if (brick.hp > 0) {
        this.fx.ring(brick.x + brick.w / 2, brick.y + brick.h / 2, C.sun, 24, 0.18);
        this.fx.sound("move", 0.55);
        return;
      }

      this.breakBrick(brick, breaker);
      if (breaker && this.potential("adjacentBurst")) {
        for (const other of this.bricks) {
          if (other.broken || other === brick) continue;
          const dx = other.x + other.w / 2 - (brick.x + brick.w / 2);
          const dy = other.y + other.h / 2 - (brick.y + brick.h / 2);
          if (Math.hypot(dx, dy) < 95) this.breakBrick(other, true, true);
        }
      }
      if (this.bricks.every((b) => b.broken)) this.nextLevel();
    }

    breakBrick(brick, breaker = false, chain = false) {
      if (brick.broken) return;
      brick.broken = true;
      const x = brick.x + brick.w / 2;
      const y = brick.y + brick.h / 2;
      const core = this.potentialActive() && this.potential("coreBricks") && brick.core;
      const points = core ? 48 : 22;
      this.score += points + (breaker ? 16 : 0) + (chain ? 10 : 0);
      this.best = Math.max(this.best, Math.floor(this.score));
      this.saveBest();
      if (core) this.addCascade(x, y);
      if (this.juice("scorePulse")) this.fx.popText(`+${points}`, x, y - 22, core ? C.sun : C.teal, 25);
      if (this.juice("brickShards")) {
        this.fx.burst(x, y, core ? 24 : 14, {
          colors: core ? [C.sun, C.coral, C.white] : [brick.color, C.white, C.teal],
          speed: breaker ? 300 : 190,
          size: 6,
          gravity: 150
        });
      }
      if (this.juice("impactSparks")) {
        this.fx.ring(x, y, core ? C.sun : brick.color, core ? 42 : 28, 0.25);
        this.fx.hitStop(core ? 0.04 : 0.02);
      }
      this.fx.sound(core ? "clear" : "pass", core ? 0.9 : 0.65);
    }

    addCascade(x, y) {
      if (!this.potentialActive() || !this.potential("coreBricks")) return;
      this.cascade = Math.min(this.cascadeLimit(), this.cascade + 1);
      this.cascadePulse = 1;
      if (this.cascade >= this.cascadeLimit()) {
        this.cascadeReady = true;
        this.fx.popText("cascade ready", x, y - 34, C.sun, 30);
        this.fx.screenFlash(C.sun, 0.1, 0.24);
      } else {
        this.fx.popText("+core", x, y - 28, C.sun, 24);
      }
    }

    nextLevel() {
      this.level += 1;
      this.ball.served = false;
      this.ball.breaker = 0;
      this.ball.heat = 0;
      this.buildBricks();
      this.fx.popText("wall reset", STAGE_W / 2, this.arenaTop() + 38, C.teal, 38);
      this.fx.screenFlash(C.teal, 0.1, 0.24);
    }

    checkDrain() {
      if (this.ball.y < STAGE_H + 60) return;
      this.lives -= 1;
      this.fx.screenFlash(C.danger, 0.18, 0.26);
      this.fx.shake(0, 8);
      if (this.lives <= 0) {
        this.state = "dead";
        this.ball.served = false;
        this.lives = 0;
        return;
      }
      this.ball.served = false;
      this.ball.breaker = 0;
      this.ball.heat = 0;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.trail.length = 0;
      this.setPaddleX(this.paddle.x);
    }

    draw(ctx) {
      ctx.clearRect(0, 0, STAGE_W, STAGE_H);
      this.drawBackdrop(ctx);
      this.drawBricks(ctx);
      this.drawPaddle(ctx);
      this.drawBall(ctx);
      this.drawMeters(ctx);
      if (this.paused || this.state === "ready" || this.state === "dead") this.drawOverlay(ctx);
    }

    drawBackdrop(ctx) {
      ctx.fillStyle = this.fx.color(CANVAS_THEME.breakout.bg, C.paper);
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      ctx.fillStyle = this.fx.color(CANVAS_THEME.breakout.arena, "#f2f7ef");
      roundRect(ctx, this.arenaLeft() - 4, this.arenaTop(), STAGE_W - 96, this.arenaBottom() - this.arenaTop(), 8);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4;
      roundRect(ctx, this.arenaLeft() - 4, this.arenaTop(), STAGE_W - 96, this.arenaBottom() - this.arenaTop(), 8);
      ctx.stroke();
      if (this.juice("wallGrid")) {
        ctx.save();
        ctx.strokeStyle = this.fx.color(CANVAS_THEME.breakout.grid, "rgba(36,50,59,0.1)");
        ctx.lineWidth = 2;
        for (let x = 90; x < STAGE_W - 90; x += 78) {
          ctx.beginPath();
          ctx.moveTo(x, this.arenaTop() + 24);
          ctx.lineTo(x + 28, this.arenaTop() + 24);
          ctx.stroke();
        }
        for (let y = this.arenaTop() + 30; y < this.arenaBottom() - 40; y += 58) {
          ctx.beginPath();
          ctx.moveTo(this.arenaLeft() + 4, y);
          ctx.lineTo(this.arenaLeft() + 26, y + 22);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    drawBricks(ctx) {
      for (const brick of this.bricks) {
        if (brick.broken) continue;
        const wobble = this.juice("brickWobble") ? brick.wobble : 0;
        ctx.save();
        ctx.translate(brick.x + brick.w / 2 + Math.sin(performance.now() / 50) * wobble * 2.5, brick.y + brick.h / 2);
        ctx.scale(1 + brick.pulse * 0.05, 1 - brick.pulse * 0.03);
        roundRect(ctx, -brick.w / 2, -brick.h / 2, brick.w, brick.h, 7);
        ctx.fillStyle = this.fx.color(brick.color);
        ctx.fill();
        if (brick.hp < brick.maxHp) {
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          roundRect(ctx, -brick.w / 2 + 6, -brick.h / 2 + 6, brick.w - 12, 6, 3);
          ctx.fill();
        }
        if (this.potentialActive() && this.potential("coreBricks") && brick.core) {
          ctx.fillStyle = this.fx.color(C.sun);
          ctx.beginPath();
          ctx.arc(0, 0, 7 + Math.sin(performance.now() / 150 + brick.x) * 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 3;
        roundRect(ctx, -brick.w / 2, -brick.h / 2, brick.w, brick.h, 7);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawPaddle(ctx) {
      const charge = Math.max(this.paddleCharge, this.snapWindow > 0 ? this.releasedCharge : 0);
      if (this.potentialActive() && this.potential("paddleSling")) {
        ctx.save();
        ctx.globalAlpha = 0.25 + charge * 0.58;
        ctx.strokeStyle = this.fx.color(C.sun);
        ctx.lineWidth = 2 + charge * 5;
        ctx.lineCap = "round";
        const left = this.paddle.x - this.paddle.w / 2;
        const right = this.paddle.x + this.paddle.w / 2;
        ctx.beginPath();
        ctx.moveTo(left, this.paddle.y + 8);
        ctx.quadraticCurveTo(this.paddle.x, this.paddle.y + 18 + charge * 34, right, this.paddle.y + 8);
        ctx.stroke();
        ctx.restore();
      }

      const squash = this.juice("paddleSquash") ? this.paddle.squash : 0;
      ctx.save();
      ctx.translate(this.paddle.x, this.paddle.y);
      ctx.rotate(this.paddle.lean * 0.04);
      ctx.scale(1 + squash * 0.14, 1 - squash * 0.08);
      roundRect(ctx, -this.paddle.w / 2, -this.paddle.h / 2, this.paddle.w, this.paddle.h, 9);
      ctx.fillStyle = this.fx.color(C.coral);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.26)";
      roundRect(ctx, -this.paddle.w / 2 + 10, -this.paddle.h / 2 + 5, this.paddle.w - 20, 5, 3);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4;
      roundRect(ctx, -this.paddle.w / 2, -this.paddle.h / 2, this.paddle.w, this.paddle.h, 9);
      ctx.stroke();
      ctx.restore();
    }

    drawBall(ctx) {
      if (this.juice("ballTrail")) {
        ctx.save();
        for (const point of this.ball.trail) {
          const t = point.age / 0.42;
          ctx.globalAlpha = (1 - t) * (point.breaker > 0 ? 0.58 : 0.32);
          ctx.fillStyle = this.fx.color(point.breaker > 0 ? C.coral : point.heat > 0.4 ? C.sun : C.blue);
          ctx.beginPath();
          ctx.arc(point.x, point.y, this.ball.r * (1 - t * 0.4), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      const speed = Math.hypot(this.ball.vx, this.ball.vy);
      const stretch = this.ball.served ? clamp(speed / 980, 0, 0.32) : 0;
      const squash = this.juice("paddleSquash") ? this.ball.squash : 0;
      ctx.save();
      ctx.translate(this.ball.x, this.ball.y);
      ctx.rotate(Math.atan2(this.ball.vy, this.ball.vx));
      ctx.scale(1 + stretch + squash * 0.1, 1 - stretch * 0.28 + squash * 0.08);
      if (this.ball.breaker > 0) {
        ctx.globalAlpha = 0.34 + Math.sin(performance.now() / 60) * 0.08;
        ctx.fillStyle = this.fx.color(C.coral);
        ctx.beginPath();
        ctx.arc(0, 0, this.ball.r * 2.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = this.fx.color(this.ball.breaker > 0 ? C.coral : this.ball.heat > 0.45 ? C.sun : C.blue);
      ctx.beginPath();
      ctx.arc(0, 0, this.ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.arc(-4, -5, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, this.ball.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawMeters(ctx) {
      if (!this.potentialActive() || !this.potential("coreBricks")) return;
      const filled = this.cascadeReady ? 1 : this.cascade / this.cascadeLimit();
      ctx.save();
      ctx.translate(0, this.cascadePulse * rand(-1.2, 1.2));
      ctx.fillStyle = "rgba(255,255,255,0.54)";
      roundRect(ctx, 58, 34, 198, 22, 8);
      ctx.fill();
      ctx.fillStyle = this.fx.color(this.cascadeReady ? C.coral : C.sun);
      roundRect(ctx, 58, 34, 198 * filled, 22, 8);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      roundRect(ctx, 58, 34, 198, 22, 8);
      ctx.stroke();
      ctx.fillStyle = C.ink;
      drawFittedText(ctx, this.cascadeReady ? "BREAKER READY" : "CASCADE", 60, 82, 210, 13, 11, "left");
      ctx.restore();
    }

    drawOverlay(ctx) {
      const label = this.paused ? "Paused" : this.state === "dead" ? "Game Over" : "Ready";
      ctx.save();
      ctx.fillStyle = "rgba(241,251,239,0.42)";
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      ctx.fillStyle = C.ink;
      ctx.font = "900 62px Avenir Next, Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, STAGE_W / 2, STAGE_H / 2);
      ctx.restore();
    }

    serialize() {
      return {
        score: this.score,
        best: this.best,
        level: this.level,
        lives: this.lives,
        state: this.state,
        paused: this.paused,
        cascade: this.cascade,
        cascadeReady: this.cascadeReady,
        cascadePulse: this.cascadePulse,
        paddleCharge: this.paddleCharge,
        releasedCharge: this.releasedCharge,
        snapWindow: this.snapWindow,
        chargeHeld: false,
        paddle: this.paddle,
        ball: this.ball,
        bricks: this.bricks
      };
    }

    deserialize(state) {
      if (!state || typeof state !== "object") return;
      this.score = Number(state.score) || 0;
      this.best = Math.max(Number(state.best) || 0, this.loadBest());
      this.level = Number(state.level) || 1;
      this.lives = Number(state.lives) || 3;
      this.state = ["ready", "running", "dead"].includes(state.state) ? state.state : "ready";
      this.paused = Boolean(state.paused);
      this.cascade = Number(state.cascade) || 0;
      this.cascadeReady = Boolean(state.cascadeReady);
      this.cascadePulse = Number(state.cascadePulse) || 0;
      this.paddleCharge = Number(state.paddleCharge) || 0;
      this.releasedCharge = Number(state.releasedCharge) || 0;
      this.snapWindow = Number(state.snapWindow) || 0;
      this.chargeHeld = false;
      this.paddle = { ...this.paddle, ...(state.paddle || {}) };
      this.ball = { ...this.ball, ...(state.ball || {}) };
      this.ball.trail = Array.isArray(this.ball.trail) ? this.ball.trail.slice(0, 30) : [];
      this.bricks = Array.isArray(state.bricks) && state.bricks.length > 0 ? state.bricks.map((brick) => ({
        x: Number(brick.x) || 0,
        y: Number(brick.y) || 0,
        w: Number(brick.w) || 60,
        h: Number(brick.h) || 32,
        hp: Number(brick.hp) || 1,
        maxHp: Number(brick.maxHp) || 1,
        core: Boolean(brick.core),
        broken: Boolean(brick.broken),
        wobble: Number(brick.wobble) || 0,
        pulse: Number(brick.pulse) || 0,
        color: typeof brick.color === "string" ? brick.color : C.teal
      })) : this.bricks;
      if (!this.ball.served) this.setPaddleX(this.paddle.x);
      this.saveBest();
    }
  }

  class JuicyDino {
    constructor(fx) {
      this.fx = fx;
      this.name = "dino";
      this.paused = false;
      this.best = this.loadBest();
      this.reset();
    }

    juice(key, fallback = true) {
      return this.fx.gameSetting(this.name, key, fallback);
    }

    potential(key, fallback = true) {
      return this.fx.gameSetting(`${this.name}Potential`, key, fallback);
    }

    potentialActive() {
      return this.potential("potentiality");
    }

    fossilsForQuake() {
      return Math.max(1, Math.round(this.potential("fossilsForQuake", 3)));
    }

    loadBest() {
      try {
        return Number(window.localStorage.getItem("juicy-dino-best") || 0);
      } catch {
        return 0;
      }
    }

    saveBest() {
      try {
        window.localStorage.setItem("juicy-dino-best", String(this.best));
      } catch {
        // Local storage can be unavailable in strict browser modes.
      }
    }

    reset() {
      this.score = 0;
      this.speed = 330;
      this.state = "ready";
      this.paused = false;
      this.spawnTimer = 0.7;
      this.groundScroll = 0;
      this.cloudScroll = 0;
      this.obstacles = [];
      this.quakeCharge = 0;
      this.quakeReady = false;
      this.quakePulse = 0;
      this.groundPulse = 0;
      this.dino = {
        x: 150,
        y: 670,
        w: 66,
        h: 86,
        vy: 0,
        onGround: true,
        ducking: false,
        charging: false,
        jumpCharge: 0,
        chargedJump: 0,
        stomp: false,
        squash: 0,
        leg: 0,
        trail: []
      };
      this.snapDinoToGround();
    }

    groundY() {
      return 756;
    }

    currentDinoHeight() {
      return this.dino.ducking && this.dino.onGround ? 56 : 86;
    }

    snapDinoToGround() {
      this.dino.h = this.currentDinoHeight();
      this.dino.y = this.groundY() - this.dino.h;
      this.dino.onGround = true;
      this.dino.vy = 0;
    }

    getStats() {
      return {
        score: Math.floor(this.score),
        middleLabel: "Best",
        middle: this.best,
        lowerLabel: this.potentialActive() && this.potential("fossilCores") ? "Quake" : "Speed",
        lower: this.potentialActive() && this.potential("fossilCores")
          ? `${this.quakeCharge}/${this.fossilsForQuake()}${this.quakeReady ? " ready" : ""}`
          : Math.round(this.speed)
      };
    }

    handleInput(input) {
      if (input === "dino-jump" || input === "dino-jump-start") this.beginJumpLoad();
      if (input === "dino-jump-end") this.releaseJump();
      if (input === "dino-duck" || input === "dino-duck-start") this.startDuck();
      if (input === "dino-duck-end") this.endDuck();
    }

    ensureRunning() {
      if (this.state === "dead") this.reset();
      if (this.state === "ready") this.state = "running";
    }

    beginJumpLoad() {
      this.ensureRunning();
      if (!this.dino.onGround) return;
      this.dino.ducking = false;
      if (!this.potentialActive() || !this.potential("springLoad")) {
        this.jump(0.35);
        return;
      }
      this.dino.charging = true;
      this.dino.jumpCharge = Math.max(this.dino.jumpCharge, 0.12);
      this.dino.squash = Math.max(this.dino.squash, 0.25);
    }

    releaseJump() {
      if (this.state !== "running") return;
      if (!this.dino.onGround) return;
      const charge = this.potentialActive() && this.potential("springLoad")
        ? clamp(this.dino.jumpCharge, 0.18, 1.25)
        : 0.35;
      this.dino.charging = false;
      this.dino.jumpCharge = 0;
      this.jump(charge);
    }

    jump(charge) {
      this.dino.onGround = false;
      this.dino.ducking = false;
      this.dino.chargedJump = charge;
      this.dino.vy = -690 - charge * 235;
      this.dino.squash = this.juice("dinoSquash") ? 1 : 0;
      if (this.juice("jumpBurst")) {
        this.fx.burst(this.dino.x + 22, this.groundY() - 8, 16 + charge * 10, {
          colors: [C.sun, C.coral, C.white],
          angle: -Math.PI / 2,
          spread: Math.PI * 0.85,
          speed: 180 + charge * 80,
          size: 6,
          gravity: 210
        });
        this.fx.ring(this.dino.x + 28, this.groundY() - 10, C.sun, 28 + charge * 24, 0.28);
      }
      this.fx.sound("flap", 0.8 + charge * 0.28);
    }

    startDuck() {
      this.ensureRunning();
      if (!this.dino.onGround && this.potentialActive() && this.potential("stompCrack")) {
        this.dino.stomp = true;
        this.dino.vy = Math.max(this.dino.vy, 760);
        this.dino.squash = 0.85;
        this.fx.sound("drop", 0.55);
        return;
      }
      this.dino.ducking = true;
      if (this.dino.onGround) this.snapDinoToGround();
    }

    endDuck() {
      this.dino.ducking = false;
      if (this.dino.onGround) this.snapDinoToGround();
    }

    tunedCactusHeight(height) {
      if (height <= 108) return height;
      return Math.min(110, height * 0.9);
    }

    spawnObstacle() {
      const typeRoll = Math.random();
      const type = typeRoll < 0.72 ? "cactus" : "bird";
      const fossil = this.potentialActive() && this.potential("fossilCores") && Math.random() < (type === "cactus" ? 0.72 : 0.42);
      if (type === "bird") {
        const y = choose([this.groundY() - 170, this.groundY() - 124]);
        this.obstacles.push({
          type,
          x: STAGE_W + 80,
          y,
          w: 82,
          h: 44,
          fossil,
          cracked: false,
          passed: false,
          broken: false,
          wobble: 0,
          fragments: []
        });
        return;
      }

      const h = this.tunedCactusHeight(rand(72, 122));
      const w = rand(42, 78);
      this.obstacles.push({
        type,
        x: STAGE_W + 80,
        y: this.groundY() - h,
        w,
        h,
        fossil,
        cracked: false,
        passed: false,
        broken: false,
        wobble: 0,
        fragments: []
      });
    }

    update(dt, realDt) {
      if (this.paused) return;
      if (this.state === "ready") {
        this.dino.leg += realDt * 8;
        return;
      }
      if (this.state === "dead") return;

      this.score += realDt * (10 + this.speed / 32);
      this.best = Math.max(this.best, Math.floor(this.score));
      this.saveBest();
      this.speed = Math.min(590, 330 + this.score * 0.16);
      this.groundScroll += this.speed * realDt;
      if (this.juice("parallax")) this.cloudScroll += 25 * realDt;
      this.quakePulse *= Math.pow(0.025, realDt);
      this.groundPulse *= Math.pow(0.02, realDt);

      if (this.dino.charging && this.dino.onGround) {
        this.dino.jumpCharge = clamp(this.dino.jumpCharge + realDt * 0.9, 0, 1.25);
        this.dino.squash = Math.max(this.dino.squash, 0.25 + this.dino.jumpCharge * 0.55);
      }

      this.updateDino(dt, realDt);
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnObstacle();
        this.spawnTimer = rand(0.9, 1.45) * clamp(390 / this.speed, 0.62, 1.1);
      }

      for (const obstacle of this.obstacles) {
        obstacle.x -= this.speed * dt;
        obstacle.wobble *= this.juice("obstacleWobble") ? Math.pow(0.01, realDt) : 0;
        if (obstacle.broken) this.updateFragments(obstacle, dt);
        if (!obstacle.passed && obstacle.x + obstacle.w < this.dino.x) {
          obstacle.passed = true;
          this.score += 18;
          if (this.juice("scorePulse")) this.fx.popText("+18", this.dino.x + 24, this.dino.y - 36, C.teal, 25);
          this.tryCrackFossil(obstacle, "clear");
        }
      }

      this.obstacles = this.obstacles.filter((obstacle) => obstacle.x + obstacle.w > -180 || obstacle.fragments?.some((fragment) => fragment.y < this.groundY() - 6));
      const hit = this.getCollision();
      if (hit) {
        if (this.quakeReady && this.potentialActive() && this.potential("quakeRelease")) {
          this.releaseQuake(hit);
        } else {
          this.crash(hit);
        }
      }
    }

    updateDino(dt, realDt) {
      const wasGrounded = this.dino.onGround;
      this.dino.h = this.currentDinoHeight();
      if (this.dino.onGround) {
        this.dino.leg += realDt * (10 + this.speed / 55);
        this.dino.y = this.groundY() - this.dino.h;
      } else {
        this.dino.vy += 1920 * dt;
        this.dino.y += this.dino.vy * dt;
        if (this.dino.y + this.dino.h >= this.groundY()) {
          this.dino.y = this.groundY() - this.dino.h;
          this.dino.vy = 0;
          this.dino.onGround = true;
          this.dino.squash = this.juice("dinoSquash") ? 0.9 : 0;
          if (this.juice("landDust")) {
            this.fx.burst(this.dino.x + 34, this.groundY() - 4, this.dino.stomp ? 28 : 12, {
              colors: [C.sun, C.paper2, C.line],
              angle: -Math.PI / 2,
              spread: Math.PI * 0.9,
              speed: this.dino.stomp ? 260 : 140,
              size: 6,
              gravity: 240
            });
            this.fx.ring(this.dino.x + 34, this.groundY() - 6, C.sun, this.dino.stomp ? 54 : 30, 0.28);
          }
          if (!wasGrounded && this.dino.stomp) {
            this.groundPulse = 1;
            this.fx.shake(0, 5);
            this.crackNearbyFossils();
          }
          this.dino.stomp = false;
          this.dino.chargedJump *= 0.35;
        }
      }

      this.dino.squash *= Math.pow(0.018, realDt);
      this.addTrail(realDt);
    }

    addTrail(dt) {
      if (!this.juice("dinoTrail")) {
        this.dino.trail.length = 0;
        return;
      }
      if (this.dino.trail.length === 0 || Math.hypot(this.dino.x - this.dino.trail[this.dino.trail.length - 1].x, this.dino.y - this.dino.trail[this.dino.trail.length - 1].y) > 15) {
        this.dino.trail.push({ x: this.dino.x, y: this.dino.y, h: this.dino.h, age: 0 });
      }
      for (let i = this.dino.trail.length - 1; i >= 0; i -= 1) {
        this.dino.trail[i].age += dt;
        if (this.dino.trail[i].age > 0.38) this.dino.trail.splice(i, 1);
      }
    }

    crackNearbyFossils() {
      for (const obstacle of this.obstacles) {
        if (Math.abs((obstacle.x + obstacle.w / 2) - (this.dino.x + this.dino.w / 2)) < 170) {
          this.tryCrackFossil(obstacle, "stomp");
        }
      }
    }

    tryCrackFossil(obstacle, source) {
      if (!this.potentialActive() || !this.potential("fossilCores") || !obstacle.fossil || obstacle.cracked || obstacle.broken) return false;
      const lowClear = this.dino.y + this.dino.h > obstacle.y - 115;
      const charged = this.dino.chargedJump > 0.28;
      const stomped = source === "stomp";
      if (!charged && !lowClear && !stomped) return false;

      obstacle.cracked = true;
      obstacle.wobble = 1.3;
      this.quakeCharge += 1;
      if (this.quakeCharge >= this.fossilsForQuake()) {
        this.quakeCharge = this.fossilsForQuake();
        this.quakeReady = true;
        this.quakePulse = 1.3;
        this.fx.popText("quake ready", this.dino.x + 100, this.dino.y - 48, C.sun, 34);
        this.fx.screenFlash(C.sun, 0.12, 0.28);
      } else {
        this.fx.popText("+fossil", obstacle.x + obstacle.w / 2, obstacle.y - 24, C.sun, 26);
      }
      this.fx.burst(obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h / 2, 18, {
        colors: [C.sun, C.coral, C.white],
        speed: 190,
        size: 6,
        gravity: 180
      });
      this.fx.ring(obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h / 2, C.sun, 32, 0.28);
      this.fx.sound("clear", 0.72);
      return true;
    }

    getDinoBox() {
      const shrink = this.dino.ducking ? 10 : 8;
      return {
        x: this.dino.x + shrink,
        y: this.dino.y + 8,
        w: this.dino.w - shrink * 1.5,
        h: this.dino.h - 14
      };
    }

    getCollision() {
      const d = this.getDinoBox();
      for (const obstacle of this.obstacles) {
        if (obstacle.broken) continue;
        if (d.x < obstacle.x + obstacle.w && d.x + d.w > obstacle.x && d.y < obstacle.y + obstacle.h && d.y + d.h > obstacle.y) {
          return obstacle;
        }
      }
      return null;
    }

    releaseQuake(hit) {
      this.quakeReady = false;
      this.quakeCharge = 0;
      this.quakePulse = 1.6;
      this.groundPulse = 1.3;
      let broken = 0;
      for (const obstacle of this.obstacles) {
        const dx = Math.abs((obstacle.x + obstacle.w / 2) - (hit.x + hit.w / 2));
        if (dx < 330 && !obstacle.broken) {
          this.breakObstacle(obstacle);
          broken += 1;
        }
      }
      this.score += 120 + broken * 35;
      this.dino.vy = -360;
      this.dino.onGround = false;
      this.fx.popText("quake", this.dino.x + 100, this.dino.y - 62, C.coral, 44);
      this.fx.burst(this.dino.x + 52, this.groundY() - 8, 64, {
        colors: [C.sun, C.coral, C.white, C.ink],
        angle: 0,
        spread: Math.PI,
        speed: 420,
        size: 8,
        gravity: 260
      });
      this.fx.ring(this.dino.x + 52, this.groundY() - 12, C.coral, 112, 0.5);
      this.fx.screenFlash(C.sun, 0.22, 0.34);
      this.fx.hitStop(0.13);
      this.fx.shake(16, 13);
      this.fx.sound("crash", 0.9);
    }

    breakObstacle(obstacle) {
      obstacle.broken = true;
      obstacle.wobble = 0;
      const pieces = obstacle.type === "bird" ? 3 : 4;
      obstacle.fragments = [];
      for (let i = 0; i < pieces; i += 1) {
        obstacle.fragments.push({
          x: obstacle.x + rand(8, obstacle.w - 8),
          y: obstacle.y + rand(8, obstacle.h - 8),
          w: Math.max(14, obstacle.w / rand(2.2, 3.4)),
          h: Math.max(16, obstacle.h / rand(2.0, 3.0)),
          color: obstacle.type === "bird" ? C.plum : C.teal,
          vx: rand(120, 310) * (i % 2 === 0 ? 1 : -0.45),
          vy: rand(-430, -170),
          rot: rand(-0.3, 0.3),
          vr: rand(-5, 5)
        });
      }
    }

    updateFragments(obstacle, dt) {
      for (const fragment of obstacle.fragments) {
        fragment.vy += 1550 * dt;
        fragment.x += fragment.vx * dt;
        fragment.y += fragment.vy * dt;
        fragment.rot += fragment.vr * dt;
        if (fragment.y + fragment.h / 2 > this.groundY()) {
          fragment.y = this.groundY() - fragment.h / 2;
          fragment.vy *= -0.16;
          fragment.vx *= 0.78;
          fragment.vr *= 0.7;
        }
      }
    }

    crash(hit) {
      if (this.state === "dead") return;
      this.state = "dead";
      if (hit) hit.wobble = 1.5;
      if (this.juice("crashBurst")) {
        this.fx.hitStop(0.15);
        this.fx.shake(16, 12);
        this.fx.screenFlash(C.danger, 0.28, 0.38);
        this.fx.burst(this.dino.x + this.dino.w / 2, this.dino.y + this.dino.h / 2, 42, {
          colors: [C.coral, C.sun, C.white, C.plum],
          speed: 310,
          size: 8,
          gravity: 340
        });
        this.fx.ring(this.dino.x + 34, this.dino.y + 36, C.danger, 64, 0.42);
      }
      this.fx.sound("crash", 1);
    }

    draw(ctx) {
      ctx.clearRect(0, 0, STAGE_W, STAGE_H);
      this.drawSky(ctx);
      this.drawGround(ctx);
      this.drawObstacles(ctx);
      this.drawDino(ctx);
      this.drawMeters(ctx);
      if (this.paused || this.state === "ready" || this.state === "dead") this.drawOverlay(ctx);
    }

    drawSky(ctx) {
      ctx.fillStyle = this.fx.color("#f5f4df", C.paper);
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      ctx.fillStyle = this.fx.color(C.sun, "rgba(36,50,59,0.12)");
      ctx.beginPath();
      ctx.arc(730, 130, 54, 0, Math.PI * 2);
      ctx.fill();
      if (this.juice("parallax")) {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        for (let i = 0; i < 6; i += 1) {
          const x = ((i * 235 - this.cloudScroll) % (STAGE_W + 280)) - 150;
          const y = 140 + (i % 3) * 72;
          roundRect(ctx, x, y, 118, 24, 12);
          ctx.fill();
          roundRect(ctx, x + 26, y - 18, 62, 28, 14);
          ctx.fill();
        }
      }
    }

    drawGround(ctx) {
      const y = this.groundY();
      ctx.save();
      ctx.translate(0, this.groundPulse * rand(-2, 2));
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(42, y);
      ctx.lineTo(STAGE_W - 42, y);
      ctx.stroke();
      ctx.fillStyle = this.fx.color(C.line);
      for (let x = -100; x < STAGE_W + 120; x += 64) {
        const ox = x - (this.groundScroll % 64);
        roundRect(ctx, ox, y + 26 + Math.sin((ox + this.groundScroll) / 80) * 3, 36, 7, 4);
        ctx.fill();
      }
      if (this.quakeReady) {
        ctx.globalAlpha = 0.38 + Math.sin(performance.now() / 90) * 0.12;
        ctx.strokeStyle = this.fx.color(C.sun);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(80, y + 18);
        for (let x = 100; x < STAGE_W - 70; x += 34) {
          ctx.lineTo(x, y + 18 + Math.sin(x * 0.21 + performance.now() / 80) * 7);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    drawObstacles(ctx) {
      for (const obstacle of this.obstacles) {
        if (obstacle.broken) {
          this.drawFragments(ctx, obstacle);
        } else {
          this.drawObstacle(ctx, obstacle);
        }
      }
    }

    drawObstacle(ctx, obstacle) {
      const wobble = this.juice("obstacleWobble") ? obstacle.wobble * Math.sin(performance.now() / 70) * 8 : 0;
      ctx.save();
      ctx.translate(obstacle.x + obstacle.w / 2 + wobble, obstacle.y + obstacle.h / 2);
      ctx.rotate(obstacle.wobble * 0.03 * Math.sin(performance.now() / 90));
      ctx.translate(-obstacle.w / 2, -obstacle.h / 2);
      if (obstacle.type === "bird") {
        ctx.fillStyle = this.fx.color(C.plum);
        ctx.beginPath();
        ctx.ellipse(obstacle.w * 0.5, obstacle.h * 0.5, obstacle.w * 0.42, obstacle.h * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 4;
        ctx.stroke();
        const flap = Math.sin(performance.now() / 90) * 12;
        ctx.fillStyle = this.fx.color(C.coral);
        ctx.beginPath();
        ctx.moveTo(obstacle.w * 0.34, obstacle.h * 0.52);
        ctx.lineTo(obstacle.w * 0.08, obstacle.h * 0.18 + flap);
        ctx.lineTo(obstacle.w * 0.44, obstacle.h * 0.36);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(obstacle.w * 0.62, obstacle.h * 0.52);
        ctx.lineTo(obstacle.w * 0.98, obstacle.h * 0.22 - flap);
        ctx.lineTo(obstacle.w * 0.62, obstacle.h * 0.35);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = this.fx.color(C.teal);
        roundRect(ctx, obstacle.w * 0.28, 0, obstacle.w * 0.44, obstacle.h, 8);
        ctx.fill();
        roundRect(ctx, 0, obstacle.h * 0.28, obstacle.w * 0.35, obstacle.h * 0.18, 8);
        ctx.fill();
        roundRect(ctx, obstacle.w * 0.64, obstacle.h * 0.5, obstacle.w * 0.36, obstacle.h * 0.18, 8);
        ctx.fill();
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 4;
        roundRect(ctx, obstacle.w * 0.28, 0, obstacle.w * 0.44, obstacle.h, 8);
        ctx.stroke();
      }

      if (obstacle.fossil && !obstacle.cracked) {
        ctx.fillStyle = this.fx.color(C.sun);
        ctx.beginPath();
        ctx.arc(obstacle.w * 0.52, obstacle.h * 0.46, 10 + Math.sin(performance.now() / 120) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (obstacle.cracked) {
        ctx.strokeStyle = this.fx.color(C.sun);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(obstacle.w * 0.42, obstacle.h * 0.34);
        ctx.lineTo(obstacle.w * 0.52, obstacle.h * 0.46);
        ctx.lineTo(obstacle.w * 0.45, obstacle.h * 0.62);
        ctx.moveTo(obstacle.w * 0.52, obstacle.h * 0.46);
        ctx.lineTo(obstacle.w * 0.66, obstacle.h * 0.42);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawFragments(ctx, obstacle) {
      for (const fragment of obstacle.fragments) {
        ctx.save();
        ctx.translate(fragment.x, fragment.y);
        ctx.rotate(fragment.rot);
        ctx.fillStyle = this.fx.color(fragment.color);
        roundRect(ctx, -fragment.w / 2, -fragment.h / 2, fragment.w, fragment.h, 5);
        ctx.fill();
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 3;
        roundRect(ctx, -fragment.w / 2, -fragment.h / 2, fragment.w, fragment.h, 5);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawDino(ctx) {
      const dino = this.dino;
      if (this.juice("dinoTrail")) {
        ctx.save();
        for (const point of dino.trail) {
          const t = point.age / 0.38;
          ctx.globalAlpha = (1 - t) * 0.22;
          ctx.fillStyle = this.fx.color(C.coral);
          roundRect(ctx, point.x, point.y, dino.w, point.h, 8);
          ctx.fill();
        }
        ctx.restore();
      }

      const charge = dino.charging ? dino.jumpCharge : 0;
      if (charge > 0.03) {
        ctx.save();
        ctx.globalAlpha = 0.32 + charge * 0.42;
        ctx.strokeStyle = this.fx.color(C.sun);
        ctx.lineWidth = 3 + charge * 4;
        ctx.lineCap = "round";
        for (let i = 0; i < 4; i += 1) {
          const y = this.groundY() - 8 + i * 8;
          ctx.beginPath();
          ctx.moveTo(dino.x + 12, y);
          ctx.quadraticCurveTo(dino.x + 34, y + 12 + charge * 12, dino.x + 58, y);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (this.quakeReady) {
        ctx.save();
        ctx.globalAlpha = 0.42 + Math.sin(performance.now() / 95) * 0.18;
        ctx.strokeStyle = this.fx.color(C.sun);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(dino.x + dino.w / 2, dino.y + dino.h / 2, dino.w * 0.86 + this.quakePulse * 12, dino.h * 0.68 + this.quakePulse * 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const squash = this.juice("dinoSquash") ? dino.squash : 0;
      const sx = 1 + squash * 0.16 + charge * 0.05;
      const sy = 1 - squash * 0.12 - charge * 0.14;
      ctx.save();
      ctx.translate(dino.x + dino.w / 2, dino.y + dino.h);
      ctx.scale(sx, sy);
      ctx.translate(-dino.w / 2, -dino.h);
      ctx.fillStyle = this.fx.color(C.ink);
      roundRect(ctx, 12, dino.h * 0.32, dino.w * 0.58, dino.h * 0.52, 9);
      ctx.fill();
      roundRect(ctx, 38, 2, dino.w * 0.46, dino.h * 0.38, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(15, dino.h * 0.48);
      ctx.lineTo(-12, dino.h * 0.62);
      ctx.lineTo(14, dino.h * 0.68);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = C.white;
      ctx.beginPath();
      ctx.arc(57, 18, 4.2, 0, Math.PI * 2);
      ctx.fill();
      const leg = Math.sin(dino.leg);
      ctx.fillStyle = this.fx.color(C.ink);
      roundRect(ctx, 20 + leg * 5, dino.h - 16, 12, 18, 4);
      ctx.fill();
      roundRect(ctx, 46 - leg * 5, dino.h - 16, 12, 18, 4);
      ctx.fill();
      ctx.restore();
    }

    drawMeters(ctx) {
      if (!this.potentialActive() || !this.potential("fossilCores")) return;
      const filled = this.quakeReady ? 1 : this.quakeCharge / this.fossilsForQuake();
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      roundRect(ctx, 54, 34, 182, 22, 8);
      ctx.fill();
      ctx.fillStyle = this.fx.color(this.quakeReady ? C.coral : C.sun);
      roundRect(ctx, 54, 34, 182 * filled, 22, 8);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      roundRect(ctx, 54, 34, 182, 22, 8);
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.font = "900 14px Avenir Next, Trebuchet MS, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("QUAKE", 56, 76);
      ctx.restore();
    }

    drawOverlay(ctx) {
      const label = this.paused ? "Paused" : this.state === "dead" ? "Game Over" : "Ready";
      ctx.save();
      ctx.fillStyle = "rgba(241,251,239,0.42)";
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      ctx.fillStyle = C.ink;
      ctx.font = "900 62px Avenir Next, Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, STAGE_W / 2, STAGE_H / 2);
      ctx.restore();
    }

    serialize() {
      return {
        score: this.score,
        best: this.best,
        speed: this.speed,
        state: this.state,
        paused: this.paused,
        spawnTimer: this.spawnTimer,
        groundScroll: this.groundScroll,
        cloudScroll: this.cloudScroll,
        quakeCharge: this.quakeCharge,
        quakeReady: this.quakeReady,
        quakePulse: this.quakePulse,
        obstacles: this.obstacles,
        dino: this.dino
      };
    }

    deserialize(state) {
      if (!state || typeof state !== "object") return;
      this.score = Number(state.score) || 0;
      this.best = Math.max(Number(state.best) || 0, this.loadBest());
      this.speed = Number(state.speed) || 330;
      this.state = ["ready", "running", "dead"].includes(state.state) ? state.state : "ready";
      this.paused = Boolean(state.paused);
      this.spawnTimer = Number(state.spawnTimer) || 0.8;
      this.groundScroll = Number(state.groundScroll) || 0;
      this.cloudScroll = Number(state.cloudScroll) || 0;
      this.quakeCharge = Number(state.quakeCharge) || 0;
      this.quakeReady = Boolean(state.quakeReady);
      this.quakePulse = Number(state.quakePulse) || 0;
      this.obstacles = Array.isArray(state.obstacles) ? state.obstacles.map((obstacle) => {
        const type = obstacle.type === "bird" ? "bird" : "cactus";
        const h = type === "bird"
          ? (Number(obstacle.h) || 44)
          : this.tunedCactusHeight(Number(obstacle.h) || 80);
        return {
          type,
          x: Number(obstacle.x) || 0,
          y: type === "bird" ? (Number(obstacle.y) || this.groundY() - 124) : this.groundY() - h,
          w: Number(obstacle.w) || (type === "bird" ? 82 : 50),
          h,
          fossil: Boolean(obstacle.fossil),
          cracked: Boolean(obstacle.cracked),
          passed: Boolean(obstacle.passed),
          broken: Boolean(obstacle.broken),
          wobble: Number(obstacle.wobble) || 0,
          fragments: Array.isArray(obstacle.fragments) ? obstacle.fragments.map((fragment) => ({
            x: Number(fragment.x) || 0,
            y: Number(fragment.y) || 0,
            w: Number(fragment.w) || 16,
            h: Number(fragment.h) || 18,
            color: typeof fragment.color === "string" ? fragment.color : C.teal,
            vx: Number(fragment.vx) || 0,
            vy: Number(fragment.vy) || 0,
            rot: Number(fragment.rot) || 0,
            vr: Number(fragment.vr) || 0
          })) : []
        };
      }) : [];
      this.dino = {
        ...this.dino,
        ...(state.dino || {}),
        charging: false,
        trail: Array.isArray(state.dino?.trail) ? state.dino.trail.slice(0, 24) : []
      };
      if (this.dino.onGround) this.snapDinoToGround();
      this.saveBest();
    }
  }

  class JuicySnake {
    constructor(fx) {
      this.fx = fx;
      this.name = "snake";
      this.best = this.loadBest();
      this.paused = false;
      this.reset();
    }

    juice(key, fallback = true) {
      return this.fx.gameSetting(this.name, key, fallback);
    }

    potential(key, fallback = true) {
      return this.fx.gameSetting(`${this.name}Potential`, key, fallback);
    }

    potentialActive() {
      return this.potential("potentiality");
    }

    cols() {
      return 16;
    }

    rows() {
      return 16;
    }

    cellSize() {
      return 44;
    }

    arenaLeft() {
      return 98;
    }

    arenaTop() {
      return 172;
    }

    boardWidth() {
      return this.cols() * this.cellSize();
    }

    boardHeight() {
      return this.rows() * this.cellSize();
    }

    arenaRight() {
      return this.arenaLeft() + this.boardWidth();
    }

    arenaBottom() {
      return this.arenaTop() + this.boardHeight();
    }

    key(x, y) {
      return `${x},${y}`;
    }

    loadBest() {
      try {
        return Number(window.localStorage.getItem("juicy-snake-best") || 0);
      } catch {
        return 0;
      }
    }

    saveBest() {
      try {
        window.localStorage.setItem("juicy-snake-best", String(this.best));
      } catch {
        // Local storage can be unavailable in strict browser modes.
      }
    }

    cellCenter(cell) {
      return {
        x: this.arenaLeft() + cell.x * this.cellSize() + this.cellSize() / 2,
        y: this.arenaTop() + cell.y * this.cellSize() + this.cellSize() / 2
      };
    }

    currentStepTime() {
      return clamp(0.145 - Math.min(this.snake.length, 22) * 0.0021 - Math.min(this.score, 240) * 0.00008, 0.072, 0.145);
    }

    chargeGoal() {
      if (!this.potentialActive()) return 0;
      return clamp(2 + Math.floor(Math.max(0, this.snake.length - 4) / 4), 2, 7);
    }

    isBreakerReady() {
      return this.potentialActive() && this.sparksStored >= this.chargeGoal();
    }

    targetSparkCount() {
      return this.potentialActive() && this.potential("sparkFruit") ? 3 : 0;
    }

    targetBlockCount() {
      if (!this.potentialActive() || !this.potential("breakerBlocks")) return 0;
      if (this.snake.length >= 14) return 4;
      if (this.snake.length >= 9) return 3;
      return 2;
    }

    reset() {
      this.score = 0;
      this.state = "ready";
      this.paused = false;
      this.tickTimer = 0;
      this.movePulse = 0;
      this.chargePulse = 0;
      this.breakerFlash = 0;
      this.growth = 0;
      this.sparksStored = 0;
      this.turnQueue = [];
      this.dir = { x: 1, y: 0 };
      this.snake = [
        { x: 4, y: 8, pulse: 0 },
        { x: 3, y: 8, pulse: 0 },
        { x: 2, y: 8, pulse: 0 },
        { x: 1, y: 8, pulse: 0 }
      ];
      this.fruits = [];
      this.sparkPickups = [];
      this.blocks = [];
      this.headTrail = [];
      this.best = Math.max(this.best, this.loadBest());
      this.syncPotentialBoard();
      while (this.fruits.length < 1) this.spawnFruit();
    }

    getStats() {
      return {
        score: Math.floor(this.score),
        middleLabel: "Best",
        middle: this.best,
        lowerLabel: this.potentialActive() ? "Charge" : "Length",
        lower: this.potentialActive()
          ? `${this.sparksStored}/${this.chargeGoal()}${this.isBreakerReady() ? " ready" : ""}`
          : this.snake.length
      };
    }

    handleInput(input) {
      if (input === "left" || input === "snake-left") this.queueDirection(-1, 0);
      if (input === "right" || input === "snake-right") this.queueDirection(1, 0);
      if (input === "up" || input === "snake-up") this.queueDirection(0, -1);
      if (input === "down" || input === "snake-down") this.queueDirection(0, 1);
    }

    ensureRunning() {
      if (this.state === "dead") this.reset();
      if (this.state === "ready") this.state = "running";
    }

    queueDirection(x, y) {
      this.ensureRunning();
      const base = this.turnQueue.length > 0 ? this.turnQueue[this.turnQueue.length - 1] : this.dir;
      if (x === base.x && y === base.y) return;
      if (x === -base.x && y === -base.y) return;
      if (this.turnQueue.length >= 2) return;
      this.turnQueue.push({ x, y });
    }

    syncPotentialBoard() {
      if (!this.potentialActive()) {
        this.sparkPickups = [];
        this.blocks = [];
        this.sparksStored = 0;
        this.chargePulse = 0;
        this.breakerFlash = 0;
        return;
      }

      const sparkTarget = this.targetSparkCount();
      if (sparkTarget > 0) {
        while (this.sparkPickups.length < sparkTarget) this.spawnSpark();
      } else {
        this.sparkPickups = [];
        this.sparksStored = 0;
      }

      const blockTarget = this.targetBlockCount();
      if (blockTarget > 0) {
        while (this.blocks.length < blockTarget) this.spawnBlock();
      } else {
        this.blocks = [];
      }
    }

    occupiedKeys() {
      const keys = new Set();
      for (const part of this.snake) keys.add(this.key(part.x, part.y));
      return keys;
    }

    entityAt(list, x, y) {
      return list.find((item) => item.x === x && item.y === y);
    }

    randomFreeCell(filter = null) {
      const isTaken = (cell) => {
        const key = this.key(cell.x, cell.y);
        return this.occupiedKeys().has(key)
          || this.entityAt(this.fruits, cell.x, cell.y)
          || this.entityAt(this.sparkPickups, cell.x, cell.y)
          || this.entityAt(this.blocks, cell.x, cell.y);
      };

      for (let attempt = 0; attempt < 320; attempt += 1) {
        const cell = {
          x: Math.floor(rand(0, this.cols())),
          y: Math.floor(rand(0, this.rows()))
        };
        if (isTaken(cell)) continue;
        if (filter && !filter(cell)) continue;
        return cell;
      }

      for (let y = 0; y < this.rows(); y += 1) {
        for (let x = 0; x < this.cols(); x += 1) {
          const cell = { x, y };
          if (isTaken(cell)) continue;
          if (filter && !filter(cell)) continue;
          return cell;
        }
      }

      return null;
    }

    nearbyFreeCells(origin, radius = 2) {
      const spots = [];
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const x = origin.x + dx;
          const y = origin.y + dy;
          if (x < 0 || y < 0 || x >= this.cols() || y >= this.rows()) continue;
          if (this.occupiedKeys().has(this.key(x, y))) continue;
          if (this.entityAt(this.fruits, x, y) || this.entityAt(this.sparkPickups, x, y) || this.entityAt(this.blocks, x, y)) continue;
          spots.push({ x, y, d: Math.abs(dx) + Math.abs(dy) });
        }
      }
      return spots.sort((a, b) => a.d - b.d || Math.random() - 0.5);
    }

    spawnFruit(origin = null, bonus = false) {
      let cell = null;
      if (origin) {
        if ("exact" in origin && origin.exact) {
          cell = { x: origin.x, y: origin.y };
        } else {
          const nearby = this.nearbyFreeCells(origin, 2);
          if (nearby.length > 0) cell = nearby.shift();
        }
      }
      if (!cell) cell = this.randomFreeCell();
      if (!cell) return;
      this.fruits.push({
        x: cell.x,
        y: cell.y,
        bonus,
        pulse: 1
      });
    }

    spawnSpark(origin = null) {
      let cell = null;
      if (origin) {
        if ("exact" in origin && origin.exact) {
          cell = { x: origin.x, y: origin.y };
        } else {
          const nearby = this.nearbyFreeCells(origin, 2);
          if (nearby.length > 0) cell = nearby.shift();
        }
      }
      if (!cell) cell = this.randomFreeCell();
      if (!cell) return;
      this.sparkPickups.push({
        x: cell.x,
        y: cell.y,
        pulse: 1
      });
    }

    spawnBlock() {
      const head = this.snake[0];
      const cell = this.randomFreeCell((candidate) => {
        const farEnough = Math.abs(candidate.x - head.x) + Math.abs(candidate.y - head.y) > 5;
        const interior = candidate.x > 0 && candidate.y > 0 && candidate.x < this.cols() - 1 && candidate.y < this.rows() - 1;
        return farEnough && interior;
      });
      if (!cell) return;
      this.blocks.push({
        x: cell.x,
        y: cell.y,
        wobble: 0,
        pulse: 1
      });
    }

    collectFruit(fruit, source = "bite") {
      this.fruits.splice(this.fruits.indexOf(fruit), 1);
      this.growth += fruit.bonus ? 2 : 1;
      this.score += fruit.bonus ? 32 : 16;
      this.best = Math.max(this.best, Math.floor(this.score));
      this.saveBest();
      const center = this.cellCenter(fruit);
      if (this.juice("biteBurst")) {
        this.fx.burst(center.x, center.y, fruit.bonus ? 16 : 9, {
          colors: fruit.bonus ? [C.sun, C.coral, C.white] : [C.coral, C.sun, C.white],
          speed: source === "block" ? 170 : 210,
          size: 5,
          gravity: 120
        });
        this.fx.ring(center.x, center.y, fruit.bonus ? C.sun : C.coral, fruit.bonus ? 34 : 26, 0.24);
      }
      if (this.juice("scorePulse")) this.fx.popText(`+${fruit.bonus ? 32 : 16}`, center.x, center.y - 22, fruit.bonus ? C.sun : C.coral, 22);
      this.fx.sound(fruit.bonus ? "clear" : "pass", fruit.bonus ? 0.84 : 0.66);
    }

    collectSpark(spark, source = "bite") {
      this.sparkPickups.splice(this.sparkPickups.indexOf(spark), 1);
      const wasReady = this.isBreakerReady();
      this.sparksStored = Math.min(this.chargeGoal(), this.sparksStored + 1);
      this.score += 12;
      this.best = Math.max(this.best, Math.floor(this.score));
      this.saveBest();
      this.chargePulse = Math.max(this.chargePulse, 0.7);
      const center = this.cellCenter(spark);
      if (this.juice("biteBurst")) {
        this.fx.burst(center.x, center.y, 10, {
          colors: [C.sun, C.blue, C.white],
          speed: source === "block" ? 170 : 220,
          size: 5,
          gravity: 110
        });
        this.fx.ring(center.x, center.y, C.sun, 28, 0.24);
      }
      const ready = this.isBreakerReady();
      if (ready && !wasReady) {
        this.breakerFlash = 1.1;
        this.fx.popText("breaker ready", center.x, center.y - 30, C.coral, 28);
        this.fx.screenFlash(C.sun, 0.12, 0.24);
        this.fx.sound("clear", 0.88);
      } else {
        this.fx.popText("+spark", center.x, center.y - 24, C.sun, 24);
        this.fx.sound("rotate", 0.7);
      }
    }

    spendBreaker(label, center, accent = C.coral) {
      this.sparksStored = 0;
      this.chargePulse = 1.2;
      this.breakerFlash = 1.15;
      this.fx.popText(label, center.x, center.y - 32, accent, 28);
      this.fx.burst(center.x, center.y, 28, {
        colors: [C.coral, C.sun, C.white, C.teal],
        speed: 260,
        size: 6,
        gravity: 140
      });
      this.fx.ring(center.x, center.y, accent, 42, 0.3);
      this.fx.hitStop(0.04);
      this.fx.shake(6, 0);
      this.fx.sound("clear", 0.9);
    }

    breakBlock(block) {
      const index = this.blocks.indexOf(block);
      if (index >= 0) this.blocks.splice(index, 1);
      this.score += 42;
      this.best = Math.max(this.best, Math.floor(this.score));
      this.saveBest();
      const center = this.cellCenter(block);
      this.spendBreaker("block break", center);

      if (this.potential("blockRewards")) {
        const nearby = this.nearbyFreeCells(block, 2);
        const fruitSpot = nearby.shift();
        const sparkSpot = nearby.shift();
        if (fruitSpot) this.spawnFruit({ x: fruitSpot.x, y: fruitSpot.y, exact: true }, true);
        else this.spawnFruit(null, true);
        if (sparkSpot) this.spawnSpark({ x: sparkSpot.x, y: sparkSpot.y, exact: true });
        else this.spawnSpark();
      }
    }

    breachWall(next) {
      const wrapped = {
        x: next.x < 0 ? this.cols() - 1 : next.x >= this.cols() ? 0 : next.x,
        y: next.y < 0 ? this.rows() - 1 : next.y >= this.rows() ? 0 : next.y,
        pulse: 1
      };
      const center = {
        x: next.x < 0 ? this.arenaLeft() : next.x >= this.cols() ? this.arenaRight() : this.cellCenter({ x: wrapped.x, y: wrapped.y }).x,
        y: next.y < 0 ? this.arenaTop() : next.y >= this.rows() ? this.arenaBottom() : this.cellCenter({ x: wrapped.x, y: wrapped.y }).y
      };
      this.spendBreaker("wall break", center, C.sun);
      const exit = this.cellCenter(wrapped);
      this.fx.ring(exit.x, exit.y, C.sun, 32, 0.22);
      this.fx.burst(exit.x, exit.y, 14, {
        colors: [C.sun, C.white, C.teal],
        speed: 180,
        size: 5,
        gravity: 80
      });
      return wrapped;
    }

    crash(reason, cell) {
      if (this.state === "dead") return;
      this.state = "dead";
      const center = cell ? this.cellCenter(cell) : this.cellCenter(this.snake[0]);
      if (this.juice("biteBurst")) {
        this.fx.hitStop(0.14);
        this.fx.shake(14, 10);
        this.fx.screenFlash(C.danger, 0.24, 0.36);
        this.fx.burst(center.x, center.y, 38, {
          colors: [C.coral, C.sun, C.white, C.plum],
          speed: 300,
          size: 8,
          gravity: 280
        });
        this.fx.ring(center.x, center.y, C.danger, 68, 0.42);
      }
      if (reason === "block") this.fx.popText("block hit", center.x, center.y - 42, C.danger, 28);
      if (reason === "wall") this.fx.popText("wall", center.x, center.y - 42, C.danger, 26);
      this.fx.sound("crash", 1);
    }

    moveStep() {
      while (this.turnQueue.length > 0) {
        const turn = this.turnQueue.shift();
        if (turn.x !== -this.dir.x || turn.y !== -this.dir.y) {
          this.dir = turn;
          break;
        }
      }

      const head = this.snake[0];
      let next = { x: head.x + this.dir.x, y: head.y + this.dir.y, pulse: 1 };
      const ready = this.isBreakerReady();
      if (next.x < 0 || next.y < 0 || next.x >= this.cols() || next.y >= this.rows()) {
        if (ready && this.potential("wallBreak")) {
          next = this.breachWall(next);
        } else {
          this.crash("wall", head);
          return;
        }
      }

      const safeTail = this.growth <= 0 ? this.snake[this.snake.length - 1] : null;
      const safeTailKey = safeTail ? this.key(safeTail.x, safeTail.y) : null;
      const occupied = this.occupiedKeys();
      if (safeTailKey) occupied.delete(safeTailKey);
      if (occupied.has(this.key(next.x, next.y))) {
        this.crash("self", next);
        return;
      }

      const block = this.entityAt(this.blocks, next.x, next.y);
      if (block) {
        if (ready && this.potential("breakerBlocks")) this.breakBlock(block);
        else {
          this.crash("block", next);
          return;
        }
      }

      this.snake.unshift(next);
      const center = this.cellCenter(next);
      this.headTrail.push({ x: center.x, y: center.y, age: 0, hot: this.isBreakerReady() ? 1 : 0 });
      this.movePulse = 1;

      const fruit = this.entityAt(this.fruits, next.x, next.y);
      if (fruit) this.collectFruit(fruit);

      const spark = this.entityAt(this.sparkPickups, next.x, next.y);
      if (spark) this.collectSpark(spark);

      if (this.growth > 0) {
        this.growth -= 1;
      } else {
        this.snake.pop();
      }

      for (const part of this.snake) part.pulse *= 0.84;
      this.syncPotentialBoard();
      while (this.fruits.length < 1) this.spawnFruit();
    }

    update(dt, realDt) {
      if (this.paused) return;

      this.syncPotentialBoard();
      this.movePulse *= Math.pow(0.02, realDt);
      this.chargePulse *= Math.pow(0.02, realDt);
      this.breakerFlash *= Math.pow(0.02, realDt);
      for (const fruit of this.fruits) fruit.pulse *= Math.pow(0.02, realDt);
      for (const spark of this.sparkPickups) spark.pulse *= Math.pow(0.02, realDt);
      for (const block of this.blocks) {
        block.pulse *= Math.pow(0.02, realDt);
        block.wobble *= Math.pow(0.02, realDt);
      }

      for (let i = this.headTrail.length - 1; i >= 0; i -= 1) {
        this.headTrail[i].age += realDt;
        if (this.headTrail[i].age > 0.32) this.headTrail.splice(i, 1);
      }

      if (this.state === "ready" || this.state === "dead") return;

      this.tickTimer += dt;
      let guard = 0;
      while (this.tickTimer >= this.currentStepTime() && this.state === "running" && guard < 6) {
        this.tickTimer -= this.currentStepTime();
        this.moveStep();
        guard += 1;
      }
    }

    drawBackdrop(ctx) {
      ctx.fillStyle = this.fx.color(CANVAS_THEME.snake.bg, C.paper);
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);

      ctx.fillStyle = this.fx.color(CANVAS_THEME.snake.board, CANVAS_THEME.snake.shadow);
      roundRect(ctx, this.arenaLeft() - 8, this.arenaTop() - 8, this.boardWidth() + 16, this.boardHeight() + 16, 14);
      ctx.fill();

      if (this.juice("boardPulse")) {
        const readyGlow = this.isBreakerReady() ? 0.055 : 0;
        for (let y = 0; y < this.rows(); y += 1) {
          for (let x = 0; x < this.cols(); x += 1) {
            const px = this.arenaLeft() + x * this.cellSize();
            const py = this.arenaTop() + y * this.cellSize();
            const alpha = 0.05 + Math.sin(performance.now() / 240 + x * 0.5 + y * 0.35) * 0.012 + this.chargePulse * 0.05 + readyGlow;
            ctx.fillStyle = `hsla(${CANVAS_THEME.snake.tileHue}, 40%, 56%, ${alpha})`;
            roundRect(ctx, px + 2, py + 2, this.cellSize() - 4, this.cellSize() - 4, 8);
            ctx.fill();
          }
        }
      }

      ctx.save();
      ctx.strokeStyle = this.fx.color(CANVAS_THEME.snake.grid, "rgba(36,50,59,0.1)");
      ctx.lineWidth = 2;
      for (let x = 1; x < this.cols(); x += 1) {
        const px = this.arenaLeft() + x * this.cellSize();
        ctx.beginPath();
        ctx.moveTo(px, this.arenaTop());
        ctx.lineTo(px, this.arenaBottom());
        ctx.stroke();
      }
      for (let y = 1; y < this.rows(); y += 1) {
        const py = this.arenaTop() + y * this.cellSize();
        ctx.beginPath();
        ctx.moveTo(this.arenaLeft(), py);
        ctx.lineTo(this.arenaRight(), py);
        ctx.stroke();
      }
      ctx.restore();

      if (this.breakerFlash > 0.06) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.18, this.breakerFlash * 0.12);
        ctx.strokeStyle = C.sun;
        ctx.lineWidth = 6;
        roundRect(ctx, this.arenaLeft() - 8, this.arenaTop() - 8, this.boardWidth() + 16, this.boardHeight() + 16, 14);
        ctx.stroke();
        ctx.restore();
      }

      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4;
      roundRect(ctx, this.arenaLeft() - 6, this.arenaTop() - 6, this.boardWidth() + 12, this.boardHeight() + 12, 12);
      ctx.stroke();
    }

    drawFruit(ctx, fruit) {
      const center = this.cellCenter(fruit);
      const bob = Math.sin(performance.now() / 140 + center.x * 0.02) * 2;
      ctx.save();
      ctx.translate(center.x, center.y + bob);
      ctx.scale(1 + fruit.pulse * 0.08, 1 - fruit.pulse * 0.04);
      ctx.fillStyle = this.fx.color(fruit.bonus ? C.sun : C.coral);
      ctx.beginPath();
      ctx.arc(0, 2, fruit.bonus ? 13 : 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.fx.color(C.teal);
      roundRect(ctx, -2, -14, 4, 10, 2);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 2, fruit.bonus ? 13 : 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawSpark(ctx, spark) {
      const center = this.cellCenter(spark);
      const pulse = 1 + spark.pulse * 0.12 + Math.sin(performance.now() / 100 + center.x * 0.02) * 0.04;
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(performance.now() / 320);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = this.fx.color(C.sun);
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    drawBlock(ctx, block) {
      const center = this.cellCenter(block);
      const ready = this.isBreakerReady();
      const wobble = this.juice("blockWobble")
        ? Math.sin(performance.now() / 90 + center.x * 0.02) * (1.3 + block.wobble * 5 + (ready ? 1.2 : 0))
        : 0;
      ctx.save();
      ctx.translate(center.x + wobble, center.y);
      ctx.rotate(wobble * 0.01);
      roundRect(ctx, -16, -16, 32, 32, 7);
      ctx.fillStyle = this.fx.color(ready ? "#f4e2b0" : "#dceadf");
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      roundRect(ctx, -16, -16, 32, 32, 7);
      ctx.stroke();
      ctx.strokeStyle = ready ? C.coral : C.ink;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-7, -8);
      ctx.lineTo(1, -1);
      ctx.lineTo(-2, 9);
      ctx.moveTo(6, -10);
      ctx.lineTo(0, -2);
      ctx.lineTo(9, 8);
      ctx.stroke();
      ctx.restore();
    }

    drawSnake(ctx) {
      if (this.juice("trailEcho")) {
        ctx.save();
        for (const point of this.headTrail) {
          const t = point.age / 0.32;
          ctx.globalAlpha = (1 - t) * (point.hot > 0 ? 0.52 : 0.26);
          ctx.fillStyle = this.fx.color(point.hot > 0 ? C.sun : C.teal);
          ctx.beginPath();
          ctx.arc(point.x, point.y, 16 * (1 - t * 0.28), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      const ready = this.isBreakerReady();
      for (let i = this.snake.length - 1; i >= 0; i -= 1) {
        const part = this.snake[i];
        const center = this.cellCenter(part);
        const isHead = i === 0;
        const size = this.cellSize() - 8;
        const pulse = (part.pulse || 0) + this.movePulse * (isHead ? 0.62 : 0.15);
        const stretch = this.juice("headSquash") && isHead ? (ready ? 0.18 : 0.05) + this.chargePulse * 0.12 : 0;
        const chargedSegment = !isHead && i <= this.sparksStored;
        ctx.save();
        ctx.translate(center.x, center.y);
        if (isHead) ctx.rotate(Math.atan2(this.dir.y, this.dir.x));
        ctx.scale(1 + stretch * 0.2 + pulse * 0.04, 1 - stretch * 0.12);
        roundRect(ctx, -size / 2, -size / 2, size, size, isHead ? 12 : 10);
        ctx.fillStyle = this.fx.color(isHead ? (ready ? C.coral : C.blue) : (i % 2 === 0 ? C.teal : C.tealDark));
        ctx.fill();
        if (isHead && ready) {
          ctx.globalAlpha = 0.26 + Math.sin(performance.now() / 60) * 0.08;
          ctx.fillStyle = this.fx.color(C.sun);
          roundRect(ctx, -size / 2 - 5, -size / 2 - 5, size + 10, size + 10, 14);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 3;
        roundRect(ctx, -size / 2, -size / 2, size, size, isHead ? 12 : 10);
        ctx.stroke();

        if (isHead) {
          ctx.fillStyle = ready ? C.sun : C.paper;
          ctx.beginPath();
          ctx.moveTo(size * 0.26, 0);
          ctx.lineTo(-size * 0.03, -size * 0.18);
          ctx.lineTo(-size * 0.03, size * 0.18);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (chargedSegment && this.juice("chargePips")) {
          const pipPulse = 1 + (ready ? 0.14 : 0.05) + Math.sin(performance.now() / 120 + i) * 0.03;
          ctx.save();
          ctx.scale(pipPulse, pipPulse);
          ctx.fillStyle = ready ? C.sun : C.paper;
          ctx.beginPath();
          ctx.arc(0, 0, 5.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = ready ? C.coral : C.ink;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();
      }
    }

    drawMeters(ctx) {
      if (!this.potentialActive()) return;
      const goal = this.chargeGoal();
      const fill = goal > 0 ? clamp(this.sparksStored / goal, 0, 1) : 0;
      const ready = this.isBreakerReady();
      const blockTarget = Math.max(1, this.targetBlockCount());

      ctx.save();
      ctx.translate(0, this.chargePulse * rand(-1.1, 1.1));
      ctx.fillStyle = C.ink;
      drawFittedText(ctx, ready ? "BREAKER READY" : `SPARKS ${this.sparksStored}/${goal}`, STAGE_W / 2, 28, 320, 16, 13);
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      roundRect(ctx, STAGE_W / 2 - 132, 40, 264, 22, 8);
      ctx.fill();
      ctx.fillStyle = this.fx.color(ready ? C.coral : C.sun);
      roundRect(ctx, STAGE_W / 2 - 132, 40, 264 * fill, 22, 8);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      roundRect(ctx, STAGE_W / 2 - 132, 40, 264, 22, 8);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.54)";
      roundRect(ctx, 54, 32, 138, 18, 8);
      ctx.fill();
      ctx.fillStyle = this.fx.color(C.blue);
      roundRect(ctx, 54, 32, 138 * clamp(this.snake.length / 18, 0, 1), 18, 8);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      roundRect(ctx, 54, 32, 138, 18, 8);
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.font = "900 11px Avenir Next, Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`LENGTH ${this.snake.length}`, 123, 65);

      ctx.fillStyle = "rgba(255,255,255,0.54)";
      roundRect(ctx, STAGE_W - 192, 32, 138, 18, 8);
      ctx.fill();
      ctx.fillStyle = this.fx.color(C.teal);
      roundRect(ctx, STAGE_W - 192, 32, 138 * clamp(this.blocks.length / blockTarget, 0, 1), 18, 8);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      roundRect(ctx, STAGE_W - 192, 32, 138, 18, 8);
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.fillText(`BLOCKS ${this.blocks.length}`, STAGE_W - 123, 65);
      ctx.restore();
    }

    drawOverlay(ctx) {
      const label = this.paused ? "Paused" : this.state === "dead" ? "Game Over" : "Ready";
      ctx.save();
      ctx.fillStyle = "rgba(241,251,239,0.42)";
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      ctx.fillStyle = C.ink;
      ctx.font = "900 62px Avenir Next, Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, STAGE_W / 2, STAGE_H / 2);
      ctx.restore();
    }

    draw(ctx) {
      ctx.clearRect(0, 0, STAGE_W, STAGE_H);
      this.drawBackdrop(ctx);
      for (const fruit of this.fruits) this.drawFruit(ctx, fruit);
      for (const spark of this.sparkPickups) this.drawSpark(ctx, spark);
      for (const block of this.blocks) this.drawBlock(ctx, block);
      this.drawSnake(ctx);
      this.drawMeters(ctx);
      if (this.paused || this.state === "ready" || this.state === "dead") this.drawOverlay(ctx);
    }

    serialize() {
      return {
        score: this.score,
        best: this.best,
        state: this.state,
        paused: this.paused,
        tickTimer: this.tickTimer,
        dir: this.dir,
        turnQueue: this.turnQueue,
        growth: this.growth,
        sparksStored: this.sparksStored,
        snake: this.snake,
        fruits: this.fruits,
        sparkPickups: this.sparkPickups,
        blocks: this.blocks
      };
    }

    deserialize(state) {
      if (!state || typeof state !== "object") return;
      this.score = Number(state.score) || 0;
      this.best = Math.max(Number(state.best) || 0, this.loadBest());
      this.state = ["ready", "running", "dead"].includes(state.state) ? state.state : "ready";
      this.paused = Boolean(state.paused);
      this.tickTimer = Number(state.tickTimer) || 0;
      this.dir = {
        x: Number(state.dir?.x) || 1,
        y: Number(state.dir?.y) || 0
      };
      this.turnQueue = Array.isArray(state.turnQueue) ? state.turnQueue.slice(0, 2).map((turn) => ({
        x: clamp(Number(turn.x) || 0, -1, 1),
        y: clamp(Number(turn.y) || 0, -1, 1)
      })) : [];
      this.growth = Number(state.growth) || 0;
      this.sparksStored = Number(state.sparksStored) || 0;
      this.snake = Array.isArray(state.snake) && state.snake.length > 0 ? state.snake.map((part) => ({
        x: clamp(Number(part.x) || 0, 0, this.cols() - 1),
        y: clamp(Number(part.y) || 0, 0, this.rows() - 1),
        pulse: Number(part.pulse) || 0
      })) : this.snake;
      this.fruits = Array.isArray(state.fruits) ? state.fruits.map((fruit) => ({
        x: clamp(Number(fruit.x) || 0, 0, this.cols() - 1),
        y: clamp(Number(fruit.y) || 0, 0, this.rows() - 1),
        bonus: Boolean(fruit.bonus),
        pulse: Number(fruit.pulse) || 0
      })) : [];
      this.sparkPickups = Array.isArray(state.sparkPickups) ? state.sparkPickups.map((spark) => ({
        x: clamp(Number(spark.x) || 0, 0, this.cols() - 1),
        y: clamp(Number(spark.y) || 0, 0, this.rows() - 1),
        pulse: Number(spark.pulse) || 0
      })) : [];
      const rawBlocks = Array.isArray(state.blocks) ? state.blocks : Array.isArray(state.pods) ? state.pods : [];
      this.blocks = rawBlocks.map((block) => ({
        x: clamp(Number(block.x) || 0, 0, this.cols() - 1),
        y: clamp(Number(block.y) || 0, 0, this.rows() - 1),
        wobble: Number(block.wobble) || 0,
        pulse: Number(block.pulse) || 0
      }));
      this.headTrail = [];
      this.chargePulse = 0;
      this.breakerFlash = 0;
      this.syncPotentialBoard();
      while (this.fruits.length < 1) this.spawnFruit();
      this.saveBest();
    }
  }

  class App {
    constructor() {
      this.canvas = document.getElementById("gameCanvas");
      this.ctx = this.canvas.getContext("2d");
      this.storageKey = "juicy-classics-state-v2";
      this.juice = cloneJuiceSettings();
      this.sharedScalarMemory = {};
      this.fx = new JuiceFX();
      this.fx.setSettings(this.juice);
      this.games = {
        tetris: new JuicyTetris(this.fx),
        flappy: new JuicyFlappy(this.fx),
        pong: new JuicyPong(this.fx),
        dino: new JuicyDino(this.fx),
        breakout: new JuicyBreakout(this.fx),
        snake: new JuicySnake(this.fx)
      };
      this.active = this.games.flappy;
      this.last = performance.now();
      this.saveTimer = 0;
      this.hintAge = 0;
      this.canvasGesture = null;
      this.metricCache = new Map();
      this.bindUI();
      this.restoreState();
      this.normalizeSharedScalars();
      this.rememberSharedScalarValues();
      this.switchGame(this.active.name, false);
      this.resize();
      window.addEventListener("resize", () => this.resize());
      requestAnimationFrame((time) => this.loop(time));
    }

    bindUI() {
      this.scoreMetric = document.getElementById("scoreMetric");
      this.middleMetricLabel = document.getElementById("middleMetricLabel");
      this.middleMetric = document.getElementById("middleMetric");
      this.lowerMetricLabel = document.getElementById("lowerMetricLabel");
      this.lowerMetric = document.getElementById("lowerMetric");
      this.pauseButton = document.getElementById("pauseButton");
      this.resetButton = document.getElementById("resetButton");
      this.juiceLab = document.getElementById("juiceLab");
      this.tetrisControls = document.getElementById("tetrisControls");
      this.flappyControls = document.getElementById("flappyControls");
      this.pongControls = document.getElementById("pongControls");
      this.dinoControls = document.getElementById("dinoControls");
      this.breakoutControls = document.getElementById("breakoutControls");
      this.snakeControls = document.getElementById("snakeControls");
      this.activeTooltipTrigger = null;
      this.floatingTooltip = document.createElement("div");
      this.floatingTooltip.className = "floating-tooltip";
      this.floatingTooltip.setAttribute("role", "tooltip");
      document.body.appendChild(this.floatingTooltip);

      document.querySelectorAll("[data-game]").forEach((button) => {
        button.addEventListener("click", () => this.switchGame(button.dataset.game));
      });

      document.querySelectorAll("[data-input]").forEach((button) => {
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          if (["charge", "dino-jump", "dino-duck", "breakout-charge"].includes(button.dataset.input)) {
            button.setPointerCapture?.(event.pointerId);
            this.sendInput(`${button.dataset.input}-start`);
          } else {
            this.sendInput(button.dataset.input);
          }
        });
        button.addEventListener("pointerup", (event) => {
          if (!["charge", "dino-jump", "dino-duck", "breakout-charge"].includes(button.dataset.input)) return;
          event.preventDefault();
          this.sendInput(`${button.dataset.input}-end`);
        });
        button.addEventListener("pointercancel", () => {
          if (["charge", "dino-jump", "dino-duck", "breakout-charge"].includes(button.dataset.input)) this.sendInput(`${button.dataset.input}-end`);
        });
      });

      this.pauseButton.addEventListener("click", () => this.togglePause());
      this.resetButton.addEventListener("click", () => this.resetActive());

      this.canvas.addEventListener("pointerdown", (event) => this.handleCanvasPointerDown(event));
      this.canvas.addEventListener("pointermove", (event) => this.handleCanvasPointerMove(event));
      this.canvas.addEventListener("pointerup", (event) => this.handleCanvasPointerUp(event));
      this.canvas.addEventListener("pointercancel", (event) => this.cancelCanvasGesture(event));

      window.addEventListener("keydown", (event) => this.handleKey(event));
      window.addEventListener("keyup", (event) => this.handleKeyUp(event));
      window.addEventListener("resize", () => this.positionFloatingTooltip());
      window.addEventListener("scroll", () => this.positionFloatingTooltip(), true);
      document.addEventListener("pointerdown", (event) => {
        if (!event.target.closest?.(".control-info")) this.hideFloatingTooltip();
      });
    }

    renderJuicePanel() {
      this.juiceLab.textContent = "";

      const head = document.createElement("div");
      head.className = "lab-head";

      const title = document.createElement("div");
      title.className = "lab-title";
      title.innerHTML = `<strong>Juice Lab</strong><span class="lab-kicker">${this.active.name}</span>`;
      head.appendChild(title);

      const presets = document.createElement("div");
      presets.className = "lab-presets";
      [
        ["all", "All On"],
        ["dry", "Dry"],
        ["default", "Default"]
      ].forEach(([preset, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => this.setJuicePreset(preset));
        presets.appendChild(button);
      });
      head.appendChild(presets);
      this.juiceLab.appendChild(head);

      const body = document.createElement("div");
      body.className = "lab-body";
      this.juiceLab.appendChild(body);

      const main = document.createElement("section");
      main.className = "lab-main";
      body.appendChild(main);

      this.renderJuiceGroup(main, "shared", { onlyMain: true });
      this.renderJuiceGroup(body, "shared", { title: "Global advanced", collapsible: true, skipMain: true });
      this.renderJuiceGroup(body, this.active.name, { collapsible: true });
      this.renderJuiceGroup(body, `${this.active.name}Potential`, { collapsible: true });
      this.refreshDependentControls();
    }

    renderJuiceGroup(parent, scope, options = {}) {
      const schema = JUICE_SCHEMA[scope];
      if (!schema) return;
      const controls = schema.controls.filter((control) => {
        if (options.onlyMain) return control.main;
        if (options.skipMain) return !control.main;
        return true;
      });
      if (controls.length === 0) return;

      const group = document.createElement("section");
      group.className = "lab-group";

      if (!options.onlyMain && !options.collapsible) {
        const title = document.createElement("h2");
        title.className = "lab-group-title";
        title.textContent = options.title || schema.title;
        group.appendChild(title);
      }

      for (const control of controls) {
        group.appendChild(this.renderJuiceControl(scope, control));
      }

      if (options.collapsible) {
        const details = document.createElement("details");
        details.className = "lab-details";
        details.open = Boolean(options.open);
        const summary = document.createElement("summary");
        summary.textContent = options.title || schema.title;
        details.append(summary, group);
        parent.appendChild(details);
      } else {
        parent.appendChild(group);
      }
    }

    renderJuiceControl(scope, control) {
      const row = document.createElement("label");
      row.className = `juice-row ${control.type === "toggle" ? "toggle-row" : "range-row"}`;
      row.dataset.scope = scope;
      row.dataset.key = control.key;

      if (control.type === "toggle") {
        const switchWrap = document.createElement("span");
        switchWrap.className = "switch";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = Boolean(this.juice[scope][control.key]);
        input.addEventListener("change", () => {
          this.juice[scope][control.key] = input.checked;
          if (scope === "shared") this.syncSharedToggleState(control.key, input.checked);
          this.applyJuiceSettings();
          this.refreshDependentControls();
        });
        const track = document.createElement("span");
        track.className = "switch-track";
        switchWrap.append(input, track);
        row.append(this.renderControlName(scope, control), switchWrap);
      } else {
        const head = document.createElement("span");
        head.className = "range-head";

        const value = document.createElement("span");
        value.className = "range-value";
        value.textContent = this.formatRangeValue(this.juice[scope][control.key]);
        head.append(this.renderControlName(scope, control), value);

        const input = document.createElement("input");
        input.type = "range";
        input.min = String(control.min);
        input.max = String(control.max);
        input.step = String(control.step);
        input.value = String(this.juice[scope][control.key]);
        const guardKey = scope === "shared" ? SHARED_RANGE_GUARDS[control.key] : null;
        if (guardKey) {
          row.dataset.guard = guardKey;
          const hidden = !this.juice.shared[guardKey];
          row.hidden = hidden;
          input.disabled = hidden;
        }
        input.addEventListener("input", () => {
          this.juice[scope][control.key] = Number(input.value);
          if (scope === "shared" && this.juice[scope][control.key] > 0) {
            this.sharedScalarMemory[control.key] = this.juice[scope][control.key];
          }
          value.textContent = this.formatRangeValue(this.juice[scope][control.key]);
          this.applyJuiceSettings();
        });
        row.append(head, input);
      }

      return row;
    }

    renderControlName(scope, control) {
      const wrap = document.createElement("span");
      wrap.className = "control-name-wrap";

      const name = document.createElement("span");
      name.className = "control-name";
      name.textContent = control.label;

      const info = document.createElement("span");
      info.className = "control-info";
      info.tabIndex = 0;
      const helpText = this.controlHelpText(scope, control);
      info.setAttribute("aria-label", `${control.label}: ${helpText}`);
      info.textContent = "i";
      info.addEventListener("pointerenter", () => this.showFloatingTooltip(info, helpText));
      info.addEventListener("pointerleave", () => this.hideFloatingTooltip(info));
      info.addEventListener("focus", () => this.showFloatingTooltip(info, helpText));
      info.addEventListener("blur", () => this.hideFloatingTooltip(info));
      info.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.showFloatingTooltip(info, helpText);
        info.focus({ preventScroll: true });
      });

      wrap.append(name, info);
      return wrap;
    }

    showFloatingTooltip(trigger, text) {
      this.activeTooltipTrigger?.classList.remove("is-open");
      this.activeTooltipTrigger = trigger;
      trigger.classList.add("is-open");
      this.floatingTooltip.textContent = text;
      this.floatingTooltip.classList.add("is-visible");
      this.positionFloatingTooltip();
    }

    hideFloatingTooltip(trigger = null) {
      if (trigger && this.activeTooltipTrigger !== trigger) return;
      this.activeTooltipTrigger?.classList.remove("is-open");
      this.activeTooltipTrigger = null;
      this.floatingTooltip.classList.remove("is-visible");
    }

    positionFloatingTooltip() {
      if (!this.activeTooltipTrigger || !this.floatingTooltip.classList.contains("is-visible")) return;
      const trigger = this.activeTooltipTrigger.getBoundingClientRect();
      const tip = this.floatingTooltip.getBoundingClientRect();
      const gap = 10;
      const margin = 10;
      let left = trigger.left + trigger.width / 2 - tip.width / 2;
      let top = trigger.top - tip.height - gap;

      if (top < margin) top = trigger.bottom + gap;
      left = clamp(left, margin, window.innerWidth - tip.width - margin);
      top = clamp(top, margin, window.innerHeight - tip.height - margin);

      this.floatingTooltip.style.left = `${left}px`;
      this.floatingTooltip.style.top = `${top}px`;
    }

    controlHelpText(scope, control) {
      return CONTROL_HELP[scope]?.[control.key]
        || CONTROL_HELP.byKey[control.key]
        || `${control.label} changes this part of the active juice system.`;
    }

    formatRangeValue(value) {
      return Number(value).toFixed(2).replace(/\.?0+$/, "");
    }

    rememberSharedScalarValues() {
      for (const rangeKey of Object.keys(SHARED_RANGE_GUARDS)) {
        if (!(rangeKey in this.sharedScalarMemory)) {
          this.sharedScalarMemory[rangeKey] = DEFAULT_JUICE.shared[rangeKey];
        }
        const current = this.juice.shared?.[rangeKey];
        if (typeof current === "number" && current > 0) {
          this.sharedScalarMemory[rangeKey] = current;
        }
      }
    }

    normalizeSharedScalars() {
      this.rememberSharedScalarValues();
      for (const [rangeKey, toggleKey] of Object.entries(SHARED_RANGE_GUARDS)) {
        if (!this.juice.shared?.[toggleKey]) continue;
        const current = this.juice.shared[rangeKey];
        if (typeof current === "number" && current > 0) continue;
        this.juice.shared[rangeKey] = this.sharedScalarMemory[rangeKey] ?? DEFAULT_JUICE.shared[rangeKey];
      }
      this.rememberSharedScalarValues();
    }

    syncSharedToggleState(toggleKey, enabled) {
      const dependents = SHARED_TOGGLE_DEPENDENTS[toggleKey];
      if (!dependents) return;
      if (!enabled) {
        this.rememberSharedScalarValues();
        return;
      }
      for (const rangeKey of dependents) {
        const current = this.juice.shared[rangeKey];
        if (typeof current === "number" && current > 0) continue;
        this.juice.shared[rangeKey] = this.sharedScalarMemory[rangeKey] ?? DEFAULT_JUICE.shared[rangeKey];
      }
      this.rememberSharedScalarValues();
    }

    refreshDependentControls() {
      if (!this.juiceLab) return;
      for (const row of this.juiceLab.querySelectorAll(".juice-row[data-guard]")) {
        const guardKey = row.dataset.guard;
        const rangeKey = row.dataset.key;
        const hidden = !this.juice.shared?.[guardKey];
        row.hidden = hidden;
        const input = row.querySelector("input");
        if (input) {
          input.disabled = hidden;
          input.value = String(this.juice.shared?.[rangeKey] ?? DEFAULT_JUICE.shared[rangeKey]);
        }
        const value = row.querySelector(".range-value");
        if (value) value.textContent = this.formatRangeValue(this.juice.shared?.[rangeKey] ?? DEFAULT_JUICE.shared[rangeKey]);
      }
    }

    setJuicePreset(preset) {
      if (preset === "dry") {
        this.juice = makeDrySettings();
      } else {
        this.juice = cloneJuiceSettings();
        if (preset === "all") {
          for (const section of Object.values(this.juice)) {
            for (const key of Object.keys(section)) {
              if (typeof section[key] === "boolean") section[key] = true;
            }
          }
          this.juice.shared.intensity = 1;
          this.juice.shared.particleAmount = 1.3;
          this.juice.shared.shakePower = 1.2;
          this.juice.shared.freezePower = 1;
          this.juice.shared.soundVolume = 0.8;
        }
      }
      this.fx.clear();
      this.normalizeSharedScalars();
      this.applyJuiceSettings();
      this.renderJuicePanel();
      this.saveState();
    }

    applyJuiceSettings() {
      this.normalizeSharedScalars();
      this.fx.setSettings(this.juice);
      this.refreshDependentControls();
      this.saveState();
    }

    saveState() {
      try {
        const games = {};
        for (const [name, game] of Object.entries(this.games)) {
          if (typeof game.serialize === "function") games[name] = game.serialize();
        }
        window.localStorage.setItem(this.storageKey, JSON.stringify({
          active: this.active.name,
          juice: this.juice,
          games
        }));
      } catch {
        // Local storage can be unavailable in private or locked-down browser modes.
      }
    }

    restoreState() {
      try {
        const raw = window.localStorage.getItem(this.storageKey);
        if (!raw) return;
        const saved = JSON.parse(raw);
        this.juice = mergeJuiceSettings(saved.juice);
        this.fx.setSettings(this.juice);
        if (saved.games && typeof saved.games === "object") {
          for (const [name, state] of Object.entries(saved.games)) {
            if (this.games[name] && typeof this.games[name].deserialize === "function") {
              this.games[name].deserialize(state);
            }
          }
        }
        if (this.games[saved.active]) this.active = this.games[saved.active];
      } catch {
        this.juice = cloneJuiceSettings();
        this.fx.setSettings(this.juice);
        this.active = this.games.flappy;
      }
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(STAGE_W * dpr);
      this.canvas.height = Math.round(STAGE_H * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    switchGame(name, persist = true) {
      if (!this.games[name]) return;
      this.active = this.games[name];
      this.fx.clear();
      document.querySelectorAll("[data-game]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.game === name);
      });
      this.tetrisControls.classList.toggle("is-hidden", name !== "tetris");
      this.flappyControls.classList.toggle("is-hidden", name !== "flappy");
      this.pongControls.classList.toggle("is-hidden", name !== "pong");
      this.dinoControls.classList.toggle("is-hidden", name !== "dino");
      this.breakoutControls.classList.toggle("is-hidden", name !== "breakout");
      this.snakeControls.classList.toggle("is-hidden", name !== "snake");
      document.body.dataset.activeGame = name;
      this.pauseButton.textContent = this.active.paused ? "Run" : "Pause";
      this.renderJuicePanel();
      this.hintAge = 0;
      this.canvasGesture = null;
      if (persist) this.saveState();
    }

    resetActive() {
      this.fx.clear();
      this.active.reset();
      this.pauseButton.textContent = "Pause";
      this.hintAge = 0;
      this.saveState();
    }

    togglePause() {
      this.active.paused = !this.active.paused;
      this.pauseButton.textContent = this.active.paused ? "Run" : "Pause";
      this.saveState();
    }

    canvasPoint(event) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: clamp(((event.clientX - rect.left) / rect.width) * STAGE_W, 0, STAGE_W),
        y: clamp(((event.clientY - rect.top) / rect.height) * STAGE_H, 0, STAGE_H)
      };
    }

    handleSnakeSwipe(gesture, point) {
      const dx = point.x - gesture.startX;
      const dy = point.y - gesture.startY;
      if (Math.abs(dx) < 44 && Math.abs(dy) < 44) return;
      gesture.swiped = true;
      gesture.startX = point.x;
      gesture.startY = point.y;

      if (Math.abs(dx) > Math.abs(dy)) {
        this.sendInput(dx > 0 ? "snake-right" : "snake-left");
      } else {
        this.sendInput(dy > 0 ? "snake-down" : "snake-up");
      }
    }

    handleCanvasPointerDown(event) {
      event.preventDefault();
      this.canvas.setPointerCapture?.(event.pointerId);
      const point = this.canvasPoint(event);
      this.canvasGesture = {
        id: event.pointerId,
        game: this.active.name,
        startX: point.x,
        startY: point.y,
        x: point.x,
        y: point.y,
        startedAt: performance.now(),
        mode: null
      };

      if (this.active.name === "flappy") {
        this.sendInput("flap");
        this.canvasGesture.mode = "flap";
      } else if (this.active.name === "pong") {
        this.canvasGesture.mode = "pong";
        this.games.pong.setPlayerY(point.y);
        this.sendInput("charge-start");
      } else if (this.active.name === "dino") {
        const mode = point.y > STAGE_H * 0.58 ? "dino-duck" : "dino-jump";
        this.canvasGesture.mode = mode;
        this.sendInput(`${mode}-start`);
      } else if (this.active.name === "breakout") {
        this.canvasGesture.mode = "breakout";
        this.games.breakout.setPaddleX(point.x);
        this.sendInput("breakout-charge-start");
      } else if (this.active.name === "snake") {
        this.canvasGesture.mode = "snake";
        this.canvasGesture.swiped = false;
      } else if (this.active.name === "tetris") {
        this.canvasGesture.mode = "tetris";
      }
    }

    handleCanvasPointerMove(event) {
      if (!this.canvasGesture || this.canvasGesture.id !== event.pointerId) return;
      event.preventDefault();
      const point = this.canvasPoint(event);
      this.canvasGesture.x = point.x;
      this.canvasGesture.y = point.y;

      if (this.canvasGesture.game === "pong") {
        this.games.pong.setPlayerY(point.y);
      }

      if (this.canvasGesture.game === "breakout") {
        this.games.breakout.setPaddleX(point.x);
      }

      if (this.canvasGesture.game === "snake") {
        this.handleSnakeSwipe(this.canvasGesture, point);
      }

      if (this.canvasGesture.game === "dino") {
        const dy = point.y - this.canvasGesture.startY;
        if (this.canvasGesture.mode === "dino-jump" && (dy > 80 || point.y > STAGE_H * 0.62)) {
          this.sendInput("dino-jump-end");
          this.sendInput("dino-duck-start");
          this.canvasGesture.mode = "dino-duck";
        } else if (this.canvasGesture.mode === "dino-duck" && dy < -95) {
          this.sendInput("dino-duck-end");
          this.sendInput("dino-jump-start");
          this.canvasGesture.mode = "dino-jump";
        }
      }
    }

    handleCanvasPointerUp(event) {
      if (!this.canvasGesture || this.canvasGesture.id !== event.pointerId) return;
      event.preventDefault();
      const gesture = this.canvasGesture;
      const point = this.canvasPoint(event);
      this.canvasGesture = null;

      if (gesture.game === "pong") {
        this.games.pong.setPlayerY(point.y);
        this.sendInput("charge-end");
      } else if (gesture.game === "dino") {
        this.sendInput(`${gesture.mode || "dino-jump"}-end`);
      } else if (gesture.game === "breakout") {
        this.games.breakout.setPaddleX(point.x);
        this.sendInput("breakout-charge-end");
      } else if (gesture.game === "snake") {
      } else if (gesture.game === "tetris") {
        this.handleTetrisGesture(gesture, point);
      }
    }

    cancelCanvasGesture(event) {
      if (!this.canvasGesture || this.canvasGesture.id !== event.pointerId) return;
      const gesture = this.canvasGesture;
      this.canvasGesture = null;
      if (gesture.game === "pong") this.sendInput("charge-end");
      if (gesture.game === "dino" && gesture.mode) this.sendInput(`${gesture.mode}-end`);
      if (gesture.game === "breakout") this.sendInput("breakout-charge-end");
    }

    handleTetrisGesture(gesture, point) {
      const dx = point.x - gesture.startX;
      const dy = point.y - gesture.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const elapsed = Math.max(1, performance.now() - gesture.startedAt);
      const velocityY = dy / elapsed;

      if (absX < 38 && absY < 38) {
        this.sendInput("rotate");
        return;
      }

      if (absX > absY * 1.15) {
        const steps = clamp(Math.round(absX / 86), 1, 4);
        for (let i = 0; i < steps; i += 1) this.sendInput(dx > 0 ? "right" : "left");
        return;
      }

      if (dy > 0) {
        this.sendInput(dy > 150 || velocityY > 0.55 ? "drop" : "down");
      } else if (dy < -55) {
        this.sendInput("rotate");
      }
    }

    sendInput(input) {
      this.fx.unlockAudio();
      this.active.handleInput(input);
      this.updateStats();
      this.saveState();
    }

    handleKey(event) {
      const key = event.key;
      const handledKeys = ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "Shift", "w", "W", "a", "A", "s", "S", "d", "D", "x", "X", "p", "P", "Escape"];
      if (!handledKeys.includes(key)) return;
      event.preventDefault();

      if (key === "p" || key === "P" || key === "Escape") {
        this.togglePause();
        return;
      }

      if (this.active.name === "tetris") {
        if (key === "ArrowLeft" || key === "a" || key === "A") this.sendInput("left");
        if (key === "ArrowRight" || key === "d" || key === "D") this.sendInput("right");
        if (key === "ArrowDown" || key === "s" || key === "S") this.sendInput("down");
        if (key === "ArrowUp" || key === "w" || key === "W" || key === "x" || key === "X") this.sendInput("rotate");
        if (key === " ") this.sendInput("drop");
      } else if (this.active.name === "pong") {
        if (key === "ArrowUp" || key === "w" || key === "W") this.sendInput("up");
        if (key === "ArrowDown" || key === "s" || key === "S") this.sendInput("down");
        if (key === " " || key === "Shift") {
          if (!event.repeat) this.sendInput("charge-start");
        }
      } else if (this.active.name === "dino") {
        if (key === " " || key === "ArrowUp" || key === "w" || key === "W") {
          if (!event.repeat) this.sendInput("dino-jump-start");
        }
        if (key === "ArrowDown" || key === "s" || key === "S" || key === "Shift") {
          if (!event.repeat) this.sendInput("dino-duck-start");
        }
      } else if (this.active.name === "breakout") {
        if (key === "ArrowLeft" || key === "a" || key === "A") this.sendInput("breakout-left");
        if (key === "ArrowRight" || key === "d" || key === "D") this.sendInput("breakout-right");
        if (key === " " || key === "ArrowUp" || key === "w" || key === "W" || key === "Shift") {
          if (!event.repeat) this.sendInput("breakout-charge-start");
        }
      } else if (this.active.name === "snake") {
        if (key === "ArrowLeft" || key === "a" || key === "A") this.sendInput("snake-left");
        if (key === "ArrowRight" || key === "d" || key === "D") this.sendInput("snake-right");
        if (key === "ArrowUp" || key === "w" || key === "W") this.sendInput("snake-up");
        if (key === "ArrowDown" || key === "s" || key === "S") this.sendInput("snake-down");
      } else {
        if (key === " " || key === "ArrowUp" || key === "w" || key === "W") this.sendInput("flap");
      }
    }

    handleKeyUp(event) {
      if (this.active.name === "pong") {
        if (event.key !== " " && event.key !== "Shift") return;
        event.preventDefault();
        this.sendInput("charge-end");
      }
      if (this.active.name === "dino") {
        if (event.key === " " || event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
          event.preventDefault();
          this.sendInput("dino-jump-end");
        }
        if (event.key === "ArrowDown" || event.key === "s" || event.key === "S" || event.key === "Shift") {
          event.preventDefault();
          this.sendInput("dino-duck-end");
        }
      }
      if (this.active.name === "breakout") {
        if (event.key !== " " && event.key !== "ArrowUp" && event.key !== "w" && event.key !== "W" && event.key !== "Shift") return;
        event.preventDefault();
        this.sendInput("breakout-charge-end");
      }
    }

    loop(time) {
      const realDt = clamp((time - this.last) / 1000, 0, 0.04);
      this.last = time;
      const gameDt = realDt * this.fx.gameScale();

      this.active.update(gameDt, realDt);
      this.fx.update(realDt);
      this.saveTimer += realDt;
      if (this.saveTimer > 0.75) {
        this.saveTimer = 0;
        this.saveState();
      }

      this.ctx.save();
      this.ctx.translate(this.fx.shakeX, this.fx.shakeY);
      this.active.draw(this.ctx);
      this.hintAge += realDt;
      this.drawTouchHint(this.ctx);
      this.ctx.restore();
      this.fx.draw(this.ctx);

      this.updateStats();
      requestAnimationFrame((nextTime) => this.loop(nextTime));
    }

    touchHintLines() {
      if (this.active.name === "tetris") return ["Tap to rotate. Swipe left or right to move.", "Swipe down to drop."];
      if (this.active.name === "pong") return ["Drag on the canvas to move the paddle.", "Hold, aim, and release to stretch the sling."];
      if (this.active.name === "dino") return ["Upper long press loads a jump.", "Lower press ducks or stomps. Swipe down to switch."];
      if (this.active.name === "breakout") return ["Drag to move the paddle.", "Hold, aim, and release to launch or charge."];
      if (this.active.name === "snake") return ["Swipe to steer the snake.", "Fill the body with sparks, then hit a block or wall to spend the charge."];
      return ["Tap anywhere to flap.", "Thread rubber bands to charge a shield."];
    }

    drawTouchHint(ctx) {
      const lifetime = 8;
      if (this.hintAge > lifetime) return;
      const fade = this.hintAge < 5.6 ? 1 : clamp((lifetime - this.hintAge) / 2.4, 0, 1);
      const lines = this.touchHintLines();
      const y = this.active.name === "tetris" ? STAGE_H - 150 : STAGE_H - 132;

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = "rgba(36,50,59,0.34)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "850 24px Avenir Next, Trebuchet MS, sans-serif";
      lines.forEach((line, index) => {
        ctx.fillText(line, STAGE_W / 2, y + index * 34);
      });
      ctx.restore();
    }

    setMetric(element, value) {
      const text = String(value);
      if (this.metricCache.get(element) === text) return;
      this.metricCache.set(element, text);
      element.textContent = text;
      const metric = element.closest(".metric");
      if (metric) {
        metric.classList.remove("is-pulsing");
        void metric.offsetWidth;
        metric.classList.add("is-pulsing");
      }
    }

    updateStats() {
      const stats = this.active.getStats();
      this.middleMetricLabel.textContent = stats.middleLabel;
      this.lowerMetricLabel.textContent = stats.lowerLabel;
      this.setMetric(this.scoreMetric, stats.score);
      this.setMetric(this.middleMetric, stats.middle);
      this.setMetric(this.lowerMetric, stats.lower);
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    window.juicyClassicsApp = new App();
  });
})();
