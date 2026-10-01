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
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  ArrowUpDown,
  Calendar,
  Clock,
  PanelLeftClose,
  PanelLeft,
  Folder,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  MoveRight,
  Play
} from 'lucide-react';
import { sanitizeHtml, renderCardText, cn } from '../lib/utils';
import { CardEditor } from '../components/CardEditor';
import { CardCreationModal } from '../components/CardCreationModal';
import { PdfExportModal } from '../components/PdfExportModal';
import { NoteAssociationModal } from '../components/NoteAssociationModal';
import { notify } from '../lib/toast';
import { format } from 'date-fns';
import { extractCardQids } from '../../utils/qbankCardMatcher';

// Flag configurations
const FLAG_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  red: { label: 'Vermelha', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60' },
  orange: { label: 'Laranja', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60' },
  green: { label: 'Verde', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60' },
  blue: { label: 'Azul', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60' },
  pink: { label: 'Rosa', dot: 'bg-pink-500', text: 'text-pink-700 dark:text-pink-300', bg: 'bg-pink-50 dark:bg-pink-950/40 border-pink-200 dark:border-pink-900/60' },
  turquoise: { label: 'Turquesa', dot: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-300', bg: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-900/60' },
  purple: { label: 'Roxa', dot: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/60' },
};

// Helper function to format due date & state badge
const formatCardDueDate = (card: Flashcard) => {
  if (card.isSuspended) {
    return { text: 'Suspenso', label: 'Suspenso', badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300/50' };
  }
  if (!card.repetition || card.repetition === 0) {
    return { text: 'Novo', label: 'Novo', badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-300/50' };
  }
  const now = Date.now();
  const nextDate = card.nextReviewDate || now;
  const diffDays = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) {
    return { text: 'Hoje (Due)', label: 'Para Revisar Hoje', badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 font-bold border border-rose-300/60' };
  }
  if (diffDays === 1) {
    return { text: 'Amanhã', label: 'Amanhã', badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200' };
  }
  return { text: `Em ${diffDays}d`, label: `Em ${diffDays} dias`, badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200' };
};

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
    toggleQuestionFlag,
    toggleSuspendCard,
    scheduleCardForToday,
    bulkActivateAndScheduleForToday
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
  const [filterState, setFilterState] = useState<'all' | 'new' | 'due' | 'learning' | 'suspended' | 'flagged'>('all');
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'split' | 'table'>('split');
  const [sortBy, setSortBy] = useState<'created' | 'due' | 'front' | 'interval' | 'ease' | 'reps' | 'lapses'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sidebarTagFilter, setSidebarTagFilter] = useState('');

  // Bulk action modals
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [targetMoveDeckId, setTargetMoveDeckId] = useState<string>('');
  const [isAddTagModalOpen, setIsAddTagModalOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

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

      if (filterState === 'new' && (c.repetition > 0 || c.isSuspended)) return false;
      if (filterState === 'due' && (c.repetition === 0 || c.nextReviewDate > now || c.isSuspended)) return false;
      if (filterState === 'learning' && (c.repetition === 0 || c.nextReviewDate <= now || c.isSuspended)) return false;
      if (filterState === 'suspended' && !c.isSuspended) return false;
      if (filterState === 'flagged' && !c.flag) return false;

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

  const sortedCards = useMemo(() => {
    return [...filteredCards].sort((a, b) => {
      let comp = 0;
      switch (sortBy) {
        case 'due':
          comp = (a.nextReviewDate || 0) - (b.nextReviewDate || 0);
          break;
        case 'front':
          comp = (a.front || '').localeCompare(b.front || '');
          break;
        case 'interval':
          comp = (a.interval || 0) - (b.interval || 0);
          break;
        case 'ease':
          comp = (a.easeFactor || 2.5) - (b.easeFactor || 2.5);
          break;
        case 'reps':
          comp = (a.repetition || 0) - (b.repetition || 0);
          break;
        case 'lapses':
          comp = (a.lapses || 0) - (b.lapses || 0);
          break;
        case 'created':
        default:
          comp = (a.createdAt || 0) - (b.createdAt || 0);
          break;
      }
      return sortOrder === 'asc' ? comp : -comp;
    });
  }, [filteredCards, sortBy, sortOrder]);

  const activeCard = useMemo(() => {
    if (activeCardId) {
      const found = cards.find(c => c.id === activeCardId);
      if (found) return found;
    }
    return sortedCards[0] || null;
  }, [activeCardId, cards, sortedCards]);

  const cardCounts = useMemo(() => {
    const now = Date.now();
    return {
      all: cards.length,
      new: cards.filter(c => (c.repetition === 0 || !c.repetition) && !c.isSuspended).length,
      due: cards.filter(c => c.repetition > 0 && (c.nextReviewDate || 0) <= now && !c.isSuspended).length,
      learning: cards.filter(c => c.repetition > 0 && (c.nextReviewDate || 0) > now && !c.isSuspended).length,
      suspended: cards.filter(c => !!c.isSuspended).length,
      flagged: cards.filter(c => !!c.flag).length,
    };
  }, [cards]);

  const flagCounts = useMemo(() => {
    const map: Record<string, number> = {};
    Object.keys(FLAG_CONFIG).forEach(k => { map[k] = 0; });
    cards.forEach(c => {
      if (c.flag && map[c.flag] !== undefined) {
        map[c.flag] += 1;
      }
    });
    return map;
  }, [cards]);

  const deckCounts = useMemo(() => {
    const map = new Map<string, number>();
    cards.forEach(c => {
      map.set(c.deckId, (map.get(c.deckId) || 0) + 1);
    });
    return map;
  }, [cards]);

  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    cards.forEach(c => {
      c.tags?.forEach(t => {
        const clean = t.trim();
        if (clean && !clean.startsWith('#') && !clean.startsWith('!') && !isIdTag(clean)) {
          map.set(clean, (map.get(clean) || 0) + 1);
        }
      });
    });
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [cards]);

  // Bulk operation handlers
  const handleToggleSelectCard = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedCardIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllCards = () => {
    if (selectedCardIds.length === sortedCards.length && sortedCards.length > 0) {
      setSelectedCardIds([]);
    } else {
      setSelectedCardIds(sortedCards.map(c => c.id));
    }
  };

  const handleBulkSuspend = () => {
    if (selectedCardIds.length === 0) return;
    const selected = cards.filter(c => selectedCardIds.includes(c.id));
    const anyActive = selected.some(c => !c.isSuspended);
    bulkEditCards(selectedCardIds, { isSuspended: anyActive });
    notify(`${selectedCardIds.length} flashcards ${anyActive ? 'suspensos' : 'reativados'}.`, 'info');
  };

  const handleBulkMove = () => {
    if (!targetMoveDeckId || selectedCardIds.length === 0) return;
    bulkEditCards(selectedCardIds, { deckId: targetMoveDeckId });
    const targetDeckName = deckMap.get(targetMoveDeckId) || 'Baralho';
    notify(`${selectedCardIds.length} flashcards movidos para "${targetDeckName}".`, 'success');
    setIsMoveModalOpen(false);
    setTargetMoveDeckId('');
  };

  const handleBulkSetFlag = (flagColor: string) => {
    if (selectedCardIds.length === 0) return;
    bulkEditCards(selectedCardIds, { flag: flagColor || undefined });
    notify(`Bandeira ${flagColor ? `"${flagColor}"` : 'removida'} em ${selectedCardIds.length} cartões.`, 'info');
  };

  const handleBulkAddTag = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed || selectedCardIds.length === 0) return;
    selectedCardIds.forEach(id => {
      const card = cards.find(c => c.id === id);
      if (card) {
        const currentTags = card.tags || [];
        if (!currentTags.includes(trimmed)) {
          updateCard(id, { tags: [...currentTags, trimmed] });
        }
      }
    });
    notify(`Tag "${trimmed}" adicionada a ${selectedCardIds.length} cartões.`, 'success');
    setIsAddTagModalOpen(false);
    setNewTagInput('');
  };

  const handleBulkScheduleToday = () => {
    if (selectedCardIds.length === 0) return;
    bulkActivateAndScheduleForToday(selectedCardIds);
    notify(`${selectedCardIds.length} cartões agendados para revisão hoje!`, 'success');
  };

  const handleBulkDelete = () => {
    if (selectedCardIds.length === 0) return;
    const count = selectedCardIds.length;
    bulkDeleteCards(selectedCardIds);
    setSelectedCardIds([]);
    setIsBulkDeleteModalOpen(false);
    notify(`${count} flashcards excluídos com sucesso.`, 'info');
  };

  const handleStudySelected = () => {
    if (selectedCardIds.length === 0) return;
    onNavigate({ type: 'study', cardIds: selectedCardIds });
  };

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
    <div className="w-full max-w-[1700px] mx-auto space-y-4 pb-20 animate-fade-in">
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
              Gerencie, filtre e explore Flashcards, Questões e Cadernos de Estudo com operações em massa e árvore de tags.
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
        <div className="space-y-3">
          {/* Flashcards Filter Toolbar */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl shadow-xs flex flex-wrap items-center gap-2">
            {/* Toggle Sidebar Button */}
            <button
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className={cn(
                "p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer",
                isSidebarOpen
                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/60"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100"
              )}
              title={isSidebarOpen ? "Ocultar Árvore de Filtros Lateral" : "Exibir Árvore de Filtros Lateral"}
            >
              {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
              <span className="hidden md:inline">{isSidebarOpen ? "Fechar Painel" : "Filtros & Árvore"}</span>
            </button>

            {/* Global Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por frente, verso, QID (#4262), tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Deck Selector */}
            <select
              value={selectedDeckId}
              onChange={(e) => setSelectedDeckId(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 font-semibold"
            >
              <option value="all">Todos os Baralhos ({decks.length})</option>
              {decks.map(d => (
                <option key={d.id} value={d.id}>📁 {d.name} ({deckCounts.get(d.id) || 0})</option>
              ))}
            </select>

            {/* State Filter */}
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value as any)}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 font-semibold"
            >
              <option value="all">Todos os Estados ({cardCounts.all})</option>
              <option value="new">🌟 Novos ({cardCounts.new})</option>
              <option value="due">⏰ Pendentes Hoje ({cardCounts.due})</option>
              <option value="learning">📈 Em Aprendizado ({cardCounts.learning})</option>
              <option value="suspended">⏸️ Suspensos ({cardCounts.suspended})</option>
              <option value="flagged">🚩 Com Bandeira ({cardCounts.flagged})</option>
            </select>

            {/* Subject Selector */}
            {subjectList.length > 0 && (
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-2.5 py-1.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-700 dark:text-purple-300 font-semibold max-w-[170px]"
              >
                <option value="all">Todos Subjects ({subjectList.length})</option>
                {subjectList.map(s => (
                  <option key={s.key} value={s.key}>📚 {s.label} ({s.count})</option>
                ))}
              </select>
            )}

            {/* System Selector */}
            {allSystemsList.length > 0 && (
              <select
                value={selectedSystem}
                onChange={(e) => setSelectedSystem(e.target.value)}
                className="px-2.5 py-1.5 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 rounded-xl text-xs text-cyan-700 dark:text-cyan-300 font-semibold max-w-[170px]"
              >
                <option value="all">Todos Sistemas ({allSystemsList.length})</option>
                {allSystemsList.map(s => (
                  <option key={s.key} value={s.key}>🧬 {s.label} ({s.count})</option>
                ))}
              </select>
            )}

            {/* Flag Selector */}
            <select
              value={selectedFlag}
              onChange={(e) => setSelectedFlag(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 font-semibold"
            >
              <option value="all">Todas as Bandeiras</option>
              {Object.entries(FLAG_CONFIG).map(([k, cfg]) => (
                <option key={k} value={k}>🚩 {cfg.label} ({flagCounts[k] || 0})</option>
              ))}
            </select>

            {/* Tag Selector */}
            {tagCounts.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 font-semibold max-w-[160px]"
              >
                <option value="all">Todas as Tags ({tagCounts.length})</option>
                {tagCounts.slice(0, 50).map(({ tag, count }) => (
                  <option key={tag} value={tag}>🏷️ {tag} ({count})</option>
                ))}
              </select>
            )}

            {/* Sorting */}
            <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-0.5">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2 py-1 bg-transparent text-xs text-gray-700 dark:text-gray-300 font-semibold focus:outline-none"
                title="Ordenar por campo"
              >
                <option value="created">Criado</option>
                <option value="due">Próx. Revisão</option>
                <option value="front">Frente (A-Z)</option>
                <option value="interval">Intervalo</option>
                <option value="ease">Facilidade</option>
                <option value="reps">Repetições</option>
                <option value="lapses">Lapsos/Erros</option>
              </select>
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                title={sortOrder === 'asc' ? "Ascendente (Clique para decrescente)" : "Decrescente (Clique para ascendente)"}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setViewMode('split')}
                className={cn(
                  "p-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1",
                  viewMode === 'split' ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs" : "text-gray-500 hover:text-gray-900"
                )}
                title="Modo Dividido (Lista + Editor)"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden xl:inline text-[11px]">Dividido</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  "p-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1",
                  viewMode === 'table' ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs" : "text-gray-500 hover:text-gray-900"
                )}
                title="Modo Tabela Completa (Data Grid)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden xl:inline text-[11px]">Tabela</span>
              </button>
            </div>

            {/* Reset Filters */}
            <button
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 rounded-xl font-medium flex items-center gap-1 transition-colors"
              title="Limpar todos os filtros"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar</span>
            </button>

            {/* Add Card Button */}
            <button
              onClick={() => setIsAddCardOpen(true)}
              className="ml-auto px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Flashcard</span>
            </button>
          </div>

          {/* Bulk Actions Floating Toolbar */}
          {selectedCardIds.length > 0 && (
            <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-2 text-xs font-medium animate-slide-down">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-white text-blue-700 font-bold text-xs">
                  ✓ {selectedCardIds.length} selecionado{selectedCardIds.length > 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setSelectedCardIds([])}
                  className="text-blue-100 hover:text-white text-xs underline cursor-pointer"
                >
                  Desmarcar
                </button>
                <button
                  onClick={handleSelectAllCards}
                  className="text-blue-100 hover:text-white text-xs underline cursor-pointer ml-1"
                >
                  Selecionar todos ({sortedCards.length})
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Practice Selected */}
                <button
                  onClick={handleStudySelected}
                  className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 rounded-xl font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                  title="Iniciar sessão com os flashcards selecionados"
                >
                  <Play className="w-3 h-3 text-blue-600" />
                  <span>Estudar ({selectedCardIds.length})</span>
                </button>

                {/* Suspend / Resume */}
                <button
                  onClick={handleBulkSuspend}
                  className="px-2.5 py-1 bg-blue-700/80 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                  title="Suspender ou Reativar flashcards selecionados"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Suspender/Ativar</span>
                </button>

                {/* Move to Deck */}
                <button
                  onClick={() => setIsMoveModalOpen(true)}
                  className="px-2.5 py-1 bg-blue-700/80 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                  title="Mover cartões selecionados para outro baralho"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Mover Baralho</span>
                </button>

                {/* Set Flag Dropdown */}
                <div className="relative group">
                  <button
                    className="px-2.5 py-1 bg-blue-700/80 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                    title="Definir cor da bandeira para selecionados"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Bandeira</span>
                    <ChevronDown className="w-3 h-3 opacity-70" />
                  </button>
                  <div className="hidden group-hover:block absolute right-0 top-full pt-1 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 px-1.5 w-36 text-gray-800 dark:text-gray-200 text-xs">
                      <button
                        onClick={() => handleBulkSetFlag('')}
                        className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5 text-gray-400" />
                        <span>Sem bandeira</span>
                      </button>
                      {Object.entries(FLAG_CONFIG).map(([color, cfg]) => (
                        <button
                          key={color}
                          onClick={() => handleBulkSetFlag(color)}
                          className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5"
                        >
                          <span className={cn("w-2.5 h-2.5 rounded-full", cfg.dot)} />
                          <span>{cfg.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Add Tag */}
                <button
                  onClick={() => setIsAddTagModalOpen(true)}
                  className="px-2.5 py-1 bg-blue-700/80 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                  title="Adicionar tag a todos os selecionados"
                >
                  <TagIcon className="w-3.5 h-3.5" />
                  <span>Adicionar Tag</span>
                </button>

                {/* Schedule Today */}
                <button
                  onClick={handleBulkScheduleToday}
                  className="px-2.5 py-1 bg-blue-700/80 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                  title="Reprogramar todos os selecionados para revisão hoje"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Agendar Hoje</span>
                </button>

                {/* Bulk Delete */}
                <button
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="px-2.5 py-1 bg-red-500/90 hover:bg-red-600 text-white rounded-xl flex items-center gap-1 transition-colors cursor-pointer ml-1"
                  title="Excluir flashcards selecionados"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir ({selectedCardIds.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* Main Layout Area (Sidebar + Cards Browser) */}
          <div className="flex items-start gap-4 min-h-[750px]">
            {/* Sidebar (Tree & Navigation Panel) */}
            {isSidebarOpen && (
              <aside className="w-64 shrink-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 shadow-xs h-[750px] overflow-y-auto space-y-4 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="font-bold text-gray-500 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <FolderTree className="w-3.5 h-3.5 text-blue-600" />
                    Árvore de Filtros
                  </span>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700"
                    title="Fechar painel lateral"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Section: Baralhos (Decks) */}
                <div>
                  <div className="font-bold text-gray-700 dark:text-gray-300 text-[11px] mb-1 flex items-center justify-between">
                    <span>📁 BARALHOS</span>
                    <span className="text-[10px] text-gray-400">{decks.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    <button
                      onClick={() => setSelectedDeckId('all')}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded-xl flex items-center justify-between transition-colors",
                        selectedDeckId === 'all'
                          ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                    >
                      <span className="truncate">Todos os Baralhos</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gray-100 dark:bg-gray-800 font-mono">
                        {cardCounts.all}
                      </span>
                    </button>
                    {decks.map(d => {
                      const count = deckCounts.get(d.id) || 0;
                      return (
                        <button
                          key={d.id}
                          onClick={() => setSelectedDeckId(d.id)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded-xl flex items-center justify-between transition-colors",
                            selectedDeckId === d.id
                              ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                          )}
                        >
                          <span className="truncate">{d.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gray-100 dark:bg-gray-800 font-mono">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section: Estados dos Cartões */}
                <div>
                  <div className="font-bold text-gray-700 dark:text-gray-300 text-[11px] mb-1">
                    ⚡ ESTADO DO CARTÃO
                  </div>
                  <div className="space-y-0.5">
                    {[
                      { key: 'all', label: 'Todos os Cartões', count: cardCounts.all },
                      { key: 'new', label: '🌟 Novos', count: cardCounts.new },
                      { key: 'due', label: '⏰ Para Revisar Hoje', count: cardCounts.due, alert: cardCounts.due > 0 },
                      { key: 'learning', label: '📈 Em Aprendizado', count: cardCounts.learning },
                      { key: 'suspended', label: '⏸️ Suspensos', count: cardCounts.suspended },
                      { key: 'flagged', label: '🚩 Com Bandeira', count: cardCounts.flagged },
                    ].map(st => (
                      <button
                        key={st.key}
                        onClick={() => setFilterState(st.key as any)}
                        className={cn(
                          "w-full text-left px-2 py-1.5 rounded-xl flex items-center justify-between transition-colors",
                          filterState === st.key
                            ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                        )}
                      >
                        <span className="truncate">{st.label}</span>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                          st.alert ? "bg-rose-100 text-rose-700 font-bold dark:bg-rose-950/60 dark:text-rose-300" : "bg-gray-100 dark:bg-gray-800"
                        )}>
                          {st.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section: Bandeiras (Flags) */}
                <div>
                  <div className="font-bold text-gray-700 dark:text-gray-300 text-[11px] mb-1">
                    🚩 BANDEIRAS
                  </div>
                  <div className="space-y-0.5">
                    <button
                      onClick={() => setSelectedFlag('all')}
                      className={cn(
                        "w-full text-left px-2 py-1 rounded-xl flex items-center justify-between transition-colors",
                        selectedFlag === 'all'
                          ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                    >
                      <span>Todas</span>
                    </button>
                    {Object.entries(FLAG_CONFIG).map(([k, cfg]) => {
                      const count = flagCounts[k] || 0;
                      return (
                        <button
                          key={k}
                          onClick={() => setSelectedFlag(k)}
                          className={cn(
                            "w-full text-left px-2 py-1 rounded-xl flex items-center justify-between transition-colors",
                            selectedFlag === k
                              ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                          )}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", cfg.dot)} />
                            <span>{cfg.label}</span>
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gray-100 dark:bg-gray-800 font-mono">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section: Subjects */}
                {subjectList.length > 0 && (
                  <div>
                    <div className="font-bold text-gray-700 dark:text-gray-300 text-[11px] mb-1 flex items-center justify-between">
                      <span>📚 MATÉRIAS</span>
                      <span className="text-[10px] text-gray-400">{subjectList.length}</span>
                    </div>
                    <div className="space-y-0.5 max-h-40 overflow-y-auto pr-1">
                      <button
                        onClick={() => setSelectedSubject('all')}
                        className={cn(
                          "w-full text-left px-2 py-1 rounded-xl flex items-center justify-between transition-colors",
                          selectedSubject === 'all'
                            ? "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                        )}
                      >
                        <span>Todas as Matérias</span>
                      </button>
                      {subjectList.map(s => (
                        <button
                          key={s.key}
                          onClick={() => setSelectedSubject(s.key)}
                          className={cn(
                            "w-full text-left px-2 py-1 rounded-xl flex items-center justify-between transition-colors",
                            selectedSubject === s.key
                              ? "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                          )}
                        >
                          <span className="truncate">{s.label}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950/60 font-mono text-purple-700 dark:text-purple-300">
                            {s.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section: Tags */}
                {tagCounts.length > 0 && (
                  <div>
                    <div className="font-bold text-gray-700 dark:text-gray-300 text-[11px] mb-1 flex items-center justify-between">
                      <span>🏷️ TAGS</span>
                      <span className="text-[10px] text-gray-400">{tagCounts.length}</span>
                    </div>
                    <div className="mb-1.5">
                      <input
                        type="text"
                        placeholder="Filtrar tags..."
                        value={sidebarTagFilter}
                        onChange={(e) => setSidebarTagFilter(e.target.value)}
                        className="w-full px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px]"
                      />
                    </div>
                    <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
                      <button
                        onClick={() => setSelectedTag('all')}
                        className={cn(
                          "w-full text-left px-2 py-1 rounded-xl flex items-center justify-between transition-colors",
                          selectedTag === 'all'
                            ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                        )}
                      >
                        <span>Todas as Tags</span>
                      </button>
                      {tagCounts
                        .filter(({ tag }) => !sidebarTagFilter || tag.toLowerCase().includes(sidebarTagFilter.toLowerCase()))
                        .map(({ tag, count }) => (
                          <button
                            key={tag}
                            onClick={() => setSelectedTag(tag)}
                            className={cn(
                              "w-full text-left px-2 py-1 rounded-xl flex items-center justify-between transition-colors",
                              selectedTag === tag
                                ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold"
                                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                            )}
                          >
                            <span className="truncate">#{tag}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gray-100 dark:bg-gray-800 font-mono">
                              {count}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </aside>
            )}

            {/* Central Area: Split Mode or Full Table Mode */}
            <div className="flex-1 min-w-0">
              {viewMode === 'split' ? (
                /* Split View Layout */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[750px]">
                  {/* Cards List Column */}
                  <div className="lg:col-span-6 xl:col-span-7 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs overflow-hidden flex flex-col h-full">
                    {/* List Header */}
                    <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs font-semibold text-gray-500 bg-gray-50/50 dark:bg-gray-800/30">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSelectAllCards}
                          className="text-gray-500 hover:text-blue-600 transition-colors"
                          title={selectedCardIds.length === sortedCards.length && sortedCards.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
                        >
                          {selectedCardIds.length > 0 && selectedCardIds.length === sortedCards.length ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : selectedCardIds.length > 0 ? (
                            <CheckSquare className="w-4 h-4 text-blue-400 opacity-70" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <span>Frente / Enunciado ({sortedCards.length})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>Baralho & Status</span>
                      </div>
                    </div>

                    {/* Virtualized Cards List */}
                    <div className="flex-1 w-full relative">
                      {sortedCards.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 text-xs flex flex-col items-center justify-center h-full">
                          <Search className="w-8 h-8 text-gray-300 dark:text-gray-700 mb-2" />
                          <span>Nenhum flashcard encontrado com os filtros selecionados.</span>
                        </div>
                      ) : (
                        <Virtuoso
                          style={{ height: '100%', width: '100%' }}
                          totalCount={sortedCards.length}
                          data={sortedCards}
                          itemContent={(index, card) => {
                            const isActive = activeCard?.id === card.id;
                            const isSelected = selectedCardIds.includes(card.id);
                            const deckName = deckMap.get(card.deckId) || 'Geral';
                            const cardSub = getCardSubject(card);
                            const dueInfo = formatCardDueDate(card);
                            const flagCfg = card.flag ? FLAG_CONFIG[card.flag] : null;

                            return (
                              <div
                                key={card.id}
                                onClick={() => setActiveCardId(card.id)}
                                className={cn(
                                  "p-3 flex items-start justify-between gap-3 cursor-pointer transition-colors text-xs border-b border-gray-100 dark:border-gray-800/60 select-none",
                                  isSelected
                                    ? "bg-blue-50/60 dark:bg-blue-950/40"
                                    : isActive
                                    ? "bg-blue-50/90 dark:bg-blue-950/60 border-l-4 border-l-blue-600"
                                    : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                                )}
                              >
                                {/* Checkbox */}
                                <button
                                  onClick={(e) => handleToggleSelectCard(card.id, e)}
                                  className="mt-0.5 text-gray-400 hover:text-blue-600 transition-colors shrink-0"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>

                                {/* Card Main Content Preview */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                    {flagCfg && (
                                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded border", flagCfg.bg, flagCfg.text)}>
                                        <span className={cn("w-1.5 h-1.5 rounded-full", flagCfg.dot)} />
                                        {flagCfg.label}
                                      </span>
                                    )}
                                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.2 rounded", dueInfo.badgeClass)}>
                                      {dueInfo.text}
                                    </span>
                                    {extractCardQids(card, deckName).map(qid => (
                                      <span key={qid} className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-900/50">
                                        QID: #{qid}
                                      </span>
                                    ))}
                                    {cardSub && (
                                      <span className="text-[10px] bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 font-semibold px-1.5 py-0.2 rounded">
                                        {cardSub.label}
                                      </span>
                                    )}
                                  </div>

                                  <div
                                    className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderCardText(card.front, false)) }}
                                  />

                                  {card.back && (
                                    <div
                                      className="text-gray-500 dark:text-gray-400 text-[11px] line-clamp-1 mt-1 leading-normal opacity-85"
                                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderCardText(card.back, true)) }}
                                    />
                                  )}
                                </div>

                                {/* Right Side: Deck & Reps */}
                                <div className="shrink-0 flex flex-col items-end gap-1">
                                  <span className="text-[11px] text-gray-500 font-semibold truncate max-w-[120px] text-right">
                                    {deckName}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-mono">
                                    {card.repetition ? `${card.repetition} reps (${card.interval || 0}d)` : 'Novo'}
                                  </span>
                                </div>
                              </div>
                            );
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Active Card Details & Editor Column */}
                  <div className="lg:col-span-6 xl:col-span-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs overflow-y-auto h-full space-y-4">
                    {activeCard ? (
                      <div className="space-y-4">
                        {/* Header Action Toolbar */}
                        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800 gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            {/* Flag Switcher */}
                            <div className="relative group">
                              <button
                                className={cn(
                                  "p-1.5 rounded-xl border flex items-center gap-1 transition-colors text-xs font-semibold cursor-pointer",
                                  activeCard.flag ? FLAG_CONFIG[activeCard.flag]?.bg : "border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100"
                                )}
                                title="Alterar bandeira deste flashcard"
                              >
                                <Flag className={cn("w-3.5 h-3.5", activeCard.flag ? FLAG_CONFIG[activeCard.flag]?.text : "text-gray-400")} />
                                <ChevronDown className="w-3 h-3 opacity-60" />
                              </button>
                              <div className="hidden group-hover:block absolute left-0 top-full pt-1 z-50">
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-1 w-36 text-xs">
                                  <button
                                    onClick={() => updateCard(activeCard.id, { flag: undefined })}
                                    className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5 text-gray-600 dark:text-gray-300"
                                  >
                                    <XCircle className="w-3.5 h-3.5 text-gray-400" />
                                    <span>Sem bandeira</span>
                                  </button>
                                  {Object.entries(FLAG_CONFIG).map(([col, cfg]) => (
                                    <button
                                      key={col}
                                      onClick={() => updateCard(activeCard.id, { flag: col })}
                                      className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5"
                                    >
                                      <span className={cn("w-2.5 h-2.5 rounded-full", cfg.dot)} />
                                      <span className={cfg.text}>{cfg.label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Suspend / Resume Toggle */}
                            <button
                              onClick={() => toggleSuspendCard(activeCard.id)}
                              className={cn(
                                "px-2.5 py-1 rounded-xl text-xs font-semibold border flex items-center gap-1 transition-colors cursor-pointer",
                                activeCard.isSuspended
                                  ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                                  : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100"
                              )}
                              title={activeCard.isSuspended ? "Reativar este flashcard" : "Suspender este flashcard"}
                            >
                              <PauseCircle className="w-3.5 h-3.5" />
                              <span>{activeCard.isSuspended ? "Reativar" : "Suspender"}</span>
                            </button>

                            {/* Schedule for Today */}
                            <button
                              onClick={() => {
                                scheduleCardForToday(activeCard.id);
                                notify("Flashcard agendado para revisão hoje!", "success");
                              }}
                              className="px-2.5 py-1 rounded-xl text-xs font-semibold border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors cursor-pointer"
                              title="Agendar este flashcard para revisão hoje"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Revisar Hoje</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Study Single Card */}
                            <button
                              onClick={() => onNavigate({ type: 'study', cardIds: [activeCard.id] })}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Praticar</span>
                            </button>

                            {/* Delete Single Card */}
                            <button
                              onClick={() => {
                                if (confirm("Tem certeza que deseja excluir este flashcard permanentemente?")) {
                                  deleteCard(activeCard.id);
                                  notify("Flashcard excluído.", "info");
                                }
                              }}
                              className="p-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="Excluir este flashcard"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* SM-2 Algorithm & Performance Stats Box */}
                        <div className="p-3 bg-gray-50/80 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-gray-400 block">Status SM-2</span>
                            <span className={cn("font-bold", formatCardDueDate(activeCard).badgeClass, "px-1.5 py-0.2 rounded inline-block mt-0.5 text-[10px]")}>
                              {formatCardDueDate(activeCard).label}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400 block">Intervalo</span>
                            <span className="font-bold text-gray-800 dark:text-gray-200">
                              {activeCard.interval ? `${activeCard.interval} dias` : '0 dias'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400 block">Facilidade (Ease)</span>
                            <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">
                              {Math.round((activeCard.easeFactor || 2.5) * 100)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400 block">Repetições / Lapsos</span>
                            <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">
                              {activeCard.repetition || 0} / {activeCard.lapses || 0}
                            </span>
                          </div>
                        </div>

                        {/* Linked Q-Bank Question Box (if questionId exists) */}
                        {activeCard.questionId && (
                          <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-2xl flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                              <div>
                                <span className="font-bold text-blue-800 dark:text-blue-300">Questão Q-Bank: #{activeCard.questionId}</span>
                                {activeCard.subject && (
                                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                                    {activeCard.subject} {activeCard.system ? `• ${activeCard.system}` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setActiveTab('questions');
                                setSearch(activeCard.questionId || '');
                              }}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <span>Ver no Banco</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Inline Full Card Editor */}
                        <div className="pt-2">
                          <CardEditor
                            key={activeCard.id}
                            card={activeCard}
                            onUpdate={(id, f, b, d, tags, flag) => {
                              updateCard(id, { front: f, back: b, details: d, tags, flag });
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-gray-400">
                        Selecione um flashcard para visualizar estatísticas e editar.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Full Table View (Data Grid) */
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs overflow-hidden h-[750px] flex flex-col">
                  {/* Table Header */}
                  <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 grid grid-cols-12 gap-2 text-xs font-bold text-gray-500 items-center">
                    <div className="col-span-1 flex items-center gap-2">
                      <button
                        onClick={handleSelectAllCards}
                        className="text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        {selectedCardIds.length > 0 && selectedCardIds.length === sortedCards.length ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : selectedCardIds.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-blue-400 opacity-70" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <span>Flag</span>
                    </div>
                    <div className="col-span-2">Estado / Próx. Revisão</div>
                    <div className="col-span-4">Frente / QID</div>
                    <div className="col-span-2">Baralho / Matéria</div>
                    <div className="col-span-1 text-center">Reps (Dias)</div>
                    <div className="col-span-2 text-right">Ações Rápidas</div>
                  </div>

                  {/* Virtualized Table Body */}
                  <div className="flex-1 w-full relative">
                    {sortedCards.length === 0 ? (
                      <div className="p-12 text-center text-gray-400 text-xs flex flex-col items-center justify-center h-full">
                        <Search className="w-8 h-8 text-gray-300 dark:text-gray-700 mb-2" />
                        <span>Nenhum flashcard encontrado.</span>
                      </div>
                    ) : (
                      <Virtuoso
                        style={{ height: '100%', width: '100%' }}
                        totalCount={sortedCards.length}
                        data={sortedCards}
                        itemContent={(index, card) => {
                          const isSelected = selectedCardIds.includes(card.id);
                          const isActive = activeCard?.id === card.id;
                          const deckName = deckMap.get(card.deckId) || 'Geral';
                          const dueInfo = formatCardDueDate(card);
                          const flagCfg = card.flag ? FLAG_CONFIG[card.flag] : null;

                          return (
                            <div
                              key={card.id}
                              onClick={() => setActiveCardId(card.id)}
                              className={cn(
                                "p-3 border-b border-gray-100 dark:border-gray-800/60 grid grid-cols-12 gap-2 text-xs items-center cursor-pointer transition-colors select-none",
                                isSelected
                                  ? "bg-blue-50/60 dark:bg-blue-950/40"
                                  : isActive
                                  ? "bg-blue-50/90 dark:bg-blue-950/60 border-l-4 border-l-blue-600"
                                  : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                              )}
                            >
                              {/* Selection & Flag */}
                              <div className="col-span-1 flex items-center gap-2">
                                <button
                                  onClick={(e) => handleToggleSelectCard(card.id, e)}
                                  className="text-gray-400 hover:text-blue-600 transition-colors"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                                {flagCfg ? (
                                  <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", flagCfg.dot)} title={`Bandeira ${flagCfg.label}`} />
                                ) : (
                                  <span className="w-2.5 h-2.5 rounded-full border border-gray-300 dark:border-gray-700 opacity-40" />
                                )}
                              </div>

                              {/* State & Due */}
                              <div className="col-span-2">
                                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", dueInfo.badgeClass)}>
                                  {dueInfo.text}
                                </span>
                                {card.nextReviewDate && card.repetition > 0 && (
                                  <span className="text-[10px] text-gray-400 block mt-0.5">
                                    {format(card.nextReviewDate, 'dd/MM/yyyy')}
                                  </span>
                                )}
                              </div>

                              {/* Front & QID */}
                              <div className="col-span-4 min-w-0 pr-2">
                                <div
                                  className="font-medium text-gray-900 dark:text-gray-100 line-clamp-1"
                                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderCardText(card.front, false)) }}
                                />
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {extractCardQids(card, deckName).map(qid => (
                                    <span key={qid} className="text-[10px] text-blue-600 font-bold">
                                      #{qid}
                                    </span>
                                  ))}
                                  {card.tags?.slice(0, 3).map(t => (
                                    <span key={t} className="text-[9px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1 rounded">
                                      #{t}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Deck & Subject */}
                              <div className="col-span-2 min-w-0">
                                <span className="font-semibold text-gray-800 dark:text-gray-200 block truncate">
                                  {deckName}
                                </span>
                                {card.subject && (
                                  <span className="text-[10px] text-purple-600 dark:text-purple-400 block truncate">
                                    {card.subject}
                                  </span>
                                )}
                              </div>

                              {/* Reps & Interval */}
                              <div className="col-span-1 text-center font-mono">
                                <span className="font-bold text-gray-700 dark:text-gray-300">
                                  {card.repetition || 0}
                                </span>
                                <span className="text-[10px] text-gray-400 block">
                                  {card.interval || 0}d
                                </span>
                              </div>

                              {/* Action Buttons */}
                              <div className="col-span-2 flex items-center justify-end gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate({ type: 'study', cardIds: [card.id] });
                                  }}
                                  className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors"
                                  title="Praticar Flashcard"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSuspendCard(card.id);
                                  }}
                                  className={cn(
                                    "p-1 rounded transition-colors",
                                    card.isSuspended ? "text-amber-600 bg-amber-50" : "text-gray-400 hover:text-gray-600"
                                  )}
                                  title={card.isSuspended ? "Reativar card" : "Suspender card"}
                                >
                                  <PauseCircle className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveCardId(card.id);
                                    setViewMode('split');
                                  }}
                                  className="p-1 hover:bg-gray-100 text-gray-500 rounded transition-colors"
                                  title="Editar Flashcard"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm("Excluir este flashcard?")) {
                                      deleteCard(card.id);
                                    }
                                  }}
                                  className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors"
                                  title="Excluir Flashcard"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Move Modal */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Folder className="w-4 h-4 text-blue-600" />
                Mover {selectedCardIds.length} Flashcards
              </h3>
              <button
                onClick={() => setIsMoveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Selecione o baralho de destino para transferir todos os flashcards selecionados:
            </p>
            <select
              value={targetMoveDeckId}
              onChange={(e) => setTargetMoveDeckId(e.target.value)}
              className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200"
            >
              <option value="">Selecione o Baralho de Destino...</option>
              {decks.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({deckCounts.get(d.id) || 0} cards)</option>
              ))}
            </select>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsMoveModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border text-xs text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                disabled={!targetMoveDeckId}
                onClick={handleBulkMove}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Mover Cartões
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Tag Modal */}
      {isAddTagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <TagIcon className="w-4 h-4 text-blue-600" />
                Adicionar Tag em Massa ({selectedCardIds.length} cartões)
              </h3>
              <button
                onClick={() => setIsAddTagModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Digite o nome da tag que deseja adicionar aos {selectedCardIds.length} flashcards selecionados:
            </p>
            <input
              type="text"
              placeholder="Ex: uworld-step1, high-yield, cardio..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleBulkAddTag(); }}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {tagCounts.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] text-gray-400 font-semibold">Ou escolha uma tag existente:</span>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {tagCounts.slice(0, 15).map(({ tag }) => (
                    <button
                      key={tag}
                      onClick={() => setNewTagInput(tag)}
                      className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAddTagModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border text-xs text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                disabled={!newTagInput.trim()}
                onClick={handleBulkAddTag}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Adicionar Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-red-200 dark:border-red-900/60 shadow-xl max-w-md w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                  Excluir {selectedCardIds.length} Flashcards?
                </h3>
                <p className="text-xs text-red-600 dark:text-red-400">
                  Esta ação é irreversível e removerá permanentemente os cartões selecionados.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border text-xs text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Sim, Excluir Flashcards
              </button>
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
