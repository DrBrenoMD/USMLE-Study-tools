import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { temporal } from 'zundo';
import localforage from 'localforage';

export const cardblocksDataStore = localforage.createInstance({
  name: 'cardblocks_data'
});

export interface Deck {
  id: string;
  name: string;
  parentId?: string | null;
  icon?: string;
  color?: string;
  order?: number;
  settings?: any;
  createdAt?: number;
}

export interface FlashcardField {
  name: string;
  value: string;
}

export interface Flashcard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  details?: string;
  tags?: string[];
  flag?: string;
  fields?: FlashcardField[];
  repetition: number;
  interval: number;
  easeFactor: number;
  nextReviewDate: number;
  createdAt: number;
  isSuspended?: boolean;
  isBuried?: boolean;
  sourceQuestionId?: string;

  // Campos de integração com QBanks (opcionais e nativamente colapsados)
  questionId?: string;
  questionStem?: string;
  questionChoices?: string;
  explanation?: string;
  educationalObjective?: string;
  questionImages?: string[];
  subject?: string;
  subjective?: string;
  system?: string;
}

export interface ReviewLog {
  id: string;
  cardId: string;
  deckId: string;
  rating: number;
  reviewDate: number;
  interval: number;
  easeFactor: number;
}

export interface QuestionAlternative {
  id: string;
  letter?: string;
  text: string;
  isCorrect?: boolean;
  explanation?: string;
}

export interface QuestionAttempt {
  timestamp: number;
  selectedChoiceId?: string;
  isCorrect: boolean;
  resolutionTimeSeconds: number;
  reviewTimeSeconds: number;
}

export interface Question {
  id: string;
  qid: string;
  bankId: string;
  text: string;
  stem?: string;
  subject?: string;
  system?: string;
  area?: string;
  subArea?: string;
  specialty?: string;
  topic?: string;
  subTopic?: string;
  tags?: string[];
  flag?: string;
  alternatives: QuestionAlternative[];
  explanation?: string;
  educationalObjective?: string;
  images?: string[];
  links?: string[];
  status?: 'unused' | 'correct' | 'incorrect';
  selectedChoiceId?: string;
  correctChoiceId?: string;
  resolutionTimeSeconds?: number;
  reviewTimeSeconds?: number;
  attempts?: QuestionAttempt[];
  lastAnsweredAt?: number;
  userNotes?: string;
  isFlagged?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
}

export interface Notebook {
  id: string;
  name: string;
  description?: string;
  questionIds: string[];
  createdAt: number;
  timeLimitPerQuestion?: number;
  mode?: 'exam' | 'tutor' | 'training';
}

export interface NotebookHistory {
  id: string;
  notebookId: string;
  completedAt: number;
  results: Record<string, boolean>;
  answers?: Record<string, string>;
  correct?: number;
  total?: number;
}

export interface Note {
  id: string;
  targetType: 'question' | 'card' | 'standalone';
  targetId: string;
  bankId?: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  theme: string;
  language: 'en' | 'pt';
  againMinutes: number;
  hardMultiplier: number;
  hardMinMinutes: number;
  goodMultiplier: number;
  easyMultiplier: number;
  newAgainMinutes: number;
  newHardMinutes: number;
  newGoodMinutes: number;
  newEasyMinutes: number;
  cardsPerBlock: number;
  cardOrder: 'newFirst' | 'reviewsFirst' | 'random';
  ttsVoiceURI: string;
  ttsRate: number;
  ttsPitch: number;
  shortcuts: Record<string, string>;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'ocean',
  language: 'pt',
  againMinutes: 1,
  hardMultiplier: 1.2,
  hardMinMinutes: 6,
  goodMultiplier: 2.5,
  easyMultiplier: 3.5,
  newAgainMinutes: 1,
  newHardMinutes: 6,
  newGoodMinutes: 10,
  newEasyMinutes: 5760,
  cardsPerBlock: 20,
  cardOrder: 'newFirst',
  ttsVoiceURI: '',
  ttsRate: 1,
  ttsPitch: 1,
  shortcuts: {
    showAnswer: ' ',
    again: '1',
    hard: '2',
    good: '3',
    easy: '4',
    playTTS: 'p',
    bury: 'b',
    suspend: 's',
    undo: 'z',
    redo: 'y'
  }
};

export interface StoreState {
  decks: Deck[];
  cards: Flashcard[];
  reviewHistory: ReviewLog[];
  reviewLog: ReviewLog[];
  questions: Question[];
  questionBanks: QuestionBank[];
  notebooks: Notebook[];
  notebookHistory: NotebookHistory[];
  notes: Note[];
  settings: Settings;

  // Deck Actions
  createDeck: (name: string, parentId?: string | null) => string;
  updateDeck: (id: string, updates: Partial<Deck>) => void;
  deleteDeck: (id: string) => void;
  moveDeck: (deckId: string, targetParentId: string | null) => void;
  updateDeckSettings: (deckId: string, settings: any) => void;
  exportDeckSet: (deckId: string) => string;
  importDeckSet: (json: string, targetParentId?: string) => void;

