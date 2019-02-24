"use strict";

const defaultBoardRows = 25;
const defaultBoardCols = 25;
const defaultFrameSize = 3;
const defaultGridSize = 1;

const defaultPlayerSize = 20;
const defaultBoardWidth = 800;
const defaultBoardHeight = 800;
const defaultGameSpeedInMs = 500;

const defaultWinnerColor = 'green';
const defaultLoserColor = 'red';
const defaultDrawColor = 'yellow';

const defaultPlayerColor = 'black';
const defaultEnemyColor = 'red';

const defaultFrameColor = 'red';
const defaultGridColor = 'silver';

const directionEnum = { none: 0, left: 1, up: 2, right: 3, down: 4 };
const gameStateEnum = { none: 0, playing: 1, finished: 2 };
const playerGameResultEnum = { none: 0, winner: 1, loser: 2, draw: 3 };

class Player {
    constructor({ name }) {
        this.name = name;
        this.direction = directionEnum.none;
        this.lastMovedDirection = directionEnum.none;
        this.isPlaying = false;
        this.trail = null;
        this.gameResult = playerGameResultEnum.none;
    }

    init(boardPosition, direction) {
        this.gameResult = playerGameResultEnum.none;
        this.direction = directionEnum.none;
        this.lastMovedDirection = directionEnum.none;

        this.initTrail(boardPosition);
        this.setDirection(direction);

        this.isPlaying = this.direction !== directionEnum.none;
    }

    initTrail(boardPosition) {
        this.trail = [];
        this.trail.push(boardPosition);
    }

    setDirection(newDirection) {
        if (this.lastMovedDirection === newDirection) {
            return;
        }

        let changeDirection = false;

        switch (newDirection) {
            case directionEnum.left:
                changeDirection = this.lastMovedDirection !== directionEnum.right;
                break;
            case directionEnum.up:
                changeDirection = this.lastMovedDirection !== directionEnum.down;
                break;
            case directionEnum.right:
                changeDirection = this.lastMovedDirection !== directionEnum.left;
                break;
            case directionEnum.down:
                changeDirection = this.lastMovedDirection !== directionEnum.up;
                break;
        }

        if (changeDirection) {
            this.direction = newDirection;
        }
    }

    move() {
        if (!this.isPlaying) {
            return;
        }

        let lastPosition = this.trail[this.trail.length - 1];
        let x = lastPosition.col;
        let y = lastPosition.row;

        switch (this.direction) {
            case directionEnum.left:
                x--;
                break;
            case directionEnum.up:
                y--;
                break;
            case directionEnum.right:
                x++;
                break;
            case directionEnum.down:
                y++;
                break;
        }

        let newPosition = new BoardPosition(x, y);

        this.trail.push(newPosition);
        this.lastMovedDirection = this.direction;
    }

    undoMove() {
        this.trail.pop();
    }

    setGameResult(gameResult) {
        this.isPlaying = false;
        this.gameResult = gameResult;
    }
}

class PlayerLayer {
    constructor({ playerModel, boardLayer, color, size = defaultPlayerSize }) {
        this.playerModel = playerModel;
        this.boardLayer = boardLayer;
        this.size = size;
        this.color = color;
    }

    draw(ctx) {
        let playerModel = this.playerModel;

        if (playerModel.trail.length === 0) {
            return;
        }

        if (playerModel.gameResult !== playerGameResultEnum.none) {
            this.drawGameResult(ctx);
        }

        let boardLayer = this.boardLayer;
        let squareXOffset = (boardLayer.squareWidth - this.size) / 2;
        let squareYOffset = (boardLayer.squareHeight - this.size) / 2;
        let xOffset = boardLayer.xOffset + squareXOffset;
        let yOffset = boardLayer.yOffset + squareYOffset;

        let trail = playerModel.trail;

        ctx.fillStyle = this.color;

        for (let i = 0; i < trail.length; i++) {
            let row = trail[i].row;
            let col = trail[i].col;
            let x = xOffset + col * boardLayer.squareWidth;
            let y = yOffset + row * boardLayer.squareHeight;

            ctx.fillRect(x, y, this.size, this.size);
        }
    }

