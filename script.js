/* ====================================================
   STORAGE
   ==================================================== */
const STORE_HABITS      = 'ht_habits';
const STORE_COMPLETIONS = 'ht_completions';

function loadHabits() {
  try { return JSON.parse(localStorage.getItem(STORE_HABITS)) || []; }
  catch { return []; }
}

function loadCompletions() {
  try { return JSON.parse(localStorage.getItem(STORE_COMPLETIONS)) || {}; }
  catch { return {}; }
}

function saveHabits()      { localStorage.setItem(STORE_HABITS,      JSON.stringify(habits)); }
function saveCompletions() { localStorage.setItem(STORE_COMPLETIONS, JSON.stringify(completions)); }

/* ====================================================
   DATE HELPERS
   ==================================================== */
function toDateStr(date) {
  // Local date string to avoid UTC-offset surprises
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayStr()    { return toDateStr(new Date()); }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return toDateStr(d); }

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

// 0 = Sunday … 6 = Saturday
function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function fmtShort(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

/* ====================================================
   CATEGORY COLORS
   ==================================================== */
const CAT_COLOR = {
  health:    '#38bdf8',
  education: '#c084fc',
  fitness:   '#4ade80',
  work:      '#fb923c',
  tasks:     '#facc15',
  other:     '#f472b6',
};

function colorOf(cat) { return CAT_COLOR[cat] || CAT_COLOR.other; }

/* ====================================================
   CORE HABIT LOGIC
   ==================================================== */
let habits      = loadHabits();
let completions = loadCompletions();

function isHabitDueOn(habit, dateStr) {
  if (habit.type === 'one-time') return habit.date === dateStr;
  // Recurring: only counts from the day it was created
  if (habit.createdAt > dateStr) return false;
  if (habit.frequency === 'daily') return true;
  return habit.days.includes(weekdayOf(dateStr));
}

function habitsForDate(dateStr) {
  return habits.filter(h => isHabitDueOn(h, dateStr));
}

function completionsForDate(dateStr) {
  return completions[dateStr] || [];
}

function isComplete(habitId, dateStr) {
  return completionsForDate(dateStr).includes(habitId);
}

function toggleCompletion(habitId, dateStr) {
  if (!completions[dateStr]) completions[dateStr] = [];
  const idx = completions[dateStr].indexOf(habitId);
  if (idx === -1) completions[dateStr].push(habitId);
  else            completions[dateStr].splice(idx, 1);
  saveCompletions();
}

// Returns 0–100, or null if nothing is due that day
function dayPercent(dateStr) {
  const due = habitsForDate(dateStr);
  if (due.length === 0) return null;
  const done = due.filter(h => isComplete(h.id, dateStr)).length;
  return Math.round((done / due.length) * 100);
}

// Streak definition: consecutive past days (from yesterday back) where every
// due habit was completed (100%). Days with nothing due are skipped — they
// neither extend nor break the streak. Today's completion adds +1 bonus when
// you hit 100%, so you see the streak grow as you check things off.
function calcStreak() {
  let streak = 0;
  for (let i = 1; i <= 730; i++) {
    const pct = dayPercent(daysAgo(i));
    if (pct === null) continue;   // nothing due — skip
    if (pct === 100)  streak++;
    else              break;      // missed a day
  }
  if (dayPercent(todayStr()) === 100) streak++;
  return streak;
}

function mkId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function addHabit(habit) {
  habits.push(habit);
  saveHabits();
}

function removeHabit(id) {
  habits = habits.filter(h => h.id !== id);
  for (const date of Object.keys(completions)) {
    completions[date] = completions[date].filter(hId => hId !== id);
    if (!completions[date].length) delete completions[date];
  }
  saveHabits();
  saveCompletions();
}

/* ====================================================
   RENDER — STATS
   ==================================================== */
const elTodayPct      = document.getElementById('today-percent');
const elTodayDone     = document.getElementById('today-done');
const elMonthlyAvg    = document.getElementById('monthly-avg');
const elStreakCount   = document.getElementById('streak-count');
const elTodayProg     = document.getElementById('today-progress');
const elDoneProg      = document.getElementById('today-done-progress');
const elAvgProg       = document.getElementById('avg-progress');
const elHeaderDate    = document.getElementById('header-date');

function renderStats() {
  const t     = todayStr();
  const due   = habitsForDate(t);
  const done  = due.filter(h => isComplete(h.id, t)).length;
  const pct   = due.length ? Math.round((done / due.length) * 100) : 0;

  elTodayPct.textContent  = pct + '%';
  elTodayDone.textContent = `${done} / ${due.length}`;
  elTodayProg.style.width = pct + '%';
  elDoneProg.style.width  = due.length ? (done / due.length * 100) + '%' : '0%';

  // 30-day average (days with items only)
  let total = 0, counted = 0;
  for (let i = 0; i < 30; i++) {
    const p = dayPercent(daysAgo(i));
    if (p !== null) { total += p; counted++; }
  }
  const avg = counted ? Math.round(total / counted) : null;
  elMonthlyAvg.textContent = avg !== null ? avg + '%' : '—';
  elAvgProg.style.width    = avg !== null ? avg + '%' : '0%';

  elStreakCount.textContent = calcStreak();
}

/* ====================================================
   RENDER — HABIT LISTS
   ==================================================== */
const elTodayList     = document.getElementById('today-list');
const elTomorrowList  = document.getElementById('tomorrow-list');
const elTodayEmpty    = document.getElementById('today-empty');
const elTomorrowEmpty = document.getElementById('tomorrow-empty');
const elTodayCount    = document.getElementById('today-count');
const elTomorrowCount = document.getElementById('tomorrow-count');

function pluralItems(n) { return `${n} item${n !== 1 ? 's' : ''}`; }

function makeHabitItem(habit, dateStr, readOnly) {
  const li = document.createElement('li');
  li.className = 'habit-item' + (isComplete(habit.id, dateStr) ? ' completed' : '');

  const color = colorOf(habit.category);

  // Checkbox
  const cb = document.createElement('input');
  cb.type      = 'checkbox';
  cb.className = 'habit-checkbox';
  cb.checked   = isComplete(habit.id, dateStr);
  cb.style.setProperty('--check-color', color);
  if (readOnly) {
    cb.disabled = true;
  } else {
    cb.addEventListener('change', () => {
      toggleCompletion(habit.id, dateStr);
      li.classList.toggle('completed', cb.checked);
      renderStats();
      renderChart();
    });
  }

  // Category dot
  const dot = document.createElement('span');
  dot.className = 'cat-dot';
  dot.style.background = color;
  dot.style.boxShadow  = `0 0 5px ${color}`;

  // Name
  const name = document.createElement('span');
  name.className   = 'habit-name';
  name.textContent = habit.name;

  // Recurrence badge
  const recur = document.createElement('span');
  recur.className = 'recur-icon';
  if (habit.type === 'recurring') {
    if (habit.frequency === 'daily') {
      recur.textContent = '↻';
    } else {
      const labels = ['Su','Mo','Tu','We','Th','Fr','Sa'];
      recur.textContent = '↻ ' + habit.days.map(d => labels[d]).join(' ');
    }
  }

  // Delete button (not shown in read-only tomorrow preview for recurring;
  // shown for one-time tasks so you can cancel a planned item)
  const del = document.createElement('button');
  del.className   = 'delete-btn';
  del.title       = 'Delete';
  del.textContent = '×';
  del.addEventListener('click', () => {
    const isRecurring = habit.type === 'recurring';
    const msg = isRecurring
      ? `Delete recurring habit "${habit.name}"? It will be removed from all days.`
      : `Delete "${habit.name}"?`;
    if (!confirm(msg)) return;
    removeHabit(habit.id);
    renderAll();
  });

  li.appendChild(cb);
  li.appendChild(dot);
  li.appendChild(name);
  li.appendChild(recur);
  li.appendChild(del);
  return li;
}

function renderList(dateStr, listEl, emptyEl, countEl, readOnly) {
  const due = habitsForDate(dateStr);
  listEl.innerHTML = '';

  if (!due.length) {
    emptyEl.style.display  = 'block';
    countEl.textContent    = '0 items';
    return;
  }

  emptyEl.style.display = 'none';
  countEl.textContent   = pluralItems(due.length);

  // Sort: incomplete first, then by name
  const sorted = [...due].sort((a, b) => {
    const ac = isComplete(a.id, dateStr) ? 1 : 0;
    const bc = isComplete(b.id, dateStr) ? 1 : 0;
    if (ac !== bc) return ac - bc;
    return a.name.localeCompare(b.name);
  });

  sorted.forEach(h => listEl.appendChild(makeHabitItem(h, dateStr, readOnly)));
}

function renderLists() {
  renderList(todayStr(),    elTodayList,    elTodayEmpty,    elTodayCount,    false);
  renderList(tomorrowStr(), elTomorrowList, elTomorrowEmpty, elTomorrowCount, true);
}

/* ====================================================
   RENDER — CHART
   ==================================================== */
const canvas = document.getElementById('chart');

function renderChart() {
  const ctx  = canvas.getContext('2d');
  const dpr  = window.devicePixelRatio || 1;
  const cssW = canvas.parentElement.clientWidth || 800;
  const cssH = 200;

  canvas.width  = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.width  = cssW + 'px';
  canvas.style.height = cssH + 'px';
  ctx.scale(dpr, dpr);

  const PAD  = { top: 14, right: 14, bottom: 30, left: 36 };
  const plotW = cssW - PAD.left - PAD.right;
  const plotH = cssH - PAD.top  - PAD.bottom;
  const DAYS  = 30;

  // Collect data
  const data = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const dateStr = daysAgo(i);
    data.push({ dateStr, pct: dayPercent(dateStr) ?? 0 });
  }

  // Convert to canvas coordinates
  const pts = data.map((d, i) => ({
    x:       PAD.left + (i / (DAYS - 1)) * plotW,
    y:       PAD.top  + plotH * (1 - d.pct / 100),
    pct:     d.pct,
    dateStr: d.dateStr,
  }));

  ctx.clearRect(0, 0, cssW, cssH);

  // Grid lines + Y labels
  ctx.lineWidth = 1;
  [0, 25, 50, 75, 100].forEach(pct => {
    const y = PAD.top + plotH * (1 - pct / 100);

    ctx.strokeStyle = '#21262d';
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + plotW, y);
    ctx.stroke();

    ctx.fillStyle  = '#484f58';
    ctx.font       = `10px Inter, sans-serif`;
    ctx.textAlign  = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(pct + '%', PAD.left - 5, y);
  });

  // Gradient fill under the line
  const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
  grad.addColorStop(0, 'rgba(56,189,248,0.22)');
  grad.addColorStop(1, 'rgba(56,189,248,0)');

  ctx.beginPath();
  ctx.moveTo(pts[0].x, PAD.top + plotH);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, PAD.top + plotH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth   = 2;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.stroke();

  // Dots
  pts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.pct > 0 ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle   = p.pct > 0 ? '#38bdf8' : '#21262d';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth   = 1.5;
    ctx.fill();
    ctx.stroke();
  });

  // X-axis date labels every 5 days + today
  ctx.fillStyle    = '#484f58';
  ctx.font         = '10px Inter, sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  pts.forEach((p, i) => {
    if (i % 5 === 0 || i === DAYS - 1) {
      ctx.fillText(fmtShort(p.dateStr), p.x, cssH - 6);
    }
  });

  // Store pts for tooltip hit-testing
  canvas._pts = pts;
}

