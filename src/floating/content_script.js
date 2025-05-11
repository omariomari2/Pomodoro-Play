// Use window to store state to prevent redeclaration
if (!window.pomodoroState) {
  window.pomodoroState = {
    isExtensionConnected: true,
    reconnectAttempts: 0,
    MAX_RECONNECT_ATTEMPTS: 3,
    lastUpdateTime: Date.now(),
    updateInterval: null
  };
}

// Content script for floating icon
console.log('%c POMODORO CONTENT SCRIPT LOADED!', 'background: #3f51b5; color: white; padding: 5px; border-radius: 3px; font-weight: bold;');
console.log('Loaded on page:', window.location.href);

// Add direct DOM check on load
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, checking for icon existence...');
  const existingIcon = document.getElementById('pomodoro-floating-icon');
  console.log('Existing icon found:', !!existingIcon);
});

// Check if we're already loaded
if (window.pomodoroPlayContentLoaded) {
  console.log('Content script already loaded, skipping initialization');
} else {
  // Mark as loaded
  window.pomodoroPlayContentLoaded = true;
  
  // Create the floating icon elements directly
  createFloatingElements();
  
  // Add state change listeners
  setupMessageListeners();
}

// Function to check extension connection
function checkExtensionConnection() {
  try {
    chrome.runtime.getURL('');
    window.pomodoroState.isExtensionConnected = true;
    window.pomodoroState.reconnectAttempts = 0;
    return true;
  } catch (error) {
    window.pomodoroState.isExtensionConnected = false;
    return false;
  }
}

// Function to handle extension disconnection
function handleExtensionDisconnection() {
  if (!window.pomodoroState.isExtensionConnected || window.pomodoroState.reconnectAttempts >= window.pomodoroState.MAX_RECONNECT_ATTEMPTS) {
    console.log('Extension disconnected, removing floating icon');
    if (window.pomodoroState.updateInterval) {
      clearInterval(window.pomodoroState.updateInterval);
    }
    const icon = document.getElementById('pomodoro-floating-icon');
    if (icon) {
      icon.remove();
    }
    return;
  }

  console.log(`Attempting to reconnect (attempt ${window.pomodoroState.reconnectAttempts + 1}/${window.pomodoroState.MAX_RECONNECT_ATTEMPTS})...`);
  window.pomodoroState.reconnectAttempts++;

  // Try to reload the content script
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/floating/content_script.js');
  script.onload = () => {
    console.log('Content script reloaded');
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// Function to create floating elements
function createFloatingElements() {
  console.log('Creating floating elements...');
  
  // Check if elements already exist
  if (document.getElementById('pomodoro-floating-icon')) {
    console.log('Floating icon already exists, not creating again');
    return;
  }

  // Create icon container
  const icon = document.createElement('div');
  icon.id = 'pomodoro-floating-icon';
  
  // Set initial display to none (hidden until toggled on)
  icon.style.display = 'none';
  
  // Add timer display elements
  const timerDisplay = document.createElement('div');
  timerDisplay.className = 'timer-display';
  timerDisplay.textContent = '00:00';
  
  const timerType = document.createElement('div');
  timerType.className = 'timer-type';
  timerType.textContent = 'Work Time';
  
  // Add elements to icon
  icon.appendChild(timerDisplay);
  icon.appendChild(timerType);
  
  // Add to body
  document.body.appendChild(icon);
  console.log('Added floating icon to body');
  
  // Add CSS
  const style = document.createElement('style');
  style.textContent = `
    #pomodoro-floating-icon {
      position: fixed;
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
      border-radius: 50%;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: move;
      user-select: none;
      z-index: 2147483647;
      border: 2px solid rgba(255, 255, 255, 0.6);
      color: white;
      font-family: Arial, sans-serif;
      transition: transform 0.2s, opacity 0.3s;
      opacity: 0.9;
    }
    
    #pomodoro-floating-icon:hover {
      opacity: 1;
      transform: scale(1.05);
    }
    
    #pomodoro-floating-icon .timer-display {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    #pomodoro-floating-icon .timer-type {
      font-size: 12px;
      opacity: 0.9;
    }
  `;
  document.head.appendChild(style);
  
  // Initialize dragging capability
  makeDraggable(icon);
  
  // Load saved position
  loadPosition(icon);
  
  // Check if icon should be visible immediately based on saved preferences
  if (checkExtensionConnection()) {
    chrome.storage.local.get(['floatingIconEnabled'], (result) => {
      console.log('Checked stored floating icon state:', result.floatingIconEnabled);
      if (result.floatingIconEnabled) {
        icon.style.display = 'flex';
        requestTimerState(); // Request state when creating icon
        startPeriodicChecks(); // Start periodic checks
      }
    });
  }
  
  // Start listening for timer updates
  setupMessageListeners();
}

// Update makeDraggable function with better error handling
function makeDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  element.onmousedown = dragMouseDown;
  
  function dragMouseDown(e) {
    e.preventDefault();
    if (!checkExtensionConnection()) {
      handleExtensionDisconnection();
      return;
    }
    
    try {
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    } catch (error) {
      console.error('Error in dragMouseDown:', error);
      handleExtensionDisconnection();
    }
  }
  
  function elementDrag(e) {
    e.preventDefault();
    if (!checkExtensionConnection()) {
      handleExtensionDisconnection();
      return;
    }
    
    try {
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
      element.style.right = '';
      element.style.bottom = '';
    } catch (error) {
      console.error('Error in elementDrag:', error);
      closeDragElement();
    }
  }
  
  function closeDragElement() {
    try {
      document.onmouseup = null;
      document.onmousemove = null;
      if (checkExtensionConnection()) {
        savePosition(element);
      }
    } catch (error) {
      console.error('Error in closeDragElement:', error);
      handleExtensionDisconnection();
    }
  }
}

// Update loadPosition function with better error handling
function loadPosition(element) {
  if (!checkExtensionConnection()) {
    handleExtensionDisconnection();
    return;
  }

  try {
    chrome.storage.local.get(['floatingIconPosition'], (result) => {
      if (result.floatingIconPosition) {
        element.style.top = result.floatingIconPosition.top;
        element.style.left = result.floatingIconPosition.left;
        if (result.floatingIconPosition.top && result.floatingIconPosition.left) {
          element.style.right = '';
          element.style.bottom = '';
        }
      }
    });
  } catch (error) {
    console.error('Error loading position:', error);
    handleExtensionDisconnection();
  }
}

// Update savePosition function with better error handling
function savePosition(element) {
  if (!checkExtensionConnection()) {
    handleExtensionDisconnection();
    return;
  }

  try {
    const position = {
      top: element.style.top,
      left: element.style.left
    };
    chrome.storage.local.set({ 'floatingIconPosition': position });
  } catch (error) {
    console.error('Error saving position:', error);
    handleExtensionDisconnection();
  }
}

// Function to handle timer updates
function handleTimerUpdate(message) {
  try {
    const icon = document.getElementById('pomodoro-floating-icon');
    if (!icon) return;

    const timerDisplay = icon.querySelector('.timer-display');
    const timerType = icon.querySelector('.timer-type');

    if (timerDisplay && message.timeLeft !== undefined) {
      const minutes = Math.floor(message.timeLeft / 60);
      const seconds = message.timeLeft % 60;
      timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    if (message.timerType && timerType) {
      switch(message.timerType) {
        case 'work':
          timerType.textContent = 'Work Time';
          icon.style.background = 'linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%)';
          break;
        case 'break':
          timerType.textContent = 'Break Time';
          icon.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
          break;
        case 'transition':
          timerType.textContent = 'Break Soon!';
          icon.style.background = 'linear-gradient(135deg, #eab308 0%, #f59e0b 100%)';
          break;
      }
    }

    window.pomodoroState.lastUpdateTime = Date.now();
  } catch (error) {
    console.error('Error updating timer:', error);
  }
}

// Function to request timer state
function requestTimerState() {
  if (!checkExtensionConnection()) {
    handleExtensionDisconnection();
    return;
  }

  try {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      if (response) {
        handleTimerUpdate({
          timeLeft: response.timeLeft,
          timerType: response.currentTimer
        });
      }
    });
  } catch (error) {
    console.error('Error requesting timer state:', error);
    handleExtensionDisconnection();
  }
}

