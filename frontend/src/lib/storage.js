// localStorage wrappers: storage can be blocked (private mode), so never throw.

export function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const HISTORY_KEY = "spf.assistant.history";

export function getHistory() {
  const list = readJson(HISTORY_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function addHistory(entry) {
  const list = getHistory().filter((h) => h.id !== entry.id);
  list.unshift({ ...entry, at: entry.at || new Date().toISOString() });
  writeJson(HISTORY_KEY, list.slice(0, 20));
}
