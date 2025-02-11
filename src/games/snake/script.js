const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const gameOverText = document.getElementById('gameOver');
const scoreValue = document.getElementById('scoreValue');
const finalScore = document.getElementById('finalScore');

const box = 16;
const gridSize = 25; // 400/16 = 25 squares
const canvasSize = box * gridSize; // Should be 400x400
let snake;
let food;
let score;
let d;
let game;

function drawGrid() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;

    // Draw vertical lines
    for (let x = 0; x <= canvas.width; x += box) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = 0; y <= canvas.height; y += box) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function init() {
    snake = [
        { x: Math.floor(gridSize / 2) * box, y: Math.floor(gridSize / 2) * box },
        { x: (Math.floor(gridSize / 2) - 1) * box, y: Math.floor(gridSize / 2) * box }
    ];
    food = createNewFood();
    score = 0;
    d = 'RIGHT'; // Set initial direction
    gameOverText.classList.add('hidden');
    clearInterval(game);
    game = setInterval(draw, 120);
    scoreValue.textContent = '0';
}

document.addEventListener('keydown', direction);

function direction(event) {
    const key = event.keyCode;
    if (key == 37 && d != 'RIGHT') {
        d = 'LEFT';
    } else if (key == 38 && d != 'DOWN') {
        d = 'UP';
    } else if (key == 39 && d != 'LEFT') {
        d = 'RIGHT';
    } else if (key == 40 && d != 'UP') {
        d = 'DOWN';
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid first
    drawGrid();

    // Draw snake with rounded corners and gradient
    for (let i = 0; i < snake.length; i++) {
        const gradient = ctx.createLinearGradient(
            snake[i].x, snake[i].y, 
            snake[i].x + box, snake[i].y + box
        );
        
        if (i === 0) {
            // Head color
            gradient.addColorStop(0, '#00ff88');
            gradient.addColorStop(1, '#00cc6a');
        } else {
            // Body color with slight variation based on position
            const hue = 340 + (i * 2) % 20; // Varies between 340 and 360
            gradient.addColorStop(0, `hsl(${hue}, 75%, 60%)`);
            gradient.addColorStop(1, `hsl(${hue}, 75%, 45%)`);
        }
        
        ctx.fillStyle = gradient;
        
        // Draw rounded rectangle for snake segments
        roundedRect(
            ctx,
            snake[i].x + 1, // Add 1px margin
            snake[i].y + 1,
            box - 2, // Subtract 2px for margin
            box - 2,
            4 // Corner radius
        );
        
        // Add subtle inner shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fill();
        ctx.shadowColor = 'transparent';
    }

    // Draw food as a glowing orb
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 15;
    const foodGradient = ctx.createRadialGradient(
        food.x + box/2, food.y + box/2, 2,
        food.x + box/2, food.y + box/2, box/2 - 2
    );
    foodGradient.addColorStop(0, '#fff');
    foodGradient.addColorStop(0.5, '#00ff88');
    foodGradient.addColorStop(1, '#00cc6a');
    
    ctx.fillStyle = foodGradient;
    ctx.beginPath();
    ctx.arc(food.x + box/2, food.y + box/2, box/2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    let snakeX = snake[0].x;
    let snakeY = snake[0].y;

    if (d == 'LEFT') snakeX -= box;
    if (d == 'UP') snakeY -= box;
    if (d == 'RIGHT') snakeX += box;
    if (d == 'DOWN') snakeY += box;

    // Create new head position
    let newHead = {
        x: snakeX,
        y: snakeY
    };

    // Check if the second segment is out of bounds
    if (snake.length > 1) {
        let secondSegment = snake[1];
        if (secondSegment.x < 0 || secondSegment.x >= canvas.width || secondSegment.y < 0 || secondSegment.y >= canvas.height) {
            clearInterval(game);
            gameOverText.classList.remove('hidden');
            return;
        }
    }

    // Only check for self-collision
    if (collision(newHead, snake)) {
        clearInterval(game);
        gameOverText.classList.remove('hidden');
        return;
    }

    if (snakeX == food.x && snakeY == food.y) {
        score++;
        food = createNewFood();
    } else {
        snake.pop();
    }

    snake.unshift(newHead);

    scoreValue.textContent = score;
    finalScore.textContent = score;
}

// Helper function to draw rounded rectangles
function roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}

function collision(head, array) {
    for (let i = 0; i < array.length; i++) {
        if (head.x === array[i].x && head.y === array[i].y) {
            return true;
        }
    }
    return false;
}

// Add function to create food in valid positions
function createNewFood() {
    let newFood;
    do {
        newFood = {
            x: Math.floor(Math.random() * gridSize) * box,
            y: Math.floor(Math.random() * gridSize) * box
        };
    } while (collision(newFood, snake)); // Ensure food doesn't spawn on snake
    return newFood;
}

startButton.addEventListener('click', init);

// Fix game over text typo in index.html
document.querySelector('#gameOver span').textContent = 'GAME OVER!'; 