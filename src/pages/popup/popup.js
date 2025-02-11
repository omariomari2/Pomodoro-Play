let isPaused = false;

document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup loaded');
  // DOM elements
  const inputPage = document.getElementById('inputPage');
  const timerPage = document.getElementById('timerPage');
  const display = document.getElementById('display');
  const progressBar = document.getElementById('progress');
  const timerType = document.getElementById('timerType');
  
  // Input elements
  const workMinutesInput = document.getElementById('workMinutes');
  const workSecondsInput = document.getElementById('workSeconds');
  const breakMinutesInput = document.getElementById('breakMinutes');
  const breakSecondsInput = document.getElementById('breakSeconds');
  
  // Buttons
  const startTimerBtn = document.getElementById('startTimer');
  const pauseButton = document.getElementById('pauseTimer');
  const stopButton = document.getElementById('stopTimer');
  const openGamesButton = document.getElementById('openGamesButton');

  let workTime = 0;
  let breakTime = 0;

  // Initialize timer state
  initializeTimer();

  // Event listeners
  startTimerBtn.addEventListener('click', handleStart);
  pauseButton.addEventListener('click', handlePause);
  stopButton.addEventListener('click', handleStop);

  // Listen for timer updates and completion
  chrome.runtime.onMessage.addListener((message) => {
    console.log('Popup received message:', message);
    if (message.type === 'TIMER_UPDATE') {
      updateDisplay(message.timeLeft);
      updateProgress(message.timeLeft, message.totalTime);
    } else if (message.type === 'TIMER_PAUSED') {
      isPaused = true;
      pauseButton.textContent = 'Resume';
    } else if (message.type === 'TIMER_RESUMED') {
      isPaused = false;
      pauseButton.textContent = 'Pause';
    } else if (message.type === 'TIMER_COMPLETE') {
      const alarmSound = document.getElementById('alarmSound');
      if (alarmSound) {
        alarmSound.play();
      }
      
      chrome.storage.local.get(['currentTimer'], (result) => {
        if (result.currentTimer === 'work') {
          // Work timer completed, transition will start automatically
          updateTimerTypeText('transition');
        } else if (result.currentTimer === 'transition') {
          // Transition completed, break will start automatically
          updateTimerTypeText('break');
        } else {
          showInputPage();
          resetInputs();
        }
      });
    } else if (message.type === 'BREAK_STARTED') {
      showTimerPage();
      updateTimerTypeText('break');
    } else if (message.type === 'TRANSITION_STARTED') {
      showTimerPage();
      updateTimerTypeText('transition');
    }
  });

  // Add toggle view functionality
  const toggleBtn = document.getElementById('toggleView');
  const body = document.body;
  const miniProgress = document.getElementById('miniProgress');
  
  toggleBtn.addEventListener('click', () => {
    body.classList.toggle('minimized');
    // Store preference
    chrome.storage.local.set({
      isMinimized: body.classList.contains('minimized')
    });
  });

  // Check stored preference on load
  chrome.storage.local.get(['isMinimized'], (result) => {
    if (result.isMinimized) {
      body.classList.add('minimized');
    }
  });

  // When "Play Games" is clicked, open games.html in a new tab.
  if (openGamesButton) {
    openGamesButton.addEventListener('click', () => {
      console.log('Opening games page');
      // First check if we're in break time
      chrome.storage.local.get(['currentTimer', 'timeLeft'], (result) => {
        console.log('Current Timer State:', result);
        if (result.currentTimer === 'break' && result.timeLeft > 0) {
          chrome.tabs.create({ 
            url: chrome.runtime.getURL('src/games/games.html')
          }, (tab) => {
            if (chrome.runtime.lastError) {
              console.error('Failed to open games:', chrome.runtime.lastError);
              alert('Failed to open games. Please try again.');
            }
          });
        } else {
          alert('Games can only be played during break time!');
        }
      });
    });
  }

  // Check for any missed updates stored in chrome.storage
  chrome.storage.local.get(['lastTimerUpdate'], (result) => {
    if (result.lastTimerUpdate) {
      const message = result.lastTimerUpdate;
      console.log("Popup loaded with a stored message:", message);
      // Process the message here as needed. For example:
      if (message.type === 'TIMER_UPDATE') {
        updateDisplay(message.timeLeft);
        updateProgress(message.timeLeft, message.totalTime);
      }
      // Add additional cases if required
    }
  });

  // Listen for incoming messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Popup received message:", message);
    // Optionally send a response
    sendResponse({ received: true });
  });

  function initializeTimer() {
    chrome.storage.local.get(['timeLeft', 'totalTime', 'isPaused', 'currentTimer'], (result) => {
      console.log('Initializing timer with state:', result);
      if (result.timeLeft !== undefined && result.timeLeft > 0) {
        showTimerPage();
        updateDisplay(result.timeLeft);
        updateProgress(result.timeLeft, result.totalTime);
        isPaused = result.isPaused || false;
        
        // Make sure we show the correct timer type
        if (result.currentTimer === 'transition') {
          updateTimerTypeText('transition');
        } else if (result.currentTimer === 'break') {
          updateTimerTypeText('break');
        } else {
          updateTimerTypeText('work');
        }
        
        pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
      } else {
        showInputPage();
        resetInputs();
      }
    });
  }

  function handleStart() {
    const workMinutes = parseInt(workMinutesInput.value) || 0;
    const workSeconds = parseInt(workSecondsInput.value) || 0;
    const breakMinutes = parseInt(breakMinutesInput.value) || 0;
    const breakSeconds = parseInt(breakSecondsInput.value) || 0;
    
    if ((workMinutes === 0 && workSeconds === 0) || (breakMinutes === 0 && breakSeconds === 0)) {
      alert('Please set both work and break timers.');
      return;
    }

    // Calculate work and break times without adding 15 seconds here
    workTime = workMinutes * 60 + workSeconds;
    breakTime = breakMinutes * 60 + breakSeconds;

    chrome.storage.local.set({
      workTime,
      breakTime,
      currentTimer: 'work'
    });

    chrome.runtime.sendMessage({
      type: 'START_TIMER',
      minutes: workMinutes,
      seconds: workSeconds,
      timerType: 'work'
    });
    
    showTimerPage();
    updateTimerTypeText('work');
  }

  function handlePause() {
    isPaused = !isPaused;
    
    chrome.storage.local.get(['currentTimer'], (result) => {
      if (isPaused) {
        chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
        pauseButton.textContent = 'Resume';
      } else {
        chrome.runtime.sendMessage({ 
          type: 'START_TIMER',
          timerType: result.currentTimer 
        });
        pauseButton.textContent = 'Pause';
      }
    });
  }

  function handleStop() {
    chrome.runtime.sendMessage({ type: 'STOP_TIMER' });
    chrome.storage.local.clear(() => {
      showInputPage();
      resetInputs();
    });
  }

  function handleStartBreak() {
    const minutes = Math.floor(breakTime / 60);
    const seconds = breakTime % 60;

    // Reset games page state when starting a new break
    chrome.storage.local.set({
      currentTimer: 'break',
      timeLeft: breakTime,
      totalTime: breakTime,
      gamesPageOpen: false  // Reset the games page state
    });

    chrome.runtime.sendMessage({
      type: 'START_TIMER',
      minutes,
      seconds,
      timerType: 'break'
    });

    showTimerPage();
    updateTimerTypeText('break');
  }

  function showTimerPage() {
    inputPage.classList.add('hidden');
    timerPage.classList.remove('hidden');
  }

  function showInputPage() {
    timerPage.classList.add('hidden');
    inputPage.classList.remove('hidden');
  }

  function resetInputs() {
    workMinutesInput.value = '';
    workSecondsInput.value = '';
    breakMinutesInput.value = '';
    breakSecondsInput.value = '';
    progressBar.style.width = '100%';
    display.textContent = '00:00';
  }

  function updateDisplay(time) {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    const display = document.getElementById('display');
    const miniDisplay = document.getElementById('miniDisplay');
    
    if (display) display.textContent = timeString;
    if (miniDisplay) miniDisplay.textContent = timeString;
  }

  function updateProgress(timeLeft, totalTime) {
    const percentage = (timeLeft / totalTime) * 100;
    const progressBar = document.querySelector('.progress-bar');
    const miniProgress = document.getElementById('miniProgress');
    
    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (miniProgress) miniProgress.style.width = `${percentage}%`;
  }

  // Function to update the timer type text
  function updateTimerTypeText(timerType) {
    const timerTypeElement = document.getElementById('timerType');
    const miniTimerType = document.getElementById('miniTimerType');
    
    if (timerTypeElement && miniTimerType) {
      let text, color;
      
      switch(timerType) {
        case 'work':
          text = 'Work Time';
          color = '#4f46e5';
          // Show pause button, hide games button during work time
          pauseButton.classList.remove('hidden');
          openGamesButton.classList.add('hidden');
          break;
        case 'break':
          text = 'Break Time';
          color = '#059669';
          // Hide pause button, show games button during break time
          pauseButton.classList.add('hidden');
          openGamesButton.classList.remove('hidden');
          break;
        case 'transition':
          text = 'Get Ready for Break!';
          color = '#eab308';
          // Show pause button, hide games button during transition
          pauseButton.classList.remove('hidden');
          openGamesButton.classList.add('hidden');
          break;
      }
      
      timerTypeElement.textContent = text;
      timerTypeElement.style.color = color;
      
      miniTimerType.textContent = text;
      miniTimerType.dataset.type = timerType;
    }
  }

  chrome.runtime.sendMessage({ type: 'DEBUG_TEST' }, (response) => {
    console.log("Debug test response:", response);
  });
}); 