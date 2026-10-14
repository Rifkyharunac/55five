import { mergeHistory, restoreSession } from './model.js';

export const HISTORY_KEY = 'five55_history_v2';
const LEGACY_KEY = 'five55_history_v1';
const SESSION_KEY = 'five55_session_v2';
const SETTINGS_KEY = 'five55_settings_v2';

export function createStorage(getLocal, getSession, onError = () => {}) {
  function read(getStore, key, fallback) {
    try {
      const text = getStore().getItem(key);
      return text === null ? fallback : JSON.parse(text);
    } catch {
      onError('Data lokal tidak dapat dibaca. Sesi tetap berjalan di memori.');
      return fallback;
    }
  }
  function write(getStore, key, data) {
    try {
      getStore().setItem(key, JSON.stringify(data));
      return true;
    } catch {
      onError(
        'Penyimpanan browser tidak tersedia atau penuh. Perubahan mungkin hilang saat dimuat ulang.',
      );
      return false;
    }
  }
  return {
    loadHistory() {
      return mergeHistory(read(getLocal, LEGACY_KEY, []), read(getLocal, HISTORY_KEY, []));
    },
    saveHistory(history) {
      // Read first to preserve results saved by another tab since the last poll.
      return write(getLocal, HISTORY_KEY, mergeHistory(read(getLocal, HISTORY_KEY, []), history));
    },
    loadSession() {
      return restoreSession(read(getSession, SESSION_KEY, null));
    },
    saveSession(session) {
      return write(getSession, SESSION_KEY, session);
    },
    loadSettings() {
      const value = read(getLocal, SETTINGS_KEY, {});
      return {
        theme: value?.theme === 'light' ? 'light' : 'dark',
        compact: value?.compact === true,
      };
    },
    saveSettings(settings) {
      return write(getLocal, SETTINGS_KEY, settings);
    },
  };
}
