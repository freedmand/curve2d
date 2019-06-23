const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const overlayCanvas = document.getElementById('canvas-overlay') as HTMLCanvasElement;
const context = canvas.getContext('2d') as CanvasRenderingContext2D;
const overlayContext = overlayCanvas.getContext('2d') as CanvasRenderingContext2D;
context.imageSmoothingEnabled = true;

const player1Score = document.getElementById('player1-score') as HTMLElement;
const player2Score = document.getElementById('player2-score') as HTMLElement;

const WIDTH = 400;
const HEIGHT = 400;

const PLAYER_RADIUS = 2;
const PLAYER_SPEED = 90; // px/s
const ANGULAR_SPEED = 3; // rad/s

canvas.width = WIDTH;
canvas.height = HEIGHT;
overlayCanvas.width = WIDTH;
overlayCanvas.height = HEIGHT;

const time = () => new Date().getTime() / 1000;
const mod = (a: number, b: number) => {
  while (a < 0) {
    a += b;
  }
  return a % b;
};

const THREAD_TIME = 0.12;
const POISSON_RATE = 0.05;
const RANDOM_INTERVAL = 0.1; // 10 per second

class Player {
  left = false;
  right = false;
  disabled = false;
  thread = false;
  timeSinceLastThread = 0;
  cumulativeThreadProb = 0;
  timeSinceLastRandom = 0;
  previousX: number | null = null;
  previousY: number | null = null;
  drawX!: number;
  drawY!: number;

  constructor(
    readonly color: string,
    readonly leftKey: number,
    readonly rightKey: number,
    readonly scoreElem: HTMLElement,
    public x: number,
    public y: number,
    public angle: number
  ) {}

  determineThread(deltaTime: number) {
    if (this.thread) {
      if (this.timeSinceLastThread > THREAD_TIME) {
        this.cumulativeThreadProb = 0;
        this.thread = false;
        this.timeSinceLastThread = 0;
        this.timeSinceLastRandom = 0;
      }
    } else {
      this.cumulativeThreadProb +=
        Math.exp(-POISSON_RATE * this.timeSinceLastThread) *
        POISSON_RATE *
        POISSON_RATE *
        this.timeSinceLastThread *
        deltaTime;
      if (Math.random() < this.cumulativeThreadProb) {
        this.thread = true;
        this.timeSinceLastThread = 0;
      }
    }
    this.timeSinceLastThread += deltaTime;
  }

  reset() {
    this.thread = false;
    this.disabled = false;
    this.timeSinceLastThread = 0;
    this.cumulativeThreadProb = 0;
    this.timeSinceLastRandom = 0;
    this.previousX = null;
    this.previousY = null;
  }
}

type position = [number, number];

const LEFT = 37;
const RIGHT = 39;
const Q = 81;
const W = 87;

const player1 = new Player('red', LEFT, RIGHT, player1Score, 300, 300, Math.PI);
const player2 = new Player('green', Q, W, player2Score, 100, 100, 0);
const players = [player1, player2];

addEventListener(
  'keydown',
  (e: KeyboardEvent) => {
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (e.keyCode == player.leftKey) {
        player.left = true;
      }
      if (e.keyCode == player.rightKey) {
        player.right = true;
      }
    }
  },
  false
);

addEventListener(
  'keyup',
  (e: KeyboardEvent) => {
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (e.keyCode == player.leftKey) {
        player.left = false;
      }
      if (e.keyCode == player.rightKey) {
        player.right = false;
      }
    }
  },
  false
);

let previousTime = time();
let resetTime: number | null = null;
const RESET_DURATION = 4;

const COLLISION_FACTOR = 4;
const DRAW_FACTOR = COLLISION_FACTOR * 0.8;

function updatePlayerPosition(player: Player, deltaTime: number) {
  if (player.disabled) return;

  player.determineThread(deltaTime);

  // Handle key events
  if (player.left) {
    player.angle = mod(player.angle - ANGULAR_SPEED * deltaTime, Math.PI * 2);
  } else if (player.right) {
    player.angle = mod(player.angle + ANGULAR_SPEED * deltaTime, Math.PI * 2);
  }

  player.previousX = player.x;
  player.previousY = player.y;
  player.x += Math.cos(player.angle) * PLAYER_SPEED * deltaTime;
  player.y += Math.sin(player.angle) * PLAYER_SPEED * deltaTime;

  if (player.x >= WIDTH) {
    player.x -= WIDTH;
    player.previousX = player.x;
  } else if (player.x < 0) {
    player.x += WIDTH;
    player.previousX = player.x;
  }
  if (player.y >= HEIGHT) {
    player.y -= HEIGHT;
    player.previousY = player.y;
  } else if (player.y < 0) {
    player.y += HEIGHT;
    player.previousY = player.y;
  }

  player.drawX = player.x + Math.cos(player.angle) * DRAW_FACTOR;
  player.drawY = player.y + Math.sin(player.angle) * DRAW_FACTOR;
  if (!player.thread) {
    const collisionX = player.x + Math.cos(player.angle) * COLLISION_FACTOR;
    const collisionY = player.y + Math.sin(player.angle) * COLLISION_FACTOR;

    const colorValue = context.getImageData(collisionX, collisionY, 1, 1).data;
    if (colorValue[0] != 0 || colorValue[1] != 0 || colorValue[2] != 0) {
      player.disabled = true;

      if (resetTime == null) {
        resetTime = time();
        if (player == player1) {
          player2.scoreElem.textContent = `${parseInt(player2.scoreElem
            .textContent as string) + 1}`;
        }
        if (player == player2) {
          player1.scoreElem.textContent = `${parseInt(player1.scoreElem
            .textContent as string) + 1}`;
        }
      }
    }
  }
}

let startOfGame = true;

function reset() {
  startOfGame = true;
  for (let i = 0; i < players.length; i++) {
    players[i].reset();
  }
  player1.x = 100;
  player1.y = 100;
  player1.angle = 0;

  player2.x = 300;
  player2.y = 300;
  player1.angle = Math.PI;

  resetTime = null;
}

reset();
function game() {
  const currentTime = time();
  overlayContext.clearRect(0, 0, WIDTH, HEIGHT);

  if (resetTime != null && currentTime > resetTime + RESET_DURATION) {
    reset();
  }
  const deltaTime = currentTime - previousTime;

  if (startOfGame) {
    context.fillStyle = 'black';
    context.fillRect(0, 0, WIDTH, HEIGHT);
    startOfGame = false;
  }

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    updatePlayerPosition(player, deltaTime);

    if (!player.thread) {
      if (player.previousX == null || player.previousY == null) {
        context.fillStyle = player.color;
        context.beginPath();
        context.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
        context.fill();
      } else {
        context.strokeStyle = player.color;
        context.lineWidth = PLAYER_RADIUS * 2;
        context.beginPath();
        context.moveTo(player.previousX, player.previousY);
        context.lineTo(player.drawX, player.drawY);
        context.stroke();
      }
    }
    // Draw yellow circle in overlay.
    overlayContext.fillStyle = 'yellow';
    overlayContext.beginPath();
    overlayContext.arc(player.drawX, player.drawY, PLAYER_RADIUS, 0, Math.PI * 2);
    overlayContext.fill();
  }

  previousTime = currentTime;
  requestAnimationFrame(() => game());
}

game();
