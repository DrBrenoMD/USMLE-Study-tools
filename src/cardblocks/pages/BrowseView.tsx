import React, { useState, useMemo, useDeferredValue } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useStore, Flashcard, Question, StudyNote } from '../store/useStore';
import { Page } from '../App';
import {
  Search,
  Filter,
  Trash2,
  Edit2,
  ArrowLeft,
  Tag as TagIcon,
  Flag,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  Layers,
  ChevronRight,
  Plus,
  BookOpen,
  FolderTree,
  RotateCcw,
  FileText,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Pin,
  Printer,
  Sparkles,
  ExternalLink,
  MoreVertical,
  Check,
  ChevronDown
} from 'lucide-react';
import { sanitizeHtml, renderCardText, cn } from '../lib/utils';
import { CardEditor } from '../components/CardEditor';
import { CardCreationModal } from '../components/CardCreationModal';
import { PdfExportModal } from '../components/PdfExportModal';
import { NoteAssociationModal } from '../components/NoteAssociationModal';
import { format } from 'date-fns';
import { extractCardQids } from '../../utils/qbankCardMatcher';

// Helper functions for tags
const isIdTag = (t: string) => {
  const lower = t.trim().toLowerCase();
  return (
    lower.startsWith('qid:') ||
    lower.startsWith('qid-') ||
    lower.startsWith('id:') ||
    lower.startsWith('id-') ||
    /^(?:qid|id)[:\-_]?[0-9]+/i.test(lower) ||
    /^[0-9]{3,}$/.test(lower)
  );
};

const isSubjectTag = (t: string) => {
  const lower = t.trim().toLowerCase();
  return lower.startsWith('subject:') || lower.startsWith('subject-');
};

const isSystemTag = (t: string) => {
  const lower = t.trim().toLowerCase();
  return lower.startsWith('system:') || lower.startsWith('system-');
};

