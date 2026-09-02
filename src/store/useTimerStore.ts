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

  // Actions
  setTimerState: (state: TimerState) => void;
  setPhase: (phase: TimerPhase) => void;
  setTimeLeft: (time: number | ((prev: number) => number)) => void;
  setStudyDuration: (duration: number) => void;
  setRestDuration: (duration: number) => void;
  
  addNetTime: (seconds: number) => void;
  resetTodayNetTime: () => void;

  // Pacer Actions
  setPacerState: (updates: Partial<TimerStore>) => void;
  tickPacer: (deltaSecs: number) => void;
  nextPacerQuestion: () => void;
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

      setPacerState: (updates) => set((state) => ({ ...state, ...updates })),
      
      tickPacer: (deltaSecs) => set((state) => ({
         pacerCurrentQuestionTime: state.pacerCurrentQuestionTime + deltaSecs
      })),

      nextPacerQuestion: () => set((state) => ({
        pacerCompletedQuestionsTime: [...state.pacerCompletedQuestionsTime, state.pacerCurrentQuestionTime],
        pacerCurrentQuestionTime: 0
      })),

      stopPacer: () => set({
        pacerIsActive: false,
        pacerCurrentQuestionTime: 0,
        pacerCompletedQuestionsTime: []
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
