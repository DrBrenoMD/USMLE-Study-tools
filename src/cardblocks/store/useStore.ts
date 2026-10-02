import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { temporal } from 'zundo';
import localforage from 'localforage';
import { format } from 'date-fns';

export const cardblocksDataStore = localforage.createInstance({
  name: 'cardblocks_data'
});

export interface Deck {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
  icon?: string;
  color?: string;
  order?: number;
  settings?: any;
  createdAt?: number;
  isOffline?: boolean;
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
  associatedQuestionIds?: string[];
  associatedNoteIds?: string[];

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
  associatedNoteIds?: string[];
  isFlagged?: boolean;
  isFromExtension?: boolean;
  source?: 'extension' | 'qbank' | 'manual';
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

// ==========================================
// MÓDULO DE CADERNOS DE ESTUDO & NOTAS (NOTION-LIKE)
// Hierarquia: Área (obrigatória) -> Sistema -> Matéria -> Tema -> Notas
// ==========================================

export interface NotebookArea {
  id: string;
  notebookId?: string;
  name: string; // Ex: Pediatria, Ginecologia e Obstetrícia, Clínica Médica, Cirurgia, Preventiva
  color: string; // Cor identificadora da área (Hex / Tailwind color)
  description?: string;
  order: number;
  createdAt: number;
}

export interface NotebookSystem {
  id: string;
  areaId: string;
  name: string; // Ex: Cardiovascular, Respiratório, Gastrointestinal, Neonatologia
  order: number;
  createdAt: number;
}

export interface NotebookSubject {
  id: string;
  areaId: string;
  systemId?: string | null;
  name: string; // Ex: Farmacologia, Fisiologia, Patologia, Semiologia
  order: number;
  createdAt: number;
}

export interface NotebookTopic {
  id: string;
  areaId: string;
  systemId?: string | null;
  subjectId?: string | null;
  name: string; // Ex: Insuficiência Cardíaca, Asma, Choque Séptico, Pré-eclâmpsia
  order: number;
  createdAt: number;
}

export interface NoteMediaItem {
  id: string;
  type: 'video' | 'audio' | 'image' | 'code_sandbox';
  url?: string;
  title?: string;
  caption?: string;
  audioBlobUrl?: string;
  codeHtml?: string;
  codeCss?: string;
  codeJs?: string;
  createdAt?: number;
}

export interface StudyNote {
  id: string;
  notebookId: string;
  areaId: string; // Obrigatória
  systemId?: string | null; // Opcional
  subjectId?: string | null; // Opcional
  topicId?: string | null; // Opcional
  title: string;
  content: string; // Rich Text / HTML / Markdown
  icon?: string;
  coverImage?: string;
  order: number;
  isPinned?: boolean;
  color?: string;
  tags?: string[];
  associatedQuestionIds?: string[]; // IDs/QIDs de questões associadas
  associatedCardIds?: string[]; // IDs de flashcards associados
  embeddedFlashcardIds?: string[]; // Flashcards embutidos diretamente para visualização/flip na nota
  mediaItems?: NoteMediaItem[];
  lastReviewedAt?: number; // Timestamp da última revisão da nota
  createdAt: number;
  updatedAt: number;
}

export interface StudyNotebook {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  coverColor?: string;
  createdAt: number;
  updatedAt: number;
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

// ==========================================
// MÓDULO MESA DE ESTUDOS (STUDY DESK)
// ==========================================
export interface StudyDeskQuestionRecord {
  qid: string;
  questionId?: string;
  selectedChoiceId?: string;
  correctChoiceId?: string;
  isCorrect: boolean;
  resolutionTimeSeconds: number;
  reviewTimeSeconds: number;
  subject?: string;
  system?: string;
  isFromExtension?: boolean;
  answeredAt: number;
}

export interface StudyDeskSession {
  id: string;
  name: string;
  bankId?: string;
  startedAt: number;
  endedAt?: number;
  totalQuestions: number;
  completedQuestions: number;
  correctCount: number;
  incorrectCount: number;
  totalResolutionTimeSeconds: number;
  totalReviewTimeSeconds: number;
  targetResolutionTimeSeconds: number;
  targetReviewTimeSeconds: number;
  questionRecords: StudyDeskQuestionRecord[];
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
  
  // Módulo Cadernos de Estudo
  studyNotebooks: StudyNotebook[];
  notebookAreas: NotebookArea[];
  notebookSystems: NotebookSystem[];
  notebookSubjects: NotebookSubject[];
  notebookTopics: NotebookTopic[];
  studyNotes: StudyNote[];

  // Módulo Mesa de Estudos (Study Desk)
  studyDeskSessions: StudyDeskSession[];
  activeDeskSessionId: string | null;

  settings: Settings;

  // Deck Actions
  createDeck: (name: string, parentId?: string | null, isOffline?: boolean, description?: string) => string;
  updateDeck: (id: string, updates: Partial<Deck>) => void;
  deleteDeck: (id: string) => void;
  moveDeck: (deckId: string, targetParentId: string | null) => void;
  updateDeckSettings: (deckId: string, settings: any) => void;
  toggleDeckOffline: (deckId: string) => void;
  setDeckOffline: (deckId: string, isOffline: boolean) => void;
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
  resetExtensionStats: () => void;
  resetSubjectStats: (subject: string) => void;
  resetSystemStats: (system: string) => void;
  resetDateStats: (dateStr: string) => void;
  resetStatusStats: (status: 'correct' | 'incorrect') => void;
  resetPerformanceTimes: () => void;
  resetStudyDeskSessions: () => void;
  resetManualStudyLogs: () => void;
  resetChronologicalStats: () => void;
  resetAllQuestionStats: () => void;
  updateQuestionNotes: (questionId: string, notes: string) => void;
  toggleQuestionFlag: (questionId: string) => void;

  // Legacy Notebook Actions
  createNotebook: (name: string, questionIds: string[], description?: string, timeLimitPerQuestion?: number, mode?: 'exam' | 'tutor') => string;
  deleteNotebook: (id: string) => void;
  addNotebookHistory: (history: any) => void;
  recordNotebookHistory: (notebookId: string, results: Record<string, boolean>, answers?: Record<string, string>) => void;

  // Legacy Note Actions
  createNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateNote: (id: string, content: string) => void;
  deleteNote: (id: string) => void;

  // Study Notebooks Actions (Novo Módulo Notion-like)
  createStudyNotebook: (name: string, description?: string, icon?: string, coverColor?: string) => string;
  updateStudyNotebook: (id: string, updates: Partial<StudyNotebook>) => void;
  deleteStudyNotebook: (id: string) => void;

  createNotebookArea: (name: string, color: string, notebookId?: string, description?: string) => string;
  updateNotebookArea: (id: string, updates: Partial<NotebookArea>) => void;
  deleteNotebookArea: (id: string) => void;
  reorderNotebookAreas: (areaIds: string[]) => void;

  createNotebookSystem: (areaId: string, name: string) => string;
  updateNotebookSystem: (id: string, updates: Partial<NotebookSystem>) => void;
  deleteNotebookSystem: (id: string) => void;

  createNotebookSubject: (areaId: string, name: string, systemId?: string | null) => string;
  updateNotebookSubject: (id: string, updates: Partial<NotebookSubject>) => void;
  deleteNotebookSubject: (id: string) => void;

  createNotebookTopic: (areaId: string, name: string, systemId?: string | null, subjectId?: string | null) => string;
  updateNotebookTopic: (id: string, updates: Partial<NotebookTopic>) => void;
  deleteNotebookTopic: (id: string) => void;

  createStudyNote: (noteData: Partial<StudyNote>) => string;
  updateStudyNote: (id: string, updates: Partial<StudyNote>) => void;
  deleteStudyNote: (id: string) => void;
  reorderStudyNotes: (noteIds: string[]) => void;
  moveStudyNote: (noteId: string, target: { areaId: string; systemId?: string | null; subjectId?: string | null; topicId?: string | null }) => void;
  markStudyNoteReviewed: (noteId: string) => void;

  // Associações Bidirecionais: Notas <-> Questões <-> Flashcards
  associateQuestionToNote: (noteId: string, questionId: string) => void;
  dissociateQuestionFromNote: (noteId: string, questionId: string) => void;
  associateCardToNote: (noteId: string, cardId: string) => void;
  dissociateCardFromNote: (noteId: string, cardId: string) => void;
  createCardFromStudyNote: (noteId: string, targetDeckId?: string) => string;
  addFlashcardAsNote: (cardId: string, areaId: string, systemId?: string | null, customTitle?: string) => string;
  createNoteFromQuestion: (questionData: any, areaId?: string, customTitle?: string) => string;

