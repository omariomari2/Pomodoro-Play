let timer;
let timeLeft;
let totalTime;
let isPaused = false;
let currentCycle = 1;
let totalCycles = 1;

// Initialize state object at the top of the file
let state = {
  timeLeft: 0,
  totalTime: 0,
  isPaused: false,
  currentCycle: 1,
  totalCycles: 1
};

// Function to get all tabs and send them a message
const notifyAllTabs = async (message) => {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, message);
      } catch (e) {
        // Tab might not be listening for messages
        if (!e.message.includes('Could not establish connection')) {
          console.error('Error sending message to tab:', e);
        }
      }
    }
  } catch (error) {
    console.error('Error in notifyAllTabs:', error);
  }
};

// Function to notify all components about task updates
const notifyTaskUpdate = async () => {
  const tasks = (await chrome.storage.local.get('tasks')).tasks || [];
  const message = { type: 'TASKS_UPDATED', tasks };
  
  // Notify all tabs
  await notifyAllTabs(message);
  
  // Also notify the popup if it's open
  try {
    await chrome.runtime.sendMessage(message);
  } catch (e) {
    // Popup might not be open
    if (!e.message.includes('Could not establish connection')) {
      console.error('Error sending message to popup:', e);
    }
  }
};

// Listen for messages from popup and content scripts
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
    case 'GET_TASKS':
      chrome.storage.local.get('tasks', (result) => {
        sendResponse({ tasks: result.tasks || [] });
      });
      return true; // Required for async sendResponse
    case 'UPDATE_TASKS':
      // Update tasks in storage
      chrome.storage.local.set({ tasks: message.tasks }, async () => {
        // Notify all components about the task update
        await notifyTaskUpdate();
        if (sendResponse) {
          sendResponse({ success: true });
        }
      });
      return true; // Required for async sendResponse
    case 'RESET_WORK':
      resetWorkTimer();
      break;
    case 'UPDATE_STATS':
      // Handle stats update from popup
      if (message.statType && message.value !== undefined) {
        console.log(`Updating stats: ${message.statType} with value ${message.value}`);
        
        // Special handling for task completion
        if (message.statType === 'taskCompleted') {
          incrementTaskCompletionCount();
        } else {
          updatePomodoroStats(message.statType, message.value);
        }
        
        // Send response back to popup
        if (sendResponse) {
          sendResponse({ success: true, statType: message.statType, value: message.value });
        }
      }
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

// Function to send message to popup with better error handling
function sendMessageToPopup(message) {
  console.log('Attempting to send message to popup:', message);
  
  // Try to send message to popup
  chrome.runtime.sendMessage(message)
    .then(response => {
      if (chrome.runtime.lastError) {
        // Popup is not available, store message in local storage
        console.log('Popup not available, message stored in local storage');
        chrome.storage.local.set({ 
          lastMessage: {
            message: message,
            timestamp: Date.now()
          }
        });
      } else {
        console.log('Message sent to popup successfully:', response);
      }
    })
    .catch(error => {
      console.log('Error sending message to popup:', error);
      // Store message in local storage as fallback
      chrome.storage.local.set({ 
        lastMessage: {
          message: message,
          timestamp: Date.now()
        }
      });
    });
}

// Update the updateState function to handle state properly
function updateState(newState) {
  console.log('Updating state:', newState);
  
  // Update state object with new values
  if (newState) {
    state = { ...state, ...newState };
  }
  
  // Ensure we have valid values
  state.timeLeft = typeof state.timeLeft === 'number' ? state.timeLeft : 0;
  state.totalTime = typeof state.totalTime === 'number' ? state.totalTime : 0;
  state.isPaused = Boolean(state.isPaused);
  state.currentCycle = typeof state.currentCycle === 'number' ? state.currentCycle : 1;
  state.totalCycles = typeof state.totalCycles === 'number' ? state.totalCycles : 1;
  
  // Store state in local storage
  chrome.storage.local.set({
    timeLeft: state.timeLeft,
    totalTime: state.totalTime,
    isPaused: state.isPaused,
    currentCycle: state.currentCycle,
    totalCycles: state.totalCycles,
    currentTimer: state.currentTimer || 'work'
  });
  
  // Create the update message
  const updateMessage = {
    type: 'TIMER_UPDATE',
    timeLeft: state.timeLeft,
    totalTime: state.totalTime,
    isPaused: state.isPaused,
    currentCycle: state.currentCycle,
    totalCycles: state.totalCycles,
    currentTimer: state.currentTimer || 'work'
  };
  
  // Send to popup
  sendMessageToPopup(updateMessage);
  
  // Broadcast to all tabs (for floating task panel)
  notifyAllTabs(updateMessage);
}

