import React, { useRef } from 'react';
import { Play, Square, FastForward, Clock, Activity, TrendingUp, TrendingDown, Volume2, VolumeX, Settings2, Pause } from 'lucide-react';
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
    setTimerState
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
  };

  const handlePause = () => {
    setIsActive(false);
    setTimerState('paused');
  };

  const handleNext = () => {
    nextPacerQuestion();
  };

  const handleStop = () => {
    stopPacer();
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
    <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col w-full max-w-2xl ${className || 'mt-8'}`}>
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
        {!isActive && completedQuestionsTime.length === 0 ? (
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
                Modo do Pacer
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setIsAdaptive(false)}
                  className={`p-3 rounded-xl border text-left transition-all ${!isAdaptive ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 ring-1 ring-blue-500' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600'}`}
                >
                  <div className={`text-sm font-bold ${!isAdaptive ? 'text-blue-900' : 'text-gray-900 dark:text-gray-100'}`}>Tradicional</div>
                  <div className={`text-[10px] mt-1 ${!isAdaptive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>Alarme soa sempre no tempo alvo ({targetTimeSeconds}s).</div>
                </button>
                <button
                  onClick={() => setIsAdaptive(true)}
                  className={`p-3 rounded-xl border text-left transition-all ${isAdaptive ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 ring-1 ring-blue-500' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600'}`}
                >
                  <div className={`text-sm font-bold ${isAdaptive ? 'text-blue-900' : 'text-gray-900 dark:text-gray-100'}`}>Adaptativo</div>
                  <div className={`text-[10px] mt-1 ${isAdaptive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>Encurta o tempo do alarme automaticamente se você atrasar.</div>
                </button>
              </div>
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
          <div className="flex flex-col gap-6">
            
            {/* Header de Progresso Global */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Progresso</span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{totalQuestionsDone + 1} de {totalQuestions}</span>
              </div>
              <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
              <div className="flex flex-col text-center">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Tempo de Prova</span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatTime(globalElapsedTime)} <span className="text-gray-400 dark:text-gray-500 font-medium">/ {formatTime(totalTargetTime)}</span></span>
              </div>
              <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Tempo Restante Estimado</span>
                <span className={`text-sm font-bold ${totalTargetTime - globalElapsedTime < 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
                  {formatTime(totalTargetTime - globalElapsedTime)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tempo Atual */}
              <div className="md:col-span-1 bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
                {isAdaptive && effectiveTarget < targetTimeSeconds && (
                  <div className="absolute top-0 inset-x-0 bg-amber-500 text-white text-[9px] font-bold uppercase py-0.5">
                    Alarme Antecipado Ativo
                  </div>
                )}
                <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 mt-2">
                  Questão Atual
                </div>
                <div className={`text-5xl font-black tracking-tight ${currentQuestionTime >= effectiveTarget ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>
                  {formatTime(currentQuestionTime)}
                </div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-2">
                  Alarme em: {formatTime(effectiveTarget)}
                </div>
              </div>

              {/* Estatísticas */}
              <div className="md:col-span-2 grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800 flex flex-col justify-center">
                  <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Pace Médio Atual
                  </div>
                  <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                    {totalQuestionsDone > 0 ? formatTime(averagePace) : '--:--'}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                    Gasto por questão
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-100 flex flex-col justify-center">
                  <div className="text-[10px] font-bold text-blue-700/70 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5" />
                    Pace Alvo (Para Terminar)
                  </div>
                  <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                    {formatTime(requiredPace)}
                  </div>
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                    Necessário nas próximas {remainingQuestions + 1}
                  </div>
                </div>

                <div className={`col-span-2 rounded-xl p-4 border flex items-center justify-between ${
                  currentGlobalDiff >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'
                }`}>
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 ${
                      currentGlobalDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {currentGlobalDiff >= 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                      Status Global
                    </div>
                    <div className={`text-xl font-bold ${
                      currentGlobalDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {currentGlobalDiff >= 0 ? 'Adiantado em ' : 'Atrasado em '}
                      {formatTime(Math.abs(currentGlobalDiff))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Controles */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={handleStop}
                className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
              >
                <Square className="w-4 h-4" />
                Encerrar
              </button>
              
              {!isActive ? (
                <button
                  onClick={handleStart}
                  className="px-6 py-2.5 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                  <Play className="w-4 h-4" />
                  Retomar
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePause}
                    className="px-4 py-2.5 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-xl font-bold flex items-center gap-2 transition-all"
                  >
                    <Pause className="w-4 h-4" />
                    Pausar
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={totalQuestionsDone + 1 >= totalQuestions}
                    className="px-6 py-2.5 bg-gray-900 dark:bg-gray-50 hover:bg-black disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all"
                  >
                    {totalQuestionsDone + 1 >= totalQuestions ? 'Última Questão' : 'Próxima'} <FastForward className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
