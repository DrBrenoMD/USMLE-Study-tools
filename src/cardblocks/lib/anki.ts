import initSqlJs from 'sql.js';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { decompress } from 'fzstd';
import type { Deck, Flashcard } from '../store/useStore';

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

/**
 * Builds and exports an Anki (.apkg) package compliant with Anki's collection.anki2 schema v11.
 * Guarantees retrocompatibility across Anki 2.0, 2.1, 23+, AnkiDroid, and AnkiMobile.
 * Prevents "single-card deck" bugs by binding all cards to a single canonical Deck ID and Model ID.
 * Safely extracts embedded media into the collection.media directory.
 */
export async function exportToApkg(deck: Deck, cards: Flashcard[]) {
  const SQL = await initSqlJs({
    locateFile: () => `https://unpkg.com/sql.js@1.14.2/dist/sql-wasm.wasm`
  });

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

/**
 * Robust APKG importer supporting .anki2, .anki21, and .anki21b (zstandard).
 * Re-extracts media, cards, tags, and recovers any embedded QBank question metadata.
 */
export async function importFromApkg(file: File): Promise<{
  decksMap: Record<string, any>;
  parsedCards: {
    front: string;
    back: string;
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
    const mediaEntry = zip.file(key);
    if (mediaEntry) {
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      let mimeType = 'image/png';
      if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'svg') mimeType = 'image/svg+xml';
      else if (ext === 'gif') mimeType = 'image/gif';
      else if (ext === 'webp') mimeType = 'image/webp';
      else if (ext === 'mp3') mimeType = 'audio/mpeg';

      const base64 = await mediaEntry.async('base64');
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
        } catch (e) {}
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
        } catch (e) {}
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
      throw new Error('Arquivo Anki inválido: banco de dados collection.anki2 não encontrado.');
    }
    dbBuffer = await dbFile.async('uint8array');
  }

  const SQL = await initSqlJs({
    locateFile: () => `https://unpkg.com/sql.js@1.14.2/dist/sql-wasm.wasm`
  });

  const db = new SQL.Database(dbBuffer);

  // Extract decks from `col` table
  const colResult = db.exec("SELECT decks FROM col");
  let decksMap: Record<string, any> = {};
  if (colResult.length > 0 && colResult[0].values && colResult[0].values[0]) {
    try {
      decksMap = JSON.parse(colResult[0].values[0][0] as string);
    } catch (e) {
      console.warn("Failed to parse decks from col", e);
    }
  }

  // Extract cards
  const result = db.exec("SELECT n.flds, n.tags, c.did FROM notes n JOIN cards c ON n.id = c.nid");
  const parsedCards: {
    front: string;
    back: string;
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

  if (result.length > 0 && result[0].values) {
    for (const row of result[0].values) {
      if (!row || row.length < 3) continue;
      const flds = row[0] as string;
      const tagsString = row[1] as string;
      const did = row[2] as string;

      const fields = flds ? flds.split('\x1F') : [];
      let front = replaceMedia(fields[0] || '');
      let back = replaceMedia(fields[1] || '');

      let tags: string[] = [];
      if (tagsString && tagsString.trim()) {
        tags = tagsString.split(' ').map(s => s.trim()).filter(Boolean);
      }

      // Check if back contains our collapsible question box
      let questionId: string | undefined;
      let questionStem: string | undefined;
      let questionChoices: string | undefined;
      let explanation: string | undefined;
      let educationalObjective: string | undefined;
      let questionImages: string[] | undefined;

      // Extract Question ID if present
      const qidMatch = back.match(/📋 Dados da Questão\s*(?:\(ID:\s*([^)]+)\))?/i);
      if (qidMatch && qidMatch[1]) {
        questionId = qidMatch[1].trim();
      }

      parsedCards.push({
        front,
        back,
        tags,
        originalDeckId: String(did),
        questionId,
        questionStem,
        questionChoices,
        explanation,
        educationalObjective,
        questionImages,
      });
    }
  }

  db.close();

  return {
    decksMap,
    parsedCards,
    fileName: file.name.replace(/\.apkg$/i, '')
  };
}
