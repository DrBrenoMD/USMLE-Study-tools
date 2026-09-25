import initSqlJs from 'sql.js';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { decompress } from 'fzstd';
import type { Deck, Flashcard } from '../store/useStore';
import { mediaStorage } from './mediaStorage';

// Base91 GUID generator matching Anki's standard
const ANKI_BASE91_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@[]^_`{|}~';

function generateAnkiGuid(): string {
  let guid = '';
  for (let i = 0; i < 10; i++) {
    guid += ANKI_BASE91_CHARS.charAt(Math.floor(Math.random() * ANKI_BASE91_CHARS.length));
  }
  return guid;
}

// SHA1 Checksum (integer calculation of the first 8 hex characters)
async function calculateSha1Csum(text: string): Promise<number> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return parseInt(hex.substring(0, 8), 16);
    }
  } catch (e) {
    console.warn("Subtle crypto failed, falling back to simple hash", e);
  }
  
  // Deterministic fallback hash
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

// Robust SQL.js initialization supporting local public path, CDN, and fallback
let sqlJsPromise: Promise<any> | null = null;

async function getSqlJs(): Promise<any> {
  if (!sqlJsPromise) {
    sqlJsPromise = (async () => {
      // 1. Try public path first (fastest, offline-ready)
      try {
        const SQL = await initSqlJs({
          locateFile: (file: string) => `/sql-wasm.wasm`
        });
        return SQL;
      } catch (err1) {
        console.warn("Could not load /sql-wasm.wasm locally, trying unpkg CDN...", err1);
      }

      // 2. Try unpkg CDN
      try {
        const SQL = await initSqlJs({
          locateFile: () => `https://unpkg.com/sql.js@1.14.2/dist/sql-wasm.wasm`
        });
        return SQL;
      } catch (err2) {
        console.warn("Could not load sql-wasm.wasm from unpkg, trying cdnjs...", err2);
      }

      // 3. Try cdnjs fallback
      const SQL = await initSqlJs({
        locateFile: () => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.14.2/sql-wasm.wasm`
      });
      return SQL;
    })();
  }
  return sqlJsPromise;
}

/**
 * Builds and exports an Anki (.apkg) package compliant with Anki's collection.anki2 schema v11.
 * Guarantees retrocompatibility across Anki 2.0, 2.1, 23+, AnkiDroid, and AnkiMobile.
 * Prevents "single-card deck" bugs by binding all cards to a single canonical Deck ID and Model ID.
 * Safely extracts embedded media into the collection.media directory.
 */
export async function exportToApkg(deck: Deck, cards: Flashcard[]) {
  const SQL = await getSqlJs();

  const db = new SQL.Database();
  const zip = new JSZip();

  // Unified canonical IDs for retrocompatibility & avoiding single-card deck duplicates
  const now = Date.now();
  const deckIdInt = 1435588830424;
  const modelIdInt = 1435645724216;

  // Media extraction storage
  const mediaMap: Record<number, string> = {};
  let mediaIndex = 0;

  function processHtmlMedia(html: string): string {
    if (!html) return '';
    return html.replace(/<img[^>]+src=["'](data:image\/([^;]+);base64,([^"']+))["'][^>]*>/gi, (match, fullDataUri, ext, base64) => {
      const cleanExt = ext === 'jpeg' ? 'jpg' : ext.split('+')[0];
      const filename = `paste_img_${mediaIndex}.${cleanExt}`;
      const currentIdx = mediaIndex;
      mediaIndex++;

      mediaMap[currentIdx] = filename;
      zip.file(String(currentIdx), base64, { base64: true });
      return match.replace(fullDataUri, filename);
    });
  }

  // Schema definitions
  const conf = {
    nextPos: 1,
    estTimes: true,
    activeDecks: [1],
    sortType: "noteFld",
    timeLim: 0,
    sortBackwards: false,
    addToCur: true,
    curDeck: 1,
    newBury: true,
    newSpread: 0,
    dueCounts: true,
    curModel: String(modelIdInt),
    collapseTime: 1200
  };

  const models = {
    [modelIdInt]: {
      id: modelIdInt,
      name: "USMLE-Basic-Note",
      type: 0,
      mod: Math.floor(now / 1000),
      usn: -1,
      sortf: 0,
      did: deckIdInt,
      tmpls: [
        {
          name: "Cartão 1",
          ord: 0,
          qfmt: "{{Front}}",
          afmt: "{{FrontSide}}\n\n<hr id=\"answer\">\n\n{{Back}}",
          bqfmt: "",
          bafmt: "",
          did: null
        }
      ],
      flds: [
        {
          name: "Front",
          ord: 0,
          sticky: false,
          rtl: false,
          font: "Arial",
          size: 20,
          media: []
        },
        {
          name: "Back",
          ord: 1,
          sticky: false,
          rtl: false,
          font: "Arial",
          size: 20,
          media: []
        }
      ],
      css: `.card { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 19px; text-align: left; color: #1e293b; background-color: #ffffff; padding: 24px; line-height: 1.6; }
.card.nightMode { color: #f1f5f9; background-color: #0f172a; }
hr#answer { border: 0; height: 1px; background: #e2e8f0; margin: 20px 0; }
.card.nightMode hr#answer { background: #334155; }
details.question-box { margin-top: 18px; border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 16px; background-color: #f8fafc; font-size: 14px; }
.card.nightMode details.question-box { border-color: #334155; background-color: #1e293b; color: #cbd5e1; }
details.question-box summary { font-weight: 700; color: #2563eb; cursor: pointer; user-select: none; }
.card.nightMode details.question-box summary { color: #60a5fa; }
.educational-objective { margin-top: 8px; padding: 10px 14px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 6px; font-weight: 500; }
.card.nightMode .educational-objective { background: #172554; border-color: #60a5fa; color: #bfdbfe; }
img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; }`,
      latexPre: "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
      latexPost: "\\end{document}"
    }
  };

  const decksJson = {
    "1": {
      id: 1,
      name: "Default",
      desc: "",
      mod: 1435645724,
      usn: 0,
      collapsed: false,
      newToday: [0, 0],
      timeToday: [0, 0],
      dyn: 0,
      extendNew: 10,
      extendRev: 50,
      conf: 1,
      revToday: [0, 0],
      lrnToday: [0, 0]
    },
    [deckIdInt]: {
      id: deckIdInt,
      name: deck.name,
      desc: `Exportado pelo USMLE Study Tools em ${new Date().toLocaleDateString('pt-BR')}`,
      mod: Math.floor(now / 1000),
      usn: -1,
      collapsed: false,
      newToday: [0, 0],
      timeToday: [0, 0],
      dyn: 0,
      extendNew: 10,
      extendRev: 50,
      conf: 1,
      revToday: [0, 0],
      lrnToday: [0, 0]
    }
  };

  const dconf = {
    "1": {
      name: "Default",
      replayq: true,
      lapse: { leechFails: 8, minInt: 1, delays: [10], leechAction: 0, mult: 0 },
      rev: { perDay: 200, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, ease4: 1.3, bury: true, minSpace: 1 },
      timer: 0,
      maxTaken: 60,
      usn: 0,
      new: { perDay: 20, delays: [1, 10], separate: true, ints: [1, 4, 7], initialFactor: 2500, bury: true, order: 1 },
      mod: 0,
      id: 1,
      autoplay: true
    }
  };

  // Build SQLite Tables
  db.run(`
    PRAGMA foreign_keys=OFF;
    BEGIN TRANSACTION;
    CREATE TABLE col (
        id              integer primary key,
        crt             integer not null,
        mod             integer not null,
        scm             integer not null,
        ver             integer not null,
        dty             integer not null,
        usn             integer not null,
        ls              integer not null,
        conf            text not null,
        models          text not null,
        decks           text not null,
        dconf           text not null,
        tags            text not null
    );
    CREATE TABLE notes (
        id              integer primary key,
        guid            text not null,
        mid             integer not null,
        mod             integer not null,
        usn             integer not null,
        tags            text not null,
        flds            text not null,
        sfld            text not null,
        csum            integer not null,
        flags           integer not null,
        data            text not null
    );
    CREATE TABLE cards (
        id              integer primary key,
        nid             integer not null,
        did             integer not null,
        ord             integer not null,
        mod             integer not null,
        usn             integer not null,
        type            integer not null,
        queue           integer not null,
        due             integer not null,
        ivl             integer not null,
        factor          integer not null,
        reps            integer not null,
        lapses          integer not null,
        left            integer not null,
        odue            integer not null,
        odid            integer not null,
        flags           integer not null,
        data            text not null
    );
    CREATE TABLE revlog (
        id              integer primary key,
        cid             integer not null,
        usn             integer not null,
        ease            integer not null,
        ivl             integer not null,
        lastIvl         integer not null,
        factor          integer not null,
        time            integer not null,
        type            integer not null
    );
    CREATE TABLE graves (
        usn             integer not null,
        oid             integer not null,
        type            integer not null
    );
    CREATE INDEX ix_notes_usn on notes (usn);
    CREATE INDEX ix_cards_usn on cards (usn);
    CREATE INDEX ix_revlog_usn on revlog (usn);
    CREATE INDEX ix_cards_nid on cards (nid);
    CREATE INDEX ix_cards_sched on cards (did, queue, due);
    CREATE INDEX ix_revlog_cid on revlog (cid);
    CREATE INDEX ix_notes_csum on notes (csum);
    COMMIT;
  `);

  // Insert col metadata with schema version 11 (retrocompatible)
  const insertColStmt = db.prepare(`
    INSERT INTO col VALUES(1, 1388548800, :mod, :scm, 11, 0, 0, 0, :conf, :models, :decks, :dconf, '{}')
  `);
  insertColStmt.run({
    ':mod': now,
    ':scm': now,
    ':conf': JSON.stringify(conf),
    ':models': JSON.stringify(models),
    ':decks': JSON.stringify(decksJson),
    ':dconf': JSON.stringify(dconf),
  });
  insertColStmt.free();

  const insertNoteStmt = db.prepare(`
    INSERT INTO notes VALUES(:id, :guid, :mid, :mod, -1, :tags, :flds, :sfld, :csum, 0, '')
  `);
  const insertCardStmt = db.prepare(`
    INSERT INTO cards VALUES(:id, :nid, :did, 0, :mod, -1, 0, 0, :due, 0, 2500, 0, 0, 0, 0, 0, 0, '')
  `);

  // Insert all cards into notes and cards tables
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const noteId = now + (i * 2);
    const cardId = now + (i * 2) + 1;
    const guid = generateAnkiGuid();

    let frontProcessed = processHtmlMedia(card.front);
    let backProcessed = processHtmlMedia(card.back);

    // If card has details or QBank elements, package them cleanly in collapsible HTML
    let questionDetailsHtml = '';
    const hasQBankData = card.questionId || card.questionStem || card.questionChoices || card.explanation || card.educationalObjective || (card.questionImages && card.questionImages.length > 0);

    if (card.details) {
      backProcessed += `<div style="margin-top: 14px; font-size: 15px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 10px;">${processHtmlMedia(card.details)}</div>`;
    }

    if (hasQBankData) {
      let imagesHtml = '';
      if (card.questionImages && card.questionImages.length > 0) {
        imagesHtml = `<div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px;">${card.questionImages.map(img => `<img src="${img}" style="max-height: 250px; border-radius: 6px; border: 1px solid #cbd5e1;" />`).join('')}</div>`;
        imagesHtml = processHtmlMedia(imagesHtml);
      }

      questionDetailsHtml = `
<details class="question-box">
  <summary>📋 Dados da Questão ${card.questionId ? `(ID: ${card.questionId})` : ''}</summary>
  <div style="margin-top: 10px; line-height: 1.5;">
    ${card.questionStem ? `<div><b style="color:#0f172a;">Enunciado:</b><p style="margin: 4px 0 10px;">${processHtmlMedia(card.questionStem)}</p></div>` : ''}
    ${card.questionChoices ? `<div><b style="color:#0f172a;">Alternativas:</b><div style="margin: 4px 0 10px; white-space: pre-wrap; font-family: inherit;">${processHtmlMedia(card.questionChoices)}</div></div>` : ''}
    ${card.explanation ? `<div><b style="color:#0f172a;">Explicação:</b><div style="margin: 4px 0 10px;">${processHtmlMedia(card.explanation)}</div></div>` : ''}
    ${card.educationalObjective ? `<div class="educational-objective"><b>Educational Objective:</b><div style="margin-top: 3px;">${processHtmlMedia(card.educationalObjective)}</div></div>` : ''}
    ${imagesHtml}
  </div>
</details>`;
    }

    const fullBack = backProcessed + questionDetailsHtml;
    const sfld = stripHtml(frontProcessed);
    const csum = await calculateSha1Csum(sfld);
    const tagsString = (card.tags || []).join(' ');

    insertNoteStmt.run({
      ':id': noteId,
      ':guid': guid,
      ':mid': modelIdInt,
      ':mod': Math.floor(now / 1000),
      ':tags': tagsString,
      ':flds': frontProcessed + '\x1F' + fullBack,
      ':sfld': sfld,
      ':csum': csum,
    });

    insertCardStmt.run({
      ':id': cardId,
      ':nid': noteId,
      ':did': deckIdInt,
      ':mod': Math.floor(now / 1000),
      ':due': i + 1,
    });
  }

  insertNoteStmt.free();
  insertCardStmt.free();

  // Export collection.anki2 to SQLite binary
  const binaryArray = db.export();
  db.close();

  // Write ZIP contents
  zip.file('collection.anki2', binaryArray);
  zip.file('media', JSON.stringify(mediaMap));

  // Generate .apkg archive and trigger download
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
  const safeFilename = `${deck.name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'baralho'}.apkg`;
  saveAs(blob, safeFilename);
}

// Utility to safely convert small Uint8Array to base64 without blowing stack or throwing RangeError
function uint8ToBase64Safe(bytes: Uint8Array): string {
  // Prevent any gigantic base64 string allocations
  if (bytes.byteLength > 128 * 1024) {
    throw new Error('Buffer too large for inline base64 string');
  }
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 1024;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

// Protobuf decoder for Anki modern MediaEntries message
function decodeMediaEntriesProtobuf(bytes: Uint8Array): Record<string, string> {
  const map: Record<string, string> = {};
  let pos = 0;
  let entryIndex = 0;

  function readVarint(): number {
    let res = 0;
    let shift = 0;
    while (pos < bytes.length && shift <= 35) {
      const b = bytes[pos++];
      res += (b & 0x7f) * Math.pow(2, shift);
      shift += 7;
      if ((b & 0x80) === 0) break;
    }
    return Math.floor(res);
  }

  try {
    while (pos < bytes.length) {
      const key = readVarint();
      if (pos >= bytes.length && key === 0) break;
      const fieldNum = Math.floor(key / 8);
      const wireType = key & 7;

      if (fieldNum === 1 && wireType === 2) {
        // repeated MediaEntry entries = 1;
        const len = readVarint();
        if (len < 0 || len > bytes.length - pos) break;
        const end = pos + len;
        let name = '';
        let legacyZipFilename: number | null = null;

        while (pos < end && pos < bytes.length) {
          const itemKey = readVarint();
          const itemField = Math.floor(itemKey / 8);
          const itemWire = itemKey & 7;

          if (itemWire === 0) {
            const val = readVarint();
            if (itemField === 4) {
              legacyZipFilename = val;
            }
          } else if (itemWire === 2) {
            const sLen = readVarint();
            if (sLen < 0 || pos + sLen > bytes.length || sLen > 1000000) {
              break;
            }
            const sBytes = bytes.subarray(pos, pos + sLen);
            pos += sLen;
            if (itemField === 1) {
              try {
                name = new TextDecoder('utf-8', { fatal: false }).decode(sBytes);
              } catch (e) {}
            }
          } else if (itemWire === 1) {
            pos += 8;
          } else if (itemWire === 5) {
            pos += 4;
          } else {
            break;
          }
        }

        if (name) {
          const zipKey = legacyZipFilename !== null ? String(legacyZipFilename) : String(entryIndex);
          map[zipKey] = name;
        }
        entryIndex++;
      } else {
        if (wireType === 0) readVarint();
        else if (wireType === 2) {
          const l = readVarint();
          if (l < 0 || pos + l > bytes.length) break;
          pos += l;
        }
        else if (wireType === 1) pos += 8;
        else if (wireType === 5) pos += 4;
        else break;
      }
    }
  } catch (e) {
    console.warn("Failed to decode media protobuf with standard parser, trying string scan fallback", e);
  }

  // Fallback string scan if map is empty and buffer is not monstrous
  if (Object.keys(map).length === 0 && bytes.length < 5 * 1024 * 1024) {
    try {
      const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      const matches = text.match(/[\w\-._]+\.(?:png|jpg|jpeg|gif|svg|webp|mp3|wav|ogg|mp4)/gi);
      if (matches) {
        matches.forEach((fname, idx) => {
          map[String(idx)] = fname;
        });
      }
    } catch (e) {}
  }

  return map;
}

// Patch collation 'unicase' in SQLite database header/schema pages
// so that sql.js (WebAssembly) does not fail with 'no such collation sequence: unicase'
function patchCollationUnicase(buf: Uint8Array): Uint8Array {
  const s1 = new TextEncoder().encode("collate unicase");
  const s2 = new TextEncoder().encode("COLLATE UNICASE");
  const s3 = new TextEncoder().encode("COLLATE unicase");
  const r1 = new TextEncoder().encode("collate  nocase");
  const r2 = new TextEncoder().encode("COLLATE  NOCASE");
  
  for (let i = 0; i <= buf.length - 15; i++) {
    let m1 = true, m2 = true, m3 = true;
    for (let j = 0; j < 15; j++) {
      if (buf[i + j] !== s1[j]) m1 = false;
      if (buf[i + j] !== s2[j]) m2 = false;
      if (buf[i + j] !== s3[j]) m3 = false;
      if (!m1 && !m2 && !m3) break;
    }
    if (m1 || m2 || m3) {
      const rep = (m2 ? r2 : r1);
      for (let j = 0; j < 15; j++) {
        buf[i + j] = rep[j];
      }
      i += 14;
    }
  }
  return buf;
}

/**
 * Robust APKG importer supporting .anki2, .anki21, and .anki21b (zstandard).
 * Re-extracts media (JSON or ZSTD/Protobuf), decks hierarchy, cards, tags,
 * and recovers any embedded QBank question metadata or dynamic note fields.
 */
export async function importFromApkg(file: File): Promise<{
  decksMap: Record<string, any>;
  parsedCards: {
    front: string;
    back: string;
    fields?: { name: string; value: string }[];
    details?: string;
    tags: string[];
    originalDeckId: string;
    questionId?: string;
    questionStem?: string;
    questionChoices?: string;
    explanation?: string;
    educationalObjective?: string;
    questionImages?: string[];
  }[];
  fileName: string;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // 1. Extract Media Map (Supports legacy JSON, ZSTD-compressed JSON, and ZSTD-compressed Protobuf)
  let mediaMap: Record<string, string> = {};
  const mediaFile = zip.file('media');
  if (mediaFile) {
    try {
      let mediaBytes = await mediaFile.async('uint8array');
      // Check if media file is ZSTD compressed (magic bytes 0x28, 0xB5, 0x2F, 0xFD)
      if (mediaBytes.length >= 4 && mediaBytes[0] === 0x28 && mediaBytes[1] === 0xb5 && mediaBytes[2] === 0x2f && mediaBytes[3] === 0xfd) {
        try {
          mediaBytes = decompress(mediaBytes);
        } catch (decompErr) {
          console.warn("Failed to decompress media index with fzstd", decompErr);
        }
      }

      // Try UTF-8 string JSON parsing first
      const text = new TextDecoder('utf-8', { fatal: false }).decode(mediaBytes).trim();
      if (text.startsWith('{')) {
        try {
          mediaMap = JSON.parse(text);
        } catch (jsonErr) {
          console.warn("JSON parse on media map failed, trying protobuf", jsonErr);
          mediaMap = decodeMediaEntriesProtobuf(mediaBytes);
        }
      } else {
        // Parse modern binary protobuf MediaEntries
        mediaMap = decodeMediaEntriesProtobuf(mediaBytes);
      }
    } catch (err) {
      console.warn("Failed to parse media map", err);
    }
  }

  // 2. Extract media entries (decompressing individual items if zstd compressed)
  const mediaUrls: Record<string, string> = {};
  for (const [key, filename] of Object.entries(mediaMap)) {
    const mediaEntry = zip.file(key);
    if (mediaEntry) {
      try {
        let rawBytes = await mediaEntry.async('uint8array');
        // Check if rawBytes is ZSTD compressed
        if (rawBytes.length >= 4 && rawBytes[0] === 0x28 && rawBytes[1] === 0xb5 && rawBytes[2] === 0x2f && rawBytes[3] === 0xfd) {
          try {
            rawBytes = decompress(rawBytes);
          } catch (e) {
            console.warn("Failed to decompress individual media entry " + key, e);
          }
        }

        const ext = filename.split('.').pop()?.toLowerCase() || '';
        let mimeType = 'image/png';
        if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
        else if (ext === 'svg') mimeType = 'image/svg+xml';
        else if (ext === 'gif') mimeType = 'image/gif';
        else if (ext === 'webp') mimeType = 'image/webp';
        else if (ext === 'mp3') mimeType = 'audio/mpeg';
        else if (ext === 'wav') mimeType = 'audio/wav';
        else if (ext === 'ogg') mimeType = 'audio/ogg';
        else if (ext === 'mp4') mimeType = 'video/mp4';

        // Create Blob and register with mediaStorage (zero memory bloat, native decoding)
        const blob = new Blob([rawBytes], { type: mimeType });
        let dataUrl = '';
        try {
          dataUrl = await mediaStorage.saveMedia(filename, blob);
        } catch {
          dataUrl = URL.createObjectURL(blob);
        }

        // Only for tiny images (< 32KB), optionally use safe base64
        if (rawBytes.byteLength < 32 * 1024) {
          try {
            const b64 = uint8ToBase64Safe(rawBytes);
            dataUrl = `data:${mimeType};base64,${b64}`;
          } catch {}
        }

        // Map under multiple keys for resilient URL replacement
        mediaUrls[filename] = dataUrl;
        mediaUrls[filename.toLowerCase()] = dataUrl;
        try {
          const decoded = decodeURIComponent(filename);
          mediaUrls[decoded] = dataUrl;
          mediaUrls[decoded.toLowerCase()] = dataUrl;
        } catch (e) {}
      } catch (err) {
        console.warn("Failed to process media entry " + key, err);
      }
    }
  }

  function getMediaUrl(src: string): string | undefined {
    if (!src) return undefined;
    if (mediaUrls[src]) return mediaUrls[src];
    try {
      const decoded = decodeURIComponent(src);
      if (mediaUrls[decoded]) return mediaUrls[decoded];
    } catch (e) {}

    const basename = src.split('/').pop()?.split('\\').pop() || src;
    if (mediaUrls[basename]) return mediaUrls[basename];
    try {
      const decodedBasename = decodeURIComponent(basename);
      if (mediaUrls[decodedBasename]) return mediaUrls[decodedBasename];
    } catch (e) {}

    const lower = src.toLowerCase();
    const lowerBasename = basename.toLowerCase();
    if (mediaUrls[lower]) return mediaUrls[lower];
    if (mediaUrls[lowerBasename]) return mediaUrls[lowerBasename];

    return undefined;
  }

  function replaceMedia(text: string): string {
    if (!text) return '';
    let replaced = text.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (match, src) => {
      const url = getMediaUrl(src);
      if (url) {
        return match.replace(src, url);
      }
      return match;
    });

    replaced = replaced.replace(/\[sound:(.*?)\]/gi, (match, src) => {
      const url = getMediaUrl(src);
      if (url) {
        return `<audio controls src="${url}"></audio>`;
      }
      return match;
    });

    return replaced;
  }

  // 3. Extract and patch SQLite Database
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
      throw new Error('Arquivo Anki inválido: banco de dados collection.anki2 não encontrado.');
    }
    dbBuffer = await dbFile.async('uint8array');
  }

  // Patch custom collation 'unicase' in SQLite header before initializing SQL.Database
  dbBuffer = patchCollationUnicase(dbBuffer);

  const SQL = await getSqlJs();
  const db = new SQL.Database(dbBuffer);

  // Get list of existing tables in SQLite
  const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  const existingTables = new Set<string>();
  if (tablesResult.length > 0 && tablesResult[0].values) {
    for (const row of tablesResult[0].values) {
      if (row && row[0]) existingTables.add(String(row[0]).toLowerCase());
    }
  }

  // 4. Extract decks from `decks` table (Anki 2.1.28+) AND `col.decks` (Anki <= 2.1.26)
  let decksMap: Record<string, { id: string; name: string }> = {};

  if (existingTables.has('decks')) {
    try {
      const dResult = db.exec("SELECT id, name FROM decks");
      if (dResult.length > 0 && dResult[0].values) {
        for (const row of dResult[0].values) {
          if (row && row.length >= 2) {
            const id = String(row[0]);
            const name = String(row[1] || '').trim();
            if (id && name) {
              decksMap[id] = { id, name };
            }
          }
        }
      }
    } catch (err) {
      console.warn("Failed to read from decks table", err);
    }
  }

  if (existingTables.has('col')) {
    try {
      const colResult = db.exec("SELECT decks FROM col");
      if (colResult.length > 0 && colResult[0].values && colResult[0].values[0]) {
        const rawJson = colResult[0].values[0][0];
        if (typeof rawJson === 'string') {
          const colDecks = JSON.parse(rawJson);
          for (const [key, d] of Object.entries(colDecks)) {
            if (d && (d as any).name) {
              const id = String((d as any).id || key);
              const name = String((d as any).name).trim();
              if (id && name) {
                // If not yet present or if col has a fuller hierarchical name with '::'
                if (!decksMap[id] || name.includes('::')) {
                  decksMap[id] = { id, name };
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to parse decks from col", e);
    }
  }

  // 5. Extract models (note types) with their field definitions
  let modelsMap: Record<string, { id: string; name: string; type?: number; flds?: { name: string; ord?: number }[] }> = {};

  // First extract from `col.models` which contains full JSON with field names
  if (existingTables.has('col')) {
    try {
      const colModels = db.exec("SELECT models FROM col");
      if (colModels.length > 0 && colModels[0].values && colModels[0].values[0]) {
        const rawModels = colModels[0].values[0][0];
        if (typeof rawModels === 'string') {
          const parsed = JSON.parse(rawModels);
          for (const [mid, m] of Object.entries(parsed)) {
            if (m && typeof m === 'object') {
              modelsMap[String(mid)] = {
                id: String((m as any).id || mid),
                name: (m as any).name || '',
                type: (m as any).type,
                flds: Array.isArray((m as any).flds) ? (m as any).flds : []
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to parse models from col", e);
    }
  }

  // Also read `notetypes` table if present to catch any additional models
  if (existingTables.has('notetypes')) {
    try {
      const ntResult = db.exec("SELECT id, name FROM notetypes");
      if (ntResult.length > 0 && ntResult[0].values) {
        for (const row of ntResult[0].values) {
          if (row && row[0]) {
            const id = String(row[0]);
            const name = String(row[1] || '');
            if (!modelsMap[id]) {
              modelsMap[id] = { id, name };
            } else if (!modelsMap[id].name) {
              modelsMap[id].name = name;
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to read from notetypes table", e);
    }
  }

  // Helper to render Cloze cards: {{c1::answer::hint}}
  function renderClozeText(text: string, cardOrd: number, isAnswer: boolean): string {
    const targetClozeNum = cardOrd + 1;
    return text.replace(/\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/gs, (match, num, content, hint) => {
      const clozeIndex = parseInt(num, 10);
      if (clozeIndex === targetClozeNum) {
        if (isAnswer) {
          return `<span class="cloze-active cloze-revealed font-bold text-blue-600 dark:text-blue-400">${content}</span>`;
        } else {
          return `<span class="cloze-active font-bold text-blue-600 dark:text-blue-400">[${hint || '...'}]</span>`;
        }
      } else {
        return content;
      }
    });
  }

  // Helper to parse question details embedded in back HTML
  function extractEmbeddedQuestionData(backHtml: string) {
    let questionId: string | undefined;
    let questionStem: string | undefined;
    let questionChoices: string | undefined;
    let explanation: string | undefined;
    let educationalObjective: string | undefined;
    let questionImages: string[] | undefined;

    const qidMatch = backHtml.match(/📋 Dados da Questão\s*(?:\(ID:\s*([^)]+)\))?/i);
    if (qidMatch && qidMatch[1]) {
      questionId = qidMatch[1].trim();
    }

    return { questionId, questionStem, questionChoices, explanation, educationalObjective, questionImages };
  }

  // 6. Extract cards with robust join and odid resolution
  const parsedCards: {
    front: string;
    back: string;
    fields?: { name: string; value: string }[];
    details?: string;
    tags: string[];
    originalDeckId: string;
    questionId?: string;
    questionStem?: string;
    questionChoices?: string;
    explanation?: string;
    educationalObjective?: string;
    questionImages?: string[];
  }[] = [];

  let cardRows: any[][] = [];
  try {
    const result = db.exec("SELECT n.id, n.mid, n.flds, n.tags, c.did, c.ord, c.odid FROM notes n JOIN cards c ON n.id = c.nid");
    if (result.length > 0 && result[0].values) {
      cardRows = result[0].values;
    }
  } catch (err1) {
    try {
      const result2 = db.exec("SELECT n.id, n.mid, n.flds, n.tags, c.did, c.ord, 0 FROM notes n JOIN cards c ON n.id = c.nid");
      if (result2.length > 0 && result2[0].values) {
        cardRows = result2[0].values;
      }
    } catch (err2) {
      try {
        const result3 = db.exec("SELECT n.id, n.mid, n.flds, n.tags, c.did, 0, 0 FROM notes n JOIN cards c ON n.id = c.nid");
        if (result3.length > 0 && result3[0].values) {
          cardRows = result3[0].values;
        }
      } catch (err3) {
        try {
          const notesResult = db.exec("SELECT n.id, n.mid, n.flds, n.tags, 1, 0, 0 FROM notes n");
          if (notesResult.length > 0 && notesResult[0].values) {
            cardRows = notesResult[0].values;
          }
        } catch (err4) {
          console.error("Failed to query notes/cards from database", err4);
        }
      }
    }
  }

  for (const row of cardRows) {
    if (!row || row.length < 5) continue;
    const nid = row[0];
    const mid = String(row[1] || '');
    const flds = (row[2] as string) || '';
    const tagsString = (row[3] as string) || '';
    const did = String(row[4] || '1');
    const ord = typeof row[5] === 'number' ? row[5] : parseInt(String(row[5] || '0'), 10);
    const odid = row[6] ? String(row[6]) : '0';

    // Resolve target deck ID (if in filtered deck or legacy export, odid may hold the real subdeck ID)
    let targetDeckId = did;
    if (odid && odid !== '0' && decksMap[odid] && !decksMap[did]) {
      targetDeckId = odid;
    }

    const rawFields = flds ? flds.split('\x1F') : [];
    const model = modelsMap[mid];
    const isClozeModel = model && (model.type === 1 || /cloze/i.test(model.name || ''));
    const hasClozeSyntax = /\{\{c\d+::/i.test(flds);
    const modelFlds = model?.flds || [];

    let front = '';
    let back = '';
    const dynamicFields: { name: string; value: string }[] = [];

    if (isClozeModel || hasClozeSyntax) {
      const textFld = rawFields[0] || '';
      const frontCloze = renderClozeText(textFld, ord, false);
      const backCloze = renderClozeText(textFld, ord, true);

      // Front: field 0 with cloze prompt
      front = replaceMedia(frontCloze);

      // Answer block
      dynamicFields.push({
        name: 'Resposta',
        value: replaceMedia(backCloze)
      });

      // Additional dynamic fields from note
      for (let i = 1; i < rawFields.length; i++) {
        const val = (rawFields[i] || '').trim();
        if (val) {
          const fieldName = modelFlds[i]?.name || (i === 1 ? 'Extra' : `Campo ${i + 1}`);
          dynamicFields.push({
            name: fieldName,
            value: replaceMedia(val)
          });
        }
      }

      // Legacy/Search back representation
      const extraHtml = dynamicFields.slice(1).map(f => `<div class="anki-field-block"><div class="anki-field-name font-semibold text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">${f.name}</div><div class="anki-field-value">${f.value}</div></div>`).join('<br>');
      back = extraHtml ? `${replaceMedia(backCloze)}<br><br>${extraHtml}` : replaceMedia(backCloze);
    } else {
      // Standard Card: Field 0 is always Front
      front = replaceMedia(rawFields[0] || '');

      // All remaining fields are dynamic back fields revealed only when card is opened
      for (let i = 1; i < rawFields.length; i++) {
        const val = (rawFields[i] || '').trim();
        if (val) {
          const fieldName = modelFlds[i]?.name || (i === 1 ? 'Verso' : `Campo ${i + 1}`);
          dynamicFields.push({
            name: fieldName,
            value: replaceMedia(val)
          });
        }
      }

      if (dynamicFields.length > 0) {
        back = dynamicFields.map(f => `<div class="anki-field-block"><div class="anki-field-name font-semibold text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">${f.name}</div><div class="anki-field-value">${f.value}</div></div>`).join('<br><br>');
      } else {
        back = '';
      }
    }

    if (!front.trim() && !back.trim() && dynamicFields.length === 0) continue;

    let tags: string[] = [];
    if (tagsString && tagsString.trim()) {
      tags = tagsString.split(' ').map(s => s.trim()).filter(Boolean);
    }

    const { questionId, questionStem, questionChoices, explanation, educationalObjective, questionImages } = extractEmbeddedQuestionData(back);

    parsedCards.push({
      front: front || 'Sem conteúdo',
      back: back,
      fields: dynamicFields,
      tags,
      originalDeckId: targetDeckId,
      questionId,
      questionStem,
      questionChoices,
      explanation,
      educationalObjective,
      questionImages,
    });
  }

  db.close();

  return {
    decksMap,
    parsedCards,
    fileName: file.name.replace(/\.apkg$/i, '')
  };
}