// Update startTimer function to use state
function startTimer(minutes, seconds, timerType) {
  console.log('Starting timer:', minutes, 'minutes', seconds, 'seconds');
  
  // Ensure we have valid numbers
  const mins = parseInt(minutes) || 0;
  const secs = parseInt(seconds) || 0;
  
  if (mins !== undefined && secs !== undefined) {
    state.timeLeft = (mins * 60) + secs;
    state.totalTime = state.timeLeft;
  }
  
  // Ensure timeLeft is valid
  if (!state.timeLeft || isNaN(state.timeLeft)) {
    console.error('Invalid timer duration');
    return;
  }
  
  state.isPaused = false;
  clearInterval(timer);
  
  // Track statistics
  if (timerType === 'work') {
    updatePomodoroStats('workCycleStart', 0);
  }
  
  timer = setInterval(() => {
    if (state.timeLeft <= 0) {
      if (timerType === 'transition') {
        // When transition ends, start break timer
        startBreakTimer();
      } else {
        // Track statistics for completed timer
        if (timerType === 'work') {
          updatePomodoroStats('workTime', state.totalTime);
        } else if (timerType === 'break') {
          updatePomodoroStats('breakTime', state.totalTime);
        }
        
        handleTimerComplete(timerType);
      }
      return;
    }
    
    state.timeLeft--;
    updateState();
    
    // Use helper function instead of direct message
    sendMessageToPopup({
      type: 'TIMER_UPDATE',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime
    });
  }, 1000);
  
  updateState();
}

// Update pauseTimer function to use state
function pauseTimer() {
  console.log('Pausing timer');
  clearInterval(timer);
  state.isPaused = true;
  updateState();
  
  sendMessageToPopup({
    type: 'TIMER_PAUSED'
  });
}

// Update resumeTimer function to use state
function resumeTimer(timerType) {
  console.log('Resuming timer');
  state.isPaused = false;
  
  // Restart the interval with current timeLeft
  timer = setInterval(() => {
    if (state.timeLeft <= 0) {
      if (timerType === 'transition') {
        startBreakTimer();
      } else {
        handleTimerComplete(timerType);
      }
      return;
    }
    
    state.timeLeft--;
    updateState();
    
    sendMessageToPopup({
      type: 'TIMER_UPDATE',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime
    });
  }, 1000);
  
  updateState();
  
  sendMessageToPopup({
    type: 'TIMER_RESUMED'
  });
}

// Update stopTimer function to use state
function stopTimer() {
  console.log('Stopping timer');
  clearInterval(timer);
  timer = null;
  state.timeLeft = 0;
  state.totalTime = 0;
  state.isPaused = false;
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

// Initialize statistics tracking
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['pomodoroStats'], (result) => {
    if (!result.pomodoroStats) {
      const initialStats = {
        totalWorkCycles: 0,
        tasksCompleted: 0,
        totalWorkTime: 0, // in seconds
        totalBreakTime: 0, // in seconds
        totalSessionTime: 0, // in seconds
        firstUseDate: Date.now(),
        lastActiveDate: Date.now(),
        currentStreak: 1, // days
        activityLog: [] // array of daily summaries
      };
      chrome.storage.sync.set({ pomodoroStats: initialStats });
    }
  });
});

// Track session start time
let sessionStartTime = Date.now();

