// Score and game element references
const choices = document.querySelectorAll('.choice');
const resultMessage = document.getElementById('result-message');
const playerScoreSpan = document.getElementById('player-score');
const computerScoreSpan = document.getElementById('computer-score');
const drawsSpan = document.getElementById('draws');

let playerScore = 0;
let computerScore = 0;
let draws = 0;

// Array of possible choices
const options = ['rock', 'paper', 'scissors'];

// Mapping choices to emojis
const emojiMap = {
  rock: "✊",
  paper: "📄",
  scissors: "✂️"
};

// Function to get computer's random choice
function computerPlay() {
  const randomIndex = Math.floor(Math.random() * options.length);
  return options[randomIndex];
}

// Function to determine the outcome of a round
function playRound(playerSelection, computerSelection) {
  // Check for draw
  if (playerSelection === computerSelection) {
    return 'draw';
  }

  // Define winning combinations for the player
  if (
    (playerSelection === 'rock' && computerSelection === 'scissors') ||
    (playerSelection === 'paper' && computerSelection === 'rock') ||
    (playerSelection === 'scissors' && computerSelection === 'paper')
  ) {
    return 'win';
  }

  // Otherwise, it's a loss for the player
  return 'lose';
}

// Function to update the scoreboard and result message
function updateScore(result, playerSelection, computerSelection) {
  if (result === 'win') {
    playerScore++;
    resultMessage.textContent = `🏆 You win! ${emojiMap[playerSelection]} beats ${emojiMap[computerSelection]}.`;
  } else if (result === 'lose') {
    computerScore++;
    resultMessage.textContent = `☠️ You lose! ${emojiMap[computerSelection]} beats ${emojiMap[playerSelection]}.`;
  } else {
    draws++;
    resultMessage.textContent = `🤝 It's a draw! You both chose ${emojiMap[playerSelection]}.`;
  }

  // Update scoreboard display
  playerScoreSpan.textContent = playerScore;
  computerScoreSpan.textContent = computerScore;
  drawsSpan.textContent = draws;
}

// Event listeners on player's choice buttons
choices.forEach(choiceButton => {
  choiceButton.addEventListener('click', () => {
    // Get player selection from data attribute
    const playerSelection = choiceButton.getAttribute('data-choice');
    // Get computer selection randomly
    const computerSelection = computerPlay();
    // Determine round outcome
    const result = playRound(playerSelection, computerSelection);
    // Update the scoreboard and game result message
    updateScore(result, playerSelection, computerSelection);
  });
});

// Reset function to clear the scoreboard and reset the game message
function resetGame() {
  playerScore = 0;
  computerScore = 0;
  draws = 0;
  playerScoreSpan.textContent = playerScore;
  computerScoreSpan.textContent = computerScore;
  drawsSpan.textContent = draws;
  resultMessage.textContent = "Make your move!";
}

// Add event listener for reset button
document.getElementById('resetButton').addEventListener('click', resetGame); 