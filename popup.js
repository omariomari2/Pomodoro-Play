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

  function startPomodoro() {
    const focusTime = parseInt(document.getElementById('focus-time').value) * 60;
    const breakTime = parseInt(document.getElementById('break-time').value) * 60;
    
    timeLeft = focusTime;
    currentMode = 'focus';
    
    // Send message to background script
    chrome.runtime.sendMessage({
      command: 'start',
      focusTime: focusTime,
      breakTime: breakTime
    });

    // Update UI
    timeSelection.classList.add('hidden');
    timerProgression.classList.remove('hidden');
    updateTimer();
    startCountdown();
  }

  function startCountdown() {
    if (timer) clearInterval(timer);
    
    timer = setInterval(() => {
      if (!isPaused) {
        timeLeft--;
        updateTimer();

        if (timeLeft <= 0) {
          clearInterval(timer);
          handleTimerComplete();
        }
      }
    }, 1000);
  }

  function updateTimer() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timeLeftDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const totalTime = currentMode === 'focus' 
      ? parseInt(document.getElementById('focus-time').value) * 60
      : parseInt(document.getElementById('break-time').value) * 60;
    
    const progress = (timeLeft / totalTime) * 100;
    progressBar.style.width = `${progress}%`;
  }

  function togglePause() {
    isPaused = !isPaused;
    pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
  }

  function resetTimer() {
    clearInterval(timer);
    timeSelection.classList.remove('hidden');
    timerProgression.classList.add('hidden');
    breakTimePage.classList.add('hidden');
    isPaused = false;
    chrome.runtime.sendMessage({ command: 'reset' });
  }

  function handleTimerComplete() {
    if (currentMode === 'focus') {
      timerProgression.classList.add('hidden');
      breakTimePage.classList.remove('hidden');
      currentMode = 'break';
      timeLeft = parseInt(document.getElementById('break-time').value) * 60;
      startCountdown();
    } else {
      resetTimer();
    }
  }
}); 