// Helper function to update statistics
function updatePomodoroStats(statType, value) {
  chrome.storage.sync.get(['pomodoroStats'], (result) => {
    const stats = result.pomodoroStats || {
      totalWorkCycles: 0,
      tasksCompleted: 0,
      totalWorkTime: 0,
      totalBreakTime: 0,
      totalSessionTime: 0,
      firstUseDate: Date.now(),
      lastActiveDate: Date.now(),
      currentStreak: 1,
      activityLog: []
    };
    
    // Update last active date and check streak
    const today = new Date().setHours(0, 0, 0, 0);
    const lastActive = new Date(stats.lastActiveDate).setHours(0, 0, 0, 0);
    
    if (today > lastActive) {
      // Check if it's consecutive day
      const dayDiff = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));
      if (dayDiff === 1) {
        // Consecutive day
        stats.currentStreak += 1;
      } else if (dayDiff > 1) {
        // Streak broken
        stats.currentStreak = 1;
      }
    }
    
    stats.lastActiveDate = Date.now();
    
    // Update specific statistic
    switch (statType) {
      case 'workCycleStart':
        stats.totalWorkCycles += 1;
        break;
      case 'taskCompleted':
        stats.tasksCompleted += 1;
        break;
      case 'workTime':
        stats.totalWorkTime += value;
        break;
      case 'breakTime':
        stats.totalBreakTime += value;
        break;
    }
    
    // Calculate total session time
    stats.totalSessionTime = stats.totalWorkTime + stats.totalBreakTime;
    
    // Log daily activity
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLog = stats.activityLog.find(log => log.date === todayStr);
    
    if (todayLog) {
      // Update existing log for today
      if (statType === 'workCycleStart') todayLog.cyclesStarted += 1;
      if (statType === 'taskCompleted') todayLog.tasksCompleted = (todayLog.tasksCompleted || 0) + 1;
      if (statType === 'workTime') todayLog.workTime += value;
      if (statType === 'breakTime') todayLog.breakTime += value;
    } else {
      // Create new log for today
      const newLog = {
        date: todayStr,
        cyclesStarted: statType === 'workCycleStart' ? 1 : 0,
        tasksCompleted: statType === 'taskCompleted' ? 1 : 0,
        workTime: statType === 'workTime' ? value : 0,
        breakTime: statType === 'breakTime' ? value : 0
      };
      stats.activityLog.push(newLog);
      
      // Keep only last 30 days in the log
      if (stats.activityLog.length > 30) {
        stats.activityLog.shift(); // Remove oldest entry
      }
    }
    
    chrome.storage.sync.set({ pomodoroStats: stats });
  });
}

// Helper function to specifically increment task completion count
function incrementTaskCompletionCount() {
  console.log('Incrementing task completion count');
  
  chrome.storage.sync.get(['pomodoroStats'], (result) => {
    const stats = result.pomodoroStats || {
      totalWorkCycles: 0,
      tasksCompleted: 0,
      totalWorkTime: 0,
      totalBreakTime: 0,
      totalSessionTime: 0,
      firstUseDate: Date.now(),
      lastActiveDate: Date.now(),
      currentStreak: 1,
      activityLog: []
    };
    
    // Increment the counter
    stats.tasksCompleted += 1;
    console.log(`Tasks completed incremented to: ${stats.tasksCompleted}`);
    
    // Update the log for today
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLog = stats.activityLog.find(log => log.date === todayStr);
    
    if (todayLog) {
      todayLog.tasksCompleted = (todayLog.tasksCompleted || 0) + 1;
    } else {
      stats.activityLog.push({
        date: todayStr,
        cyclesStarted: 0,
        tasksCompleted: 1,
        workTime: 0,
        breakTime: 0
      });
    }
    
    // Save the updated stats
    chrome.storage.sync.set({ pomodoroStats: stats }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving task completion stats:', chrome.runtime.lastError);
      } else {
        console.log('Task completion stats saved successfully');
      }
    });
  });
} 