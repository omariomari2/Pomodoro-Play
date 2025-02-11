const board = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const restartButton = document.getElementById('restartButton');
let currentPlayer = 'X';
let gameActive = true;
let gameState = ['', '', '', '', '', '', '', '', ''];

const winningConditions = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

function handleCellClick(event) {
    const clickedCell = event.target;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-index'));

    if (gameState[clickedCellIndex] !== '' || !gameActive || currentPlayer !== 'X') {
        return;
    }

    makeMove(clickedCellIndex);
}

function makeMove(index) {
    gameState[index] = currentPlayer;
    cells[index].textContent = currentPlayer;

    if (checkWin(gameState, currentPlayer)) {
        endGame(false);
        return;
    }

    if (!gameState.includes('')) {
        endGame(true);
        return;
    }

    currentPlayer = 'O';
    if (gameActive) {
        setTimeout(computerMove, 500);
    }
}

function computerMove() {
    const bestMove = findBestMove(gameState);
    gameState[bestMove] = 'O';
    cells[bestMove].textContent = 'O';

    if (checkWin(gameState, 'O')) {
        endGame(false);
        return;
    }

    if (!gameState.includes('')) {
        endGame(true);
        return;
    }

    currentPlayer = 'X';
}

function checkWin(board, player) {
    return winningConditions.some(condition => {
        return condition.every(index => {
            return board[index] === player;
        });
    });
}

function endGame(draw) {
    gameActive = false;
    if (draw) {
        alert("Game ended in a draw!");
    } else {
        alert(`Player ${currentPlayer} has won!`);
    }
}

function minimax(board, depth, isMaximizing) {
    const scores = {
        X: -1,
        O: 1,
        draw: 0
    };

    if (checkWin(board, 'O')) return scores.O;
    if (checkWin(board, 'X')) return scores.X;
    if (!board.includes('')) return scores.draw;

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < board.length; i++) {
            if (board[i] === '') {
                board[i] = 'O';
                let score = minimax(board, depth + 1, false);
                board[i] = '';
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < board.length; i++) {
            if (board[i] === '') {
                board[i] = 'X';
                let score = minimax(board, depth + 1, true);
                board[i] = '';
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
}

function findBestMove(board) {
    let bestScore = -Infinity;
    let bestMove = 0;

    for (let i = 0; i < board.length; i++) {
        if (board[i] === '') {
            board[i] = 'O';
            let score = minimax(board, 0, false);
            board[i] = '';
            if (score > bestScore) {
                bestScore = score;
                bestMove = i;
            }
        }
    }

    return bestMove;
}

function restartGame() {
    currentPlayer = 'X';
    gameActive = true;
    gameState = ['', '', '', '', '', '', '', '', ''];
    cells.forEach(cell => cell.textContent = '');
}

cells.forEach(cell => cell.addEventListener('click', handleCellClick));
restartButton.addEventListener('click', restartGame); 