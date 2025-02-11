document.getElementById('startBreak').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'START_BREAK' });
  window.close();
});

document.getElementById('resetWork').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'RESET_WORK' });
  window.close();
}); 