document.addEventListener('DOMContentLoaded', () => {
  console.log('Games page loaded');
  
  // Get all game buttons
  const gameButtons = document.querySelectorAll('.game-item button');
  const breakTimerBar = document.getElementById('breakTimerBar');
  const gameFrame = document.getElementById('gameFrame');
  const container = document.querySelector('.container');
  const iframeContainer = document.querySelector('.iframe-container');
  
  // Initially hide iframe container
  iframeContainer.style.display = 'none';
  
  // Check if another games page is already open
  chrome.storage.local.get(['gamesPageOpen', 'timeLeft', 'currentTimer'], (result) => {
    console.log('Storage state:', result);

    if (result.gamesPageOpen) {
      console.log('Games page already open, closing this one');
      window.close();
      return;
    }

    // Mark this page as the active games page
    chrome.storage.local.set({ gamesPageOpen: true }, () => {
      console.log('Marked games page as open');
    });

    // Add cleanup when window closes
    window.addEventListener('unload', () => {
      console.log('Games page closing, cleaning up state');
      chrome.storage.local.set({ gamesPageOpen: false });
    });

    if (result.currentTimer === 'break' && result.timeLeft > 0) {
      console.log('Break timer active, showing timer');
      updateTimerDisplay(result.timeLeft);
      breakTimerBar.style.display = 'block';
      iframeContainer.style.display = 'block';
    } else {
      console.log('Not in break time, hiding games');
      iframeContainer.style.display = 'none';
      if (result.currentTimer !== 'break' || !result.timeLeft) {
        alert('Games can only be played during break time!');
        chrome.storage.local.set({ gamesPageOpen: false }, () => {
          window.close();
        });
      }
    }
  });

  // Add click event listeners to all game buttons
  gameButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Check if we're in break time before allowing game to load
      chrome.storage.local.get(['currentTimer', 'timeLeft'], (result) => {
        if (result.currentTimer !== 'break' || !result.timeLeft || result.timeLeft <= 0) {
          alert('Games can only be played during break time!');
          return;
        }
        const gameUrl = button.getAttribute('data-game');
        console.log('Opening game:', gameUrl);
        openGame(gameUrl);
      });
    });
  });

  function openGame(url) {
    if (iframeContainer.style.display === 'none') {
      iframeContainer.style.display = 'block';
    }
    gameFrame.src = url;
  }

  function updateTimerDisplay(timeLeft) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    breakTimerBar.textContent = `Break Timer: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  
  // Listen for timer updates from background script
  chrome.runtime.onMessage.addListener((message) => {
    console.log('Received message:', message);
    if (message.type === 'TIMER_UPDATE') {
      updateTimerDisplay(message.timeLeft);
      // Hide iframe if time is up
      if (message.timeLeft <= 0) {
        iframeContainer.style.display = 'none';
      }
    } else if (message.type === 'TIMER_COMPLETE' && message.timerType === 'break') {
      // Hide iframe and show alert before closing
      iframeContainer.style.display = 'none';
      alert('Break time is over! Games page will close.');
      // Close games page immediately when break timer ends
      chrome.storage.local.set({ gamesPageOpen: false }, () => {
        window.close();
      });
    }
  });
}); 