let timer;
let timeLeft;
let totalTime;
let isPaused = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  switch (message.type) {
    case 'START_TIMER':
      if (message.minutes !== undefined && message.seconds !== undefined) {
        startTimer(message.minutes, message.seconds, message.timerType);
      } else {
        resumeTimer(message.timerType);
      }
      break;
    case 'PAUSE_TIMER':
      pauseTimer();
      break;
    case 'STOP_TIMER':
      stopTimer();
      break;
    case 'GET_STATE':
      sendResponse({
        timeLeft,
        totalTime,
        isPaused
      });
      break;
    case 'TIMER_COMPLETE':
      handleTimerComplete(message.timerType);
      break;
    case 'START_BREAK':
      startBreakTimer();
      break;
    case 'RESET_WORK':
      resetWorkTimer();
      break;
  }
  return true;
});

chrome.notifications.onClicked.addListener((notificationId) => {
  console.log('Notification clicked:', notificationId);
  if (notificationId === 'timerComplete') {
    chrome.action.openPopup();
    chrome.notifications.clear(notificationId);
  }
});

// Helper function to safely send messages with extra debugging
function sendMessageToPopup(message) {
  console.log("Attempting to send message to popup:", message);
  
  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error in sendMessageToPopup:", chrome.runtime.lastError.message);
    } else {
      console.log("Received response from popup:", response);
    }
  });

  // Also update storage so the popup can get the latest state when opened
  chrome.storage.local.set({
    lastTimerUpdate: {
      timestamp: Date.now(),
      ...message
    }
  });
}

function startTimer(minutes, seconds, timerType) {
  console.log('Starting timer:', minutes, 'minutes', seconds, 'seconds');
  
  // Ensure we have valid numbers
  const mins = parseInt(minutes) || 0;
  const secs = parseInt(seconds) || 0;
  
  if (mins !== undefined && secs !== undefined) {
    timeLeft = (mins * 60) + secs;
    totalTime = timeLeft;
  }
  
  // Ensure timeLeft is valid
  if (!timeLeft || isNaN(timeLeft)) {
    console.error('Invalid timer duration');
    return;
  }
  
  isPaused = false;
  clearInterval(timer);
  
  timer = setInterval(() => {
    if (timeLeft <= 0) {
      if (timerType === 'transition') {
        // When transition ends, start break timer
        startBreakTimer();
      } else {
        handleTimerComplete(timerType);
      }
      return;
    }
    
    timeLeft--;
    updateState();
    
    // Use helper function instead of direct message
    sendMessageToPopup({
      type: 'TIMER_UPDATE',
      timeLeft,
      totalTime
    });
  }, 1000);
  
  updateState();
}

function pauseTimer() {
  console.log('Pausing timer');
  clearInterval(timer);
  isPaused = true;
  updateState();
  
  sendMessageToPopup({
    type: 'TIMER_PAUSED'
  });
}

function resumeTimer(timerType) {
  console.log('Resuming timer');
  isPaused = false;
  
  // Restart the interval with current timeLeft
  timer = setInterval(() => {
    if (timeLeft <= 0) {
      if (timerType === 'transition') {
        startBreakTimer();
      } else {
        handleTimerComplete(timerType);
      }
      return;
    }
    
    timeLeft--;
    updateState();
    
    sendMessageToPopup({
      type: 'TIMER_UPDATE',
      timeLeft,
      totalTime
    });
  }, 1000);
  
  updateState();
  
  sendMessageToPopup({
    type: 'TIMER_RESUMED'
  });
}

function stopTimer() {
  console.log('Stopping timer');
  clearInterval(timer);
  timer = null;
  timeLeft = 0;
  totalTime = 0;
  isPaused = false;
  updateState();
}

