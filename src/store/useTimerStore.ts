import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { startOfDay, format } from 'date-fns';

type TimerState = 'idle' | 'running' | 'paused' | 'waiting_transition';
type TimerPhase = 'study' | 'rest';

interface TimerStore {
  timerState: TimerState;
  phase: TimerPhase;
  timeLeft: number;
  studyDuration: number;
  restDuration: number;
  
  // Stats
  dailyNetTime: Record<string, number>; // YYYY-MM-DD -> seconds
  
  // Pacer State
  pacerIsActive: boolean;
  pacerTotalQuestions: number;
  pacerTargetTimeSeconds: number;
  pacerIsAdaptive: boolean;
  pacerCurrentQuestionTime: number;
  pacerCompletedQuestionsTime: number[];
  pacerSoundEnabled: boolean;
  pacerShowSummary: boolean;

  // Adaptive Session State
  isAdaptiveMode: boolean;
  adaptiveCyclesTotal: number;
  adaptiveCurrentCycle: number;
  adaptiveStudyTimeTotal: number;
  adaptiveRestTimeTotal: number;
  adaptiveStudyTimeElapsed: number;
  adaptiveRestTimeElapsed: number;
  adaptivePacerSessions: Array<{ time: number, questions: number }>;
  isUnscheduledRest: boolean;
  unscheduledRestStoredTimeLeft: number;

  // Actions
  setTimerState: (state: TimerState) => void;
  setPhase: (phase: TimerPhase) => void;
  setTimeLeft: (time: number | ((prev: number) => number)) => void;
  setStudyDuration: (duration: number) => void;
  setRestDuration: (duration: number) => void;
  
  addNetTime: (seconds: number) => void;
  resetTodayNetTime: () => void;

  // Adaptive Actions
  startAdaptiveSession: (studyMin: number, restMin: number, cycles: number) => void;
  stopAdaptiveSession: () => void;
  transitionPhase: () => void;
  takeUnscheduledRest: () => void;
  tickAdaptive: (deltaSecs: number) => void;

  // Pacer Actions
  setPacerState: (updates: Partial<TimerStore>) => void;
  tickPacer: (deltaSecs: number) => void;
  nextPacerQuestion: () => void;
  stashPacerSession: () => void;
  finishPacerSession: () => void;
  closePacerSummary: () => void;
  stopPacer: () => void;
}

