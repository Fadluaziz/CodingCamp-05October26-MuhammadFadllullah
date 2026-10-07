/**
 * app.js — Personal Dashboard
 *
 * Sections:
 *  1. LocalStorage Keys & Helpers
 *  2. Theme (Light / Dark)
 *  3. Greeting, Clock & Date
 *  4. Focus Timer (Pomodoro)
 *  5. To-Do List
 *  6. Quick Links
 *  7. Init
 */

'use strict';

/* ============================================================
   1. LocalStorage Keys & Helpers
   ============================================================ */

const LS_USERNAME  = 'dashboard_username';
const LS_POMODORO  = 'dashboard_pomodoro_minutes';
const LS_TODOS     = 'dashboard_todos';
const LS_LINKS     = 'dashboard_links';
const LS_THEME     = 'dashboard_theme';

/**
 * Read a value from LocalStorage, returning a fallback if absent or invalid.
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
function lsGet(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw !== null ? raw : fallback;
  } catch (e) {
    return fallback;
  }
}

/**
 * Write a value to LocalStorage.
 * @param {string} key
 * @param {string} value
 */
function lsSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('LocalStorage write failed:', e);
  }
}

/**
 * Read a JSON array from LocalStorage.
 * @param {string} key
 * @returns {Array}
 */
function lsGetJSON(key) {
  try {
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Write an array as JSON to LocalStorage.
 * @param {string} key
 * @param {Array} arr
 */
function lsSetJSON(key, arr) {
  try {
    localStorage.setItem(key, JSON.stringify(arr));
  } catch (e) {
    console.warn('LocalStorage write failed:', e);
  }
}

/**
 * Generate a simple unique ID (timestamp + random).
 * @returns {string}
 */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ============================================================
   2. Theme (Light / Dark)
   ============================================================ */

var themeToggleBtn = document.getElementById('theme-toggle');
var themeIcon      = document.getElementById('theme-icon');

/**
 * Apply a theme by setting data-theme on <body> and updating the icon.
 * @param {'light'|'dark'} theme
 */
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  // Also set on documentElement in case the inline script set it there
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function initTheme() {
  var saved = lsGet(LS_THEME, 'light');
  applyTheme(saved);
}

function toggleTheme() {
  var current = document.body.getAttribute('data-theme') || 'light';
  var next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  lsSet(LS_THEME, next);
}

themeToggleBtn.addEventListener('click', toggleTheme);

/* ============================================================
   3. Greeting, Clock & Date
   ============================================================ */

var timeEl      = document.getElementById('current-time');
var dateEl      = document.getElementById('current-date');
var greetingEl  = document.getElementById('greeting-text');
var editNameBtn = document.getElementById('edit-name-btn');
var nameInputWrap = document.getElementById('name-input-wrap');
var nameInput   = document.getElementById('name-input');
var saveNameBtn = document.getElementById('save-name-btn');
var cancelNameBtn = document.getElementById('cancel-name-btn');

var DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var MONTHS = ['January','February','March','April','May','June',
              'July','August','September','October','November','December'];

/**
 * Return "Good Morning/Afternoon/Evening/Night" based on hour.
 * @param {number} hour 0-23
 * @returns {string}
 */
function getGreetingWord(hour) {
  if (hour >= 5  && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 21) return 'Good Evening';
  return 'Good Night';
}

/**
 * Format a number to always be two digits.
 * @param {number} n
 * @returns {string}
 */
function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/**
 * Update the clock, date, and greeting every second.
 */
function updateClock() {
  var now    = new Date();
  var h      = now.getHours();
  var m      = now.getMinutes();
  var s      = now.getSeconds();
  var name   = lsGet(LS_USERNAME, '') || '';
  var nameLabel = name ? ', ' + name + '!' : '!';

  timeEl.textContent    = pad2(h) + ':' + pad2(m) + ':' + pad2(s);
  dateEl.textContent    = DAYS[now.getDay()] + ', ' + now.getDate() + ' ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear();
  greetingEl.textContent = getGreetingWord(h) + nameLabel;
}

/** Show the name editor input. */
function openNameEditor() {
  var current = lsGet(LS_USERNAME, '');
  nameInput.value = current;
  nameInputWrap.classList.remove('hidden');
  editNameBtn.classList.add('hidden');
  nameInput.focus();
}

/** Hide the name editor input without saving. */
function closeNameEditor() {
  nameInputWrap.classList.add('hidden');
  editNameBtn.classList.remove('hidden');
}

/** Save the name to LocalStorage and close the editor. */
function saveName() {
  var value = nameInput.value.trim();
  lsSet(LS_USERNAME, value);
  closeNameEditor();
  updateClock(); // immediate refresh
}

editNameBtn.addEventListener('click', openNameEditor);
saveNameBtn.addEventListener('click', saveName);
cancelNameBtn.addEventListener('click', closeNameEditor);

nameInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') saveName();
  if (e.key === 'Escape') closeNameEditor();
});

