import React, { useState, useEffect, useRef } from 'react';
import { useStore, Question, QuestionAlternative } from '../../store/useStore';
import { TestSessionConfig } from './TestCreatorView';
import { useTimerStore } from '../../../store/useTimerStore';
import { AssociatedCardsModal } from '../../../components/AssociatedCardsModal';
import { LabValuesModal } from '../../../components/LabValuesModal';
import { StudyCalculatorModal } from '../../../components/StudyCalculatorModal';
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
  ArrowRight
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

  // Modais de ferramentas
  const [isLabModalOpen, setIsLabModalOpen] = useState(false);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [isCardsModalOpen, setIsCardsModalOpen] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // Timers
  const [resolutionTimer, setResolutionTimer] = useState<number>(0);
  const [reviewTimer, setReviewTimer] = useState<number>(0);
  const timerIntervalRef = useRef<any>(null);

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

  // Contagem de tempo (resolução vs revisão)
  useEffect(() => {
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
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

  if (!currentQ) {
    return (
      <div className="p-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg mx-auto space-y-4">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Sessão Concluída!</h3>
        <p className="text-xs text-gray-500">Todas as questões selecionadas foram processadas.</p>
        <button
          onClick={onExitSession}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500"
        >
          Voltar ao Início
        </button>
      </div>
    );
  }

  // Cards associados à questão atual pelo QID
  const matchingCards = cards.filter(c => {
    const qidStr = (currentQ.qid || '').toString().trim();
    if (!qidStr) return false;
    return (
      c.questionId === qidStr ||
      c.questionId === `qid:${qidStr}` ||
      (c.tags && c.tags.includes(`qid:${qidStr}`))
    );
  });

  const isSubmitted = Boolean(submittedQuestions[currentQ.id] || (currentQ.status === 'correct' || currentQ.status === 'incorrect'));
  const currentSelectedChoice = selectedChoices[currentQ.id] || currentQ.selectedChoiceId || '';
  const currentStruck = struckChoices[currentQ.id] || new Set();

  // Toggle risco em alternativa
  const toggleStrikeChoice = (choiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStruckChoices(prev => {
      const set = new Set(prev[currentQ.id] || []);
      if (set.has(choiceId)) set.delete(choiceId);
      else set.add(choiceId);
      return { ...prev, [currentQ.id]: set };
    });
  };

  // Enviar Resposta
  const handleSubmitAnswer = () => {
    if (!currentSelectedChoice) return;

    // Detecta se a alternativa escolhida é a correta
    const selectedAlt = currentQ.alternatives.find(a => a.id === currentSelectedChoice);
    const correctAlt = currentQ.alternatives.find(a => a.isCorrect);

    // Se nenhuma alternativa veio explicitamente como isCorrect (ex: primeira importação sem gabarito revelado),
    // tenta comparar com explanation ou assume a primeira letra correta
    let isCorrect = false;
    if (correctAlt) {
      isCorrect = selectedAlt?.id === correctAlt.id;
    } else if (currentQ.correctChoiceId) {
      isCorrect = selectedAlt?.id === currentQ.correctChoiceId;
    } else {
      // Fallback: se explanation menciona 'Correct answer is B' etc.
      const match = (currentQ.explanation || '').match(/correct\s+(?:answer|choice|option)\s+is\s+([A-H])/i);
      if (match && selectedAlt?.letter) {
        isCorrect = selectedAlt.letter.toUpperCase() === match[1].toUpperCase();
      } else {
        isCorrect = Boolean(selectedAlt?.isCorrect);
      }
    }

    const timeResolution = Math.max(1, resolutionTimer);

    // Registra no store de questões
    recordQuestionAnswer(
      currentQ.id,
      isCorrect,
      currentSelectedChoice,
      timeResolution,
      0
    );

    // Integração com timerStore (StudyTracking) e Heatmap
    try {
      addNetTime(timeResolution);
    } catch (e) {}

    // Integração com StudyTracking logs e Heatmap
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const existingLogsStr = localStorage.getItem('usmle_study_logs_v4');
      let logs = existingLogsStr ? JSON.parse(existingLogsStr) : [];
      logs.push({
        id: 'log-' + Date.now(),
        date: todayStr,
        resourceId: 'res-qbank-1',
        amount: 1,
        minutesSpent: Math.max(1, Math.round(timeResolution / 60)),
        notes: `Questão QID: #${currentQ.qid} - ${isCorrect ? 'Acerto' : 'Erro'}`
      });
      localStorage.setItem('usmle_study_logs_v4', JSON.stringify(logs));
      window.dispatchEvent(new Event('usmle_logs_updated'));
    } catch (e) {}

    setSubmittedQuestions(prev => ({ ...prev, [currentQ.id]: true }));
  };

  // Salvar anotação
  const handleSaveNote = () => {
    updateQuestionNotes(currentQ.id, noteContent);
    setActiveNotes(false);
  };

  // Pacer bar logic
  const pacerTarget = config.pacerTargetSeconds || 72;
  const pacerPercent = Math.min(100, (resolutionTimer / pacerTarget) * 100);
  const isPacerOver = resolutionTimer > pacerTarget;

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-20 animate-fade-in">
      {/* Top Session Bar */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Info & Mode */}
        <div className="flex items-center gap-3">
          <button
            onClick={onExitSession}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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

        {/* Center: Timers & Pacer */}
        <div className="flex items-center gap-4">
          {/* Question Resolution Timer */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700">
            <Clock className="w-4 h-4 text-gray-400" />
            <div className="text-xs font-mono font-bold text-gray-800 dark:text-gray-200">
              {Math.floor(resolutionTimer / 60)}:{(resolutionTimer % 60).toString().padStart(2, '0')}
            </div>
            {isSubmitted && reviewTimer > 0 && (
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono ml-1 font-bold">
                (Rev: {Math.floor(reviewTimer / 60)}:{(reviewTimer % 60).toString().padStart(2, '0')})
              </div>
            )}
          </div>

          {/* Pacer Indicator */}
          {config.pacerEnabled && (
            <div className="flex flex-col w-28">
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-gray-400">Pacer ({pacerTarget}s)</span>
                <span className={isPacerOver ? 'text-rose-500 font-mono' : 'text-emerald-500 font-mono'}>
                  {resolutionTimer}s
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mt-0.5">
                <div
                  className={`h-full transition-all duration-300 ${
                    isPacerOver ? 'bg-rose-500' : pacerPercent > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${pacerPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Study Tools Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Lab Values */}
          <button
            onClick={() => setIsLabModalOpen(true)}
            className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1 text-xs font-semibold"
            title="Valores Normais de Laboratório"
          >
            <FlaskConical className="w-4 h-4 text-blue-500" />
            <span className="hidden sm:inline">Lab Values</span>
          </button>

          {/* Calculator */}
          <button
            onClick={() => setIsCalcModalOpen(true)}
            className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1 text-xs font-semibold"
            title="Calculadora Clínica"
          >
            <Calculator className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">Calc</span>
          </button>

          {/* Notes */}
          <button
            onClick={() => setActiveNotes(!activeNotes)}
            className={`p-2 rounded-xl transition-colors flex items-center gap-1 text-xs font-semibold ${
              currentQ.userNotes || activeNotes
                ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="Anotações da Questão"
          >
            <StickyNote className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Notas</span>
          </button>

          {/* Flag */}
          <button
            onClick={() => toggleQuestionFlag(currentQ.id)}
            className={`p-2 rounded-xl transition-colors ${
              currentQ.isFlagged
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="Marcar / Flag Questão"
          >
            <Flag className={`w-4 h-4 ${currentQ.isFlagged ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid de Navegação de Questões (Permite navegar não-sequencialmente) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {sessionQuestions.map((q, idx) => {
            const isCurrent = idx === currentIndex;
            const qSubmitted = submittedQuestions[q.id] || q.status === 'correct' || q.status === 'incorrect';
            const isCorrect = q.status === 'correct';
            const isIncorrect = q.status === 'incorrect';

            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(idx)}
                className={`w-8 h-8 rounded-lg text-xs font-bold shrink-0 flex items-center justify-center transition-all relative ${
                  isCurrent
                    ? 'ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-gray-900 z-10'
                    : ''
                } ${
                  qSubmitted && config.mode === 'tutored'
                    ? isCorrect
                      ? 'bg-emerald-500 text-white'
                      : 'bg-rose-500 text-white'
                    : qSubmitted
                    ? 'bg-blue-600 text-white'
                    : selectedChoices[q.id]
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <span>{idx + 1}</span>
                {q.isFlagged && (
                  <div className="w-2 h-2 rounded-full bg-amber-400 absolute -top-0.5 -right-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bloco de Anotações Retrátil */}
      {activeNotes && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 animate-scale-up space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
              <StickyNote className="w-4 h-4 text-amber-600" />
              Anotações Pessoais para esta Questão
            </span>
            <button onClick={() => setActiveNotes(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <textarea
            rows={3}
            placeholder="Digite aqui dicas, mnemônicos ou lembretes desta questão..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            className="w-full p-2.5 bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={handleSaveNote}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-500"
            >
              Salvar Anotação
            </button>
          </div>
        </div>
      )}

      {/* Área Principal da Questão */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
        {/* Enunciado (Stem) */}
        <div className="prose dark:prose-invert max-w-none text-sm md:text-base leading-relaxed text-gray-900 dark:text-gray-100 font-normal">
          <p className="whitespace-pre-wrap">{currentQ.stem || currentQ.text}</p>
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
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Alternativas de Resposta:
          </div>

          {currentQ.alternatives.map((alt, idx) => {
            const letter = alt.letter || String.fromCharCode(65 + idx);
            const isSelected = currentSelectedChoice === alt.id;
            const isStruck = currentStruck.has(alt.id);

            // Cores no feedback após envio
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
                className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all cursor-pointer relative group ${choiceStyle} ${
                  isStruck ? 'opacity-40 line-through' : ''
                }`}
              >
                {/* Letra da Alternativa */}
                <div
                  className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${badgeStyle}`}
                >
                  {letter}
                </div>

                {/* Texto da Alternativa */}
                <div className="flex-1 text-xs sm:text-sm font-medium leading-snug">
                  {alt.text}
                </div>

                {/* Botão de Tachar/Riscar Alternativa */}
                {!isSubmitted && (
                  <button
                    type="button"
                    onClick={(e) => toggleStrikeChoice(alt.id, e)}
                    className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-700 ${
                      isStruck ? 'opacity-100 text-rose-500' : 'text-gray-400'
                    }`}
                    title="Tachar / Eliminar Alternativa"
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
                <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
                  {currentQ.educationalObjective}
                </div>
              </div>
            )}

            {/* Explicação Detalhada */}
            {currentQ.explanation && (
              <div className="p-5 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>Explicação Detalhada</span>
                </div>
                <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {currentQ.explanation}
                </div>
              </div>
            )}

            {/* Ligação Bidirecional com Flashcards & Reset da Questão */}
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
                className="text-xs font-semibold text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Resetar status desta questão</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Buttons (Anterior / Próxima) */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
            onClick={onExitSession}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Finalizar Bloco</span>
          </button>
        )}
      </div>

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