export const useTimerStore = create<TimerStore>()(
  persist(
    (set) => ({
      timerState: 'idle',
      phase: 'study',
      timeLeft: 50 * 60,
      studyDuration: 50 * 60,
      restDuration: 10 * 60,
      dailyNetTime: {},

      pacerIsActive: false,
      pacerTotalQuestions: 40,
      pacerTargetTimeSeconds: 90,
      pacerIsAdaptive: false,
      pacerCurrentQuestionTime: 0,
      pacerCompletedQuestionsTime: [],
      pacerSoundEnabled: true,
      pacerShowSummary: false,
      
      isAdaptiveMode: false,
      adaptiveCyclesTotal: 0,
      adaptiveCurrentCycle: 1,
      adaptiveStudyTimeTotal: 0,
      adaptiveRestTimeTotal: 0,
      adaptiveStudyTimeElapsed: 0,
      adaptiveRestTimeElapsed: 0,
      adaptivePacerSessions: [],
      isUnscheduledRest: false,
      unscheduledRestStoredTimeLeft: 0,

      setTimerState: (state) => set({ timerState: state }),
      setPhase: (phase) => set({ phase }),
      setTimeLeft: (time) => set((state) => ({ 
        timeLeft: typeof time === 'function' ? time(state.timeLeft) : time 
      })),
      setStudyDuration: (duration) => set({ studyDuration: duration }),
      setRestDuration: (duration) => set({ restDuration: duration }),
      
      addNetTime: (seconds) => set((state) => {
        const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
        return {
          dailyNetTime: {
            ...state.dailyNetTime,
            [todayStr]: (state.dailyNetTime[todayStr] || 0) + seconds
          }
        };
      }),
      
      resetTodayNetTime: () => set((state) => {
        const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
        const newDaily = { ...state.dailyNetTime };
        delete newDaily[todayStr];
        return { dailyNetTime: newDaily };
      }),

      startAdaptiveSession: (studyMin, restMin, cycles) => set({
        isAdaptiveMode: true,
        adaptiveCyclesTotal: cycles,
        adaptiveCurrentCycle: 1,
        adaptiveStudyTimeTotal: studyMin * cycles * 60,
        adaptiveRestTimeTotal: restMin * cycles * 60,
        adaptiveStudyTimeElapsed: 0,
        adaptiveRestTimeElapsed: 0,
        adaptivePacerSessions: [],
        isUnscheduledRest: false,
        unscheduledRestStoredTimeLeft: 0,
        phase: 'study',
        timerState: 'running',
        timeLeft: studyMin * 60,
        pacerCompletedQuestionsTime: [],
        pacerCurrentQuestionTime: 0,
        pacerIsActive: true,
        pacerShowSummary: false
      }),

      stopAdaptiveSession: () => set((state) => ({
        isAdaptiveMode: false,
        timerState: 'idle',
        phase: 'study',
        timeLeft: state.studyDuration,
        isUnscheduledRest: false,
        unscheduledRestStoredTimeLeft: 0,
        pacerIsActive: false,
        adaptivePacerSessions: []
      })),

      tickAdaptive: (deltaSecs) => set((state) => {
        if (!state.isAdaptiveMode) return state;
        const updates: Partial<TimerStore> = {};
        if (state.phase === 'study') {
          updates.adaptiveStudyTimeElapsed = state.adaptiveStudyTimeElapsed + deltaSecs;
        } else {
          updates.adaptiveRestTimeElapsed = state.adaptiveRestTimeElapsed + deltaSecs;
        }
        return updates;
      }),

      transitionPhase: () => set((state) => {
        if (state.isUnscheduledRest) {
          return {
            isUnscheduledRest: false,
            phase: 'study',
            timeLeft: state.unscheduledRestStoredTimeLeft,
            timerState: 'running'
          };
        }

        if (state.isAdaptiveMode) {
          if (state.phase === 'study') {
            const remainingRest = Math.max(0, state.adaptiveRestTimeTotal - state.adaptiveRestTimeElapsed);
            const remainingCycles = state.adaptiveCyclesTotal - state.adaptiveCurrentCycle + 1;
            const nextTimeLeft = remainingCycles > 0 ? Math.floor(remainingRest / remainingCycles) : 0;
            return {
              phase: 'rest',
              timeLeft: nextTimeLeft,
              timerState: 'running'
            };
          } else {
            const nextCycle = state.adaptiveCurrentCycle + 1;
            if (nextCycle > state.adaptiveCyclesTotal) {
              return {
                isAdaptiveMode: false,
                timerState: 'idle',
                phase: 'study',
                timeLeft: state.studyDuration,
                pacerIsActive: false,
                pacerShowSummary: true
              };
            }
            const nextTimeLeft = Math.floor(state.adaptiveStudyTimeTotal / state.adaptiveCyclesTotal);
            return {
              phase: 'study',
              adaptiveCurrentCycle: nextCycle,
              pacerCompletedQuestionsTime: [],
              pacerCurrentQuestionTime: 0,
              pacerIsActive: true,
              pacerShowSummary: false,
              timeLeft: nextTimeLeft,
              timerState: 'running'
            };
          }
        } else {
          const nextPhase = state.phase === 'study' ? 'rest' : 'study';
          return {
            phase: nextPhase,
            timeLeft: nextPhase === 'study' ? state.studyDuration : state.restDuration,
            timerState: 'running'
          };
        }
      }),

      takeUnscheduledRest: () => set((state) => {
        if (state.phase === 'rest') return state;
        if (state.isAdaptiveMode) {
            const remainingRest = Math.max(0, state.adaptiveRestTimeTotal - state.adaptiveRestTimeElapsed);
            const remainingCycles = state.adaptiveCyclesTotal - state.adaptiveCurrentCycle + 1;
            const nextTimeLeft = remainingCycles > 0 ? Math.floor(remainingRest / remainingCycles) : 0;
            return {
              isUnscheduledRest: true,
              unscheduledRestStoredTimeLeft: state.timeLeft,
              phase: 'rest',
              timeLeft: nextTimeLeft,
              timerState: 'running'
            };
        } else {
            return {
              isUnscheduledRest: true,
              unscheduledRestStoredTimeLeft: state.timeLeft,
              phase: 'rest',
              timeLeft: state.restDuration,
              timerState: 'running'
            };
        }
      }),

      setPacerState: (updates) => set((state) => ({ ...state, ...updates })),
      
      tickPacer: (deltaSecs) => set((state) => ({
         pacerCurrentQuestionTime: state.pacerCurrentQuestionTime + deltaSecs
      })),

      nextPacerQuestion: () => set((state) => ({
        pacerCompletedQuestionsTime: [...state.pacerCompletedQuestionsTime, state.pacerCurrentQuestionTime],
        pacerCurrentQuestionTime: 0
      })),

      stashPacerSession: () => set((state) => {
        const time = state.pacerCompletedQuestionsTime.reduce((a,b)=>a+b, 0) + state.pacerCurrentQuestionTime;
        const qs = state.pacerCompletedQuestionsTime.length + 1;
        return {
          adaptivePacerSessions: [...state.adaptivePacerSessions, { time, questions: qs }],
          pacerCompletedQuestionsTime: [],
          pacerCurrentQuestionTime: 0
        };
      }),

      finishPacerSession: () => set({
        pacerIsActive: false,
        pacerShowSummary: true
      }),

      closePacerSummary: () => set({
        pacerShowSummary: false,
        pacerCurrentQuestionTime: 0,
        pacerCompletedQuestionsTime: [],
        adaptivePacerSessions: []
      }),

      stopPacer: () => set({
        pacerIsActive: false,
        pacerShowSummary: false,
        pacerCurrentQuestionTime: 0,
        pacerCompletedQuestionsTime: [],
        adaptivePacerSessions: []
      })
    }),
    {
      name: 'timer-storage',
      partialize: (state) => ({ 
        studyDuration: state.studyDuration, 
        restDuration: state.restDuration,
        dailyNetTime: state.dailyNetTime,
        pacerTotalQuestions: state.pacerTotalQuestions,
        pacerTargetTimeSeconds: state.pacerTargetTimeSeconds,
        pacerIsAdaptive: state.pacerIsAdaptive,
        pacerSoundEnabled: state.pacerSoundEnabled
      }),
    }
  )
);