/* ============================================================
   4. Focus Timer (Pomodoro)
   ============================================================ */

var timerDisplay      = document.getElementById('timer-display');
var timerStartBtn     = document.getElementById('timer-start');
var timerStopBtn      = document.getElementById('timer-stop');
var timerResetBtn     = document.getElementById('timer-reset');
var timerNotification = document.getElementById('timer-notification');
var customMinutesInput = document.getElementById('custom-minutes');
var setDurationBtn    = document.getElementById('set-duration-btn');

var timerInterval = null;   // setInterval handle
var timerRunning  = false;
var timerSeconds  = 0;      // remaining seconds

/**
 * Load saved pomodoro duration (minutes) from LocalStorage, default 25.
 * @returns {number}
 */
function loadPomodoroMinutes() {
  var saved = parseInt(lsGet(LS_POMODORO, '25'), 10);
  return isNaN(saved) || saved < 1 ? 25 : saved;
}

/**
 * Format seconds into MM:SS.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatTimer(totalSeconds) {
  var m = Math.floor(totalSeconds / 60);
  var s = totalSeconds % 60;
  return pad2(m) + ':' + pad2(s);
}

/** Update the timer display element. */
function renderTimer() {
  timerDisplay.textContent = formatTimer(timerSeconds);
}

/** Reset timer to the currently configured duration, stop if running. */
function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning  = false;
  timerSeconds  = loadPomodoroMinutes() * 60;
  renderTimer();
  timerNotification.classList.add('hidden');
  timerStartBtn.disabled = false;
  timerStopBtn.disabled  = true;
}

/**
 * Play a short beep using the Web Audio API.
 * Wrapped in try/catch so it degrades gracefully.
 */
function playBeep() {
  try {
    var ctx  = new (window.AudioContext || window.webkitAudioContext)();
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch (e) {
    // Audio API unavailable — degrade gracefully
    console.warn('Web Audio API not available:', e);
  }
}

/** Called each second while the timer runs. */
function timerTick() {
  if (timerSeconds <= 0) {
    // Time's up
    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning  = false;
    timerSeconds  = 0;
    renderTimer();
    timerStartBtn.disabled = false;
    timerStopBtn.disabled  = true;
    timerNotification.classList.remove('hidden');
    playBeep();
    return;
  }
  timerSeconds -= 1;
  renderTimer();
}

/** Start the timer. */
function startTimer() {
  if (timerRunning) return;
  timerNotification.classList.add('hidden');
  // If at zero, reload the configured duration first
  if (timerSeconds <= 0) {
    timerSeconds = loadPomodoroMinutes() * 60;
  }
  timerRunning  = true;
  timerStartBtn.disabled = true;
  timerStopBtn.disabled  = false;
  timerInterval = setInterval(timerTick, 1000);
}

/** Stop (pause) the timer. */
function stopTimer() {
  if (!timerRunning) return;
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning  = false;
  timerStartBtn.disabled = false;
  timerStopBtn.disabled  = true;
}

/** Set a custom duration from the number input and reset. */
function setCustomDuration() {
  var val = parseInt(customMinutesInput.value, 10);
  if (isNaN(val) || val < 1) {
    customMinutesInput.value = loadPomodoroMinutes();
    return;
  }
  if (val > 120) val = 120;
  customMinutesInput.value = val;
  lsSet(LS_POMODORO, String(val));
  resetTimer();
}

timerStartBtn.addEventListener('click', startTimer);
timerStopBtn.addEventListener('click', stopTimer);
timerResetBtn.addEventListener('click', resetTimer);
setDurationBtn.addEventListener('click', setCustomDuration);

customMinutesInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') setCustomDuration();
});