  // Card Actions
  createCard: (
    deckIdOrCard: string | (Omit<Flashcard, 'id' | 'createdAt' | 'repetition' | 'interval' | 'easeFactor' | 'nextReviewDate'> & Partial<Flashcard>),
    front?: string,
    back?: string,
    details?: string,
    tags?: string[],
    flag?: string,
    sourceQuestionId?: string
  ) => string;
  updateCard: (
    id: string,
    frontOrUpdates?: string | Partial<Flashcard>,
    back?: string,
    details?: string,
    tags?: string[],
    flag?: string
  ) => void;
  deleteCard: (id: string) => void;
  bulkEditCards: (ids: string[], updates: Partial<Flashcard>) => void;
  bulkDeleteCards: (ids: string[]) => void;
  recordReview: (cardId: string, rating: number, interval: number, easeFactor: number) => void;
  importCardsBatch: (newCards: Flashcard[]) => void;
  importApkgCards: (deckIdOrName: string, cards: Array<Partial<Flashcard> & { front: string; back: string; tags?: string[]; fields?: FlashcardField[] }>) => void;
  importCardsCsv: (deckId: string, cardsOrCsv: Array<{ front: string; back: string }> | string) => void;
  advanceCardsToNow: (deckIdOrCardIds?: string | string[]) => void;
  toggleSuspendCard: (cardId: string) => void;
  toggleBuryCard: (cardId: string) => void;
  unsuspendCard: (cardId: string) => void;
  suspendCard: (cardId: string) => void;
  scheduleCardForToday: (cardId: string) => void;
  rescheduleCard: (cardId: string, daysFromNow: number) => void;
  associateCardWithQuestion: (cardId: string, qid: string) => void;
  activateAndScheduleForToday: (cardId: string, qid?: string) => void;
  bulkActivateAndScheduleForToday: (cardIds: string[], qid?: string) => void;
  reviewCards: (cardIdsOrDeckId?: string[] | string, rating?: any) => any;
  reviewCardsCustom: (cardIds: string[], days?: number) => any;

  // Question & Bank Actions
  createQuestionBank: (name: string, description?: string) => string;
  updateQuestionBank: (id: string, name: string, description?: string) => void;
  deleteQuestionBank: (id: string) => void;
  createQuestion: (q: Omit<Question, 'id' | 'createdAt'>) => string;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  deleteQuestion: (id: string) => void;
  upsertQuestionFromQBank: (q: Partial<Question> & { qid: string; bankId?: string }) => string;
  recordQuestionAnswer: (
    questionId: string,
    isCorrect: boolean,
    selectedChoiceId: string,
    resolutionTimeSeconds: number,
    reviewTimeSeconds: number
  ) => void;
  resetQuestionStats: (questionId: string) => void;
  resetBankStats: (bankId: string) => void;
  updateQuestionNotes: (questionId: string, notes: string) => void;
  toggleQuestionFlag: (questionId: string) => void;

  // Notebook Actions
  createNotebook: (name: string, questionIds: string[], description?: string, timeLimitPerQuestion?: number, mode?: 'exam' | 'tutor') => string;
  deleteNotebook: (id: string) => void;
  addNotebookHistory: (history: any) => void;
  recordNotebookHistory: (notebookId: string, results: Record<string, boolean>, answers?: Record<string, string>) => void;

  // Note Actions
  createNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateNote: (id: string, content: string) => void;
  deleteNote: (id: string) => void;

  // Settings Actions
  updateSettings: (settings: Partial<Settings>) => void;
  resetSettings: () => void;
  resetAllData: () => void;
  importProfile: (data: any) => void;
  mergeProfile: (data: any) => void;
}

