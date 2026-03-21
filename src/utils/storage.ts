type StorageShape = {
  get: (keys: string[], callback: (result: Record<string, unknown>) => void) => void;
  set: (items: Record<string, unknown>, callback?: () => void) => void;
};

type StorageAreaName = 'local' | 'sync' | 'managed' | 'session' | string;

interface StorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

interface StorageChangedEvent {
  addListener: (listener: (changes: Record<string, StorageChange>, areaName: StorageAreaName) => void) => void;
  removeListener: (listener: (changes: Record<string, StorageChange>, areaName: StorageAreaName) => void) => void;
}

type ChromeLike = {
  chrome?: {
    storage?: {
      local?: StorageShape;
      onChanged?: StorageChangedEvent;
    };
  };
};

const chromeStorageApi = (globalThis as ChromeLike).chrome?.storage;
const chromeStorage = chromeStorageApi?.local;
const chromeStorageOnChanged = chromeStorageApi?.onChanged;

export async function getFromStorage<T>(key: string): Promise<T | undefined> {
  if (chromeStorage) {
    return new Promise((resolve) => {
      chromeStorage.get([key], (result) => {
        resolve(result[key] as T | undefined);
      });
    });
  }

  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return undefined;
    }

    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export async function setInStorage<T>(key: string, value: T): Promise<void> {
  if (chromeStorage) {
    return new Promise((resolve) => {
      chromeStorage.set({ [key]: value }, () => resolve());
    });
  }

  localStorage.setItem(key, JSON.stringify(value));
}

export function subscribeToStorageKey<T>(
  key: string,
  onValue: (value: T | undefined) => void
): () => void {
  if (chromeStorageOnChanged) {
    const listener = (changes: Record<string, StorageChange>, areaName: StorageAreaName) => {
      if (areaName !== 'local') {
        return;
      }

      if (!(key in changes)) {
        return;
      }

      onValue(changes[key]?.newValue as T | undefined);
    };

    chromeStorageOnChanged.addListener(listener);
    return () => chromeStorageOnChanged.removeListener(listener);
  }

  if (typeof window !== 'undefined') {
    const listener = (event: StorageEvent) => {
      if (event.key !== key) {
        return;
      }

      if (event.newValue === null) {
        onValue(undefined);
        return;
      }

      try {
        onValue(JSON.parse(event.newValue) as T);
      } catch {
        onValue(undefined);
      }
    };

    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }

  return () => undefined;
}
