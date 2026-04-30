/* =====================================================
   FocusFlow — Complete App Logic
   ===================================================== */

// ===== STATE =====
const state = {
  // Timer
  mode: 'focus',         // 'focus' | 'short' | 'long'
  running: false,
  remaining: 1500,
  total: 1500,
  sessionNumber: 1,
  completedSessions: 0,  // in current cycle of 4
  intervalId: null,

  // Settings (defaults)
  settings: {
    focusDur: 25,
    shortBreak: 5,
    longBreak: 15,
    dailyGoal: 8,
    autoBreak: true,
    notifications: false,
    sound: true,
  },

  // Tasks
  tasks: [],
  activeTaskId: null,
  taskFilter: 'all',

  // Stats
  todaySessions: 0,
  todayMinutes: 0,
  totalSessions: 0,
  totalMinutes: 0,
  streak: 0,
  bestStreak: 0,
  lastActiveDate: null,
  weeklyData: [0, 0, 0, 0, 0, 0, 0], // Sun-Sat
  sessionHistory: [],
};

// ===== PERSIST =====
function save() {
  localStorage.setItem('focusflow_state', JSON.stringify({
    tasks: state.tasks,
    settings: state.settings,
    todaySessions: state.todaySessions,
    todayMinutes: state.todayMinutes,
    totalSessions: state.totalSessions,
    totalMinutes: state.totalMinutes,
    streak: state.streak,
    bestStreak: state.bestStreak,
    lastActiveDate: state.lastActiveDate,
    weeklyData: state.weeklyData,
    sessionHistory: state.sessionHistory,
    sessionNumber: state.sessionNumber,
  }));
}

function load() {
  try {
    const raw = localStorage.getItem('focusflow_state');
    if (!raw) return;
    const data = JSON.parse(raw);

    // Check if today is a new day → reset today stats if needed
    const today = new Date().toDateString();
    if (data.lastActiveDate && data.lastActiveDate !== today) {
      data.todaySessions = 0;
      data.todayMinutes = 0;
      // Shift weekly data
      const daysSince = Math.min(
        7,
        Math.round((new Date(today) - new Date(data.lastActiveDate)) / 86400000)
      );
      for (let i = 0; i < daysSince; i++) {
        data.weeklyData.shift();
        data.weeklyData.push(0);
      }
    }

    Object.assign(state, data);
  } catch (e) {
    console.warn('Could not load saved state:', e);
  }
}

// ===== DOM REFERENCES =====
const $ = id => document.getElementById(id);

const DOM = {
  timerDisplay: $('timerDisplay'),
  timerLabel: $('timerLabel'),
  sessionCount: $('sessionCount'),
  playBtn: $('playBtn'),
  playIcon: document.querySelector('.play-icon'),
  pauseIcon: document.querySelector('.pause-icon'),
  skipBtn: $('skipBtn'),
  resetBtn: $('resetBtn'),
  ringProgress: document.querySelector('.ring-progress'),
  streakCount: $('streakCount'),

  // Mode buttons
  modeBtns: document.querySelectorAll('.mode-btn'),

  // Nav
  navBtns: document.querySelectorAll('.nav-btn'),
  views: document.querySelectorAll('.view'),

  // Timer sidebar
  todaySessions: $('todaySessions'),
  todayMinutes: $('todayMinutes'),
  todayTasks: $('todayTasks'),
  goalProgress: $('goalProgress'),
  goalFill: $('goalFill'),
  quickTaskList: $('quickTaskList'),
  currentTaskDisplay: $('currentTaskDisplay'),

  // Tasks
  taskInput: $('taskInput'),
  taskPriority: $('taskPriority'),
  taskPomodoros: $('taskPomodoros'),
  addTaskBtn: $('addTaskBtn'),
  taskListContainer: $('taskListContainer'),
  filterBtns: document.querySelectorAll('.filter-btn'),
  pillActive: $('pillActive'),
  pillDone: $('pillDone'),

  // Stats
  totalSessionsEl: $('totalSessions'),
  totalHoursEl: $('totalHours'),
  totalTasksDoneEl: $('totalTasksDone'),
  bestStreakEl: $('bestStreak'),
  weeklyChart: $('weeklyChart'),
  chartDays: $('chartDays'),
  scoreRingProgress: $('scoreRingProgress'),
  productivityScore: $('productivityScore'),
  consistencyBar: $('consistencyBar'),
  completionBar: $('completionBar'),
  focusBar: $('focusBar'),
  historyList: $('historyList'),

  // Settings
  settingsToggle: $('settingsToggle'),
  settingsModal: $('settingsModal'),
  settingsClose: $('settingsClose'),
  focusDurSetting: $('focusDurSetting'),
  shortBreakSetting: $('shortBreakSetting'),
  longBreakSetting: $('longBreakSetting'),
  dailyGoalSetting: $('dailyGoalSetting'),
  focusDurVal: $('focusDurVal'),
  shortBreakVal: $('shortBreakVal'),
  longBreakVal: $('longBreakVal'),
  dailyGoalVal: $('dailyGoalVal'),
  autoBreakToggle: $('autoBreakToggle'),
  notifToggle: $('notifToggle'),
  soundToggle: $('soundToggle'),
  saveSettings: $('saveSettings'),

  // Toast
  toast: $('toast'),
  toastText: $('toastText'),

  // Ambient
  ambientBtns: document.querySelectorAll('.ambient-btn'),
};

