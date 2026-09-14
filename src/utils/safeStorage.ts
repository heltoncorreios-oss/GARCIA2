const memoryStore: Record<string, string> = {};

function canAccessLocalStorage(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const testKey = '__storage_test_key__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (canAccessLocalStorage()) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Fallback silently to memory store
    }
    return memoryStore[key] ?? null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (canAccessLocalStorage()) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Fallback silently to memory store
    }
    memoryStore[key] = value;
  },

  removeItem: (key: string): void => {
    try {
      if (canAccessLocalStorage()) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {
      // Fallback silently
    }
    delete memoryStore[key];
  }
};

