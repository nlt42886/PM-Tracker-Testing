'use strict';

/**
 * tests/logic.js
 *
 * Pure business-logic functions extracted from index.html for unit testing.
 *
 * IMPORTANT: Keep these functions in sync with index.html.
 * This file exists because the application bundles all code inside a single
 * HTML file, making the logic untestable directly.  A recommended refactor is
 * to move these functions into a standalone ES module (e.g. src/logic.js) so
 * that both index.html and the test suite import from the same source.
 *
 * Differences from the original (intentional, for testability):
 *  - getStatus(task, state) accepts an optional `state` argument instead of
 *    reading from the global `machines` variable.
 *  - loadMachines(storage), saveMachines(machines, storage), and
 *    getActiveMachineId(machines, storage) accept an injectable storage object
 *    instead of relying on the global `localStorage`.
 *  - runMigrations(machines, activeMachineId, saveFn) accepts its dependencies
 *    as arguments and returns the (possibly updated) activeMachineId.
 */

// ── Date Utilities ─────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateFromStr(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function strFromDate(d) {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(m) - 1] + ' ' + parseInt(d) + ', ' + y;
}

function daysDiff(dateStr) {
  return Math.round((dateFromStr(dateStr) - dateFromStr(today())) / 86400000);
}

// ── Frequency Calculations ─────────────────────────────────────────────────

function calcNextDue(fromDateStr, freq) {
  // Custom format (e.g. "2mo", "3d", "1w", "1y") takes priority.
  if (/^\d+(d|w|mo|y)$/.test(freq)) return calcNextDueCustom(fromDateStr, freq);

  // Legacy format handling ("1m", "2m", "3m", "6m").
  // NOTE: "1w" and "1y" are dead code here; the regex above catches them first.
  const d = dateFromStr(fromDateStr);
  const day = d.getDate();
  let y = d.getFullYear();
  let m = d.getMonth();

  if (freq === '1w') { d.setDate(day + 7); return strFromDate(d); } // unreachable

  const addMonths = (n) => {
    m += n;
    if (m > 11) { y += Math.floor(m / 12); m = m % 12; }
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(Math.min(day, daysInMonth)).padStart(2, '0')}`;
  };

  if (freq === '1m') return addMonths(1);
  if (freq === '2m') return addMonths(2);
  if (freq === '3m') return addMonths(3);
  if (freq === '6m') return addMonths(6);
  if (freq === '1y') { // unreachable
    y += 1;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(Math.min(day, daysInMonth)).padStart(2, '0')}`;
  }

  return fromDateStr;
}

function calcNextDueCustom(fromDateStr, freq) {
  const match = freq.match(/^(\d+)(d|w|mo|y)$/);
  if (!match) return fromDateStr;
  const n = parseInt(match[1]);
  const t = match[2];
  const d = new Date(fromDateStr + 'T00:00:00');
  if (t === 'd')  d.setDate(d.getDate() + n);
  else if (t === 'w')  d.setDate(d.getDate() + n * 7);
  else if (t === 'mo') d.setMonth(d.getMonth() + n);
  else if (t === 'y')  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}

function freqTotalDays(freq) {
  if (freq === '1w') return 7;
  if (freq === '1m') return 30;
  if (freq === '2m') return 60;
  if (freq === '3m') return 90;
  if (freq === '6m') return 180;
  if (freq === '1y') return 365;
  const match = freq.match(/^(\d+)(d|w|mo|y)$/);
  if (!match) return 30;
  const n = parseInt(match[1]);
  const t = match[2];
  if (t === 'd')  return n;
  if (t === 'w')  return n * 7;
  if (t === 'mo') return n * 30;
  if (t === 'y')  return n * 365;
  return 30;
}

function freqCodeToLabel(freq) {
  const match = freq.match(/^(\d+)(d|w|mo|y)$/);
  if (!match) return freq;
  const n = match[1];
  const t = match[2];
  if (t === 'd')  return n + ' Day'   + (n === '1' ? '' : 's');
  if (t === 'w')  return n + ' Week'  + (n === '1' ? '' : 's');
  if (t === 'mo') return n + ' Month' + (n === '1' ? '' : 's');
  if (t === 'y')  return n + ' Year'  + (n === '1' ? '' : 's');
  return freq;
}

