'use strict';

const {
  loadMachines,
  saveMachines,
  getActiveMachineId,
  generateDeviceId,
  runMigrations,
  DEFAULT_MACHINES,
  LS_MACHINES,
  LS_ACTIVE,
} = require('./logic');

// ── localStorage mock factory ──────────────────────────────────────────────

function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem:    (key)        => store[key] ?? null,
    setItem:    (key, value) => { store[key] = String(value); },
    removeItem: (key)        => { delete store[key]; },
    _store:     store,        // expose for assertions
  };
}

// ── loadMachines ───────────────────────────────────────────────────────────

describe('loadMachines', () => {
  test('returns DEFAULT_MACHINES when localStorage is empty', () => {
    const storage = makeStorage();
    const result = loadMachines(storage);
    expect(Object.keys(result)).toContain('machine_mustang');
    expect(Object.keys(result)).toContain('machine_vti4');
  });

  test('returns a deep clone of DEFAULT_MACHINES (mutations do not affect the constant)', () => {
    const storage = makeStorage();
    const result = loadMachines(storage);
    result.machine_mustang.name = 'MODIFIED';
    expect(DEFAULT_MACHINES.machine_mustang.name).toBe('Mustang');
  });

  test('returns stored machines when localStorage contains valid JSON', () => {
    const storedMachines = {
      machine_test: { id: 'machine_test', name: 'Test', tasks: [], state: {}, notes: {} },
    };
    const storage = makeStorage({ [LS_MACHINES]: JSON.stringify(storedMachines) });
    const result = loadMachines(storage);
    expect(result).toEqual(storedMachines);
  });

  test('returns DEFAULT_MACHINES when localStorage contains malformed JSON', () => {
    const storage = makeStorage({ [LS_MACHINES]: '{ not valid json' });
    const result = loadMachines(storage);
    expect(Object.keys(result)).toContain('machine_mustang');
  });
});

// ── saveMachines ───────────────────────────────────────────────────────────

describe('saveMachines', () => {
  test('serialises machines to localStorage under the correct key', () => {
    const storage = makeStorage();
    const machines = { machine_x: { id: 'machine_x', name: 'X', tasks: [], state: {}, notes: {} } };
    saveMachines(machines, storage);
    const stored = JSON.parse(storage.getItem(LS_MACHINES));
    expect(stored).toEqual(machines);
  });

  test('overwrites an existing entry', () => {
    const storage = makeStorage({ [LS_MACHINES]: JSON.stringify({ machine_old: {} }) });
    const machines = { machine_new: { id: 'machine_new', name: 'New', tasks: [], state: {}, notes: {} } };
    saveMachines(machines, storage);
    const stored = JSON.parse(storage.getItem(LS_MACHINES));
    expect(stored).toEqual(machines);
    expect(stored['machine_old']).toBeUndefined();
  });
});

// ── getActiveMachineId ─────────────────────────────────────────────────────

describe('getActiveMachineId', () => {
  const machines = {
    machine_a: { id: 'machine_a', name: 'A', tasks: [], state: {}, notes: {} },
    machine_b: { id: 'machine_b', name: 'B', tasks: [], state: {}, notes: {} },
  };

  test('returns the stored active machine id when it exists in machines', () => {
    const storage = makeStorage({ [LS_ACTIVE]: 'machine_b' });
    expect(getActiveMachineId(machines, storage)).toBe('machine_b');
  });

  test('falls back to the first machine when stored id is not in machines', () => {
    const storage = makeStorage({ [LS_ACTIVE]: 'machine_deleted' });
    expect(getActiveMachineId(machines, storage)).toBe('machine_a');
  });

  test('returns the first machine when localStorage has no active machine entry', () => {
    const storage = makeStorage();
    expect(getActiveMachineId(machines, storage)).toBe('machine_a');
  });

  test('returns null when machines object is empty', () => {
    const storage = makeStorage();
    expect(getActiveMachineId({}, storage)).toBeNull();
  });
});

// ── generateDeviceId ───────────────────────────────────────────────────────

