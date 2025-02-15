let timer;
let timeLeft;
let totalTime;
let isPaused = false;

document.addEventListener('DOMContentLoaded', () => {
  const pauseButton = document.getElementById('pauseTimer');
  const stopButton = document.getElementById('stopTimer');
  const display = document.getElementById('display');
  const progressBar = document.getElementById('progress');
  const alarmSound = document.getElementById('alarmSound');
  const timerType = document.getElementById('timerType');

  initializeTimer();

  function initializeTimer() {
    // First check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlMinutes = parseInt(urlParams.get('minutes')) || 0;
    const urlSeconds = parseInt(urlParams.get('seconds')) || 0;

    // Then check stored state
    chrome.storage.local.get(['timeLeft', 'totalTime', 'isPaused', 'currentTimer', 'currentPhase'], (result) => {
      console.log('Initializing timer with state:', result);
      if (result.timeLeft !== undefined && result.timeLeft > 0) {
        showTimerPage();
        updateDisplay(result.timeLeft);
        updateProgress(result.timeLeft, result.totalTime);
        isPaused = result.isPaused;
        if (result.currentPhase === 'roundup') {
          timerType.textContent = 'Round Up! Break beginning shortly';
        } else {
          timerType.textContent = result.currentTimer === 'work' ? 'Work Time' : 'Break Time';
        }
        pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
      } else {
        showInputPage();
        resetInputs();
      }
    });
  }

  pauseButton.addEventListener('click', () => {
    if (isPaused) {
      startTimer();
      pauseButton.textContent = 'Pause';
    } else {
      clearInterval(timer);
      pauseButton.textContent = 'Resume';
    }
    isPaused = !isPaused;
    saveState();
  });

  stopButton.addEventListener('click', () => {
    clearInterval(timer);
    chrome.storage.local.clear(() => {
      window.close();
    });
  });

  function saveState() {
    chrome.storage.local.set({
      timeLeft,
      totalTime,
      isPaused
    });
  }

  function startTimer() {
    clearInterval(timer); // Clear any existing timer
    timer = setInterval(() => {
      if (timeLeft <= 0) {
        clearInterval(timer);
        alarmSound.play();
        showNotification();
        chrome.storage.local.clear();
        return;
      }
      
      timeLeft--;
      updateDisplay();
      updateProgress();
      saveState();
    }, 1000);
  }

  function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function updateProgress() {
    const percentage = (timeLeft / totalTime) * 100;
    progressBar.style.width = `${percentage}%`;
  }

  function showNotification() {
    const timerText = document.getElementById('timerType').textContent.toLowerCase();
    let type;
    if (timerText.includes('work')) {
      type = 'work';
    } else if (timerText.includes('break')) {
      type = 'break';
    } else if (timerText.includes('transition') || timerText.includes('round')) {
      type = 'transition';
    } else {
      type = 'unknown';
    }
    chrome.runtime.sendMessage({
      type: 'TIMER_COMPLETE',
      timerType: type
    });
  }

  // Add notification response handlers
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'START_BREAK') {
      // Handle starting break timer
      startBreakTimer();
    } else if (message.type === 'RESET_TIMER') {
      // Handle resetting timer
      resetTimer();
    }
  });

  function startBreakTimer() {
    // Your break timer logic here
    timeLeft = breakTime;
    totalTime = breakTime;
    timerType.textContent = 'Break Time';
    updateDisplay();
    updateProgress();
    startTimer();
  }

  function resetTimer() {
    // Your reset timer logic here
    timeLeft = workTime;
    totalTime = workTime;
    timerType.textContent = 'Work Time';
    updateDisplay();
    updateProgress();
    startTimer();
  }
});

// Handle window closing
window.addEventListener('beforeunload', () => {
  clearInterval(timer);
}); 