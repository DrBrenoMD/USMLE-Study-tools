import React, { useEffect, useRef, useState } from 'react';
import { useTimerStore } from '../store/useTimerStore';
import { Play, Pause, Square, Coffee, BookOpen, Settings2, RotateCcw, Activity, FastForward } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { QuestionPacer } from './QuestionPacer';

export function TopBarTimer() {
  const {
    timerState,
    phase,
    timeLeft,
    studyDuration,
    restDuration,
    setTimerState,
    setPhase,
    setTimeLeft,
    addNetTime,
    dailyNetTime,
    resetTodayNetTime,
    setStudyDuration,
    setRestDuration,
    pacerIsActive,
    pacerCurrentQuestionTime,
    pacerCompletedQuestionsTime,
    pacerTotalQuestions,
    pacerTargetTimeSeconds,
    setPacerState,
    stopPacer
  } = useTimerStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showPacer, setShowPacer] = useState(false);
  const [showAddButtons, setShowAddButtons] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const todayNetSeconds = dailyNetTime[todayStr] || 0;

  const playAlarm = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const playBeep = (startTime: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, startTime);
        osc.frequency.setValueAtTime(1108.73, startTime + 0.1);
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
        gain.gain.linearRampToValueAtTime(0, startTime + 0.2);
        
        osc.start(startTime);
        osc.stop(startTime + 0.2);
      };

      const now = ctx.currentTime;
      playBeep(now);
      playBeep(now + 0.3);
      playBeep(now + 0.8);
      playBeep(now + 1.1);
    } catch (err) {
      console.error(err);
    }
  };

  const playPacerBeep = (soundEnabled: boolean) => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); 
      
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

  useEffect(() => {
    const isAnyActive = timerState === 'running' || timerState === 'waiting_transition' || pacerIsActive;
    
    if (isAnyActive) {
      lastTickRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const deltaSecs = Math.round((now - lastTickRef.current) / 1000);
        
        if (deltaSecs > 0) {
            lastTickRef.current = now;
            const state = useTimerStore.getState();
            
            // 1. Timer Logic
            if (state.timerState === 'running') {
              state.setTimeLeft((prev) => {
                  const next = prev - deltaSecs;
                  if (prev > 0 && next <= 0) {
                      playAlarm();
                      state.setTimerState('waiting_transition');
                  }
                  return next;
              });

              if (state.phase === 'study') {
                  state.addNetTime(deltaSecs);
              }
            } else if (state.timerState === 'waiting_transition') {
               state.setTimeLeft((prev) => prev - deltaSecs);
            }

            // 2. Pacer Logic
            if (state.pacerIsActive && state.phase === 'study' && state.timerState === 'running') {
               const newPacerTime = state.pacerCurrentQuestionTime + deltaSecs;
               state.tickPacer(deltaSecs);
               
               const totalDone = state.pacerCompletedQuestionsTime.length;
               const remainingQ = Math.max(0, state.pacerTotalQuestions - totalDone - 1);
               const totalTimeDone = state.pacerCompletedQuestionsTime.reduce((a, b) => a + b, 0);
               const remainingTarget = (state.pacerTotalQuestions * state.pacerTargetTimeSeconds) - totalTimeDone;
               
               const requiredPace = remainingQ >= 0 && remainingTarget > 0 ? Math.floor(remainingTarget / (remainingQ + 1)) : 0;
               const effectiveTarget = state.pacerIsAdaptive && requiredPace < state.pacerTargetTimeSeconds && requiredPace > 0
                  ? requiredPace : state.pacerTargetTimeSeconds;
               
               if (effectiveTarget > 0 && newPacerTime > 0 && newPacerTime % effectiveTarget === 0) {
                  playPacerBeep(state.pacerSoundEnabled);
               }
            }
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerState, pacerIsActive]);

  const toggleTimer = () => {
    if (timerState === 'idle' || timerState === 'paused') {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      setTimerState('running');
      if (pacerTotalQuestions > 0 && pacerCompletedQuestionsTime.length < pacerTotalQuestions) {
        setPacerState({ pacerIsActive: true });
      }
    } else if (timerState === 'running') {
      setTimerState('paused');
      if (pacerIsActive) {
        setPacerState({ pacerIsActive: false });
      }
    }
  };

  const handleStop = () => {
    setTimerState('idle');
    setPhase('study');
    setTimeLeft(studyDuration);
    if (pacerIsActive) {
      setPacerState({ pacerIsActive: false });
    }
  };

  const handleTransition = () => {
    const nextPhase = phase === 'study' ? 'rest' : 'study';
    setPhase(nextPhase);
    setTimeLeft(nextPhase === 'study' ? studyDuration : restDuration);
    setTimerState('running');
  };

  const handleSkipRest = () => {
    setPhase('study');
    setTimeLeft(studyDuration);
    setTimerState('running');
  };

  const extendTime = (minutes: number) => {
    setTimeLeft((prev) => prev + minutes * 60);
    if (timerState === 'waiting_transition') {
      setTimerState('running');
    }
  };

  const formatTimeStr = (seconds: number) => {
    const isNegative = seconds < 0;
    const absSecs = Math.abs(seconds);
    const h = Math.floor(absSecs / 3600);
    const m = Math.floor((absSecs % 3600) / 60);
    const s = absSecs % 60;
    const sign = isNegative ? '-' : '';
    if (h > 0) return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatTimeHM = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="flex items-center gap-2 relative">
      {/* Settings Popover */}
      {showSettings && (
        <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 w-64 z-50">
          <div className="flex justify-between items-center mb-3">
             <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200">Configurações do Timer</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Estudo (min)</label>
              <input 
                type="number" 
                value={studyDuration / 60}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 50) * 60;
                  setStudyDuration(val);
                  if (timerState === 'idle' && phase === 'study') setTimeLeft(val);
                }}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Descanso (min)</label>
              <input 
                type="number" 
                value={restDuration / 60}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 10) * 60;
                  setRestDuration(val);
                  if (timerState === 'idle' && phase === 'rest') setTimeLeft(val);
                }}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-semibold"
              />
            </div>
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
               <button 
                  onClick={resetTodayNetTime}
                  className="w-full flex items-center justify-center gap-1 mt-2 text-xs font-bold text-red-600 hover:bg-red-50 py-1.5 rounded-md transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Zerar Horas Líquidas
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Net Hours */}
      <div className="hidden lg:flex items-center gap-1.5 mr-2 bg-white/50 dark:bg-gray-800/50 px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Líquido</span>
        <span className="text-sm font-black text-blue-600 dark:text-blue-400">{formatTimeHM(todayNetSeconds)}</span>
      </div>

      {/* Quick Add Minutes Buttons */}
      {(timerState === 'waiting_transition' || showAddButtons) && (
        <div className="hidden lg:flex items-center gap-1 mr-2 animate-in fade-in zoom-in-95 duration-200">
          <button onClick={() => extendTime(1)} className="px-2 py-1 text-[10px] font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:bg-gray-800 rounded-md transition-colors">+1</button>
          <button onClick={() => extendTime(5)} className="px-2 py-1 text-[10px] font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:bg-gray-800 rounded-md transition-colors">+5</button>
          <button onClick={() => extendTime(10)} className="px-2 py-1 text-[10px] font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:bg-gray-800 rounded-md transition-colors">+10</button>
        </div>
      )}

      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {/* Main Display */}
        <button 
          onClick={() => setShowAddButtons(!showAddButtons)}
          className={`flex items-center gap-2 px-3 py-1 rounded-md min-w-[130px] justify-between cursor-pointer transition-colors
            ${timerState === 'waiting_transition' ? 'bg-red-100 text-red-700 animate-pulse hover:bg-red-200' : 
              phase === 'study' ? (timerState === 'running' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-200' : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:bg-gray-700') : 
              (timerState === 'running' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:bg-gray-700')}
        `}>
          <div className="flex items-center gap-1.5">
            {phase === 'study' ? <BookOpen className="w-3.5 h-3.5" /> : <Coffee className="w-3.5 h-3.5" />}
            <span className="font-mono font-bold text-sm tabular-nums tracking-tighter">
              {formatTimeStr(timeLeft)}
            </span>
          </div>
        </button>

        {/* Controls */}
        <div className={`flex items-center gap-1 ml-1 pr-1 border-r border-gray-200 dark:border-gray-700`}>
          {timerState === 'waiting_transition' ? (
             <div className="flex items-center gap-1">
               <button 
                  onClick={handleTransition}
                  title={`Iniciar ${phase === 'study' ? 'Descanso' : 'Estudo'}`}
                  className="p-1.5 rounded-md bg-white dark:bg-gray-900 shadow-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:text-blue-400 transition-colors"
               >
                  {phase === 'study' ? <Coffee className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
               </button>
               {phase === 'study' && (
                 <button 
                    onClick={handleSkipRest}
                    title="Pular Descanso"
                    className="p-1.5 rounded-md bg-white dark:bg-gray-900 shadow-sm text-gray-700 dark:text-gray-300 hover:text-amber-600 transition-colors"
                 >
                    <FastForward className="w-4 h-4" />
                 </button>
               )}
             </div>
          ) : (
            <button 
              onClick={toggleTimer}
              className={`p-1.5 rounded-md transition-colors shadow-sm ${timerState === 'running' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-800/50 hover:text-blue-600 dark:text-blue-400'}`}
            >
              {timerState === 'running' ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
          )}

          <button 
            onClick={handleStop}
            disabled={timerState === 'idle'}
            className="p-1.5 rounded-md bg-transparent text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 disabled:opacity-30 disabled:hover:text-gray-400 dark:text-gray-500 transition-colors"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>

          <button 
            onClick={() => { setShowSettings(!showSettings); setShowPacer(false); }}
            className="p-1.5 rounded-md bg-transparent text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 transition-colors ml-1"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>

        <div className="relative flex items-center gap-1 ml-1">
          {/* Pacer Inline Stats */}
          {pacerIsActive && (
            <div className="hidden xl:flex items-center gap-2 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-2 py-1.5 rounded-md text-xs font-bold font-mono">
              <div className="flex items-center gap-1"><Activity className="w-3.5 h-3.5" /></div>
              <div>Q: {pacerCompletedQuestionsTime.length + 1}/{pacerTotalQuestions}</div>
              <div className={pacerCurrentQuestionTime >= pacerTargetTimeSeconds ? 'text-red-600' : ''}>
                {formatTimeStr(pacerCurrentQuestionTime)}
              </div>
            </div>
          )}

          <button 
            onClick={() => { setShowPacer(!showPacer); setShowSettings(false); }}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors ${pacerIsActive ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/30'}`}
          >
            <Activity className="w-4 h-4" />
            <span className="text-xs font-bold hidden sm:inline">Pacer</span>
          </button>

          {/* Pacer Popover */}
          {showPacer && (
            <div className="absolute top-full right-0 mt-3 z-50 w-[90vw] max-w-3xl">
               <QuestionPacer className="shadow-2xl border-gray-200 dark:border-gray-700 m-0 w-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
