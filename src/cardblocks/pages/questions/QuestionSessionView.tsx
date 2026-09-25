import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore, Question, QuestionAlternative } from '../../store/useStore';
import { TestSessionConfig } from './TestCreatorView';
import { useTimerStore } from '../../../store/useTimerStore';
import { AssociatedCardsModal } from '../../../components/AssociatedCardsModal';
import { findCardsForQuestion } from '../../../utils/qbankCardMatcher';
import { LabValuesModal } from '../../../components/LabValuesModal';
import { StudyCalculatorModal } from '../../../components/StudyCalculatorModal';
import { RichContentRenderer } from '../../components/RichContentRenderer';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Layers,
  Sparkles,
  BookOpen,
  Calculator,
  FlaskConical,
  Highlighter,
  Strikethrough,
  StickyNote,
  X,
  Maximize2,
  Check,
  AlertTriangle,
  Send,
  Eye,
  ArrowRight,
  Flame,
  Eraser,
  Trophy
} from 'lucide-react';

interface QuestionSessionViewProps {
  config: TestSessionConfig;
  onExitSession: () => void;
  onOpenCardCreator: (questionData: any) => void;
}

export const QuestionSessionView: React.FC<QuestionSessionViewProps> = ({
  config,
  onExitSession,
  onOpenCardCreator,
}) => {
  const {
    questions,
    cards,
    recordQuestionAnswer,
    resetQuestionStats,
    updateQuestionNotes,
    toggleQuestionFlag,
  } = useStore();

  const { addNetTime } = useTimerStore();

  // Conjunto de questões da sessão
  const sessionQuestions = config.selectedQuestionIds
    .map(id => questions.find(q => q.id === id))
    .filter(Boolean) as Question[];

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentQ = sessionQuestions[currentIndex];

  // Estado local por questão
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Record<string, boolean>>({});
  const [struckChoices, setStruckChoices] = useState<Record<string, Set<string>>>({});
  const [activeNotes, setActiveNotes] = useState(false);
  const [noteContent, setNoteContent] = useState('');

  // Destaques / Highlights por questão
  const [highlights, setHighlights] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('cardblocks_q_highlights');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [isHighlightMode, setIsHighlightMode] = useState(false);
  const [selectedTextToHighlight, setSelectedTextToHighlight] = useState<string>('');

  // Modais de ferramentas & Conclusão de bloco
  const [isLabModalOpen, setIsLabModalOpen] = useState(false);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [isCardsModalOpen, setIsCardsModalOpen] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [showEndBlockModal, setShowEndBlockModal] = useState(false);

  // Timers
  const [resolutionTimer, setResolutionTimer] = useState<number>(0);
  const [reviewTimer, setReviewTimer] = useState<number>(0);
  const [totalSessionSeconds, setTotalSessionSeconds] = useState<number>(0);
  const timerIntervalRef = useRef<any>(null);

  // Salva destaques no localStorage
  useEffect(() => {
    try {
      localStorage.setItem('cardblocks_q_highlights', JSON.stringify(highlights));
    } catch (e) {}
  }, [highlights]);

  // Sincroniza notas quando muda questão
  useEffect(() => {
    if (currentQ) {
      setNoteContent(currentQ.userNotes || '');
      // Restaura seleção prévia se já foi respondida
      if (currentQ.selectedChoiceId && !selectedChoices[currentQ.id]) {
        setSelectedChoices(prev => ({ ...prev, [currentQ.id]: currentQ.selectedChoiceId! }));
      }
      if ((currentQ.status === 'correct' || currentQ.status === 'incorrect') && !submittedQuestions[currentQ.id]) {
        setSubmittedQuestions(prev => ({ ...prev, [currentQ.id]: true }));
      }
      // Reset timers for current question
      setResolutionTimer(0);
      setReviewTimer(0);
    }
  }, [currentIndex, currentQ?.id]);

  // Contagem de tempo (resolução vs revisão e tempo total da sessão)
  useEffect(() => {
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTotalSessionSeconds(s => s + 1);
      if (!currentQ) return;
      const isSubmitted = submittedQuestions[currentQ.id] || currentQ.status === 'correct' || currentQ.status === 'incorrect';
      if (isSubmitted) {
        setReviewTimer(t => t + 1);
      } else {
        setResolutionTimer(t => t + 1);
      }
    }, 1000);

    return () => clearInterval(timerIntervalRef.current);
  }, [currentQ?.id, submittedQuestions]);

  // Captura seleção de texto para highlight
  const handleMouseUpTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 1) {
      const text = selection.toString().trim();
      setSelectedTextToHighlight(text);
      if (isHighlightMode && currentQ) {
        handleAddHighlight(text);
        selection.removeAllRanges();
      }
    } else {
      setSelectedTextToHighlight('');
    }
  };

  const handleAddHighlight = (textToAdd: string) => {
    if (!currentQ || !textToAdd) return;
    setHighlights(prev => {
      const qHighlights = prev[currentQ.id] || [];
      if (qHighlights.includes(textToAdd)) return prev;
      return {
        ...prev,
        [currentQ.id]: [...qHighlights, textToAdd]
      };
    });
    setSelectedTextToHighlight('');
  };

  const handleClearHighlights = () => {
    if (!currentQ) return;
    setHighlights(prev => {
      const updated = { ...prev };
      delete updated[currentQ.id];
      return updated;
    });
  };

  // Aplica highlights no texto / HTML evitando substituir dentro de tags HTML
  const applyHighlightsToContent = (rawText: string = ''): string => {
    if (!currentQ || !rawText) return rawText;
    const qHighlights = highlights[currentQ.id] || [];
    if (qHighlights.length === 0) return rawText;

    let result = rawText;
    qHighlights.forEach(hText => {
      if (!hText || hText.length < 2) return;
      try {
        const escaped = hText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Lookahead seguro para não substituir atributos ou nomes de tags HTML
        const regex = new RegExp(`(${escaped})(?![^<]*>)`, 'gi');
        result = result.replace(regex, '<mark class="bg-amber-200 dark:bg-amber-500/40 text-gray-900 dark:text-gray-100 rounded-xs px-1 py-0.5 font-medium border-b border-amber-400">$1</mark>');
      } catch(e) {}
    });
    return result;
  };

  if (!currentQ) {
    return (
      <div className="p-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg mx-auto space-y-4">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Sessão Concluída!</h3>
        <p className="text-xs text-gray-500">Todas as questões selecionadas foram processadas.</p>
        <button
          onClick={() => setShowEndBlockModal(true)}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 cursor-pointer"
        >
          Finalizar Bloco
        </button>
      </div>
    );
  }

  // Cards associados à questão atual pelo QID (suporte a AnKing e cards criados)
  const matchingCards = useMemo(() => {
    return findCardsForQuestion(cards, currentQ?.qid);
  }, [cards, currentQ?.qid]);

  const isSubmitted = Boolean(submittedQuestions[currentQ.id] || (currentQ.status === 'correct' || currentQ.status === 'incorrect'));
  const currentSelectedChoice = selectedChoices[currentQ.id] || currentQ.selectedChoiceId || '';
  const currentStruck = struckChoices[currentQ.id] || new Set();

  // Toggle risco em alternativa (via botão ou clique com botão direito)
  const toggleStrikeChoice = (choiceId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setStruckChoices(prev => {
      const set = new Set(prev[currentQ.id] || []);
      if (set.has(choiceId)) set.delete(choiceId);
      else set.add(choiceId);
      return { ...prev, [currentQ.id]: set };
    });
  };

  // Enviar Resposta (Atualiza store da questão SEM lançar no Heatmap individualmente)
  const handleSubmitAnswer = () => {
    if (!currentSelectedChoice) return;

    const selectedAlt = currentQ.alternatives.find(a => a.id === currentSelectedChoice);
    const correctAlt = currentQ.alternatives.find(a => a.isCorrect);

    let isCorrect = false;
    if (correctAlt) {
      isCorrect = selectedAlt?.id === correctAlt.id;
    } else if (currentQ.correctChoiceId) {
      isCorrect = selectedAlt?.id === currentQ.correctChoiceId;
    } else {
      const match = (currentQ.explanation || '').match(/correct\s+(?:answer|choice|option)\s+is\s+([A-H])/i);
      if (match && selectedAlt?.letter) {
        isCorrect = selectedAlt.letter.toUpperCase() === match[1].toUpperCase();
      } else {
        isCorrect = Boolean(selectedAlt?.isCorrect);
      }
    }

    const timeResolution = Math.max(1, resolutionTimer);

    // Registra pontuação individual no store de questões
    recordQuestionAnswer(
      currentQ.id,
      isCorrect,
      currentSelectedChoice,
      timeResolution,
      0
    );

    setSubmittedQuestions(prev => ({ ...prev, [currentQ.id]: true }));
  };

  // Salvar anotação
  const handleSaveNote = () => {
    updateQuestionNotes(currentQ.id, noteContent);
    setActiveNotes(false);
  };

  // Finalização do Bloco & Registro Consolidado no Heatmap
  const handleConfirmRegisterHeatmap = () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const existingLogsStr = localStorage.getItem('usmle_study_logs_v4');
      let logs = existingLogsStr ? JSON.parse(existingLogsStr) : [];
      
      const answeredCount = Object.keys(submittedQuestions).length || sessionQuestions.length;
      const correctCount = sessionQuestions.filter(q => q.status === 'correct').length;
      const blockMins = Math.max(1, Math.round(totalSessionSeconds / 60));
      const accuracyPct = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

      logs.push({
        id: 'log-' + Date.now(),
        date: todayStr,
        resourceId: 'res-qbank-1',
        amount: answeredCount,
        minutesSpent: blockMins,
        notes: `Bloco Q-Bank: ${correctCount}/${answeredCount} acertos (${accuracyPct}%) - ${blockMins} min`
      });

      localStorage.setItem('usmle_study_logs_v4', JSON.stringify(logs));
      addNetTime(totalSessionSeconds);
      window.dispatchEvent(new Event('usmle_logs_updated'));
    } catch (e) {}

    setShowEndBlockModal(false);
    onExitSession();
  };

  const handleFinishWithoutRegister = () => {
    setShowEndBlockModal(false);
    onExitSession();
  };

  // Pacer bar logic
  const pacerTarget = config.pacerTargetSeconds || 72;
  const pacerPercent = Math.min(100, (resolutionTimer / pacerTarget) * 100);
  const isPacerOver = resolutionTimer > pacerTarget;

  // Estatísticas calculadas do bloco
  const totalAnswered = Object.keys(submittedQuestions).length;
  const totalCorrect = sessionQuestions.filter(q => q.status === 'correct').length;
  const currentAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-20 animate-fade-in" onMouseUp={handleMouseUpTextSelection}>
      {/* Top Session Bar */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Info & Mode */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowEndBlockModal(true)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Encerrar / Sair do Bloco"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-gray-900 dark:text-white">
                Questão {currentIndex + 1} de {sessionQuestions.length}
              </span>
              <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold">
                QID: #{currentQ.qid}
              </span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {config.mode}
              </span>
            </div>
            <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
              <span>{currentQ.subject || 'Subject Geral'}</span>
              <span>•</span>
              <span className="text-blue-600 dark:text-blue-400">{currentQ.system || 'System'}</span>
            </div>
          </div>
        </div>

        {/* Center: Tools & Highlights */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Highlight Mode Toggle */}
          <button
            onClick={() => setIsHighlightMode(!isHighlightMode)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
              isHighlightMode
                ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-400 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/20'
                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
            }`}
            title="Ativar modo marca-texto (destaca automaticamente o texto selecionado)"
          >
            <Highlighter className="w-3.5 h-3.5 text-amber-500" />
            <span>{isHighlightMode ? 'Marca-Texto Ativo' : 'Marca-Texto'}</span>
          </button>

          {/* Clear Highlights button */}
          {highlights[currentQ.id]?.length > 0 && (
            <button
              onClick={handleClearHighlights}
              className="p-1.5 text-xs text-gray-400 hover:text-rose-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
              title="Limpar destaques desta questão"
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Lab Values */}
          <button
            onClick={() => setIsLabModalOpen(true)}
            className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FlaskConical className="w-3.5 h-3.5 text-emerald-500" />
            <span>Lab Values</span>
          </button>

          {/* Calculator */}
          <button
            onClick={() => setIsCalcModalOpen(true)}
            className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5 text-purple-500" />
            <span>Calculadora</span>
          </button>

          {/* Flag Question */}
          <button
            onClick={() => toggleQuestionFlag(currentQ.id)}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
              currentQ.isFlagged
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-600'
                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600'
            }`}
            title="Marcar questão para revisão"
          >
            <Flag className="w-4 h-4" />
          </button>

          {/* Notes Toggle */}
          <button
            onClick={() => setActiveNotes(!activeNotes)}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
              activeNotes || currentQ.userNotes
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 text-blue-600'
                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600'
            }`}
            title="Anotações da questão"
          >
            <StickyNote className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Timers & Finish */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400" title="Tempo na questão atual">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>
                {Math.floor(resolutionTimer / 60)}:{(resolutionTimer % 60).toString().padStart(2, '0')}
              </span>
            </div>

            <div className="text-gray-400" title="Tempo total do bloco">
              Total: {Math.floor(totalSessionSeconds / 60)}:{(totalSessionSeconds % 60).toString().padStart(2, '0')}
            </div>
          </div>

          <button
            onClick={() => setShowEndBlockModal(true)}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Encerrar Bloco
          </button>
        </div>
      </div>

      {/* Floating Highlight Button when text is selected */}
      {selectedTextToHighlight && !isHighlightMode && (
        <div
          className="fixed bottom-20 right-8 z-40 bg-amber-500 text-white px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 animate-bounce cursor-pointer font-bold text-xs hover:bg-amber-600 transition-colors"
          onClick={() => handleAddHighlight(selectedTextToHighlight)}
        >
          <Highlighter className="w-4 h-4" />
          <span>Destacar texto selecionado</span>
        </div>
      )}

      {/* Painel de Anotações */}
      {activeNotes && (
        <div className="bg-yellow-50/70 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/40 rounded-2xl p-4 shadow-xs space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-yellow-800 dark:text-yellow-300 flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" />
              Anotações desta Questão
            </span>
            <button onClick={() => setActiveNotes(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Digite suas anotações clínicas sobre esta questão..."
            rows={3}
            className="w-full text-xs p-3 rounded-xl border border-yellow-200 dark:border-yellow-900 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-yellow-400 resize-none"
          />
          <div className="flex justify-end">
            <button
              onClick={handleSaveNote}
              className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Salvar Anotação
            </button>
          </div>
        </div>
      )}

      {/* Área Principal da Questão */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
        {/* Enunciado (Stem) com suporte a tabelas e imagens */}
        <div className="text-sm md:text-base leading-relaxed text-gray-900 dark:text-gray-100 font-normal">
          <RichContentRenderer content={applyHighlightsToContent(currentQ.stem || currentQ.text)} />
        </div>

        {/* Imagens Clínicas */}
        {currentQ.images && currentQ.images.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-2">
            {currentQ.images.map((imgUrl, i) => (
              <div
                key={i}
                onClick={() => setLightboxImg(imgUrl)}
                className="relative group cursor-pointer border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-64 shadow-xs hover:border-blue-500 transition-colors"
              >
                <img
                  src={imgUrl}
                  alt={`Imagem Clínica ${i + 1}`}
                  className="max-h-64 w-auto object-contain bg-black/5"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Maximize2 className="w-5 h-5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Alternativas de Resposta */}
        <div className="space-y-2.5 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            <span>Alternativas de Resposta:</span>
            <span className="text-[11px] lowercase font-normal text-gray-400 hidden sm:inline">
              (clique com botão direito para eliminar alternativa)
            </span>
          </div>

          {currentQ.alternatives.map((alt, idx) => {
            const letter = alt.letter || String.fromCharCode(65 + idx);
            const isSelected = currentSelectedChoice === alt.id;
            const isStruck = currentStruck.has(alt.id);

            let choiceStyle = 'border-gray-200 dark:border-gray-800 hover:border-blue-400 bg-white dark:bg-gray-900';
            let badgeStyle = 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';

            if (isSelected) {
              choiceStyle = 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/30';
              badgeStyle = 'bg-blue-600 text-white';
            }

            if (isSubmitted && config.mode === 'tutored') {
              if (alt.isCorrect) {
                choiceStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100';
                badgeStyle = 'bg-emerald-600 text-white';
              } else if (isSelected && !alt.isCorrect) {
                choiceStyle = 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100';
                badgeStyle = 'bg-rose-600 text-white';
              }
            }

            return (
              <div
                key={alt.id}
                onClick={() => {
                  if (!isSubmitted) {
                    setSelectedChoices(prev => ({ ...prev, [currentQ.id]: alt.id }));
                  }
                }}
                onContextMenu={(e) => {
                  if (!isSubmitted) {
                    toggleStrikeChoice(alt.id, e);
                  }
                }}
                className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all cursor-pointer relative group select-none ${choiceStyle} ${
                  isStruck ? 'opacity-40 line-through' : ''
                }`}
              >
                {/* Letra da Alternativa */}
                <div
                  className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${badgeStyle}`}
                >
                  {letter}
                </div>

                {/* Texto da Alternativa (com suporte a tabelas e imagens) */}
                <div className="flex-1 text-xs sm:text-sm font-medium leading-snug">
                  <RichContentRenderer content={alt.text} />
                </div>

                {/* Botão de Tachar/Riscar Alternativa */}
                {!isSubmitted && (
                  <button
                    type="button"
                    onClick={(e) => toggleStrikeChoice(alt.id, e)}
                    className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer ${
                      isStruck ? 'opacity-100 text-rose-500' : 'text-gray-400'
                    }`}
                    title="Tachar / Eliminar Alternativa (ou clique com botão direito)"
                  >
                    <Strikethrough className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Ícone de feedback correto/errado */}
                {isSubmitted && config.mode === 'tutored' && (
                  <div className="shrink-0">
                    {alt.isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : isSelected ? (
                      <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Botão de Enviar Resposta */}
        {!isSubmitted ? (
          <div className="pt-4 flex justify-end">
            <button
              onClick={handleSubmitAnswer}
              disabled={!currentSelectedChoice}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span>Confirmar Resposta</span>
            </button>
          </div>
        ) : (
          /* Explicação & Educational Objective (Modo Tutored) */
          <div className="space-y-5 pt-6 border-t border-gray-200 dark:border-gray-800 animate-fade-in">
            {/* Educational Objective em destaque */}
            {currentQ.educationalObjective && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-900/60 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Educational Objective</span>
                </div>
                <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 leading-relaxed">
                  <RichContentRenderer content={applyHighlightsToContent(currentQ.educationalObjective)} />
                </div>
              </div>
            )}

            {/* Explicação Detalhada com Tabelas e Imagens */}
            {currentQ.explanation && (
              <div className="p-5 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>Explicação Detalhada</span>
                </div>
                <div className="text-xs sm:text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                  <RichContentRenderer content={applyHighlightsToContent(currentQ.explanation)} />
                </div>
              </div>
            )}

            {/* Ligação com Flashcards */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {matchingCards.length > 0 ? (
                  <button
                    onClick={() => setIsCardsModalOpen(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Layers className="w-4 h-4" />
                    <span>Ver Cards Associados ({matchingCards.length})</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onOpenCardCreator({
                        questionId: currentQ.qid,
                        questionStem: currentQ.stem || currentQ.text,
                        questionChoices: currentQ.alternatives.map(a => `${a.letter || ''}. ${a.text}`).join('\n'),
                        explanation: currentQ.explanation,
                        educationalObjective: currentQ.educationalObjective,
                        subject: currentQ.subject,
                        system: currentQ.system,
                        questionImages: currentQ.images,
                        tags: [`qid:${currentQ.qid}`, 'qbank-sync'],
                      });
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Criar Card Associado desta Questão</span>
                  </button>
                )}
              </div>

              {/* Reset Individual */}
              <button
                onClick={() => {
                  if (confirm('Deseja resetar as estatísticas e histórico desta questão?')) {
                    resetQuestionStats(currentQ.id);
                    setSubmittedQuestions(prev => ({ ...prev, [currentQ.id]: false }));
                    setSelectedChoices(prev => {
                      const updated = { ...prev };
                      delete updated[currentQ.id];
                      return updated;
                    });
                  }
                }}
                className="text-xs font-semibold text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Resetar status desta questão</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Buttons (Anterior / Próxima / Finalizar) */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Anterior</span>
        </button>

        <span className="text-xs font-mono font-bold text-gray-400">
          {currentIndex + 1} / {sessionQuestions.length}
        </span>

        {currentIndex < sessionQuestions.length - 1 ? (
          <button
            onClick={() => setCurrentIndex(prev => prev + 1)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <span>Próxima</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => setShowEndBlockModal(true)}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Finalizar Bloco</span>
          </button>
        )}
      </div>

      {/* Modal de Conclusão do Bloco & Registro no Heatmap */}
      {showEndBlockModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 animate-scale-in">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-orange-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-orange-500/30">
                <Trophy className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">
                Bloco de Questões Concluído!
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Resumo da sua sessão de treinamento clínico:
              </p>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 text-center">
                <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Respondidas</div>
                <div className="text-lg font-black text-blue-950 dark:text-blue-100 mt-0.5">
                  {totalAnswered} / {sessionQuestions.length}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-center">
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Acertos</div>
                <div className="text-lg font-black text-emerald-950 dark:text-emerald-100 mt-0.5">
                  {currentAccuracy}%
                </div>
                <div className="text-[10px] text-emerald-600/80 font-bold">({totalCorrect} corretas)</div>
              </div>

              <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 text-center">
                <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold">Tempo Total</div>
                <div className="text-lg font-black text-purple-950 dark:text-purple-100 mt-0.5">
                  {Math.max(1, Math.round(totalSessionSeconds / 60))}m
                </div>
                <div className="text-[10px] text-purple-600/80 font-bold">
                  {Math.floor(totalSessionSeconds / 60)}:{(totalSessionSeconds % 60).toString().padStart(2, '0')}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                <span>Registrar no Heatmap de Estudos?</span>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                Deseja computar este bloco consolidado no seu gráfico diário de estudos e tempo líquido?
              </p>
            </div>

            {/* Ações */}
            <div className="space-y-2.5">
              <button
                onClick={handleConfirmRegisterHeatmap}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Flame className="w-4 h-4 fill-white" />
                <span>Sim, Registrar Bloco no Heatmap</span>
              </button>

              <button
                onClick={handleFinishWithoutRegister}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Concluir sem Registrar Atividade
              </button>

              <button
                onClick={() => setShowEndBlockModal(false)}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 py-1 transition-colors cursor-pointer"
              >
                Continuar revisando questões deste bloco
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modais de Ferramentas */}
      <LabValuesModal
        isOpen={isLabModalOpen}
        onClose={() => setIsLabModalOpen(false)}
      />

      <StudyCalculatorModal
        isOpen={isCalcModalOpen}
        onClose={() => setIsCalcModalOpen(false)}
      />

      <AssociatedCardsModal
        isOpen={isCardsModalOpen}
        onClose={() => setIsCardsModalOpen(false)}
        qid={currentQ.qid}
        cards={matchingCards}
      />

      {/* Lightbox de Imagem */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer animate-fade-in"
        >
          <img
            src={lightboxImg}
            alt="Imagem ampliada"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