/* ====================================================
   CHART TOOLTIP
   ==================================================== */
const tooltip = document.getElementById('tooltip');

canvas.addEventListener('mousemove', e => {
  const pts = canvas._pts;
  if (!pts) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;

  let nearest = null, minDx = Infinity;
  pts.forEach(p => {
    const dx = Math.abs(p.x - mx);
    if (dx < minDx) { minDx = dx; nearest = p; }
  });

  if (nearest && minDx < 18) {
    tooltip.textContent  = `${fmtShort(nearest.dateStr)}  —  ${nearest.pct}%`;
    tooltip.style.left   = (e.clientX + 14) + 'px';
    tooltip.style.top    = (e.clientY - 10) + 'px';
    tooltip.style.display = 'block';
  } else {
    tooltip.style.display = 'none';
  }
});

canvas.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

/* ====================================================
   FORM STATE
   ==================================================== */
let formCategory = 'health';
let formType     = 'one-time';
let formFreq     = 'daily';
let formDays     = [];
let formTarget   = 'today';

const elHabitInput      = document.getElementById('habit-input');
const elCategoryPills   = document.querySelectorAll('#category-pills .pill');
const elTypeBtns        = document.querySelectorAll('#type-toggle .toggle-btn');
const elFreqBtns        = document.querySelectorAll('#freq-toggle .freq-btn');
const elDayBtns         = document.querySelectorAll('.day-btn');
const elTargetBtns      = document.querySelectorAll('#target-toggle .target-btn');
const elRecurringOpts   = document.getElementById('recurring-options');
const elDayPickerRow    = document.getElementById('day-picker-row');
const elDayTargetRow    = document.getElementById('day-target-row');
const elAddBtn          = document.getElementById('add-btn');
const elExportBtn       = document.getElementById('export-btn');
const elImportInput     = document.getElementById('import-input');
const elClearBtn        = document.getElementById('clear-btn');