export const useStore = create<StoreState>()(
  temporal(
    persist(
      (set, get) => ({
        decks: [
          { id: 'deck-default', name: 'USMLE Step 1 Geral', parentId: null, settings: {} },
          { id: 'deck-cardio', name: 'Cardiologia', parentId: 'deck-default', settings: {} },
          { id: 'deck-infecto', name: 'Infectologia', parentId: 'deck-default', settings: {} },
        ],
        cards: [
          {
            id: 'card-1',
            deckId: 'deck-cardio',
            front: '<p>Qual é a principal tríade de <b>Estenose Aórtica</b> sintomática?</p>',
            back: '<p><b>Tríade Clássica:</b></p><ul><li>Angina (sobrevida média ~5 anos)</li><li>Síncope (~3 anos)</li><li>Dispneia / IC (~2 anos)</li></ul>',
            details: 'Indica indicação cirúrgica (TAVR ou SAVR)',
            tags: ['cardio', 'valvopatia', 'high-yield'],
            flag: 'orange',
            repetition: 0,
            interval: 0,
            easeFactor: 2.5,
            nextReviewDate: Date.now(),
            createdAt: Date.now() - 86400000,
          },
          {
            id: 'card-2',
            deckId: 'deck-infecto',
            front: '<p>Qual é o tratamento empírico de primeira linha para <b>Meningite Bacteriana</b> em adultos jovens?</p>',
            back: '<p><b>Ceftriaxona</b> (cobre <i>S. pneumoniae</i> e <i>N. meningitidis</i>) + <b>Vancomicina</b> (cobre cepas resistentes) + <b>Dexametasona</b> prévia ou concomitante.</p>',
            details: 'Adicionar Ampicilina se >50 anos ou imunocomprometido para cobrir Listeria.',
            tags: ['infecto', 'emergencia', 'farmaco'],
            flag: 'red',
            repetition: 0,
            interval: 0,
            easeFactor: 2.5,
            nextReviewDate: Date.now(),
            createdAt: Date.now() - 43200000,
          }
        ],
        reviewHistory: [],
        reviewLog: [],
        questions: [],
        questionBanks: [
          { id: 'bank-1', name: 'USMLE High-Yield QBank', description: 'Banco com questões selecionadas', createdAt: Date.now() }
        ],
        notebooks: [],
        notebookHistory: [],
        notes: [],
        settings: DEFAULT_SETTINGS,

        createDeck: (name, parentId = null) => {
          const id = 'deck-' + Math.random().toString(36).substring(2, 9);
          set(state => ({
            decks: [...state.decks, { id, name, parentId, createdAt: Date.now(), settings: {} }]
          }));
          return id;
        },

        updateDeck: (id, updates) => {
          set(state => ({
            decks: state.decks.map(d => d.id === id ? { ...d, ...updates } : d)
          }));
        },

        updateDeckSettings: (deckId, settings) => {
          set(state => ({
            decks: state.decks.map(d => d.id === deckId ? { ...d, settings: { ...d.settings, ...settings } } : d)
          }));
        },

        deleteDeck: (id) => {
          set(state => ({
            decks: state.decks.filter(d => d.id !== id && d.parentId !== id),
            cards: state.cards.filter(c => c.deckId !== id)
          }));
        },

        moveDeck: (deckId, targetParentId) => {
          set(state => ({
            decks: state.decks.map(d => d.id === deckId ? { ...d, parentId: targetParentId } : d)
          }));
        },

        exportDeckSet: (deckId) => {
          const state = get();
          const deck = state.decks.find(d => d.id === deckId);
          const deckCards = state.cards.filter(c => c.deckId === deckId);
          return JSON.stringify({ deck, cards: deckCards }, null, 2);
        },

        importDeckSet: (jsonStr, targetParentId) => {
          try {
            const data = JSON.parse(jsonStr);
            if (data.deck && Array.isArray(data.cards)) {
              const deckToImport = {
                ...data.deck,
                parentId: targetParentId !== undefined ? targetParentId : data.deck.parentId
              };
              set(state => ({
                decks: [...state.decks, deckToImport],
                cards: [...state.cards, ...data.cards]
              }));
            }
          } catch (e) {
            console.error("Failed to import deck set", e);
          }
        },

        createCard: (deckIdOrCard, front = '', back = '', details = '', tags = [], flag = '', sourceQuestionId) => {
          const id = 'card-' + Math.random().toString(36).substring(2, 9);
          let newCard: Flashcard;

          if (typeof deckIdOrCard === 'object') {
            newCard = {
              id,
              deckId: deckIdOrCard.deckId,
              front: deckIdOrCard.front,
              back: deckIdOrCard.back,
              details: deckIdOrCard.details || '',
              tags: deckIdOrCard.tags || [],
              flag: deckIdOrCard.flag || '',
              repetition: deckIdOrCard.repetition || 0,
              interval: deckIdOrCard.interval || 0,
              easeFactor: deckIdOrCard.easeFactor || 2.5,
              nextReviewDate: deckIdOrCard.nextReviewDate || Date.now(),
              createdAt: Date.now(),
              isSuspended: false,
              isBuried: false,
              sourceQuestionId: deckIdOrCard.sourceQuestionId,
              questionId: deckIdOrCard.questionId,
              questionStem: deckIdOrCard.questionStem,
              questionChoices: deckIdOrCard.questionChoices,
              explanation: deckIdOrCard.explanation,
              educationalObjective: deckIdOrCard.educationalObjective,
              questionImages: deckIdOrCard.questionImages,
              subject: deckIdOrCard.subject || deckIdOrCard.subjective,
              subjective: deckIdOrCard.subjective || deckIdOrCard.subject,
              system: deckIdOrCard.system,
            };
          } else {
            newCard = {
              id,
              deckId: deckIdOrCard,
              front,
              back,
              details: details || '',
              tags: tags || [],
              flag: flag || '',
              repetition: 0,
              interval: 0,
              easeFactor: 2.5,
              nextReviewDate: Date.now(),
              createdAt: Date.now(),
              isSuspended: false,
              isBuried: false,
              sourceQuestionId,
            };
          }

          set(state => ({ cards: [newCard, ...state.cards] }));
          return id;
        },

        updateCard: (id, frontOrUpdates, back, details, tags, flag) => {
          set(state => ({
            cards: state.cards.map(c => {
              if (c.id !== id) return c;
              if (typeof frontOrUpdates === 'object') {
                return { ...c, ...frontOrUpdates };
              }
              const updates: Partial<Flashcard> = {};
              if (frontOrUpdates !== undefined) updates.front = frontOrUpdates;
              if (back !== undefined) updates.back = back;
              if (details !== undefined) updates.details = details;
              if (tags !== undefined) updates.tags = tags;
              if (flag !== undefined) updates.flag = flag;
              return { ...c, ...updates };
            })
          }));
        },

        deleteCard: (id) => {
          set(state => ({
            cards: state.cards.filter(c => c.id !== id)
          }));
        },

        bulkEditCards: (ids, updates) => {
          const idSet = new Set(ids);
          set(state => ({
            cards: state.cards.map(c => idSet.has(c.id) ? { ...c, ...updates } : c)
          }));
        },

        bulkDeleteCards: (ids) => {
          const idSet = new Set(ids);
          set(state => ({
            cards: state.cards.filter(c => !idSet.has(c.id))
          }));
        },

        toggleSuspendCard: (cardId) => {
          set(state => ({
            cards: state.cards.map(c => c.id === cardId ? { ...c, isSuspended: !c.isSuspended } : c)
          }));
        },

        toggleBuryCard: (cardId) => {
          set(state => ({
            cards: state.cards.map(c => c.id === cardId ? { ...c, isBuried: !c.isBuried } : c)
          }));
        },

        unsuspendCard: (cardId) => {
          set(state => ({
            cards: state.cards.map(c => c.id === cardId ? { ...c, isSuspended: false } : c)
          }));
        },

        suspendCard: (cardId) => {
          set(state => ({
            cards: state.cards.map(c => c.id === cardId ? { ...c, isSuspended: true } : c)
          }));
        },

        scheduleCardForToday: (cardId) => {
          const now = Date.now() - 1000;
          set(state => ({
            cards: state.cards.map(c => c.id === cardId ? { ...c, isSuspended: false, isBuried: false, nextReviewDate: now } : c)
          }));
        },

        rescheduleCard: (cardId, daysFromNow) => {
          const numDays = Math.max(0, Number(daysFromNow) || 0);
          const target = numDays === 0 ? Date.now() - 1000 : Date.now() + numDays * 24 * 60 * 60 * 1000;
          set(state => ({
            cards: state.cards.map(c => c.id === cardId ? { ...c, interval: numDays, nextReviewDate: target, isSuspended: false } : c)
          }));
        },

        associateCardWithQuestion: (cardId, qid) => {
          if (!qid) return;
          const cleanQid = qid.toString().replace(/^qid[:\-_]*/i, '').trim();
          set(state => ({
            cards: state.cards.map(c => {
              if (c.id !== cardId) return c;
              const tags = [...(c.tags || [])];
              const qidTag = `qid:${cleanQid}`;
              if (!tags.includes(qidTag) && !tags.includes(cleanQid)) {
                tags.push(qidTag);
              }
              return {
                ...c,
                questionId: cleanQid,
                tags,
              };
            })
          }));
        },

        activateAndScheduleForToday: (cardId, qid) => {
          const now = Date.now() - 1000;
          const cleanQid = qid ? qid.toString().replace(/^qid[:\-_]*/i, '').trim() : undefined;
          set(state => ({
            cards: state.cards.map(c => {
              if (c.id !== cardId) return c;
              const tags = [...(c.tags || [])];
              if (cleanQid) {
                const qidTag = `qid:${cleanQid}`;
                if (!tags.includes(qidTag) && !tags.includes(cleanQid)) {
                  tags.push(qidTag);
                }
              }
              return {
                ...c,
                isSuspended: false,
                isBuried: false,
                nextReviewDate: now,
                questionId: cleanQid || c.questionId,
                tags,
              };
            })
          }));
        },

        bulkActivateAndScheduleForToday: (cardIds, qid) => {
          const now = Date.now() - 1000;
          const idSet = new Set(cardIds);
          const cleanQid = qid ? qid.toString().replace(/^qid[:\-_]*/i, '').trim() : undefined;
          set(state => ({
            cards: state.cards.map(c => {
              if (!idSet.has(c.id)) return c;
              const tags = [...(c.tags || [])];
              if (cleanQid) {
                const qidTag = `qid:${cleanQid}`;
                if (!tags.includes(qidTag) && !tags.includes(cleanQid)) {
                  tags.push(qidTag);
                }
              }
              return {
                ...c,
                isSuspended: false,
                isBuried: false,
                nextReviewDate: now,
                questionId: cleanQid || c.questionId,
                tags,
              };
            })
          }));
        },

        advanceCardsToNow: (target) => {
          const now = Date.now();
          set(state => {
            if (Array.isArray(target)) {
              const idSet = new Set(target);
              return {
                cards: state.cards.map(c => idSet.has(c.id) ? { ...c, nextReviewDate: now } : c)
              };
            }
            return {
              cards: state.cards.map(c => {
                if (target && c.deckId !== target) return c;
                return { ...c, nextReviewDate: now };
              })
            };
          });
        },

        reviewCards: (cardIdsOrDeckId, rating) => {
          const state = get();
          if (Array.isArray(cardIdsOrDeckId) && rating !== undefined) {
            const ratingNum = typeof rating === 'number'
              ? rating
              : (rating === 'again' ? 1 : rating === 'hard' ? 2 : rating === 'good' ? 3 : 4);
            const now = Date.now();
            const idSet = new Set(cardIdsOrDeckId);
            const newLogs: ReviewLog[] = [];

            const updatedCards = state.cards.map(card => {
              if (!idSet.has(card.id)) return card;

              const isNew = card.repetition === 0;
              let nextIntervalDays = 0;
              let nextReviewMs = 0;
              let newRepetition = 0;
              let newEase = card.easeFactor || 2.5;

              if (isNew) {
                if (ratingNum === 1) { // ERREI (Again)
                  newRepetition = 0;
                  nextIntervalDays = 0;
                  nextReviewMs = now + 15 * 60 * 1000; // 15 minutes
                  newEase = Math.max(1.3, newEase - 0.2);
                } else if (ratingNum === 2) { // DIFÍCIL (Hard)
                  newRepetition = 1;
                  nextIntervalDays = 1;
                  nextReviewMs = now + 1 * 24 * 60 * 60 * 1000; // 1 day
                  newEase = Math.max(1.3, newEase - 0.15);
                } else if (ratingNum === 3) { // BOM (Good)
                  newRepetition = 1;
                  nextIntervalDays = 4;
                  nextReviewMs = now + 4 * 24 * 60 * 60 * 1000; // 4 days
                } else { // FÁCIL (Easy)
                  newRepetition = 1;
                  nextIntervalDays = 10;
                  nextReviewMs = now + 10 * 24 * 60 * 60 * 1000; // 10 days
                  newEase = Math.min(3.5, newEase + 0.15);
                }
              } else {
                // Review cards: interval is strictly calculated in DAYS
                const currentInterval = Math.max(1, card.interval || 1);
                if (ratingNum === 1) { // ERREI (Again)
                  newRepetition = 0;
                  nextIntervalDays = 0;
                  nextReviewMs = now + 15 * 60 * 1000; // 15 minutes
                  newEase = Math.max(1.3, newEase - 0.2);
                } else if (ratingNum === 2) { // DIFÍCIL (Hard)
                  newRepetition = card.repetition + 1;
                  nextIntervalDays = Math.max(1, Math.round(currentInterval * 1.2));
                  nextReviewMs = now + nextIntervalDays * 24 * 60 * 60 * 1000;
                  newEase = Math.max(1.3, newEase - 0.15);
                } else if (ratingNum === 3) { // BOM (Good)
                  newRepetition = card.repetition + 1;
                  nextIntervalDays = Math.max(currentInterval + 1, Math.round(currentInterval * newEase));
                  nextReviewMs = now + nextIntervalDays * 24 * 60 * 60 * 1000;
                } else { // FÁCIL (Easy)
                  newRepetition = card.repetition + 1;
                  newEase = Math.min(3.5, newEase + 0.15);
                  nextIntervalDays = Math.max(currentInterval + 2, Math.round(currentInterval * newEase * 1.3));
                  nextReviewMs = now + nextIntervalDays * 24 * 60 * 60 * 1000;
                }
              }

              newLogs.push({
                id: 'rev-' + Math.random().toString(36).substring(2, 9),
                cardId: card.id,
                deckId: card.deckId,
                rating: ratingNum,
                reviewDate: now,
                interval: nextIntervalDays,
                easeFactor: Number(newEase.toFixed(2)),
              });

              return {
                ...card,
                repetition: newRepetition,
                interval: nextIntervalDays,
                easeFactor: Number(newEase.toFixed(2)),
                nextReviewDate: nextReviewMs,
              };
            });

            set({
              cards: updatedCards,
              reviewHistory: [...newLogs, ...state.reviewHistory],
              reviewLog: [...newLogs, ...state.reviewLog],
            });
            return;
          }

          const deckId = typeof cardIdsOrDeckId === 'string' ? cardIdsOrDeckId : undefined;
          return state.cards.filter(c => {
            if (deckId && c.deckId !== deckId) return false;
            if (c.isSuspended || c.isBuried) return false;
            return c.nextReviewDate <= Date.now() || c.repetition === 0;
          });
        },

        reviewCardsCustom: (cardIds, days = 1) => {
          const state = get();
          const numDays = Math.max(0, Number(days) || 0);
          const targetDate = numDays === 0 ? Date.now() - 1000 : Date.now() + numDays * 24 * 60 * 60 * 1000;
          const idSet = new Set(cardIds);
          const now = Date.now();
          const newLogs: ReviewLog[] = [];

          const updatedCards = state.cards.map(c => {
            if (!idSet.has(c.id)) return c;
            const logItem: ReviewLog = {
              id: 'rev-' + Math.random().toString(36).substring(2, 9),
              cardId: c.id,
              deckId: c.deckId,
              rating: 3,
              reviewDate: now,
              interval: numDays,
              easeFactor: c.easeFactor || 2.5,
            };
            newLogs.push(logItem);
            return {
              ...c,
              repetition: c.repetition + 1,
              interval: numDays,
              nextReviewDate: targetDate,
            };
          });

          set({
            cards: updatedCards,
            reviewHistory: [...newLogs, ...state.reviewHistory],
            reviewLog: [...newLogs, ...state.reviewLog],
          });
        },

        recordReview: (cardId, rating, intervalDays, easeFactor) => {
          const state = get();
          const card = state.cards.find(c => c.id === cardId);
          if (!card) return;

          // If intervalDays is 0, schedule in 15 minutes, otherwise intervalDays * 24 hours
          const nextReviewDate = intervalDays === 0
            ? Date.now() + 15 * 60 * 1000
            : Date.now() + intervalDays * 24 * 60 * 60 * 1000;
          const newRepetition = rating >= 3 ? card.repetition + 1 : 0;

          const reviewLogItem: ReviewLog = {
            id: 'rev-' + Math.random().toString(36).substring(2, 9),
            cardId,
            deckId: card.deckId,
            rating,
            reviewDate: Date.now(),
            interval: intervalDays,
            easeFactor,
          };

          set({
            cards: state.cards.map(c =>
              c.id === cardId
                ? {
                    ...c,
                    repetition: newRepetition,
                    interval: intervalDays,
                    easeFactor,
                    nextReviewDate,
                  }
                : c
            ),
            reviewHistory: [reviewLogItem, ...state.reviewHistory],
            reviewLog: [reviewLogItem, ...state.reviewLog],
          });
        },

        importCardsBatch: (newCards) => {
          set(state => ({
            cards: [...newCards, ...state.cards]
          }));
        },

        importApkgCards: (deckIdOrName, importedCards) => {
          const state = get();
          // Look up by id first, then by name
          let deck = state.decks.find(d => d.id === deckIdOrName) ||
                     state.decks.find(d => d.name.toLowerCase() === deckIdOrName.toLowerCase());
          let targetDeckId = deck?.id;
          if (!targetDeckId) {
            targetDeckId = 'deck-' + Math.random().toString(36).substring(2, 9);
            state.decks.push({ id: targetDeckId, name: deckIdOrName, parentId: null, settings: {} });
          }

          const newCards: Flashcard[] = importedCards.map(c => ({
            id: 'card-' + Math.random().toString(36).substring(2, 9),
            deckId: targetDeckId!,
            front: c.front,
            back: c.back,
            details: c.details || '',
            tags: c.tags || [],
            flag: c.flag || '',
            fields: c.fields || [],
            repetition: c.repetition || 0,
            interval: c.interval || 0,
            easeFactor: c.easeFactor || 2.5,
            nextReviewDate: c.nextReviewDate || Date.now(),
            createdAt: c.createdAt || Date.now(),
            isSuspended: c.isSuspended || false,
            isBuried: c.isBuried || false,
            questionId: c.questionId,
            questionStem: c.questionStem,
            questionChoices: c.questionChoices,
            explanation: c.explanation,
            educationalObjective: c.educationalObjective,
            questionImages: c.questionImages,
          }));

          set({
            decks: [...state.decks],
            cards: [...newCards, ...state.cards],
          });
        },

        importCardsCsv: (deckId, cardsOrCsv) => {
          const newCards: Flashcard[] = [];

          if (Array.isArray(cardsOrCsv)) {
            cardsOrCsv.forEach(c => {
              if (c.front?.trim() || c.back?.trim()) {
                newCards.push({
                  id: 'card-' + Math.random().toString(36).substring(2, 9),
                  deckId,
                  front: c.front || '',
                  back: c.back || '',
                  details: '',
                  tags: [],
                  flag: '',
                  repetition: 0,
                  interval: 0,
                  easeFactor: 2.5,
                  nextReviewDate: Date.now(),
                  createdAt: Date.now(),
                });
              }
            });
          } else if (typeof cardsOrCsv === 'string') {
            const lines = cardsOrCsv.split('\n');
            for (const line of lines) {
              if (!line.trim()) continue;
              const parts = line.split('\t');
              const front = parts[0] || '';
              const back = parts[1] || '';
              if (front.trim()) {
                newCards.push({
                  id: 'card-' + Math.random().toString(36).substring(2, 9),
                  deckId,
                  front,
                  back,
                  details: '',
                  tags: [],
                  flag: '',
                  repetition: 0,
                  interval: 0,
                  easeFactor: 2.5,
                  nextReviewDate: Date.now(),
                  createdAt: Date.now(),
                });
              }
            }
          }

          if (newCards.length > 0) {
            set(state => ({ cards: [...newCards, ...state.cards] }));
          }
        },

        createQuestionBank: (name, description = '') => {
          const id = 'bank-' + Math.random().toString(36).substring(2, 9);
          set(state => ({
            questionBanks: [...state.questionBanks, { id, name, description, createdAt: Date.now() }]
          }));
          return id;
        },

        updateQuestionBank: (id, name, description = '') => {
          set(state => ({
            questionBanks: state.questionBanks.map(b => b.id === id ? { ...b, name, description } : b)
          }));
        },

        deleteQuestionBank: (id) => {
          set(state => ({
            questionBanks: state.questionBanks.filter(b => b.id !== id),
            questions: state.questions.filter(q => q.bankId !== id)
          }));
        },

        createQuestion: (qData) => {
          const id = 'q-' + Math.random().toString(36).substring(2, 9);
          const newQ: Question = {
            ...qData,
            id,
            createdAt: Date.now(),
          };
          set(state => ({ questions: [...state.questions, newQ] }));
          return id;
        },

        updateQuestion: (id, updates) => {
          set(state => ({
            questions: state.questions.map(q => q.id === id ? { ...q, ...updates } : q)
          }));
        },

        deleteQuestion: (id) => {
          set(state => ({
            questions: state.questions.filter(q => q.id !== id)
          }));
        },

        upsertQuestionFromQBank: (qData) => {
          const state = get();
          // Garante banco de questões alvo
          let targetBankId = qData.bankId;
          if (!targetBankId || !state.questionBanks.some(b => b.id === targetBankId)) {
            if (state.questionBanks.length > 0) {
              targetBankId = state.questionBanks[0].id;
            } else {
              targetBankId = 'bank-' + Math.random().toString(36).substring(2, 9);
              state.questionBanks.push({
                id: targetBankId,
                name: 'UWorld USMLE Step 1',
                description: 'Banco padrão importado automaticamente',
                createdAt: Date.now()
              });
            }
          }

          const cleanQid = (qData.qid || '').trim();
          if (!cleanQid) return '';

          // Busca questão existente pelo QID (identificador único dentro do banco ou global)
          const existingIdx = state.questions.findIndex(q => 
            (q.qid && q.qid.toString().trim() === cleanQid && q.bankId === targetBankId) ||
            (q.qid && q.qid.toString().trim() === cleanQid)
          );

          const stemText = qData.stem || qData.text || '';

          if (existingIdx !== -1) {
            const current = state.questions[existingIdx];
            const updated: Question = {
              ...current,
              // Preserva identificadores e estatísticas de resolução prévia
              bankId: targetBankId,
              text: stemText || current.text,
              stem: stemText || current.stem || current.text,
              // Atualiza conteúdo enriquecido apenas se fornecido
              alternatives: qData.alternatives && qData.alternatives.length > 0 ? qData.alternatives : current.alternatives,
              explanation: qData.explanation || current.explanation,
              educationalObjective: qData.educationalObjective || current.educationalObjective,
              subject: qData.subject || current.subject,
              system: qData.system || current.system,
              images: qData.images && qData.images.length > 0 ? qData.images : current.images,
              links: qData.links && qData.links.length > 0 ? qData.links : current.links,
              tags: qData.tags && qData.tags.length > 0 ? Array.from(new Set([...(current.tags || []), ...qData.tags])) : current.tags,
              updatedAt: Date.now(),
            };

            const newQuestions = [...state.questions];
            newQuestions[existingIdx] = updated;
            set({ questions: newQuestions, questionBanks: [...state.questionBanks] });
            return current.id;
          } else {
            const newId = 'q-' + Math.random().toString(36).substring(2, 9);
            const newQ: Question = {
              id: newId,
              qid: cleanQid,
              bankId: targetBankId,
              text: stemText,
              stem: stemText,
              alternatives: qData.alternatives || [],
              explanation: qData.explanation || '',
              educationalObjective: qData.educationalObjective || '',
              subject: qData.subject || '',
              system: qData.system || '',
              images: qData.images || [],
              links: qData.links || [],
              tags: qData.tags || [],
              status: 'unused',
              attempts: [],
              resolutionTimeSeconds: 0,
              reviewTimeSeconds: 0,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };

            set(s => ({
              questions: [newQ, ...s.questions],
              questionBanks: [...state.questionBanks]
            }));
            return newId;
          }
        },

        recordQuestionAnswer: (questionId, isCorrect, selectedChoiceId, resolutionTimeSeconds, reviewTimeSeconds) => {
          set(state => ({
            questions: state.questions.map(q => {
              if (q.id !== questionId && q.qid !== questionId) return q;

              const attempts = q.attempts || [];
              const newAttempt: QuestionAttempt = {
                timestamp: Date.now(),
                selectedChoiceId,
                isCorrect,
                resolutionTimeSeconds: Math.max(1, Math.round(resolutionTimeSeconds || 0)),
                reviewTimeSeconds: Math.max(0, Math.round(reviewTimeSeconds || 0)),
              };

              return {
                ...q,
                status: isCorrect ? 'correct' : 'incorrect',
                selectedChoiceId,
                resolutionTimeSeconds: (q.resolutionTimeSeconds || 0) + newAttempt.resolutionTimeSeconds,
                reviewTimeSeconds: (q.reviewTimeSeconds || 0) + newAttempt.reviewTimeSeconds,
                attempts: [...attempts, newAttempt],
                lastAnsweredAt: Date.now(),
                updatedAt: Date.now(),
              };
            })
          }));
        },

        resetQuestionStats: (questionId) => {
          set(state => ({
            questions: state.questions.map(q => {
              if (q.id !== questionId && q.qid !== questionId) return q;
              return {
                ...q,
                status: 'unused',
                selectedChoiceId: undefined,
                resolutionTimeSeconds: 0,
                reviewTimeSeconds: 0,
                attempts: [],
                lastAnsweredAt: undefined,
                updatedAt: Date.now(),
              };
            })
          }));
        },

        resetBankStats: (bankId) => {
          set(state => ({
            questions: state.questions.map(q => {
              if (q.bankId !== bankId) return q;
              return {
                ...q,
                status: 'unused',
                selectedChoiceId: undefined,
                resolutionTimeSeconds: 0,
                reviewTimeSeconds: 0,
                attempts: [],
                lastAnsweredAt: undefined,
                updatedAt: Date.now(),
              };
            })
          }));
        },

        updateQuestionNotes: (questionId, notes) => {
          set(state => ({
            questions: state.questions.map(q => {
              if (q.id !== questionId && q.qid !== questionId) return q;
              return { ...q, userNotes: notes, updatedAt: Date.now() };
            })
          }));
        },

        toggleQuestionFlag: (questionId) => {
          set(state => ({
            questions: state.questions.map(q => {
              if (q.id !== questionId && q.qid !== questionId) return q;
              return { ...q, isFlagged: !q.isFlagged, updatedAt: Date.now() };
            })
          }));
        },

        createNotebook: (name, questionIds, description = '', timeLimitPerQuestion = 0, mode = 'exam') => {
          const id = 'nb-' + Math.random().toString(36).substring(2, 9);
          set(state => ({
            notebooks: [
              ...state.notebooks,
              { id, name, questionIds, description, timeLimitPerQuestion, mode, createdAt: Date.now() }
            ]
          }));
          return id;
        },

        deleteNotebook: (id) => {
          set(state => ({
            notebooks: state.notebooks.filter(nb => nb.id !== id)
          }));
        },

        addNotebookHistory: (hist) => {
          set(state => ({
            notebookHistory: [hist, ...state.notebookHistory]
          }));
        },

        recordNotebookHistory: (notebookId, results, answers) => {
          const correct = Object.values(results).filter(Boolean).length;
          const total = Object.keys(results).length;
          const history: NotebookHistory = {
            id: 'nbh-' + Math.random().toString(36).substring(2, 9),
            notebookId,
            completedAt: Date.now(),
            results,
            answers,
            correct,
            total,
          };
          set(state => ({
            notebookHistory: [history, ...state.notebookHistory]
          }));
        },

        createNote: (noteData) => {
          const id = 'note-' + Math.random().toString(36).substring(2, 9);
          const newNote: Note = {
            ...noteData,
            id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          set(state => ({ notes: [newNote, ...state.notes] }));
          return id;
        },

        updateNote: (id, content) => {
          set(state => ({
            notes: state.notes.map(n => n.id === id ? { ...n, content, updatedAt: Date.now() } : n)
          }));
        },

        deleteNote: (id) => {
          set(state => ({
            notes: state.notes.filter(n => n.id !== id)
          }));
        },

        updateSettings: (updates) => {
          set(state => ({
            settings: { ...state.settings, ...updates }
          }));
        },

        resetSettings: () => {
          set({ settings: DEFAULT_SETTINGS });
        },

        resetAllData: () => {
          set({
            decks: [{ id: 'deck-default', name: 'USMLE Step 1 Geral', parentId: null, settings: {} }],
            cards: [],
            reviewHistory: [],
            reviewLog: [],
            questions: [],
            questionBanks: [],
            notebooks: [],
            notebookHistory: [],
            notes: [],
            settings: DEFAULT_SETTINGS,
          });
        },

        importProfile: (data) => {
          if (!data) return;
          set({
            decks: data.decks || [],
            cards: data.cards || [],
            reviewHistory: data.reviewHistory || [],
            reviewLog: data.reviewLog || data.reviewHistory || [],
            questions: data.questions || [],
            questionBanks: data.questionBanks || [],
            notebooks: data.notebooks || [],
            notebookHistory: data.notebookHistory || [],
            notes: data.notes || [],
            settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
          });
        },

        mergeProfile: (data) => {
          if (!data) return;
          set((state) => {
            // 1. Decks merge (Union by deck.id)
            const deckMap = new Map<string, Deck>();
            (state.decks || []).forEach(d => deckMap.set(d.id, d));
            (data.decks || []).forEach((d: Deck) => {
              if (d && d.id && !deckMap.has(d.id)) {
                deckMap.set(d.id, d);
              }
            });

            // 2. Cards merge (Preserve all local cards + add any unique cloud cards)
            const cardMap = new Map<string, Flashcard>();
            (state.cards || []).forEach(c => {
              if (c && c.id) cardMap.set(c.id, c);
            });
            (data.cards || []).forEach((c: Flashcard) => {
              if (c && c.id) {
                if (!cardMap.has(c.id)) {
                  cardMap.set(c.id, c);
                } else {
                  // If incoming card has review history while local is unreviewed, update scheduling
                  const localCard = cardMap.get(c.id)!;
                  if ((c.repetition || 0) > (localCard.repetition || 0)) {
                    cardMap.set(c.id, { ...localCard, ...c });
                  }
                }
              }
            });

            // 3. Questions merge (Union by qid or id)
            const qMap = new Map<string, Question>();
            (state.questions || []).forEach(q => {
              if (q) qMap.set(q.id || q.qid, q);
            });
            (data.questions || []).forEach((q: Question) => {
              if (q) {
                const key = q.id || q.qid;
                if (key && !qMap.has(key)) {
                  qMap.set(key, q);
                }
              }
            });

            // 4. Question Banks merge
            const bankMap = new Map<string, QuestionBank>();
            (state.questionBanks || []).forEach(b => {
              if (b && b.id) bankMap.set(b.id, b);
            });
            (data.questionBanks || []).forEach((b: QuestionBank) => {
              if (b && b.id && !bankMap.has(b.id)) {
                bankMap.set(b.id, b);
              }
            });

            // 5. Notebooks merge
            const nbMap = new Map<string, Notebook>();
            (state.notebooks || []).forEach(nb => {
              if (nb && nb.id) nbMap.set(nb.id, nb);
            });
            (data.notebooks || []).forEach((nb: Notebook) => {
              if (nb && nb.id && !nbMap.has(nb.id)) {
                nbMap.set(nb.id, nb);
              }
            });

            // 6. Notes merge
            const noteMap = new Map<string, Note>();
            (state.notes || []).forEach(n => {
              if (n && n.id) noteMap.set(n.id, n);
            });
            (data.notes || []).forEach((n: Note) => {
              if (n && n.id && !noteMap.has(n.id)) {
                noteMap.set(n.id, n);
              }
            });

            return {
              decks: Array.from(deckMap.values()),
              cards: Array.from(cardMap.values()),
              questions: Array.from(qMap.values()),
              questionBanks: Array.from(bankMap.values()),
              notebooks: Array.from(nbMap.values()),
              notes: Array.from(noteMap.values()),
              settings: { ...DEFAULT_SETTINGS, ...(state.settings || {}), ...(data.settings || {}) },
            };
          });
        },
      }),
      {
        name: 'cardblocks-storage',
        storage: createJSONStorage(() => ({
          getItem: async (name: string): Promise<string | null> => {
            try {
              const item = await cardblocksDataStore.getItem<string>(name);
              if (item) return typeof item === 'string' ? item : JSON.stringify(item);
            } catch (e) {
              console.warn("Could not read from IndexedDB storage", e);
            }
            try {
              const local = localStorage.getItem(name);
              if (local) {
                cardblocksDataStore.setItem(name, local).catch(() => {});
                return local;
              }
            } catch (e) {}
            return null;
          },
          setItem: async (name: string, value: string): Promise<void> => {
            try {
              await cardblocksDataStore.setItem(name, value);
            } catch (e) {
              console.warn("Could not write to IndexedDB storage", e);
            }
            try {
              if (value.length < 2 * 1024 * 1024) {
                localStorage.setItem(name, value);
              }
            } catch (e) {
              // Ignore quota errors on localStorage
            }
          },
          removeItem: async (name: string): Promise<void> => {
            try {
              await cardblocksDataStore.removeItem(name);
            } catch (e) {}
            try {
              localStorage.removeItem(name);
            } catch (e) {}
          }
        })),
      }
    ),
    {
      limit: 30,
      partialize: (state) => ({
        decks: state.decks,
        settings: state.settings,
        notebooks: state.notebooks,
        notes: state.notes,
      }),
    }
  )
);