/* ============================================================
   5. To-Do List
   ============================================================ */

var todoInput   = document.getElementById('todo-input');
var todoAddBtn  = document.getElementById('todo-add-btn');
var todoList    = document.getElementById('todo-list');
var todoEmpty   = document.getElementById('todo-empty');
var todoError   = document.getElementById('todo-error');
var sortBtns    = document.querySelectorAll('.btn-sort');

var todos       = [];      // master array — always insertion order
var currentSort = 'original';

/** Load todos from LocalStorage. */
function loadTodos() {
  todos = lsGetJSON(LS_TODOS);
}

/** Save todos to LocalStorage. */
function saveTodos() {
  lsSetJSON(LS_TODOS, todos);
}

/**
 * Show an error message near the todo input.
 * @param {string} msg
 */
function showTodoError(msg) {
  todoError.textContent = msg;
  todoError.classList.remove('hidden');
}

/** Hide the todo error message. */
function hideTodoError() {
  todoError.classList.add('hidden');
  todoError.textContent = '';
}

/**
 * Check whether a task text already exists (case-insensitive), optionally
 * excluding a task id (used when editing).
 * @param {string} text
 * @param {string|null} excludeId
 * @returns {boolean}
 */
function isDuplicate(text, excludeId) {
  var lower = text.trim().toLowerCase();
  return todos.some(function (t) {
    return t.id !== excludeId && t.text.toLowerCase() === lower;
  });
}

/**
 * Return a sorted copy of todos based on currentSort.
 * @returns {Array}
 */
function getSortedTodos() {
  var copy = todos.slice();
  if (currentSort === 'az') {
    copy.sort(function (a, b) {
      return a.text.toLowerCase().localeCompare(b.text.toLowerCase());
    });
  } else if (currentSort === 'status') {
    copy.sort(function (a, b) {
      // incomplete (done=false) first, then done
      if (a.done === b.done) return 0;
      return a.done ? 1 : -1;
    });
  }
  // 'original' → keep insertion order (createdAt ascending, which is the master array order)
  return copy;
}

