// document.getElementById('tic-tac-toe').addEventListener('click', () => {
//     alert('Tic Tac Toe game started!');
//     // Implement Tic Tac Toe game logic here
//   });
  
document.getElementById('rock-paper-scissors').addEventListener('click', () => {
  try {
    window.location.href = '../rps/rps.html';
  } catch (error) {
    console.error('Failed to navigate to RPS game:', error);
    // Maybe show a user-friendly error message
  }
});
  
  // document.getElementById('typing-game').addEventListener('click', () => {
  //   alert('Typing game started!');
  //   // Implement Typing Game logic here
  // });