// ===== RING CIRCUMFERENCE =====
const RING_RADIUS = 95;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

// ===== UTILITY: format mm:ss =====
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ===== UTILITY: unique ID =====
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ===== TOAST =====
let toastTimeout;
function showToast(msg, icon = '✅') {
  clearTimeout(toastTimeout);
  DOM.toastText.textContent = msg;
  DOM.toast.querySelector('.toast-icon').textContent = icon;
  DOM.toast.classList.add('show');
  toastTimeout = setTimeout(() => DOM.toast.classList.remove('show'), 3200);
}

// ===== AUDIO: Simple Web Audio tones =====
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(frequency = 880, duration = 0.3, type = 'sine', vol = 0.18) {
  if (!state.settings.sound) return;
  try {
    const ctx = getAudioCtx();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    gainNode.gain.setValueAtTime(vol, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playSuccess() {
  playTone(523, 0.15);
  setTimeout(() => playTone(659, 0.15), 150);
  setTimeout(() => playTone(784, 0.3), 300);
}

function playClick() {
  playTone(440, 0.08, 'square', 0.05);
}

// ===== AMBIENT SOUND STATE =====
let ambientNodes = {};
let ambientRunning = false;

function startAmbient(type) {
  if (type === 'none') { stopAmbient(); return; }
  stopAmbient();
  ambientRunning = true;
  const ctx = getAudioCtx();

  if (type === 'rain') {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.value = 0.15;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    ambientNodes = { source, gain };
  } else if (type === 'forest') {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.5;
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    ambientNodes = { source, gain };
  } else if (type === 'cafe') {
    const ctx2 = getAudioCtx();
    const oscillator = ctx2.createOscillator();
    const bufferSource = ctx2.createBufferSource();
    const bufferSize = ctx2.sampleRate * 2;
    const buffer = ctx2.createBuffer(1, bufferSize, ctx2.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    bufferSource.buffer = buffer;
    bufferSource.loop = true;
    const filter = ctx2.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = 800;
    filter.gain.value = 6;
    const gain = ctx2.createGain();
    gain.gain.value = 0.06;
    bufferSource.connect(filter);
    filter.connect(gain);
    gain.connect(ctx2.destination);
    bufferSource.start();
    ambientNodes = { source: bufferSource, gain };
  } else if (type === 'waves') {
    const ctx2 = getAudioCtx();
    const bufferSize = ctx2.sampleRate * 4;
    const buffer = ctx2.createBuffer(1, bufferSize, ctx2.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const wave = Math.sin(i / ctx2.sampleRate * 0.3 * 2 * Math.PI);
      data[i] = (Math.random() * 2 - 1) * 0.5 + wave * 0.5;
    }
    const source = ctx2.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx2.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const gain = ctx2.createGain();
    gain.gain.value = 0.12;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx2.destination);
    source.start();
    ambientNodes = { source, gain };
  }
}

function stopAmbient() {
  ambientRunning = false;
  if (ambientNodes.source) {
    try { ambientNodes.source.stop(); } catch (e) {}
  }
  ambientNodes = {};
}

// ===== TIMER LOGIC =====
function getDuration(mode) {
  if (mode === 'focus') return state.settings.focusDur * 60;
  if (mode === 'short') return state.settings.shortBreak * 60;
  if (mode === 'long') return state.settings.longBreak * 60;
}

function setMode(mode) {
  state.mode = mode;
  state.running = false;
  clearInterval(state.intervalId);
  state.remaining = getDuration(mode);
  state.total = state.remaining;
  updateTimerUI();
  document.body.classList.remove('timer-running');
  DOM.playIcon.classList.remove('hidden');
  DOM.pauseIcon.classList.add('hidden');
  DOM.playBtn.classList.remove('running');
  DOM.modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
}

function updateRing() {
  const ratio = state.remaining / state.total;
  const offset = RING_CIRC * (1 - ratio);
  DOM.ringProgress.style.strokeDashoffset = offset;
}

function updateTimerUI() {
  DOM.timerDisplay.textContent = formatTime(state.remaining);
  document.title = `${formatTime(state.remaining)} — FocusFlow`;
  updateRing();

  const modeLabels = { focus: 'Focus Session', short: 'Short Break', long: 'Long Break' };
  DOM.timerLabel.textContent = modeLabels[state.mode];

  const cycle = ((state.sessionNumber - 1) % 4) + 1;
  DOM.sessionCount.textContent = state.mode === 'focus'
    ? `Session ${cycle} of 4`
    : `Break time! 🎉`;
}

function tick() {
  if (state.remaining > 0) {
    state.remaining--;
    updateTimerUI();
  } else {
    clearInterval(state.intervalId);
    state.running = false;
    onSessionComplete();
  }
}

function onSessionComplete() {
  playSuccess();
  document.body.classList.remove('timer-running');
  DOM.playIcon.classList.remove('hidden');
  DOM.pauseIcon.classList.add('hidden');
  DOM.playBtn.classList.remove('running');

  if (state.mode === 'focus') {
    state.sessionNumber++;
    state.completedSessions++;
    state.todaySessions++;
    state.totalSessions++;
    state.todayMinutes += state.settings.focusDur;
    state.totalMinutes += state.settings.focusDur;

    // Weekly data (today's index)
    const today = new Date().getDay();
    state.weeklyData[today] = (state.weeklyData[today] || 0) + 1;

    // Streak
    const today2 = new Date().toDateString();
    if (state.lastActiveDate !== today2) {
      const diff = state.lastActiveDate
        ? Math.round((new Date(today2) - new Date(state.lastActiveDate)) / 86400000)
        : 0;
      if (diff <= 1) {
        state.streak++;
      } else {
        state.streak = 1;
      }
      state.lastActiveDate = today2;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
    }

    // History
    state.sessionHistory.unshift({
      type: 'focus',
      label: state.activeTaskId
        ? (state.tasks.find(t => t.id === state.activeTaskId)?.title || 'Focus session')
        : 'Focus session',
      duration: state.settings.focusDur,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    if (state.sessionHistory.length > 50) state.sessionHistory.pop();

    showToast('Focus session complete! Take a break 🎉', '🎯');
    if (state.settings.notifications) {
      try {
        new Notification('FocusFlow', { body: 'Focus session complete! Time for a break.' });
      } catch (e) {}
    }

    // Auto next
    const nextMode = state.completedSessions % 4 === 0 ? 'long' : 'short';
    setMode(nextMode);
    if (state.settings.autoBreak) {
      setTimeout(() => startTimer(), 1500);
    }

    updateSidebarStats();
    renderStatsView();
    save();
  } else {
    // Break finished
    showToast('Break over! Ready to focus? 💪', '⏰');
    state.sessionHistory.unshift({
      type: state.mode,
      label: state.mode === 'short' ? 'Short break' : 'Long break',
      duration: state.mode === 'short' ? state.settings.shortBreak : state.settings.longBreak,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    setMode('focus');
    save();
  }
}

function startTimer() {
  if (state.running) return;
  state.running = true;
  document.body.classList.add('timer-running');
  DOM.playIcon.classList.add('hidden');
  DOM.pauseIcon.classList.remove('hidden');
  DOM.playBtn.classList.add('running');
  state.intervalId = setInterval(tick, 1000);
}

function pauseTimer() {
  state.running = false;
  document.body.classList.remove('timer-running');
  clearInterval(state.intervalId);
  DOM.playIcon.classList.remove('hidden');
  DOM.pauseIcon.classList.add('hidden');
  DOM.playBtn.classList.remove('running');
}

// ===== NAVIGATION =====
function switchView(viewId) {
  DOM.navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === viewId));
  DOM.views.forEach(v => v.classList.toggle('active', v.id === viewId + 'View'));
  if (viewId === 'stats') {
    setTimeout(() => renderStatsView(), 50); // let DOM settle first
  }
}

// ===== TASK MANAGEMENT =====
function getTodayDone() {
  return state.tasks.filter(t => t.done).length;
}

function renderTaskList() {
  const filter = state.taskFilter;
  let filtered = state.tasks;
  if (filter === 'done') {
    filtered = state.tasks.filter(t => t.done);
  } else if (filter !== 'all') {
    filtered = state.tasks.filter(t => !t.done && t.priority === filter);
  } else {
    filtered = state.tasks.filter(t => !t.done);
  }

  // Pills
  const active = state.tasks.filter(t => !t.done).length;
  const done = state.tasks.filter(t => t.done).length;
  DOM.pillActive.textContent = `${active} active`;
  DOM.pillDone.textContent = `${done} done`;

  if (filtered.length === 0 && state.tasks.length === 0) {
    DOM.taskListContainer.innerHTML = `
      <div class="full-empty-state">
        <div class="empty-hero">📝</div>
        <h3>Your task board is empty</h3>
        <p>Add tasks above to start organizing your focus sessions</p>
      </div>`;
    return;
  }

  if (filtered.length === 0) {
    DOM.taskListContainer.innerHTML = `
      <div class="full-empty-state">
        <div class="empty-hero">🔍</div>
        <h3>No tasks in this filter</h3>
        <p>Try switching to a different category</p>
      </div>`;
    return;
  }

  DOM.taskListContainer.innerHTML = '';
  filtered.forEach(task => {
    const el = document.createElement('div');
    el.className = `task-item${task.done ? ' done' : ''}`;
    el.dataset.id = task.id;

    const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[task.priority];

    el.innerHTML = `
      <div class="task-check${task.done ? ' checked' : ''}" data-taskcheck="${task.id}"></div>
      <div class="task-meta">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-tags">
          <span class="priority-tag priority-${task.priority}">${priorityEmoji} ${capitalize(task.priority)}</span>
          <span class="pom-count">🍅 ${task.pomsDone}/${task.poms} pomodoros</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="task-action-btn focus-btn" data-taskfocus="${task.id}" title="Focus on this task">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="task-action-btn delete-btn" data-taskdelete="${task.id}" title="Delete task">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>`;
    DOM.taskListContainer.appendChild(el);
  });
}

function renderQuickTasks() {
  const active = state.tasks.filter(t => !t.done);
  if (active.length === 0) {
    DOM.quickTaskList.innerHTML = `
      <div class="empty-tasks">
        <div class="empty-icon">📋</div>
        <p>No tasks yet. Add some in the Tasks tab!</p>
      </div>`;
    return;
  }

  DOM.quickTaskList.innerHTML = '';
  active.slice(0, 6).forEach(task => {
    const el = document.createElement('div');
    el.className = `quick-task-item${state.activeTaskId === task.id ? ' selected-task' : ''}`;
    el.dataset.quicktask = task.id;
    el.innerHTML = `
      <div class="quick-priority-dot dot-${task.priority}"></div>
      <span>${escapeHtml(task.title)}</span>`;
    DOM.quickTaskList.appendChild(el);
  });
}

function updateCurrentTaskDisplay() {
  if (!state.activeTaskId) {
    DOM.currentTaskDisplay.innerHTML = `<span class="no-task-text">No task selected — pick one from Tasks tab</span>`;
    return;
  }
  const task = state.tasks.find(t => t.id === state.activeTaskId);
  if (!task) {
    state.activeTaskId = null;
    DOM.currentTaskDisplay.innerHTML = `<span class="no-task-text">No task selected — pick one from Tasks tab</span>`;
    return;
  }
  DOM.currentTaskDisplay.innerHTML = `
    <span style="color: var(--text-primary); font-weight: 500;">${escapeHtml(task.title)}</span>
    <span style="margin-left: auto; font-size: 12px; color: var(--text-muted);">🍅 ${task.pomsDone}/${task.poms}</span>`;
}

function addTask() {
  const title = DOM.taskInput.value.trim();
  if (!title) {
    DOM.taskInput.focus();
    DOM.taskInput.style.borderColor = 'rgba(239, 68, 68, 0.5)';
    setTimeout(() => DOM.taskInput.style.borderColor = '', 1200);
    return;
  }
  const task = {
    id: uid(),
    title,
    priority: DOM.taskPriority.value,
    poms: parseInt(DOM.taskPomodoros.value) || 1,
    pomsDone: 0,
    done: false,
    createdAt: Date.now(),
  };
  state.tasks.unshift(task);
  DOM.taskInput.value = '';
  DOM.taskPomodoros.value = '1';
  playClick();
  renderTaskList();
  renderQuickTasks();
  save();
  showToast(`Task added: "${truncate(title, 30)}"`, '📝');
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  if (state.activeTaskId === id) {
    state.activeTaskId = null;
    updateCurrentTaskDisplay();
  }
  renderTaskList();
  renderQuickTasks();
  save();
}

function toggleTaskDone(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  if (task.done && state.activeTaskId === id) {
    state.activeTaskId = null;
    updateCurrentTaskDisplay();
  }
  playClick();
  renderTaskList();
  renderQuickTasks();
  updateSidebarStats();
  save();
}

function setFocusTask(id) {
  if (state.activeTaskId === id) {
    state.activeTaskId = null;
  } else {
    state.activeTaskId = id;
  }
  updateCurrentTaskDisplay();
  renderQuickTasks();
  switchView('timer');
  save();
}

// ===== SIDEBAR STATS =====
function updateSidebarStats() {
  DOM.todaySessions.textContent = state.todaySessions;
  DOM.todayMinutes.textContent = state.todayMinutes;
  DOM.todayTasks.textContent = getTodayDone();
  DOM.streakCount.textContent = state.streak;

  const goal = state.settings.dailyGoal;
  const pct = Math.min(100, Math.round((state.todaySessions / goal) * 100));
  DOM.goalProgress.textContent = `${state.todaySessions} / ${goal} sessions`;
  DOM.goalFill.style.width = `${pct}%`;
}

// ===== STATS VIEW =====
function renderStatsView() {
  DOM.totalSessionsEl.textContent = state.totalSessions;
  const hours = Math.floor(state.totalMinutes / 60);
  const mins = state.totalMinutes % 60;
  DOM.totalHoursEl.textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  DOM.totalTasksDoneEl.textContent = state.tasks.filter(t => t.done).length;
  DOM.bestStreakEl.textContent = state.bestStreak;

  // Weekly chart
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayIdx = new Date().getDay();
  // Rotate so today is last
  const rotatedData = [];
  const rotatedDays = [];
  for (let i = 0; i < 7; i++) {
    const idx = (todayIdx - 6 + i + 7) % 7;
    rotatedData.push(state.weeklyData[idx] || 0);
    rotatedDays.push(days[idx]);
  }
  const maxVal = Math.max(...rotatedData, 1);

  DOM.weeklyChart.innerHTML = '';
  DOM.chartDays.innerHTML = '';
  rotatedData.forEach((val, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-bar-wrapper';
    const pctH = Math.round((val / maxVal) * 100);
    wrapper.innerHTML = `
      <div class="chart-bar-val">${val > 0 ? val : ''}</div>
      <div class="chart-bar" style="height: ${Math.max(4, pctH)}%;"></div>`;
    DOM.weeklyChart.appendChild(wrapper);

    const label = document.createElement('div');
    label.className = 'chart-day-label' + (i === 6 ? ' today' : '');
    label.textContent = i === 6 ? 'Today' : rotatedDays[i];
    DOM.chartDays.appendChild(label);
  });

  // Productivity score
  const consistency = state.streak > 0
    ? Math.min(100, state.streak * 15)
    : (state.totalSessions > 0 ? 20 : 0);
  const completion = state.tasks.length > 0
    ? Math.round((state.tasks.filter(t => t.done).length / state.tasks.length) * 100)
    : 0;
  const focusDepth = Math.min(100, state.todaySessions * 12.5);
  const score = Math.round((consistency * 0.35 + completion * 0.35 + focusDepth * 0.3));

  DOM.productivityScore.textContent = score;
  DOM.consistencyBar.style.width = `${consistency}%`;
  DOM.completionBar.style.width = `${completion}%`;
  DOM.focusBar.style.width = `${focusDepth}%`;

  // Ring animation
  const ringOffset = 502.4 * (1 - score / 100);
  DOM.scoreRingProgress.style.strokeDashoffset = ringOffset;

  // History
  if (state.sessionHistory.length === 0) {
    DOM.historyList.innerHTML = `<div class="no-history">No sessions yet. Start your first focus session!</div>`;
  } else {
    DOM.historyList.innerHTML = state.sessionHistory.slice(0, 20).map(h => `
      <div class="history-item">
        <div class="history-item-left">
          <div class="history-dot history-dot-${h.type === 'focus' ? 'focus' : h.type === 'short' ? 'short' : 'long'}"></div>
          <div>
            <div class="history-label">${escapeHtml(h.label)}</div>
          </div>
        </div>
        <div class="history-time">${h.time} · ${h.duration}min</div>
      </div>`).join('');
  }

  // Insights
  const insights = [];
  if (state.totalSessions === 0) {
    insights.push({ icon: '💡', text: 'Complete your first Pomodoro session to unlock personalized insights!' });
    insights.push({ icon: '🎯', text: 'Try setting a daily goal of 4 sessions to build a consistent habit.' });
    insights.push({ icon: '⚡', text: 'Research shows 52 minutes of focus followed by 17 min break is optimal.' });
  } else {
    if (state.streak >= 3) insights.push({ icon: '🔥', text: `Amazing! You're on a ${state.streak}-day streak. Consistency is the key to mastery!` });
    if (state.todaySessions >= state.settings.dailyGoal) insights.push({ icon: '🏆', text: `Goal crushed! You hit ${state.todaySessions} sessions today. You're in the top tier!` });
    if (state.todaySessions === 0) insights.push({ icon: '☀️', text: 'Fresh start today! Begin with a 25-min session to build momentum.' });
    if (score > 70) insights.push({ icon: '⚡', text: `Your productivity score is ${score}/100 — you're in the zone!` });
    if (score < 40 && state.totalSessions > 3) insights.push({ icon: '💡', text: 'Try completing tasks more consistently to boost your score.' });
    insights.push({ icon: '🌊', text: 'Research shows taking regular breaks improves long-term recall by up to 40%.' });
    if (insights.length < 3) insights.push({ icon: '🎯', text: `You've completed ${state.totalSessions} sessions total. Keep going!` });
  }

  $('insightsList').innerHTML = insights.slice(0, 3).map(i => `
    <div class="insight-item">
      <div class="insight-icon">${i.icon}</div>
      <div class="insight-text">${i.text}</div>
    </div>`).join('');
}

// ===== SETTINGS =====
function openSettings() {
  const s = state.settings;
  DOM.focusDurSetting.value = s.focusDur;
  DOM.shortBreakSetting.value = s.shortBreak;
  DOM.longBreakSetting.value = s.longBreak;
  DOM.dailyGoalSetting.value = s.dailyGoal;
  DOM.focusDurVal.textContent = s.focusDur;
  DOM.shortBreakVal.textContent = s.shortBreak;
  DOM.longBreakVal.textContent = s.longBreak;
  DOM.dailyGoalVal.textContent = s.dailyGoal;
  DOM.autoBreakToggle.checked = s.autoBreak;
  DOM.notifToggle.checked = s.notifications;
  DOM.soundToggle.checked = s.sound;
  DOM.settingsModal.classList.add('active');
}

function closeSettings() {
  DOM.settingsModal.classList.remove('active');
}

function saveSettingsFn() {
  state.settings.focusDur = parseInt(DOM.focusDurSetting.value);
  state.settings.shortBreak = parseInt(DOM.shortBreakSetting.value);
  state.settings.longBreak = parseInt(DOM.longBreakSetting.value);
  state.settings.dailyGoal = parseInt(DOM.dailyGoalSetting.value);
  state.settings.autoBreak = DOM.autoBreakToggle.checked;
  state.settings.notifications = DOM.notifToggle.checked;
  state.settings.sound = DOM.soundToggle.checked;

  if (state.settings.notifications) {
    Notification.requestPermission().catch(() => {});
  }

  // Refresh timer if not running
  if (!state.running) {
    setMode(state.mode);
  }
  updateSidebarStats();
  save();
  closeSettings();
  showToast('Settings saved!', '⚙️');
}

// ===== HELPERS =====
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

// ===== EVENT LISTENERS =====
function initEvents() {
  // Play/Pause
  DOM.playBtn.addEventListener('click', () => {
    playClick();
    if (state.running) pauseTimer(); else startTimer();
  });

  // Reset
  DOM.resetBtn.addEventListener('click', () => {
    playClick();
    pauseTimer();
    setMode(state.mode);
  });

  // Skip
  DOM.skipBtn.addEventListener('click', () => {
    playClick();
    pauseTimer();
    if (state.mode === 'focus') {
      const nextMode = state.completedSessions % 4 === 0 ? 'long' : 'short';
      setMode(nextMode);
    } else {
      setMode('focus');
    }
  });

  // Mode buttons
  DOM.modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      playClick();
      pauseTimer();
      setMode(btn.dataset.mode);
    });
  });

  // Nav
  DOM.navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Add task
  DOM.addTaskBtn.addEventListener('click', addTask);
  DOM.taskInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });

  // Task list events (delegated)
  DOM.taskListContainer.addEventListener('click', e => {
    const check = e.target.closest('[data-taskcheck]');
    const del = e.target.closest('[data-taskdelete]');
    const focus = e.target.closest('[data-taskfocus]');
    if (check) toggleTaskDone(check.dataset.taskcheck);
    else if (del) deleteTask(del.dataset.taskdelete);
    else if (focus) setFocusTask(focus.dataset.taskfocus);
  });

  // Quick task list (from timer sidebar)
  DOM.quickTaskList.addEventListener('click', e => {
    const item = e.target.closest('[data-quicktask]');
    if (item) setFocusTask(item.dataset.quicktask);
  });

  // Filter
  DOM.filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.taskFilter = btn.dataset.filter;
      renderTaskList();
    });
  });

  // Settings
  DOM.settingsToggle.addEventListener('click', openSettings);
  DOM.settingsClose.addEventListener('click', closeSettings);
  DOM.settingsModal.addEventListener('click', e => {
    if (e.target === DOM.settingsModal) closeSettings();
  });
  DOM.saveSettings.addEventListener('click', saveSettingsFn);

  // Settings sliders live update
  const sliderPairs = [
    [DOM.focusDurSetting, DOM.focusDurVal],
    [DOM.shortBreakSetting, DOM.shortBreakVal],
    [DOM.longBreakSetting, DOM.longBreakVal],
    [DOM.dailyGoalSetting, DOM.dailyGoalVal],
  ];
  sliderPairs.forEach(([slider, label]) => {
    slider.addEventListener('input', () => { label.textContent = slider.value; });
  });

  // Ambient
  DOM.ambientBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.ambientBtns.forEach(b => b.classList.remove('active-ambient'));
      btn.classList.add('active-ambient');
      startAmbient(btn.dataset.sound);
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); DOM.playBtn.click(); }
    if (e.code === 'KeyR') DOM.resetBtn.click();
    if (e.code === 'KeyS') DOM.skipBtn.click();
  });
}

// ===== INIT =====
function init() {
  load();
  setMode('focus');
  updateSidebarStats();
  renderQuickTasks();
  renderTaskList();
  updateCurrentTaskDisplay();

  // Apply any sample tasks if totally fresh
  if (state.tasks.length === 0 && state.totalSessions === 0) {
    const samples = [
      { title: 'Write project proposal', priority: 'high', poms: 3 },
      { title: 'Review pull requests', priority: 'medium', poms: 2 },
      { title: 'Read chapter 5 of textbook', priority: 'medium', poms: 2 },
      { title: 'Reply to emails', priority: 'low', poms: 1 },
    ];
    samples.forEach(t => {
      state.tasks.push({ id: uid(), ...t, pomsDone: 0, done: false, createdAt: Date.now() });
    });
    renderTaskList();
    renderQuickTasks();
    save();
  }

  initEvents();
}

document.addEventListener('DOMContentLoaded', init);
