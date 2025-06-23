let isPaused = false;

document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup loaded');
  // DOM elements
  const inputPage = document.getElementById('inputPage');
  const timerPage = document.getElementById('timerPage');
  const display = document.getElementById('display');
  const progressBar = document.getElementById('progress');
  const timerType = document.getElementById('timerType');
  
  // Input elements
  const workMinutesInput = document.getElementById('workMinutes');
  const workSecondsInput = document.getElementById('workSeconds');
  const breakMinutesInput = document.getElementById('breakMinutes');
  const breakSecondsInput = document.getElementById('breakSeconds');
  
  // Buttons
  const startTimerBtn = document.getElementById('startTimer');
  const pauseButton = document.getElementById('pauseTimer');
  const stopButton = document.getElementById('stopTimer');
  const openGamesButton = document.getElementById('openGamesButton');

  let workTime = 0;
  let breakTime = 0;

  // Initialize timer state
  initializeTimer();

  // Event listeners
  startTimerBtn.addEventListener('click', handleStart);
  pauseButton.addEventListener('click', handlePause);
  stopButton.addEventListener('click', handleStop);

  // Listen for timer updates and completion
  chrome.runtime.onMessage.addListener((message) => {
    console.log('Popup received message:', message);
    if (message.type === 'TIMER_UPDATE') {
      updateDisplay(message.timeLeft);
      updateProgress(message.timeLeft, message.totalTime);
    } else if (message.type === 'TIMER_PAUSED') {
      isPaused = true;
      pauseButton.textContent = 'Resume';
    } else if (message.type === 'TIMER_RESUMED') {
      isPaused = false;
      pauseButton.textContent = 'Pause';
    } else if (message.type === 'TIMER_COMPLETE') {
      const alarmSound = document.getElementById('alarmSound');
      if (alarmSound) {
        alarmSound.play();
      }
      
      chrome.storage.local.get(['currentTimer'], (result) => {
        if (result.currentTimer === 'work') {
          // Work timer completed, transition will start automatically
          updateTimerTypeText('transition');
        } else if (result.currentTimer === 'transition') {
          // Transition completed, break will start automatically
          updateTimerTypeText('break');
        } else {
          showInputPage();
          resetInputs();
        }
      });
    } else if (message.type === 'BREAK_STARTED') {
      showTimerPage();
      updateTimerTypeText('break');
    } else if (message.type === 'TRANSITION_STARTED') {
      showTimerPage();
      updateTimerTypeText('transition');
    } else if (message.type === 'CYCLE_UPDATE') {
      updateCycleCounter(message.currentCycle, message.totalCycles);
    } else if (message.type === 'WORK_STARTED') {
      showTimerPage();
      updateTimerTypeText('work');
      updateCycleCounter(message.currentCycle, message.totalCycles);
    }
  });

  // Add toggle view functionality
  const toggleBtn = document.getElementById('toggleView');
  const body = document.body;
  const miniProgress = document.getElementById('miniProgress');
  
  toggleBtn.addEventListener('click', () => {
    body.classList.toggle('minimized');
    // Update toggle button icon rotation
    if (body.classList.contains('minimized')) {
      toggleBtn.style.transform = 'rotate(180deg)';
    } else {
      toggleBtn.style.transform = 'rotate(0deg)';
    }
    // Store preference
    chrome.storage.local.set({
      isMinimized: body.classList.contains('minimized')
    });
  });

  // Check stored preference on load
  chrome.storage.local.get(['isMinimized'], (result) => {
    if (result.isMinimized) {
      body.classList.add('minimized');
      toggleBtn.style.transform = 'rotate(180deg)';
    }
  });

  // When "Play Games" is clicked, open games.html in a new tab.
  if (openGamesButton) {
    openGamesButton.addEventListener('click', () => {
      console.log('Opening games page');
      // First check if we're in break time
      chrome.storage.local.get(['currentTimer', 'timeLeft'], (result) => {
        console.log('Current Timer State:', result);
        if (result.currentTimer === 'break' && result.timeLeft > 0) {
          chrome.tabs.create({ 
            url: chrome.runtime.getURL('src/games/games.html')
          }, (tab) => {
            if (chrome.runtime.lastError) {
              console.error('Failed to open games:', chrome.runtime.lastError);
              alert('Failed to open games. Please try again.');
            }
          });
        } else {
          alert('Games can only be played during break time!');
        }
      });
    });
  }

  // Check for any missed updates stored in chrome.storage
  chrome.storage.local.get(['lastTimerUpdate'], (result) => {
    if (result.lastTimerUpdate) {
      const message = result.lastTimerUpdate;
      console.log("Popup loaded with a stored message:", message);
      
      // Process different message types
      if (message.type === 'TIMER_UPDATE') {
        updateDisplay(message.timeLeft);
        updateProgress(message.timeLeft, message.totalTime);
      } else if (message.type === 'CYCLE_UPDATE' || message.type === 'WORK_STARTED') {
        if (message.currentCycle && message.totalCycles) {
          updateCycleCounter(message.currentCycle, message.totalCycles);
        }
      } else if (message.type === 'BREAK_STARTED') {
        updateTimerTypeText('break');
      } else if (message.type === 'TRANSITION_STARTED') {
        updateTimerTypeText('transition');
      }
    }
  });

  // Listen for incoming messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Popup received message:", message);
    
    // Handle different message types
    switch (message.type) {
      case 'TIMER_UPDATE':
        updateDisplay(message.timeLeft);
        updateProgress(message.timeLeft, message.totalTime);
        break;
      case 'TIMER_PAUSED':
        isPaused = true;
        pauseButton.textContent = 'Resume';
        break;
      case 'TIMER_RESUMED':
        isPaused = false;
        pauseButton.textContent = 'Pause';
        break;
      case 'CYCLE_UPDATE':
        updateCycleCounter(message.currentCycle, message.totalCycles);
        break;
      case 'WORK_STARTED':
        showTimerPage();
        updateTimerTypeText('work');
        updateCycleCounter(message.currentCycle, message.totalCycles);
        break;
      case 'BREAK_STARTED':
        showTimerPage();
        updateTimerTypeText('break');
        break;
      case 'TRANSITION_STARTED':
        showTimerPage();
        updateTimerTypeText('transition');
        break;
    }
    
    // Send immediate response
    sendResponse({ received: true });
    return false; // Don't keep the message channel open
  });

  // Todo List Implementation
  const todoToggle = document.getElementById('todo-toggle');
  const todoList = document.getElementById('todo-list');
  const mainContent = document.querySelector('.main-content');
  const taskInput = document.getElementById('task-input');
  const addTaskButton = document.getElementById('add-task');
  const tasksList = document.getElementById('tasks-list');

  todoToggle.addEventListener('mouseenter', () => {
    todoToggle.style.opacity = '1';
  });

  todoToggle.addEventListener('mouseleave', () => {
    todoToggle.style.opacity = '0.7';
  });

  todoToggle.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent document click from immediately closing the panel
    
    // Force expand popup if it's minimized when opening tasks
    if (body.classList.contains('minimized')) {
      body.classList.remove('minimized');
      toggleBtn.style.transform = 'rotate(0deg)';
      // Store preference
      chrome.storage.local.set({
        isMinimized: false
      });
    }
    
    todoList.classList.toggle('visible');
    
    // Focus on the input if the panel is visible
    if (todoList.classList.contains('visible')) {
      setTimeout(() => {
        taskInput.focus();
      }, 300); // Wait for animation to complete
    }
  });

  // Close task panel when clicking outside
  document.addEventListener('click', (e) => {
    if (todoList.classList.contains('visible') && 
        !todoList.contains(e.target) && 
        e.target !== todoToggle) {
      todoList.classList.remove('visible');
    }
  });

  // Load existing tasks
  loadTasks();

  // Add task on button click
  addTaskButton.addEventListener('click', addTask);

  // Add task on Enter key
  taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addTask();
    }
  });

  function addTask() {
    const taskText = taskInput.value.trim();
    if (taskText === '') return;

    const task = {
      id: Date.now(),
      text: taskText,
      completed: false
    };

    // Save to storage and update UI
    chrome.storage.sync.get(['tasks'], (result) => {
      const tasks = result.tasks || [];
      tasks.push(task);
      chrome.storage.sync.set({ tasks }, () => {
        createTaskElement(task);
        taskInput.value = '';
      });
    });
  }

  function loadTasks() {
    chrome.storage.sync.get(['tasks'], (result) => {
      const tasks = result.tasks || [];
      tasks.forEach(task => createTaskElement(task));
    });
  }

  function createTaskElement(task) {
    const taskElement = document.createElement('div');
    taskElement.className = `task-item ${task.completed ? 'completed' : ''}`;
    taskElement.dataset.id = task.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.addEventListener('change', () => toggleTask(task.id));

    const taskText = document.createElement('span');
    taskText.textContent = task.text;

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-task';
    deleteButton.innerHTML = '&times;';
    deleteButton.addEventListener('click', () => deleteTask(task.id));

    taskElement.appendChild(checkbox);
    taskElement.appendChild(taskText);
    taskElement.appendChild(deleteButton);
    tasksList.appendChild(taskElement);
  }

  function toggleTask(taskId) {
    chrome.storage.sync.get(['tasks'], (result) => {
      const tasks = result.tasks || [];
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex > -1) {
        // If task is being marked as completed
        if (!tasks[taskIndex].completed) {
          // Update stats when task is completed
          updateTaskCompletionStats();
        }
        
        tasks[taskIndex].completed = !tasks[taskIndex].completed;
        chrome.storage.sync.set({ tasks }, () => {
          const taskElement = document.querySelector(`[data-id="${taskId}"]`);
          taskElement.classList.toggle('completed');
        });
      }
    });
  }

  // Update task completion statistics
  function updateTaskCompletionStats() {
    console.log("Updating task completion stats");
    // Send message to background script to update task completion stats
    chrome.runtime.sendMessage({
      type: 'UPDATE_STATS',
      statType: 'taskCompleted',
      value: 1
    }, response => {
      console.log("Stats update response:", response);
      // Refresh stats immediately for better user feedback
      loadAndDisplayStats();
    });
  }

  function deleteTask(taskId) {
    chrome.storage.sync.get(['tasks'], (result) => {
      const tasks = result.tasks || [];
      const updatedTasks = tasks.filter(t => t.id !== taskId);
      chrome.storage.sync.set({ tasks: updatedTasks }, () => {
        const taskElement = document.querySelector(`[data-id="${taskId}"]`);
        taskElement.remove();
      });
    });
  }

  function initializeTimer() {
    chrome.storage.local.get(['timeLeft', 'totalTime', 'isPaused', 'currentTimer', 'currentCycle', 'totalCycles'], (result) => {
      console.log('Initializing timer with state:', result);
      if (result.timeLeft !== undefined && result.timeLeft > 0) {
        showTimerPage();
        updateDisplay(result.timeLeft);
        updateProgress(result.timeLeft, result.totalTime);
        isPaused = result.isPaused || false;
        
        // Make sure we show the correct timer type
        if (result.currentTimer === 'transition') {
          updateTimerTypeText('transition');
        } else if (result.currentTimer === 'break') {
          updateTimerTypeText('break');
        } else {
          updateTimerTypeText('work');
        }
        
        // Update cycle counter if available
        if (result.currentCycle !== undefined && result.totalCycles !== undefined) {
          updateCycleCounter(result.currentCycle, result.totalCycles);
        }
        
        pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
      } else {
        showInputPage();
        resetInputs();
      }
    });
  }

  function handleStart() {
    const workMinutes = parseInt(workMinutesInput.value) || 0;
    const workSeconds = parseInt(workSecondsInput.value) || 0;
    const breakMinutes = parseInt(breakMinutesInput.value) || 0;
    const breakSeconds = parseInt(breakSecondsInput.value) || 0;
    const cycles = parseInt(document.getElementById('repeatCycles').value) || 1;
    
    if ((workMinutes === 0 && workSeconds === 0) || (breakMinutes === 0 && breakSeconds === 0)) {
      alert('Please set both work and break timers.');
      return;
    }

    // Calculate work and break times without adding 15 seconds here
    workTime = workMinutes * 60 + workSeconds;
    breakTime = breakMinutes * 60 + breakSeconds;

    chrome.storage.local.set({
      workTime,
      breakTime,
      currentTimer: 'work',
      currentCycle: 1,
      totalCycles: cycles
    });

    chrome.runtime.sendMessage({
      type: 'START_TIMER',
      minutes: workMinutes,
      seconds: workSeconds,
      timerType: 'work',
      cycles: cycles
    });
    
    showTimerPage();
    updateTimerTypeText('work');
    updateCycleCounter(1, cycles);
  }

  function handlePause() {
    isPaused = !isPaused;
    
    chrome.storage.local.get(['currentTimer'], (result) => {
      if (isPaused) {
        chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
        pauseButton.textContent = 'Resume';
      } else {
        chrome.runtime.sendMessage({ 
          type: 'START_TIMER',
          timerType: result.currentTimer 
        });
        pauseButton.textContent = 'Pause';
      }
    });
  }

  function handleStop() {
    chrome.runtime.sendMessage({ type: 'STOP_TIMER' });
    chrome.storage.local.clear(() => {
      showInputPage();
      resetInputs();
    });
  }

  function handleStartBreak() {
    const minutes = Math.floor(breakTime / 60);
    const seconds = breakTime % 60;

    // Reset games page state when starting a new break
    chrome.storage.local.set({
      currentTimer: 'break',
      timeLeft: breakTime,
      totalTime: breakTime,
      gamesPageOpen: false  // Reset the games page state
    });

    chrome.runtime.sendMessage({
      type: 'START_TIMER',
      minutes,
      seconds,
      timerType: 'break'
    });

    showTimerPage();
    updateTimerTypeText('break');
  }

  function showTimerPage() {
    inputPage.classList.add('hidden');
    timerPage.classList.remove('hidden');
  }

  function showInputPage() {
    timerPage.classList.add('hidden');
    inputPage.classList.remove('hidden');
  }

  function resetInputs() {
    workMinutesInput.value = '';
    workSecondsInput.value = '';
    breakMinutesInput.value = '';
    breakSecondsInput.value = '';
    progressBar.style.width = '100%';
    display.textContent = '00:00';
  }

  function updateDisplay(time) {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    const display = document.getElementById('display');
    const miniDisplay = document.getElementById('miniDisplay');
    
    if (display) display.textContent = timeString;
    if (miniDisplay) miniDisplay.textContent = timeString;
  }

  function updateProgress(timeLeft, totalTime) {
    const percentage = (timeLeft / totalTime) * 100;
    const progressBar = document.querySelector('.progress-bar');
    const miniProgress = document.getElementById('miniProgress');
    
    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (miniProgress) miniProgress.style.width = `${percentage}%`;
  }

  // Function to update the timer type text
  function updateTimerTypeText(timerType) {
    const timerTypeElement = document.getElementById('timerType');
    const miniTimerType = document.getElementById('miniTimerType');
    
    if (timerTypeElement && miniTimerType) {
      let text, color;
      
      switch(timerType) {
        case 'work':
          text = 'Work Time';
          color = '#4f46e5';
          // Show pause button, hide games button during work time
          pauseButton.classList.remove('hidden');
          openGamesButton.classList.add('hidden');
          break;
        case 'break':
          text = 'Break Time';
          color = '#059669';
          // Hide pause button, show games button during break time
          pauseButton.classList.add('hidden');
          openGamesButton.classList.remove('hidden');
          break;
        case 'transition':
          text = 'Get Ready for Break!';
          color = '#eab308';
          // Show pause button, hide games button during transition
          pauseButton.classList.remove('hidden');
          openGamesButton.classList.add('hidden');
          break;
      }
      
      timerTypeElement.textContent = text;
      timerTypeElement.style.color = color;
      
      miniTimerType.textContent = text;
      miniTimerType.dataset.type = timerType;
    }
  }

  // Add a new function to update cycle counter
  function updateCycleCounter(current, total) {
    const cycleCounter = document.getElementById('cycleCounter');
    if (cycleCounter) {
      cycleCounter.textContent = `Cycle ${current} of ${total}`;
    }
  }

  chrome.runtime.sendMessage({ type: 'DEBUG_TEST' }, (response) => {
    console.log("Debug test response:", response);
  });

  // Stats Panel Implementation
  const reviewStatsButton = document.getElementById('review-stats');
  const statsPanel = document.getElementById('stats-panel');
  const closeStatsButton = document.getElementById('close-stats');
  
  // Show stats panel on button click
  reviewStatsButton.addEventListener('click', (e) => {
    e.stopPropagation();
    loadAndDisplayStats();
    statsPanel.classList.add('visible');
  });
  
  // Close stats panel
  closeStatsButton.addEventListener('click', () => {
    statsPanel.classList.remove('visible');
  });
  
  // Close stats panel when clicking outside
  statsPanel.addEventListener('click', (e) => {
    if (e.target === statsPanel) {
      statsPanel.classList.remove('visible');
    }
  });
  
  // Helper function to format time as HH:MM:SS
  function formatTimeHHMMSS(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  
  // Format date as relative time (today, yesterday, or specific date)
  function formatRelativeDate(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  }
  
  // Load and display statistics
  function loadAndDisplayStats() {
    console.log("Loading and displaying stats");
    chrome.storage.sync.get(['pomodoroStats'], (result) => {
      console.log("Retrieved stats:", result.pomodoroStats);
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
      
      // Update statistics display with null checks
      const totalCyclesEl = document.getElementById('stat-total-cycles');
      const tasksCompletedEl = document.getElementById('stat-tasks-completed');
      const workTimeEl = document.getElementById('stat-work-time');
      const breakTimeEl = document.getElementById('stat-break-time');
      const totalTimeEl = document.getElementById('stat-total-time');
      const currentStreakEl = document.getElementById('stat-current-streak');
      const lastActiveEl = document.getElementById('stat-last-active');
      
      console.log("Elements found:", {
        totalCyclesEl: !!totalCyclesEl,
        tasksCompletedEl: !!tasksCompletedEl,
        workTimeEl: !!workTimeEl,
        breakTimeEl: !!breakTimeEl,
        totalTimeEl: !!totalTimeEl,
        currentStreakEl: !!currentStreakEl,
        lastActiveEl: !!lastActiveEl
      });
      
      if (totalCyclesEl) totalCyclesEl.textContent = stats.totalWorkCycles;
      if (tasksCompletedEl) tasksCompletedEl.textContent = stats.tasksCompleted;
      if (workTimeEl) workTimeEl.textContent = formatTimeHHMMSS(stats.totalWorkTime);
      if (breakTimeEl) breakTimeEl.textContent = formatTimeHHMMSS(stats.totalBreakTime);
      if (totalTimeEl) totalTimeEl.textContent = formatTimeHHMMSS(stats.totalSessionTime);
      if (currentStreakEl) currentStreakEl.textContent = `${stats.currentStreak} day${stats.currentStreak !== 1 ? 's' : ''}`;
      if (lastActiveEl) lastActiveEl.textContent = `Last active: ${formatRelativeDate(stats.lastActiveDate)}`;
    });
  }
}); 