const formatTagName = (val: string) => {
  if (!val) return '';
  if (val.includes(' ') || /[A-Z]/.test(val)) return val;
  return val
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const getCardSubject = (c: Flashcard): { key: string; label: string } | null => {
  if (c.subject && c.subject.trim()) {
    return { key: c.subject.trim().toLowerCase(), label: c.subject.trim() };
  }
  if (c.subjective && c.subjective.trim()) {
    return { key: c.subjective.trim().toLowerCase(), label: c.subjective.trim() };
  }
  const tag = c.tags?.find(isSubjectTag);
  if (tag) {
    const raw = tag.replace(/^subject[:\-_]/i, '').trim();
    if (raw) return { key: raw.toLowerCase(), label: formatTagName(raw) };
  }
  return null;
};

const getCardSystem = (c: Flashcard): { key: string; label: string } | null => {
  if (c.system && c.system.trim()) {
    return { key: c.system.trim().toLowerCase(), label: c.system.trim() };
  }
  const tag = c.tags?.find(isSystemTag);
  if (tag) {
    const raw = tag.replace(/^system[:\-_]/i, '').trim();
    if (raw) return { key: raw.toLowerCase(), label: formatTagName(raw) };
  }
  return null;
};

interface BrowseViewProps {
  onNavigate: (p: Page) => void;
  initialDate?: string;
  initialDeckId?: string;
  initialBrowseType?: 'flashcards' | 'questions' | 'notes';
}

export const BrowseView: React.FC<BrowseViewProps> = ({
  onNavigate,
  initialDate,
  initialDeckId,
  initialBrowseType = 'flashcards'
}) => {
  const {
    decks,
    cards,
    questions,
    questionBanks,
    studyNotes,
    notebookAreas,
    notebookSystems,
    deleteCard,
    bulkDeleteCards,
    bulkEditCards,
    updateCard,
    deleteStudyNote,
    updateStudyNote,
    createStudyNote,
    createCard,
    toggleQuestionFlag
  } = useStore();

  // Active Main Tab: 'flashcards' | 'questions' | 'notes'
  const [activeTab, setActiveTab] = useState<'flashcards' | 'questions' | 'notes'>(initialBrowseType);

  // Common Search
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  // -------------------------------------------------------------
  // FLASHCARDS TAB STATE
  // -------------------------------------------------------------
  const [selectedDeckId, setSelectedDeckId] = useState<string>(() => initialDeckId || 'all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedSystem, setSelectedSystem] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedFlag, setSelectedFlag] = useState<string>('all');
  const [filterState, setFilterState] = useState<'all' | 'new' | 'due' | 'suspended'>('all');
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);

  // -------------------------------------------------------------
  // QUESTIONS TAB STATE
  // -------------------------------------------------------------
  const [selectedBankId, setSelectedBankId] = useState<string>('all');
  const [selectedQSubject, setSelectedQSubject] = useState<string>('all');
  const [selectedQSystem, setSelectedQSystem] = useState<string>('all');
  const [selectedQStatus, setSelectedQStatus] = useState<'all' | 'unused' | 'correct' | 'incorrect' | 'flagged'>('all');
  const [selectedQTag, setSelectedQTag] = useState<string>('all');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [testSelectedChoice, setTestSelectedChoice] = useState<string | null>(null);

  // -------------------------------------------------------------
  // NOTES TAB STATE
  // -------------------------------------------------------------
  const [selectedNoteAreaId, setSelectedNoteAreaId] = useState<string>('all');
  const [selectedNoteSystemId, setSelectedNoteSystemId] = useState<string>('all');
  const [selectedNoteTag, setSelectedNoteTag] = useState<string>('all');
  const [selectedNoteFilter, setSelectedNoteFilter] = useState<'all' | 'pinned' | 'with_cards' | 'with_questions'>('all');
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [noteAssociationModalTarget, setNoteAssociationModalTarget] = useState<{ questionId?: string; cardId?: string } | null>(null);

  // Deck Lookup Map
  const deckMap = useMemo(() => {
    const map = new Map<string, string>();
    decks.forEach(d => map.set(d.id, d.name));
    return map;
  }, [decks]);

  // Question Bank Map
  const bankMap = useMemo(() => {
    const map = new Map<string, string>();
    questionBanks.forEach(b => map.set(b.id, b.name));
    return map;
  }, [questionBanks]);

  // Area Map
  const areaMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    notebookAreas.forEach(a => map.set(a.id, { name: a.name, color: a.color }));
    return map;
  }, [notebookAreas]);

  // -------------------------------------------------------------
  // FLASHCARDS FILTERS & STATS
  // -------------------------------------------------------------
  const allGeneralTags = useMemo(() => {
    const freqMap = new Map<string, number>();
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      if (!c.tags || c.tags.length === 0) continue;
      for (let j = 0; j < c.tags.length; j++) {
        const clean = c.tags[j].trim();
        if (
          clean &&
          !clean.startsWith('#') &&
          !clean.startsWith('!') &&
          !isIdTag(clean) &&
          !isSubjectTag(clean) &&
          !isSystemTag(clean)
        ) {
          freqMap.set(clean, (freqMap.get(clean) || 0) + 1);
        }
      }
    }
    return Array.from(freqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 250)
      .map(([tag]) => tag)
      .sort((a, b) => a.localeCompare(b));
  }, [cards]);

  const { subjectList, systemsBySubject, allSystemsList } = useMemo(() => {
    const subjectsMap = new Map<string, { label: string; systems: Map<string, string>; count: number }>();
    const allSysMap = new Map<string, { label: string; count: number }>();

    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const sub = getCardSubject(c);
      const sys = getCardSystem(c);

      if (sys) {
        const existing = allSysMap.get(sys.key);
        if (existing) {
          existing.count += 1;
        } else {
          allSysMap.set(sys.key, { label: sys.label, count: 1 });
        }
      }

      if (sub) {
        if (!subjectsMap.has(sub.key)) {
          subjectsMap.set(sub.key, { label: sub.label, systems: new Map(), count: 0 });
        }
        const subData = subjectsMap.get(sub.key)!;
        subData.count += 1;

        if (sys) {
          subData.systems.set(sys.key, sys.label);
        }
      }
    }

    const subjectList = Array.from(subjectsMap.entries()).map(([key, data]) => ({
      key,
      label: data.label,
      count: data.count,
      systemsCount: data.systems.size
    })).sort((a, b) => a.label.localeCompare(b.label));

    const systemsBySubject: Record<string, { key: string; label: string }[]> = {};
    subjectsMap.forEach((data, subKey) => {
      systemsBySubject[subKey] = Array.from(data.systems.entries()).map(([k, l]) => ({
        key: k,
        label: l
      })).sort((a, b) => a.label.localeCompare(b.label));
    });

    const allSystemsList = Array.from(allSysMap.entries()).map(([key, data]) => ({
      key,
      label: data.label,
      count: data.count
    })).sort((a, b) => a.label.localeCompare(b.label));

    return { subjectList, systemsBySubject, allSystemsList };
  }, [cards]);

  const filteredCards = useMemo(() => {
    const now = Date.now();
    const query = deferredSearch.toLowerCase().trim();
    const cleanQueryId = query ? query.replace(/^#|^qid:|^qid-|^id:|^id-/i, '').trim() : '';

    return cards.filter(c => {
      if (selectedDeckId !== 'all' && c.deckId !== selectedDeckId) return false;
      if (selectedFlag !== 'all' && c.flag !== selectedFlag) return false;

      if (filterState === 'new' && c.repetition > 0) return false;
      if (filterState === 'due' && (c.repetition === 0 || c.nextReviewDate > now)) return false;
      if (filterState === 'suspended' && !c.isSuspended) return false;

      if (selectedSubject !== 'all') {
        const sub = getCardSubject(c);
        if (!sub || sub.key !== selectedSubject) return false;
      }

      if (selectedSystem !== 'all') {
        const sys = getCardSystem(c);
        if (!sys || sys.key !== selectedSystem) return false;
      }

      if (selectedTag !== 'all' && !c.tags?.includes(selectedTag)) return false;

      if (query) {
        const deckName = deckMap.get(c.deckId) || '';
        if (deckName && deckName.toLowerCase().includes(query)) return true;
        if (c.questionId) {
          const qidLower = c.questionId.toLowerCase();
          if (qidLower.includes(query) || (cleanQueryId && qidLower.includes(cleanQueryId))) return true;
        }
        if (c.front && c.front.toLowerCase().includes(query)) return true;
        if (c.back && c.back.toLowerCase().includes(query)) return true;
        if (c.tags && c.tags.some(t => t.toLowerCase().includes(query))) return true;
        if (c.subject && c.subject.toLowerCase().includes(query)) return true;
        if (c.system && c.system.toLowerCase().includes(query)) return true;
        if (c.questionStem && c.questionStem.toLowerCase().includes(query)) return true;
        if (c.educationalObjective && c.educationalObjective.toLowerCase().includes(query)) return true;
        if (c.explanation && c.explanation.toLowerCase().includes(query)) return true;
        return false;
      }

      return true;
    });
  }, [cards, selectedDeckId, selectedSubject, selectedSystem, selectedTag, selectedFlag, filterState, deferredSearch, deckMap]);

  const activeCard = useMemo(() => {
    if (activeCardId) {
      const found = cards.find(c => c.id === activeCardId);
      if (found) return found;
    }
    return filteredCards[0] || null;
  }, [activeCardId, cards, filteredCards]);

  // -------------------------------------------------------------
  // QUESTIONS FILTERS & STATS
  // -------------------------------------------------------------
  const allQuestionSubjects = useMemo(() => {
    const set = new Set<string>();
    questions.forEach(q => {
      if (q.subject) set.add(q.subject);
    });
    return Array.from(set).sort();
  }, [questions]);

  const allQuestionSystems = useMemo(() => {
    const set = new Set<string>();
    questions.forEach(q => {
      if (q.system) set.add(q.system);
    });
    return Array.from(set).sort();
  }, [questions]);

  const allQuestionTags = useMemo(() => {
    const set = new Set<string>();
    questions.forEach(q => {
      q.tags?.forEach(t => set.add(t));
    });
    return Array.from(set).sort();
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    const query = deferredSearch.toLowerCase().trim();
    const cleanQueryId = query ? query.replace(/^#|^qid:|^qid-|^id:|^id-/i, '').trim() : '';

    return questions.filter(q => {
      if (selectedBankId !== 'all' && q.bankId !== selectedBankId) return false;
      if (selectedQSubject !== 'all' && q.subject !== selectedQSubject) return false;
      if (selectedQSystem !== 'all' && q.system !== selectedQSystem) return false;
      if (selectedQTag !== 'all' && !q.tags?.includes(selectedQTag)) return false;

      if (selectedQStatus === 'unused' && q.status && q.status !== 'unused') return false;
      if (selectedQStatus === 'correct' && q.status !== 'correct') return false;
      if (selectedQStatus === 'incorrect' && q.status !== 'incorrect') return false;
      if (selectedQStatus === 'flagged' && !q.isFlagged && !q.flag) return false;

      if (query) {
        if (q.qid && (q.qid.toLowerCase().includes(query) || (cleanQueryId && q.qid.includes(cleanQueryId)))) return true;
        if (q.text && q.text.toLowerCase().includes(query)) return true;
        if (q.stem && q.stem.toLowerCase().includes(query)) return true;
        if (q.explanation && q.explanation.toLowerCase().includes(query)) return true;
        if (q.educationalObjective && q.educationalObjective.toLowerCase().includes(query)) return true;
        if (q.tags && q.tags.some(t => t.toLowerCase().includes(query))) return true;
        if (q.alternatives && q.alternatives.some(a => a.text && a.text.toLowerCase().includes(query))) return true;
        return false;
      }

      return true;
    });
  }, [questions, selectedBankId, selectedQSubject, selectedQSystem, selectedQTag, selectedQStatus, deferredSearch]);

  const activeQuestion = useMemo(() => {
    if (activeQuestionId) {
      const found = questions.find(q => q.id === activeQuestionId || q.qid === activeQuestionId);
      if (found) return found;
    }
    return filteredQuestions[0] || null;
  }, [activeQuestionId, questions, filteredQuestions]);

  // Questions associated cards & notes helper
  const getCardsForQuestion = (q: Question) => {
    return cards.filter(c => c.questionId === q.qid || c.sourceQuestionId === q.id || (c.tags && c.tags.includes(`qid:${q.qid}`)));
  };

  const getNotesForQuestion = (q: Question) => {
    return studyNotes.filter(n => n.associatedQuestionIds?.includes(q.qid) || n.associatedQuestionIds?.includes(q.id));
  };

  // -------------------------------------------------------------
  // NOTES FILTERS & STATS
  // -------------------------------------------------------------
  const allNoteTags = useMemo(() => {
    const set = new Set<string>();
    studyNotes.forEach(n => {
      n.tags?.forEach(t => set.add(t));
    });
    return Array.from(set).sort();
  }, [studyNotes]);

  const filteredNotes = useMemo(() => {
    const query = deferredSearch.toLowerCase().trim();

    return studyNotes.filter(n => {
      if (selectedNoteAreaId !== 'all' && n.areaId !== selectedNoteAreaId) return false;
      if (selectedNoteSystemId !== 'all' && n.systemId !== selectedNoteSystemId) return false;
      if (selectedNoteTag !== 'all' && !n.tags?.includes(selectedNoteTag)) return false;

      if (selectedNoteFilter === 'pinned' && !n.isPinned) return false;
      if (selectedNoteFilter === 'with_cards' && (!n.associatedCardIds?.length && !n.embeddedFlashcardIds?.length)) return false;
      if (selectedNoteFilter === 'with_questions' && !n.associatedQuestionIds?.length) return false;

      if (query) {
        if (n.title && n.title.toLowerCase().includes(query)) return true;
        if (n.content && n.content.toLowerCase().includes(query)) return true;
        if (n.tags && n.tags.some(t => t.toLowerCase().includes(query))) return true;
        return false;
      }

      return true;
    });
  }, [studyNotes, selectedNoteAreaId, selectedNoteSystemId, selectedNoteTag, selectedNoteFilter, deferredSearch]);

  const activeNote = useMemo(() => {
    if (activeNoteId) {
      const found = studyNotes.find(n => n.id === activeNoteId);
      if (found) return found;
    }
    return filteredNotes[0] || null;
  }, [activeNoteId, studyNotes, filteredNotes]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearch('');
    if (activeTab === 'flashcards') {
      setSelectedDeckId('all');
      setSelectedSubject('all');
      setSelectedSystem('all');
      setSelectedTag('all');
      setSelectedFlag('all');
      setFilterState('all');
    } else if (activeTab === 'questions') {
      setSelectedBankId('all');
      setSelectedQSubject('all');
      setSelectedQSystem('all');
      setSelectedQStatus('all');
      setSelectedQTag('all');
    } else {
      setSelectedNoteAreaId('all');
      setSelectedNoteSystemId('all');
      setSelectedNoteTag('all');
      setSelectedNoteFilter('all');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-20 animate-fade-in">
      {/* Top Main Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-3xl shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate({ type: 'home' })}
            className="p-2 -ml-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Navegador Geral de Conteúdo
            </h2>
            <p className="text-xs text-gray-500">
              Gerencie, filtre e explore Flashcards, Questões e Cadernos de Estudo de forma integrada.
            </p>
          </div>
        </div>

        {/* 3 Main Tabs Switcher */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('flashcards')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              activeTab === 'flashcards'
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
            )}
          >
            <Layers className="w-4 h-4" />
            <span>Flashcards</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              {cards.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              activeTab === 'questions'
                ? "bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
            )}
          >
            <BookOpen className="w-4 h-4" />
            <span>Questões</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
              {questions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              activeTab === 'notes'
                ? "bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
            )}
          >
            <FileText className="w-4 h-4" />
            <span>Notas & Cadernos</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
              {studyNotes.length}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: FLASHCARDS BROWSER */}
      {/* ========================================================================= */}
      {activeTab === 'flashcards' && (
        <div className="space-y-4">
          {/* Flashcards Filter Toolbar */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl shadow-xs flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar flashcard por texto, QID (#4262), resposta ou tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={selectedDeckId}
              onChange={(e) => setSelectedDeckId(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 font-semibold"
            >
              <option value="all">Todos os Baralhos ({decks.length})</option>
              {decks.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {subjectList.length > 0 && (
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-3 py-1.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-700 dark:text-purple-300 font-semibold"
              >
                <option value="all">Todos os Subjects ({subjectList.length})</option>
                {subjectList.map(s => (
                  <option key={s.key} value={s.key}>📚 {s.label} ({s.count})</option>
                ))}
              </select>
            )}

            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value as any)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 font-semibold"
            >
              <option value="all">Todos os Estados</option>
              <option value="new">Novos</option>
              <option value="due">Pendentes (Due)</option>
              <option value="suspended">Suspensos</option>
            </select>

            <button
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 rounded-xl font-medium flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Limpar
            </button>

            <button
              onClick={() => setIsAddCardOpen(true)}
              className="ml-auto px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Flashcard</span>
            </button>
          </div>

          {/* Flashcards Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[600px]">
            {/* List */}
            <div className="lg:col-span-6 xl:col-span-7 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[700px]">
              <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs font-semibold text-gray-500 bg-gray-50/50 dark:bg-gray-800/30">
                <span>Frente / Enunciado ({filteredCards.length})</span>
                <span>Baralho</span>
              </div>
              <div className="flex-1 w-full relative">
                {filteredCards.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 text-xs flex flex-col items-center justify-center h-full">
                    <Search className="w-8 h-8 text-gray-300 dark:text-gray-700 mb-2" />
                    <span>Nenhum flashcard encontrado.</span>
                  </div>
                ) : (
                  <Virtuoso
                    style={{ height: '100%', width: '100%' }}
                    totalCount={filteredCards.length}
                    data={filteredCards}
                    itemContent={(index, card) => {
                      const isActive = activeCard?.id === card.id;
                      const deckName = deckMap.get(card.deckId) || 'Geral';
                      const cardSub = getCardSubject(card);

                      return (
                        <div
                          key={card.id}
                          onClick={() => setActiveCardId(card.id)}
                          className={cn(
                            "p-3.5 flex items-start justify-between gap-3 cursor-pointer transition-colors text-xs border-b border-gray-100 dark:border-gray-800/60",
                            isActive
                              ? "bg-blue-50/80 dark:bg-blue-950/50 border-l-4 border-l-blue-600"
                              : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div
                              className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderCardText(card.front, false)) }}
                            />
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {extractCardQids(card, deckName).map(qid => (
                                <span key={qid} className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded-md border border-blue-200">
                                  QID: {qid}
                                </span>
                              ))}
                              {cardSub && (
                                <span className="text-[10px] bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 font-semibold px-1.5 py-0.5 rounded-md">
                                  📚 {cardSub.label}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] text-gray-500 shrink-0 font-medium">{deckName}</span>
                        </div>
                      );
                    }}
                  />
                )}
              </div>
            </div>

            {/* Detail / Editor */}
            <div className="lg:col-span-6 xl:col-span-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs overflow-y-auto h-[700px]">
              {activeCard ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
                    <span className="text-xs font-bold text-gray-500">Detalhes do Flashcard</span>
                    <button
                      onClick={() => onNavigate({ type: 'study', cardIds: [activeCard.id] })}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Praticar Card</span>
                    </button>
                  </div>
                  <CardEditor
                    key={activeCard.id}
                    card={activeCard}
                    onSave={(updated) => updateCard(activeCard.id, updated)}
                    onDelete={() => deleteCard(activeCard.id)}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  Selecione um flashcard para visualizar e editar.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: QUESTIONS BROWSER (BANCO DE QUESTÕES) */}
      {/* ========================================================================= */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          {/* Questions Filter Toolbar */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl shadow-xs flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar questão por enunciado, QID (#4262), alternativa ou explicação..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {questionBanks.length > 0 && (
              <select
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 font-semibold"
              >
                <option value="all">Todos os Bancos ({questionBanks.length})</option>
                {questionBanks.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}

            {allQuestionSubjects.length > 0 && (
              <select
                value={selectedQSubject}
                onChange={(e) => setSelectedQSubject(e.target.value)}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-semibold"
              >
                <option value="all">Todos os Subjects ({allQuestionSubjects.length})</option>
                {allQuestionSubjects.map(s => (
                  <option key={s} value={s}>📚 {s}</option>
                ))}
              </select>
            )}

            <select
              value={selectedQStatus}
              onChange={(e) => setSelectedQStatus(e.target.value as any)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 font-semibold"
            >
              <option value="all">Todos os Status</option>
              <option value="unused">Não Resolvidas (Unused)</option>
              <option value="correct">Acertos (Correct)</option>
              <option value="incorrect">Erros (Incorrect)</option>
              <option value="flagged">Marcadas (Flagged)</option>
            </select>

            <button
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 rounded-xl font-medium flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Limpar
            </button>
          </div>

          {/* Questions Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[600px]">
            {/* List */}
            <div className="lg:col-span-6 xl:col-span-7 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[700px]">
              <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs font-semibold text-gray-500 bg-gray-50/50 dark:bg-gray-800/30">
                <span>Questão / Enunciado ({filteredQuestions.length})</span>
                <span>Status</span>
              </div>
              <div className="flex-1 w-full relative">
                {filteredQuestions.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 text-xs flex flex-col items-center justify-center h-full">
                    <Search className="w-8 h-8 text-gray-300 dark:text-gray-700 mb-2" />
                    <span>Nenhuma questão encontrada com os filtros atuais.</span>
                  </div>
                ) : (
                  <Virtuoso
                    style={{ height: '100%', width: '100%' }}
                    totalCount={filteredQuestions.length}
                    data={filteredQuestions}
                    itemContent={(index, q) => {
                      const isActive = activeQuestion?.id === q.id || activeQuestion?.qid === q.qid;
                      const linkedCards = getCardsForQuestion(q);
                      const linkedNotes = getNotesForQuestion(q);

                      return (
                        <div
                          key={q.id || q.qid}
                          onClick={() => {
                            setActiveQuestionId(q.id || q.qid);
                            setTestSelectedChoice(null);
                          }}
                          className={cn(
                            "p-3.5 flex items-start justify-between gap-3 cursor-pointer transition-colors text-xs border-b border-gray-100 dark:border-gray-800/60",
                            isActive
                              ? "bg-emerald-50/80 dark:bg-emerald-950/50 border-l-4 border-l-emerald-600"
                              : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                                QID: #{q.qid}
                              </span>
                              {q.subject && (
                                <span className="text-[10px] text-gray-500 font-semibold truncate">
                                  {q.subject} {q.system ? `• ${q.system}` : ''}
                                </span>
                              )}
                            </div>

                            <p className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-relaxed">
                              {q.stem || q.text}
                            </p>

                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {linkedCards.length > 0 && (
                                <span className="text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 font-bold px-1.5 py-0.5 rounded border border-purple-200 flex items-center gap-0.5">
                                  <Layers className="w-3 h-3" />
                                  {linkedCards.length} Cards
                                </span>
                              )}
                              {linkedNotes.length > 0 && (
                                <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-0.5">
                                  <FileText className="w-3 h-3" />
                                  {linkedNotes.length} Notas
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 flex flex-col items-end gap-1">
                            {q.status === 'correct' ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                Acerto
                              </span>
                            ) : q.status === 'incorrect' ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                Erro
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                Não feita
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                )}
              </div>
            </div>

            {/* Question Details / Solver Right View */}
            <div className="lg:col-span-6 xl:col-span-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs overflow-y-auto h-[700px]">
              {activeQuestion ? (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-600">QID: #{activeQuestion.qid}</span>
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white mt-0.5">
                        {activeQuestion.subject || 'Questão Clínica'}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleQuestionFlag(activeQuestion.id || activeQuestion.qid)}
                        className={cn(
                          "p-1.5 rounded-xl border transition-colors",
                          activeQuestion.isFlagged ? "bg-amber-50 text-amber-600 border-amber-300" : "text-gray-400 border-gray-200 hover:text-gray-700"
                        )}
                        title="Marcar questão"
                      >
                        <Flag className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Stem */}
                  <div className="p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                    {activeQuestion.stem || activeQuestion.text}
                  </div>

                  {/* Alternatives */}
                  {activeQuestion.alternatives && activeQuestion.alternatives.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-bold text-gray-500">Alternativas:</div>
                      {activeQuestion.alternatives.map((alt, idx) => {
                        const letter = String.fromCharCode(65 + idx);
                        const isSelected = testSelectedChoice === alt.id || (alt.letter && testSelectedChoice === alt.letter);

                        return (
                          <button
                            key={alt.id || idx}
                            onClick={() => setTestSelectedChoice(alt.id || alt.letter || letter)}
                            className={cn(
                              "w-full text-left p-2.5 rounded-xl border text-xs font-semibold flex items-start gap-2.5 transition-all",
                              isSelected
                                ? alt.isCorrect
                                  ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-800 dark:text-emerald-200"
                                  : "bg-red-50 dark:bg-red-950/50 border-red-500 text-red-800 dark:text-red-200"
                                : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200"
                            )}
                          >
                            <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold shrink-0 text-[11px]">
                              {alt.letter || letter}
                            </span>
                            <span className="flex-1 leading-relaxed">{alt.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Explanation & Objective */}
                  {(activeQuestion.explanation || activeQuestion.educationalObjective) && (
                    <div className="p-4 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl space-y-2">
                      {activeQuestion.educationalObjective && (
                        <div>
                          <span className="font-bold text-blue-700 dark:text-blue-300 block mb-1">🎯 Objetivo Educacional:</span>
                          <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{activeQuestion.educationalObjective}</p>
                        </div>
                      )}
                      {activeQuestion.explanation && (
                        <div className="pt-2 border-t border-blue-100 dark:border-blue-900/40">
                          <span className="font-bold text-blue-700 dark:text-blue-300 block mb-1">📖 Explicação:</span>
                          <div
                            className="text-gray-800 dark:text-gray-200 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(activeQuestion.explanation) }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions: Associate with note or create card */}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setNoteAssociationModalTarget({ questionId: activeQuestion.qid || activeQuestion.id })}
                      className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-xl font-bold flex items-center gap-1.5 transition-colors border border-purple-200 dark:border-purple-800"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Associar a Nota de Estudo</span>
                    </button>

                    <button
                      onClick={() => {
                        createCard({
                          deckId: decks[0]?.id || 'default',
                          front: `<p><b>[QID: ${activeQuestion.qid}]</b> ${activeQuestion.stem || activeQuestion.text}</p>`,
                          back: `<p>${activeQuestion.educationalObjective || activeQuestion.explanation || 'Resposta da questão'}</p>`,
                          tags: [`qid:${activeQuestion.qid}`, activeQuestion.subject || ''].filter(Boolean),
                          questionId: activeQuestion.qid
                        });
                        alert('Flashcard criado com sucesso a partir da questão!');
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Gerar Flashcard da Questão</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  Selecione uma questão para visualizar detalhes.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STUDY NOTES BROWSER (CADERNOS & NOTAS) */}
      {/* ========================================================================= */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          {/* Notes Filter Toolbar */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl shadow-xs flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar nota por título, conteúdo estruturado ou tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <select
              value={selectedNoteAreaId}
              onChange={(e) => setSelectedNoteAreaId(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 font-semibold"
            >
              <option value="all">Todas as Áreas ({notebookAreas.length})</option>
              {notebookAreas.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            <select
              value={selectedNoteFilter}
              onChange={(e) => setSelectedNoteFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 font-semibold"
            >
              <option value="all">Todos os Tipos</option>
              <option value="pinned">Fixadas (Pinned)</option>
              <option value="with_cards">Com Flashcards</option>
              <option value="with_questions">Com Questões Q-Bank</option>
            </select>

            <button
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 rounded-xl font-medium flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Limpar
            </button>

            <button
              onClick={() => setPdfModalOpen(true)}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 rounded-xl text-xs font-bold border border-purple-200 dark:border-purple-800 flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Exportar PDF</span>
            </button>
          </div>

          {/* Notes Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[600px]">
            {/* List */}
            <div className="lg:col-span-6 xl:col-span-7 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[700px]">
              <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs font-semibold text-gray-500 bg-gray-50/50 dark:bg-gray-800/30">
                <span>Nota de Estudo ({filteredNotes.length})</span>
                <span>Área / Data</span>
              </div>
              <div className="flex-1 w-full relative">
                {filteredNotes.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 text-xs flex flex-col items-center justify-center h-full">
                    <Search className="w-8 h-8 text-gray-300 dark:text-gray-700 mb-2" />
                    <span>Nenhuma nota encontrada.</span>
                  </div>
                ) : (
                  <Virtuoso
                    style={{ height: '100%', width: '100%' }}
                    totalCount={filteredNotes.length}
                    data={filteredNotes}
                    itemContent={(index, note) => {
                      const isActive = activeNote?.id === note.id;
                      const area = areaMap.get(note.areaId);

                      return (
                        <div
                          key={note.id}
                          onClick={() => setActiveNoteId(note.id)}
                          className={cn(
                            "p-3.5 flex items-start justify-between gap-3 cursor-pointer transition-colors text-xs border-b border-gray-100 dark:border-gray-800/60",
                            isActive
                              ? "bg-purple-50/80 dark:bg-purple-950/50 border-l-4 border-l-purple-600"
                              : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span>{note.icon || '📝'}</span>
                              <span className="font-bold text-gray-900 dark:text-white truncate">{note.title}</span>
                              {note.isPinned && <Pin className="w-3 h-3 text-amber-500 shrink-0" />}
                            </div>

                            <div
                              className="text-gray-500 line-clamp-1 mt-1 text-[11px]"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content.replace(/<[^>]*>?/gm, '')) }}
                            />

                            <div className="flex items-center gap-2 mt-2">
                              {note.associatedQuestionIds && note.associatedQuestionIds.length > 0 && (
                                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                  {note.associatedQuestionIds.length} Q-Bank
                                </span>
                              )}
                              {note.associatedCardIds && note.associatedCardIds.length > 0 && (
                                <span className="text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 font-bold px-1.5 py-0.5 rounded border border-purple-200">
                                  {note.associatedCardIds.length} Flashcards
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 flex flex-col items-end gap-1">
                            {area && (
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: `${area.color}20`, color: area.color }}
                              >
                                {area.name}
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400">{format(note.updatedAt || Date.now(), 'dd/MM')}</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                )}
              </div>
            </div>

            {/* Note Details / Preview Right View */}
            <div className="lg:col-span-6 xl:col-span-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs overflow-y-auto h-[700px]">
              {activeNote ? (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{activeNote.icon || '📝'}</span>
                      <div>
                        <h3 className="font-extrabold text-sm text-gray-900 dark:text-white truncate">
                          {activeNote.title}
                        </h3>
                        <span className="text-[11px] text-gray-400">
                          {areaMap.get(activeNote.areaId)?.name || 'Área'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onNavigate({ type: 'notebooks' })}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center gap-1"
                        title="Abrir no Caderno de Estudos"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Abrir no Caderno</span>
                      </button>
                    </div>
                  </div>

                  {/* Rendered HTML */}
                  <div
                    className="p-4 bg-gray-50/50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 prose dark:prose-invert max-w-none text-xs leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(activeNote.content) }}
                  />

                  {/* Associations */}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                    <span className="font-bold text-gray-700 dark:text-gray-300 block">Vínculos de Estudo:</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setNoteAssociationModalTarget({ cardId: activeNote.id })}
                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-xl font-bold flex items-center gap-1.5 border border-purple-200"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Associar Flashcards / Q-Bank</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  Selecione uma nota para visualizar o conteúdo.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Card Modal */}
      {isAddCardOpen && (
        <CardCreationModal
          isOpen={isAddCardOpen}
          onClose={() => setIsAddCardOpen(false)}
          defaultDeckId={selectedDeckId !== 'all' ? selectedDeckId : (decks[0]?.id || '')}
        />
      )}

      {/* Note Association Modal */}
      {noteAssociationModalTarget && (
        <NoteAssociationModal
          isOpen={true}
          onClose={() => setNoteAssociationModalTarget(null)}
          questionId={noteAssociationModalTarget.questionId}
          cardId={noteAssociationModalTarget.cardId}
        />
      )}

      {/* PDF Export Modal */}
      {pdfModalOpen && (
        <PdfExportModal
          isOpen={pdfModalOpen}
          onClose={() => setPdfModalOpen(false)}
          defaultAreaId={selectedNoteAreaId !== 'all' ? selectedNoteAreaId : undefined}
        />
      )}
    </div>
  );
};