function initForm() {
  // Header date
  elHeaderDate.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // Category pills — activate first by default
  elCategoryPills[0].classList.add('active');
  elCategoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      elCategoryPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      formCategory = pill.dataset.category;
    });
  });

  // Type toggle
  elTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elTypeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      formType = btn.dataset.type;

      if (formType === 'recurring') {
        elRecurringOpts.classList.remove('hidden');
        elDayTargetRow.classList.add('hidden');
      } else {
        elRecurringOpts.classList.add('hidden');
        elDayTargetRow.classList.remove('hidden');
      }
    });
  });

  // Frequency toggle
  elFreqBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elFreqBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      formFreq = btn.dataset.freq;
      elDayPickerRow.classList.toggle('hidden', formFreq !== 'weekdays');
    });
  });

  // Day-of-week picker
  elDayBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const day = parseInt(btn.dataset.day);
      const idx = formDays.indexOf(day);
      if (idx === -1) formDays.push(day);
      else            formDays.splice(idx, 1);
    });
  });

  // Today / Tomorrow target
  elTargetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elTargetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      formTarget = btn.dataset.target;
    });
  });

  // Add button + Enter key
  elAddBtn.addEventListener('click', handleAdd);
  elHabitInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleAdd(); });

  // Data management
  elExportBtn.addEventListener('click', exportBackup);
  elImportInput.addEventListener('change', importBackup);
  elClearBtn.addEventListener('click', () => {
    if (!confirm('Clear ALL habit data? This cannot be undone.')) return;
    habits = []; completions = {};
    saveHabits(); saveCompletions();
    renderAll();
  });
}

