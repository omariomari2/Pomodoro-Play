# Pomodoro Play

A Chrome extension experiment that combines focus timers, a task list, and games for breaks.
Built with JavaScript, HTML, CSS, and Chrome extension APIs.

## Try locally

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Select **Load unpacked** and choose the repository directory.
5. Open the extension and start a short timer.

## Scope

The source includes timer controls, local task storage, notifications, and several small games.
The manifest requests access to all websites for the floating task panel, plus tab, storage, alarm, and notification permissions.

This is a learning project. The background timer uses in-memory state, so timer reliability across service-worker suspension needs further work.

