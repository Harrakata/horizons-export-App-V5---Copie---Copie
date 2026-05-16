import { useCallback, useState } from 'react';

/**
 * Persists page state across navigation (in-memory) and page refreshes (localStorage).
 *
 * The module-level Map is the primary store — it survives component unmount/remount
 * within the same browser session without any serialization. localStorage is only
 * read on the very first access (after a page refresh) and written on every change.
 *
 * @param {string} pageKey      Unique identifier for the page (e.g. 'agences')
 * @param {string} stateKey     Identifier for the specific piece of state (e.g. 'search')
 * @param {*}      defaultValue Initial value if nothing is stored yet
 */

const _store = new Map();

function readValue(key, defaultValue) {
  if (_store.has(key)) return _store.get(key);
  try {
    const raw = localStorage.getItem(`ps:${key}`);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      _store.set(key, parsed);
      return parsed;
    }
  } catch {
    // ignore
  }
  return defaultValue;
}

function writeValue(key, value) {
  _store.set(key, value);
  try {
    localStorage.setItem(`ps:${key}`, JSON.stringify(value));
  } catch {
    // quota exceeded or unavailable
  }
}

export function usePageState(pageKey, stateKey, defaultValue) {
  const key = `${pageKey}:${stateKey}`;

  const [state, setState] = useState(() => readValue(key, defaultValue));

  const setPersistedState = useCallback(
    (value) => {
      setState((prev) => {
        const next = typeof value === 'function' ? value(prev) : value;
        writeValue(key, next);
        return next;
      });
    },
    [key],
  );

  return [state, setPersistedState];
}
