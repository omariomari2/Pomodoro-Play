class MemoryGame {
    constructor() {
        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.moves = 0;
        this.timer = 0;
        this.timerInterval = null;
        this.symbols = ['🎮', '🎲', '🎯', '🎪', '🎨', '🎭', '🎪', '🎯'];
        
        this.grid = document.querySelector('.memory-grid');
        this.movesDisplay = document.querySelector('.moves');
        this.timerDisplay = document.querySelector('.timer');
        this.restartBtn = document.querySelector('.restart-btn');
        
        this.initializeGame();
    }

    initializeGame() {
        this.restartBtn.addEventListener('click', () => this.resetGame());
        this.createCards();
        this.startTimer();
    }

    createCards() {
        // Double the symbols for pairs
        const cardSymbols = [...this.symbols, ...this.symbols];
        // Shuffle the symbols
        this.shuffleArray(cardSymbols);

        this.grid.innerHTML = '';
        cardSymbols.forEach((symbol, index) => {
            const card = document.createElement('div');
            card.classList.add('card');
            card.dataset.index = index;
            card.innerHTML = `<span>${symbol}</span>`;
            
            card.addEventListener('click', () => this.flipCard(card));
            this.grid.appendChild(card);
        });
    }

    flipCard(card) {
        if (
            this.flippedCards.length === 2 || 
            card.classList.contains('flipped') ||
            card.classList.contains('matched')
        ) {
            return;
        }

        card.classList.add('flipped');
        this.flippedCards.push(card);

        if (this.flippedCards.length === 2) {
            this.moves++;
            this.movesDisplay.textContent = `Moves: ${this.moves}`;
            this.checkMatch();
        }
    }

    checkMatch() {
        const [card1, card2] = this.flippedCards;
        const symbol1 = card1.querySelector('span').textContent;
        const symbol2 = card2.querySelector('span').textContent;

        if (symbol1 === symbol2) {
            this.flippedCards.forEach(card => card.classList.add('matched'));
            this.matchedPairs++;
            
            if (this.matchedPairs === this.symbols.length) {
                this.endGame();
            }
        } else {
            setTimeout(() => {
                this.flippedCards.forEach(card => card.classList.remove('flipped'));
            }, 1000);
        }

        this.flippedCards = [];
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.timer++;
            this.timerDisplay.textContent = `Time: ${this.timer}s`;
        }, 1000);
    }

    endGame() {
        clearInterval(this.timerInterval);
        setTimeout(() => {
            alert(`Congratulations! You won in ${this.moves} moves and ${this.timer} seconds!`);
        }, 500);
    }

    resetGame() {
        clearInterval(this.timerInterval);
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.moves = 0;
        this.timer = 0;
        this.movesDisplay.textContent = 'Moves: 0';
        this.timerDisplay.textContent = 'Time: 0s';
        this.createCards();
        this.startTimer();
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MemoryGame();
}); 