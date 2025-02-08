let currentAlarm = null;
let timeLeft = 0;
let timer = null;
let isPaused = false;
let breakTime = 0;

// Move the alarm listener outside of startTimer
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'focus') {
    currentAlarm = 'break';
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon.png',
      title: 'Focus Time Over',
      message: 'Take a break! Click to start your break timer.'
    }, (notificationId) => {
      handleNotificationClick(notificationId);
    });
  } else if (alarm.name === 'break') {
    currentAlarm = null;
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon.png',
      title: 'Break Time Over',
      message: 'Time to get back to work!'
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'start') {
    const { focusTime, breakTime: newBreakTime } = message;
    timeLeft = focusTime;
    breakTime = newBreakTime;
    startTimer(focusTime, newBreakTime);
    sendResponse({ success: true });
    return true;
  } else if (message.command === 'pause') {
    isPaused = !isPaused;
    sendResponse({ success: true, isPaused });
    return true;
  } else if (message.command === 'reset') {
    resetTimer();
    sendResponse({ success: true });
    return true;
  } else if (message.command === 'getTime') {
    sendResponse({ timeLeft, isPaused });
    return true;
  }
});

function startTimer(focusTime, breakTime) {
  clearInterval(timer);
  chrome.alarms.clearAll();
  
  const startTime = Date.now();
  const totalTime = timeLeft;
  
  timer = setInterval(() => {
    if (!isPaused) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      timeLeft = Math.max(0, totalTime - elapsed);
      
      if (timeLeft <= 0) {
        clearInterval(timer);
        handleTimerComplete(focusTime, breakTime);
      }
      // Broadcast time update to popup if it's open
      chrome.runtime.sendMessage({ command: 'timeUpdate', timeLeft }).catch(() => {
        // Ignore errors when popup is closed
      });
    }
  }, 1000);
}

function handleTimerComplete(focusTime, breakTime) {
  if (currentAlarm === 'focus') {
    currentAlarm = 'break';
    timeLeft = breakTime;
    startTimer(focusTime, breakTime);
    
    // Notify all open popups to show break UI
    chrome.runtime.sendMessage({ 
      command: 'showBreak',
      timeLeft: breakTime
    });
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon.png',
      title: 'Focus Time Over',
      message: 'Time for a break! Click to view break activities.'
    }, (notificationId) => {
      handleNotificationClick(notificationId);
    });
  } else {
    currentAlarm = 'focus';
    resetTimer();
    chrome.runtime.sendMessage({ command: 'showFocus' });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon.png',
      title: 'Break Time Over',
      message: 'Time to get back to work!'
    });
  }
}

function resetTimer() {
  clearInterval(timer);
  timeLeft = 0;
  isPaused = false;
  currentAlarm = null;
  chrome.alarms.clearAll().catch(err => {
    console.error('Failed to clear alarms:', err);
  });
  chrome.notifications.getAll((notifications) => {
    Object.keys(notifications).forEach(key => {
      chrome.notifications.clear(key).catch(err => {
        console.error('Failed to clear notification:', err);
      });
    });
  });
}

// Create a named handler function
function handleNotificationClick(notificationId) {
  chrome.notifications.clear(notificationId);
  chrome.alarms.create('break', { delayInMinutes: breakTime / 60 });
  // Remove the listener after handling the click
  chrome.notifications.onClicked.removeListener(handleNotificationClick);
}

// Add at the end of the file
chrome.runtime.onSuspend.addListener(() => {
  clearInterval(timer);
  chrome.alarms.clearAll();
  chrome.notifications.getAll((notifications) => {
    Object.keys(notifications).forEach(key => {
      chrome.notifications.clear(key);
    });
  });
});