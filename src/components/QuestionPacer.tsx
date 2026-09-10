import React, { useRef, useState, useEffect } from 'react';
import { Play, Square, FastForward, Clock, Activity, TrendingUp, TrendingDown, Volume2, VolumeX, Settings2, Pause, Save, X, BookOpen, Coffee } from 'lucide-react';
import { useTimerStore } from '../store/useTimerStore';

export function QuestionPacer({ className }: { className?: string }) {
  const { 
    pacerIsActive: isActive, 
    pacerTotalQuestions: totalQuestions, 
    pacerTargetTimeSeconds: targetTimeSeconds, 
    pacerIsAdaptive: isAdaptive, 
    pacerCurrentQuestionTime: currentQuestionTime, 
    pacerCompletedQuestionsTime: completedQuestionsTime, 
    pacerSoundEnabled: soundEnabled,
    setPacerState,
    nextPacerQuestion,
    stopPacer,
    finishPacerSession,
    addNetTime,
    setTimerState,
    phase,
    timerState,
    timeLeft,
    isAdaptiveMode,
    adaptiveCurrentCycle,
    adaptiveCyclesTotal,
    adaptiveStudyTimeTotal,
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
  const setIsAdaptive = (v: boolean) => setPacerState({ pacerIsAdaptive: v });
  const setIsActive = (v: boolean) => setPacerState({ pacerIsActive: v });
  const setSoundEnabled = (v: boolean) => setPacerState({ pacerSoundEnabled: v });

  const audioContextRef = useRef<AudioContext | null>(null);

  const totalQuestionsDone = completedQuestionsTime.length;
  const remainingQuestions = Math.max(0, totalQuestions - totalQuestionsDone - 1);
  const totalCompletedTime = completedQuestionsTime.reduce((a, b) => a + b, 0);
  const globalElapsedTime = totalCompletedTime + currentQuestionTime;
  const totalTargetTime = totalQuestions * targetTimeSeconds;
  const remainingTargetTime = totalTargetTime - totalCompletedTime;
  
  // Adaptive Pace Calculation
  const requiredPace = remainingQuestions >= 0 && remainingTargetTime > 0 
    ? Math.floor(remainingTargetTime / (remainingQuestions + 1)) 
    : 0;

  // Effective Target for current question
  const effectiveTarget = isAdaptive && requiredPace < targetTimeSeconds && requiredPace > 0
    ? requiredPace 
    : targetTimeSeconds;

  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
      
      gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  };

  const handleStart = () => {
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
    setIsActive(true);
    setTimerState('running');
    
    if (pacerMode === 'sessoes') {
       useTimerStore.getState().startAdaptiveSession(adaptiveStudyMin, adaptiveRestMin, adaptiveCycles);
    }
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
    }
  };

  // Adaptive Session Config State
  const [pacerMode, setPacerMode] = useState<'tradicional' | 'adaptativo' | 'sessoes'>('tradicional');
  const [adaptiveStudyMin, setAdaptiveStudyMin] = useState(50);
  const [adaptiveRestMin, setAdaptiveRestMin] = useState(10);
  const [adaptiveCycles, setAdaptiveCycles] = useState(4);

  const handleStop = () => {
    finishPacerSession();
    setTimerState('idle');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(Math.abs(seconds) / 60);
    const s = Math.abs(seconds) % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${m}:${s.toString().padStart(2, '0')}`;
  };

  const averagePace = totalQuestionsDone > 0 ? Math.round(totalCompletedTime / totalQuestionsDone) : 0;
  
  // Accumulated delay or advance on COMPLETED questions
  const accumulatedDiff = (totalQuestionsDone * targetTimeSeconds) - totalCompletedTime;
  const currentGlobalDiff = ( (totalQuestionsDone + 1) * targetTimeSeconds ) - globalElapsedTime;

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col w-full ${className || 'mt-8'}`}>
      <div className="bg-blue-600 dark:bg-blue-500 px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Pacer de Questões
        </h2>
        <button 
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="text-white/80 hover:text-white transition-colors"
          title={soundEnabled ? "Desativar Som" : "Ativar Som"}
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
      </div>

      <div className="p-6 flex flex-col gap-6">
        {!isActive ? (
          <div className="flex flex-col gap-6 py-4">
            <div className="text-gray-500 dark:text-gray-400 text-sm text-center">
              Configure sua sessão de questões. O pacer ajudará a manter seu ritmo.
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total de Questões</label>
                <input 
                  type="number" 
                  value={totalQuestions}
                  onChange={(e) => setTotalQuestions(Math.max(1, parseInt(e.target.value) || 1))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tempo Alvo (segundos/q)</label>
                <input 
                  type="number" 
                  value={targetTimeSeconds}
                  onChange={(e) => setTargetTimeSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Tempo Total de Prova:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{formatTime(totalTargetTime)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                Modo de Sessão
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => { setPacerMode('tradicional'); setIsAdaptive(false); }}
                  className={`p-3 rounded-xl border text-left transition-all ${pacerMode === 'tradicional' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 ring-1 ring-blue-500' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600'}`}
                >
                  <div className={`text-sm font-bold ${pacerMode === 'tradicional' ? 'text-blue-900' : 'text-gray-900 dark:text-gray-100'}`}>Pacer Tradicional</div>
                  <div className={`text-[10px] mt-1 ${pacerMode === 'tradicional' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>Alarme soa sempre no tempo alvo ({targetTimeSeconds}s).</div>
                </button>
                <button
                  onClick={() => { setPacerMode('adaptativo'); setIsAdaptive(true); }}
                  className={`p-3 rounded-xl border text-left transition-all ${pacerMode === 'adaptativo' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 ring-1 ring-blue-500' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600'}`}
                >
                  <div className={`text-sm font-bold ${pacerMode === 'adaptativo' ? 'text-blue-900' : 'text-gray-900 dark:text-gray-100'}`}>Pacer Adaptativo</div>
                  <div className={`text-[10px] mt-1 ${pacerMode === 'adaptativo' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>Encurta o tempo do alarme automaticamente se você atrasar.</div>
                </button>
                <button
                  onClick={() => { setPacerMode('sessoes'); }}
                  className={`p-3 rounded-xl border text-left transition-all ${pacerMode === 'sessoes' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 ring-1 ring-blue-500' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600'}`}
                >
                  <div className={`text-sm font-bold ${pacerMode === 'sessoes' ? 'text-blue-900' : 'text-gray-900 dark:text-gray-100'}`}>Sessões Adaptativas</div>
                  <div className={`text-[10px] mt-1 ${pacerMode === 'sessoes' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>Ciclos Pomodoro dinâmicos que ajustam tempos automaticamente.</div>
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
                </div>
              )}
            </div>

            <button 
              onClick={handleStart}
              className="mt-2 w-full py-3 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <Play className="w-4 h-4" />
              Iniciar Sessão
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            
            {/* SEÇÃO 1: CICLOS (Timer Global) */}
            {isAdaptiveMode && (
              <div className="flex flex-col gap-4 mb-8">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Sessão Global
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
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        Modo Adaptativo ({Math.round((adaptiveStudyTimeTotal / Math.max(1, adaptiveCyclesTotal)) / 60)}m / {Math.round((adaptiveRestTimeTotal / Math.max(1, adaptiveCyclesTotal)) / 60)}m)
                      </span>
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
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
                                Próxima sessão
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
                  Andamento do Pacer
                </div>
                <div className="text-xs font-bold text-gray-500">
                  {totalQuestionsDone + 1} de {totalQuestions} Questões
                </div>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch mb-4">
                {/* Tempo Atual Pacer */}
                <div className="flex flex-col items-center justify-center text-center py-8 px-4 relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
                  {timerState === 'paused' || timerState === 'idle' ? (
                    <div className="absolute top-0 inset-x-0 flex justify-center">
                       <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold uppercase px-3 py-1 rounded-b-lg shadow-sm">Pausado</span>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                    <div className="flex flex-col justify-center p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
                      <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Pace Médio Atual
                      </div>
                      <div className="text-3xl font-black text-gray-900 dark:text-gray-100 mt-1 mb-1">{totalQuestionsDone > 0 ? formatTime(averagePace) : '--:--'}</div>
                      <div className="text-xs font-medium text-gray-500">Gasto por questão</div>
                    </div>

                    <div className="flex flex-col justify-center p-5 rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/20">
                      <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5" /> Pace Alvo (Para Terminar)
                      </div>
                      <div className="text-3xl font-black text-blue-700 dark:text-blue-300 mt-1 mb-1">{formatTime(requiredPace)}</div>
                      <div className="text-xs font-medium text-blue-600/70 dark:text-blue-400/70">Necessário nas próximas {remainingQuestions}</div>
                    </div>
                  </div>

                  <div className={`p-5 rounded-xl border flex items-center justify-between ${currentGlobalDiff >= 0 ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20' : 'border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/20'}`}>
                    <div className="flex flex-col">
                      <div className={`text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 ${currentGlobalDiff >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                        <TrendingUp className="w-3.5 h-3.5" /> Status Global
                      </div>
                      <div className={`text-2xl font-black ${currentGlobalDiff >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                        {currentGlobalDiff >= 0 ? 'Adiantado em ' : 'Atrasado em '}
                        {formatTime(Math.abs(currentGlobalDiff))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 text-right hidden sm:block">
                       <div>
                         <div className="text-[10px] font-bold text-gray-500 uppercase">Tempo de Prova</div>
                         <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatTime(globalElapsedTime)} / {formatTime(totalTargetTime)}</div>
                       </div>
                       <div>
                         <div className="text-[10px] font-bold text-gray-500 uppercase">Tempo Restante Estimado</div>
                         <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                            {formatTime(averagePace * remainingQuestions)} <span className="text-gray-500">(Fim: {new Date(Date.now() + (averagePace * remainingQuestions) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                         </div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Controles Pacer*/}
              <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={handleStop}
                  className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  Encerrar Pacer
                </button>
                
                <button
                  onClick={handleNext}
                  disabled={phase === 'rest'}
                  className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all ${phase === 'rest' ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-gray-900 dark:bg-gray-50 hover:bg-black dark:hover:bg-white text-white dark:text-gray-900'}`}
                >
                  {totalQuestionsDone + 1 >= totalQuestions ? 'Finalizar Lista' : 'Próxima Questão'} <FastForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
