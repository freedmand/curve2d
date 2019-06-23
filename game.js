"use strict";
var canvas = document.getElementById('canvas');
var overlayCanvas = document.getElementById('canvas-overlay');
var context = canvas.getContext('2d');
var overlayContext = overlayCanvas.getContext('2d');
context.imageSmoothingEnabled = true;
var player1Score = document.getElementById('player1-score');
var player2Score = document.getElementById('player2-score');
var WIDTH = 400;
var HEIGHT = 400;
var PLAYER_RADIUS = 2;
var PLAYER_SPEED = 90; // px/s
var ANGULAR_SPEED = 3; // rad/s
canvas.width = WIDTH;
canvas.height = HEIGHT;
overlayCanvas.width = WIDTH;
overlayCanvas.height = HEIGHT;
var time = function () { return new Date().getTime() / 1000; };
var mod = function (a, b) {
    while (a < 0) {
        a += b;
    }
    return a % b;
};
var THREAD_TIME = 0.12;
var POISSON_RATE = 0.05;
var RANDOM_INTERVAL = 0.1; // 10 per second
var Player = /** @class */ (function () {
    function Player(color, leftKey, rightKey, scoreElem, x, y, angle) {
        this.color = color;
        this.leftKey = leftKey;
        this.rightKey = rightKey;
        this.scoreElem = scoreElem;
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.left = false;
        this.right = false;
        this.disabled = false;
        this.thread = false;
        this.timeSinceLastThread = 0;
        this.cumulativeThreadProb = 0;
        this.timeSinceLastRandom = 0;
        this.previousX = null;
        this.previousY = null;
    }
    Player.prototype.determineThread = function (deltaTime) {
        if (this.thread) {
            if (this.timeSinceLastThread > THREAD_TIME) {
                this.cumulativeThreadProb = 0;
                this.thread = false;
                this.timeSinceLastThread = 0;
                this.timeSinceLastRandom = 0;
            }
        }
        else {
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
    };
    Player.prototype.reset = function () {
        this.thread = false;
        this.disabled = false;
        this.timeSinceLastThread = 0;
        this.cumulativeThreadProb = 0;
        this.timeSinceLastRandom = 0;
        this.previousX = null;
        this.previousY = null;
    };
    return Player;
}());
var LEFT = 37;
var RIGHT = 39;
var Q = 81;
var W = 87;
var player1 = new Player('red', LEFT, RIGHT, player1Score, 300, 300, Math.PI);
var player2 = new Player('green', Q, W, player2Score, 100, 100, 0);
var players = [player1, player2];
addEventListener('keydown', function (e) {
    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        if (e.keyCode == player.leftKey) {
            player.left = true;
        }
        if (e.keyCode == player.rightKey) {
            player.right = true;
        }
    }
}, false);
addEventListener('keyup', function (e) {
    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        if (e.keyCode == player.leftKey) {
            player.left = false;
        }
        if (e.keyCode == player.rightKey) {
            player.right = false;
        }
    }
}, false);
var previousTime = time();
var resetTime = null;
var RESET_DURATION = 4;
var COLLISION_FACTOR = 4;
var DRAW_FACTOR = COLLISION_FACTOR * 0.8;
function updatePlayerPosition(player, deltaTime) {
    if (player.disabled)
        return;
    player.determineThread(deltaTime);
    // Handle key events
    if (player.left) {
        player.angle = mod(player.angle - ANGULAR_SPEED * deltaTime, Math.PI * 2);
    }
    else if (player.right) {
        player.angle = mod(player.angle + ANGULAR_SPEED * deltaTime, Math.PI * 2);
    }
    player.previousX = player.x;
    player.previousY = player.y;
    player.x += Math.cos(player.angle) * PLAYER_SPEED * deltaTime;
    player.y += Math.sin(player.angle) * PLAYER_SPEED * deltaTime;
    if (player.x >= WIDTH) {
        player.x -= WIDTH;
        player.previousX = player.x;
    }
    else if (player.x < 0) {
        player.x += WIDTH;
        player.previousX = player.x;
    }
    if (player.y >= HEIGHT) {
        player.y -= HEIGHT;
        player.previousY = player.y;
    }
    else if (player.y < 0) {
        player.y += HEIGHT;
        player.previousY = player.y;
    }
    player.drawX = player.x + Math.cos(player.angle) * DRAW_FACTOR;
    player.drawY = player.y + Math.sin(player.angle) * DRAW_FACTOR;
    if (!player.thread) {
        var collisionX = player.x + Math.cos(player.angle) * COLLISION_FACTOR;
        var collisionY = player.y + Math.sin(player.angle) * COLLISION_FACTOR;
        var colorValue = context.getImageData(collisionX, collisionY, 1, 1).data;
        if (colorValue[0] != 0 || colorValue[1] != 0 || colorValue[2] != 0) {
            player.disabled = true;
            if (resetTime == null) {
                resetTime = time();
                if (player == player1) {
                    player2.scoreElem.textContent = "" + (parseInt(player2.scoreElem
                        .textContent) + 1);
                }
                if (player == player2) {
                    player1.scoreElem.textContent = "" + (parseInt(player1.scoreElem
                        .textContent) + 1);
                }
            }
        }
    }
}
var startOfGame = true;
function reset() {
    startOfGame = true;
    for (var i = 0; i < players.length; i++) {
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
    var currentTime = time();
    overlayContext.clearRect(0, 0, WIDTH, HEIGHT);
    if (resetTime != null && currentTime > resetTime + RESET_DURATION) {
        reset();
    }
    var deltaTime = currentTime - previousTime;
    if (startOfGame) {
        context.fillStyle = 'black';
        context.fillRect(0, 0, WIDTH, HEIGHT);
        startOfGame = false;
    }
    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        updatePlayerPosition(player, deltaTime);
        if (!player.thread) {
            if (player.previousX == null || player.previousY == null) {
                context.fillStyle = player.color;
                context.beginPath();
                context.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
                context.fill();
            }
            else {
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
    requestAnimationFrame(function () { return game(); });
}
game();