/** Render the entire todo list. */
function renderTodos() {
  todoList.innerHTML = '';
  var sorted = getSortedTodos();

  if (sorted.length === 0) {
    todoEmpty.classList.remove('hidden');
    return;
  }
  todoEmpty.classList.add('hidden');

  sorted.forEach(function (task) {
    var li = document.createElement('li');
    li.className = 'todo-item' + (task.done ? ' done' : '');
    li.dataset.id = task.id;

    // Checkbox
    var cb = document.createElement('input');
    cb.type    = 'checkbox';
    cb.className = 'todo-checkbox';
    cb.checked = task.done;
    cb.setAttribute('aria-label', 'Mark "' + task.text + '" as done');
    cb.addEventListener('change', function () {
      toggleTodoDone(task.id);
    });

    // Text / edit area wrapper
    var textWrap = document.createElement('div');
    textWrap.className = 'todo-text-wrap';

    var textSpan = document.createElement('span');
    textSpan.className = 'todo-text';
    textSpan.textContent = task.text;

    textWrap.appendChild(textSpan);

    // Action buttons
    var actions = document.createElement('div');
    actions.className = 'todo-item-actions';

    var editBtn = document.createElement('button');
    editBtn.className = 'btn-edit-icon';
    editBtn.textContent = '✏️';
    editBtn.setAttribute('aria-label', 'Edit task');
    editBtn.title = 'Edit';
    editBtn.addEventListener('click', function () {
      openTodoEdit(task.id, li, textWrap, textSpan);
    });

    var delBtn = document.createElement('button');
    delBtn.className = 'btn-danger-icon';
    delBtn.textContent = '✕';
    delBtn.setAttribute('aria-label', 'Delete task');
    delBtn.title = 'Delete';
    delBtn.addEventListener('click', function () {
      deleteTodo(task.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(cb);
    li.appendChild(textWrap);
    li.appendChild(actions);

    todoList.appendChild(li);
  });
}

/**
 * Open inline edit mode for a task.
 * @param {string} id
 * @param {HTMLElement} li
 * @param {HTMLElement} textWrap
 * @param {HTMLElement} textSpan
 */
function openTodoEdit(id, li, textWrap, textSpan) {
  // Avoid double-opening
  if (textWrap.querySelector('.todo-edit-input')) return;

  var task = todos.find(function (t) { return t.id === id; });
  if (!task) return;

  textSpan.style.display = 'none';

  var editInput = document.createElement('input');
  editInput.type      = 'text';
  editInput.className = 'todo-edit-input';
  editInput.value     = task.text;
  editInput.maxLength = 200;
  editInput.setAttribute('aria-label', 'Edit task text');

  var editError = document.createElement('div');
  editError.className = 'todo-edit-error hidden';

  var saveBtn = document.createElement('button');
  saveBtn.className   = 'btn-primary btn-sm';
  saveBtn.textContent = 'Save';
  saveBtn.style.marginTop = '4px';

  function commitEdit() {
    var newText = editInput.value.trim();
    if (!newText) return;
    if (isDuplicate(newText, id)) {
      editError.textContent = '⚠ "' + newText + '" already exists.';
      editError.classList.remove('hidden');
      return;
    }
    task.text = newText;
    saveTodos();
    renderTodos();
  }

  saveBtn.addEventListener('click', commitEdit);
  editInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') {
      textSpan.style.display = '';
      textWrap.removeChild(editInput);
      textWrap.removeChild(editError);
      textWrap.removeChild(saveBtn);
    }
  });

  textWrap.appendChild(editInput);
  textWrap.appendChild(editError);
  textWrap.appendChild(saveBtn);
  editInput.focus();
  editInput.select();
}

/**
 * Add a new task.
 */
function addTodo() {
  var text = todoInput.value.trim();
  hideTodoError();

  if (!text) return;

  if (isDuplicate(text, null)) {
    showTodoError('⚠ "' + text + '" already exists.');
    return;
  }

  var task = {
    id:        genId(),
    text:      text,
    done:      false,
    createdAt: Date.now()
  };

  todos.push(task);
  saveTodos();
  todoInput.value = '';
  renderTodos();
  todoInput.focus();
}

/**
 * Toggle the done state of a task.
 * @param {string} id
 */
function toggleTodoDone(id) {
  var task = todos.find(function (t) { return t.id === id; });
  if (!task) return;
  task.done = !task.done;
  saveTodos();
  renderTodos();
}

/**
 * Delete a task.
 * @param {string} id
 */
function deleteTodo(id) {
  todos = todos.filter(function (t) { return t.id !== id; });
  saveTodos();
  renderTodos();
}

/**
 * Set the active sort and re-render.
 * @param {string} sort 'original'|'az'|'status'
 */
function setSort(sort) {
  currentSort = sort;
  sortBtns.forEach(function (btn) {
    if (btn.dataset.sort === sort) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  renderTodos();
}

todoAddBtn.addEventListener('click', addTodo);

todoInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') addTodo();
});

todoInput.addEventListener('input', function () {
  hideTodoError();
});

sortBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    setSort(btn.dataset.sort);
  });
});

