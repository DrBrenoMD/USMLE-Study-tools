import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  Flame,
  Layers,
  FileText,
  BookOpen,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Plus,
  BarChart3,
  TrendingUp,
  Settings2,
  Save,
  Flag,
  Check,
  X,
  Maximize2,
  Minimize2,
  Search,
  ExternalLink,
  Lightbulb,
  ArrowRight,
  ArrowLeft,
  Compass,
  Zap,
  Target,
  Globe,
  Database,
  Chrome,
  SlidersHorizontal,
  Download
} from 'lucide-react';
import {
  useStore,
  Question,
  Flashcard,
  StudyNote,
  StudyDeskSession,
  StudyDeskQuestionRecord
} from '../cardblocks/store/useStore';
import { useTimerStore } from '../store/useTimerStore';
import { QuestionPacer } from '../components/QuestionPacer';
import { InlineNoteRichEditor } from '../cardblocks/pages/notebooks/InlineNoteRichEditor';
import { cn } from '../lib/utils';
import { sanitizeHtml } from '../cardblocks/lib/utils';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';

export default function StudyDesk() {
  const navigate = useNavigate();
  const location = useLocation();

  // Stores
  const {
    questions,
    questionBanks,
    cards,
    decks,
    studyNotebooks,
    notebookAreas,
    notebookSystems,
    notebookSubjects,
    notebookTopics,
    studyNotes,
    studyDeskSessions,
    activeDeskSessionId,
    startDeskSession,
    recordDeskQuestionAnswer,
    finishDeskSession,
    deleteDeskSession,
    setActiveDeskSessionId,
    createCard,
    createStudyNote,
    createNotebookArea,
    updateStudyNote,
    toggleQuestionFlag,
    upsertQuestionFromQBank
  } = useStore();

  const {
    pacerIsActive,
    pacerTotalQuestions,
    pacerTargetTimeSeconds,
    pacerTargetReviewSeconds,
    pacerQBankMode,
    pacerTutoredPhase,
    pacerCurrentQuestionTime,
    pacerCurrentReviewTime,
    pacerCompletedQuestionsTime,
    pacerCompletedReviewTimes,
    pacerSoundEnabled,
    pacerSoundSettings,
    syncPacerQuestion,
    nextPacerQuestion,
    prevPacerQuestion,
    submitPacerQuestion
  } = useTimerStore();

  // Mode: 'external' (default: Qbankly, UWorld, Amboss) or 'internal' (site bank)
  const [sourceMode, setSourceMode] = useState<'external' | 'internal'>('external');

  // External live status & last received question info
  const [externalSourcePlatform, setExternalSourcePlatform] = useState<string>('Qbankly / UWorld / Amboss');
  const [lastSyncedQid, setLastSyncedQid] = useState<string>('10420');
  const [lastSyncedSubject, setLastSyncedSubject] = useState<string>('Cardiologia');
  const [lastSyncedSystem, setLastSyncedSystem] = useState<string>('Cardiovascular');
  const [lastSyncedObjective, setLastSyncedObjective] = useState<string>(
    'A Estenose Aórtica gera aumento da pós-carga de VE, hipertrofia ventricular concêntrica, sopro sistólico com irradiação carotídea e pulso parvus et tardus.'
  );

  // Local State
  const [selectedBankId, setSelectedBankId] = useState<string>('all');
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const [activeRightTab, setActiveRightTab] = useState<'flashcards' | 'notes' | 'stats'>('flashcards');
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [eliminatedChoices, setEliminatedChoices] = useState<string[]>([]);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState<boolean>(false);
  const [isExplanationOpen, setIsExplanationOpen] = useState<boolean>(false);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [statsBreakdownType, setStatsBreakdownType] = useState<'subject' | 'system'>('subject');
  const [statsMetricType, setStatsMetricType] = useState<'accuracy' | 'solveTime' | 'reviewTime' | 'count'>('accuracy');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Flashcard quick create form state
  const [showQuickCardForm, setShowQuickCardForm] = useState<boolean>(false);
  const [cardDeckId, setCardDeckId] = useState<string>('');
  const [cardFront, setCardFront] = useState<string>('');
  const [cardBack, setCardBack] = useState<string>('');
  const [cardTags, setCardTags] = useState<string>('');
  const [cardSaveFeedback, setCardSaveFeedback] = useState<string | null>(null);

  // Note quick create state
  const [showQuickNoteForm, setShowQuickNoteForm] = useState<boolean>(false);
  const [noteAreaId, setNoteAreaId] = useState<string>('');
  const [noteSystemId, setNoteSystemId] = useState<string>('');
  const [noteSubjectId, setNoteSubjectId] = useState<string>('');
  const [noteTopicId, setNoteTopicId] = useState<string>('');
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Listen to live external questions arriving from Qbankly / UWorld / Extension
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('usmle_qbank_sync');
      bc.onmessage = (event) => {
        if (event.data) {
          const payload = event.data.payload || event.data.question || event.data;
          if (payload.bankName || payload.source) {
            setExternalSourcePlatform(payload.bankName || payload.source);
          }
          if (payload.qid || payload.questionId) {
            setLastSyncedQid((payload.qid || payload.questionId).toString());
          }
          if (payload.subject) setLastSyncedSubject(payload.subject);
          if (payload.system) setLastSyncedSystem(payload.system);
          if (payload.educationalObjective) setLastSyncedObjective(payload.educationalObjective);
        }
      };
    } catch (e) {}

    const handleWindowMsg = (event: MessageEvent) => {
      if (event.data && (event.data.type === 'USMLE_IMPORT_QUESTION' || event.data.type === 'QBANK_QUESTION_SYNC')) {
        const payload = event.data.payload || event.data.question || event.data;
        if (payload.bankName || payload.source) {
          setExternalSourcePlatform(payload.bankName || payload.source);
        }
        if (payload.qid || payload.questionId) {
          setLastSyncedQid((payload.qid || payload.questionId).toString());
        }
        if (payload.subject) setLastSyncedSubject(payload.subject);
        if (payload.system) setLastSyncedSystem(payload.system);
        if (payload.educationalObjective) setLastSyncedObjective(payload.educationalObjective);
      }
    };
    window.addEventListener('message', handleWindowMsg);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('message', handleWindowMsg);
    };
  }, []);

  // Internal Questions List (Only used in Internal Mode)
  const availableQuestions = useMemo(() => {
    let list = questions;
    if (selectedBankId !== 'all') {
      list = list.filter(q => q.bankId === selectedBankId);
    }
    return list;
  }, [questions, selectedBankId]);

  // Active Question for Internal Mode
  const currentInternalQuestion = useMemo(() => {
    if (availableQuestions.length === 0) return null;
    if (activeQuestionIndex >= availableQuestions.length) {
      return availableQuestions[0] || null;
    }
    return availableQuestions[activeQuestionIndex] || null;
  }, [availableQuestions, activeQuestionIndex]);

  // Current Question ID and matching object depending on Mode
  const activeQid = useMemo(() => {
    if (sourceMode === 'external') {
      return lastSyncedQid || 'QBank-Live';
    }
    return currentInternalQuestion?.qid || currentInternalQuestion?.id || '—';
  }, [sourceMode, lastSyncedQid, currentInternalQuestion]);

  const matchingQuestionObj = useMemo(() => {
    if (sourceMode === 'internal') return currentInternalQuestion;
    return questions.find(q => q.qid === activeQid || q.id === activeQid || q.qid === lastSyncedQid) || null;
  }, [sourceMode, currentInternalQuestion, questions, activeQid, lastSyncedQid]);

  const activeSubject = useMemo(() => {
    if (sourceMode === 'external') {
      return matchingQuestionObj?.subject || lastSyncedSubject || 'Geral';
    }
    return currentInternalQuestion?.subject || matchingQuestionObj?.subject || 'Geral';
  }, [sourceMode, matchingQuestionObj, lastSyncedSubject, currentInternalQuestion]);

  const activeSystem = useMemo(() => {
    if (sourceMode === 'external') {
      return matchingQuestionObj?.system || lastSyncedSystem || 'Geral';
    }
    return currentInternalQuestion?.system || matchingQuestionObj?.system || 'Geral';
  }, [sourceMode, matchingQuestionObj, lastSyncedSystem, currentInternalQuestion]);

  // Active Question's Associated Flashcards
  const activeQuestionCards = useMemo(() => {
    const qid = activeQid;
    return cards.filter(c => 
      c.sourceQuestionId === qid || 
      c.associatedQuestionIds?.includes(qid) ||
      c.tags?.includes(`qid:${qid}`)
    );
  }, [activeQid, cards]);

  // Active Question's Associated Study Notes
  const activeQuestionNotes = useMemo(() => {
    const qid = activeQid;
    return studyNotes.filter(n =>
      n.associatedQuestionIds?.includes(qid) ||
      n.tags?.includes(`qid:${qid}`)
    );
  }, [activeQid, studyNotes]);

  // When active question or mode changes
  useEffect(() => {
    if (sourceMode === 'internal' && currentInternalQuestion) {
      setSelectedChoiceId(currentInternalQuestion.selectedChoiceId || null);
      setIsAnswerRevealed(Boolean(currentInternalQuestion.status && currentInternalQuestion.status !== 'unused'));
      setIsExplanationOpen(Boolean(currentInternalQuestion.status && currentInternalQuestion.status !== 'unused'));
      setEliminatedChoices([]);
    }

    if (decks.length > 0 && !cardDeckId) {
      setCardDeckId(decks[0].id);
    }
    setCardFront('');
    setCardBack('');
    setCardTags(`qid:${activeQid}, ${activeSubject}, ${activeSystem}`.trim());
    setNoteTitle(`Questão ${activeQid} - ${activeSubject}`);
  }, [activeQid, activeSubject, activeSystem, sourceMode, currentInternalQuestion?.id]);

  // Ensure an active desk session exists
  useEffect(() => {
    if (!activeDeskSessionId && studyDeskSessions.length === 0) {
      startDeskSession({
        name: `Mesa de Estudos (${sourceMode === 'external' ? 'Qbank Externo' : 'Banco Interno'}) - ${new Date().toLocaleDateString('pt-BR')}`,
        totalQuestions: 40,
        bankId: selectedBankId !== 'all' ? selectedBankId : undefined,
      });
    }
  }, [activeDeskSessionId, studyDeskSessions.length, selectedBankId, sourceMode]);

  // Navigation Handlers for Internal Mode
  const handleNextInternalQuestion = () => {
    if (activeQuestionIndex < availableQuestions.length - 1) {
      setActiveQuestionIndex(i => i + 1);
      nextPacerQuestion();
    }
  };

  const handlePrevInternalQuestion = () => {
    if (activeQuestionIndex > 0) {
      setActiveQuestionIndex(i => i - 1);
      prevPacerQuestion();
    }
  };

  const handleSelectChoice = (choiceId: string) => {
    if (isAnswerRevealed) return;
    setSelectedChoiceId(choiceId);
  };

  const handleSubmitInternalAnswer = () => {
    if (!currentInternalQuestion || !selectedChoiceId || isAnswerRevealed) return;
    const correctAlt = currentInternalQuestion.alternatives.find(a => a.isCorrect);
    const isCorrect = correctAlt ? correctAlt.id === selectedChoiceId : false;

    setIsAnswerRevealed(true);
    setIsExplanationOpen(true);

    recordDeskQuestionAnswer({
      qid: currentInternalQuestion.qid || currentInternalQuestion.id,
      questionId: currentInternalQuestion.id,
      selectedChoiceId,
      correctChoiceId: correctAlt?.id,
      isCorrect,
      resolutionTimeSeconds: Math.max(1, pacerCurrentQuestionTime),
      reviewTimeSeconds: Math.max(0, pacerCurrentReviewTime || 0),
      subject: currentInternalQuestion.subject,
      system: currentInternalQuestion.system,
    });

    submitPacerQuestion();
  };

  // Quick Flashcard Creation
  const handleSaveQuickCard = () => {
    if (!cardFront.trim() || !cardBack.trim() || !cardDeckId) return;

    const tagsArray = cardTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    createCard({
      deckId: cardDeckId,
      front: cardFront,
      back: cardBack,
      details: `Fonte: QID ${activeQid} - ${activeSubject}`,
      tags: tagsArray,
      sourceQuestionId: activeQid,
      associatedQuestionIds: [activeQid],
      subject: activeSubject,
      system: activeSystem,
      educationalObjective: lastSyncedObjective,
    });

    setCardSaveFeedback('Flashcard criado e vinculado com sucesso! ✓');
    setTimeout(() => {
      setCardSaveFeedback(null);
      setShowQuickCardForm(false);
    }, 1800);
  };

  // Quick Flashcard Form Open (sem textos pré-prontos)
  const handleOpenQuickCard = () => {
    setCardFront('');
    setCardBack('');
    setShowQuickCardForm(true);
  };

  // Importar Educational Objective da questão no verso
  const handleImportObjectiveToBack = () => {
    const objective = sourceMode === 'external'
      ? (lastSyncedObjective || '')
      : (currentInternalQuestion?.educationalObjective || lastSyncedObjective || '');

    if (objective && objective.trim().length > 0) {
      setCardBack(objective.trim());
      setCardSaveFeedback('Educational Objective importado para o verso! ✓');
      setTimeout(() => setCardSaveFeedback(null), 2500);
    } else {
      setCardSaveFeedback('Esta questão não possui Educational Objective registrado.');
      setTimeout(() => setCardSaveFeedback(null), 2500);
    }
  };

  // Quick Note Creation from Question
  const handleCreateNoteFromActive = () => {
    // Utiliza o Subject extraído da questão como a área; se não existir uma com esse nome, cria uma
    const currentQ = matchingQuestionObj;
    const rawSubj = (activeSubject || currentQ?.subject || (sourceMode === 'external' ? lastSyncedSubject : currentInternalQuestion?.subject) || 'Geral').trim();
    const rawSys = (activeSystem || currentQ?.system || (sourceMode === 'external' ? lastSyncedSystem : currentInternalQuestion?.system) || 'Geral').trim();
    
    let areaId = noteAreaId;
    if (!areaId) {
      const state = useStore.getState();
      const currentAreas = state.notebookAreas || [];
      const foundArea = currentAreas.find(a => a.name.trim().toLowerCase() === rawSubj.toLowerCase());
      if (foundArea) {
        areaId = foundArea.id;
      } else {
        const defaultNbId = state.studyNotebooks[0]?.id || 'nb-principal';
        areaId = createNotebookArea(rawSubj, '#3b82f6', defaultNbId);
      }
    }

    const title = noteTitle.trim() || `Questão ${activeQid} - ${rawSubj}`;

    const content = `<h3>Anotações da Questão (QID: ${activeQid}):</h3>
<div class="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/60 text-sm leading-relaxed my-3">
  <b>Matéria:</b> ${rawSubj} | <b>Sistema:</b> ${rawSys}
</div>
${lastSyncedObjective ? `<blockquote><p><b>Educational Objective:</b> ${lastSyncedObjective}</p></blockquote>` : ''}`;

    const noteId = createStudyNote({
      notebookId: studyNotebooks[0]?.id || 'nb-principal',
      areaId,
      systemId: noteSystemId || undefined,
      subjectId: noteSubjectId || undefined,
      topicId: noteTopicId || undefined,
      title,
      content,
      icon: '🎯',
      associatedQuestionIds: [activeQid],
      tags: [`qid:${activeQid}`, rawSubj, rawSys].filter(Boolean),
    });

    setEditingNoteId(noteId);
    setShowQuickNoteForm(false);
  };

  const formatTime = (totalSec: number) => {
    const sec = Math.max(0, Math.round(totalSec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Aggregate Statistics (Subject & System) Calculation
  const statistics = useMemo(() => {
    const allRecords: StudyDeskQuestionRecord[] = [];
    
    studyDeskSessions.forEach(s => {
      if (s.questionRecords) {
        allRecords.push(...s.questionRecords);
      }
    });

    questions.forEach(q => {
      if (q.status && q.status !== 'unused') {
        const hasExisting = allRecords.some(r => r.qid === q.qid || r.questionId === q.id);
        if (!hasExisting) {
          allRecords.push({
            qid: q.qid || q.id,
            questionId: q.id,
            selectedChoiceId: q.selectedChoiceId,
            isCorrect: q.status === 'correct',
            resolutionTimeSeconds: q.resolutionTimeSeconds || 60,
            reviewTimeSeconds: q.reviewTimeSeconds || 90,
            subject: q.subject || 'Outros',
            system: q.system || 'Geral',
            answeredAt: q.lastAnsweredAt || Date.now(),
          });
        }
      }
    });

    const totalQuestionsDone = allRecords.length;
    const totalCorrect = allRecords.filter(r => r.isCorrect).length;
    const overallAccuracy = totalQuestionsDone > 0 ? Math.round((totalCorrect / totalQuestionsDone) * 100) : 0;
    const totalSolveTime = allRecords.reduce((acc, r) => acc + (r.resolutionTimeSeconds || 0), 0);
    const totalRevTime = allRecords.reduce((acc, r) => acc + (r.reviewTimeSeconds || 0), 0);
    const avgSolveTime = totalQuestionsDone > 0 ? Math.round(totalSolveTime / totalQuestionsDone) : 0;
    const avgRevTime = totalQuestionsDone > 0 ? Math.round(totalRevTime / totalQuestionsDone) : 0;

    const bySubjectMap = new Map<string, { total: number; correct: number; solveTimeSum: number; revTimeSum: number }>();
    const bySystemMap = new Map<string, { total: number; correct: number; solveTimeSum: number; revTimeSum: number }>();

    allRecords.forEach(r => {
      const subj = (r.subject || 'Outros / Sem Matéria').trim();
      const sys = (r.system || 'Geral / Sem Sistema').trim();

      const subjData = bySubjectMap.get(subj) || { total: 0, correct: 0, solveTimeSum: 0, revTimeSum: 0 };
      subjData.total += 1;
      if (r.isCorrect) subjData.correct += 1;
      subjData.solveTimeSum += r.resolutionTimeSeconds || 0;
      subjData.revTimeSum += r.reviewTimeSeconds || 0;
      bySubjectMap.set(subj, subjData);

      const sysData = bySystemMap.get(sys) || { total: 0, correct: 0, solveTimeSum: 0, revTimeSum: 0 };
      sysData.total += 1;
      if (r.isCorrect) sysData.correct += 1;
      sysData.solveTimeSum += r.resolutionTimeSeconds || 0;
      sysData.revTimeSum += r.reviewTimeSeconds || 0;
      bySystemMap.set(sys, sysData);
    });

    const subjectStats = Array.from(bySubjectMap.entries()).map(([name, data]) => ({
      name,
      total: data.total,
      correct: data.correct,
      incorrect: data.total - data.correct,
      accuracy: Math.round((data.correct / data.total) * 100),
      avgSolveTime: Math.round(data.solveTimeSum / data.total),
      avgRevTime: Math.round(data.revTimeSum / data.total),
    })).sort((a, b) => b.total - a.total);

    const systemStats = Array.from(bySystemMap.entries()).map(([name, data]) => ({
      name,
      total: data.total,
      correct: data.correct,
      incorrect: data.total - data.correct,
      accuracy: Math.round((data.correct / data.total) * 100),
      avgSolveTime: Math.round(data.solveTimeSum / data.total),
      avgRevTime: Math.round(data.revTimeSum / data.total),
    })).sort((a, b) => b.total - a.total);

    return {
      totalQuestionsDone,
      totalCorrect,
      overallAccuracy,
      avgSolveTime,
      avgRevTime,
      subjectStats,
      systemStats,
    };
  }, [studyDeskSessions, questions]);

  return (
    <div className={cn(
      "flex flex-col flex-1 bg-gray-50 dark:bg-gray-950 font-sans transition-all text-gray-900 dark:text-gray-100",
      isFullscreen ? "fixed inset-0 z-50 overflow-y-auto" : "min-h-[calc(100vh-3.5rem)]"
    )}>
      {/* TOP INTEGRATED BAR */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Left: Module Title & Source Mode Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Mesa de Estudos
                </h1>
                {sourceMode === 'external' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>Qbank Externo ({externalSourcePlatform})</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5">
                    <Database className="w-3 h-3 text-blue-600" />
                    <span>Banco do Site</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {sourceMode === 'external'
                  ? `Pacer completo sincronizado em tempo real com o Question Pacer geral`
                  : `Banco local interno com ${questions.length} questões cadastradas`}
              </p>
            </div>
          </div>

          {/* Mode Switcher Buttons: External (Default) vs Internal */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl ml-2 border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                setSourceMode('external');
                setActiveQuestionIndex(0);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                sourceMode === 'external'
                  ? "bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-500/20"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              )}
              title="Modo padrão: Sincroniza com Qbankly, UWorld, Amboss via extensão"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              <span>Qbank Externo (Padrão)</span>
            </button>

            <button
              onClick={() => {
                setSourceMode('internal');
                setActiveQuestionIndex(0);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                sourceMode === 'internal'
                  ? "bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-blue-500/20"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              )}
              title="Utilizar os bancos de questões cadastrados no próprio site"
            >
              <Database className="w-3.5 h-3.5 text-blue-500" />
              <span>Banco do Site</span>
            </button>
          </div>

          {sourceMode === 'internal' && (
            <div className="hidden md:flex items-center gap-2 pl-2">
              <select
                value={selectedBankId}
                onChange={(e) => {
                  setSelectedBankId(e.target.value);
                  setActiveQuestionIndex(0);
                }}
                className="text-xs bg-gray-100 dark:bg-gray-800 border-none rounded-lg px-2.5 py-1.5 font-medium text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">Todos os Bancos ({questions.length})</option>
                {questionBanks.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right: Actions, Statistics & Fullscreen */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStatsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 font-bold text-xs transition-colors border border-indigo-200 dark:border-indigo-800 cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Estatísticas por Subject/System</span>
            <span className="sm:hidden">Stats</span>
          </button>

          <Link
            to="/extensao"
            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Download da Extensão Oficial"
          >
            <Chrome className="w-4 h-4 text-blue-500" />
          </Link>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={isFullscreen ? "Sair do Modo Foco" : "Modo Foco / Tela Cheia"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* MAIN UNIFIED WORKSPACE (PACER ON TOP, TABS BELOW) */}
      <div className="flex-1 flex flex-col gap-6 p-4 sm:p-6 max-w-[1440px] mx-auto w-full">
        {/* TOP SECTION: QUESTION PACER & QUESTION CONTEXT */}
        <div className="flex flex-col gap-4">
          {/* Active Question Meta Header */}
          <div className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-mono font-extrabold text-xs border border-emerald-200 dark:border-emerald-800">
                QID #{activeQid}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800">
                📚 {activeSubject}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-200 dark:border-blue-800">
                🩺 {activeSystem}
              </span>
            </div>

            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {sourceMode === 'external' ? 'Qbank Externo Conectado' : `Questão ${activeQuestionIndex + 1} de ${availableQuestions.length}`}
            </div>
          </div>

          {/* Render the full-featured QuestionPacer Component */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2 sm:p-4 shadow-xs">
            <QuestionPacer className="w-full shadow-none border-none p-0 bg-transparent" />
          </div>

          {/* If in Internal Mode, also show internal question viewer */}
          {sourceMode === 'internal' && currentInternalQuestion && (
            <div className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
              <div className="text-sm font-bold text-gray-900 dark:text-white pb-2 border-b border-gray-100 dark:border-gray-800 flex justify-between">
                <span>Enunciado da Questão Interna</span>
                <button
                  onClick={() => toggleQuestionFlag(currentInternalQuestion.id || currentInternalQuestion.qid)}
                  className="text-gray-400 hover:text-amber-500 cursor-pointer"
                >
                  <Flag className={cn("w-4 h-4", currentInternalQuestion.isFlagged && "fill-amber-500 text-amber-500")} />
                </button>
              </div>

              <div
                className="text-sm leading-relaxed text-gray-800 dark:text-gray-200"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(currentInternalQuestion.stem || currentInternalQuestion.text || '')
                }}
              />

              <div className="space-y-2 pt-2">
                {currentInternalQuestion.alternatives.map(alt => (
                  <div
                    key={alt.id}
                    onClick={() => handleSelectChoice(alt.id)}
                    className={cn(
                      "flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer select-none transition-colors",
                      isAnswerRevealed
                        ? alt.isCorrect
                          ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-bold"
                          : selectedChoiceId === alt.id
                            ? "bg-rose-50 border-rose-500 text-rose-950 font-medium"
                            : "opacity-60 border-gray-200"
                        : selectedChoiceId === alt.id
                          ? "bg-blue-50 border-blue-600 text-blue-900 font-medium"
                          : "border-gray-200 hover:border-blue-300"
                    )}
                  >
                    <span className="w-5 h-5 rounded-md flex items-center justify-center font-bold border shrink-0">
                      {alt.letter}
                    </span>
                    <span className="flex-1">{alt.text}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="flex gap-2">
                  <button onClick={handlePrevInternalQuestion} className="px-3 py-1.5 border rounded-lg font-bold text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                    Anterior
                  </button>
                  <button onClick={handleNextInternalQuestion} className="px-3 py-1.5 border rounded-lg font-bold text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                    Próxima
                  </button>
                </div>
                <button
                  onClick={handleSubmitInternalAnswer}
                  disabled={!selectedChoiceId}
                  className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer"
                >
                  Confirmar Resposta
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM SECTION: TABS DISPOSED BELOW THE PACER (FLASHCARDS, CADERNO DE ESTUDOS, MÉTRICAS) */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col overflow-hidden">
          {/* Synchronized Workspace Tab Selector */}
          <div className="flex items-center justify-between p-3.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-850/70">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveRightTab('flashcards')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  activeRightTab === 'flashcards'
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-gray-800"
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Flashcards ({activeQuestionCards.length})</span>
              </button>

              <button
                onClick={() => setActiveRightTab('notes')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  activeRightTab === 'notes'
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-gray-800"
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Caderno de Estudos ({activeQuestionNotes.length})</span>
              </button>

              <button
                onClick={() => setActiveRightTab('stats')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  activeRightTab === 'stats'
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-gray-800"
                )}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Métricas & Histórico</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Sincronizado com a questão ativa</span>
            </div>
          </div>

            {/* TAB CONTENT: FLASHCARDS */}
            {activeRightTab === 'flashcards' && (
              <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-14rem)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    <span>Flashcards da Questão #{activeQid}</span>
                  </span>

                  <button
                    onClick={() => {
                      if (!showQuickCardForm) {
                        handleOpenQuickCard();
                      } else {
                        setShowQuickCardForm(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer ml-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Novo Flashcard</span>
                  </button>
                </div>

                {showQuickCardForm && (
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                        Criar Flashcard Vinculado à QID #{activeQid}
                      </span>
                      <button
                        onClick={() => setShowQuickCardForm(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 block mb-1">Baralho Destino:</label>
                      <select
                        value={cardDeckId}
                        onChange={(e) => setCardDeckId(e.target.value)}
                        className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 font-medium text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                      >
                        {decks.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 block mb-1">Frente (Prompt / Pergunta):</label>
                      <textarea
                        value={cardFront}
                        onChange={(e) => setCardFront(e.target.value)}
                        rows={2}
                        className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-gray-900 dark:text-gray-100 font-sans focus:ring-2 focus:ring-blue-500"
                        placeholder="Digite o enunciado, conceito ou pergunta..."
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Verso (Resposta / Conceito):</label>
                        <button
                          type="button"
                          onClick={handleImportObjectiveToBack}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
                          title="Importar Educational Objective da questão no verso"
                        >
                          <Download className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          <span>Importar Educational Objective</span>
                        </button>
                      </div>
                      <textarea
                        value={cardBack}
                        onChange={(e) => setCardBack(e.target.value)}
                        rows={3}
                        className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-gray-900 dark:text-gray-100 font-sans focus:ring-2 focus:ring-blue-500"
                        placeholder="Digite a resposta esperada ou use o botão acima para importar o Educational Objective..."
                      />
                    </div>

                    {cardSaveFeedback && (
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                        {cardSaveFeedback}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => setShowQuickCardForm(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveQuickCard}
                        disabled={!cardFront.trim() || !cardBack.trim()}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Salvar e Vincular
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cards desta questão ({activeQuestionCards.length})
                  </h4>

                  {activeQuestionCards.length === 0 ? (
                    <div className="text-center py-8 px-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-gray-400 space-y-2">
                      <Layers className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
                      <p className="text-xs">Nenhum flashcard vinculado à QID #{activeQid}.</p>
                      <p className="text-[11px] text-gray-400">Use os botões rápidos acima para criar cards instantaneamente.</p>
                    </div>
                  ) : (
                    activeQuestionCards.map(c => (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850 hover:border-blue-300 dark:hover:border-blue-700 transition-all shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-[11px] text-gray-400">
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            {decks.find(d => d.id === c.deckId)?.name || 'Baralho'}
                          </span>
                          <span>Repetições: {c.repetition || 0}</span>
                        </div>

                        <div className="text-xs font-semibold text-gray-900 dark:text-white" dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.front) }} />
                        <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 text-xs text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-700" dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.back) }} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: STUDY NOTEBOOK */}
            {activeRightTab === 'notes' && (
              <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-14rem)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={handleCreateNoteFromActive}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold hover:bg-emerald-100 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Nova Nota Vinculada à Questão</span>
                  </button>

                  <button
                    onClick={() => setShowQuickNoteForm(!showQuickNoteForm)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold hover:bg-blue-100 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Configurar Destino</span>
                  </button>
                </div>

                {showQuickNoteForm && (
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-emerald-500" />
                        Nova Nota no Caderno
                      </span>
                      <button onClick={() => setShowQuickNoteForm(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 block mb-1">Área do Caderno:</label>
                        <select
                          value={noteAreaId}
                          onChange={(e) => setNoteAreaId(e.target.value)}
                          className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 font-medium"
                        >
                          <option value="">Automático: {activeSubject || 'Geral'} (Cria área com nome do Subject)</option>
                          {notebookAreas.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 block mb-1">Título da Nota:</label>
                        <input
                          type="text"
                          value={noteTitle}
                          onChange={(e) => setNoteTitle(e.target.value)}
                          placeholder="Título da anotação..."
                          className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 font-medium"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setShowQuickNoteForm(false)}
                        className="px-3 py-1.5 text-xs text-gray-500"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleCreateNoteFromActive}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                      >
                        Criar e Abrir Editor
                      </button>
                    </div>
                  </div>
                )}

                {editingNoteId ? (
                  <div className="space-y-3">
                    {(() => {
                      const activeNote = studyNotes.find(n => n.id === editingNoteId);
                      if (!activeNote) return null;

                      return (
                        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-850 shadow-xs space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                            <div>
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Editando Nota:</span>
                              <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">{activeNote.title}</h4>
                            </div>
                            <button
                              onClick={() => setEditingNoteId(null)}
                              className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 font-semibold"
                            >
                              Fechar Editor
                            </button>
                          </div>

                          <InlineNoteRichEditor
                            initialContent={activeNote.content || ''}
                            onSave={(newContent) => {
                              updateStudyNote(activeNote.id, { content: newContent });
                            }}
                            onCancel={() => setEditingNoteId(null)}
                            placeholder="Escreva suas anotações clínicas aqui..."
                          />
                        </div>
                      );
                    })()}
                  </div>
                ) : null}

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Notas Vinculadas a esta questão ({activeQuestionNotes.length})
                  </h4>

                  {activeQuestionNotes.length === 0 ? (
                    <div className="text-center py-8 px-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-gray-400 space-y-2">
                      <FileText className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
                      <p className="text-xs">Nenhuma nota do caderno vinculada à QID #{activeQid}.</p>
                      <p className="text-[11px] text-gray-400">Clique em "Nova Nota Vinculada à Questão" para registrar no caderno.</p>
                    </div>
                  ) : (
                    activeQuestionNotes.map(n => (
                      <div
                        key={n.id}
                        onClick={() => setEditingNoteId(n.id)}
                        className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all shadow-xs cursor-pointer space-y-2 group"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <span>{n.icon || '📝'}</span>
                            <span>{notebookAreas.find(a => a.id === n.areaId)?.name || 'Área Geral'}</span>
                          </span>
                          <span className="text-gray-400 group-hover:text-blue-500 font-medium">Clique para Editar ✏️</span>
                        </div>

                        <h5 className="font-bold text-sm text-gray-900 dark:text-white">{n.title}</h5>
                        <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3" dangerouslySetInnerHTML={{ __html: sanitizeHtml(n.content) }} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: METRICS & STATS */}
            {activeRightTab === 'stats' && (
              <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-14rem)]">
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850 space-y-3">
                  <h4 className="font-bold text-xs text-gray-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
                    <span>Desempenho Geral Registrado</span>
                    <span className="text-blue-600 font-bold">{statistics.overallAccuracy}% de Acertos</span>
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Questões Respondidas:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{statistics.totalQuestionsDone}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Acertos:</span>
                      <span className="font-bold text-emerald-600">{statistics.totalCorrect}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Tempo Médio Resolução:</span>
                      <span className="font-bold font-mono text-gray-900 dark:text-white">{formatTime(statistics.avgSolveTime)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Tempo Médio Revisão:</span>
                      <span className="font-bold font-mono text-gray-900 dark:text-white">{formatTime(statistics.avgRevTime)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowStatsModal(true)}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Ver Análise Detalhada por Subject & System</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* DETAILED STATISTICS MODAL: BY SUBJECT & BY SYSTEM */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-850/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                    Estatísticas da Mesa de Estudos
                  </h3>
                  <p className="text-xs text-gray-500">
                    Desempenho por Matéria (Subject) e Sistema (System) com tempos de resolução e revisão
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowStatsModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-900">
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                <button
                  onClick={() => setStatsBreakdownType('subject')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    statsBreakdownType === 'subject'
                      ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs"
                      : "text-gray-600 dark:text-gray-400"
                  )}
                >
                  📚 Por Subject (Matéria)
                </button>
                <button
                  onClick={() => setStatsBreakdownType('system')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    statsBreakdownType === 'system'
                      ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs"
                      : "text-gray-600 dark:text-gray-400"
                  )}
                >
                  🩺 Por System (Sistema)
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500 font-semibold">Métrica:</span>
                <select
                  value={statsMetricType}
                  onChange={(e) => setStatsMetricType(e.target.value as any)}
                  className="bg-gray-100 dark:bg-gray-800 border-none rounded-lg px-2.5 py-1.5 font-bold text-gray-700 dark:text-gray-200"
                >
                  <option value="accuracy">Taxa de Acertos (%)</option>
                  <option value="solveTime">Tempo de Resolução (seg)</option>
                  <option value="reviewTime">Tempo de Revisão (seg)</option>
                  <option value="count">Volume de Questões</option>
                </select>
              </div>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-center">
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase">Questões Feitas</span>
                  <div className="text-2xl font-extrabold text-blue-950 dark:text-blue-100 mt-0.5">{statistics.totalQuestionsDone}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-center">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">% Acertos Geral</span>
                  <div className="text-2xl font-extrabold text-emerald-950 dark:text-emerald-100 mt-0.5">{statistics.overallAccuracy}%</div>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-center">
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase">Média Resolução</span>
                  <div className="text-2xl font-extrabold font-mono text-amber-950 dark:text-amber-100 mt-0.5">{formatTime(statistics.avgSolveTime)}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 text-center">
                  <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase">Média Revisão</span>
                  <div className="text-2xl font-extrabold font-mono text-purple-950 dark:text-purple-100 mt-0.5">{formatTime(statistics.avgRevTime)}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850">
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">
                  {statsBreakdownType === 'subject' ? 'Comparativo por Subject' : 'Comparativo por System'}
                </h4>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={statsBreakdownType === 'subject' ? statistics.subjectStats : statistics.systemStats}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          color: '#fff',
                          borderRadius: '8px',
                          border: 'none',
                          fontSize: '12px'
                        }}
                      />
                      <Bar
                        dataKey={
                          statsMetricType === 'accuracy' ? 'accuracy' :
                          statsMetricType === 'solveTime' ? 'avgSolveTime' :
                          statsMetricType === 'reviewTime' ? 'avgRevTime' : 'total'
                        }
                        name={
                          statsMetricType === 'accuracy' ? 'Acertos (%)' :
                          statsMetricType === 'solveTime' ? 'Resolução (seg)' :
                          statsMetricType === 'reviewTime' ? 'Revisão (seg)' : 'Qtd Questões'
                        }
                        fill="#3b82f6"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Categoria</th>
                      <th className="p-3 text-center">Questões</th>
                      <th className="p-3 text-center">Acertos (%)</th>
                      <th className="p-3 text-center">Tempo Resolução</th>
                      <th className="p-3 text-center">Tempo Revisão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                    {(statsBreakdownType === 'subject' ? statistics.subjectStats : statistics.systemStats).map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                        <td className="p-3 font-bold text-gray-900 dark:text-white">{item.name}</td>
                        <td className="p-3 text-center">{item.total}</td>
                        <td className="p-3 text-center font-bold">
                          <span className={cn(
                            "px-2 py-0.5 rounded-md",
                            item.accuracy >= 70 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" :
                            item.accuracy >= 50 ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" :
                            "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                          )}>
                            {item.accuracy}%
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono">{formatTime(item.avgSolveTime)}</td>
                        <td className="p-3 text-center font-mono">{formatTime(item.avgRevTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 flex justify-end">
              <button
                onClick={() => setShowStatsModal(false)}
                className="px-5 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