    drawGameResult(ctx) {
        let trail = this.playerModel.trail;
        let row = trail[trail.length - 1].row;
        let col = trail[trail.length - 1].col;

        let boardLayer = this.boardLayer;
        let x = boardLayer.xOffset + col * boardLayer.squareWidth;
        let y = boardLayer.yOffset + row * boardLayer.squareHeight;

        switch (this.playerModel.gameResult) {
            case playerGameResultEnum.loser:
                ctx.fillStyle = defaultLoserColor;
                break;
            case playerGameResultEnum.draw:
                ctx.fillStyle = defaultDrawColor;
                break;
            case playerGameResultEnum.winner:
                ctx.fillStyle = defaultWinnerColor;
                break;
        }

        ctx.fillRect(x, y, boardLayer.squareWidth, boardLayer.squareHeight);
    }
}

class Collision {
    constructor(player) {
        this.player = player;
    }
}

class CollisionDetection {
    constructor(collisionDetectors) {
        this.collisionDetectors = collisionDetectors;
    }

    detect(activePlayers) {
        let collisions = [];

        for (let i = 0; i < activePlayers.length; i++) {
            if (this.detectCollisionForPlayer(activePlayers[i])) {
                collisions.push(new Collision(player));
            }
        }

        return collisions;
    }

    detectCollisionForPlayer(player) {
        for (let i = 0; i < this.collisionDetectors.length; i++) {
            if (this.collisionDetectors[i].detect(player)) {
                return true;
            }
        }

        return false;
    }
}

class BoardCollisionDetection {
    constructor(board) {
        this.board = board;
    }

    detect(player) {
        let head = player.trail[player.trail.length - 1];
        return !this.board.isPositionInside(head);
    }
}

class PlayerCollisionDetection {
    constructor(players) {
        this.players = players;
    }

    detect(player) {
        let head = player.trail[player.trail.length - 1];

        if (this.detectTrailCollision(head, player.trail, player.trail.length - 2)) {
            return true;
        }

        for (let i = 0; i < this.players.length; i++) {
            if (this.players[i] !== player &&
                this.detectTrailCollision(head, this.players[i].trail, this.players[i].trail.length - 1)) {
                return true;
            }
        }

        return false;
    }

    detectTrailCollision(pos, trail, length) {
        for (let i = 0; i < length; i++) {
            if (trail[i].col === pos.col && trail[i].row === pos.row) {
                return true;
            }
        }

        return false;
    }
}

class BoardPosition {
    constructor(col, row) {
        this.col = col;
        this.row = row;
    }
}

class Board {
    constructor({ cols = defaultBoardCols, rows = defaultBoardRows }) {
        this.cols = cols;
        this.rows = rows;
    }

    isPositionInside(boardPosition) {
        let isPositionInside = boardPosition.col >= 0 && boardPosition.col <= this.cols - 1 &&
            boardPosition.row >= 0 && boardPosition.row <= this.rows - 1;

        return isPositionInside;
    }
}

class BoardLayer {
    constructor({ boardModel, width, height,
        isFrameVisible = true, isGridVisible = true,
        frameSize = defaultFrameSize, gridSize = defaultGridSize,
        frameColor = defaultFrameColor, gridColor = defaultGridColor }) {

        this.boardModel = boardModel;

        this.width = width;
        this.height = height;

        this.isFrameVisible = isFrameVisible;
        this.isGridVisible = isGridVisible;

        this.frameSize = frameSize;
        this.gridSize = gridSize;

        this.frameColor = frameColor;
        this.gridColor = gridColor;

        this.setDimensions();
    }

    setDimensions() {
        const boardModel = this.boardModel;

        const frameSize = this.isFrameVisible ? this.frameSize : 0;

        this.clientWidth = this.width - 2 * frameSize;
        this.clientHeight = this.height - 2 * frameSize;

        this.xPadding = (this.clientWidth % boardModel.cols) / 2;
        this.yPadding = (this.clientHeight % boardModel.rows) / 2;

        this.squareWidth = Math.floor(this.clientWidth / boardModel.cols);
        this.squareHeight = Math.floor(this.clientHeight / boardModel.rows);

        this.xOffset = this.xPadding + frameSize;
        this.yOffset = this.yPadding + frameSize;
    }

