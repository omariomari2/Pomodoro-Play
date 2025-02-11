const grid = [];
const scoreDisplay = document.getElementById("score");
const restartButton = document.getElementById("restart");
let gameOver = false;

let score = 0;

// Initialize the grid and add two random numbers
function initGame() {
    for (let i = 0; i < 16; i++) {
        grid[i] = 0;
    }
    // Clear the moving tile container and game-over overlay
    document.getElementById("tile-container").innerHTML = "";
    document.getElementById("game-over").style.display = "none";
    gameOver = false;
    addRandomTile();
    addRandomTile();
    updateTiles();
}

// Add a random tile (2 or 4) to an empty spot
function addRandomTile() {
    const emptyCells = [];
    for (let i = 0; i < 16; i++) {
        if (grid[i] === 0) emptyCells.push(i);
    }
    if (emptyCells.length > 0) {
        const randomIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        grid[randomIndex] = Math.random() < 0.9 ? 2 : 4;
    }
}

// Function to update the moving tiles display.
// It creates (or updates) an absolutely positioned .tile for each nonzero grid[i]
function updateTiles() {
    const tileContainer = document.getElementById("tile-container");
    // Remove any tile element whose grid cell became zero.
    const existingTiles = tileContainer.querySelectorAll(".tile");
    existingTiles.forEach(tile => {
        const index = parseInt(tile.getAttribute("data-index"));
        if (grid[index] === 0) {
            tile.remove();
        }
    });
    // For each nonzero cell, update the tile (or create it if it doesn't exist)
    for (let i = 0; i < 16; i++) {
        if (grid[i] !== 0) {
            let tile = tileContainer.querySelector(`.tile[data-index="${i}"]`);
            const row = Math.floor(i / 4);
            const col = i % 4;
            const gap = 10;
            const size = 100;
            const left = col * (size + gap);
            const top = row * (size + gap);
            if (tile) {
                // Update the tile's displayed value, background, and position.
                tile.innerHTML = grid[i];
                tile.style.backgroundColor = getTileColor(grid[i]);
                tile.style.left = left + "px";
                tile.style.top = top + "px";
            } else {
                // Create a new tile element with a scaling animation.
                tile = document.createElement("div");
                tile.classList.add("tile", "new-tile");
                tile.setAttribute("data-index", i);
                tile.innerHTML = grid[i];
                tile.style.backgroundColor = getTileColor(grid[i]);
                tile.style.width = size + "px";
                tile.style.height = size + "px";
                tile.style.position = "absolute";
                tile.style.left = left + "px";
                tile.style.top = top + "px";
                tileContainer.appendChild(tile);
                // Remove the new-tile class after a short delay to allow scale animation.
                setTimeout(() => {
                    tile.classList.remove("new-tile");
                }, 50);
            }
        }
    }
}

// Get the background color for each tile based on its value
function getTileColor(value) {
    const colors = {
        2: "#eee4da",
        4: "#ede0c8",
        8: "#f2b179",
        16: "#f59563",
        32: "#f67c5f",
        64: "#f65e3b",
        128: "#edcf72",
        256: "#edcc61",
        512: "#edc850",
        1024: "#edc53f",
        2048: "#edc22e",
    };
    return colors[value] || "#3c3a32";
}

// Move the tiles in the grid (merge them)
function move(direction) {
    let moved = false;
    let newGrid = grid.slice();

    if (direction === "left") {
        for (let row = 0; row < 4; row++) {
            const rowStart = row * 4;
            let rowValues = newGrid.slice(rowStart, rowStart + 4).filter(val => val > 0);
            for (let i = 0; i < rowValues.length - 1; i++) {
                if (rowValues[i] === rowValues[i + 1]) {
                    rowValues[i] *= 2;
                    rowValues[i + 1] = 0;
                    score += rowValues[i];
                }
            }
            rowValues = rowValues.filter(val => val > 0);
            while (rowValues.length < 4) rowValues.push(0);
            newGrid.splice(rowStart, 4, ...rowValues);
        }
        moved = true;
    } else if (direction === "right") {
        for (let row = 0; row < 4; row++) {
            const rowStart = row * 4;
            let rowValues = newGrid.slice(rowStart, rowStart + 4).filter(val => val > 0);
            for (let i = rowValues.length - 1; i > 0; i--) {
                if (rowValues[i] === rowValues[i - 1]) {
                    rowValues[i] *= 2;
                    rowValues[i - 1] = 0;
                    score += rowValues[i];
                }
            }
            rowValues = rowValues.filter(val => val > 0);
            while (rowValues.length < 4) rowValues.unshift(0);
            newGrid.splice(rowStart, 4, ...rowValues);
        }
        moved = true;
    } else if (direction === "up") {
        for (let col = 0; col < 4; col++) {
            let colValues = [];
            for (let row = 0; row < 4; row++) {
                const value = newGrid[row * 4 + col];
                if (value > 0) colValues.push(value);
            }
            for (let i = 0; i < colValues.length - 1; i++) {
                if (colValues[i] === colValues[i + 1]) {
                    colValues[i] *= 2;
                    colValues[i + 1] = 0;
                    score += colValues[i];
                }
            }
            colValues = colValues.filter(val => val > 0);
            while (colValues.length < 4) colValues.push(0);
            for (let row = 0; row < 4; row++) {
                newGrid[row * 4 + col] = colValues[row];
            }
        }
        moved = true;
    } else if (direction === "down") {
        for (let col = 0; col < 4; col++) {
            let colValues = [];
            for (let row = 0; row < 4; row++) {
                const value = newGrid[row * 4 + col];
                if (value > 0) colValues.push(value);
            }
            for (let i = colValues.length - 1; i > 0; i--) {
                if (colValues[i] === colValues[i - 1]) {
                    colValues[i] *= 2;
                    colValues[i - 1] = 0;
                    score += colValues[i];
                }
            }
            colValues = colValues.filter(val => val > 0);
            while (colValues.length < 4) colValues.unshift(0);
            for (let row = 0; row < 4; row++) {
                newGrid[row * 4 + col] = colValues[row];
            }
        }
        moved = true;
    }

    if (moved) {
        grid.length = 0;
        grid.push(...newGrid);

        // Delay the update to allow the CSS transition to finish
        setTimeout(() => {
            addRandomTile();
            updateTiles();
            scoreDisplay.innerHTML = score;
            if (checkGameOver()) {
                gameOver = true;
                document.getElementById("game-over").style.display = "flex";
            }
        }, 200); // 200ms matches the CSS transition duration
    }
}

document.addEventListener("keydown", (e) => {
    if (gameOver) return;
    if (e.key === "ArrowLeft") move("left");
    else if (e.key === "ArrowRight") move("right");
    else if (e.key === "ArrowUp") move("up");
    else if (e.key === "ArrowDown") move("down");
});

restartButton.addEventListener("click", () => {
    score = 0;
    scoreDisplay.innerHTML = score;
    initGame();
});

// Function to check whether any moves are possible.
function checkGameOver() {
    for (let i = 0; i < 16; i++) {
        if (grid[i] === 0) return false;
        const row = Math.floor(i / 4);
        const col = i % 4;
        // Check to the right and down (only need to check two directions)
        if (col < 3 && grid[i] === grid[i + 1]) return false;
        if (row < 3 && grid[i] === grid[i + 4]) return false;
    }
    return true;
}

// Start the game
initGame();
