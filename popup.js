let timer;
let timeLeft;
let isPaused = false;
let currentMode = 'focus';

document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const timeSelection = document.getElementById('time-selection');
  const timerProgression = document.getElementById('timer-progression');
  const breakTimePage = document.getElementById('break-time');
  const startButton = document.getElementById('start-timer');
  const pauseButton = document.getElementById('pause-timer');
  const resetButton = document.getElementById('reset-timer');
  const timeLeftDisplay = document.getElementById('time-left');
  const progressBar = document.getElementById('progress');

  // Add event listeners
  startButton.addEventListener('click', startPomodoro);
  pauseButton.addEventListener('click', togglePause);
  resetButton.addEventListener('click', resetTimer);

  // Get initial timer state
  chrome.runtime.sendMessage({ command: 'getTime' }, (response) => {
    if (response.timeLeft > 0) {
      showTimerUI();
      updateTimerDisplay(response.timeLeft);
      isPaused = response.isPaused;
      pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
    }
  });

  // Listen for time updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.command === 'timeUpdate') {
      updateTimerDisplay(message.timeLeft);
      if (currentMode === 'break') {
        const breakTimeLeft = document.getElementById('break-time-left');
        if (breakTimeLeft) {
          const minutes = Math.floor(message.timeLeft / 60);
          const seconds = message.timeLeft % 60;
          breakTimeLeft.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
      }
    } else if (message.command === 'showBreak') {
      showBreakUI();
      updateTimerDisplay(message.timeLeft);
    } else if (message.command === 'showFocus') {
      timeSelection.classList.remove('hidden');
      timerProgression.classList.add('hidden');
      breakTimePage.classList.add('hidden');
    }
    return true;
  });

  function startPomodoro() {
    const focusTime = parseInt(document.getElementById('focus-time').value) * 60;
    const breakTime = parseInt(document.getElementById('break-time').value) * 60;
    
    chrome.runtime.sendMessage({
      command: 'start',
      focusTime: focusTime,
      breakTime: breakTime
    });

    showTimerUI();
  }

  function togglePause() {
    chrome.runtime.sendMessage({ command: 'pause' }, (response) => {
      isPaused = response.isPaused;
      pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
    });
  }

  function resetTimer() {
    chrome.runtime.sendMessage({ command: 'reset' }, () => {
      timeSelection.classList.remove('hidden');
      timerProgression.classList.add('hidden');
      breakTimePage.classList.add('hidden');
    });
  }

  function updateTimerDisplay(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    timeLeftDisplay.textContent = 
      `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    
    // Update progress bar
    const totalTime = currentMode === 'focus' 
      ? parseInt(document.getElementById('focus-time').value) * 60
      : parseInt(document.getElementById('break-time').value) * 60;
    
    const progress = (seconds / totalTime) * 100;
    progressBar.style.width = `${progress}%`;
  }

  function showTimerUI() {
    timeSelection.classList.add('hidden');
    timerProgression.classList.remove('hidden');
  }

  function showBreakUI() {
    timeSelection.classList.add('hidden');
    timerProgression.classList.add('hidden');
    breakTimePage.classList.remove('hidden');
    currentMode = 'break';
    
    // Update break timer display
    const breakTimeLeft = document.getElementById('break-time-left');
    if (breakTimeLeft) {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      breakTimeLeft.textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Add smooth transition
    breakTimePage.style.opacity = '0';
    requestAnimationFrame(() => {
      breakTimePage.style.opacity = '1';
    });
  }
}); 