import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useStore, Flashcard, DEFAULT_SETTINGS } from '../store/useStore';
import { Page } from '../App';
import {
  ArrowLeft,
  Calendar,
  Edit2,
  Eye,
  EyeOff,
  PlayCircle,
  Trash2,
  Pause,
  SkipForward,
  ExternalLink,
  Edit3,
  Activity,
  CheckCircle2,
  Volume2,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { Rating } from '../lib/sm2';
import { matchShortcut, cn, renderCardText, sanitizeHtml } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { RichEditor } from '../components/RichEditor';
import { IsolatedHtml } from '../components/IsolatedHtml';
import { NotepadModal } from '../components/NotepadModal';
import { AutoHighlighter } from '../components/AutoHighlighter';
import { useTimerStore } from '../../store/useTimerStore';

export function formatTime(minutes: number): string {
  if (minutes < 60) return `< ${Math.max(1, Math.round(minutes))}m`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`;
  if (minutes < 30 * 24 * 60) return `${Math.round(minutes / (24 * 60))}d`;
  if (minutes < 12 * 30 * 24 * 60) return `${Math.round(minutes / (30 * 24 * 60))}mês`;
  return `${Math.round(minutes / (365 * 24 * 60))}ano`;
}

interface StudySessionProps {
  deckId?: string;
  cardIds?: string[];
  onNavigate: (page: Page) => void;
}

export function StudySession({ deckId, cardIds, onNavigate }: StudySessionProps) {
  const { decks, cards, reviewCards, reviewCardsCustom, settings, updateSettings, updateCard, deleteCard } = useStore();
  const { pacerIsActive, pacerTotalQuestions, pacerCompletedQuestionsTime } = useTimerStore();
  const deck = decks.find(d => d.id === deckId);
  const [phase, setPhase] = useState<'question' | 'answer'>('question');
  const [customDays, setCustomDays] = useState<string>('');
  const [remainingCustomCardIds, setRemainingCustomCardIds] = useState<string[]>(cardIds || []);
  
  // Track editing state per card using its ID
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [showNotesForCard, setShowNotesForCard] = useState<string | null>(null);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [showEditBackPreview, setShowEditBackPreview] = useState(true);
  const [peekCards, setPeekCards] = useState<Record<string, boolean>>({});
  const [isPeekAll, setIsPeekAll] = useState(false);
  
  // All due cards
  const dueCards = useMemo(() => {
    const now = Date.now();
    let filtered: Flashcard[] = [];
    if (cardIds) {
      filtered = cards.filter(c => remainingCustomCardIds.includes(c.id));
    } else {
      filtered = cards.filter(c => c.deckId === deckId && c.nextReviewDate <= now && !c.isSuspended && !c.isBuried);
    }
    
    const deckOrder = deck?.settings?.cardOrder || settings.cardOrder || 'newFirst';
    if (deckOrder === 'newFirst') {
      filtered.sort((a, b) => a.repetition - b.repetition);
    } else if (deckOrder === 'reviewsFirst') {
      filtered.sort((a, b) => b.repetition - a.repetition);
    } else if (deckOrder === 'random') {
      filtered.sort(() => Math.random() - 0.5);
    }
    
    return filtered;
  }, [cards, deckId, cardIds, remainingCustomCardIds, deck?.settings?.cardOrder, settings.cardOrder]);

  // Current block of cards
  const [currentBlock, setCurrentBlock] = useState<Flashcard[]>([]);
  // Which cards are selected (checked) in the answer phase
  const [selectedCards, setSelectedCards] = useState<Record<string, boolean>>({});

  // Initialize block
  useEffect(() => {
    if (currentBlock.length === 0 && dueCards.length > 0) {
      const perBlock = deck?.settings?.cardsPerBlock || settings.cardsPerBlock;
      const nextBlock = dueCards.slice(0, perBlock);
      setCurrentBlock(nextBlock);
      setPhase('question');
      setCustomDays('');
      setPeekCards({});
      setIsPeekAll(false);
      setShowDetails({});
      
      const initialSelection: Record<string, boolean> = {};
      nextBlock.forEach(c => initialSelection[c.id] = true);
      setSelectedCards(initialSelection);
    }
  }, [dueCards, currentBlock, settings.cardsPerBlock, deck?.settings?.cardsPerBlock]);

  const togglePeek = (id: string) => {
    setPeekCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Details toggle state
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  const hasStudied = useRef(false);

  const toggleDetails = (id: string) => {
    setShowDetails(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const applyTtsSettings = (utterance: SpeechSynthesisUtterance) => {
    if (settings.ttsVoiceURI) {
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find(v => v.voiceURI === settings.ttsVoiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }
    utterance.rate = settings.ttsRate ?? 1;
    utterance.pitch = settings.ttsPitch ?? 1;
  };

  const playAllTTS = () => {
    window.speechSynthesis.cancel();
    
    currentBlock.forEach((card) => {
      const htmlText = phase === 'answer' || isPeekAll || peekCards[card.id] ? `${card.front}. \n\n ${card.back}` : card.front;
      const temp = document.createElement('div');
      temp.innerHTML = sanitizeHtml(htmlText);
      const text = temp.textContent || temp.innerText || "";
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      applyTtsSettings(utterance);
      window.speechSynthesis.speak(utterance);
    });
  };

  const handleShowAnswers = useCallback(() => {
    if (editingCardId) {
      updateCard(editingCardId, editFront, editBack, editDetails);
      setCurrentBlock(prev => prev.map(c => c.id === editingCardId ? { ...c, front: editFront, back: editBack, details: editDetails } : c));
      setEditingCardId(null);
    }
    setPhase('answer');
  }, [editingCardId, editFront, editBack, editDetails, updateCard]);

  const handleRate = useCallback((rating: Rating) => {
    if (editingCardId) {
      updateCard(editingCardId, editFront, editBack, editDetails);
      setEditingCardId(null);
    }
    const idsToRate = Object.keys(selectedCards).filter(id => selectedCards[id]);
    
    if (idsToRate.length === 0) {
      setCurrentBlock([]);
      return;
    }

    if (idsToRate.length > 0) {
      hasStudied.current = true;
      reviewCards(idsToRate, rating);
      if (cardIds && rating !== 'again') {
        setRemainingCustomCardIds(prev => prev.filter(id => !idsToRate.includes(id)));
      }
      const tStore = useTimerStore.getState();
      if (tStore.pacerIsActive) {
        tStore.nextPacerQuestion();
      }
    }

    setCurrentBlock([]);
  }, [selectedCards, reviewCards, cardIds, editingCardId, editFront, editBack, editDetails, updateCard]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const s = settings.shortcuts || {
        showAnswer: 'space', again: '1', hard: '2', good: '3', easy: '4', playTTS: 'p', bury: 'ctrl+k', suspend: 'ctrl+j', undo: 'ctrl+z', redo: 'ctrl+shift+z|ctrl+y'
      };

      if (matchShortcut(e as any, s.undo)) {
        e.preventDefault();
        useStore.temporal.getState().undo();
        setCurrentBlock([]);
        setPhase('question');
        return;
      }

      if (matchShortcut(e as any, s.redo)) {
        e.preventDefault();
        useStore.temporal.getState().redo();
        setCurrentBlock([]);
        setPhase('question');
        return;
      }
      
      if (phase === 'question') {
        if (matchShortcut(e as any, s.showAnswer)) {
          e.preventDefault();
          handleShowAnswers();
        } else if (matchShortcut(e as any, s.playTTS)) {
          e.preventDefault();
          playAllTTS();
        } else if (matchShortcut(e as any, s.bury) && currentBlock.length > 0) {
          e.preventDefault();
          handleBuryCard(currentBlock[0].id);
        } else if (matchShortcut(e as any, s.suspend) && currentBlock.length > 0) {
          e.preventDefault();
          handleSuspendCard(currentBlock[0].id);
        }
      } else if (phase === 'answer') {
        if (matchShortcut(e as any, s.again)) { e.preventDefault(); handleRate('again'); }
        else if (matchShortcut(e as any, s.hard)) { e.preventDefault(); handleRate('hard'); }
        else if (matchShortcut(e as any, s.good)) { e.preventDefault(); handleRate('good'); }
        else if (matchShortcut(e as any, s.easy)) { e.preventDefault(); handleRate('easy'); }
        else if (matchShortcut(e as any, s.playTTS)) { e.preventDefault(); playAllTTS(); }
        else if (matchShortcut(e as any, s.bury) && currentBlock.length > 0) { e.preventDefault(); handleBuryCard(currentBlock[0].id); }
        else if (matchShortcut(e as any, s.suspend) && currentBlock.length > 0) { e.preventDefault(); handleSuspendCard(currentBlock[0].id); }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, settings.shortcuts, handleShowAnswers, handleRate, playAllTTS]);

  const toggleCardSelection = (id: string) => {
    setSelectedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const startEditing = (card: Flashcard) => {
    setEditingCardId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
    setEditDetails(card.details || '');
    setShowEditBackPreview(phase === 'answer');
  };

  const saveEdit = (cardId: string) => {
    updateCard(cardId, editFront, editBack, editDetails);
    setCurrentBlock(prev => prev.map(c => c.id === cardId ? { ...c, front: editFront, back: editBack, details: editDetails } : c));
    setEditingCardId(null);
  };

  const cancelEdit = () => {
    setEditingCardId(null);
  };

  const handleSuspendCard = (cardId: string) => {
    useStore.getState().toggleSuspendCard(cardId);
    setCurrentBlock(prev => prev.filter(c => c.id !== cardId));
  };

  const handleBuryCard = (cardId: string) => {
    useStore.getState().toggleBuryCard(cardId);
    setCurrentBlock(prev => prev.filter(c => c.id !== cardId));
  };

  const confirmDeleteCard = () => {
    if (!cardToDelete) return;
    deleteCard(cardToDelete);
    setCurrentBlock(prev => prev.filter(c => c.id !== cardToDelete));
    setCardToDelete(null);
  };

  const playTTS = (htmlText: string) => {
    const temp = document.createElement('div');
    temp.innerHTML = sanitizeHtml(htmlText);
    const text = temp.textContent || temp.innerText || "";
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      applyTtsSettings(utterance);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleRateCustom = () => {
    const days = parseInt(customDays, 10);
    if (isNaN(days) || days <= 0) return;

    const idsToRate = Object.keys(selectedCards).filter(id => selectedCards[id]);
    if (idsToRate.length === 0) {
      setCurrentBlock([]);
      return;
    }

    if (idsToRate.length > 0) {
      hasStudied.current = true;
      reviewCardsCustom(idsToRate, days);
    }
    setCurrentBlock([]);
  };

  const getNextIntervals = () => {
    const selectedIds = Object.keys(selectedCards).filter(id => selectedCards[id]);
    const activeCards = currentBlock.filter(c => selectedIds.includes(c.id));
    if (activeCards.length === 0) return { again: '< 1m', hard: '-', good: '-', easy: '-' };
    
    const avgInterval = activeCards.reduce((acc, c) => acc + c.interval, 0) / activeCards.length;
    const isNew = activeCards.every(c => c.repetition === 0);
    
    const safeSettings = { ...DEFAULT_SETTINGS, ...settings };
    
    if (isNew) {
      return {
        again: formatTime(safeSettings.newAgainMinutes || 15),
        hard: formatTime(safeSettings.newHardMinutes || 1440),
        good: formatTime(safeSettings.newGoodMinutes || 5760),
        easy: formatTime(safeSettings.newEasyMinutes || 14400),
      };
    }
    
    return {
      again: formatTime(safeSettings.againMinutes),
      hard: formatTime(Math.max(safeSettings.hardMinMinutes, avgInterval * safeSettings.hardMultiplier)),
      good: formatTime(avgInterval === 0 ? 10 : avgInterval * safeSettings.goodMultiplier),
      easy: formatTime(avgInterval === 0 ? (4 * 24 * 60) : avgInterval * safeSettings.easyMultiplier),
    };
  };

  const intervals = getNextIntervals();

  if (!deck && !cardIds) {
    onNavigate({ type: 'home' });
    return null;
  }

  // Session Completed state
  if (dueCards.length === 0 && currentBlock.length === 0) {
    return (
      <div className="text-center py-16 px-4 max-w-xl mx-auto">
        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
          Parabéns! Sessão Concluída
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
          Você revisou todos os cartões agendados para <strong>{deck?.name || 'esta seleção'}</strong>. Todos os flashcards estão em dia!
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button 
            onClick={() => onNavigate({ type: 'home' })}
            className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-2xs"
          >
            Voltar aos Baralhos
          </button>
          <button 
            onClick={() => onNavigate({ type: 'browse', deckId: deckId })}
            className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-2xs"
          >
            Explorar Cartões
          </button>
          {deckId && (
            <button 
              onClick={() => onNavigate({ type: 'deck', deckId: deckId })}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-sm shadow-blue-500/20 transition-all"
            >
              Gerenciar Baralho
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <AutoHighlighter className="max-w-4xl mx-auto flex flex-col min-h-[calc(100vh-10rem)]">
      {/* Top Session Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-xs mb-6">
        <button 
          onClick={() => onNavigate({ type: 'home' })}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Sair da Sessão</span>
        </button>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {pacerIsActive && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-mono font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 shadow-xs">
              <Activity className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              <span>Pacer Q{pacerCompletedQuestionsTime.length + 1}/{pacerTotalQuestions}</span>
            </div>
          )}

          <button 
            onClick={() => setIsPeekAll(!isPeekAll)} 
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors",
              isPeekAll 
                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800" 
                : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100"
            )}
            title="Ver todas as respostas temporariamente"
          >
             {isPeekAll ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
             <span>{isPeekAll ? 'Ocultar Respostas' : 'Espiar Respostas'}</span>
          </button>

          <button 
            onClick={playAllTTS} 
            className="flex items-center gap-1.5 text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-750 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors"
            title="Ouvir leitura em voz alta"
          >
             <Volume2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
             <span>Ler Bloco</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            <span>Por bloco:</span>
            <select 
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none"
              value={settings.cardsPerBlock}
              onChange={(e) => updateSettings({ cardsPerBlock: Number(e.target.value) })}
            >
              <option value={1}>1</option>
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </div>

          <div className="px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 text-xs font-bold whitespace-nowrap">
            {dueCards.length} restantes
          </div>
        </div>
      </div>

      {/* Main Flashcard Block View */}
      <div className="flex-1 space-y-4">
        <AnimatePresence mode="popLayout">
          {currentBlock.map((card, index) => {
            const isCardPeeked = isPeekAll || peekCards[card.id];
            const isRevealed = phase === 'answer' || isCardPeeked;
            const isSelected = selectedCards[card.id] !== false;

            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18, delay: index * 0.04 }}
                className={cn(
                  "bg-white dark:bg-gray-900 border rounded-2xl p-5 sm:p-6 transition-all shadow-xs",
                  phase === 'answer' && !isSelected 
                    ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/15 opacity-70"
                    : "border-gray-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600/70"
                )}
              >
                <div className="flex flex-col gap-4">
                  {/* Card Header inside block */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900/50">
                        {isRevealed ? 'Cartão Revelado' : 'Frente'}
                      </span>
                      {card.flag && (
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                           card.flag === 'red' ? 'bg-red-500' :
                           card.flag === 'orange' ? 'bg-orange-500' :
                           card.flag === 'green' ? 'bg-emerald-500' :
                           card.flag === 'blue' ? 'bg-blue-500' :
                           card.flag === 'purple' ? 'bg-purple-500' :
                           'bg-gray-400'
                        }`} />
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-1.5">
                       {phase === 'answer' && !isSelected && (
                          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900/50 mr-1">
                            Ignorado nesta avaliação
                          </span>
                       )}

                       {card.sourceQuestionId && (
                         <button 
                           onClick={() => onNavigate({ type: 'question', questionId: card.sourceQuestionId })}
                           className="p-1 px-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors flex items-center gap-1"
                           title="Ver questão original"
                         >
                           <ExternalLink className="w-3.5 h-3.5" />
                           <span>Questão</span>
                         </button>
                       )}

                       <button 
                         onClick={() => setShowNotesForCard(card.id)}
                         className="p-1 px-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors flex items-center gap-1"
                         title="Anotações"
                       >
                         <Edit3 className="w-3.5 h-3.5" />
                         <span>Notas</span>
                       </button>

                       <button 
                         onClick={() => playTTS(isRevealed ? `${card.front}. \n\n ${card.back}` : card.front)}
                         className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                         title="Ouvir cartão"
                       >
                         <Volume2 className="w-4 h-4" />
                       </button>

                       {phase === 'question' && (
                         <button 
                           onClick={() => togglePeek(card.id)}
                           className={cn(
                             "p-1.5 rounded-lg transition-colors",
                             peekCards[card.id] ? "text-blue-600 bg-blue-50 dark:bg-blue-950/40" : "text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                           )}
                           title="Espiar resposta deste cartão"
                         >
                           {peekCards[card.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                         </button>
                       )}

                       <button 
                         onClick={() => startEditing(card)}
                         className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                         title="Editar cartão"
                       >
                         <Edit2 className="w-4 h-4" />
                       </button>

                       <button 
                         onClick={() => handleBuryCard(card.id)}
                         className="p-1.5 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                         title="Adiar cartão para amanhã"
                       >
                         <SkipForward className="w-4 h-4" />
                       </button>

                       <button 
                         onClick={() => handleSuspendCard(card.id)}
                         className="p-1.5 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                         title="Suspender cartão"
                       >
                         <Pause className="w-4 h-4" />
                       </button>

                       <button 
                         onClick={() => setCardToDelete(card.id)}
                         className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                         title="Excluir cartão"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>

                       {phase === 'answer' && (
                          <label className="flex items-center gap-1.5 cursor-pointer ml-1 select-none">
                            <input 
                              type="checkbox"
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                              checked={isSelected}
                              onChange={() => toggleCardSelection(card.id)}
                            />
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Incluir</span>
                          </label>
                       )}
                    </div>
                  </div>
                  
                  {/* Card Content / Card Editor */}
                  {editingCardId === card.id ? (
                    <div className="space-y-4 pt-1">
                      <div>
                         <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Editando Frente</div>
                         <RichEditor value={editFront} onChange={setEditFront} />
                      </div>
                      <div>
                         <div className="flex items-center justify-between mb-1">
                           <div className="text-xs font-bold text-gray-700 dark:text-gray-300">Editando Verso & Detalhes</div>
                           <button 
                             onClick={() => setShowEditBackPreview(!showEditBackPreview)}
                             className="text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 text-xs"
                           >
                             {showEditBackPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                             <span>{showEditBackPreview ? 'Ocultar Detalhes' : 'Mostrar Detalhes'}</span>
                           </button>
                         </div>
                         {showEditBackPreview ? (
                           <div className="space-y-3">
                             <RichEditor value={editBack} onChange={setEditBack} />
                             <div>
                               <div className="text-xs font-medium text-gray-500 mb-1">Detalhes Adicionais (Opcional)</div>
                               <RichEditor value={editDetails} onChange={setEditDetails} />
                             </div>
                           </div>
                         ) : (
                           <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-400 text-xs text-center">
                              Detalhes ocultados temporariamente.
                           </div>
                         )}
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button 
                          onClick={cancelEdit} 
                          className="px-4 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={() => saveEdit(card.id)} 
                          className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs transition-all"
                        >
                          Salvar Alterações
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <IsolatedHtml 
                        className={cn(
                          "text-base text-gray-900 dark:text-gray-100 py-1",
                          isRevealed && "reveal-masks"
                        )}
                        frontHtml={renderCardText(card.front, isRevealed)}
                        showBack={isRevealed}
                        backHtml={renderCardText(card.back, true)}
                        detailsHtml={showDetails[card.id] && card.details ? renderCardText(card.details, true) : undefined}
                      />
                      
                      {isRevealed && (
                        <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
                          {(card.details || (card.tags && card.tags.length > 0)) && (
                            <div>
                              {card.details && (
                                <button 
                                  onClick={() => toggleDetails(card.id)}
                                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-wider inline-flex items-center gap-1"
                                >
                                  {showDetails[card.id] ? '- Ocultar Detalhes Extras' : '+ Ver Explicação Completa'}
                                </button>
                              )}
                              
                              {card.tags && card.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {card.tags.map(t => (
                                    <span key={t} className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 text-[10px] font-semibold">
                                      #{t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="sticky bottom-4 pt-6 pb-2 z-20">
        {phase === 'question' ? (
          <button 
            onMouseDown={(e) => { e.preventDefault(); handleShowAnswers(); }}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-bold text-base shadow-xl shadow-blue-600/25 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <span>Mostrar Respostas (Pressione Espaço)</span>
          </button>
        ) : (
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200 dark:border-gray-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-5 items-center">
             <div className="flex flex-col sm:flex-row w-full gap-4 items-center">
               <div className="sm:w-[160px] w-full text-center sm:text-left shrink-0">
                 <div className="text-gray-900 dark:text-gray-100 text-sm font-bold">Avaliar Bloco</div>
                 <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                   {Object.keys(selectedCards).filter(id => selectedCards[id]).length} de {currentBlock.length} cartões selecionados
                 </div>
               </div>

               <div className="grid grid-cols-2 sm:grid-cols-4 w-full gap-2.5 sm:gap-3 flex-1">
                <RatingButton 
                  label="ERREI" 
                  shortcutKey="1"
                  sub={intervals.again} 
                  colorClass="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 shadow-xs" 
                  onClick={() => handleRate('again')} 
                />
                <RatingButton 
                  label="DIFÍCIL" 
                  shortcutKey="2"
                  sub={intervals.hard} 
                  colorClass="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 shadow-xs" 
                  onClick={() => handleRate('hard')} 
                />
                <RatingButton 
                  label="BOM" 
                  shortcutKey="3"
                  sub={intervals.good} 
                  colorClass="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 shadow-xs" 
                  onClick={() => handleRate('good')} 
                />
                <RatingButton 
                  label="FÁCIL" 
                  shortcutKey="4"
                  sub={intervals.easy} 
                  colorClass="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 shadow-xs" 
                  onClick={() => handleRate('easy')} 
                />
              </div>
             </div>

             {/* Custom Interval Option */}
             <div className="w-full pt-3.5 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
               <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                 Agendar intervalo customizado (Dias):
               </div>
               <div className="flex gap-2 w-full sm:w-auto">
                 <input 
                   type="number" 
                   min="1"
                   placeholder="Ex: 14"
                   value={customDays}
                   onChange={(e) => setCustomDays(e.target.value)}
                   className="w-24 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                 />
                 <button 
                  onClick={handleRateCustom}
                  disabled={!customDays || isNaN(parseInt(customDays))}
                  className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 disabled:opacity-50 text-gray-800 dark:text-gray-200 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                 >
                   <Calendar className="w-3.5 h-3.5" />
                   <span>Aplicar</span>
                 </button>
               </div>
             </div>
          </div>
        )}
      </div>
      
      {/* Notes modal */}
      {showNotesForCard && (
        <NotepadModal
          targetId={showNotesForCard}
          targetType="card"
          onClose={() => setShowNotesForCard(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {cardToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-1">
              Excluir este cartão?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Esta ação removerá este flashcard permanentemente do baralho.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setCardToDelete(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteCard}
                className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </AutoHighlighter>
  );
}

function RatingButton({ 
  label, 
  shortcutKey,
  sub, 
  colorClass, 
  onClick 
}: { 
  label: string, 
  shortcutKey: string,
  sub: string, 
  colorClass: string, 
  onClick: () => void 
}) {
  return (
    <button 
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn("py-3.5 px-3 rounded-2xl w-full flex flex-col items-center justify-center transition-all active:scale-95 group", colorClass)}
    >
      <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm tracking-wide">
        <span>{label}</span>
        <span className="text-[10px] opacity-60 font-mono px-1 py-0.2 bg-black/10 dark:bg-white/10 rounded">
          {shortcutKey}
        </span>
      </div>
      <div className="text-[11px] opacity-80 font-medium mt-1">{sub}</div>
    </button>
  );
}