function handleTimerComplete(timerType) {
  console.log('Handling timer complete for timer type:', timerType);
  stopTimer();

  let notificationOptions = {
    type: 'basic',
    iconUrl: '../assets/icons/clock1.png',
    requireInteraction: true,
    silent: false
  };

  switch (timerType) {
    case 'work':
      // Work timer ended - notify about transition
      notificationOptions.title = 'Work Session Complete!';
      notificationOptions.message = 'Taking a 15-second breather before your break starts.';
      notificationOptions.buttons = [
        { title: 'Skip to Break' },
        { title: 'Reset Work Timer' }
      ];
      chrome.storage.local.set({ currentTimer: 'transition' });
      startTransitionTimer();
      break;

    case 'transition':
      // Transition ended - break starts
      notificationOptions.title = 'Break Time Starting!';
      notificationOptions.message = 'Time to relax and recharge.';
      notificationOptions.buttons = [
        { title: 'Skip Break' },
        { title: 'Start Break' }
      ];
      startBreakTimer();
      break;

    case 'break':
      // Break ended
      notificationOptions.title = 'Break Time Complete!';
      notificationOptions.message = 'Ready to start another work session?';
      notificationOptions.buttons = [
        { title: 'Start Work' },
        { title: 'Adjust Timer' }
      ];
      chrome.storage.local.set({ currentTimer: 'work' });
      break;

    default:
      console.error('Unknown timer type:', timerType);
      return;
  }

  // Create the notification
  chrome.notifications.create(`timer-${timerType}-complete`, notificationOptions, (notificationId) => {
    console.log('Created notification:', notificationId);
  });
}

function updateState() {
  console.log('Updating state:', { timeLeft, totalTime, isPaused });
  chrome.storage.local.set({
    timeLeft,
    totalTime,
    isPaused
  });
}

function openOptionsWindow(timerType) {
  const url = chrome.runtime.getURL('options.html'); // Create an options.html file for this
  chrome.windows.create({
    url: url,
    type: 'popup',
    width: 400,
    height: 300
  }, (window) => {
    console.log('Options window opened:', window);
  });
}

function startBreakTimer() {
  chrome.storage.local.get(['breakTime'], (result) => {
    if (result.breakTime) {
      // Update current timer type to 'break'
      chrome.storage.local.set({ currentTimer: 'break' });
      
      // Send message to update UI before starting break timer
      sendMessageToPopup({
        type: 'BREAK_STARTED',
        message: 'Break time started!'
      });
      
      startTimer(Math.floor(result.breakTime / 60), result.breakTime % 60, 'break');
    } else {
      console.error('Break time not set.');
    }
  });
}

function resetWorkTimer() {
  chrome.storage.local.get(['workTime'], (result) => {
    const minutes = Math.floor(result.workTime / 60);
    const seconds = result.workTime % 60;
    startTimer(minutes, seconds, 'work');
  });
}

// Create an alarm
function createAlarm(seconds) {
  // Ensure seconds is a valid number
  if (typeof seconds !== 'number' || isNaN(seconds)) {
    console.error('Invalid seconds value:', seconds);
    return;
  }

  // Convert seconds to minutes, ensuring it's at least 1/60th of a minute
  const delayInMinutes = Math.max(seconds / 60, 1/60);
  
  chrome.alarms.create(timerAlarmName, { 
    delayInMinutes: delayInMinutes 
  });
}

// Add new function for transition period
function startTransitionTimer() {
  // Send message to update UI for transition period
  sendMessageToPopup({
    type: 'TRANSITION_STARTED',
    message: 'Break starting in 15 seconds...'
  });
  
  // Start a 15-second timer
  startTimer(0, 15, 'transition');
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  const [_, timerType, __] = notificationId.split('-');
  
  chrome.storage.local.get(['workTime', 'breakTime'], (result) => {
    switch (timerType) {
      case 'work':
        if (buttonIndex === 0) {
          // Skip transition and start break directly
          startBreakTimer();
        } else {
          // Reset work timer
          resetWorkTimer();
        }
        break;

      case 'transition':
        if (buttonIndex === 0) {
          // Skip break
          resetWorkTimer();
        } else {
          // Start break
          startBreakTimer();
        }
        break;

      case 'break':
        if (buttonIndex === 0) {
          // Start new work session
          resetWorkTimer();
        } else {
          // Open options to adjust timer
          openOptionsWindow();
        }
        break;
    }
    
    // Clear the notification after handling the button click
    chrome.notifications.clear(notificationId);
  });
}); 