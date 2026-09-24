import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, Square, FastForward, Clock, Activity, TrendingUp, TrendingDown, Volume2, VolumeX, Settings2, Pause, Save, X, BookOpen, Coffee, Chrome, RotateCcw, CheckCircle2, FileText, Check, ArrowRight, Zap, Bell, SlidersHorizontal, Timer } from 'lucide-react';
import { useTimerStore } from '../store/useTimerStore';
import { SoundSettingsModal } from './SoundSettingsModal';
import { audioManager } from '../services/audioManager';

export function QuestionPacer({ className }: { className?: string }) {
  const { 
    pacerIsActive: isActive, 
    pacerTotalQuestions: totalQuestions, 
    pacerTargetTimeSeconds: targetTimeSeconds, 
    pacerTargetReviewSeconds: targetReviewSeconds,
    pacerQBankMode: qbankMode,
    pacerTutoredPhase: tutoredPhase,
    pacerTriggerButton: triggerButton,
    pacerIsAdaptive: isAdaptive, 
    pacerCurrentQuestionTime: currentQuestionTime, 
    pacerCurrentReviewTime: currentReviewTime,
    pacerCompletedQuestionsTime: completedQuestionsTime, 
    pacerCompletedReviewTimes: completedReviewTimes,
    pacerSoundEnabled: soundEnabled,
    pacerSoundSettings,
    setPacerSoundSettings,
    togglePacerSoundSetting,
    setPacerState,
    nextPacerQuestion,
    prevPacerQuestion,
    submitPacerQuestion,
    stopPacer,
    finishPacerSession,
    resetPacerAccumulatedTime,
    addNetTime,
    setTimerState,
    phase,
    timerState,
    timeLeft,
    isAdaptiveMode,
    adaptiveCurrentCycle,
    adaptiveCyclesTotal,
    adaptiveStudyTimeTotal,
    adaptiveStudyTimeElapsed,
    adaptiveRestTimeTotal,
    adaptiveRestTimeElapsed,
    adaptivePacerSessions,
    takeUnscheduledRest,
    transitionPhase,
    stashPacerSession,
    setPhase,
    studyDuration,
    restDuration,
    setTimeLeft,
    setShowQuickLog
  } = useTimerStore();

  const setTotalQuestions = (v: number) => setPacerState({ pacerTotalQuestions: v });
  const setTargetTimeSeconds = (v: number) => setPacerState({ pacerTargetTimeSeconds: v });
  const setTargetReviewSeconds = (v: number) => setPacerState({ pacerTargetReviewSeconds: v });
  const setQbankMode = (v: 'timed' | 'tutored') => setPacerState({ pacerQBankMode: v });
  const setTriggerButton = (v: 'next' | 'submit' | 'both') => setPacerState({ pacerTriggerButton: v });
  const setIsAdaptive = (v: boolean) => setPacerState({ pacerIsAdaptive: v });
  const setIsActive = (v: boolean) => setPacerState({ pacerIsActive: v });
  const setSoundEnabled = (v: boolean) => setPacerState({ pacerSoundEnabled: v });

  // Adaptive Session Config State
  const [pacerMode, setPacerMode] = useState<'tradicional' | 'adaptativo' | 'sessoes'>('tradicional');
  const [adaptiveStudyMin, setAdaptiveStudyMin] = useState(50);
  const [adaptiveRestMin, setAdaptiveRestMin] = useState(10);
  const [adaptiveCycles, setAdaptiveCycles] = useState(4);
  const [showSoundModal, setShowSoundModal] = useState(false);

  const isTutoredMode = qbankMode === 'tutored';
  const isAdaptiveSession = isAdaptive || isAdaptiveMode || pacerMode === 'adaptativo' || pacerMode === 'sessoes';

  useEffect(() => {
    if (totalQuestions > 0 && targetTimeSeconds > 0) {
      const perQuestionTarget = isTutoredMode ? (targetTimeSeconds + (targetReviewSeconds || 150)) : targetTimeSeconds;
      const totalMinutes = Math.round((totalQuestions * perQuestionTarget) / 60);
      const restMinutes = Math.round(totalMinutes / 5);
      setAdaptiveStudyMin(totalMinutes || 1);
      setAdaptiveRestMin(restMinutes || 1);
    }
  }, [totalQuestions, targetTimeSeconds, targetReviewSeconds, isTutoredMode]);

  const audioContextRef = useRef<AudioContext | null>(null);

  // --- Metrics Computation ---
  const totalQuestionsDone = completedQuestionsTime.length;
  const remainingQuestions = Math.max(0, totalQuestions - totalQuestionsDone - 1);

  // Timed Mode Metrics
  const totalCompletedTimeTimed = completedQuestionsTime.reduce((a, b) => a + b, 0);
  const globalElapsedTimeTimed = totalCompletedTimeTimed + currentQuestionTime;
  const totalTargetTimeTimed = totalQuestions * targetTimeSeconds;
  const averagePaceTimed = totalQuestionsDone > 0 ? Math.round(totalCompletedTimeTimed / totalQuestionsDone) : 0;
  const questionsLeftIncludingCurrentTimed = Math.max(1, totalQuestions - totalQuestionsDone);
  
  // Atraso acumulado nas questões já concluídas (Timed)
  const expectedTimedForDone = totalQuestionsDone * targetTimeSeconds;
  const accumulatedTimedDiff = expectedTimedForDone - totalCompletedTimeTimed;
  const remainingBudgetTimed = totalTargetTimeTimed - totalCompletedTimeTimed;
  const requiredPaceTimed = questionsLeftIncludingCurrentTimed > 0 && remainingBudgetTimed > 0 
    ? Math.floor(remainingBudgetTimed / questionsLeftIncludingCurrentTimed) 
    : targetTimeSeconds;

  // Regra: No 1º alarme (1ª questão), toca no tempo estipulado.
  // Nos demais (a partir da 2ª questão), adapta se houver atraso acumulado; se adiantado, mantém o estipulado.
  const isTimedDelayed = totalQuestionsDone > 0 && accumulatedTimedDiff < 0 && requiredPaceTimed < targetTimeSeconds;
  const effectiveTargetTimed = isAdaptiveSession && isTimedDelayed && requiredPaceTimed > 0
    ? requiredPaceTimed 
    : targetTimeSeconds;
  const currentGlobalDiffTimed = ((totalQuestionsDone + 1) * targetTimeSeconds) - globalElapsedTimeTimed;
  const estimatedRemainingTimeTimed = (remainingQuestions * targetTimeSeconds) + Math.max(0, targetTimeSeconds - currentQuestionTime);

  // Tutored Mode Metrics (Resolução + Revisão com status individual e global unificado)
  const targetSolveSec = targetTimeSeconds;
  const targetReviewSec = targetReviewSeconds || 150;
  const targetPerQuestionTutored = targetSolveSec + targetReviewSec;
  const totalTargetTimeTutored = totalQuestions * targetPerQuestionTutored;

  const totalCompletedSolveTime = completedQuestionsTime.reduce((a, b) => a + b, 0);
  const totalCompletedReviewTime = (completedReviewTimes || []).reduce((a, b) => a + b, 0);
  const currentSolveTime = currentQuestionTime;
  const currentReviewTimeVal = currentReviewTime || 0;

  // 1. Resolução Individual (Solve):
  const questionsLeftSolve = Math.max(1, totalQuestions - totalQuestionsDone);
  const totalBudgetSolve = totalQuestions * targetSolveSec;
  
  // Atraso/adiantamento acumulado nas resoluções já concluídas
  const expectedSolveForDone = totalQuestionsDone * targetSolveSec;
  const accumulatedSolveDiff = expectedSolveForDone - totalCompletedSolveTime;
  const remainingSolveBudget = totalBudgetSolve - totalCompletedSolveTime;
  const requiredPaceSolve = questionsLeftSolve > 0 && remainingSolveBudget > 0
    ? Math.floor(remainingSolveBudget / questionsLeftSolve)
    : targetSolveSec;

  const elapsedSolveTotal = totalCompletedSolveTime + currentSolveTime;
  const expectedSolveSoFar = (totalQuestionsDone + 1) * targetSolveSec;
  const diffSolve = expectedSolveSoFar - elapsedSolveTotal;

  // Regra: No primeiro alarme (1ª questão), toca no tempo estipulado.
  // Nos demais (a partir da 2ª questão), adapta antecipadamente se houver atraso; se adiantado, permanece no estipulado.
  const isSolveDelayed = totalQuestionsDone > 0 && accumulatedSolveDiff < 0 && requiredPaceSolve < targetSolveSec;
  const effectiveTargetSolve = isAdaptiveSession && isSolveDelayed && requiredPaceSolve > 0
    ? requiredPaceSolve
    : targetSolveSec;

  // 2. Revisão Individual (Review):
  const totalReviewsDone = (completedReviewTimes || []).length;
  const reviewsLeft = Math.max(1, totalQuestions - totalReviewsDone);
  const totalBudgetReview = totalQuestions * targetReviewSec;

  // Atraso/adiantamento acumulado nas revisões já concluídas
  const expectedReviewForDone = totalReviewsDone * targetReviewSec;
  const accumulatedReviewDiff = expectedReviewForDone - totalCompletedReviewTime;
  const remainingReviewBudget = totalBudgetReview - totalCompletedReviewTime;
  const requiredPaceReview = reviewsLeft > 0 && remainingReviewBudget > 0
    ? Math.floor(remainingReviewBudget / reviewsLeft)
    : targetReviewSec;

  const elapsedReviewTotal = totalCompletedReviewTime + (tutoredPhase === 'review' ? currentReviewTimeVal : 0);
  const expectedReviewSoFar = (tutoredPhase === 'review' ? totalQuestionsDone + 1 : totalQuestionsDone) * targetReviewSec;
  const diffReview = expectedReviewSoFar - elapsedReviewTotal;

  // Regra: No primeiro alarme de revisão (1ª revisão), toca no tempo estipulado.
  // Nos demais, se houver atraso acumulado, adapta antecipadamente; se adiantado, permanece no estipulado.
  const isReviewDelayed = totalReviewsDone > 0 && accumulatedReviewDiff < 0 && requiredPaceReview < targetReviewSec;
  const effectiveTargetReview = isAdaptiveSession && isReviewDelayed && requiredPaceReview > 0
    ? requiredPaceReview
    : targetReviewSec;

  const globalElapsedTimeTutored = totalCompletedSolveTime + totalCompletedReviewTime + currentSolveTime + currentReviewTimeVal;
  
  // Status Global Unificado: meta esperada até o momento atual vs tempo global decorrido
  const expectedTargetSoFarTutored = (totalQuestionsDone * targetPerQuestionTutored) 
    + (tutoredPhase === 'solve' ? targetSolveSec : targetPerQuestionTutored);
  const currentGlobalDiffTutored = expectedTargetSoFarTutored - globalElapsedTimeTutored;

  const averageSolvePace = totalQuestionsDone > 0 ? Math.round(totalCompletedSolveTime / totalQuestionsDone) : 0;
  const reviewsWithTimeCount = (completedReviewTimes || []).filter(t => t > 0).length;
  const averageReviewPace = reviewsWithTimeCount > 0 ? Math.round(totalCompletedReviewTime / reviewsWithTimeCount) : 0;

  const remainingSolveTimeCurrentQ = tutoredPhase === 'solve' ? Math.max(0, targetSolveSec - currentSolveTime) : 0;
  const remainingReviewTimeCurrentQ = tutoredPhase === 'solve' 
    ? targetReviewSec 
    : Math.max(0, targetReviewSec - currentReviewTimeVal);
  const estimatedRemainingTimeTutored = (remainingQuestions * targetPerQuestionTutored) + remainingSolveTimeCurrentQ + remainingReviewTimeCurrentQ;

  // Active metrics depending on mode
  const globalElapsedTime = isTutoredMode ? globalElapsedTimeTutored : globalElapsedTimeTimed;
  const totalTargetTime = isTutoredMode ? totalTargetTimeTutored : totalTargetTimeTimed;
  const currentGlobalDiff = isTutoredMode ? currentGlobalDiffTutored : currentGlobalDiffTimed;
  const estimatedRemainingTime = isTutoredMode ? estimatedRemainingTimeTutored : estimatedRemainingTimeTimed;
  const averagePace = isTutoredMode ? averageSolvePace : averagePaceTimed;
  const requiredPace = isTutoredMode 
    ? (tutoredPhase === 'solve' ? requiredPaceSolve : requiredPaceReview) 
    : requiredPaceTimed;
  const effectiveTarget = isTutoredMode 
    ? (tutoredPhase === 'solve' ? effectiveTargetSolve : effectiveTargetReview) 
    : effectiveTargetTimed;
  const questionsLeftIncludingCurrent = totalQuestions - totalQuestionsDone;

  // Estimate remaining time for "Sessões" mode
  const futureCycles = Math.max(0, adaptiveCyclesTotal - adaptiveCurrentCycle);
  const timeForFutureCyclesQs = futureCycles * (totalQuestions * targetTimeSeconds);
  
  const baseRemainingStudyTime = Math.max(0, adaptiveStudyTimeTotal - adaptiveStudyTimeElapsed);
  const baseRemainingRestTime = Math.max(0, adaptiveRestTimeTotal - adaptiveRestTimeElapsed);
  
  let remainingStudyTime = baseRemainingStudyTime;
  let remainingRestTime = baseRemainingRestTime;

  if (isActive && isAdaptiveMode) {
    remainingStudyTime = estimatedRemainingTime + timeForFutureCyclesQs;
  } else if (isActive && !isAdaptiveMode) {
    remainingStudyTime = estimatedRemainingTime;
    remainingRestTime = 0;
  }

  const totalEstimatedRemainingSessao = remainingStudyTime + remainingRestTime;
  
  // Total ETA for config screen
  const totalEstimatedSessaoConfig = (adaptiveStudyMin + adaptiveRestMin) * adaptiveCycles * 60;

  // Clock time estimations
  const estimatedFinishTimeConfig = new Date(Date.now() + totalEstimatedSessaoConfig * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const estimatedFinishTimeActive = new Date(Date.now() + totalEstimatedRemainingSessao * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const estimatedFinishTimeCurrentBlock = new Date(Date.now() + estimatedRemainingTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const playBeep = (freq: number = 880, duration: number = 0.2, soundKey?: 'solveAlarm' | 'reviewAlarm' | 'cycleAlarm' | 'nextQuestion' | 'submitQuestion' | 'prevQuestion') => {
    const settings = pacerSoundSettings || {
      master: soundEnabled,
      solveAlarm: true,
      reviewAlarm: true,
      cycleAlarm: true,
      nextQuestion: true,
      submitQuestion: true,
      prevQuestion: true,
      keepAliveAudio: true,
      volume: 0.5,
    };
    if (!settings.master) return;
    if (soundKey && !settings[soundKey]) return;

    const vol = settings.volume ?? 0.5;
    if (soundKey === 'nextQuestion') {
      audioManager.playActionBeep('next', vol);
    } else if (soundKey === 'submitQuestion') {
      audioManager.playActionBeep('submit', vol);
    } else if (soundKey === 'prevQuestion') {
      audioManager.playActionBeep('prev', vol);
    } else if (soundKey === 'solveAlarm') {
      audioManager.playSolveAlarm(vol);
    } else if (soundKey === 'reviewAlarm') {
      audioManager.playReviewAlarm(vol);
    } else if (soundKey === 'cycleAlarm') {
      audioManager.playCycleAlarm(vol);
    } else {
      audioManager.playTone(freq, duration, vol);
    }
  };

  const handleStart = () => {
    audioManager.init();
    const settings = pacerSoundSettings || { master: true, keepAliveAudio: true };
    if (settings.master && settings.keepAliveAudio !== false) {
      audioManager.startKeepAlive();
    }
    // Garante que uma nova sessão inicie limpa na questão 1
    setPacerState({
      pacerCurrentQuestionTime: 0,
      pacerCurrentReviewTime: 0,
      pacerCompletedQuestionsTime: [],
      pacerCompletedReviewTimes: [],
      pacerTutoredPhase: 'solve',
      pacerIsActive: true
    });
    setIsActive(true);
    setTimerState('running');
    
    if (pacerMode === 'sessoes') {
       useTimerStore.getState().startAdaptiveSession(adaptiveStudyMin, adaptiveRestMin, adaptiveCycles);
    }
  };

  const handleSubmitReview = () => {
    if (phase === 'rest' || !isActive) return;
    submitPacerQuestion();
    playBeep(660, 0.25, 'submitQuestion');
  };

  const handleNext = () => {
    if (totalQuestionsDone + 1 >= totalQuestions) {
      if (isAdaptiveMode) {
         stashPacerSession();
         transitionPhase();
         setShowQuickLog(true, totalQuestions);
      } else {
         nextPacerQuestion();
         finishPacerSession();
         transitionPhase();
         setShowQuickLog(true, totalQuestions);
      }
    } else {
      nextPacerQuestion();
      playBeep(880, 0.2, 'nextQuestion');
    }
  };

  const handlePrev = () => {
    if (isTutoredMode && tutoredPhase === 'review') {
      prevPacerQuestion();
      playBeep(520, 0.15, 'prevQuestion');
    } else if (totalQuestionsDone > 0) {
      prevPacerQuestion();
      playBeep(520, 0.15, 'prevQuestion');
    }
  };

  const handleStop = () => {
    // Encerra definitivamente a sessão do pacer e reseta o estado
    stopPacer();
  };

  const togglePause = () => {
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
    if (timerState === 'running' || timerState === 'waiting_transition') {
      setTimerState('paused');
    } else {
      setTimerState(timeLeft <= 0 ? 'waiting_transition' : 'running');
    }
  };

  const handleResetAccumulatedTime = () => {
    resetPacerAccumulatedTime();
    playBeep(880, 0.3, 'solveAlarm');
  };

  const handleNextRef = useRef(handleNext);
  handleNextRef.current = handleNext;

  const handlePrevRef = useRef(handlePrev);
  handlePrevRef.current = handlePrev;

  const handleSubmitRef = useRef(handleSubmitReview);
  handleSubmitRef.current = handleSubmitReview;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      let shouldNext = false;
      let shouldSubmit = false;
      let shouldPrev = false;

      if (event.data?.type === 'PACER_NEXT') {
         shouldNext = true;
      } else if (event.data?.type === 'PACER_PREV') {
         shouldPrev = true;
      } else if (event.data?.type === 'PACER_SUBMIT') {
         shouldSubmit = true;
      } else if (event.data?.type === 'PACER_BTN_CLICK') {
         const { isNext, isSubmit, isPrev } = event.data;
         
         if (qbankMode === 'tutored') {
            if (isSubmit) shouldSubmit = true;
            if (isNext) shouldNext = true;
            if (isPrev) shouldPrev = true;
         } else {
            const trigger = triggerButton || 'next';
            if (trigger === 'next' && isNext) shouldNext = true;
            if (trigger === 'submit' && isSubmit) shouldNext = true;
            if (trigger === 'both' && (isNext || isSubmit)) shouldNext = true;
            if (isPrev) shouldPrev = true;
         }
      } else if (event.data?.type === 'PACER_PAUSE_TOGGLE') {
         setTimerState(timerState === 'running' ? 'paused' : 'running');
      }

      if (phase !== 'rest' && isActive) {
        if (qbankMode === 'tutored') {
          if (shouldSubmit) {
            if (tutoredPhase === 'solve') {
              handleSubmitRef.current();
            }
          } else if (shouldNext) {
            handleNextRef.current();
          } else if (shouldPrev) {
            handlePrevRef.current();
          }
        } else {
          if (shouldNext) handleNextRef.current();
          if (shouldPrev) handlePrevRef.current();
        }
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pacer_action' && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue);
          handleMessage({ data: payload } as MessageEvent);
        } catch {}
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };
  }, [phase, isActive, timerState, qbankMode, triggerButton, tutoredPhase]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(Math.abs(seconds) / 60);
    const s = Math.abs(seconds) % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col w-full ${className || 'mt-8'}`}>
      <div className="bg-blue-600 dark:bg-blue-500 px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Pacer de Questões
        </h2>
        <div className="flex items-center gap-2">
          {isActive && (
            <button
              onClick={togglePause}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                timerState === 'running'
                  ? 'bg-white/20 text-white hover:bg-white/30'
                  : 'bg-amber-400 text-gray-900 hover:bg-amber-300 font-extrabold ring-2 ring-white/50'
              }`}
              title={timerState === 'running' ? 'Pausar Pacer e Cronômetro (não conta tempo)' : 'Retomar Pacer e Cronômetro'}
            >
              {timerState === 'running' ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Retomar</span>
                </>
              )}
            </button>
          )}
          <button 
            onClick={() => togglePacerSoundSetting('master')}
            className="text-white/80 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
            title={pacerSoundSettings.master ? "Silenciar Todos os Sons" : "Ativar Sons"}
          >
            {pacerSoundSettings.master ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setShowSoundModal(true)}
            className="text-white/80 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
            title="Configurar sons e alertas individuais"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-6">
        {!isActive ? (
          <div className="flex flex-col gap-6 py-4">
            <div className="text-gray-500 dark:text-gray-400 text-sm text-center">
              Configure sua sessão de questões. O pacer ajudará a manter seu ritmo.
            </div>
            
            {/* Total de Questões */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total de Questões da Lista</label>
              <input 
                type="number" 
                value={totalQuestions}
                onChange={(e) => setTotalQuestions(Math.max(1, parseInt(e.target.value) || 1))}
                className="px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* SELETOR DE MODO DO Q-BANK: TIMED vs TUTORED */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-blue-600" />
                Modo de Resolução do Q-Bank
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setQbankMode('timed')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    qbankMode === 'timed'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/30'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold ${qbankMode === 'timed' ? 'text-blue-900 dark:text-blue-200' : 'text-gray-900 dark:text-gray-100'}`}>
                      Modo Timed (Simulado / Prova)
                    </span>
                    {qbankMode === 'timed' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                    Resolução contínua sem ver gabarito imediato. Um único tempo alvo por questão.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setQbankMode('tutored')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    qbankMode === 'tutored'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/30'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold ${qbankMode === 'tutored' ? 'text-indigo-900 dark:text-indigo-200' : 'text-gray-900 dark:text-gray-100'}`}>
                      Modo Tutored (Resolução + Revisão)
                    </span>
                    {qbankMode === 'tutored' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                    Gabarito exibido após cada questão. Tempos e paces separados para resolução e leitura da explicação.
                  </p>
                </button>
              </div>
            </div>

            {/* CONFIGURAÇÃO DE TEMPOS DE ACORDO COM O MODO */}
            {isTutoredMode ? (
              <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      Tempo Alvo de Resolução (seg/q)
                    </label>
                    <input 
                      type="number" 
                      value={targetTimeSeconds}
                      onChange={(e) => setTargetTimeSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                      placeholder="90"
                      className="px-3.5 py-2 border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 rounded-lg font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-[11px] text-gray-500">Ex: 90s = 1m 30s para resolver</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                      Tempo Alvo de Revisão (seg/q)
                    </label>
                    <input 
                      type="number" 
                      value={targetReviewSeconds}
                      onChange={(e) => setTargetReviewSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                      placeholder="150"
                      className="px-3.5 py-2 border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 rounded-lg font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-[11px] text-gray-500">Ex: 150s = 2m 30s para ler gabarito</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-indigo-100 dark:border-indigo-900/40 text-xs">
                  <span className="text-indigo-950 dark:text-indigo-200">
                    Tempo Alvo Total por Questão: <b>{formatTime(targetPerQuestionTutored)}</b> ({targetSolveSec}s resolução + {targetReviewSec}s revisão)
                  </span>
                  <span className="font-bold text-indigo-700 dark:text-indigo-300">
                    Tempo Total Estimado: {formatTime(totalTargetTimeTutored)}
                  </span>
                </div>

                <div className="p-3 bg-white/80 dark:bg-gray-900/80 rounded-lg border border-indigo-100 dark:border-indigo-900/40 text-xs text-gray-600 dark:text-gray-300 flex flex-col gap-1.5">
                  <div className="font-bold text-gray-800 dark:text-gray-200">Como funciona a integração no Modo Tutored:</div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-600 dark:text-blue-400">1. Botão "Submit":</span>
                    <span>Congela o tempo gasto na resolução e inicia automaticamente a contagem da <b>Revisão da Explicação</b>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">2. Botão "Next":</span>
                    <span>Salva o tempo de revisão e avança para a <b>Resolução</b> da próxima questão.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-gray-500">3. Navegar sem responder:</span>
                    <span>Clicar em "Next" na fase de resolução avança diretamente para a próxima questão marcando 0s de revisão.</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tempo Alvo por Questão (segundos/q)</label>
                  <input 
                    type="number" 
                    value={targetTimeSeconds}
                    onChange={(e) => setTargetTimeSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                    className="px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Tempo Total de Prova:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{formatTime(totalTargetTimeTimed)}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 p-3.5 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/40">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider">Qual botão avançará o pacer?</span>
                  <div className="flex flex-wrap gap-4 pt-1">
                    <label className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200 cursor-pointer">
                      <input type="radio" name="triggerButton" className="cursor-pointer" checked={triggerButton === 'next'} onChange={() => setTriggerButton('next')} />
                      Botão "Next"
                    </label>
                    <label className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200 cursor-pointer">
                      <input type="radio" name="triggerButton" className="cursor-pointer" checked={triggerButton === 'submit'} onChange={() => setTriggerButton('submit')} />
                      Botão "Submit"
                    </label>
                    <label className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200 cursor-pointer">
                      <input type="radio" name="triggerButton" className="cursor-pointer" checked={triggerButton === 'both'} onChange={() => setTriggerButton('both')} />
                      Ambos
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* CARD DE INTEGRAÇÃO EXTERNA */}
            <div className="flex flex-col gap-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
               <div className="flex items-start gap-2.5">
                 <Chrome className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5" />
                 <div className="flex-1">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Integração com o Q-Bank (UWorld, Amboss, Qbankly)</h4>
                   <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                     Instale a extensão do navegador para que os cliques nos botões do site sincronizem automaticamente com o Pacer!
                   </p>
                   
                   <div className="mt-3 flex flex-wrap items-center gap-2">
                     <Link
                       to="/extensao"
                       className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow transition-colors"
                       title="Baixar extensão para sincronização automática"
                     >
                       <Chrome className="w-3.5 h-3.5" />
                       Baixar Extensão Chrome (100% Automática)
                     </Link>
                   </div>
                 </div>
               </div>
            </div>

            {/* MODO DE SESSÃO */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                Modo de Sessão
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => { setPacerMode('tradicional'); setIsAdaptive(false); }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${pacerMode === 'tradicional' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 ring-1 ring-blue-500' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600'}`}
                >
                  <div className={`text-sm font-bold ${pacerMode === 'tradicional' ? 'text-blue-900 dark:text-blue-200' : 'text-gray-900 dark:text-gray-100'}`}>Pacer Tradicional</div>
                  <div className={`text-[10px] mt-1 ${pacerMode === 'tradicional' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                    Alarme soa no tempo alvo ({isTutoredMode ? `${targetSolveSec}s / ${targetReviewSec}s` : `${targetTimeSeconds}s`}).
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setPacerMode('adaptativo'); setIsAdaptive(true); }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${pacerMode === 'adaptativo' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 ring-1 ring-blue-500' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600'}`}
                >
                  <div className={`text-sm font-bold ${pacerMode === 'adaptativo' ? 'text-blue-900 dark:text-blue-200' : 'text-gray-900 dark:text-gray-100'}`}>Pacer Adaptativo</div>
                  <div className={`text-[10px] mt-1 ${pacerMode === 'adaptativo' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                    {isTutoredMode ? 'Recalcula o pace alvo de resolução e de revisão individualmente. Se atrasar, emite alarme antecipado.' : 'Encurta o tempo do alarme automaticamente se você atrasar.'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setPacerMode('sessoes'); setIsAdaptive(true); }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${pacerMode === 'sessoes' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 ring-1 ring-blue-500' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600'}`}
                >
                  <div className={`text-sm font-bold ${pacerMode === 'sessoes' ? 'text-blue-900 dark:text-blue-200' : 'text-gray-900 dark:text-gray-100'}`}>Sessões Adaptativas</div>
                  <div className={`text-[10px] mt-1 ${pacerMode === 'sessoes' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                    {isTutoredMode ? 'Pomodoro com recálculo adaptativo individual de resolução e revisão em cada questão.' : 'Ciclos Pomodoro dinâmicos que ajustam tempos automaticamente.'}
                  </div>
                </button>
              </div>
              
              {pacerMode === 'sessoes' && (
                <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Configuração de Ciclos (Pomodoro)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Tempo de Estudo (min)</label>
                      <input 
                        type="number" 
                        value={adaptiveStudyMin}
                        onChange={(e) => setAdaptiveStudyMin(Math.max(1, parseInt(e.target.value) || 1))}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Tempo de Descanso (min)</label>
                      <input 
                        type="number" 
                        value={adaptiveRestMin}
                        onChange={(e) => setAdaptiveRestMin(Math.max(1, parseInt(e.target.value) || 1))}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Quantidade de Ciclos</label>
                      <input 
                        type="number" 
                        value={adaptiveCycles}
                        onChange={(e) => setAdaptiveCycles(Math.max(1, parseInt(e.target.value) || 1))}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Duração / Término Estimado:</span>
                    <div className="text-right flex items-center gap-2">
                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{formatTime(totalEstimatedSessaoConfig)}</span>
                      <span className="text-xs text-gray-500 font-medium">~ {estimatedFinishTimeConfig}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={handleStart}
              className="mt-2 w-full py-3.5 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer text-base active:scale-[0.99]"
            >
              <Play className="w-5 h-5 fill-current" />
              Iniciar Sessão ({isTutoredMode ? 'Modo Tutored' : 'Modo Timed'})
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            
            {/* SEÇÃO 1: CICLOS (Timer Global) */}
            {isAdaptiveMode && (
              <div className="flex flex-col gap-4 mb-8">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Sessão (Ciclos de {Math.round((adaptiveStudyTimeTotal / Math.max(1, adaptiveCyclesTotal)) / 60)}m / {Math.round((adaptiveRestTimeTotal / Math.max(1, adaptiveCyclesTotal)) / 60)}m)
                </h3>
                
                <div className={`rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${phase === 'study' ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'bg-emerald-50/50 dark:bg-emerald-900/20'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm ${phase === 'study' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'}`}>
                      {phase === 'study' ? <BookOpen className="w-7 h-7" /> : <Coffee className="w-7 h-7" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 mb-1">
                        <Activity className="w-3.5 h-3.5" /> Ciclo {adaptiveCurrentCycle} de {adaptiveCyclesTotal}
                      </div>
                      <div className={`text-4xl font-black tabular-nums tracking-tighter ${timeLeft <= 0 ? 'text-red-600 dark:text-red-400 animate-pulse' : phase === 'study' ? 'text-blue-700 dark:text-blue-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                        {formatTime(timeLeft)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-3 text-right w-full sm:w-auto mt-2 sm:mt-0">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        Tempo Restante: {formatTime(totalEstimatedRemainingSessao)} <span className="text-[10px] text-gray-500 font-medium ml-1">~ {estimatedFinishTimeActive}</span>
                      </span>
                      <span className="text-[10px] font-medium text-gray-400 mt-1">
                        Descanso Total Restante: {formatTime(Math.max(0, adaptiveRestTimeTotal - adaptiveRestTimeElapsed))}
                      </span>
                    </div>
                    
                    {timeLeft <= 0 && timerState !== 'idle' ? (
                      <div className="flex flex-col gap-2 w-full mt-2">
                        <div className="flex items-center justify-end gap-1 mb-1">
                          <button onClick={() => { setTimeLeft(timeLeft + 60); setTimerState('running'); }} className="px-2 py-1 text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700">+1m</button>
                          <button onClick={() => { setTimeLeft(timeLeft + 300); setTimerState('running'); }} className="px-2 py-1 text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700">+5m</button>
                          <button onClick={() => { setTimeLeft(timeLeft + 600); setTimerState('running'); }} className="px-2 py-1 text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700">+10m</button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 justify-end">
                          {phase === 'study' ? (
                            <>
                              <button onClick={() => transitionPhase()} className="px-3 py-2 text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 rounded-xl transition-colors">
                                Iniciar descanso
                              </button>
                              <button onClick={() => { transitionPhase(); setTimeout(transitionPhase, 10); }} className="px-3 py-2 text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-xl transition-colors">
                                Próximo momento
                              </button>
                            </>
                          ) : (
                            <button onClick={() => transitionPhase()} className="px-3 py-2 text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-xl transition-colors">
                              {useTimerStore.getState().isUnscheduledRest ? 'Retornar ao estudo' : 'Iniciar novo ciclo'}
                            </button>
                          )}
                          <button onClick={() => setTimerState(timerState === 'running' || timerState === 'waiting_transition' ? 'paused' : 'running')} className="px-3 py-2 text-xs font-bold bg-gray-900 dark:bg-gray-50 text-white dark:text-gray-900 hover:bg-black dark:hover:bg-white rounded-xl transition-colors">
                            {timerState === 'running' || timerState === 'waiting_transition' ? 'Pausar Timer' : 'Retomar Timer'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 w-full justify-end">
                        {phase === 'study' ? (
                          <button 
                            onClick={() => {
                              if (isAdaptiveMode) takeUnscheduledRest();
                              else {
                                setPhase('rest');
                                setTimeLeft(restDuration);
                                setTimerState('running');
                              }
                            }}
                            className="px-3 py-2 text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded-xl transition-colors flex items-center gap-1.5"
                            title="Fazer uma pausa não programada"
                          >
                            <Coffee className="w-3.5 h-3.5" /> Pausa Extra
                          </button>
                        ) : (
                          <button 
                            onClick={() => transitionPhase()}
                            className="px-3 py-2 text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 rounded-xl transition-colors flex items-center gap-1.5"
                            title="Voltar antecipadamente aos estudos"
                          >
                            <FastForward className="w-3.5 h-3.5" /> Voltar ao Estudo
                          </button>
                        )}
                        
                        <button
                          onClick={() => setTimerState(timerState === 'running' ? 'paused' : 'running')}
                          className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-colors ${timerState === 'running' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200' : 'bg-gray-900 dark:bg-gray-50 text-white dark:text-gray-900 hover:bg-black dark:hover:bg-white'}`}
                        >
                          {timerState === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {timerState === 'running' ? 'Pausar Timer' : 'Retomar Timer'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

              {/* SEÇÃO 2: PACER (Andamento das Questões) */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  Andamento do Pacer {isTutoredMode && <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold">Modo Tutored</span>}
                </div>
                <div className="text-xs font-bold text-gray-500">
                  Questão {totalQuestionsDone + 1} de {totalQuestions}
                </div>
              </h3>

              {/* BANNER DE FASE (MODO TUTORED) */}
              {isTutoredMode && (
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                  tutoredPhase === 'solve'
                    ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60'
                    : 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/60'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                      tutoredPhase === 'solve'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-purple-600 text-white shadow-sm'
                    }`}>
                      {tutoredPhase === 'solve' ? <Activity className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-extrabold uppercase tracking-wide ${
                          tutoredPhase === 'solve' ? 'text-blue-900 dark:text-blue-200' : 'text-purple-900 dark:text-purple-200'
                        }`}>
                          {tutoredPhase === 'solve' ? 'Fase 1: Resolução da Questão' : 'Fase 2: Revisão da Explicação'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                          {tutoredPhase === 'solve' ? `Alvo: ${formatTime(targetSolveSec)}` : `Alvo: ${formatTime(targetReviewSec)}`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {tutoredPhase === 'solve'
                          ? 'Resolva no Q-Bank. Ao clicar em Submit, a contagem de revisão iniciará automaticamente.'
                          : 'Lendo gabarito e comentários no Q-Bank. Ao clicar em Next, avançará para a próxima questão.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {tutoredPhase === 'solve' ? (
                      <button
                        onClick={handleSubmitReview}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                        title="Simular clique de Submit no Q-Bank para iniciar revisão"
                      >
                        <Check className="w-4 h-4" />
                        Submit & Iniciar Revisão
                      </button>
                    ) : (
                      <button
                        onClick={handleNext}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                        title="Simular clique de Next no Q-Bank para concluir questão"
                      >
                        <FastForward className="w-4 h-4" />
                        Next (Próxima Questão)
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* CARDS DE TEMPO DO PACER */}
              {isTutoredMode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch mb-2">
                  {/* CARD 1: TEMPO DE RESOLUÇÃO */}
                  <div className={`flex flex-col p-6 rounded-2xl border transition-all ${
                    tutoredPhase === 'solve'
                      ? isAdaptiveSession && effectiveTargetSolve < targetSolveSec
                        ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-400 dark:border-amber-600 ring-2 ring-amber-500/20 shadow-sm'
                        : 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                      : 'bg-gray-50/50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700 opacity-90'
                  }`}>
                    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" /> Tempo de Resolução
                      </span>
                      {tutoredPhase === 'review' ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Concluída
                        </span>
                      ) : isAdaptiveSession && effectiveTargetSolve < targetSolveSec ? (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 flex items-center gap-1 shadow-xs animate-pulse">
                          <Zap className="w-3 h-3" /> Alarme Antecipado ({formatTime(effectiveTargetSolve)})
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          Em Resolução
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-center justify-center my-3">
                      <div className={`text-6xl font-black tracking-tight ${
                        tutoredPhase === 'solve' && currentSolveTime >= effectiveTargetSolve && timerState === 'running'
                          ? 'text-red-500 animate-pulse'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {formatTime(currentSolveTime)}
                      </div>
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-2 text-center">
                        {isAdaptiveSession && effectiveTargetSolve < targetSolveSec ? (
                          <span>
                            Alarme antecipado em: <b className="text-amber-600 dark:text-amber-400">{formatTime(effectiveTargetSolve)}</b> <span className="text-[11px] opacity-75">(Base: {formatTime(targetSolveSec)})</span>
                          </span>
                        ) : (
                          <span>
                            Alvo da Questão Atual: <b>{formatTime(targetSolveSec)}</b>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Destaque: Tempo Gasto com Resolução Naquele Momento de Estudo */}
                    <div className="w-full my-2 p-3 bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 rounded-xl flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-blue-600 text-white shadow-xs">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                            Tempo em Resolução
                          </div>
                          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                            Gasto neste momento de estudo
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xl font-black text-blue-900 dark:text-blue-100">
                          {formatTime(elapsedSolveTotal)}
                        </div>
                        {studyDuration > 0 && (
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                            {formatTime(Math.max(0, studyDuration - timeLeft))} de estudo decorrido
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto pt-3 border-t border-gray-200 dark:border-gray-700/60 flex flex-col gap-1.5 text-xs text-gray-500">
                      <div className="flex items-center justify-between py-1 px-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40">
                        <span className="font-semibold text-blue-900 dark:text-blue-200">Tempo Gasto em Resolução (Sessão):</span>
                        <b className="text-blue-700 dark:text-blue-300 font-mono font-bold text-sm">{formatTime(elapsedSolveTotal)}</b>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Pace Médio de Resolução:</span>
                        <b className="text-gray-900 dark:text-gray-100 font-mono">{totalQuestionsDone > 0 ? formatTime(averageSolvePace) : '--:--'}</b>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Status de Resolução:</span>
                        <b className={diffSolve < 0 ? "text-rose-600 dark:text-rose-400 font-mono" : "text-emerald-600 dark:text-emerald-400 font-mono"}>
                          {diffSolve < 0 ? `Atrasado em ${formatTime(Math.abs(diffSolve))}` : `Adiantado em ${formatTime(diffSolve)}`}
                        </b>
                      </div>
                      {isAdaptiveSession && (
                        <div className="flex items-center justify-between pt-1 border-t border-dashed border-gray-200 dark:border-gray-700">
                          <span>Pace Alvo p/ Terminar:</span>
                          <b className="text-blue-600 dark:text-blue-400 font-mono">{formatTime(requiredPaceSolve)}</b>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CARD 2: TEMPO DE REVISÃO */}
                  <div className={`flex flex-col p-6 rounded-2xl border transition-all ${
                    tutoredPhase === 'review'
                      ? isAdaptiveSession && effectiveTargetReview < targetReviewSec
                        ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-400 dark:border-amber-600 ring-2 ring-amber-500/20 shadow-sm'
                        : 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-400 dark:border-purple-600 ring-2 ring-purple-500/20 shadow-sm'
                      : 'bg-gray-50/50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700 opacity-90'
                  }`}>
                    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" /> Tempo de Revisão
                      </span>
                      {tutoredPhase === 'review' ? (
                        isAdaptiveSession && effectiveTargetReview < targetReviewSec ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 flex items-center gap-1 shadow-xs animate-pulse">
                            <Zap className="w-3 h-3" /> Alarme Antecipado ({formatTime(effectiveTargetReview)})
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 animate-pulse">
                            Revisando Gabarito
                          </span>
                        )
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                          Aguardando Submit...
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-center justify-center my-4">
                      <div className={`text-6xl font-black tracking-tight ${
                        tutoredPhase === 'review' && currentReviewTimeVal >= effectiveTargetReview && timerState === 'running'
                          ? 'text-red-500 animate-pulse'
                          : tutoredPhase === 'solve'
                            ? 'text-gray-400 dark:text-gray-600'
                            : 'text-purple-900 dark:text-purple-100'
                      }`}>
                        {tutoredPhase === 'solve' ? '--:--' : formatTime(currentReviewTimeVal)}
                      </div>
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-2 text-center">
                        {isAdaptiveSession && effectiveTargetReview < targetReviewSec ? (
                          <span>
                            Alarme antecipado em: <b className="text-amber-600 dark:text-amber-400">{formatTime(effectiveTargetReview)}</b> <span className="text-[11px] opacity-75">(Base: {formatTime(targetReviewSec)})</span>
                          </span>
                        ) : (
                          <span>
                            Alvo de Revisão: <b>{formatTime(targetReviewSec)}</b>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto pt-3 border-t border-gray-200 dark:border-gray-700/60 flex flex-col gap-1.5 text-xs text-gray-500">
                      <div className="flex items-center justify-between py-1 px-2.5 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40">
                        <span className="font-semibold text-purple-900 dark:text-purple-200">Tempo Total em Revisão:</span>
                        <b className="text-purple-700 dark:text-purple-300 font-mono font-bold text-sm">{formatTime(elapsedReviewTotal)}</b>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Pace Médio de Revisão:</span>
                        <b className="text-gray-900 dark:text-gray-100 font-mono">{reviewsWithTimeCount > 0 ? formatTime(averageReviewPace) : '--:--'}</b>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Status de Revisão:</span>
                        <b className={diffReview < 0 ? "text-rose-600 dark:text-rose-400 font-mono" : "text-emerald-600 dark:text-emerald-400 font-mono"}>
                          {diffReview < 0 ? `Atrasado em ${formatTime(Math.abs(diffReview))}` : `Adiantado em ${formatTime(diffReview)}`}
                        </b>
                      </div>
                      {isAdaptiveSession && (
                        <div className="flex items-center justify-between pt-1 border-t border-dashed border-gray-200 dark:border-gray-700">
                          <span>Pace Alvo p/ Terminar:</span>
                          <b className="text-purple-600 dark:text-purple-400 font-mono">{formatTime(requiredPaceReview)}</b>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* CARDS TIMED MODE TRADICIONAL */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch mb-4">
                  {/* Tempo Atual Pacer */}
                  <div className="flex flex-col items-center justify-center text-center py-8 px-4 relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
                    {timerState === 'paused' || timerState === 'idle' ? (
                      <div className="absolute top-0 inset-x-0 flex justify-center">
                         <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[10px] font-bold uppercase px-3 py-1 rounded-b-lg shadow-sm flex items-center gap-1">
                           <Pause className="w-3 h-3 fill-current" /> Pausado
                         </span>
                      </div>
                    ) : isAdaptive && effectiveTarget < targetTimeSeconds && (
                      <div className="absolute top-0 inset-x-0 flex justify-center">
                         <span className="bg-amber-100 text-amber-700 text-[10px] font-bold uppercase px-3 py-1 rounded-b-lg shadow-sm">Alarme Antecipado Ativo</span>
                      </div>
                    )}
                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Questão Atual
                    </div>
                    <div className={`text-6xl font-black tracking-tight ${currentQuestionTime >= effectiveTarget && phase === 'study' && (timerState === 'running' || timerState === 'waiting_transition') ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>
                      {formatTime(currentQuestionTime)}
                    </div>
                    <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-4">
                      Alarme em {formatTime(effectiveTarget)}
                    </div>
                  </div>

                  {/* Estatísticas em caixas */}
                  <div className="flex flex-col gap-4 col-span-1 md:col-span-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 h-full">
                      <div className="flex flex-col justify-center p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/30">
                        <div className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Timer className="w-3.5 h-3.5" /> Tempo de Resolução
                        </div>
                        <div className="text-2xl font-black text-blue-900 dark:text-blue-100 mt-1 mb-1 font-mono">{formatTime(elapsedSolveTotal)}</div>
                        <div className="text-[11px] font-semibold text-blue-600/90 dark:text-blue-400/90">Gasto neste momento de estudo</div>
                      </div>

                      <div className="flex flex-col justify-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Pace Médio
                        </div>
                        <div className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1 mb-1 font-mono">{totalQuestionsDone > 0 ? formatTime(averagePace) : '--:--'}</div>
                        <div className="text-[11px] font-medium text-gray-500">Por questão</div>
                      </div>

                      <div className="flex flex-col justify-center p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/20">
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <TrendingDown className="w-3.5 h-3.5" /> Pace Alvo
                        </div>
                        <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-1 mb-1 font-mono">{formatTime(requiredPace)}</div>
                        <div className="text-[11px] font-medium text-indigo-600/70 dark:text-indigo-400/70">{questionsLeftIncludingCurrent} restantes</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CARD DE STATUS GLOBAL UNIFICADO (RESOLUÇÃO + REVISÃO) */}
              <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                currentGlobalDiff >= 0 
                  ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-900/20' 
                  : 'border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-900/20'
              }`}>
                <div className="flex flex-col items-start">
                  <div className={`text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 ${
                    currentGlobalDiff >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                  }`}>
                    <TrendingUp className="w-3.5 h-3.5" /> Status Global {isTutoredMode && '(Resolução + Revisão)'}
                  </div>
                  <div className={`text-2xl font-black ${
                    currentGlobalDiff >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                  }`}>
                    {currentGlobalDiff >= 0 ? 'Adiantado em ' : 'Atrasado em '}
                    {formatTime(Math.abs(currentGlobalDiff))}
                  </div>
                  
                  <button
                    onClick={handleResetAccumulatedTime}
                    className="mt-2.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 transition-all shadow-xs cursor-pointer active:scale-95"
                    title="Zerar o atraso/adianto acumulado e retornar o status global para o valor de 1 questão"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Zerar Tempo Acumulado
                  </button>
                </div>
                
                <div className="flex flex-col gap-2 text-left sm:text-right">
                   <div>
                     <div className="text-[10px] font-bold text-gray-500 uppercase">Tempo de Prova Total</div>
                     <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatTime(globalElapsedTime)} / {formatTime(totalTargetTime)}</div>
                   </div>
                   <div>
                     <div className="text-[10px] font-bold text-gray-500 uppercase">Tempo Restante Estimado</div>
                     <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        {formatTime(estimatedRemainingTime)} <span className="text-gray-500">(Fim: {estimatedFinishTimeCurrentBlock})</span>
                     </div>
                   </div>
                </div>
              </div>

              {/* CONTROLES DO PACER */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={handleStop}
                  className="px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors border border-red-200 dark:border-red-900/40 cursor-pointer"
                  title="Encerrar definitivamente a sessão e retornar ao início"
                >
                  <Square className="w-4 h-4 text-red-600 fill-current" />
                  Encerrar Pacer
                </button>
                
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handlePrev}
                    disabled={phase === 'rest' || (totalQuestionsDone === 0 && (!isTutoredMode || tutoredPhase === 'solve'))}
                    className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                      phase === 'rest' || (totalQuestionsDone === 0 && (!isTutoredMode || tutoredPhase === 'solve'))
                        ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {isTutoredMode && tutoredPhase === 'review' ? 'Voltar à Resolução' : 'Anterior'}
                  </button>
                  
                  <button
                    onClick={togglePause}
                    className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
                      timerState === 'running'
                        ? 'bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold border border-emerald-700 ring-2 ring-emerald-500/30 animate-pulse'
                    }`}
                    title={timerState === 'running' ? 'Pausar Pacer (não conta tempo)' : 'Retomar Pacer e Cronômetro'}
                  >
                    {timerState === 'running' ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        <span>Pausar</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Retomar</span>
                      </>
                    )}
                  </button>

                  {/* BOTÕES DE AÇÃO ESPECÍFICOS DO MODO */}
                  {isTutoredMode ? (
                    tutoredPhase === 'solve' ? (
                      <>
                        <button
                          onClick={handleNext}
                          disabled={phase === 'rest'}
                          className="px-3.5 py-2.5 rounded-xl font-medium text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
                          title="Avançar diretamente para a próxima questão sem marcar tempo de revisão (pular questão)"
                        >
                          Pular (Next s/ Submit)
                        </button>
                        <button
                          onClick={handleSubmitReview}
                          disabled={phase === 'rest'}
                          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
                          title="Iniciar a revisão desta questão"
                        >
                          <Check className="w-4 h-4" />
                          Submit & Iniciar Revisão
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleNext}
                        disabled={phase === 'rest'}
                        className="px-7 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
                      >
                        {totalQuestionsDone + 1 >= totalQuestions ? 'Finalizar Lista' : 'Próxima Questão'} <FastForward className="w-4 h-4" />
                      </button>
                    )
                  ) : (
                    <button
                      onClick={handleNext}
                      disabled={phase === 'rest'}
                      className={`px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
                        phase === 'rest'
                          ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : 'bg-gray-900 dark:bg-gray-50 hover:bg-black dark:hover:bg-white text-white dark:text-gray-900'
                      }`}
                    >
                      {totalQuestionsDone + 1 >= totalQuestions ? 'Finalizar Lista' : 'Próxima'} <FastForward className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <SoundSettingsModal 
        isOpen={showSoundModal} 
        onClose={() => setShowSoundModal(false)} 
      />
    </div>
  );
}