function handleAdd() {
  const name = elHabitInput.value.trim();
  if (!name) { elHabitInput.focus(); return; }

  if (formType === 'recurring' && formFreq === 'weekdays' && formDays.length === 0) {
    alert('Pick at least one day for this recurring habit.');
    return;
  }

  const habit = {
    id:        mkId(),
    name,
    category:  formCategory,
    type:      formType,
    createdAt: todayStr(),
  };

  if (formType === 'one-time') {
    habit.date = formTarget === 'today' ? todayStr() : tomorrowStr();
  } else {
    habit.frequency = formFreq;
    habit.days      = formFreq === 'weekdays' ? [...formDays].sort() : [];
  }

  addHabit(habit);
  elHabitInput.value = '';
  elHabitInput.focus();
  renderAll();
}

/* ====================================================
   BACKUP / RESTORE
   ==================================================== */
function exportBackup() {
  const payload = JSON.stringify({ habits, completions, exportedAt: new Date().toISOString() }, null, 2);
  const blob    = new Blob([payload], { type: 'application/json' });
  const a       = document.createElement('a');
  a.href        = URL.createObjectURL(blob);
  a.download    = `habit-tracker-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data.habits) || typeof data.completions !== 'object') {
        throw new Error('Unexpected format');
      }
      const msg = `Import ${data.habits.length} habits from backup?\nThis will replace your current data.`;
      if (!confirm(msg)) return;
      habits = data.habits;
      completions = data.completions;
      saveHabits();
      saveCompletions();
      renderAll();
    } catch {
      alert('Could not read that file. Make sure it was exported from this app.');
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // allow re-importing the same file
}

/* ====================================================
   RENDER ALL
   ==================================================== */
function renderAll() {
  renderLists();
  renderStats();
  renderChart();
}

/* ====================================================
   INIT
   ==================================================== */
initForm();
renderAll();

window.addEventListener('resize', renderChart);
