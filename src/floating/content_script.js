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

// Function to create floating elements
function createFloatingElements() {
  console.log('Creating floating elements...');
  
  // Check if elements already exist
  if (document.getElementById('pomodoro-floating-icon')) {
    console.log('Floating icon already exists, not creating again');
    return;
  }

  // Create icon element
  const icon = document.createElement('div');
  icon.id = 'pomodoro-floating-icon';
  
  // Set initial display to none (hidden until toggled on)
  icon.style.display = 'none';
  
  // Add clock icon
  const iconImg = document.createElement('img');
  iconImg.src = chrome.runtime.getURL('src/assets/icons/clock1.png');
  iconImg.alt = 'Pomodoro Timer';
  icon.appendChild(iconImg);
  
  // Create timer panel
  const timerPanel = document.createElement('div');
  timerPanel.id = 'pomodoro-floating-timer';
  
  // Create timer content
  timerPanel.innerHTML = `
    <button class="close-btn">&times;</button>
    <div class="timer-type">Work Time</div>
    <div class="timer-display">25:00</div>
    <div class="cycle-display">Cycle 1 of 1</div>
    <div class="progress-container">
      <div class="progress-bar" style="width: 100%;"></div>
    </div>
    <div class="timer-actions">
      <button class="timer-btn pause-btn">Pause</button>
      <button class="timer-btn stop-btn">Stop</button>
    </div>
  `;
  
  // Add elements to body
  document.body.appendChild(icon);
  document.body.appendChild(timerPanel);
  console.log('Added floating elements to body');
  
  // Add CSS
  const linkElement = document.createElement('link');
  linkElement.rel = 'stylesheet';
  linkElement.href = chrome.runtime.getURL('src/floating/floating.css');
  document.head.appendChild(linkElement);
  
  // Initialize dragging capability
  makeDraggable(icon);
  
  // Initialize event listeners
  initializeEventListeners(icon, timerPanel);
  
  // Load saved position
  loadPosition(icon);
  
  // Check if icon should be visible immediately based on saved preferences
  chrome.storage.local.get(['floatingIconEnabled'], (result) => {
    console.log('Checked stored floating icon state:', result.floatingIconEnabled);
    if (result.floatingIconEnabled) {
      icon.style.display = 'flex';
      console.log('Set icon display to flex based on stored preference');
    }
  });
}

// Make an element draggable
function makeDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  element.onmousedown = dragMouseDown;
  
  function dragMouseDown(e) {
    e.preventDefault();
    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // Call a function whenever the cursor moves
    document.onmousemove = elementDrag;
  }
  
  function elementDrag(e) {
    e.preventDefault();
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // Set the element's new position
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
    // Clear right/bottom if set
    element.style.right = '';
    element.style.bottom = '';
  }
  
  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
    
    // Save position
    savePosition(element);
  }
}

// Save element position
function savePosition(element) {
  const position = {
    top: element.style.top,
    left: element.style.left
  };
  
  chrome.storage.local.set({ 'floatingIconPosition': position });
}

// Load saved position
function loadPosition(element) {
  chrome.storage.local.get(['floatingIconPosition'], (result) => {
    if (result.floatingIconPosition) {
      element.style.top = result.floatingIconPosition.top;
      element.style.left = result.floatingIconPosition.left;
      // Clear default right/bottom if custom position loaded
      if (result.floatingIconPosition.top && result.floatingIconPosition.left) {
        element.style.right = '';
        element.style.bottom = '';
      }
    }
  });
}

// Initialize event listeners
function initializeEventListeners(icon, timerPanel) {
  // Toggle timer panel when icon is clicked
  icon.addEventListener('click', (e) => {
    // Prevent this from triggering drag
    if (!e.isTrusted) return;
    
    timerPanel.classList.toggle('visible');
    updateTimerState();
  });
  
  // Close timer panel
  const closeBtn = timerPanel.querySelector('.close-btn');
  closeBtn.addEventListener('click', () => {
    timerPanel.classList.remove('visible');
  });
  
  // Pause/resume button
  const pauseBtn = timerPanel.querySelector('.pause-btn');
  pauseBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ 
      type: pauseBtn.textContent === 'Pause' ? 'PAUSE_TIMER' : 'START_TIMER',
      timerType: getCurrentTimerType() 
    }, () => {
      updateTimerState();
    });
  });
  
  // Stop button
  const stopBtn = timerPanel.querySelector('.stop-btn');
  stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_TIMER' }, () => {
      timerPanel.classList.remove('visible');
    });
  });
}

// Get current timer type
function getCurrentTimerType() {
  return document.querySelector('.timer-type').textContent.toLowerCase().includes('work') ? 'work' : 
         document.querySelector('.timer-type').textContent.toLowerCase().includes('break') ? 'break' : 'transition';
}

// Update timer state from background
function updateTimerState() {
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
    if (!response) return;
    
    const timerPanel = document.getElementById('pomodoro-floating-timer');
    if (!timerPanel) return;
    
    const timeLeft = response.timeLeft;
    const totalTime = response.totalTime;
    const isPaused = response.isPaused;
    const currentCycle = response.currentCycle || 1;
    const totalCycles = response.totalCycles || 1;
    
    // Get elements
    const timerType = timerPanel.querySelector('.timer-type');
    const timerDisplay = timerPanel.querySelector('.timer-display');
    const cycleDisplay = timerPanel.querySelector('.cycle-display');
    const progressBar = timerPanel.querySelector('.progress-bar');
    const pauseBtn = timerPanel.querySelector('.pause-btn');
    
    // Format time
    if (timeLeft !== undefined) {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    // Update cycle display
    cycleDisplay.textContent = `Cycle ${currentCycle} of ${totalCycles}`;
    
    // Update pause button
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    
    // Update progress
    if (timeLeft !== undefined && totalTime !== undefined) {
      const percentage = (timeLeft / totalTime) * 100;
      progressBar.style.width = `${percentage}%`;
    }
    
    // Get timer type from background
    chrome.storage.local.get(['currentTimer'], (result) => {
      if (result.currentTimer) {
        switch(result.currentTimer) {
          case 'work':
            timerType.textContent = 'Work Time';
            timerType.style.color = '#4f46e5';
            break;
          case 'break':
            timerType.textContent = 'Break Time';
            timerType.style.color = '#059669';
            break;
          case 'transition':
            timerType.textContent = 'Get Ready for Break!';
            timerType.style.color = '#eab308';
            break;
        }
      }
    });
  });
}

// Setup message listeners
function setupMessageListeners() {
  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    
    if (message.type === 'TOGGLE_FLOATING_ICON') {
      console.log('Toggling floating icon visibility:', message.visible);
      
      const icon = document.getElementById('pomodoro-floating-icon');
      if (icon) {
        icon.style.display = message.visible ? 'flex' : 'none';
        console.log('Set icon display to:', icon.style.display);
        sendResponse({ success: true, display: icon.style.display });
      } else if (message.visible) {
        console.log('Icon not found, creating elements');
        createFloatingElements();
        const newIcon = document.getElementById('pomodoro-floating-icon');
        if (newIcon) {
          newIcon.style.display = 'flex';
          sendResponse({ success: true, created: true });
        } else {
          sendResponse({ success: false, error: 'Failed to create icon' });
        }
      } else {
        sendResponse({ success: true, message: 'No action needed' });
      }
    }
    
    return true; // Keep the message channel open for async responses
  });
} 