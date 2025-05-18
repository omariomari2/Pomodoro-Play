// Use window to store state to prevent redeclaration
if (!window.pomodoroState) {
  window.pomodoroState = {
    isExtensionConnected: true,
    reconnectAttempts: 0,
    MAX_RECONNECT_ATTEMPTS: 3,
    lastUpdateTime: Date.now(),
    updateInterval: null,
    panelOpen: false
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
}

// Utility to safely call chrome APIs and handle extension context invalidation
function safeChromeCall(callback) {
  try {
    callback();
  } catch (e) {
    if (e.message && e.message.includes('Extension context invalidated')) {
      const icon = document.getElementById('pomodoro-floating-icon');
      const panel = document.getElementById('pomodoro-floating-panel');
      if (icon) icon.remove();
      if (panel) panel.remove();
    } else {
      console.error('Chrome API call failed:', e);
    }
  }
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
  if (document.getElementById('pomodoro-floating-icon')) return;

  // --- Floating Icon ---
  const icon = document.createElement('div');
  icon.id = 'pomodoro-floating-icon';
  icon.style.position = 'fixed';
  icon.style.width = '40px';
  icon.style.height = '40px';
  icon.style.borderRadius = '50%';
  icon.style.background = 'linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%)';
  icon.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
  icon.style.display = 'flex';
  icon.style.alignItems = 'center';
  icon.style.justifyContent = 'center';
  icon.style.cursor = 'pointer';
  icon.style.zIndex = '2147483647';
  icon.style.right = '20px';
  icon.style.bottom = '20px';
  icon.style.userSelect = 'none';
  icon.style.transition = 'box-shadow 0.2s';

  // Project icon (clock)
  const iconImg = document.createElement('img');
  iconImg.src = chrome.runtime.getURL('src/assets/icons/clock1.png');
  iconImg.alt = 'Pomodoro Timer';
  iconImg.style.width = '24px';
  iconImg.style.height = '24px';
  icon.appendChild(iconImg);

  // --- Expandable Panel ---
  const panel = document.createElement('div');
  panel.id = 'pomodoro-floating-panel';
  panel.style.position = 'fixed';
  panel.style.minWidth = '180px';
  panel.style.maxWidth = '220px';
  panel.style.height = '54px';
  panel.style.background = 'rgba(245,247,255,0.98)';
  panel.style.borderRadius = '12px';
  panel.style.boxShadow = '0 2px 12px rgba(0,0,0,0.18)';
  panel.style.display = 'none';
  panel.style.flexDirection = 'column';
  panel.style.justifyContent = 'center';
  panel.style.alignItems = 'stretch';
  panel.style.padding = '8px 12px 8px 12px';
  panel.style.zIndex = '2147483648';
  panel.style.transition = 'opacity 0.2s';

  // Panel content
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;width:100%;font-size:15px;font-weight:600;color:#222;">
      <span class="panel-timer-display">00:00</span>
    </div>
    <div class="panel-progress-container" style="width:100%;height:8px;background:#e0e7ff;border-radius:4px;margin-top:6px;overflow:hidden;">
      <div class="panel-progress-bar" style="height:100%;width:100%;background:linear-gradient(90deg,#6366f1 0%,#a5b4fc 100%);"></div>
    </div>
  `;

  // Add to DOM
  document.body.appendChild(icon);
  document.body.appendChild(panel);

  // Draggable icon
  makeDraggable(icon, panel);

  // Icon click toggles panel
  icon.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel(icon, panel);
  });

  // Close panel on outside click
  document.addEventListener('mousedown', (e) => {
    if (window.pomodoroState.panelOpen && !panel.contains(e.target) && !icon.contains(e.target)) {
      panel.style.display = 'none';
      window.pomodoroState.panelOpen = false;
    }
  });

  // Initial visibility
  safeChromeCall(() => {
    chrome.storage.local.get(['floatingIconEnabled'], (result) => {
      if (result.floatingIconEnabled) {
        icon.style.display = 'flex';
      } else {
        icon.style.display = 'none';
      }
    });
  });
}

function togglePanel(icon, panel) {
  // Decide left/right based on screen space and clamp to viewport
  const iconRect = icon.getBoundingClientRect();
  const panelWidth = panel.offsetWidth || 200;
  const spaceRight = window.innerWidth - iconRect.right;
  const spaceLeft = iconRect.left;
  let panelX, panelY;
  panelY = Math.max(8, Math.min(window.innerHeight - panel.offsetHeight - 8, iconRect.top - 7)); // clamp top
  if (spaceRight > panelWidth + 8) {
    // Show to right
    panelX = iconRect.right + 8;
    if (panelX + panelWidth > window.innerWidth - 8) panelX = window.innerWidth - panelWidth - 8;
    panel.style.left = panelX + 'px';
    panel.style.right = '';
  } else {
    // Show to left
    panelX = iconRect.left - panelWidth - 8;
    if (panelX < 8) panelX = 8;
    panel.style.left = panelX + 'px';
    panel.style.right = '';
  }
  panel.style.top = panelY + 'px';
  panel.style.display = (panel.style.display === 'none' ? 'flex' : 'none');
  window.pomodoroState.panelOpen = panel.style.display === 'flex';
  if (window.pomodoroState.panelOpen) {
    requestTimerState();
    startPanelPeriodicChecks(panel);
  } else {
    if (window.pomodoroState.panelInterval) clearInterval(window.pomodoroState.panelInterval);
  }
}

function makeDraggable(element, panel) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  element.onmousedown = dragMouseDown;
  function dragMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }
  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
    element.style.right = '';
    element.style.bottom = '';
    // Move panel with icon if open
    if (window.pomodoroState.panelOpen) {
      togglePanel(element, panel); // reposition
      panel.style.display = 'flex';
    }
  }
  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// Only update panel when timer is running
function handlePanelTimerUpdate(panel, message) {
  safeChromeCall(() => {
    // Only hide the panel if timer is not running
    const timerActive = message.timeLeft > 0;
    if (panel && !timerActive) panel.style.display = 'none';
    window.pomodoroState.panelOpen = panel && panel.style.display === 'flex' && timerActive;
    if (!timerActive) return;

    const timerDisplay = panel.querySelector('.panel-timer-display');
    const progressBar = panel.querySelector('.panel-progress-bar');
    // Update timer
    if (timerDisplay && message.timeLeft !== undefined) {
      const minutes = Math.floor(message.timeLeft / 60);
      const seconds = message.timeLeft % 60;
      timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    // Update progress bar
    if (progressBar && message.timeLeft !== undefined && message.totalTime) {
      const percent = Math.max(0, Math.min(100, (message.timeLeft / message.totalTime) * 100));
      progressBar.style.width = percent + '%';
    }
  });
}

function requestTimerState() {
  safeChromeCall(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      if (response) {
        const panel = document.getElementById('pomodoro-floating-panel');
        handlePanelTimerUpdate(panel, {
          timeLeft: response.timeLeft,
          timerType: response.currentTimer,
          totalTime: response.totalTime,
          isPaused: response.isPaused
        });
      }
    });
  });
}

function startPanelPeriodicChecks(panel) {
  if (window.pomodoroState.panelInterval) clearInterval(window.pomodoroState.panelInterval);
  window.pomodoroState.panelInterval = setInterval(() => {
    requestTimerState();
  }, 1000);
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.type === 'TOGGLE_FLOATING_ICON') {
      const icon = document.getElementById('pomodoro-floating-icon');
      if (icon) icon.style.display = message.visible ? 'flex' : 'none';
    } else if (message.type === 'TIMER_UPDATE') {
      const panel = document.getElementById('pomodoro-floating-panel');
      handlePanelTimerUpdate(panel, message);
    }
  } catch (e) {
    if (e.message && e.message.includes('Extension context invalidated')) {
      const icon = document.getElementById('pomodoro-floating-icon');
      const panel = document.getElementById('pomodoro-floating-panel');
      if (icon) icon.remove();
      if (panel) panel.remove();
    } else {
      console.error('Error in message listener:', e);
    }
  }
  return true;
});

// Initialize
if (!window.pomodoroPlayContentLoaded) {
  window.pomodoroPlayContentLoaded = true;
  createFloatingElements();
} 