    draw(ctx) {
        let boardModel = this.boardModel;
        const frameSize = this.isFrameVisible ? this.frameSize : 0;

        const height = this.clientHeight - this.yPadding + frameSize;
        const width = this.clientWidth - this.xPadding + frameSize;

        if (this.isGridVisible && this.gridSize > 0) {
            ctx.lineWidth = this.gridSize;
            ctx.strokeStyle = this.gridColor;
            ctx.beginPath();

            for (let i = 0; i <= boardModel.cols; i++) {
                let x = this.xOffset + i * this.squareWidth;
                ctx.moveTo(x, this.yOffset);
                ctx.lineTo(x, height);
            }

            for (let i = 0; i <= boardModel.rows; i++) {
                let y = this.yOffset + i * this.squareHeight;
                ctx.moveTo(this.xOffset, y);
                ctx.lineTo(width, y);
            }

            ctx.closePath();
            ctx.stroke();
        }

        if (frameSize > 0) {
            ctx.lineWidth = this.frameSize;
            ctx.strokeStyle = this.frameColor;
            ctx.beginPath();

            ctx.moveTo(this.xOffset, this.yOffset);
            ctx.lineTo(width, this.yOffset);
            ctx.lineTo(width, height);
            ctx.lineTo(this.xOffset, height);

            ctx.closePath();
            ctx.stroke();
        }
    }
}

class TronModel {
    constructor({ boardModel, playerModels }) {
        this.boardModel = boardModel;
        this.playerModels = playerModels;
    }
}

class TronLayer {
    constructor({ boardLayer, playerLayers }) {
        this.boardLayer = boardLayer;
        this.playerLayers = playerLayers;
    }

    draw(ctx, state) {
        ctx.clearRect(0, 0, this.boardLayer.width, this.boardLayer.height);

        this.boardLayer.draw(ctx);

        if (state === gameStateEnum.playing || state === gameStateEnum.finished) {
            for (let i = 0; i < this.playerLayers.length; i++) {
                this.playerLayers[i].draw(ctx);
            }
        }
    }
}

class TronGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');

        let boardModel = new Board({});
        let boardLayer = new BoardLayer({ boardModel: boardModel, width: this.canvas.width, height: this.canvas.height });

        this.model = new TronModel({ boardModel: boardModel, playerModels: [] });
        this.layer = new TronLayer({ boardLayer: boardLayer, playerLayers: [] });

        this.state = gameStateEnum.none;

        this.engineTimer = null;

        this.collisionDetection = new CollisionDetection([
            new BoardCollisionDetection(this.model.boardModel),
            new PlayerCollisionDetection(this.model.playerModels)]);

        this.invalidate();
    }

    addPlayer(name, color = defaultPlayerColor) {
        let model = new Player({ name: name });
        let layer = new PlayerLayer({ playerModel: model, boardLayer: this.layer.boardLayer, color: color });

        // TEMP
        let x = Math.floor(this.model.boardModel.cols / 2);
        let y = Math.floor(this.model.boardModel.rows - 1);
        let position = new BoardPosition(x, y);
        model.init(position, directionEnum.up);

        this.model.playerModels.push(model);
        this.layer.playerLayers.push(layer);

        this.invalidate();

        return model;
    }

    findPlayerIndex(name) {
        return this.model.playerModels.findIndex(p => p.name === name);
    }

    removePlayer(name) {
        var index = this.findPlayerIndex(name);
        if (index > -1) {
            this.model.playerModels.splice(index, 1);
            this.layer.playerLayers.splice(index, 1);
            this.invalidate();
        }
    }

    start() {
        this.state = gameStateEnum.playing;
        this.invalidate();
        this.engineTimer = setInterval(() => this.engine(), defaultGameSpeedInMs);
    }

    stop() {
        clearInterval(this.engineTimer);
        this.engineTimer = null;

        this.state = gameStateEnum.finished;
        this.invalidate();
    }

    engine() {
        let players = this.model.playerModels;
        let activePlayers = players.filter(p => p.isPlaying);

        for (let i = 0; i < activePlayers.length; i++) {
            activePlayers[i].move();
        }

        let collisions = this.collisionDetection.detect(activePlayers);

        if (collisions.length > 0) {
            let isDraw = collisions.length === players.length;
            let gameResult = isDraw ? playerGameResultEnum.draw : playerGameResultEnum.loser;

            for (let i = 0; i < collisions.length; i++) {
                let player = collisions[i].player;
                player.setGameResult(gameResult);
                player.undoMove();
            }

            if (!isDraw && collisions.length === players.length - 1) {
                for (let i = 0; i < players.length; i++) {
                    if (players[i].isPlaying) {
                        players[i].setGameResult(playerGameResultEnum.winner);
                    }
                }
            }
        }

        this.invalidate();
    }

    draw() {
        this.layer.draw(this.ctx, this.state);
    }

    invalidate() {
        this.draw();
    }

    setPlayerDirection(playerName, newDirection) {
        var index = this.findPlayerIndex(playerName);
        if (index > -1) {
            let player = this.model.playerModels[index];
            player.setDirection(newDirection);
        }
    }
}