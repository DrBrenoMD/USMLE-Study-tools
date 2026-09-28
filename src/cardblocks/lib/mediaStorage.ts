import localforage from 'localforage';

const mediaStore = localforage.createInstance({
  name: 'cardblocks_media'
});

const configStore = localforage.createInstance({
  name: 'cardblocks_media_config'
});

// In-memory cache of resolved object URLs
const urlCache = new Map<string, string>();
let customDirectoryHandle: FileSystemDirectoryHandle | null = null;
let customDirectoryName: string | null = null;

export const mediaStorage = {
  /**
   * Saves a media blob in IndexedDB and registers an Object URL in memory.
   */
  async saveMedia(filename: string, blob: Blob): Promise<string> {
    const cleanName = filename.trim();
    try {
      await mediaStore.setItem(cleanName, blob);
    } catch (e) {
      console.warn('Failed to persist media to IndexedDB:', e);
    }
    const url = URL.createObjectURL(blob);
    urlCache.set(cleanName, url);
    urlCache.set(cleanName.toLowerCase(), url);
    return url;
  },

  /**
   * Synchronously gets an in-memory Object URL if already loaded.
   */
  getMediaUrl(filename: string): string | undefined {
    if (!filename) return undefined;
    const clean = filename.trim();
    return urlCache.get(clean) || urlCache.get(clean.toLowerCase());
  },

  /**
   * Asynchronously loads media from IndexedDB or the Custom Local Folder (File System Access API).
   */
  async loadMedia(filename: string): Promise<string | undefined> {
    if (!filename) return undefined;
    const clean = filename.trim();
    const cached = urlCache.get(clean) || urlCache.get(clean.toLowerCase());
    if (cached) return cached;

    // 1. Check IndexedDB
    try {
      let blob = await mediaStore.getItem<Blob>(clean);
      if (!blob) {
        blob = await mediaStore.getItem<Blob>(clean.toLowerCase());
      }
      if (blob) {
        const url = URL.createObjectURL(blob);
        urlCache.set(clean, url);
        urlCache.set(clean.toLowerCase(), url);
        return url;
      }
    } catch (e) {
      console.warn('Failed to load media from IndexedDB:', e);
    }

    // 2. Check Custom Local Folder if connected (File System Access API)
    if (customDirectoryHandle) {
      try {
        let fileHandle: FileSystemFileHandle | null = null;
        try {
          fileHandle = await customDirectoryHandle.getFileHandle(clean);
        } catch {
          try {
            fileHandle = await customDirectoryHandle.getFileHandle(clean.toLowerCase());
          } catch {}
        }

        if (fileHandle) {
          const file = await fileHandle.getFile();
          const url = URL.createObjectURL(file);
          urlCache.set(clean, url);
          urlCache.set(clean.toLowerCase(), url);
          return url;
        }
      } catch (err) {
        console.warn(`Could not read "${clean}" from custom directory:`, err);
      }
    }

    return undefined;
  },

  /**
   * Retrieves raw Blob from IndexedDB or Custom Local Folder if needed.
   */
  async getMediaBlob(filename: string): Promise<Blob | null> {
    if (!filename) return null;
    const clean = filename.trim();
    try {
      let blob = await mediaStore.getItem<Blob>(clean);
      if (!blob) {
        blob = await mediaStore.getItem<Blob>(clean.toLowerCase());
      }
      if (blob) return blob;
    } catch (e) {
      // Continue to custom folder
    }

    if (customDirectoryHandle) {
      try {
        let fileHandle: FileSystemFileHandle | null = null;
        try {
          fileHandle = await customDirectoryHandle.getFileHandle(clean);
        } catch {
          try {
            fileHandle = await customDirectoryHandle.getFileHandle(clean.toLowerCase());
          } catch {}
        }

        if (fileHandle) {
          return await fileHandle.getFile();
        }
      } catch (err) {}
    }

    return null;
  },

  /**
   * Prompts user to pick a local folder for media (e.g. collection.media or offline assets).
   */
  async selectCustomDirectory(): Promise<{ success: boolean; name?: string; error?: string }> {
    if (typeof window === 'undefined' || !(window as any).showDirectoryPicker) {
      return {
        success: false,
        error: 'Seu navegador não suporta a File System Access API para seleção de pastas locais diretamente.'
      };
    }

    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
      customDirectoryHandle = handle;
      customDirectoryName = handle.name;

      try {
        await configStore.setItem('custom_dir_handle', handle);
        await configStore.setItem('custom_dir_name', handle.name);
      } catch (e) {
        console.warn('Could not persist directory handle:', e);
      }

      return { success: true, name: handle.name };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'Seleção de pasta cancelada pelo usuário.' };
      }
      return { success: false, error: err.message || 'Falha ao acessar pasta selecionada.' };
    }
  },

  /**
   * Disconnects the custom local folder.
   */
  async disconnectCustomDirectory(): Promise<void> {
    customDirectoryHandle = null;
    customDirectoryName = null;
    try {
      await configStore.removeItem('custom_dir_handle');
      await configStore.removeItem('custom_dir_name');
    } catch (e) {}
  },

  /**
   * Gets current custom directory status.
   */
  getCustomDirectoryInfo(): { isConnected: boolean; name: string | null } {
    return {
      isConnected: Boolean(customDirectoryHandle),
      name: customDirectoryName
    };
  },

  /**
   * Estimates current storage usage across IndexedDB.
   */
  async getStorageUsage(): Promise<{
    mediaCount: number;
    estimatedBytes: number;
    quotaBytes?: number;
    usageBytes?: number;
  }> {
    let mediaCount = 0;
    try {
      mediaCount = await mediaStore.length();
    } catch (e) {}

    let quotaBytes: number | undefined;
    let usageBytes: number | undefined;
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        quotaBytes = est.quota;
        usageBytes = est.usage;
      } catch (e) {}
    }

    return {
      mediaCount,
      estimatedBytes: usageBytes || 0,
      quotaBytes,
      usageBytes
    };
  },

  /**
   * Clears media stored in IndexedDB.
   */
  async clearMediaStorage(): Promise<void> {
    try {
      await mediaStore.clear();
      urlCache.clear();
    } catch (e) {
      console.warn('Failed to clear media storage:', e);
    }
  },

  /**
   * Pre-loads media keys into in-memory cache and restores custom directory handle upon app startup.
   */
  async init(): Promise<void> {
    // 1. Try restoring directory handle from configStore
    try {
      const savedHandle = await configStore.getItem<FileSystemDirectoryHandle>('custom_dir_handle');
      const savedName = await configStore.getItem<string>('custom_dir_name');
      if (savedHandle) {
        // Query permission
        const perm = await (savedHandle as any).queryPermission({ mode: 'read' });
        if (perm === 'granted') {
          customDirectoryHandle = savedHandle;
          customDirectoryName = savedName || savedHandle.name;
        }
      }
    } catch (e) {
      console.warn('Could not restore directory handle:', e);
    }

    // 2. Preload IndexedDB media
    try {
      await mediaStore.iterate<Blob, void>((blob, key) => {
        if (blob && !urlCache.has(key)) {
          try {
            const url = URL.createObjectURL(blob);
            urlCache.set(key, url);
            urlCache.set(key.toLowerCase(), url);
          } catch (e) {}
        }
      });
    } catch (e) {
      console.warn('Media store init warning:', e);
    }
  }
};

// Global helper for iframes and window access
if (typeof window !== 'undefined') {
  (window as any).getAppMediaUrl = (filename: string) => mediaStorage.loadMedia(filename);
}