describe('generateDeviceId', () => {
  const ALLOWED_CHARS = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');

  test('always starts with "PM-"', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateDeviceId()).toMatch(/^PM-/);
    }
  });

  test('has total length of 11 characters (prefix "PM-" + 8 random chars)', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateDeviceId()).toHaveLength(11);
    }
  });

  test('uses only characters from the allowed set', () => {
    for (let i = 0; i < 50; i++) {
      const id = generateDeviceId();
      const suffix = id.slice(3); // strip "PM-"
      for (const char of suffix) {
        expect(ALLOWED_CHARS.has(char)).toBe(true);
      }
    }
  });

  test('generates different IDs across calls (probabilistically)', () => {
    const ids = new Set(Array.from({ length: 30 }, () => generateDeviceId()));
    // With 32^8 ≈ 10^12 possibilities the probability of a collision in 30
    // attempts is negligible; even one collision would be suspicious.
    expect(ids.size).toBeGreaterThan(1);
  });

  test('never includes ambiguous characters (O, I, 0, 1)', () => {
    const ambiguous = new Set(['O', 'I', '0', '1']);
    for (let i = 0; i < 100; i++) {
      const id = generateDeviceId();
      const suffix = id.slice(3);
      for (const char of suffix) {
        expect(ambiguous.has(char)).toBe(false);
      }
    }
  });
});

// ── runMigrations ──────────────────────────────────────────────────────────

describe('runMigrations', () => {
  test('removes machine_antihaze when it exists', () => {
    const machines = {
      machine_antihaze: { id: 'machine_antihaze', name: 'PMMA Antihaze', tasks: [], state: {}, notes: {} },
      machine_mustang:  { id: 'machine_mustang', name: 'Mustang', tasks: [], state: {}, notes: {} },
    };
    runMigrations(machines, 'machine_mustang', null);
    expect(machines['machine_antihaze']).toBeUndefined();
    expect(machines['machine_mustang']).toBeDefined();
  });

  test('adds machine_vti4 when it does not exist', () => {
    const machines = {
      machine_mustang: { id: 'machine_mustang', name: 'Mustang', tasks: [], state: {}, notes: {} },
    };
    runMigrations(machines, 'machine_mustang', null);
    expect(machines['machine_vti4']).toBeDefined();
    expect(machines['machine_vti4'].name).toBe('VTI 4');
  });

  test('does not overwrite an existing machine_vti4', () => {
    const existingVTI4 = { id: 'machine_vti4', name: 'VTI 4', tasks: [{ id: 'custom' }], state: {}, notes: {} };
    const machines = {
      machine_mustang: { id: 'machine_mustang', name: 'Mustang', tasks: [], state: {}, notes: {} },
      machine_vti4:    existingVTI4,
    };
    runMigrations(machines, 'machine_mustang', null);
    expect(machines['machine_vti4'].tasks).toHaveLength(1);
  });

  test('calls saveFn when a migration change is made', () => {
    const machines = {
      machine_antihaze: { id: 'machine_antihaze', name: 'PMMA Antihaze', tasks: [], state: {}, notes: {} },
      machine_mustang:  { id: 'machine_mustang', name: 'Mustang', tasks: [], state: {}, notes: {} },
    };
    const saveFn = jest.fn();
    runMigrations(machines, 'machine_mustang', saveFn);
    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  test('does not call saveFn when no migration is needed', () => {
    const machines = {
      machine_mustang: { id: 'machine_mustang', name: 'Mustang', tasks: [], state: {}, notes: {} },
      machine_vti4:    { id: 'machine_vti4', name: 'VTI 4', tasks: [], state: {}, notes: {} },
    };
    const saveFn = jest.fn();
    runMigrations(machines, 'machine_mustang', saveFn);
    expect(saveFn).not.toHaveBeenCalled();
  });

  test('returns the first remaining machine id when active was machine_antihaze', () => {
    const machines = {
      machine_antihaze: { id: 'machine_antihaze', name: 'PMMA Antihaze', tasks: [], state: {}, notes: {} },
      machine_mustang:  { id: 'machine_mustang', name: 'Mustang', tasks: [], state: {}, notes: {} },
    };
    const newActive = runMigrations(machines, 'machine_antihaze', null);
    // machine_antihaze was deleted; first remaining key is machine_mustang
    expect(newActive).not.toBe('machine_antihaze');
    expect(machines[newActive]).toBeDefined();
  });

  test('returns the original activeMachineId unchanged when no machine was deleted', () => {
    const machines = {
      machine_mustang: { id: 'machine_mustang', name: 'Mustang', tasks: [], state: {}, notes: {} },
    };
    const newActive = runMigrations(machines, 'machine_mustang', null);
    expect(newActive).toBe('machine_mustang');
  });
});