/* ============================================================
   6. Quick Links
   ============================================================ */

var linkNameInput = document.getElementById('link-name-input');
var linkUrlInput  = document.getElementById('link-url-input');
var linkAddBtn    = document.getElementById('link-add-btn');
var linksGrid     = document.getElementById('links-grid');
var linksEmpty    = document.getElementById('links-empty');

var links = [];

/** Load links from LocalStorage. */
function loadLinks() {
  links = lsGetJSON(LS_LINKS);
}

/** Save links to LocalStorage. */
function saveLinks() {
  lsSetJSON(LS_LINKS, links);
}

/**
 * Ensure a URL has a protocol; default to https://.
 * @param {string} url
 * @returns {string}
 */
function normalizeUrl(url) {
  url = url.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    return 'https://' + url;
  }
  return url;
}

/**
 * Return the Google favicon URL for a given site URL.
 * @param {string} url
 * @returns {string}
 */
function faviconUrl(url) {
  try {
    var origin = new URL(url).origin;
    return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(origin) + '&sz=32';
  } catch (e) {
    return '';
  }
}

/** Render the links grid. */
function renderLinks() {
  linksGrid.innerHTML = '';

  if (links.length === 0) {
    linksEmpty.classList.remove('hidden');
    return;
  }
  linksEmpty.classList.add('hidden');

  links.forEach(function (link) {
    var card = document.createElement('div');
    card.className = 'link-card';

    var anchor = document.createElement('a');
    anchor.href   = link.url;
    anchor.target = '_blank';
    anchor.rel    = 'noopener noreferrer';
    anchor.className = 'link-anchor';
    anchor.textContent = link.name;
    anchor.setAttribute('aria-label', 'Open ' + link.name);

    // Favicon image
    var fav  = faviconUrl(link.url);
    if (fav) {
      var img = document.createElement('img');
      img.src     = fav;
      img.alt     = '';
      img.className = 'link-favicon';
      img.setAttribute('aria-hidden', 'true');
      img.onerror = function () { this.style.display = 'none'; };
      anchor.prepend(img);
    }

    var delBtn = document.createElement('button');
    delBtn.className   = 'link-delete-btn';
    delBtn.textContent = '✕';
    delBtn.setAttribute('aria-label', 'Delete link "' + link.name + '"');
    delBtn.title = 'Delete';
    delBtn.addEventListener('click', function () {
      deleteLink(link.id);
    });

    card.appendChild(anchor);
    card.appendChild(delBtn);

    linksGrid.appendChild(card);
  });
}

/** Add a new link. */
function addLink() {
  var name = linkNameInput.value.trim();
  var url  = normalizeUrl(linkUrlInput.value);

  if (!name || !url) return;

  var link = {
    id:   genId(),
    name: name,
    url:  url
  };

  links.push(link);
  saveLinks();
  linkNameInput.value = '';
  linkUrlInput.value  = '';
  renderLinks();
  linkNameInput.focus();
}

/**
 * Delete a link.
 * @param {string} id
 */
function deleteLink(id) {
  links = links.filter(function (l) { return l.id !== id; });
  saveLinks();
  renderLinks();
}

linkAddBtn.addEventListener('click', addLink);

linkUrlInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') addLink();
});

linkNameInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') addLink();
});

/* ============================================================
   7. Init — bootstrap everything on DOMContentLoaded
   ============================================================ */

function init() {
  // Theme (also applied inline in <head> to avoid flash)
  initTheme();

  // Clock — initial render + live update
  updateClock();
  setInterval(updateClock, 1000);

  // Timer
  var savedMinutes = loadPomodoroMinutes();
  customMinutesInput.value = savedMinutes;
  timerSeconds = savedMinutes * 60;
  renderTimer();

  // To-Do
  loadTodos();
  renderTodos();

  // Links
  loadLinks();
  renderLinks();
}

// Run after DOM is ready (script is at bottom of body, so DOM is already ready,
// but wrapping in DOMContentLoaded is defensive and harmless)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
