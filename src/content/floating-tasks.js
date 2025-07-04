// Floating task icon and panel
class FloatingTasks {
  constructor() {
    this.tasks = [];
    this.isVisible = false;
    this.createUI();
    this.setupMessageListener();
    this.loadTasks();
    this.setupEventListeners();
  }
  
  setupMessageListener() {
    // Listen for task updates from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Floating tasks received message:', message.type);
      
      if (message.type === 'TASKS_UPDATED') {
        console.log('Updating tasks in floating panel:', message.tasks);
        this.tasks = message.tasks || [];
        this.updateTaskList();
      }
      
      // Handle response for any message that expects one
      if (sendResponse) {
        sendResponse({ success: true });
      }
      
      // Return true to indicate we want to send a response asynchronously
      return true;
    });
  }

  createUI() {
    // Create floating button
    this.floatingButton = document.createElement('div');
    this.floatingButton.id = 'pomodoro-floating-button';
    this.floatingButton.title = 'Drag to move, click to show tasks';
    this.floatingButton.setAttribute('draggable', 'false');
    
    // Create task panel
    this.taskPanel = document.createElement('div');
    this.taskPanel.id = 'pomodoro-task-panel';
    this.taskPanel.innerHTML = `
      <div class="pomodoro-task-header">
        <h3>My Tasks</h3>
        <button id="pomodoro-close-panel">&times;</button>
      </div>
      <div id="pomodoro-task-list" class="pomodoro-task-list">
        <!-- Tasks will be populated here -->
      </div>
    `;
    
    // Add to body
    document.body.appendChild(this.floatingButton);
    document.body.appendChild(this.taskPanel);
  }

  async loadTasks() {
    try {
      // Get tasks from background script
      const response = await chrome.runtime.sendMessage({ type: 'GET_TASKS' });
      this.tasks = response.tasks || [];
      this.updateTaskList();
    } catch (error) {
      console.error('Error loading tasks:', error);
      // Fallback to local storage if background script is not available
      const result = await chrome.storage.local.get(['tasks']);
      this.tasks = result.tasks || [];
      this.updateTaskList();
    }
  }

  updateTaskList() {
    const taskList = document.getElementById('pomodoro-task-list');
    if (!taskList) return;
    
    if (this.tasks.length === 0) {
      taskList.innerHTML = '<div class="pomodoro-no-tasks">No tasks yet. Add some in the Pomodoro timer!</div>';
      return;
    }

    taskList.innerHTML = this.tasks
      .map((task, index) => `
        <div class="pomodoro-task-item ${task.completed ? 'completed' : ''}" data-id="${index}">
          <input type="checkbox" ${task.completed ? 'checked' : ''}>
          <span>${task.text}</span>
        </div>
      `)
      .join('');
  }

  setupEventListeners() {
    // Dragging functionality
    let isDragging = false;
    let offsetX, offsetY;
    
    // Save position to localStorage
    const savePosition = (x, y) => {
      localStorage.setItem('pomodoroFloatingButtonX', x);
      localStorage.setItem('pomodoroFloatingButtonY', y);
    };
    
    // Load saved position
    const loadPosition = () => {
      const x = localStorage.getItem('pomodoroFloatingButtonX');
      const y = localStorage.getItem('pomodoroFloatingButtonY');
      if (x !== null && y !== null) {
        this.floatingButton.style.left = `${x}px`;
        this.floatingButton.style.top = `${y}px`;
        this.floatingButton.style.right = 'auto';
        this.floatingButton.style.bottom = 'auto';
      }
    };
    
    // Initialize position
    loadPosition();
    
    // Mouse/Touch start
    const startDrag = (e) => {
      e.preventDefault();
      isDragging = true;
      
      // Get the mouse/touch position relative to the button
      const rect = this.floatingButton.getBoundingClientRect();
      if (e.type === 'mousedown') {
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
      } else if (e.touches) {
        offsetX = e.touches[0].clientX - rect.left;
        offsetY = e.touches[0].clientY - rect.top;
      }
      
      // Change cursor and add active class
      this.floatingButton.style.cursor = 'grabbing';
      this.floatingButton.classList.add('active');
      
      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
    };
    
    // Mouse/Touch move
    const drag = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      
      let clientX, clientY;
      if (e.type === 'mousemove') {
        clientX = e.clientX;
        clientY = e.clientY;
      } else if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
      
      // Calculate new position
      const x = clientX - offsetX;
      const y = clientY - offsetY;
      
      // Update position
      this.floatingButton.style.left = `${x}px`;
      this.floatingButton.style.top = `${y}px`;
      this.floatingButton.style.right = 'auto';
      this.floatingButton.style.bottom = 'auto';
    };
    
    // Mouse/Touch end
    const endDrag = (e) => {
      if (!isDragging) return;
      isDragging = false;
      
      // Reset cursor and remove active class
      this.floatingButton.style.cursor = 'grab';
      this.floatingButton.classList.remove('active');
      
      // Save position
      const rect = this.floatingButton.getBoundingClientRect();
      savePosition(rect.left, rect.top);
      
      // If panel is visible, reposition it
      if (this.isVisible) {
        this.positionPanel();
      }
      
      // Restore text selection
      document.body.style.userSelect = '';
      
      // Check if this was a click (minimal movement)
      const clickThreshold = 5; // pixels
      const movedX = Math.abs(e.clientX - (rect.left + offsetX));
      const movedY = Math.abs(e.clientY - (rect.top + offsetY));
      
      if (movedX < clickThreshold && movedY < clickThreshold) {
        // It was a click, toggle the panel
        this.togglePanel();
      }
    };
    
    // Position panel relative to the floating button
    this.positionPanel = () => {
      if (!this.floatingButton || !this.taskPanel) return;
      
      const buttonRect = this.floatingButton.getBoundingClientRect();
      const panelWidth = 300; // Should match CSS width
      
      // Position the panel above the button
      this.taskPanel.style.top = `${buttonRect.top}px`;
      this.taskPanel.style.left = `${buttonRect.right - panelWidth}px`;
      
      // Adjust if panel would go off-screen to the left
      if (buttonRect.right - panelWidth < 10) {
        this.taskPanel.style.left = '10px';
      }
      
      // Adjust if panel would go off-screen to the top
      const panelHeight = Math.min(this.taskPanel.scrollHeight, 400); // Max height from CSS
      if (buttonRect.top - panelHeight < 10) {
        // If not enough space above, show below the button
        this.taskPanel.style.top = `${buttonRect.bottom + 10}px`;
        this.taskPanel.style.transform = 'translateY(0)';
      } else {
        // Default: show above the button
        this.taskPanel.style.transform = 'translateY(-100%)';
      }
    };
    
    // Toggle panel visibility
    this.togglePanel = () => {
      this.isVisible = !this.isVisible;
      if (this.isVisible) {
        this.positionPanel();
        this.taskPanel.style.display = 'block';
        // Recalculate position after the panel is displayed
        requestAnimationFrame(() => this.positionPanel());
      } else {
        this.taskPanel.style.display = 'none';
      }
      this.floatingButton.classList.toggle('active', this.isVisible);
    };

    // Mouse events
    this.floatingButton.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    
    // Touch events for mobile
    this.floatingButton.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', endDrag);
    
    // Prevent context menu on long press
    this.floatingButton.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    // Close panel
    document.getElementById('pomodoro-close-panel')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isVisible = false;
      this.taskPanel.style.display = 'none';
      this.floatingButton.classList.remove('active');
    });

    // Toggle task completion
    document.addEventListener('click', (e) => {
      const taskItem = e.target.closest('.pomodoro-task-item');
      if (taskItem) {
        const taskId = parseInt(taskItem.dataset.id);
        this.toggleTaskCompletion(taskId);
      }
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.isVisible) return;
      
      const isClickInside = this.taskPanel.contains(e.target) || 
                          this.floatingButton.contains(e.target);
      
      if (!isClickInside) {
        this.isVisible = false;
        this.taskPanel.style.display = 'none';
        this.floatingButton.classList.remove('active');
      }
    });
  }

  async toggleTaskCompletion(taskId) {
    try {
      // Get the current task list
      const result = await new Promise(resolve => {
        chrome.storage.local.get('tasks', resolve);
      });
      
      const tasks = result.tasks || [];
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      
      if (taskIndex === -1) {
        console.warn('Task not found:', taskId);
        return;
      }
      
      // Toggle completion status
      tasks[taskIndex].completed = !tasks[taskIndex].completed;
      tasks[taskIndex].completedAt = tasks[taskIndex].completed ? new Date().toISOString() : undefined;
      
      // Update local storage
      await new Promise(resolve => {
        chrome.storage.local.set({ tasks }, resolve);
      });
      
      // Notify other components
      await chrome.runtime.sendMessage({
        type: 'UPDATE_TASKS',
        tasks
      });
      
      // Update the UI
      this.tasks = tasks;
      this.updateTaskList();
      
    } catch (error) {
      console.error('Error toggling task completion:', error);
    }
  }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new FloatingTasks());
} else {
  new FloatingTasks();
}
