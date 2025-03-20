class WhackAMole {
    constructor() {
        this.score = 0;
        this.timeLeft = 30;
        this.gameRunning = false;
        this.gameTimer = null;
        this.moleTimer = null;

        this.scoreDisplay = document.querySelector('.score');
        this.timeDisplay = document.querySelector('.time');
        this.startBtn = document.querySelector('.start-btn');
        this.moles = document.querySelectorAll('.mole');

        this.startBtn.addEventListener('click', () => this.startGame());
        this.moles.forEach(mole => {
            mole.addEventListener('click', () => this.whackMole(mole));
        });
    }

    startGame() {
        if (this.gameRunning) return;
        
        this.gameRunning = true;
        this.score = 0;
        this.timeLeft = 30;
        this.updateDisplay();
        this.startBtn.disabled = true;

        this.gameTimer = setInterval(() => {
            this.timeLeft--;
            this.updateDisplay();
            if (this.timeLeft <= 0) this.endGame();
        }, 1000);

        this.showMoles();
    }

    showMoles() {
        const showNewMole = () => {
            const moles = Array.from(this.moles);
            const upMoles = moles.filter(mole => mole.classList.contains('up'));
            
            // Put down any existing moles
            upMoles.forEach(mole => mole.classList.remove('up'));
            
            // Show new mole if game is still running
            if (this.gameRunning) {
                const randomMole = moles[Math.floor(Math.random() * moles.length)];
                randomMole.classList.add('up');
                
                setTimeout(() => {
                    randomMole.classList.remove('up');
                    if (this.gameRunning) showNewMole();
                }, Math.random() * 1000 + 500);
            }
        };

        showNewMole();
    }

    whackMole(mole) {
        if (!mole.classList.contains('up') || mole.classList.contains('bonked')) return;
        
        this.score += 10;
        mole.classList.add('bonked');
        this.updateDisplay();
        
        setTimeout(() => {
            mole.classList.remove('bonked');
            mole.classList.remove('up');
        }, 100);
    }

    updateDisplay() {
        this.scoreDisplay.textContent = `Score: ${this.score}`;
        this.timeDisplay.textContent = `Time: ${this.timeLeft}s`;
    }

    endGame() {
        this.gameRunning = false;
        clearInterval(this.gameTimer);
        this.moles.forEach(mole => mole.classList.remove('up'));
        this.startBtn.disabled = false;
        alert(`Game Over! Final Score: ${this.score}`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new WhackAMole();
}); 