// ── Status Logic ───────────────────────────────────────────────────────────

/**
 * Returns the status of a task given the current completion state.
 *
 * @param {object} task  - Task object with at least `id` and `freq`.
 * @param {object} state - Map of taskId → { nextDue, history }.
 *                         In the real app this is read from the global machines
 *                         variable; here it is injected for testability.
 */
function getStatus(task, state = {}) {
  const ts = state[task.id];
  if (!ts || !ts.nextDue) return 'pending';
  const diff = daysDiff(ts.nextDue);
  if (diff < 0) return 'overdue';
  const total = freqTotalDays(task.freq);
  const soonDays = total <= 7 ? 3 : total <= 60 ? 7 : total <= 180 ? 14 : 30;
  return diff <= soonDays ? 'due-soon' : 'ok';
}

// ── Device ID ──────────────────────────────────────────────────────────────

function generateDeviceId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'PM-';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ── Machine Management ─────────────────────────────────────────────────────

const LS_MACHINES = 'pmtracker_machines';
const LS_ACTIVE   = 'pmtracker_activemachine';

/**
 * A representative subset of the default machines used in tests.
 * The full list lives in index.html; this is intentionally trimmed to keep
 * the test fixture small.
 */
const DEFAULT_MACHINES = {
  machine_mustang: {
    id: 'machine_mustang',
    name: 'Mustang',
    tasks: [
      { id: 'm_1',  name: 'Check and Fill All Oil Lubricators',      freq: '1w',  freqLabel: '1 Week' },
      { id: 'm_5',  name: 'Check Color of Diffusion Pump Oil',       freq: '1m',  freqLabel: '1 Month' },
      { id: 'm_7',  name: 'Clean Electrical Control Cabinet Filter', freq: '2mo', freqLabel: '2 Months' },
      { id: 'm_10', name: 'Clean and Calibrate Chamber Gauge',       freq: '3mo', freqLabel: '3 Months' },
      { id: 'm_14', name: 'Replace Door Seal',                       freq: '6mo', freqLabel: '6 Months' },
      { id: 'm_17', name: 'Change Demist Filters',                   freq: '1y',  freqLabel: '1 Year' },
    ],
    state: {},
    notes: {},
  },
  machine_vti4: {
    id: 'machine_vti4',
    name: 'VTI 4',
    tasks: [],
    state: {},
    notes: {},
  },
};

function loadMachines(storage = global.localStorage) {
  try {
    const raw = storage.getItem(LS_MACHINES);
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_MACHINES));
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_MACHINES));
  }
}

function saveMachines(machines, storage = global.localStorage) {
  storage.setItem(LS_MACHINES, JSON.stringify(machines));
}

function getActiveMachineId(machines, storage = global.localStorage) {
  let id = storage.getItem(LS_ACTIVE);
  if (!id || !machines[id]) id = Object.keys(machines)[0] || null;
  return id;
}

// ── Data Migration ─────────────────────────────────────────────────────────

/**
 * Runs one-time data migrations.  Mutates `machines` in place and calls
 * `saveFn` when a change was made.  Returns the (possibly updated) active
 * machine id.
 */
function runMigrations(machines, activeMachineId, saveFn) {
  let changed = false;

  if (machines['machine_antihaze']) {
    delete machines['machine_antihaze'];
    changed = true;
  }

  if (!machines['machine_vti4']) {
    machines['machine_vti4'] = {
      id: 'machine_vti4',
      name: 'VTI 4',
      tasks: [],
      state: {},
      notes: {},
    };
    changed = true;
  }

  if (changed && saveFn) saveFn(machines);

  if (activeMachineId === 'machine_antihaze') {
    return Object.keys(machines)[0];
  }
  return activeMachineId;
}

module.exports = {
  today,
  dateFromStr,
  strFromDate,
  formatDate,
  daysDiff,
  calcNextDue,
  calcNextDueCustom,
  freqTotalDays,
  freqCodeToLabel,
  getStatus,
  generateDeviceId,
  loadMachines,
  saveMachines,
  getActiveMachineId,
  runMigrations,
  DEFAULT_MACHINES,
  LS_MACHINES,
  LS_ACTIVE,
};
