let currentAlarm = null;
let timeLeft = 0;
let timer = null;
let isPaused = false;
let breakTime = 0;
let notificationsEnabled = true;
let startTime = null;
let totalTime = null;

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
    const { focusTime, breakTime: newBreakTime, notificationsEnabled: newNotificationsEnabled } = message;
    timeLeft = focusTime;
    totalTime = focusTime;
    startTime = Date.now();
    breakTime = newBreakTime;
    notificationsEnabled = newNotificationsEnabled;
    currentAlarm = 'focus';
    startTimer();
    sendResponse({ success: true });
    return true;
  } else if (message.command === 'pause') {
    isPaused = !isPaused;
    if (isPaused) {
      clearInterval(timer);
      totalTime = timeLeft;
    } else {
      startTime = Date.now();
      startTimer();
    }
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

function startTimer() {
  clearInterval(timer);
  
  timer = setInterval(() => {
    if (!isPaused) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      timeLeft = Math.max(0, totalTime - elapsed);
      
      if (timeLeft <= 0) {
        clearInterval(timer);
        handleTimerComplete();
      }

      chrome.runtime.sendMessage({ 
        command: 'timeUpdate', 
        timeLeft 
      }).catch(() => {
        // Ignore errors when popup is closed
      });
    }
  }, 1000);
}

function handleTimerComplete() {
  clearInterval(timer);
  if (currentAlarm === 'focus') {
    timeLeft = breakTime;
    totalTime = breakTime;
    startTime = Date.now();
    currentAlarm = 'break';
    startTimer();
    
    chrome.runtime.sendMessage({ 
      command: 'showBreak',
      timeLeft: breakTime
    });
    
    if (notificationsEnabled) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon.png',
        title: 'Focus Time Over',
        message: 'Time for a break! Click to play games.',
        requireInteraction: true
      });
    }
  } else {
    resetTimer();
    chrome.runtime.sendMessage({ command: 'showFocus' });
    
    if (notificationsEnabled) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon.png',
        title: 'Break Time Over',
        message: 'Time to get back to work!'
      });
    }
  }
}

function resetTimer() {
  clearInterval(timer);
  timeLeft = 0;
  totalTime = 0;
  startTime = null;
  isPaused = false;
  currentAlarm = null;
  chrome.alarms.clearAll();
  chrome.notifications.getAll((notifications) => {
    Object.keys(notifications).forEach(key => {
      chrome.notifications.clear(key);
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