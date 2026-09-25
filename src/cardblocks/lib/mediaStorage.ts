import localforage from 'localforage';

const mediaStore = localforage.createInstance({
  name: 'cardblocks_media'
});

// In-memory cache of resolved object URLs
const urlCache = new Map<string, string>();

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
   * Asynchronously loads media from IndexedDB and caches its Object URL.
   */
  async loadMedia(filename: string): Promise<string | undefined> {
    if (!filename) return undefined;
    const clean = filename.trim();
    const cached = urlCache.get(clean) || urlCache.get(clean.toLowerCase());
    if (cached) return cached;

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
    return undefined;
  },

  /**
   * Retrieves raw Blob from IndexedDB if needed.
   */
  async getMediaBlob(filename: string): Promise<Blob | null> {
    if (!filename) return null;
    const clean = filename.trim();
    try {
      let blob = await mediaStore.getItem<Blob>(clean);
      if (!blob) {
        blob = await mediaStore.getItem<Blob>(clean.toLowerCase());
      }
      return blob;
    } catch (e) {
      return null;
    }
  },

  /**
   * Pre-loads media keys into in-memory cache upon app startup.
   */
  async init(): Promise<void> {
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