  // Study Desk Actions
  startDeskSession: (sessionData?: Partial<StudyDeskSession>) => string;
  recordDeskQuestionAnswer: (data: { qid: string; questionId?: string; selectedChoiceId?: string; correctChoiceId?: string; isCorrect: boolean; resolutionTimeSeconds: number; reviewTimeSeconds: number; subject?: string; system?: string }) => void;
  finishDeskSession: (sessionId?: string) => void;
  deleteDeskSession: (sessionId: string) => void;
  setActiveDeskSessionId: (sessionId: string | null) => void;
  deleteQuestionRecordsForDate: (dateStr: string) => void;
  resetSingleQuestionResolution: (questionId: string) => void;

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

        // Módulo Cadernos de Estudo (Notion-like) - Seed Inicial Rico
        studyNotebooks: [
          {
            id: 'nb-principal',
            name: 'Caderno de Estudos Geral',
            description: 'Anotações estruturadas por Área, Sistema, Matéria e Tema com Flashcards e Questões vinculadas',
            icon: '📚',
            coverColor: '#3b82f6',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ],
        notebookAreas: [
          {
            id: 'area-clinica',
            notebookId: 'nb-principal',
            name: 'Clínica Médica',
            color: '#3b82f6', // Blue
            description: 'Cardiologia, Pneumologia, Nefrologia, Gastro, Reumato, Infecto',
            order: 0,
            createdAt: Date.now()
          },
          {
            id: 'area-pediatria',
            notebookId: 'nb-principal',
            name: 'Pediatria',
            color: '#10b981', // Emerald
            description: 'Puericultura, Neonatologia, Infectologia Pediátrica, Emergências',
            order: 1,
            createdAt: Date.now()
          },
          {
            id: 'area-go',
            notebookId: 'nb-principal',
            name: 'Ginecologia e Obstetrícia',
            color: '#ec4899', // Pink
            description: 'Obstetrícia Geral, Alto Risco, Mastologia, Ginecologia Endócrina',
            order: 2,
            createdAt: Date.now()
          },
          {
            id: 'area-cirurgia',
            notebookId: 'nb-principal',
            name: 'Cirurgia Geral',
            color: '#f59e0b', // Amber
            description: 'Trauma, Abdome Agudo, Pré e Pós-operatório, Urologia',
            order: 3,
            createdAt: Date.now()
          },
          {
            id: 'area-preventiva',
            notebookId: 'nb-principal',
            name: 'Medicina Preventiva & SUS',
            color: '#8b5cf6', // Violet
            description: 'Epidemiologia, Bioestatística, Atenção Básica, SUS, Ética',
            order: 4,
            createdAt: Date.now()
          }
        ],
        notebookSystems: [
          { id: 'sys-cardio', areaId: 'area-clinica', name: 'Cardiovascular', order: 0, createdAt: Date.now() },
          { id: 'sys-pneumo', areaId: 'area-clinica', name: 'Respiratório', order: 1, createdAt: Date.now() },
          { id: 'sys-gastro', areaId: 'area-clinica', name: 'Gastrointestinal', order: 2, createdAt: Date.now() },
          { id: 'sys-neonat', areaId: 'area-pediatria', name: 'Neonatologia', order: 0, createdAt: Date.now() },
          { id: 'sys-obstetricia', areaId: 'area-go', name: 'Obstetrícia', order: 0, createdAt: Date.now() },
          { id: 'sys-trauma', areaId: 'area-cirurgia', name: 'Trauma & Urgências', order: 0, createdAt: Date.now() }
        ],
        notebookSubjects: [
          { id: 'subj-farmaco-cardio', areaId: 'area-clinica', systemId: 'sys-cardio', name: 'Farmacologia Cardíaca', order: 0, createdAt: Date.now() },
          { id: 'subj-valvopatias', areaId: 'area-clinica', systemId: 'sys-cardio', name: 'Valvopatias & Miocárdio', order: 1, createdAt: Date.now() }
        ],
        notebookTopics: [
          { id: 'topic-icfer', areaId: 'area-clinica', systemId: 'sys-cardio', subjectId: 'subj-farmaco-cardio', name: 'Insuficiência Cardíaca (ICFEr)', order: 0, createdAt: Date.now() },
          { id: 'topic-est-aortica', areaId: 'area-clinica', systemId: 'sys-cardio', subjectId: 'subj-valvopatias', name: 'Estenose Aórtica', order: 1, createdAt: Date.now() }
        ],
        studyNotes: [
          {
            id: 'note-sample-ic',
            notebookId: 'nb-principal',
            areaId: 'area-clinica',
            systemId: 'sys-cardio',
            subjectId: 'subj-farmaco-cardio',
            topicId: 'topic-icfer',
            title: 'Manejo Farmacológico da ICFEr (Quádrupla Terapia)',
            content: `<h3>Quádrupla Terapia Baseada em Evidências (Redução de Mortalidade):</h3>
<p>Os 4 pilares fundamentais para o tratamento da Insuficiência Cardíaca com Fração de Ejeção Reduzida (ICFEr, FE &le; 40%):</p>
<ol>
  <li><b>iSGLT2 (Dapagliflozina ou Empagliflozina):</b> reduz hospitalização e morte cardiovascular independente do status de diabetes.</li>
  <li><b>iECA / BRA / INRA (Sacubitril/Valsartana):</b> vasodilatação, inibição neuro-humoral e aumento de peptídeos natriuréticos.</li>
  <li><b>Beta-bloqueadores (Carvedilol, Succinato de Metoprolol, Bisoprolol):</b> proteção miocárdica contra toxicidade adrenérgica.</li>
  <li><b>Antagonista do Receptor Mineralocorticoide (Espironolactona / Eplerenona):</b> bloqueio da aldosterona e redução de fibrose.</li>
</ol>
<blockquote><p><b>Dica High-Yield:</b> Iniciar os 4 pilares precocemente em doses baixas e titular a cada 2 a 4 semanas.</p></blockquote>`,
            icon: '❤️',
            order: 0,
            isPinned: true,
            tags: ['cardio', 'icfer', 'farmacologia', 'high-yield'],
            associatedCardIds: ['card-1'],
            associatedQuestionIds: [],
            embeddedFlashcardIds: ['card-1'],
            mediaItems: [],
            createdAt: Date.now() - 3600000,
            updatedAt: Date.now()
          }
        ],

        studyDeskSessions: [],
        activeDeskSessionId: null,

        settings: DEFAULT_SETTINGS,

        createDeck: (name, parentId = null, isOffline = false, description = '') => {
          const id = 'deck-' + Math.random().toString(36).substring(2, 9);
          set(state => ({
            decks: [...state.decks, { id, name, parentId, isOffline: Boolean(isOffline), description: description || undefined, createdAt: Date.now(), settings: {} }]
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

        toggleDeckOffline: (deckId) => {
          set(state => ({
            decks: state.decks.map(d => d.id === deckId ? { ...d, isOffline: !d.isOffline } : d)
          }));
        },

        setDeckOffline: (deckId, isOffline) => {
          set(state => ({
            decks: state.decks.map(d => d.id === deckId ? { ...d, isOffline } : d)
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
                parentId: targetParentId !== undefined ? targetParentId : data.deck.parentId,
                isOffline: true, // Baralhos importados iniciam offline por padrão
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

            // Atualiza lastReviewedAt das notas associadas aos cards revisados (sem alterar agendamento SRS)
            const updatedStudyNotes = state.studyNotes.map(n => {
              if (n.associatedCardIds?.some(cid => idSet.has(cid)) || n.embeddedFlashcardIds?.some(cid => idSet.has(cid))) {
                return { ...n, lastReviewedAt: now };
              }
              return n;
            });

            set({
              cards: updatedCards,
              studyNotes: updatedStudyNotes,
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

          // Atualiza lastReviewedAt das notas associadas aos cards revisados
          const updatedStudyNotes = state.studyNotes.map(n => {
            if (n.associatedCardIds?.some(cid => idSet.has(cid)) || n.embeddedFlashcardIds?.some(cid => idSet.has(cid))) {
              return { ...n, lastReviewedAt: now };
            }
            return n;
          });

          set({
            cards: updatedCards,
            studyNotes: updatedStudyNotes,
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
          const now = Date.now();

          const reviewLogItem: ReviewLog = {
            id: 'rev-' + Math.random().toString(36).substring(2, 9),
            cardId,
            deckId: card.deckId,
            rating,
            reviewDate: now,
            interval: intervalDays,
            easeFactor,
          };

          const updatedStudyNotes = state.studyNotes.map(n => {
            if (n.associatedCardIds?.includes(cardId) || n.embeddedFlashcardIds?.includes(cardId)) {
              return { ...n, lastReviewedAt: now };
            }
            return n;
          });

          set({
            cards: state.cards.map(c =>
              c.id === cardId
                ? {
                    ...c,
                    repetition: newRepetition,
                    interval: intervalDays,
                    easeFactor: Number(easeFactor.toFixed(2)),
                    nextReviewDate,
                  }
                : c
            ),
            studyNotes: updatedStudyNotes,
            reviewHistory: [...state.reviewHistory, reviewLogItem],
            reviewLog: [...state.reviewLog, reviewLogItem],
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
            state.decks.push({ id: targetDeckId, name: deckIdOrName, parentId: null, isOffline: true, settings: {} });
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
              isFromExtension: qData.isFromExtension !== undefined ? qData.isFromExtension : current.isFromExtension,
              source: qData.source || current.source,
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
              isFromExtension: qData.isFromExtension ?? false,
              source: qData.source || (qData.isFromExtension ? 'extension' : 'manual'),
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
          const now = Date.now();
          set(state => {
            const updatedQuestions = state.questions.map(q => {
              if (q.id !== questionId && q.qid !== questionId) return q;

              const attempts = q.attempts || [];
              const newAttempt: QuestionAttempt = {
                timestamp: now,
                selectedChoiceId,
                isCorrect,
                resolutionTimeSeconds: Math.max(1, Math.round(resolutionTimeSeconds || 0)),
                reviewTimeSeconds: Math.max(0, Math.round(reviewTimeSeconds || 0)),
              };

              return {
                ...q,
                status: isCorrect ? ('correct' as const) : ('incorrect' as const),
                selectedChoiceId,
                resolutionTimeSeconds: (q.resolutionTimeSeconds || 0) + newAttempt.resolutionTimeSeconds,
                reviewTimeSeconds: (q.reviewTimeSeconds || 0) + newAttempt.reviewTimeSeconds,
                attempts: [...attempts, newAttempt],
                lastAnsweredAt: now,
                updatedAt: now,
              };
            });

            // Atualiza lastReviewedAt das notas associadas à questão (sem interferir no agendamento dos flashcards)
            const updatedStudyNotes = state.studyNotes.map(n => {
              if (n.associatedQuestionIds?.includes(questionId)) {
                return { ...n, lastReviewedAt: now };
              }
              const matchedQ = state.questions.find(q => q.id === questionId || q.qid === questionId);
              if (matchedQ?.qid && n.associatedQuestionIds?.includes(matchedQ.qid)) {
                return { ...n, lastReviewedAt: now };
              }
              return n;
            });

            return {
              questions: updatedQuestions,
              studyNotes: updatedStudyNotes
            };
          });
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
            }),
            studyDeskSessions: (state.studyDeskSessions || []).map(s => ({
              ...s,
              questionRecords: (s.questionRecords || []).filter(r => {
                const matchedQ = state.questions.find(q => q.qid === r.qid || q.id === r.questionId);
                return matchedQ ? matchedQ.bankId !== bankId : true;
              }),
            }))
          }));
        },

        resetExtensionStats: () => {
          set(state => ({
            questions: state.questions.map(q => {
              const isExt = q.isFromExtension || q.source === 'extension' || q.tags?.some(t => t.includes('extensao') || t.includes('extension') || t.startsWith('qid:'));
              if (!isExt) return q;
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
            }),
            studyDeskSessions: (state.studyDeskSessions || []).map(s => ({
              ...s,
              questionRecords: (s.questionRecords || []).filter(r => !r.isFromExtension && !r.qid?.startsWith('q-') && !r.qid?.startsWith('sample-')),
            }))
          }));
        },

        resetSubjectStats: (subjectName) => {
          set(state => ({
            questions: state.questions.map(q => {
              if ((q.subject || '').trim().toLowerCase() !== subjectName.trim().toLowerCase()) return q;
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
            }),
            studyDeskSessions: (state.studyDeskSessions || []).map(s => ({
              ...s,
              questionRecords: (s.questionRecords || []).filter(r => (r.subject || '').trim().toLowerCase() !== subjectName.trim().toLowerCase()),
            }))
          }));
        },

        resetSystemStats: (systemName) => {
          set(state => ({
            questions: state.questions.map(q => {
              if ((q.system || '').trim().toLowerCase() !== systemName.trim().toLowerCase()) return q;
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
            }),
            studyDeskSessions: (state.studyDeskSessions || []).map(s => ({
              ...s,
              questionRecords: (s.questionRecords || []).filter(r => (r.system || '').trim().toLowerCase() !== systemName.trim().toLowerCase()),
            }))
          }));
        },

        resetDateStats: (dateStr) => {
          get().deleteQuestionRecordsForDate(dateStr);
        },

        resetStatusStats: (targetStatus) => {
          set(state => ({
            questions: state.questions.map(q => {
              if (q.status !== targetStatus) return q;
              return {
                ...q,
                status: 'unused' as const,
                selectedChoiceId: undefined,
                resolutionTimeSeconds: 0,
                reviewTimeSeconds: 0,
                attempts: [],
                lastAnsweredAt: undefined,
                updatedAt: Date.now(),
              };
            }),
            studyDeskSessions: (state.studyDeskSessions || []).map(s => {
              const remaining = (s.questionRecords || []).filter(r => (targetStatus === 'correct' ? !r.isCorrect : r.isCorrect));
              const correctCount = remaining.filter(r => r.isCorrect).length;
              return {
                ...s,
                completedQuestions: remaining.length,
                correctCount,
                incorrectCount: remaining.length - correctCount,
                questionRecords: remaining,
              };
            })
          }));
        },

        resetPerformanceTimes: () => {
          set(state => ({
            questions: state.questions.map(q => ({
              ...q,
              resolutionTimeSeconds: 0,
              reviewTimeSeconds: 0,
              attempts: (q.attempts || []).map(a => ({ ...a, resolutionTimeSeconds: 0, reviewTimeSeconds: 0 })),
              updatedAt: Date.now()
            })),
            studyDeskSessions: (state.studyDeskSessions || []).map(s => ({
              ...s,
              totalResolutionTimeSeconds: 0,
              totalReviewTimeSeconds: 0,
              questionRecords: (s.questionRecords || []).map(r => ({ ...r, resolutionTimeSeconds: 0, reviewTimeSeconds: 0 }))
            }))
          }));
        },

        resetStudyDeskSessions: () => {
          set({ studyDeskSessions: [], activeDeskSessionId: null });
        },

        resetManualStudyLogs: () => {
          try {
            localStorage.removeItem('usmle_study_logs_v4');
            window.dispatchEvent(new Event('usmle_logs_updated'));
          } catch(e) {}
        },

        resetChronologicalStats: () => {
          set(state => ({
            questions: state.questions.map(q => ({
              ...q,
              status: 'unused' as const,
              selectedChoiceId: undefined,
              resolutionTimeSeconds: 0,
              reviewTimeSeconds: 0,
              attempts: [],
              lastAnsweredAt: undefined,
              updatedAt: Date.now()
            })),
            studyDeskSessions: []
          }));
          try {
            localStorage.removeItem('usmle_study_logs_v4');
            window.dispatchEvent(new Event('usmle_logs_updated'));
          } catch(e) {}
        },

        resetAllQuestionStats: () => {
          set(state => ({
            questions: state.questions.map(q => ({
              ...q,
              status: 'unused' as const,
              selectedChoiceId: undefined,
              resolutionTimeSeconds: 0,
              reviewTimeSeconds: 0,
              attempts: [],
              lastAnsweredAt: undefined,
              updatedAt: Date.now()
            })),
            studyDeskSessions: []
          }));
          try {
            localStorage.removeItem('usmle_study_logs_v4');
            window.dispatchEvent(new Event('usmle_logs_updated'));
          } catch(e) {}
        },

        deleteQuestionRecordsForDate: (dateStr) => {
          set(state => {
            const updatedQuestions = state.questions.map(q => {
              const qAnswerDate = q.lastAnsweredAt ? format(new Date(q.lastAnsweredAt), 'yyyy-MM-dd') : null;
              const hasAttemptsOnDate = (q.attempts || []).some(att => att.timestamp && format(new Date(att.timestamp), 'yyyy-MM-dd') === dateStr);
              
              if (qAnswerDate !== dateStr && !hasAttemptsOnDate) {
                return q;
              }

              const remainingAttempts = (q.attempts || []).filter(att => {
                if (!att.timestamp) return false;
                return format(new Date(att.timestamp), 'yyyy-MM-dd') !== dateStr;
              });

              if (remainingAttempts.length === 0) {
                return {
                  ...q,
                  status: 'unused' as const,
                  selectedChoiceId: undefined,
                  resolutionTimeSeconds: 0,
                  reviewTimeSeconds: 0,
                  attempts: [],
                  lastAnsweredAt: undefined,
                  updatedAt: Date.now(),
                };
              } else {
                const lastAtt = remainingAttempts[remainingAttempts.length - 1];
                return {
                  ...q,
                  status: lastAtt.isCorrect ? ('correct' as const) : ('incorrect' as const),
                  selectedChoiceId: lastAtt.selectedChoiceId,
                  resolutionTimeSeconds: lastAtt.resolutionTimeSeconds || 60,
                  reviewTimeSeconds: lastAtt.reviewTimeSeconds || 90,
                  attempts: remainingAttempts,
                  lastAnsweredAt: lastAtt.timestamp,
                  updatedAt: Date.now(),
                };
              }
            });

            const updatedSessions = (state.studyDeskSessions || []).map(s => {
              const remainingRecords = (s.questionRecords || []).filter(r => {
                const rDate = r.answeredAt ? format(new Date(r.answeredAt), 'yyyy-MM-dd') : format(new Date(s.startedAt), 'yyyy-MM-dd');
                return rDate !== dateStr;
              });
              const correctCount = remainingRecords.filter(r => r.isCorrect).length;
              return {
                ...s,
                completedQuestions: remainingRecords.length,
                correctCount,
                incorrectCount: remainingRecords.length - correctCount,
                questionRecords: remainingRecords,
              };
            });

            // Limpa logs do heatmap para a data informada
            try {
              const savedLogsStr = localStorage.getItem('usmle_study_logs_v4');
              if (savedLogsStr) {
                const logs: any[] = JSON.parse(savedLogsStr);
                const filteredLogs = logs.filter(l => l.date !== dateStr);
                localStorage.setItem('usmle_study_logs_v4', JSON.stringify(filteredLogs));
                window.dispatchEvent(new Event('usmle_logs_updated'));
              }
            } catch (e) {}

            return {
              questions: updatedQuestions,
              studyDeskSessions: updatedSessions,
            };
          });
        },

        resetSingleQuestionResolution: (questionId) => {
          set(state => {
            const targetQ = state.questions.find(q => q.id === questionId || q.qid === questionId);
            const targetDateStr = targetQ?.lastAnsweredAt ? format(new Date(targetQ.lastAnsweredAt), 'yyyy-MM-dd') : null;
            const qKey = targetQ?.qid || targetQ?.id || questionId;

            const updatedQuestions = state.questions.map(q => {
              if (q.id !== questionId && q.qid !== questionId) return q;
              return {
                ...q,
                status: 'unused' as const,
                selectedChoiceId: undefined,
                resolutionTimeSeconds: 0,
                reviewTimeSeconds: 0,
                attempts: [],
                lastAnsweredAt: undefined,
                updatedAt: Date.now(),
              };
            });

            const updatedSessions = (state.studyDeskSessions || []).map(s => {
              const remainingRecords = (s.questionRecords || []).filter(r => r.qid !== qKey && r.questionId !== questionId);
              const correctCount = remainingRecords.filter(r => r.isCorrect).length;
              return {
                ...s,
                completedQuestions: remainingRecords.length,
                correctCount,
                incorrectCount: remainingRecords.length - correctCount,
                questionRecords: remainingRecords,
              };
            });

            // Ajusta logs do heatmap se necessário
            if (targetDateStr) {
              try {
                const savedLogsStr = localStorage.getItem('usmle_study_logs_v4');
                if (savedLogsStr) {
                  const logs: any[] = JSON.parse(savedLogsStr);
                  const updatedLogs = logs.map(l => {
                    if (l.date === targetDateStr && l.questionIds?.includes(qKey)) {
                      const newQids = l.questionIds.filter((id: string) => id !== qKey);
                      return {
                        ...l,
                        amount: Math.max(0, newQids.length),
                        questionIds: newQids,
                      };
                    }
                    return l;
                  }).filter(l => l.amount > 0 || l.minutesSpent > 0);
                  localStorage.setItem('usmle_study_logs_v4', JSON.stringify(updatedLogs));
                  window.dispatchEvent(new Event('usmle_logs_updated'));
                }
              } catch (e) {}
            }

            return {
              questions: updatedQuestions,
              studyDeskSessions: updatedSessions,
            };
          });
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

        // ==========================================
        // IMPLEMENTAÇÃO DO MÓDULO CADERNOS DE ESTUDO (NOTION-LIKE)
        // ==========================================

        createStudyNotebook: (name, description = '', icon = '📚', coverColor = '#3b82f6') => {
          const id = 'nb-' + Math.random().toString(36).substring(2, 9);
          const newNb: StudyNotebook = {
            id,
            name,
            description,
            icon,
            coverColor,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          set(state => ({ studyNotebooks: [...state.studyNotebooks, newNb] }));
          return id;
        },

        updateStudyNotebook: (id, updates) => {
          set(state => ({
            studyNotebooks: state.studyNotebooks.map(nb => nb.id === id ? { ...nb, ...updates, updatedAt: Date.now() } : nb)
          }));
        },

        deleteStudyNotebook: (id) => {
          set(state => ({
            studyNotebooks: state.studyNotebooks.filter(nb => nb.id !== id),
            notebookAreas: state.notebookAreas.filter(a => a.notebookId !== id),
            studyNotes: state.studyNotes.filter(n => n.notebookId !== id)
          }));
        },

        createNotebookArea: (name, color = '#3b82f6', notebookId = 'nb-principal', description = '') => {
          const id = 'area-' + Math.random().toString(36).substring(2, 9);
          const currentAreas = get().notebookAreas || [];
          const newArea: NotebookArea = {
            id,
            notebookId,
            name,
            color,
            description,
            order: currentAreas.length,
            createdAt: Date.now()
          };
          set(state => ({ notebookAreas: [...state.notebookAreas, newArea] }));
          return id;
        },

        updateNotebookArea: (id, updates) => {
          set(state => ({
            notebookAreas: state.notebookAreas.map(a => a.id === id ? { ...a, ...updates } : a)
          }));
        },

        deleteNotebookArea: (id) => {
          set(state => ({
            notebookAreas: state.notebookAreas.filter(a => a.id !== id),
            notebookSystems: state.notebookSystems.filter(s => s.areaId !== id),
            notebookSubjects: state.notebookSubjects.filter(sub => sub.areaId !== id),
            notebookTopics: state.notebookTopics.filter(t => t.areaId !== id),
            studyNotes: state.studyNotes.filter(n => n.areaId !== id)
          }));
        },

        reorderNotebookAreas: (areaIds) => {
          set(state => {
            const areaMap = new Map(state.notebookAreas.map(a => [a.id, a]));
            const reordered: NotebookArea[] = [];
            areaIds.forEach((id, idx) => {
              const a = areaMap.get(id);
              if (a) reordered.push({ ...a, order: idx });
            });
            // Adiciona áreas que não estavam no array
            state.notebookAreas.forEach(a => {
              if (!areaIds.includes(a.id)) reordered.push(a);
            });
            return { notebookAreas: reordered };
          });
        },

        createNotebookSystem: (areaId, name) => {
          const id = 'sys-' + Math.random().toString(36).substring(2, 9);
          const currentSystems = (get().notebookSystems || []).filter(s => s.areaId === areaId);
          const newSys: NotebookSystem = {
            id,
            areaId,
            name,
            order: currentSystems.length,
            createdAt: Date.now()
          };
          set(state => ({ notebookSystems: [...state.notebookSystems, newSys] }));
          return id;
        },

        updateNotebookSystem: (id, updates) => {
          set(state => ({
            notebookSystems: state.notebookSystems.map(s => s.id === id ? { ...s, ...updates } : s)
          }));
        },

        deleteNotebookSystem: (id) => {
          set(state => ({
            notebookSystems: state.notebookSystems.filter(s => s.id !== id),
            notebookSubjects: state.notebookSubjects.filter(sub => sub.systemId !== id),
            notebookTopics: state.notebookTopics.filter(t => t.systemId !== id),
            studyNotes: state.studyNotes.map(n => n.systemId === id ? { ...n, systemId: null, topicId: null } : n)
          }));
        },

        createNotebookSubject: (areaId, name, systemId = null) => {
          const id = 'subj-' + Math.random().toString(36).substring(2, 9);
          const currentSubjects = (get().notebookSubjects || []).filter(s => s.areaId === areaId);
          const newSubj: NotebookSubject = {
            id,
            areaId,
            systemId,
            name,
            order: currentSubjects.length,
            createdAt: Date.now()
          };
          set(state => ({ notebookSubjects: [...state.notebookSubjects, newSubj] }));
          return id;
        },

        updateNotebookSubject: (id, updates) => {
          set(state => ({
            notebookSubjects: state.notebookSubjects.map(s => s.id === id ? { ...s, ...updates } : s)
          }));
        },

        deleteNotebookSubject: (id) => {
          set(state => ({
            notebookSubjects: state.notebookSubjects.filter(s => s.id !== id),
            notebookTopics: state.notebookTopics.filter(t => t.subjectId !== id),
            studyNotes: state.studyNotes.map(n => n.subjectId === id ? { ...n, subjectId: null, topicId: null } : n)
          }));
        },

        createNotebookTopic: (areaId, name, systemId = null, subjectId = null) => {
          const id = 'topic-' + Math.random().toString(36).substring(2, 9);
          const currentTopics = (get().notebookTopics || []).filter(t => t.areaId === areaId);
          const newTopic: NotebookTopic = {
            id,
            areaId,
            systemId,
            subjectId,
            name,
            order: currentTopics.length,
            createdAt: Date.now()
          };
          set(state => ({ notebookTopics: [...state.notebookTopics, newTopic] }));
          return id;
        },

        updateNotebookTopic: (id, updates) => {
          set(state => ({
            notebookTopics: state.notebookTopics.map(t => t.id === id ? { ...t, ...updates } : t)
          }));
        },

        deleteNotebookTopic: (id) => {
          set(state => ({
            notebookTopics: state.notebookTopics.filter(t => t.id !== id),
            studyNotes: state.studyNotes.map(n => n.topicId === id ? { ...n, topicId: null } : n)
          }));
        },

        createStudyNote: (noteData) => {
          const id = 'snote-' + Math.random().toString(36).substring(2, 9);
          const state = get();
          let targetAreaId = noteData.areaId;
          if (!targetAreaId) {
            targetAreaId = state.notebookAreas[0]?.id || 'area-clinica';
          }
          const defaultNbId = state.studyNotebooks[0]?.id || 'nb-principal';

          const newNote: StudyNote = {
            id,
            notebookId: noteData.notebookId || defaultNbId,
            areaId: targetAreaId,
            systemId: noteData.systemId || null,
            subjectId: noteData.subjectId || null,
            topicId: noteData.topicId || null,
            title: noteData.title || 'Nova Nota de Estudo',
            content: noteData.content || '',
            icon: noteData.icon || '📝',
            coverImage: noteData.coverImage || undefined,
            order: state.studyNotes.length,
            isPinned: Boolean(noteData.isPinned),
            tags: noteData.tags || [],
            associatedQuestionIds: noteData.associatedQuestionIds || [],
            associatedCardIds: noteData.associatedCardIds || [],
            embeddedFlashcardIds: noteData.embeddedFlashcardIds || [],
            mediaItems: noteData.mediaItems || [],
            lastReviewedAt: noteData.lastReviewedAt || Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now()
          };

          // Sincroniza referências inversas nos flashcards e questões
          const updatedCards = state.cards.map(c => {
            if (newNote.associatedCardIds?.includes(c.id)) {
              const currentNotes = c.associatedNoteIds || [];
              if (!currentNotes.includes(id)) {
                return { ...c, associatedNoteIds: [...currentNotes, id] };
              }
            }
            return c;
          });

          const updatedQuestions = state.questions.map(q => {
            if (newNote.associatedQuestionIds?.includes(q.id) || (q.qid && newNote.associatedQuestionIds?.includes(q.qid))) {
              const currentNotes = q.associatedNoteIds || [];
              if (!currentNotes.includes(id)) {
                return { ...q, associatedNoteIds: [...currentNotes, id] };
              }
            }
            return q;
          });

          set({
            studyNotes: [newNote, ...state.studyNotes],
            cards: updatedCards,
            questions: updatedQuestions
          });
          return id;
        },

        updateStudyNote: (id, updates) => {
          set(state => {
            const currentNote = state.studyNotes.find(n => n.id === id);
            if (!currentNote) return state;

            const updatedNote: StudyNote = {
              ...currentNote,
              ...updates,
              updatedAt: Date.now()
            };

            // Atualiza referências inversas de flashcards se association mudou
            let updatedCards = state.cards;
            if (updates.associatedCardIds) {
              updatedCards = state.cards.map(c => {
                const isLinked = updates.associatedCardIds!.includes(c.id);
                const currentNotes = c.associatedNoteIds || [];
                if (isLinked && !currentNotes.includes(id)) {
                  return { ...c, associatedNoteIds: [...currentNotes, id] };
                } else if (!isLinked && currentNotes.includes(id)) {
                  return { ...c, associatedNoteIds: currentNotes.filter(nId => nId !== id) };
                }
                return c;
              });
            }

            // Atualiza referências inversas de questões se association mudou
            let updatedQuestions = state.questions;
            if (updates.associatedQuestionIds) {
              updatedQuestions = state.questions.map(q => {
                const isLinked = updates.associatedQuestionIds!.includes(q.id) || (q.qid && updates.associatedQuestionIds!.includes(q.qid));
                const currentNotes = q.associatedNoteIds || [];
                if (isLinked && !currentNotes.includes(id)) {
                  return { ...q, associatedNoteIds: [...currentNotes, id] };
                } else if (!isLinked && currentNotes.includes(id)) {
                  return { ...q, associatedNoteIds: currentNotes.filter(nId => nId !== id) };
                }
                return q;
              });
            }

            return {
              studyNotes: state.studyNotes.map(n => n.id === id ? updatedNote : n),
              cards: updatedCards,
              questions: updatedQuestions
            };
          });
        },

        deleteStudyNote: (id) => {
          set(state => ({
            studyNotes: state.studyNotes.filter(n => n.id !== id),
            cards: state.cards.map(c => c.associatedNoteIds?.includes(id) ? { ...c, associatedNoteIds: c.associatedNoteIds.filter(nId => nId !== id) } : c),
            questions: state.questions.map(q => q.associatedNoteIds?.includes(id) ? { ...q, associatedNoteIds: q.associatedNoteIds.filter(nId => nId !== id) } : q)
          }));
        },

        reorderStudyNotes: (noteIds) => {
          set(state => {
            const noteMap = new Map(state.studyNotes.map(n => [n.id, n]));
            const reordered: StudyNote[] = [];
            noteIds.forEach((id, idx) => {
              const n = noteMap.get(id);
              if (n) reordered.push({ ...n, order: idx });
            });
            state.studyNotes.forEach(n => {
              if (!noteIds.includes(n.id)) reordered.push(n);
            });
            return { studyNotes: reordered };
          });
        },

        moveStudyNote: (noteId, target) => {
          set(state => ({
            studyNotes: state.studyNotes.map(n => n.id === noteId ? {
              ...n,
              areaId: target.areaId,
              systemId: target.systemId !== undefined ? target.systemId : n.systemId,
              subjectId: target.subjectId !== undefined ? target.subjectId : n.subjectId,
              topicId: target.topicId !== undefined ? target.topicId : n.topicId,
              updatedAt: Date.now()
            } : n)
          }));
        },

        markStudyNoteReviewed: (noteId) => {
          const now = Date.now();
          set(state => ({
            studyNotes: state.studyNotes.map(n => n.id === noteId ? { ...n, lastReviewedAt: now } : n)
          }));
        },

        associateQuestionToNote: (noteId, questionId) => {
          set(state => {
            const note = state.studyNotes.find(n => n.id === noteId);
            if (!note) return state;

            const currentQIds = note.associatedQuestionIds || [];
            if (currentQIds.includes(questionId)) return state;

            const updatedNotes = state.studyNotes.map(n => n.id === noteId ? {
              ...n,
              associatedQuestionIds: [...currentQIds, questionId],
              updatedAt: Date.now()
            } : n);

            const updatedQuestions = state.questions.map(q => {
              if (q.id === questionId || q.qid === questionId) {
                const notes = q.associatedNoteIds || [];
                if (!notes.includes(noteId)) {
                  return { ...q, associatedNoteIds: [...notes, noteId] };
                }
              }
              return q;
            });

            return { studyNotes: updatedNotes, questions: updatedQuestions };
          });
        },

        dissociateQuestionFromNote: (noteId, questionId) => {
          set(state => ({
            studyNotes: state.studyNotes.map(n => n.id === noteId ? {
              ...n,
              associatedQuestionIds: (n.associatedQuestionIds || []).filter(qid => qid !== questionId),
              updatedAt: Date.now()
            } : n),
            questions: state.questions.map(q => {
              if (q.id === questionId || q.qid === questionId) {
                return { ...q, associatedNoteIds: (q.associatedNoteIds || []).filter(nId => nId !== noteId) };
              }
              return q;
            })
          }));
        },

        associateCardToNote: (noteId, cardId) => {
          set(state => {
            const note = state.studyNotes.find(n => n.id === noteId);
            if (!note) return state;

            const currentCardIds = note.associatedCardIds || [];
            if (currentCardIds.includes(cardId)) return state;

            const updatedNotes = state.studyNotes.map(n => n.id === noteId ? {
              ...n,
              associatedCardIds: [...currentCardIds, cardId],
              updatedAt: Date.now()
            } : n);

            const updatedCards = state.cards.map(c => {
              if (c.id === cardId) {
                const notes = c.associatedNoteIds || [];
                if (!notes.includes(noteId)) {
                  return { ...c, associatedNoteIds: [...notes, noteId] };
                }
              }
              return c;
            });

            return { studyNotes: updatedNotes, cards: updatedCards };
          });
        },

        dissociateCardFromNote: (noteId, cardId) => {
          set(state => ({
            studyNotes: state.studyNotes.map(n => n.id === noteId ? {
              ...n,
              associatedCardIds: (n.associatedCardIds || []).filter(cid => cid !== cardId),
              embeddedFlashcardIds: (n.embeddedFlashcardIds || []).filter(cid => cid !== cardId),
              updatedAt: Date.now()
            } : n),
            cards: state.cards.map(c => c.id === cardId ? {
              ...c,
              associatedNoteIds: (c.associatedNoteIds || []).filter(nId => nId !== noteId)
            } : c)
          }));
        },

        createCardFromStudyNote: (noteId, targetDeckId) => {
          const state = get();
          const note = state.studyNotes.find(n => n.id === noteId);
          if (!note) return '';

          const area = state.notebookAreas.find(a => a.id === note.areaId);
          const deckName = area ? `Caderno: ${area.name}` : 'Caderno de Estudos';
          
          let deckId = targetDeckId;
          if (!deckId) {
            const existingDeck = state.decks.find(d => d.name.toLowerCase() === deckName.toLowerCase());
            if (existingDeck) {
              deckId = existingDeck.id;
            } else {
              deckId = get().createDeck(deckName, null, false, `Flashcards gerados do caderno ${area?.name || ''}`);
            }
          }

          const cleanTitle = note.title.trim() || 'Nota de Estudo';
          const frontHtml = `<div class="font-bold text-base text-gray-900 dark:text-white">${cleanTitle}</div>`;
          const backHtml = `<div class="study-note-card-body leading-relaxed">${note.content || '<p>Sem conteúdo adicional.</p>'}</div>`;

          const cardTags = [
            ...(note.tags || []),
            'caderno',
            area ? area.name.toLowerCase().replace(/\s+/g, '-') : 'geral'
          ];

          const cardId = get().createCard(
            deckId,
            frontHtml,
            backHtml,
            `Gerado da nota "${cleanTitle}"`,
            cardTags
          );

          get().associateCardToNote(note.id, cardId);
          return cardId;
        },

        addFlashcardAsNote: (cardId, areaId, systemId = null, customTitle) => {
          const state = get();
          const card = state.cards.find(c => c.id === cardId);
          if (!card) return '';

          const targetArea = areaId || state.notebookAreas[0]?.id || 'area-clinica';
          const defaultNbId = state.studyNotebooks[0]?.id || 'nb-principal';
          const title = customTitle || card.front.replace(/<[^>]+>/g, '').trim().substring(0, 80) || 'Flashcard Nota';

          const content = `<h3>${card.front}</h3>
<hr/>
<div class="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60 my-3">
  <b>Resposta / Conteúdo:</b>
  ${card.back}
</div>
${card.details ? `<p><i>Detalhes adicionais:</i> ${card.details}</p>` : ''}`;

          const noteId = get().createStudyNote({
            notebookId: defaultNbId,
            areaId: targetArea,
            systemId,
            title,
            content,
            icon: '⚡',
            associatedCardIds: [cardId],
            embeddedFlashcardIds: [cardId],
            tags: card.tags || []
          });

          return noteId;
        },

        createNoteFromQuestion: (questionData, areaId, customTitle) => {
          const state = get();
          const defaultNbId = state.studyNotebooks[0]?.id || 'nb-principal';
          
          const qid = (questionData.qid || questionData.questionId || questionData.id || '').toString().trim();
          const existingQ = state.questions.find(q => q.qid === qid || q.id === qid);

          const rawSubj = (questionData.subject || existingQ?.subject || '').toString().trim();
          const rawSys = (questionData.system || existingQ?.system || '').toString().trim();

          // Se não foi fornecida uma área específica, utiliza o Subject da questão como área (encontra ou cria)
          let targetArea = areaId;
          if (!targetArea) {
            if (rawSubj && rawSubj.toLowerCase() !== 'geral' && rawSubj.toLowerCase() !== 'outros') {
              const found = state.notebookAreas.find(a => a.name.trim().toLowerCase() === rawSubj.toLowerCase());
              if (found) {
                targetArea = found.id;
              } else {
                targetArea = get().createNotebookArea(rawSubj, '#3b82f6', defaultNbId);
              }
            } else if (rawSubj) {
              const found = state.notebookAreas.find(a => a.name.trim().toLowerCase() === rawSubj.toLowerCase());
              if (found) {
                targetArea = found.id;
              } else {
                targetArea = get().createNotebookArea(rawSubj, '#3b82f6', defaultNbId);
              }
            } else {
              targetArea = state.notebookAreas[0]?.id || 'area-clinica';
            }
          }

          const stem = questionData.stem || questionData.text || questionData.questionStem || existingQ?.text || existingQ?.stem || '';
          const explanation = questionData.explanation || existingQ?.explanation || '';
          const objective = questionData.educationalObjective || (existingQ as any)?.educationalObjective || '';
          const title = customTitle || (stem ? stem.replace(/<[^>]+>/g, '').trim().substring(0, 85) + '...' : `Nota sobre Questão ${qid || 'Q-Bank'}`);

          let choicesHtml = '';
          const alternatives = (Array.isArray(questionData.alternatives) && questionData.alternatives.length > 0)
            ? questionData.alternatives
            : (existingQ?.alternatives || []);

          if (Array.isArray(alternatives) && alternatives.length > 0) {
            choicesHtml = `<div class="my-3 space-y-1.5 font-sans">${alternatives.map((a: any) => `
              <div class="p-2.5 rounded-lg border ${a.isCorrect ? 'bg-emerald-50 border-emerald-300 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200 font-bold' : 'bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-800/60 dark:border-gray-700 dark:text-gray-200'}">
                <b>${a.letter || ''}.</b> ${a.text} ${a.isCorrect ? ' <span class="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">[Gabarito Correto]</span>' : ''}
              </div>
            `).join('')}</div>`;
          }

          const content = `<h3>Enunciado da Questão ${qid ? `(QID: ${qid})` : ''}:</h3>
<div class="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 text-sm leading-relaxed my-3">
  ${stem || 'Questão importada do banco de questões.'}
</div>
${rawSubj || rawSys ? `<div class="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 font-semibold my-2"><b>Matéria:</b> ${rawSubj || 'Geral'} • <b>Sistema:</b> ${rawSys || 'Geral'}</div>` : ''}
${choicesHtml}
${explanation ? `<h4>Explicação Comentada:</h4><div class="p-4 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/60 text-sm leading-relaxed my-3">${explanation}</div>` : ''}
${objective ? `<blockquote><p><b>Educational Objective:</b> ${objective}</p></blockquote>` : ''}`;

          const noteId = get().createStudyNote({
            notebookId: defaultNbId,
            areaId: targetArea,
            title,
            content,
            icon: '🎯',
            associatedQuestionIds: qid ? [qid] : [],
            tags: questionData.tags || [qid ? `qid:${qid}` : '', rawSubj, rawSys].filter(Boolean)
          });

          return noteId;
        },

        // Study Desk Actions
        startDeskSession: (sessionData = {}) => {
          const id = 'desk-sess-' + Math.random().toString(36).substring(2, 9);
          const newSession: StudyDeskSession = {
            id,
            name: sessionData.name || `Sessão de Estudos #${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
            bankId: sessionData.bankId,
            startedAt: Date.now(),
            totalQuestions: sessionData.totalQuestions || 40,
            completedQuestions: 0,
            correctCount: 0,
            incorrectCount: 0,
            totalResolutionTimeSeconds: 0,
            totalReviewTimeSeconds: 0,
            targetResolutionTimeSeconds: sessionData.targetResolutionTimeSeconds || 75,
            targetReviewTimeSeconds: sessionData.targetReviewTimeSeconds || 150,
            questionRecords: [],
            ...sessionData,
          };

          set(state => ({
            studyDeskSessions: [newSession, ...(state.studyDeskSessions || [])],
            activeDeskSessionId: id,
          }));

          return id;
        },

        setActiveDeskSessionId: (sessionId) => {
          set({ activeDeskSessionId: sessionId });
        },

        recordDeskQuestionAnswer: (data) => {
          const { qid, questionId, selectedChoiceId, correctChoiceId, isCorrect, resolutionTimeSeconds, reviewTimeSeconds, subject, system } = data;
          
          set(state => {
            const activeId = state.activeDeskSessionId;
            const sessions = state.studyDeskSessions || [];
            const activeIdx = sessions.findIndex(s => s.id === activeId);

            const record: StudyDeskQuestionRecord = {
              qid,
              questionId,
              selectedChoiceId,
              correctChoiceId,
              isCorrect,
              resolutionTimeSeconds: Math.max(1, Math.round(resolutionTimeSeconds || 0)),
              reviewTimeSeconds: Math.max(0, Math.round(reviewTimeSeconds || 0)),
              subject: subject || '',
              system: system || '',
              isFromExtension: true,
              answeredAt: Date.now(),
            };

            let updatedSessions = sessions;
            if (activeIdx !== -1) {
              const current = sessions[activeIdx];
              const prevRecords = current.questionRecords || [];
              const withoutThis = prevRecords.filter(r => r.qid !== qid);
              const updatedRecords = [...withoutThis, record];
              
              const correctCount = updatedRecords.filter(r => r.isCorrect).length;
              const incorrectCount = updatedRecords.filter(r => !r.isCorrect).length;
              const totalResolutionTimeSeconds = updatedRecords.reduce((acc, r) => acc + r.resolutionTimeSeconds, 0);
              const totalReviewTimeSeconds = updatedRecords.reduce((acc, r) => acc + r.reviewTimeSeconds, 0);

              const updatedSession: StudyDeskSession = {
                ...current,
                completedQuestions: updatedRecords.length,
                correctCount,
                incorrectCount,
                totalResolutionTimeSeconds,
                totalReviewTimeSeconds,
                questionRecords: updatedRecords,
              };

              updatedSessions = [...sessions];
              updatedSessions[activeIdx] = updatedSession;
            } else {
              // Garante que a sessão da extensão seja sempre atualizada para histórico e gráficos
              const extSessionIdx = sessions.findIndex(s => s.name?.includes('Extensão') || s.name?.includes('Q-Bank'));
              if (extSessionIdx !== -1) {
                const current = sessions[extSessionIdx];
                const prevRecords = current.questionRecords || [];
                const withoutThis = prevRecords.filter(r => r.qid !== qid);
                const updatedRecords = [...withoutThis, record];
                const correctCount = updatedRecords.filter(r => r.isCorrect).length;
                const incorrectCount = updatedRecords.filter(r => !r.isCorrect).length;
                const totalResolutionTimeSeconds = updatedRecords.reduce((acc, r) => acc + r.resolutionTimeSeconds, 0);
                const totalReviewTimeSeconds = updatedRecords.reduce((acc, r) => acc + r.reviewTimeSeconds, 0);

                updatedSessions = [...sessions];
                updatedSessions[extSessionIdx] = {
                  ...current,
                  completedQuestions: updatedRecords.length,
                  correctCount,
                  incorrectCount,
                  totalResolutionTimeSeconds,
                  totalReviewTimeSeconds,
                  questionRecords: updatedRecords,
                };
              } else {
                const newExtSession: StudyDeskSession = {
                  id: 'desk-sess-ext-' + Date.now(),
                  name: 'Sessão Q-Bank (Extensão)',
                  startedAt: Date.now(),
                  totalQuestions: 40,
                  completedQuestions: 1,
                  correctCount: isCorrect ? 1 : 0,
                  incorrectCount: isCorrect ? 0 : 1,
                  totalResolutionTimeSeconds: record.resolutionTimeSeconds,
                  totalReviewTimeSeconds: record.reviewTimeSeconds,
                  targetResolutionTimeSeconds: 75,
                  targetReviewTimeSeconds: 150,
                  questionRecords: [record],
                };
                updatedSessions = [newExtSession, ...sessions];
              }
            }

            // Atualiza também na questão correspondente no banco
            const updatedQuestions = state.questions.map(q => {
              if (q.id !== questionId && q.qid !== qid) return q;
              const prevAttempts = q.attempts || [];
              const lastAttempt = prevAttempts[prevAttempts.length - 1];
              
              // Se já existir uma tentativa recente idêntica (dentro de 15 minutos), apenas atualiza os tempos sem duplicar registro
              const isRecentDuplicate = lastAttempt &&
                lastAttempt.selectedChoiceId === selectedChoiceId &&
                lastAttempt.isCorrect === isCorrect &&
                (Date.now() - (lastAttempt.timestamp || 0)) < 15 * 60 * 1000;

              let updatedAttempts = prevAttempts;
              if (isRecentDuplicate) {
                updatedAttempts = [
                  ...prevAttempts.slice(0, -1),
                  {
                    ...lastAttempt,
                    resolutionTimeSeconds: Math.max(lastAttempt.resolutionTimeSeconds || 0, record.resolutionTimeSeconds),
                    reviewTimeSeconds: Math.max(lastAttempt.reviewTimeSeconds || 0, record.reviewTimeSeconds),
                    timestamp: Date.now(),
                  }
                ];
              } else {
                updatedAttempts = [
                  ...prevAttempts,
                  {
                    timestamp: Date.now(),
                    selectedChoiceId,
                    isCorrect,
                    resolutionTimeSeconds: record.resolutionTimeSeconds,
                    reviewTimeSeconds: record.reviewTimeSeconds,
                  }
                ];
              }

              return {
                ...q,
                status: isCorrect ? ('correct' as const) : ('incorrect' as const),
                selectedChoiceId,
                resolutionTimeSeconds: record.resolutionTimeSeconds,
                reviewTimeSeconds: record.reviewTimeSeconds,
                attempts: updatedAttempts,
                lastAnsweredAt: Date.now(),
                subject: subject || q.subject,
                system: system || q.system,
                isFromExtension: true,
                source: 'extension' as const,
                updatedAt: Date.now(),
              };
            });

            // Atualiza lastReviewedAt das notas associadas à questão da sessão
            const now = Date.now();
            const updatedStudyNotes = state.studyNotes.map(n => {
              if (
                n.associatedQuestionIds?.includes(record.qid) ||
                (record.questionId && n.associatedQuestionIds?.includes(record.questionId))
              ) {
                return { ...n, lastReviewedAt: now };
              }
              return n;
            });

            return {
              studyDeskSessions: updatedSessions,
              questions: updatedQuestions,
              studyNotes: updatedStudyNotes,
            };
          });
        },

        finishDeskSession: (sessionId) => {
          set(state => {
            const targetId = sessionId || state.activeDeskSessionId;
            if (!targetId) return {};
            return {
              studyDeskSessions: (state.studyDeskSessions || []).map(s => {
                if (s.id !== targetId) return s;
                return { ...s, endedAt: Date.now() };
              }),
              activeDeskSessionId: state.activeDeskSessionId === targetId ? null : state.activeDeskSessionId,
            };
          });
        },

        deleteDeskSession: (sessionId) => {
          set(state => ({
            studyDeskSessions: (state.studyDeskSessions || []).filter(s => s.id !== sessionId),
            activeDeskSessionId: state.activeDeskSessionId === sessionId ? null : state.activeDeskSessionId,
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
            studyNotebooks: [
              { id: 'nb-principal', name: 'Caderno de Estudos Geral', description: 'Anotações estruturadas', icon: '📚', coverColor: '#3b82f6', createdAt: Date.now(), updatedAt: Date.now() }
            ],
            notebookAreas: [
              { id: 'area-clinica', notebookId: 'nb-principal', name: 'Clínica Médica', color: '#3b82f6', order: 0, createdAt: Date.now() },
              { id: 'area-pediatria', notebookId: 'nb-principal', name: 'Pediatria', color: '#10b981', order: 1, createdAt: Date.now() },
              { id: 'area-go', notebookId: 'nb-principal', name: 'Ginecologia e Obstetrícia', color: '#ec4899', order: 2, createdAt: Date.now() },
              { id: 'area-cirurgia', notebookId: 'nb-principal', name: 'Cirurgia Geral', color: '#f59e0b', order: 3, createdAt: Date.now() },
              { id: 'area-preventiva', notebookId: 'nb-principal', name: 'Medicina Preventiva & SUS', color: '#8b5cf6', order: 4, createdAt: Date.now() }
            ],
            notebookSystems: [],
            notebookSubjects: [],
            notebookTopics: [],
            studyNotes: [],
            studyDeskSessions: [],
            activeDeskSessionId: null,
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
            studyNotebooks: data.studyNotebooks || [],
            notebookAreas: data.notebookAreas || [],
            notebookSystems: data.notebookSystems || [],
            notebookSubjects: data.notebookSubjects || [],
            notebookTopics: data.notebookTopics || [],
            studyNotes: data.studyNotes || [],
            settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
          });
        },

        mergeProfile: (data) => {
          if (!data) return;
          set((state) => {
            // 1. Decks merge (Preserve all local decks, merge attributes from cloud)
            const deckMap = new Map<string, Deck>();
            (state.decks || []).forEach(d => deckMap.set(d.id, { ...d }));
            (data.decks || []).forEach((d: Deck) => {
              if (d && d.id) {
                if (!deckMap.has(d.id)) {
                  deckMap.set(d.id, d);
                } else {
                  const local = deckMap.get(d.id)!;
                  deckMap.set(d.id, {
                    ...d,
                    ...local, // Preserve local name, description, isOffline if modified locally
                    settings: { ...(d.settings || {}), ...(local.settings || {}) },
                  });
                }
              }
            });

            // 2. Cards merge (Preserve all local cards + add any unique cloud cards)
            const cardMap = new Map<string, Flashcard>();
            (state.cards || []).forEach(c => {
              if (c && c.id) cardMap.set(c.id, { ...c });
            });
            (data.cards || []).forEach((c: Flashcard) => {
              if (c && c.id) {
                if (!cardMap.has(c.id)) {
                  cardMap.set(c.id, c);
                } else {
                  const localCard = cardMap.get(c.id)!;
                  // If cloud card has higher repetition or was reviewed more recently, take scheduling
                  if ((c.repetition || 0) > (localCard.repetition || 0) || (c.nextReviewDate && c.nextReviewDate > (localCard.nextReviewDate || 0))) {
                    cardMap.set(c.id, { ...localCard, ...c });
                  }
                }
              }
            });

            // 3. Questions merge (Union by qid or id, preserving local resolution stats & user notes)
            const qMap = new Map<string, Question>();
            (state.questions || []).forEach(q => {
              if (q) qMap.set(q.id || q.qid, { ...q });
            });
            (data.questions || []).forEach((q: Question) => {
              if (q) {
                const key = q.id || q.qid;
                if (key) {
                  if (!qMap.has(key)) {
                    qMap.set(key, q);
                  } else {
                    const localQ = qMap.get(key)!;
                    const mergedAttempts = [...(localQ.attempts || []), ...(q.attempts || [])];
                    const uniqueAttempts = Array.from(
                      new Map(mergedAttempts.map(a => [a.timestamp, a])).values()
                    ).sort((a, b) => b.timestamp - a.timestamp);

                    qMap.set(key, {
                      ...q,
                      ...localQ,
                      attempts: uniqueAttempts,
                      status: localQ.status !== 'unused' ? localQ.status : (q.status || localQ.status),
                      userNotes: localQ.userNotes || q.userNotes,
                      isFlagged: localQ.isFlagged ?? q.isFlagged,
                      associatedNoteIds: Array.from(new Set([...(localQ.associatedNoteIds || []), ...(q.associatedNoteIds || [])]))
                    });
                  }
                }
              }
            });

            // 4. Question Banks merge (Preserve local name & description)
            const bankMap = new Map<string, QuestionBank>();
            (state.questionBanks || []).forEach(b => {
              if (b && b.id) bankMap.set(b.id, { ...b });
            });
            (data.questionBanks || []).forEach((b: QuestionBank) => {
              if (b && b.id) {
                if (!bankMap.has(b.id)) {
                  bankMap.set(b.id, b);
                } else {
                  const localBank = bankMap.get(b.id)!;
                  bankMap.set(b.id, {
                    ...b,
                    ...localBank,
                    name: localBank.name || b.name,
                    description: localBank.description !== undefined ? localBank.description : b.description,
                  });
                }
              }
            });

            // 5. Notebooks merge
            const nbMap = new Map<string, Notebook>();
            (state.notebooks || []).forEach(nb => {
              if (nb && nb.id) nbMap.set(nb.id, { ...nb });
            });
            (data.notebooks || []).forEach((nb: Notebook) => {
              if (nb && nb.id && !nbMap.has(nb.id)) {
                nbMap.set(nb.id, nb);
              }
            });

            // 6. Notebook History merge
            const nbHistoryMap = new Map<string, NotebookHistory>();
            (state.notebookHistory || []).forEach(h => {
              if (h && h.id) nbHistoryMap.set(h.id, h);
            });
            (data.notebookHistory || []).forEach((h: NotebookHistory) => {
              if (h && h.id && !nbHistoryMap.has(h.id)) {
                nbHistoryMap.set(h.id, h);
              }
            });

            // 7. Review Logs & History merge
            const reviewLogMap = new Map<string, ReviewLog>();
            (state.reviewLog || state.reviewHistory || []).forEach(rl => {
              if (rl && rl.id) reviewLogMap.set(rl.id, rl);
            });
            (data.reviewLog || data.reviewHistory || []).forEach((rl: ReviewLog) => {
              if (rl && rl.id && !reviewLogMap.has(rl.id)) {
                reviewLogMap.set(rl.id, rl);
              }
            });
            const mergedReviewLogs = Array.from(reviewLogMap.values()).sort((a, b) => (b.reviewDate || 0) - (a.reviewDate || 0));

            // 8. Legacy Notes merge
            const noteMap = new Map<string, Note>();
            (state.notes || []).forEach(n => {
              if (n && n.id) noteMap.set(n.id, { ...n });
            });
            (data.notes || []).forEach((n: Note) => {
              if (n && n.id && !noteMap.has(n.id)) {
                noteMap.set(n.id, n);
              }
            });

            // 9. Study Notebooks merge
            const snbMap = new Map<string, StudyNotebook>();
            (state.studyNotebooks || []).forEach(s => { if (s?.id) snbMap.set(s.id, { ...s }); });
            (data.studyNotebooks || []).forEach((s: StudyNotebook) => {
              if (s?.id && !snbMap.has(s.id)) snbMap.set(s.id, s);
            });

            // 10. Notebook Areas merge
            const areaMap = new Map<string, NotebookArea>();
            (state.notebookAreas || []).forEach(a => { if (a?.id) areaMap.set(a.id, { ...a }); });
            (data.notebookAreas || []).forEach((a: NotebookArea) => {
              if (a?.id) {
                if (!areaMap.has(a.id)) {
                  areaMap.set(a.id, a);
                } else {
                  const local = areaMap.get(a.id)!;
                  areaMap.set(a.id, { ...a, ...local });
                }
              }
            });

            // 11. Notebook Systems merge
            const sysMap = new Map<string, NotebookSystem>();
            (state.notebookSystems || []).forEach(s => { if (s?.id) sysMap.set(s.id, { ...s }); });
            (data.notebookSystems || []).forEach((s: NotebookSystem) => {
              if (s?.id && !sysMap.has(s.id)) sysMap.set(s.id, s);
            });

            // 12. Notebook Subjects merge
            const subjMap = new Map<string, NotebookSubject>();
            (state.notebookSubjects || []).forEach(s => { if (s?.id) subjMap.set(s.id, { ...s }); });
            (data.notebookSubjects || []).forEach((s: NotebookSubject) => {
              if (s?.id && !subjMap.has(s.id)) subjMap.set(s.id, s);
            });

            // 13. Notebook Topics merge
            const topMap = new Map<string, NotebookTopic>();
            (state.notebookTopics || []).forEach(t => { if (t?.id) topMap.set(t.id, { ...t }); });
            (data.notebookTopics || []).forEach((t: NotebookTopic) => {
              if (t?.id && !topMap.has(t.id)) topMap.set(t.id, t);
            });

            // 14. Study Notes merge (Preserve newer edits)
            const sNotesMap = new Map<string, StudyNote>();
            (state.studyNotes || []).forEach(n => { if (n?.id) sNotesMap.set(n.id, { ...n }); });
            (data.studyNotes || []).forEach((n: StudyNote) => {
              if (n?.id) {
                if (!sNotesMap.has(n.id)) {
                  sNotesMap.set(n.id, n);
                } else {
                  const local = sNotesMap.get(n.id)!;
                  if ((n.updatedAt || 0) > (local.updatedAt || 0)) {
                    sNotesMap.set(n.id, { ...local, ...n });
                  }
                }
              }
            });

            return {
              decks: Array.from(deckMap.values()),
              cards: Array.from(cardMap.values()),
              questions: Array.from(qMap.values()),
              questionBanks: Array.from(bankMap.values()),
              notebooks: Array.from(nbMap.values()),
              notebookHistory: Array.from(nbHistoryMap.values()),
              reviewLog: mergedReviewLogs,
              reviewHistory: mergedReviewLogs,
              notes: Array.from(noteMap.values()),
              studyNotebooks: Array.from(snbMap.values()),
              notebookAreas: Array.from(areaMap.values()),
              notebookSystems: Array.from(sysMap.values()),
              notebookSubjects: Array.from(subjMap.values()),
              notebookTopics: Array.from(topMap.values()),
              studyNotes: Array.from(sNotesMap.values()),
              settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}), ...(state.settings || {}) },
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
