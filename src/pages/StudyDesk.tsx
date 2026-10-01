import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
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
  Filter,
  Plus,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Volume2,
  VolumeX,
  Settings2,
  Save,
  Flag,
  Check,
  X,
  HelpCircle,
  Maximize2,
  Minimize2,
  Trash2,
  Search,
  ExternalLink,
  History,
  Folder,
  SlidersHorizontal,
  Lightbulb,
  ArrowRight,
  ArrowLeft,
  Compass,
  Zap,
  Target,
  Globe,
  Database,
  Radio,
  Download,
  Chrome
} from 'lucide-react';
import {
  useStore,
  Question,
  QuestionAlternative,
  Flashcard,
  StudyNote,
  StudyDeskSession,
  StudyDeskQuestionRecord,
  NotebookArea,
  NotebookSystem,
  NotebookSubject,
  NotebookTopic
} from '../cardblocks/store/useStore';
import { useTimerStore } from '../store/useTimerStore';
import { audioManager } from '../services/audioManager';
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
  Cell,
  PieChart,
  Pie
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
    updateStudyNote,
    toggleQuestionFlag,
    createQuestionBank,
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
    setPacerState,
    syncPacerQuestion,
    setTimerState,
    timerState
  } = useTimerStore();

  // Mode: 'external' (default: Qbankly, UWorld, Amboss) or 'internal' (site bank)
  const [sourceMode, setSourceMode] = useState<'external' | 'internal'>('external');

  // External live status & last received question info
  const [lastExternalSyncTime, setLastExternalSyncTime] = useState<number>(Date.now());
  const [externalSourcePlatform, setExternalSourcePlatform] = useState<string>('Qbankly / UWorld / Amboss');

  // Local State
  const [selectedBankId, setSelectedBankId] = useState<string>('all');
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const [activeRightTab, setActiveRightTab] = useState<'flashcards' | 'notes' | 'stats'>('flashcards');
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [eliminatedChoices, setEliminatedChoices] = useState<string[]>([]);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState<boolean>(false);
  const [isExplanationOpen, setIsExplanationOpen] = useState<boolean>(false);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showSessionModal, setShowSessionModal] = useState<boolean>(false);
  const [statsBreakdownType, setStatsBreakdownType] = useState<'subject' | 'system'>('subject');
  const [statsMetricType, setStatsMetricType] = useState<'accuracy' | 'solveTime' | 'reviewTime' | 'count'>('accuracy');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Local Timers for active question (in case Pacer is not running globally)
  const [localSolveSeconds, setLocalSolveSeconds] = useState<number>(0);
  const [localReviewSeconds, setLocalReviewSeconds] = useState<number>(0);
  const [localPhase, setLocalPhase] = useState<'solve' | 'review'>('solve');
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);

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
          setLastExternalSyncTime(Date.now());
          const payload = event.data.payload || event.data.question || event.data;
          if (payload.bankName || payload.source) {
            setExternalSourcePlatform(payload.bankName || payload.source);
          }
          // Automatically focus on the newly imported question if in external mode
          if (sourceMode === 'external') {
            setActiveQuestionIndex(0);
          }
        }
      };
    } catch (e) {}

    const handleWindowMsg = (event: MessageEvent) => {
      if (event.data && (event.data.type === 'USMLE_IMPORT_QUESTION' || event.data.type === 'QBANK_QUESTION_SYNC')) {
        setLastExternalSyncTime(Date.now());
        const payload = event.data.payload || event.data.question || event.data;
        if (payload.bankName || payload.source) {
          setExternalSourcePlatform(payload.bankName || payload.source);
        }
        if (sourceMode === 'external') {
          setActiveQuestionIndex(0);
        }
      }
    };
    window.addEventListener('message', handleWindowMsg);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('message', handleWindowMsg);
    };
  }, [sourceMode]);

  // Questions List depending on Mode
  const availableQuestions = useMemo(() => {
    let list = questions;

    if (sourceMode === 'internal') {
      if (selectedBankId !== 'all') {
        list = list.filter(q => q.bankId === selectedBankId);
      }
    }

    // Default sample questions for realistic live external testing
    if (list.length === 0) {
      return [
        {
          id: 'ext-sample-1',
          qid: '10420',
          bankId: 'bank-1',
          text: 'Um homem de 62 anos apresenta dispneia progressiva aos esforços e dor precordial típica há 4 meses. Ao exame físico, observa-se pulso carotídeo de ascensão lenta e pico tardio (pulsus parvus et tardus) e um sopro mesossistólico em crescendo-decrescendo no segundo espaço intercostal direito, com irradiação para as carótidas. O desdobramento da segunda bulha cardíaca (B2) é paradoxal. Qual é o mecanismo fisiopatológico primário dessa condição?',
          stem: 'Um homem de 62 anos apresenta dispneia progressiva aos esforços e dor precordial típica há 4 meses. Ao exame físico, observa-se pulso carotídeo de ascensão lenta e pico tardio (pulsus parvus et tardus) e um sopro mesossistólico em crescendo-decrescendo no segundo espaço intercostal direito, com irradiação para as carótidas. O desdobramento da segunda bulha cardíaca (B2) é paradoxal. Qual é o mecanismo fisiopatológico primário dessa condição?',
          subject: 'Cardiologia',
          system: 'Cardiovascular',
          area: 'Clínica Médica',
          status: 'unused' as const,
          alternatives: [
            { id: 'alt-1', letter: 'A', text: 'Calcificação e fusão progressiva das cúspides da valva aórtica levando a aumento da pós-carga do VE', isCorrect: true },
            { id: 'alt-2', letter: 'B', text: 'Regurgitação retrógrada do fluxo sanguíneo para o ventrículo esquerdo durante a diástole', isCorrect: false },
            { id: 'alt-3', letter: 'C', text: 'Obstrução dinâmica da via de saída do ventrículo esquerdo por movimento sistólico anterior da valva mitral', isCorrect: false },
            { id: 'alt-4', letter: 'D', text: 'Dilatação do anel valvar pulmonar com sobrecarga de pressão no ventrículo direito', isCorrect: false },
            { id: 'alt-5', letter: 'E', text: 'Degeneração mixomatosa com prolapso dos folhetos valvares atrioventriculares', isCorrect: false },
          ],
          explanation: 'O quadro clínico descreve a clássica tríade e achados de <b>Estenose Aórtica (EA)</b> calcificada do idoso (ou valva bicúspide em mais jovens). O sopro mesossistólico em diamante, o pulso <i>parvus et tardus</i> e o desdobramento paradoxal de B2 refletem a obstrução fixa à ejeção do VE, com aumento acentuado da pós-carga e hipertrofia concêntrica compensatória.',
          educationalObjective: 'A Estenose Aórtica gera aumento da pós-carga de VE, hipertrofia ventricular concêntrica, sopro sistólico com irradiação carotídea e pulso parvus et tardus.',
          tags: ['cardio', 'valvopatias', 'estenose-aortica', 'qbankly', 'uworld'],
        }
      ] as Question[];
    }
    return list;
  }, [questions, sourceMode, selectedBankId]);

  // Active Question
  const currentQuestion = useMemo(() => {
    if (activeQuestionIndex >= availableQuestions.length) {
      return availableQuestions[0] || null;
    }
    return availableQuestions[activeQuestionIndex] || null;
  }, [availableQuestions, activeQuestionIndex]);

  // Active Question's Associated Flashcards
  const activeQuestionCards = useMemo(() => {
    if (!currentQuestion) return [];
    const qid = currentQuestion.qid || currentQuestion.id;
    return cards.filter(c => 
      c.sourceQuestionId === qid || 
      c.sourceQuestionId === currentQuestion.id ||
      c.associatedQuestionIds?.includes(qid) ||
      c.associatedQuestionIds?.includes(currentQuestion.id) ||
      c.tags?.includes(`qid:${qid}`) ||
      (currentQuestion.associatedNoteIds && currentQuestion.associatedNoteIds.some(nId => c.associatedNoteIds?.includes(nId)))
    );
  }, [currentQuestion, cards]);

  // Active Question's Associated Study Notes
  const activeQuestionNotes = useMemo(() => {
    if (!currentQuestion) return [];
    const qid = currentQuestion.qid || currentQuestion.id;
    return studyNotes.filter(n =>
      n.associatedQuestionIds?.includes(qid) ||
      n.associatedQuestionIds?.includes(currentQuestion.id) ||
      n.tags?.includes(`qid:${qid}`) ||
      (currentQuestion.associatedNoteIds && currentQuestion.associatedNoteIds.includes(n.id))
    );
  }, [currentQuestion, studyNotes]);

  // When active question changes: reset local choice, reveal status and load associated items
  useEffect(() => {
    if (currentQuestion) {
      setSelectedChoiceId(currentQuestion.selectedChoiceId || null);
      setIsAnswerRevealed(Boolean(currentQuestion.status && currentQuestion.status !== 'unused'));
      setIsExplanationOpen(Boolean(currentQuestion.status && currentQuestion.status !== 'unused'));
      setEliminatedChoices([]);
      setLocalSolveSeconds(currentQuestion.resolutionTimeSeconds || 0);
      setLocalReviewSeconds(currentQuestion.reviewTimeSeconds || 0);
      setLocalPhase(currentQuestion.status && currentQuestion.status !== 'unused' ? 'review' : 'solve');

      // Pre-fill quick card default
      if (decks.length > 0 && !cardDeckId) {
        setCardDeckId(decks[0].id);
      }
      setCardFront(`Qual é a conduta / conceito-chave da Questão ${currentQuestion.qid || ''} (${currentQuestion.subject || currentQuestion.system || 'Geral'})?`);
      setCardBack(`<p><b>Conceito Principal:</b></p><p>${currentQuestion.educationalObjective || currentQuestion.explanation?.substring(0, 200) || ''}</p>`);
      setCardTags(`qid:${currentQuestion.qid || ''}, ${currentQuestion.subject || ''}, ${currentQuestion.system || ''}`.trim());

      // Pre-fill quick note defaults
      if (notebookAreas.length > 0 && !noteAreaId) {
        setNoteAreaId(notebookAreas[0].id);
      }
      setNoteTitle(`Questão ${currentQuestion.qid || ''} - ${currentQuestion.subject || currentQuestion.system || 'Revisão'}`);
    }
  }, [currentQuestion?.id, currentQuestion?.qid]);

  // Active Question Timer Interval
  useEffect(() => {
    if (!isTimerRunning || !currentQuestion) return;

    const interval = setInterval(() => {
      if (localPhase === 'solve') {
        setLocalSolveSeconds(s => s + 1);
      } else {
        setLocalReviewSeconds(s => s + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, localPhase, currentQuestion?.id]);

  // Auto ensure an active desk session exists
  useEffect(() => {
    if (!activeDeskSessionId && studyDeskSessions.length === 0) {
      startDeskSession({
        name: `Mesa de Estudos (${sourceMode === 'external' ? 'Qbank Externo' : 'Banco Interno'}) - ${new Date().toLocaleDateString('pt-BR')}`,
        totalQuestions: availableQuestions.length || 40,
        bankId: selectedBankId !== 'all' ? selectedBankId : undefined,
      });
    }
  }, [activeDeskSessionId, studyDeskSessions.length, availableQuestions.length, selectedBankId, sourceMode]);

  // Keyboard Shortcuts (Alt+B: Prev, Alt+N: Next, Alt+Enter: Submit, Alt+F: Flag)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if ((e.altKey && e.key.toLowerCase() === 'b') || (e.key === 'ArrowLeft' && e.altKey)) {
        e.preventDefault();
        handlePrevQuestion();
      } else if ((e.altKey && e.key.toLowerCase() === 'n') || (e.key === 'ArrowRight' && e.altKey)) {
        e.preventDefault();
        handleNextQuestion();
      } else if (e.altKey && e.key === 'Enter') {
        e.preventDefault();
        handleSubmitAnswer();
      } else if (e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (currentQuestion) toggleQuestionFlag(currentQuestion.id || currentQuestion.qid);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeQuestionIndex, availableQuestions, selectedChoiceId, currentQuestion, isAnswerRevealed]);

  // Navigation Handlers with Integrated Pacer
  const handleNextQuestion = () => {
    if (activeQuestionIndex < availableQuestions.length - 1) {
      setActiveQuestionIndex(i => i + 1);
      syncPacerQuestion({ isNext: true, totalQuestions: availableQuestions.length });
    }
  };

  const handlePrevQuestion = () => {
    if (activeQuestionIndex > 0) {
      setActiveQuestionIndex(i => i - 1);
      syncPacerQuestion({ isPrev: true, totalQuestions: availableQuestions.length });
    }
  };

  const handleSelectChoice = (choiceId: string) => {
    if (isAnswerRevealed) return;
    setSelectedChoiceId(choiceId);
  };

  const handleToggleEliminate = (choiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAnswerRevealed) return;
    setEliminatedChoices(prev =>
      prev.includes(choiceId) ? prev.filter(id => id !== choiceId) : [...prev, choiceId]
    );
  };

  const handleSubmitAnswer = () => {
    if (!currentQuestion || !selectedChoiceId || isAnswerRevealed) return;

    const correctAlt = currentQuestion.alternatives.find(a => a.isCorrect);
    const isCorrect = correctAlt ? correctAlt.id === selectedChoiceId : false;

    setIsAnswerRevealed(true);
    setIsExplanationOpen(true);
    setLocalPhase('review');

    recordDeskQuestionAnswer({
      qid: currentQuestion.qid || currentQuestion.id,
      questionId: currentQuestion.id,
      selectedChoiceId,
      correctChoiceId: correctAlt?.id,
      isCorrect,
      resolutionTimeSeconds: Math.max(1, localSolveSeconds),
      reviewTimeSeconds: Math.max(0, localReviewSeconds),
      subject: currentQuestion.subject,
      system: currentQuestion.system,
    });

    syncPacerQuestion({ isSubmit: true, totalQuestions: availableQuestions.length });

    if (pacerSoundEnabled && pacerSoundSettings?.master) {
      audioManager.playActionBeep(isCorrect ? 'submit' : 'prev', 0.5);
    }
  };

  const handleResetCurrentQuestion = () => {
    if (!currentQuestion) return;
    setSelectedChoiceId(null);
    setIsAnswerRevealed(false);
    setIsExplanationOpen(false);
    setEliminatedChoices([]);
    setLocalSolveSeconds(0);
    setLocalReviewSeconds(0);
    setLocalPhase('solve');
  };

  // Simulate External Question (for instant test of live sync)
  const handleSimulateExternalQuestion = () => {
    const sampleQids = ['21490', '18920', '15201', '30412'];
    const randomQid = sampleQids[Math.floor(Math.random() * sampleQids.length)];
    const simulatedQ = {
      qid: randomQid,
      bankName: 'UWorld / Qbankly Live',
      stem: `Uma paciente de 34 anos é avaliada por fraqueza muscular flutuante e ptose palpebral bilateral que piora ao final do dia. Ela relata dificuldade para mastigar carnes duras. Os sintomas melhoram temporariamente com o repouso. O teste do gelo nos olhos resulta em melhora acentuada da ptose. Qual autoanticorpo está primariamente implicado na patogênese dessa doença? (QID: ${randomQid})`,
      alternatives: [
        { id: 'sim-1', letter: 'A', text: 'Anticorpos contra receptores nicotínicos de acetilcolina pós-sinápticos (AChR)', isCorrect: true },
        { id: 'sim-2', letter: 'B', text: 'Anticorpos contra canais de cálcio voltagem-dependentes pré-sinápticos (VGCC)', isCorrect: false },
        { id: 'sim-3', letter: 'C', text: 'Anticorpos contra a proteína da bainha de mielina básica (MBP)', isCorrect: false },
        { id: 'sim-4', letter: 'D', text: 'Anticorpos contra os receptores de rianodina do retículo sarcoplasmático', isCorrect: false },
      ],
      explanation: 'O quadro descreve <b>Miastenia Gravis</b>, caracterizada por autoanticorpos contra receptores de acetilcolina (AChR) na junção neuromuscular pós-sináptica. Causa fatigabilidade muscular clássica, ptose e diplopia.',
      educationalObjective: 'A Miastenia Gravis envolve autoanticorpos anti-AChR pós-sinápticos que levam à diminuição dos potenciais de placa terminal e fatigabilidade muscular.',
      subject: 'Neurologia',
      system: 'Sistema Nervoso & Musculoesquelético',
      tags: [`qid:${randomQid}`, 'miastenia-gravis', 'neurologia', 'qbankly', 'uworld'],
    };

    upsertQuestionFromQBank(simulatedQ);
    setExternalSourcePlatform('UWorld / Qbankly Live');
    setLastExternalSyncTime(Date.now());
    setActiveQuestionIndex(0);
  };

  // Quick Flashcard Creation
  const handleSaveQuickCard = () => {
    if (!currentQuestion || !cardFront.trim() || !cardBack.trim() || !cardDeckId) return;

    const tagsArray = cardTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const cardId = createCard({
      deckId: cardDeckId,
      front: cardFront,
      back: cardBack,
      details: currentQuestion.explanation ? `Fonte: QID ${currentQuestion.qid || ''} - ${currentQuestion.subject || ''}` : undefined,
      tags: tagsArray,
      sourceQuestionId: currentQuestion.qid || currentQuestion.id,
      associatedQuestionIds: [currentQuestion.qid || currentQuestion.id],
      subject: currentQuestion.subject,
      system: currentQuestion.system,
      educationalObjective: currentQuestion.educationalObjective,
    });

    setCardSaveFeedback('Flashcard criado e vinculado com sucesso! ✓');
    setTimeout(() => {
      setCardSaveFeedback(null);
      setShowQuickCardForm(false);
    }, 1800);
  };

  // Fast Card Presets
  const handlePresetObjective = () => {
    if (!currentQuestion) return;
    setCardFront(`<b>[${currentQuestion.subject || currentQuestion.system || 'High-Yield'}]</b> Qual é o ponto-chave sobre este tópico?`);
    setCardBack(`<p>${currentQuestion.educationalObjective || currentQuestion.explanation || ''}</p>`);
    setShowQuickCardForm(true);
  };

  const handlePresetQuestionAnswer = () => {
    if (!currentQuestion) return;
    const correctAlt = currentQuestion.alternatives.find(a => a.isCorrect);
    const cleanStem = (currentQuestion.stem || currentQuestion.text || '').replace(/<[^>]+>/g, '').trim();
    setCardFront(`<p><b>Cenário Clínico:</b> ${cleanStem.substring(0, 220)}...</p><p><b>Diagnóstico / Conduta:</b></p>`);
    setCardBack(`<p><b>Resposta:</b> ${correctAlt ? correctAlt.text : ''}</p><p><i>${currentQuestion.educationalObjective || ''}</i></p>`);
    setShowQuickCardForm(true);
  };

  // Quick Note Creation from Question
  const handleCreateNoteFromActive = () => {
    if (!currentQuestion) return;
    const areaId = noteAreaId || notebookAreas[0]?.id || 'area-clinica';
    const cleanStem = (currentQuestion.stem || currentQuestion.text || '').replace(/<[^>]+>/g, '').trim();
    const title = noteTitle.trim() || `Questão ${currentQuestion.qid || ''} - ${currentQuestion.subject || currentQuestion.system || 'Anotações'}`;

    const content = `<h3>Enunciado da Questão ${currentQuestion.qid ? `(QID: ${currentQuestion.qid})` : ''}:</h3>
<div class="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 text-sm leading-relaxed my-3">
  ${currentQuestion.stem || currentQuestion.text || ''}
</div>
<div class="my-3 space-y-1.5 font-sans">
  ${currentQuestion.alternatives.map(a => `
    <div class="p-2.5 rounded-lg border ${a.isCorrect ? 'bg-emerald-50 border-emerald-300 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200 font-bold' : 'bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-800/60 dark:border-gray-700 dark:text-gray-200'}">
      <b>${a.letter || ''}.</b> ${a.text} ${a.isCorrect ? ' <span class="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">[Gabarito Correto]</span>' : ''}
    </div>
  `).join('')}
</div>
${currentQuestion.explanation ? `<h4>Explicação Comentada:</h4><div class="p-4 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/60 text-sm leading-relaxed my-3">${currentQuestion.explanation}</div>` : ''}
${currentQuestion.educationalObjective ? `<blockquote><p><b>Educational Objective:</b> ${currentQuestion.educationalObjective}</p></blockquote>` : ''}
<p></p>`;

    const noteId = createStudyNote({
      notebookId: studyNotebooks[0]?.id || 'nb-principal',
      areaId,
      systemId: noteSystemId || undefined,
      subjectId: noteSubjectId || undefined,
      topicId: noteTopicId || undefined,
      title,
      content,
      icon: '🎯',
      associatedQuestionIds: [currentQuestion.qid || currentQuestion.id],
      tags: currentQuestion.tags || [`qid:${currentQuestion.qid || ''}`],
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

  const targetSolveSec = pacerTargetTimeSeconds || 75;
  const targetReviewSec = pacerTargetReviewSeconds || 150;
  const isOvertimeSolve = localSolveSeconds > targetSolveSec;
  const isOvertimeReview = localReviewSeconds > targetReviewSec;

  return (
    <div className={cn(
      "flex flex-col flex-1 bg-gray-50 dark:bg-gray-950 font-sans transition-all text-gray-900 dark:text-gray-100",
      isFullscreen ? "fixed inset-0 z-50 overflow-y-auto" : "min-h-[calc(100vh-3.5rem)]"
    )}>
      {/* TOP INTEGRATED BAR: Source Switcher, Pacer & Session Controls */}
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
                    <span>Qbank Externo (Live Sync)</span>
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
                  ? `Sincronizando com Qbankly / UWorld / Amboss • Extensão Ativa`
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
              title="Modo padrão: Sincroniza em tempo real com Qbankly, UWorld, Amboss via extensão"
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

          {/* If in internal mode, show bank selector */}
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

        {/* Center: Integrated Pacer Timers & Gauge */}
        <div className="flex items-center gap-2 sm:gap-4 bg-gray-100 dark:bg-gray-800/80 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevQuestion}
              disabled={activeQuestionIndex === 0}
              className="p-1 rounded-md text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
              title="Questão Anterior (Alt+B)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
              Q <span className="text-blue-600 dark:text-blue-400">{activeQuestionIndex + 1}</span> / {availableQuestions.length}
            </span>
            <button
              onClick={handleNextQuestion}
              disabled={activeQuestionIndex === availableQuestions.length - 1}
              className="p-1 rounded-md text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
              title="Próxima Questão (Alt+N)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="h-4 w-px bg-gray-300 dark:bg-gray-700" />

          {/* Integrated Timers (Solve vs Review) */}
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-bold transition-colors",
              localPhase === 'solve' 
                ? isOvertimeSolve 
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                : "text-gray-500 dark:text-gray-400 opacity-80"
            )}>
              <Clock className="w-3.5 h-3.5" />
              <span>Resolução: {formatTime(localSolveSeconds)}</span>
              <span className="text-[10px] text-gray-400 font-sans">({formatTime(targetSolveSec)})</span>
            </div>

            <div className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-bold transition-colors",
              localPhase === 'review'
                ? isOvertimeReview
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "text-gray-500 dark:text-gray-400 opacity-80"
            )}>
              <BookOpen className="w-3.5 h-3.5" />
              <span>Revisão: {formatTime(localReviewSeconds)}</span>
              <span className="text-[10px] text-gray-400 font-sans">({formatTime(targetReviewSec)})</span>
            </div>

            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className="p-1 rounded-md text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title={isTimerRunning ? "Pausar Cronômetro" : "Retomar Cronômetro"}
            >
              {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-500" />}
            </button>
            <button
              onClick={handleResetCurrentQuestion}
              className="p-1 rounded-md text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Reiniciar Questão & Tempo"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Test Simulator, Stats & Controls */}
        <div className="flex items-center gap-2">
          {sourceMode === 'external' && (
            <button
              onClick={handleSimulateExternalQuestion}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 font-bold text-xs transition-colors border border-emerald-200 dark:border-emerald-800 cursor-pointer"
              title="Simula a recepção de uma questão feita no Qbankly ou UWorld para testar ao vivo"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-600" />
              <span>Simular Qbankly / UWorld</span>
            </button>
          )}

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

      {/* EXTERNAL MODE LIVE COMPANION BANNER */}
      {sourceMode === 'external' && (
        <div className="bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-indigo-500/10 border-b border-emerald-500/20 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-emerald-950 dark:text-emerald-200 font-medium">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span>
              <strong>Banco Externo Ativo ({externalSourcePlatform}):</strong> Ao resolver questões no UWorld, Qbankly ou Amboss, os dados e o Pacer sincronizam automaticamente.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSimulateExternalQuestion}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              + Injetar Questão de Exemplo
            </button>
            <span className="text-gray-400">•</span>
            <button
              onClick={() => setSourceMode('internal')}
              className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline"
            >
              Alternar para Banco do Site →
            </button>
          </div>
        </div>
      )}

      {/* MAIN TWO-COLUMN WORKSPACE */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 max-w-[1720px] mx-auto w-full">
        {/* LEFT COLUMN: Active Question View & Pacer Navigation Buttons */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-5 sm:p-6 flex flex-col flex-1">
            {/* Question Header & Meta */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-mono font-bold text-xs border border-blue-200 dark:border-blue-800">
                  QID {currentQuestion?.qid || currentQuestion?.id || '—'}
                </span>
                {currentQuestion?.subject && (
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800">
                    📚 {currentQuestion.subject}
                  </span>
                )}
                {currentQuestion?.system && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800">
                    🩺 {currentQuestion.system}
                  </span>
                )}
              </div>

              {/* Flag & Status */}
              <div className="flex items-center gap-2">
                {currentQuestion?.status === 'correct' && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Correta
                  </span>
                )}
                {currentQuestion?.status === 'incorrect' && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                    <XCircle className="w-3.5 h-3.5" /> Incorreta
                  </span>
                )}
                <button
                  onClick={() => currentQuestion && toggleQuestionFlag(currentQuestion.id || currentQuestion.qid)}
                  className={cn(
                    "p-1.5 rounded-lg border transition-colors",
                    currentQuestion?.isFlagged
                      ? "bg-amber-50 border-amber-300 text-amber-600 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400"
                      : "border-gray-200 dark:border-gray-700 text-gray-400 hover:text-amber-500"
                  )}
                  title="Marcar questão com Flag (Alt+F)"
                >
                  <Flag className="w-4 h-4 fill-current" />
                </button>
              </div>
            </div>

            {/* Question Stem */}
            <div className="py-4 text-base sm:text-[17px] leading-relaxed text-gray-900 dark:text-gray-100 font-normal">
              {currentQuestion?.stem || currentQuestion?.text ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(currentQuestion.stem || currentQuestion.text || '')
                  }}
                />
              ) : (
                <div className="text-center py-10 space-y-3">
                  <Radio className="w-10 h-10 text-emerald-500 mx-auto animate-pulse" />
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    Aguardando questão do Qbank externo (Qbankly / UWorld / Amboss)...
                  </p>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    Abra uma questão no seu navegador com a extensão ativada ou clique no botão abaixo para simular.
                  </p>
                  <button
                    onClick={handleSimulateExternalQuestion}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md"
                  >
                    Simular Questão do Qbankly / UWorld
                  </button>
                </div>
              )}

              {/* Question Images if any */}
              {currentQuestion?.images && currentQuestion.images.length > 0 && (
                <div className="my-4 flex flex-wrap gap-3">
                  {currentQuestion.images.map((imgUrl, i) => (
                    <img
                      key={i}
                      src={imgUrl}
                      alt={`Imagem ${i + 1}`}
                      className="max-h-72 rounded-xl border border-gray-200 dark:border-gray-700 object-contain shadow-xs hover:scale-105 transition-transform cursor-pointer"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Alternatives */}
            <div className="space-y-2.5 my-4">
              {currentQuestion?.alternatives?.map((alt) => {
                const isSelected = selectedChoiceId === alt.id;
                const isEliminated = eliminatedChoices.includes(alt.id);
                const isCorrect = alt.isCorrect;

                let stateClass = "border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-gray-850";
                
                if (isAnswerRevealed) {
                  if (isCorrect) {
                    stateClass = "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-semibold ring-2 ring-emerald-500/20";
                  } else if (isSelected && !isCorrect) {
                    stateClass = "border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 ring-2 ring-rose-500/20";
                  } else {
                    stateClass = "border-gray-200 dark:border-gray-800 opacity-60 bg-gray-50/50 dark:bg-gray-900/50";
                  }
                } else if (isSelected) {
                  stateClass = "border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20 font-medium";
                }

                if (isEliminated && !isAnswerRevealed) {
                  stateClass = "border-gray-200 dark:border-gray-800 opacity-40 line-through bg-gray-100/50 dark:bg-gray-800/40";
                }

                return (
                  <div
                    key={alt.id}
                    onClick={() => handleSelectChoice(alt.id)}
                    className={cn(
                      "flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none group",
                      stateClass
                    )}
                  >
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border transition-colors",
                        isAnswerRevealed && isCorrect
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : isAnswerRevealed && isSelected && !isCorrect
                            ? "bg-rose-600 text-white border-rose-600"
                            : isSelected
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700"
                      )}>
                        {alt.letter || String.fromCharCode(65)}
                      </span>
                    </div>

                    <div className="flex-1 text-sm sm:text-base leading-relaxed">
                      {alt.text}
                    </div>

                    {!isAnswerRevealed && (
                      <button
                        onClick={(e) => handleToggleEliminate(alt.id, e)}
                        className={cn(
                          "px-2 py-1 text-xs rounded-md border font-mono opacity-0 group-hover:opacity-100 transition-opacity",
                          isEliminated
                            ? "border-rose-400 text-rose-600 bg-rose-50 dark:bg-rose-950/30 opacity-100"
                            : "border-gray-300 dark:border-gray-700 text-gray-400 hover:text-gray-700 hover:border-gray-400"
                        )}
                        title="Eliminar / Riscar alternativa"
                      >
                        {isEliminated ? 'Desfazer' : 'Riscar'}
                      </button>
                    )}

                    {isAnswerRevealed && isCorrect && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    {isAnswerRevealed && isSelected && !isCorrect && (
                      <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* INTEGRATED PACER ACTION BUTTONS & QUESTION NAVIGATION */}
            <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevQuestion}
                  disabled={activeQuestionIndex === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-200 disabled:opacity-40 transition-colors cursor-pointer"
                  title="Questão Anterior (Alt+B)"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>

                <button
                  onClick={handleNextQuestion}
                  disabled={activeQuestionIndex === availableQuestions.length - 1}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-200 disabled:opacity-40 transition-colors cursor-pointer"
                  title="Próxima Questão (Alt+N)"
                >
                  <span>Próxima</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {!isAnswerRevealed ? (
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={!selectedChoiceId}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none transition-all cursor-pointer"
                    title="Confirmar Resposta e Iniciar Revisão (Alt+Enter)"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirmar Resposta</span>
                  </button>
                ) : (
                  <button
                    onClick={handleNextQuestion}
                    disabled={activeQuestionIndex === availableQuestions.length - 1}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <span>Avançar para Próxima</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Explanation & Educational Objective Section */}
            {isAnswerRevealed && (
              <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-800 space-y-4 animate-in fade-in duration-300">
                {currentQuestion?.educationalObjective && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-900/60 shadow-xs">
                    <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-extrabold text-sm mb-1.5">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      <span>Educational Objective</span>
                    </div>
                    <p className="text-sm leading-relaxed text-blue-950 dark:text-blue-100 font-medium">
                      {currentQuestion.educationalObjective}
                    </p>
                  </div>
                )}

                {currentQuestion?.explanation && (
                  <div className="p-5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      <span>Explicação Detalhada</span>
                    </h3>
                    <div
                      className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 space-y-2"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(currentQuestion.explanation)
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: SYNCHRONIZED FLASHCARDS, STUDY NOTEBOOK & PERFORMANCE */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col flex-1 overflow-hidden">
            {/* Synchronized Workspace Tab Selector */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-850/60">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveRightTab('flashcards')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                    activeRightTab === 'flashcards'
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Flashcards ({activeQuestionCards.length})</span>
                </button>

                <button
                  onClick={() => setActiveRightTab('notes')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                    activeRightTab === 'notes'
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Caderno de Estudos ({activeQuestionNotes.length})</span>
                </button>

                <button
                  onClick={() => setActiveRightTab('stats')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                    activeRightTab === 'stats'
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Ritmo & Métricas</span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT: FLASHCARDS */}
            {activeRightTab === 'flashcards' && (
              <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-14rem)]">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handlePresetObjective}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs font-bold hover:bg-amber-100 transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Card do Objetivo Educacional</span>
                  </button>

                  <button
                    onClick={handlePresetQuestionAnswer}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-xs font-bold hover:bg-indigo-100 transition-colors"
                  >
                    <Target className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Card Pergunta / Resposta</span>
                  </button>

                  <button
                    onClick={() => setShowQuickCardForm(!showQuickCardForm)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold hover:bg-blue-100 transition-colors ml-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Novo Card</span>
                  </button>
                </div>

                {showQuickCardForm && (
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                        Criar Flashcard Vinculado à QID {currentQuestion?.qid || ''}
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
                        placeholder="Digite o enunciado ou gatilho..."
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 block mb-1">Verso (Resposta / Conceito):</label>
                      <textarea
                        value={cardBack}
                        onChange={(e) => setCardBack(e.target.value)}
                        rows={3}
                        className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-gray-900 dark:text-gray-100 font-sans focus:ring-2 focus:ring-blue-500"
                        placeholder="Digite a resposta esperada..."
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
                      <p className="text-xs">Nenhum flashcard vinculado a esta questão ainda.</p>
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
                    <span>Importar Questão para Nova Nota</span>
                  </button>

                  <button
                    onClick={() => setShowQuickNoteForm(!showQuickNoteForm)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold hover:bg-blue-100 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nota Personalizada</span>
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
                        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-855 shadow-xs space-y-3">
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
                      <p className="text-xs">Nenhuma nota do caderno vinculada a esta questão.</p>
                      <p className="text-[11px] text-gray-400">Clique em "Importar Questão para Nova Nota" para registrar no caderno.</p>
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

            {/* TAB CONTENT: PACE & LIVE METRICS */}
            {activeRightTab === 'stats' && (
              <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-14rem)]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 block mb-1">Tempo de Resolução</span>
                    <div className="text-xl font-mono font-extrabold text-blue-900 dark:text-blue-100">
                      {formatTime(localSolveSeconds)}
                    </div>
                    <span className="text-[10px] text-gray-500">Alvo: {formatTime(targetSolveSec)}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 block mb-1">Tempo de Revisão</span>
                    <div className="text-xl font-mono font-extrabold text-emerald-900 dark:text-emerald-100">
                      {formatTime(localReviewSeconds)}
                    </div>
                    <span className="text-[10px] text-gray-500">Alvo: {formatTime(targetReviewSec)}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850 space-y-3">
                  <h4 className="font-bold text-xs text-gray-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
                    <span>Desempenho da Sessão</span>
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
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Ver Análise por Subject & System</span>
                  </button>
                </div>
              </div>
            )}
          </div>
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
