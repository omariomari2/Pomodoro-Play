let currentAlarm = null;

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
    startTimer(focusTime, breakTime);
    sendResponse({ success: true });
    return true; // Important: indicates async response
  } else if (message.command === 'reset') {
    if (currentAlarm) {
      chrome.alarms.clear(currentAlarm);
    }
    chrome.notifications.getAll((notifications) => {
      Object.keys(notifications).forEach(key => {
        chrome.notifications.clear(key);
      });
    });
    sendResponse({ success: true });
    return true;
  }
});

function startTimer(focusTime, breakTime) {
  // Clear any existing alarms
  chrome.alarms.clearAll();
  
  currentAlarm = 'focus';
  chrome.alarms.create('focus', { delayInMinutes: focusTime / 60 });
}