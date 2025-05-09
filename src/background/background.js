let timer;
let timeLeft;
let totalTime;
let isPaused = false;
let currentCycle = 1;
let totalCycles = 1;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  switch (message.type) {
    case 'START_TIMER':
      if (message.minutes !== undefined && message.seconds !== undefined) {
        if (message.cycles !== undefined) {
          currentCycle = 1;
          totalCycles = message.cycles;
        }
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
        isPaused,
        currentCycle,
        totalCycles
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
  
  // First, let's always store the message in storage so popup can get it when opened
  chrome.storage.local.set({
    lastTimerUpdate: {
      timestamp: Date.now(),
      ...message
    }
  });
  
  // Then try to send message to popup if it's open
  chrome.runtime.sendMessage(message).catch(error => {
    // Silently catch 'receiving end does not exist' errors
    // This is normal when popup is closed
    console.log("Popup not available, message stored in local storage");
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
      if (currentCycle < totalCycles) {
        // Show notification for completed cycle
        createCycleCompletionNotification(currentCycle);
        
        // Start next cycle
        currentCycle++;
        
        notificationOptions.title = `Cycle ${currentCycle} of ${totalCycles} Starting!`;
        notificationOptions.message = `Beginning work session for cycle ${currentCycle}.`;
        notificationOptions.buttons = [
          { title: 'Start Work' },
          { title: 'Adjust Timer' }
        ];
        
        // Send message about cycle progress
        sendMessageToPopup({
          type: 'CYCLE_UPDATE',
          currentCycle,
          totalCycles
        });
        
        // Set currentTimer to work for the next cycle
        chrome.storage.local.set({ currentTimer: 'work' }, () => {
          // Start work timer for the next cycle
          chrome.storage.local.get(['workTime'], (result) => {
            if (result.workTime) {
              const minutes = Math.floor(result.workTime / 60);
              const seconds = result.workTime % 60;
              
              // Small delay to ensure notification is seen
              setTimeout(() => {
                console.log(`Starting next work cycle (${currentCycle} of ${totalCycles})`);
                startTimer(minutes, seconds, 'work');
                
                // Also send an explicit message to update the UI
                sendMessageToPopup({
                  type: 'WORK_STARTED',
                  message: 'Work time started for new cycle!',
                  currentCycle,
                  totalCycles
                });
              }, 1500);
            }
          });
        });
      } else {
        // Final cycle complete notification
        createCycleCompletionNotification(currentCycle, true);
        
        // All cycles completed
        notificationOptions.title = 'All Cycles Complete!';
        notificationOptions.message = 'You have completed all your pomodoro cycles!';
        notificationOptions.buttons = [
          { title: 'Start Again' },
          { title: 'Adjust Timer' }
        ];
        chrome.storage.local.set({ currentTimer: 'work' });
        // Reset cycle counter
        currentCycle = 1;
      }
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

// Add a function to create cycle completion notifications
function createCycleCompletionNotification(cycleNumber, isFinal = false) {
  const notificationOptions = {
    type: 'basic',
    iconUrl: '../assets/icons/clock1.png',
    title: isFinal ? 'All Pomodoro Cycles Complete!' : `Cycle ${cycleNumber} Complete!`,
    message: isFinal 
      ? `You've finished all ${totalCycles} cycles. Great work!` 
      : `You've completed cycle ${cycleNumber} of ${totalCycles}. Keep going!`,
    requireInteraction: false,
    silent: false
  };
  
  chrome.notifications.create(`cycle-${cycleNumber}-complete`, notificationOptions, (notificationId) => {
    console.log('Created cycle completion notification:', notificationId);
    
    // Auto-dismiss this notification after 5 seconds
    setTimeout(() => {
      chrome.notifications.clear(notificationId);
    }, 5000);
  });
}

function updateState() {
  console.log('Updating state:', { timeLeft, totalTime, isPaused, currentCycle, totalCycles });
  chrome.storage.local.set({
    timeLeft,
    totalTime,
    isPaused,
    currentCycle,
    totalCycles
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
  console.log(`Notification ${notificationId} button ${buttonIndex} clicked`);
  
  // Extract timer type from notification ID
  const timerTypeParts = notificationId.split('-');
  const timerType = timerTypeParts.length > 1 ? timerTypeParts[1] : '';
  
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
          // Start new work session (even if there are more cycles)
          resetWorkTimer();
        } else {
          // Open options to adjust timer
          chrome.runtime.openOptionsPage();
        }
        break;
        
      default:
        console.log('Unknown notification type:', timerType);
        break;
    }
    
    // Clear the notification after handling the button click
    chrome.notifications.clear(notificationId);
  });
}); 