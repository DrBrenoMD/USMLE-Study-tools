import initSqlJs from 'sql.js';
import JSZip from 'jszip';
import AnkiExport from 'anki-apkg-export';
import { saveAs } from 'file-saver';
import { decompress } from 'fzstd';
import type { Deck, Flashcard } from '../store/useStore';

export async function exportToApkg(deck: Deck, cards: Flashcard[]) {
  // Try resolving commonJS / ESM export structure
  const DeckConstructor = (AnkiExport as any).Deck || AnkiExport.default || AnkiExport;
  const ankiDeck = new DeckConstructor(deck.name);
  
  cards.forEach(card => {
    ankiDeck.addCard(card.front, card.back, { tags: card.tags || [] });
  });
  
  const zipBuffer = await ankiDeck.save();
  const blob = new Blob([zipBuffer], { type: 'application/zip' });
  saveAs(blob, `${deck.name}.apkg`);
}

export async function importFromApkg(file: File): Promise<{ decksMap: Record<string, any>, parsedCards: { front: string, back: string, tags: string[], originalDeckId: string }[], fileName: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  console.log("Zip files:", Object.keys(zip.files));
  
  let mediaMap: Record<string, string> = {};
  const mediaFile = zip.file('media');
  if (mediaFile) {
    try {
      const mediaContent = await mediaFile.async('string');
      mediaMap = JSON.parse(mediaContent);
    } catch (err) {
      console.warn("Failed to parse media map", err);
    }
  }

  const mediaUrls: Record<string, string> = {};
  for (const [key, filename] of Object.entries(mediaMap)) {
    const file = zip.file(key);
    if (file) {
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      let mimeType = 'image/png';
      if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'svg') mimeType = 'image/svg+xml';
      else if (ext === 'gif') mimeType = 'image/gif';
      else if (ext === 'mp3') mimeType = 'audio/mpeg';

      const base64 = await file.async('base64');
      mediaUrls[filename] = `data:${mimeType};base64,${base64}`;
    }
  }

  function replaceMedia(text: string): string {
    let replaced = text.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (match, src) => {
      let url = mediaUrls[src];
      if (!url) {
        try {
          const decoded = decodeURIComponent(src);
          url = mediaUrls[decoded];
        } catch(e) {}
      }
      if (url) {
        return match.replace(src, url);
      }
      return match;
    });

    replaced = replaced.replace(/\[sound:(.*?)\]/gi, (match, src) => {
      let url = mediaUrls[src];
      if (!url) {
        try {
          const decoded = decodeURIComponent(src);
          url = mediaUrls[decoded];
        } catch(e) {}
      }
      if (url) {
        return `<audio controls src="${url}"></audio>`;
      }
      return match;
    });

    return replaced;
  }
  
  let dbBuffer: Uint8Array | null = null;
  const dbFile21b = zip.file('collection.anki21b');
  if (dbFile21b) {
    const compressed = await dbFile21b.async('uint8array');
    try {
      dbBuffer = decompress(compressed);
    } catch (err) {
      console.warn("Failed to decompress collection.anki21b", err);
    }
  }

  if (!dbBuffer) {
    const dbFile = zip.file('collection.anki21') || zip.file('collection.anki2');
    if (!dbFile) {
      throw new Error('Arquivo Anki inválido: banco de dados não encontrado.');
    }
    dbBuffer = await dbFile.async('uint8array');
  }
  
  const SQL = await initSqlJs({
    locateFile: () => `https://unpkg.com/sql.js@1.14.1/dist/sql-wasm.wasm`
  });
  
  const db = new SQL.Database(dbBuffer);
  
  // Extract decks from `col` table
  const colResult = db.exec("SELECT decks FROM col");
  let decksMap: Record<string, any> = {};
  if (colResult.length > 0 && colResult[0].values && colResult[0].values[0]) {
    try {
      decksMap = JSON.parse(colResult[0].values[0][0] as string);
    } catch(e) {
      console.warn("Failed to parse decks from col", e);
    }
  }

  // Cards query with their deck ID
  const result = db.exec("SELECT n.flds, n.tags, c.did FROM notes n JOIN cards c ON n.id = c.nid");
  
  const parsedCards: { front: string, back: string, tags: string[], originalDeckId: string }[] = [];
  
  if (result.length > 0 && result[0].values) {
    for (const row of result[0].values) {
      if (!row || row.length < 3) continue;
      const flds = row[0] as string;
      const tagsString = row[1] as string;
      const did = row[2] as string; // deck id
      
      const fields = flds ? flds.split('\x1F') : [];
      let front = replaceMedia(fields[0] || '');
      let back = replaceMedia(fields[1] || '');
      
      let tags: string[] = [];
      if (tagsString && tagsString.trim()) {
        tags = tagsString.split(' ').map(s => s.trim()).filter(Boolean);
      }
      
      parsedCards.push({ front, back, tags, originalDeckId: String(did) });
    }
  }
  db.close();

  return { decksMap, parsedCards, fileName: file.name.replace(/\.apkg$/i, '') };
}
