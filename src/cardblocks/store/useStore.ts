import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';

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

export interface Flashcard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  details?: string;
  tags?: string[];
  flag?: string;
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
  text: string;
  isCorrect?: boolean;
  explanation?: string;
  letter?: string;
}

export interface Question {
  id: string;
  bankId: string;
  text: string;
  subject?: string;
  area?: string;
  subArea?: string;
  specialty?: string;
  topic?: string;
  subTopic?: string;
  tags?: string[];
  flag?: string;
  alternatives: QuestionAlternative[];
  explanation?: string;
  createdAt?: number;
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
  importApkgCards: (deckName: string, cards: Array<{ front: string; back: string; tags?: string[] }>) => void;
  importCardsCsv: (deckId: string, cardsOrCsv: Array<{ front: string; back: string }> | string) => void;
  advanceCardsToNow: (deckId?: string) => void;
  toggleSuspendCard: (cardId: string) => void;
  toggleBuryCard: (cardId: string) => void;
  reviewCards: (cardIdsOrDeckId?: string[] | string, rating?: any) => any;
  reviewCardsCustom: (cardIds: string[], days?: number) => any;

  // Question & Bank Actions
  createQuestionBank: (name: string, description?: string) => string;
  updateQuestionBank: (id: string, name: string, description?: string) => void;
  deleteQuestionBank: (id: string) => void;
  createQuestion: (q: Omit<Question, 'id' | 'createdAt'>) => string;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  deleteQuestion: (id: string) => void;

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

        advanceCardsToNow: (deckId) => {
          const now = Date.now();
          set(state => ({
            cards: state.cards.map(c => {
              if (deckId && c.deckId !== deckId) return c;
              return { ...c, nextReviewDate: now };
            })
          }));
        },

        reviewCards: (cardIdsOrDeckId, rating) => {
          const state = get();
          if (Array.isArray(cardIdsOrDeckId) && rating !== undefined) {
            // Rating multiple cards
            const ratingNum = typeof rating === 'number' ? rating : (rating === 'again' ? 1 : rating === 'hard' ? 2 : rating === 'good' ? 3 : 4);
            cardIdsOrDeckId.forEach(id => {
              const card = state.cards.find(c => c.id === id);
              if (card) {
                const interval = ratingNum === 1 ? 1 : (ratingNum === 2 ? Math.max(1, card.interval * 1.2) : (ratingNum === 3 ? (card.interval === 0 ? 1 : card.interval * card.easeFactor) : (card.interval === 0 ? 4 : card.interval * card.easeFactor * 1.3)));
                const easeFactor = ratingNum === 1 ? Math.max(1.3, card.easeFactor - 0.2) : (ratingNum === 2 ? Math.max(1.3, card.easeFactor - 0.15) : (ratingNum === 4 ? card.easeFactor + 0.15 : card.easeFactor));
                state.recordReview(id, ratingNum, Math.round(interval), easeFactor);
              }
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
          const targetDate = Date.now() + days * 24 * 60 * 60 * 1000;
          const idSet = new Set(cardIds);
          set({
            cards: state.cards.map(c =>
              idSet.has(c.id)
                ? {
                    ...c,
                    repetition: c.repetition + 1,
                    interval: days,
                    nextReviewDate: targetDate,
                  }
                : c
            )
          });
        },

        recordReview: (cardId, rating, interval, easeFactor) => {
          const state = get();
          const card = state.cards.find(c => c.id === cardId);
          if (!card) return;

          const nextReviewDate = Date.now() + interval * 60 * 1000;
          const newRepetition = rating >= 3 ? card.repetition + 1 : 0;

          const reviewLogItem: ReviewLog = {
            id: 'rev-' + Math.random().toString(36).substring(2, 9),
            cardId,
            deckId: card.deckId,
            rating,
            reviewDate: Date.now(),
            interval,
            easeFactor,
          };

          set({
            cards: state.cards.map(c =>
              c.id === cardId
                ? {
                    ...c,
                    repetition: newRepetition,
                    interval,
                    easeFactor,
                    nextReviewDate,
                  }
                : c
            ),
            reviewHistory: [reviewLogItem, ...state.reviewHistory],
            reviewLog: [reviewLogItem, ...state.reviewLog],
          });
        },

        importApkgCards: (deckName, importedCards) => {
          const state = get();
          let deck = state.decks.find(d => d.name.toLowerCase() === deckName.toLowerCase());
          let deckId = deck?.id;
          if (!deckId) {
            deckId = 'deck-' + Math.random().toString(36).substring(2, 9);
            state.decks.push({ id: deckId, name: deckName, parentId: null, settings: {} });
          }

          const newCards: Flashcard[] = importedCards.map(c => ({
            id: 'card-' + Math.random().toString(36).substring(2, 9),
            deckId: deckId!,
            front: c.front,
            back: c.back,
            details: '',
            tags: c.tags || [],
            flag: '',
            repetition: 0,
            interval: 0,
            easeFactor: 2.5,
            nextReviewDate: Date.now(),
            createdAt: Date.now(),
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
      }),
      {
        name: 'cardblocks-storage',
      }
    ),
    {
      limit: 100,
    }
  )
);
