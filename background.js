let currentAlarm = null;
let timeLeft = 0;
let timer = null;
let isPaused = false;

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
      chrome.notifications.onClicked.addListener(() => {
        chrome.alarms.create('break', { delayInMinutes: breakTime / 60 });
        chrome.notifications.clear(notificationId);
      });
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
    const { focusTime, breakTime } = message;
    timeLeft = focusTime;
    startTimer(focusTime, breakTime);
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
  
  timer = setInterval(() => {
    if (!isPaused) {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(timer);
        handleTimerComplete(focusTime, breakTime);
      }
      // Broadcast time update to popup if it's open
      chrome.runtime.sendMessage({ command: 'timeUpdate', timeLeft });
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
      chrome.notifications.onClicked.addListener(() => {
        chrome.action.openPopup();
      });
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
  chrome.alarms.clearAll();
  chrome.notifications.getAll((notifications) => {
    Object.keys(notifications).forEach(key => {
      chrome.notifications.clear(key);
    });
  });
}