import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { startOfDay, format } from 'date-fns';

type TimerState = 'idle' | 'running' | 'paused' | 'waiting_transition';
type TimerPhase = 'study' | 'rest';

export interface PacerSoundSettings {
  master: boolean;
  solveAlarm: boolean;
  reviewAlarm: boolean;
  nextQuestion: boolean;
  submitQuestion: boolean;
  prevQuestion: boolean;
  cycleAlarm: boolean;
  keepAliveAudio?: boolean;
  volume?: number;
}

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
  pacerTargetReviewSeconds: number;
  pacerQBankMode: 'timed' | 'tutored';
  pacerTutoredPhase: 'solve' | 'review';
  pacerTriggerButton: 'next' | 'submit' | 'both';
  pacerIsAdaptive: boolean;
  pacerCurrentQuestionTime: number;
  pacerCurrentReviewTime: number;
  pacerCompletedQuestionsTime: number[];
  pacerCompletedReviewTimes: number[];
  pacerSoundEnabled: boolean;
  pacerSoundSettings: PacerSoundSettings;
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

  // Quick Log State
  showQuickLog: boolean;
  quickLogDefaultQuestions: number;
  setShowQuickLog: (show: boolean, defaultQuestions?: number) => void;

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
  setPacerSoundSettings: (settings: Partial<PacerSoundSettings>) => void;
  togglePacerSoundSetting: (key: keyof PacerSoundSettings) => void;
  setPacerState: (updates: Partial<TimerStore>) => void;
  tickPacer: (deltaSecs: number) => void;
  submitPacerQuestion: () => void;
  nextPacerQuestion: () => void;
  prevPacerQuestion: () => void;
  syncPacerQuestion: (params: {
    targetQuestion?: number | null;
    targetPhase?: 'solve' | 'review' | null;
    isNext?: boolean;
    isSubmit?: boolean;
    isPrev?: boolean;
    totalQuestions?: number | null;
  }) => 'submit' | 'next' | 'prev' | 'sync' | 'none';
  stashPacerSession: () => void;
  finishPacerSession: () => void;
  closePacerSummary: () => void;
  stopPacer: () => void;
  resetPacerAccumulatedTime: () => void;
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
      pacerTargetReviewSeconds: 150,
      pacerQBankMode: 'timed',
      pacerTutoredPhase: 'solve',
      pacerTriggerButton: 'next',
      pacerIsAdaptive: false,
      pacerCurrentQuestionTime: 0,
      pacerCurrentReviewTime: 0,
      pacerCompletedQuestionsTime: [],
      pacerCompletedReviewTimes: [],
      pacerSoundEnabled: true,
      pacerSoundSettings: {
        master: true,
        solveAlarm: true,
        reviewAlarm: true,
        nextQuestion: true,
        submitQuestion: true,
        prevQuestion: true,
        cycleAlarm: true,
        keepAliveAudio: true,
        volume: 0.5,
      },
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
      
      showQuickLog: false,
      quickLogDefaultQuestions: 0,

      setTimerState: (state) => set({ timerState: state }),
      setPhase: (phase) => set({ phase }),
      setTimeLeft: (time) => set((state) => ({ 
        timeLeft: typeof time === 'function' ? time(state.timeLeft) : time 
      })),
      setStudyDuration: (duration) => set({ studyDuration: duration }),
      setRestDuration: (duration) => set({ restDuration: duration }),
      
      setShowQuickLog: (show, defaultQuestions = 0) => set({ showQuickLog: show, quickLogDefaultQuestions: defaultQuestions }),

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

      setPacerSoundSettings: (settings) => set((state) => {
        const nextSettings = { ...state.pacerSoundSettings, ...settings };
        return {
          pacerSoundSettings: nextSettings,
          pacerSoundEnabled: nextSettings.master,
        };
      }),

      togglePacerSoundSetting: (key) => set((state) => {
        const current = state.pacerSoundSettings[key];
        const nextSettings = { ...state.pacerSoundSettings, [key]: !current };
        if (key === 'master') {
          return {
            pacerSoundSettings: nextSettings,
            pacerSoundEnabled: !current,
          };
        }
        return { pacerSoundSettings: nextSettings };
      }),

      setPacerState: (updates) => set((state) => {
        const next = { ...state, ...updates };
        if (updates.pacerSoundEnabled !== undefined && updates.pacerSoundSettings === undefined) {
          next.pacerSoundSettings = {
            ...state.pacerSoundSettings,
            master: updates.pacerSoundEnabled,
          };
        }
        return next;
      }),
      
      tickPacer: (deltaSecs) => set((state) => {
        if (state.pacerQBankMode === 'tutored') {
          if (state.pacerTutoredPhase === 'solve') {
            return { pacerCurrentQuestionTime: state.pacerCurrentQuestionTime + deltaSecs };
          } else {
            return { pacerCurrentReviewTime: state.pacerCurrentReviewTime + deltaSecs };
          }
        }
        return { pacerCurrentQuestionTime: state.pacerCurrentQuestionTime + deltaSecs };
      }),

      submitPacerQuestion: () => set((state) => {
        if (state.pacerQBankMode === 'tutored' && state.pacerTutoredPhase === 'solve') {
          return {
            pacerTutoredPhase: 'review',
            pacerCurrentReviewTime: 0
          };
        }
        return {};
      }),

      nextPacerQuestion: () => set((state) => {
        if (state.pacerQBankMode === 'tutored') {
          const isReview = state.pacerTutoredPhase === 'review';
          return {
            pacerCompletedQuestionsTime: [...state.pacerCompletedQuestionsTime, state.pacerCurrentQuestionTime],
            pacerCompletedReviewTimes: [...state.pacerCompletedReviewTimes, isReview ? state.pacerCurrentReviewTime : 0],
            pacerCurrentQuestionTime: 0,
            pacerCurrentReviewTime: 0,
            pacerTutoredPhase: 'solve'
          };
        }
        return {
          pacerCompletedQuestionsTime: [...state.pacerCompletedQuestionsTime, state.pacerCurrentQuestionTime],
          pacerCurrentQuestionTime: 0
        };
      }),
      
      prevPacerQuestion: () => set((state) => {
        if (state.pacerCompletedQuestionsTime.length === 0) return {};
        const prevQuestions = [...state.pacerCompletedQuestionsTime];
        const prevReviews = [...state.pacerCompletedReviewTimes];
        const lastSolve = prevQuestions.pop() || 0;
        const lastReview = prevReviews.pop() || 0;
        return {
          pacerCompletedQuestionsTime: prevQuestions,
          pacerCompletedReviewTimes: prevReviews,
          pacerCurrentQuestionTime: lastSolve,
          pacerCurrentReviewTime: lastReview,
          pacerTutoredPhase: lastReview > 0 ? 'review' : 'solve'
        };
      }),

      syncPacerQuestion: (params) => {
        let actionType: 'submit' | 'next' | 'prev' | 'sync' | 'none' = 'none';
        set((state) => {
          const currentQ = state.pacerCompletedQuestionsTime.length + 1;
          const { targetQuestion, targetPhase, isNext, isSubmit, isPrev } = params;

          // 1. Ação explícita de SUBMIT na questão atual
          if (isSubmit || (targetPhase === 'review' && (targetQuestion === undefined || targetQuestion === null || targetQuestion === currentQ) && state.pacerTutoredPhase === 'solve')) {
            if (state.pacerQBankMode === 'tutored' && state.pacerTutoredPhase === 'solve') {
              actionType = 'submit';
              return {
                pacerTutoredPhase: 'review',
                pacerCurrentReviewTime: 0
              };
            }
          }

          // 2. Ação explícita de PREV ou targetQuestion menor por 1
          if (isPrev || (targetQuestion !== undefined && targetQuestion !== null && targetQuestion === currentQ - 1)) {
            if (state.pacerCompletedQuestionsTime.length > 0) {
              actionType = 'prev';
              const prevQuestions = [...state.pacerCompletedQuestionsTime];
              const prevReviews = [...state.pacerCompletedReviewTimes];
              const lastSolve = prevQuestions.pop() || 0;
              const lastReview = prevReviews.pop() || 0;

              const resolvedPhase: 'solve' | 'review' = targetPhase || (lastReview > 0 ? 'review' : 'solve');

              return {
                pacerCompletedQuestionsTime: prevQuestions,
                pacerCompletedReviewTimes: prevReviews,
                pacerCurrentQuestionTime: lastSolve,
                pacerCurrentReviewTime: lastReview,
                pacerTutoredPhase: resolvedPhase
              };
            }
            return {};
          }

          // 3. Ação explícita de NEXT ou targetQuestion maior por 1 (avanço normal)
          if (isNext || (targetQuestion !== undefined && targetQuestion !== null && targetQuestion === currentQ + 1)) {
            actionType = 'next';
            if (state.pacerQBankMode === 'tutored') {
              const isReviewed = state.pacerTutoredPhase === 'review';
              return {
                pacerCompletedQuestionsTime: [...state.pacerCompletedQuestionsTime, state.pacerCurrentQuestionTime],
                pacerCompletedReviewTimes: [...state.pacerCompletedReviewTimes, isReviewed ? state.pacerCurrentReviewTime : 0],
                pacerCurrentQuestionTime: 0,
                pacerCurrentReviewTime: 0,
                pacerTutoredPhase: targetPhase || 'solve'
              };
            }
            return {
              pacerCompletedQuestionsTime: [...state.pacerCompletedQuestionsTime, state.pacerCurrentQuestionTime],
              pacerCurrentQuestionTime: 0
            };
          }

          // 4. Salto arbitrário de questão (ex: via lista/grid de questões do Q-Bank)
          if (targetQuestion !== undefined && targetQuestion !== null && targetQuestion > 0) {
            if (targetQuestion > currentQ) {
              actionType = 'next';
              const isReviewed = state.pacerTutoredPhase === 'review';
              const completedQ = [...state.pacerCompletedQuestionsTime, state.pacerCurrentQuestionTime];
              const completedR = [...state.pacerCompletedReviewTimes, isReviewed ? state.pacerCurrentReviewTime : 0];
              
              // Questões puladas sem resolução
              const skippedCount = targetQuestion - (currentQ + 1);
              for (let i = 0; i < skippedCount; i++) {
                completedQ.push(0);
                completedR.push(0);
              }

              return {
                pacerCompletedQuestionsTime: completedQ,
                pacerCompletedReviewTimes: completedR,
                pacerCurrentQuestionTime: 0,
                pacerCurrentReviewTime: 0,
                pacerTutoredPhase: targetPhase || 'solve'
              };
            } else if (targetQuestion < currentQ) {
              actionType = 'prev';
              const targetIndex = targetQuestion - 1;
              const prevQuestions = state.pacerCompletedQuestionsTime.slice(0, targetIndex);
              const prevReviews = state.pacerCompletedReviewTimes.slice(0, targetIndex);
              const lastSolve = state.pacerCompletedQuestionsTime[targetIndex] || 0;
              const lastReview = state.pacerCompletedReviewTimes[targetIndex] || 0;

              const resolvedPhase: 'solve' | 'review' = targetPhase || (lastReview > 0 ? 'review' : 'solve');

              return {
                pacerCompletedQuestionsTime: prevQuestions,
                pacerCompletedReviewTimes: prevReviews,
                pacerCurrentQuestionTime: lastSolve,
                pacerCurrentReviewTime: lastReview,
                pacerTutoredPhase: resolvedPhase
              };
            } else if (targetQuestion === currentQ) {
              // Mesma questão, mas a fase mudou (ex: explicação apareceu no DOM)
              if (targetPhase && targetPhase !== state.pacerTutoredPhase) {
                actionType = targetPhase === 'review' ? 'submit' : 'sync';
                return {
                  pacerTutoredPhase: targetPhase,
                  pacerCurrentReviewTime: targetPhase === 'review' ? (state.pacerCurrentReviewTime || 0) : 0
                };
              }
            }
          }

          return {};
        });
        return actionType;
      },

      stashPacerSession: () => set((state) => {
        const time = state.pacerCompletedQuestionsTime.reduce((a,b)=>a+b, 0) + state.pacerCurrentQuestionTime
          + state.pacerCompletedReviewTimes.reduce((a,b)=>a+b, 0) + state.pacerCurrentReviewTime;
        const qs = state.pacerCompletedQuestionsTime.length + 1;
        return {
          adaptivePacerSessions: [...state.adaptivePacerSessions, { time, questions: qs }],
          pacerCompletedQuestionsTime: [],
          pacerCompletedReviewTimes: [],
          pacerCurrentQuestionTime: 0,
          pacerCurrentReviewTime: 0,
          pacerTutoredPhase: 'solve'
        };
      }),

      finishPacerSession: () => set({
        pacerIsActive: false,
        pacerShowSummary: true
      }),

      closePacerSummary: () => set({
        pacerShowSummary: false,
        pacerCurrentQuestionTime: 0,
        pacerCurrentReviewTime: 0,
        pacerCompletedQuestionsTime: [],
        pacerCompletedReviewTimes: [],
        pacerTutoredPhase: 'solve',
        adaptivePacerSessions: []
      }),

      stopPacer: () => set((state) => ({
        pacerIsActive: false,
        pacerShowSummary: false,
        pacerCurrentQuestionTime: 0,
        pacerCurrentReviewTime: 0,
        pacerCompletedQuestionsTime: [],
        pacerCompletedReviewTimes: [],
        pacerTutoredPhase: 'solve',
        adaptivePacerSessions: [],
        isAdaptiveMode: false,
        timerState: 'idle',
        phase: 'study',
        timeLeft: state.studyDuration,
        isUnscheduledRest: false,
        unscheduledRestStoredTimeLeft: 0
      })),

      resetPacerAccumulatedTime: () => set((state) => {
        if (state.pacerQBankMode === 'tutored') {
          return {
            pacerCompletedQuestionsTime: state.pacerCompletedQuestionsTime.map(() => state.pacerTargetTimeSeconds),
            pacerCompletedReviewTimes: state.pacerCompletedReviewTimes.map(() => state.pacerTargetReviewSeconds),
            pacerCurrentQuestionTime: 0,
            pacerCurrentReviewTime: 0
          };
        }
        return {
          pacerCompletedQuestionsTime: state.pacerCompletedQuestionsTime.map(() => state.pacerTargetTimeSeconds),
          pacerCurrentQuestionTime: 0
        };
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
        pacerTargetReviewSeconds: state.pacerTargetReviewSeconds,
        pacerQBankMode: state.pacerQBankMode,
        pacerTriggerButton: state.pacerTriggerButton,
        pacerIsAdaptive: state.pacerIsAdaptive,
        pacerSoundEnabled: state.pacerSoundEnabled,
        pacerSoundSettings: state.pacerSoundSettings
      }),
    }
  )
);
