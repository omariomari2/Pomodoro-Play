chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === 'start') {
      const { focusTime, breakTime } = message;
      startTimer(focusTime, breakTime);
      sendResponse({ success: true });
    }
  });
  
  function startTimer(focusTime, breakTime) {
    chrome.alarms.create('focus', { delayInMinutes: focusTime / 60 });
  
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'focus') {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Focus Time Over',
          message: 'Take a break! Click to start your break timer.'
        }, (notificationId) => {
          chrome.notifications.onClicked.addListener(() => {
            chrome.alarms.create('break', { delayInMinutes: breakTime / 60 });
            chrome.notifications.clear(notificationId);
          });
        });
      } else if (alarm.name === 'break') {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Break Time Over',
          message: 'Time to get back to work!'
        });
        startTimer(focusTime, breakTime); // Restart the cycle
      }
    });
  }