// Function to start periodic state checks
function startPeriodicChecks() {
  if (window.pomodoroState.updateInterval) {
    clearInterval(window.pomodoroState.updateInterval);
  }

  window.pomodoroState.updateInterval = setInterval(() => {
    if (Date.now() - window.pomodoroState.lastUpdateTime > 2000) { // If no updates for 2 seconds
      requestTimerState();
    }
  }, 1000); // Check every second
}

// Update setupMessageListeners with periodic checks
function setupMessageListeners() {
  if (!checkExtensionConnection()) {
    handleExtensionDisconnection();
    return;
  }

  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!checkExtensionConnection()) {
        handleExtensionDisconnection();
        return;
      }

      try {
        if (message.type === 'TOGGLE_FLOATING_ICON') {
          const icon = document.getElementById('pomodoro-floating-icon');
          if (icon) {
            icon.style.display = message.visible ? 'flex' : 'none';
            if (message.visible) {
              requestTimerState(); // Request state when showing icon
              startPeriodicChecks(); // Start periodic checks
            } else {
              if (window.pomodoroState.updateInterval) {
                clearInterval(window.pomodoroState.updateInterval);
              }
            }
            sendResponse({ success: true, display: icon.style.display });
          } else if (message.visible) {
            createFloatingElements();
            const newIcon = document.getElementById('pomodoro-floating-icon');
            if (newIcon) {
              newIcon.style.display = 'flex';
              requestTimerState(); // Request state when creating icon
              startPeriodicChecks(); // Start periodic checks
              sendResponse({ success: true, created: true });
            } else {
              sendResponse({ success: false, error: 'Failed to create icon' });
            }
          } else {
            sendResponse({ success: true, message: 'No action needed' });
          }
        } else if (message.type === 'TIMER_UPDATE') {
          handleTimerUpdate(message);
          sendResponse({ success: true });
        }
      } catch (error) {
        console.error('Error handling message:', error);
        handleExtensionDisconnection();
        sendResponse({ success: false, error: error.message });
      }
      return true;
    });

    // Request initial state
    requestTimerState();
    startPeriodicChecks();
  } catch (error) {
    console.error('Error setting up message listeners:', error);
    handleExtensionDisconnection();
  }
} 