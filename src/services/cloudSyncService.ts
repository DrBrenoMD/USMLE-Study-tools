import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useStore } from '../cardblocks/store/useStore';
import { useTimerStore } from '../store/useTimerStore';

export interface SyncResult {
  success: boolean;
  timestamp: Date;
  error?: string;
  itemsSynced?: {
    flashcards: number;
    notebooks: number;
    questions: number;
    studyLogs: number;
    scores: number;
  };
}

export const cloudSyncService = {
  /**
   * Coleta todos os dados locais atuais do aplicativo em formato JSON serializável.
   */
  gatherLocalData() {
    // 1. Flashcards, Cadernos, Questões e Configurações (CardBlocks)
    const cardStore = useStore.getState();
    const cardblocksData = {
      decks: cardStore.decks || [],
      cards: cardStore.cards || [],
      reviewHistory: cardStore.reviewHistory || [],
      reviewLog: cardStore.reviewLog || [],
      questions: cardStore.questions || [],
      questionBanks: cardStore.questionBanks || [],
      notebooks: cardStore.notebooks || [],
      notebookHistory: cardStore.notebookHistory || [],
      notes: cardStore.notes || [],
      settings: cardStore.settings || {},
    };

    // 2. Study Tracker (Planejamento, matérias, datas e logs diários)
    const studyTrackerData = {
      mode: localStorage.getItem('usmle_mode_v4') || 'by_date',
      examDate: localStorage.getItem('usmle_examDate_v4') || '',
      bufferDays: localStorage.getItem('usmle_bufferDays_v4') || '14',
      daysOff: localStorage.getItem('usmle_daysOff_v4') || '[0]',
      specificDaysOff: localStorage.getItem('usmle_specificDaysOff_v4') || '[]',
      customDateMarks: localStorage.getItem('usmle_customDateMarks_v4') || '{}',
      resources: localStorage.getItem('usmle_resources_v4') || '[]',
      studyLogs: localStorage.getItem('usmle_study_logs_v4') || '[]',
    };

    // 3. Métricas de estudo e Pacer
    const timerStore = useTimerStore.getState();
    const timerMetricsData = {
      studyDuration: timerStore.studyDuration,
      restDuration: timerStore.restDuration,
      dailyNetTime: timerStore.dailyNetTime || {},
      pacerTotalQuestions: timerStore.pacerTotalQuestions,
      pacerTargetTimeSeconds: timerStore.pacerTargetTimeSeconds,
      pacerTargetReviewSeconds: timerStore.pacerTargetReviewSeconds,
      pacerQBankMode: timerStore.pacerQBankMode,
      pacerTriggerButton: timerStore.pacerTriggerButton,
      pacerIsAdaptive: timerStore.pacerIsAdaptive,
      pacerSoundEnabled: timerStore.pacerSoundEnabled,
      pacerSoundSettings: timerStore.pacerSoundSettings,
    };

    // 4. Scores e Simulados
    const scoresData = {
      scores: localStorage.getItem('usmle_scores_v1') || '[]',
    };

    // 5. Preferências gerais (tema)
    const preferencesData = {
      themeId: localStorage.getItem('app-theme-id') || 'dark-default',
    };

    return {
      cardblocks: cardblocksData,
      study_tracker: studyTrackerData,
      timer_metrics: timerMetricsData,
      scores: scoresData,
      preferences: preferencesData,
    };
  },

  /**
   * Salva todos os dados na nuvem (Firestore) para o usuário autenticado.
   */
  async uploadAllToCloud(userId: string): Promise<SyncResult> {
    const data = this.gatherLocalData();
    const nowIso = new Date().toISOString();

    const dataTypes: Array<string & keyof typeof data> = [
      'cardblocks',
      'study_tracker',
      'timer_metrics',
      'scores',
      'preferences',
    ];

    try {
      for (const dataType of dataTypes) {
        const payloadStr = JSON.stringify(data[dataType]);
        const docRef = doc(db, 'users', userId, 'data', dataType);
        
        await setDoc(docRef, {
          userId,
          dataType,
          payload: payloadStr,
          updatedAt: nowIso,
        });
      }

      // Contagem para relatório amigável
      let logsCount = 0;
      try {
        logsCount = JSON.parse(data.study_tracker.studyLogs).length;
      } catch { /* empty */ }

      let scoresCount = 0;
      try {
        scoresCount = JSON.parse(data.scores.scores).length;
      } catch { /* empty */ }

      return {
        success: true,
        timestamp: new Date(),
        itemsSynced: {
          flashcards: data.cardblocks.cards.length,
          notebooks: data.cardblocks.notebooks.length,
          questions: data.cardblocks.questions.length,
          studyLogs: logsCount,
          scores: scoresCount,
        }
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}/data`);
    }
  },

  /**
   * Baixa e restaura todos os dados salvos na nuvem para a sessão local.
   */
  async downloadAndApplyFromCloud(userId: string): Promise<boolean> {
    try {
      const dataColRef = collection(db, 'users', userId, 'data');
      const snapshot = await getDocs(dataColRef);

      if (snapshot.empty) {
        return false;
      }

      const cloudMap: Record<string, string> = {};
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (d && d.payload) {
          cloudMap[docSnap.id] = d.payload;
        }
      });

      // 1. Restaurar Flashcards, Cadernos e Questões
      if (cloudMap['cardblocks']) {
        try {
          const parsed = JSON.parse(cloudMap['cardblocks']);
          useStore.getState().importProfile(parsed);
        } catch (e) {
          console.error("Erro ao aplicar cardblocks da nuvem", e);
        }
      }

      // 2. Restaurar Study Tracker
      if (cloudMap['study_tracker']) {
        try {
          const tracker = JSON.parse(cloudMap['study_tracker']);
          if (tracker.mode) localStorage.setItem('usmle_mode_v4', tracker.mode);
          if (tracker.examDate !== undefined) localStorage.setItem('usmle_examDate_v4', tracker.examDate);
          if (tracker.bufferDays !== undefined) localStorage.setItem('usmle_bufferDays_v4', tracker.bufferDays);
          if (tracker.daysOff) localStorage.setItem('usmle_daysOff_v4', tracker.daysOff);
          if (tracker.specificDaysOff) localStorage.setItem('usmle_specificDaysOff_v4', tracker.specificDaysOff);
          if (tracker.customDateMarks) localStorage.setItem('usmle_customDateMarks_v4', tracker.customDateMarks);
          if (tracker.resources) localStorage.setItem('usmle_resources_v4', tracker.resources);
          if (tracker.studyLogs) localStorage.setItem('usmle_study_logs_v4', tracker.studyLogs);

          // Disparar evento para componentes ouvintes atualizarem
          window.dispatchEvent(new Event('usmle_logs_updated'));
          window.dispatchEvent(new Event('usmle_tracker_updated'));
        } catch (e) {
          console.error("Erro ao aplicar study_tracker da nuvem", e);
        }
      }

      // 3. Restaurar Métricas e Pacer
      if (cloudMap['timer_metrics']) {
        try {
          const metrics = JSON.parse(cloudMap['timer_metrics']);
          useTimerStore.setState(prev => ({
            ...prev,
            dailyNetTime: metrics.dailyNetTime || prev.dailyNetTime,
            studyDuration: metrics.studyDuration ?? prev.studyDuration,
            restDuration: metrics.restDuration ?? prev.restDuration,
            pacerTotalQuestions: metrics.pacerTotalQuestions ?? prev.pacerTotalQuestions,
            pacerTargetTimeSeconds: metrics.pacerTargetTimeSeconds ?? prev.pacerTargetTimeSeconds,
            pacerTargetReviewSeconds: metrics.pacerTargetReviewSeconds ?? prev.pacerTargetReviewSeconds,
            pacerQBankMode: metrics.pacerQBankMode ?? prev.pacerQBankMode,
            pacerTriggerButton: metrics.pacerTriggerButton ?? prev.pacerTriggerButton,
            pacerIsAdaptive: metrics.pacerIsAdaptive ?? prev.pacerIsAdaptive,
            pacerSoundEnabled: metrics.pacerSoundEnabled ?? prev.pacerSoundEnabled,
            pacerSoundSettings: metrics.pacerSoundSettings ?? prev.pacerSoundSettings,
          }));
        } catch (e) {
          console.error("Erro ao aplicar timer_metrics da nuvem", e);
        }
      }

      // 4. Restaurar Scores
      if (cloudMap['scores']) {
        try {
          const scoresObj = JSON.parse(cloudMap['scores']);
          if (scoresObj.scores) {
            localStorage.setItem('usmle_scores_v1', scoresObj.scores);
            window.dispatchEvent(new Event('usmle_scores_updated'));
          }
        } catch (e) {
          console.error("Erro ao aplicar scores da nuvem", e);
        }
      }

      // 5. Restaurar Preferências
      if (cloudMap['preferences']) {
        try {
          const pref = JSON.parse(cloudMap['preferences']);
          if (pref.themeId) {
            localStorage.setItem('app-theme-id', pref.themeId);
            window.dispatchEvent(new Event('app_theme_updated'));
          }
        } catch (e) {
          console.error("Erro ao aplicar preferências da nuvem", e);
        }
      }

      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/data`);
    }
  },

  /**
   * Verifica se o usuário já possui algum dado salvo na nuvem.
   */
  async hasCloudData(userId: string): Promise<boolean> {
    try {
      const docRef = doc(db, 'users', userId, 'data', 'cardblocks');
      const snap = await getDoc(docRef);
      return snap.exists();
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/data/cardblocks`);
    }
  },
};
