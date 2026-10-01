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
    const allDecks = cardStore.decks || [];
    const allCards = cardStore.cards || [];

    // Helper to determine if a deck (or any of its parents) is marked as offline-only
    const isDeckOffline = (deck: any): boolean => {
      if (!deck) return false;
      if (deck.isOffline) return true;
      if (deck.parentId) {
        const parent = allDecks.find(d => d.id === deck.parentId);
        if (parent) return isDeckOffline(parent);
      }
      return false;
    };

    const offlineDeckIds = new Set(allDecks.filter(d => isDeckOffline(d)).map(d => d.id));

    // Exclude offline-only decks and their cards from cloud backup payload to avoid bloating Firestore
    const onlineDecks = allDecks.filter(d => !offlineDeckIds.has(d.id));
    const onlineCards = allCards.filter(c => !offlineDeckIds.has(c.deckId));

    const cardblocksData = {
      decks: onlineDecks,
      cards: onlineCards,
      reviewHistory: cardStore.reviewHistory || [],
      reviewLog: cardStore.reviewLog || [],
      questions: cardStore.questions || [],
      questionBanks: cardStore.questionBanks || [],
      notebooks: cardStore.notebooks || [],
      notebookHistory: cardStore.notebookHistory || [],
      notes: cardStore.notes || [],
      studyNotebooks: cardStore.studyNotebooks || [],
      notebookAreas: cardStore.notebookAreas || [],
      notebookSystems: cardStore.notebookSystems || [],
      notebookSubjects: cardStore.notebookSubjects || [],
      notebookTopics: cardStore.notebookTopics || [],
      studyNotes: cardStore.studyNotes || [],
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

    try {
      // 1. Salvar CardBlocks com chunking inteligente para suportar milhares de cards no Firestore (limite de 1MB por doc)
      const allCards = data.cardblocks.cards || [];
      const CHUNK_SIZE = 120; // 120 cards por documento para garantir que fique bem abaixo de 500KB
      const cardChunks: any[][] = [];
      for (let i = 0; i < allCards.length; i += CHUNK_SIZE) {
        cardChunks.push(allCards.slice(i, i + CHUNK_SIZE));
      }

      // Salva chunks de cards
      for (let cIdx = 0; cIdx < cardChunks.length; cIdx++) {
        const chunkDocRef = doc(db, 'users', userId, 'data', `cardblocks_cards_${cIdx}`);
        await setDoc(chunkDocRef, {
          userId,
          dataType: `cardblocks_cards_${cIdx}`,
          chunkIndex: cIdx,
          cards: cardChunks[cIdx],
          updatedAt: nowIso,
        });
      }

      // Salva metadados e outros elementos do CardBlocks
      const cardblocksMeta = {
        decks: data.cardblocks.decks || [],
        cardsCount: allCards.length,
        chunksCount: cardChunks.length,
        // Se houver poucos cards, armazena inline como fallback
        cardsInline: allCards.length <= 40 ? allCards : [],
        reviewHistory: (data.cardblocks.reviewHistory || []).slice(0, 500),
        reviewLog: (data.cardblocks.reviewLog || []).slice(0, 500),
        questions: data.cardblocks.questions || [],
        questionBanks: data.cardblocks.questionBanks || [],
        notebooks: data.cardblocks.notebooks || [],
        notebookHistory: data.cardblocks.notebookHistory || [],
        notes: data.cardblocks.notes || [],
        studyNotebooks: data.cardblocks.studyNotebooks || [],
        notebookAreas: data.cardblocks.notebookAreas || [],
        notebookSystems: data.cardblocks.notebookSystems || [],
        notebookSubjects: data.cardblocks.notebookSubjects || [],
        notebookTopics: data.cardblocks.notebookTopics || [],
        studyNotes: data.cardblocks.studyNotes || [],
        settings: data.cardblocks.settings || {},
      };

      const cardblocksMetaDoc = doc(db, 'users', userId, 'data', 'cardblocks');
      await setDoc(cardblocksMetaDoc, {
        userId,
        dataType: 'cardblocks',
        payload: JSON.stringify(cardblocksMeta),
        chunksCount: cardChunks.length,
        totalCards: allCards.length,
        updatedAt: nowIso,
      });

      // 2. Salvar outros módulos (Study Tracker, Timer Metrics, Scores, Preferences)
      const otherDataTypes = [
        'study_tracker',
        'timer_metrics',
        'scores',
        'preferences',
      ] as const;

      for (const dataType of otherDataTypes) {
        try {
          const payloadStr = JSON.stringify(data[dataType]);
          const docRef = doc(db, 'users', userId, 'data', dataType);
          await setDoc(docRef, {
            userId,
            dataType,
            payload: payloadStr,
            updatedAt: nowIso,
          });
        } catch (itemErr: any) {
          console.warn(`Failed to sync data type ${dataType}:`, itemErr);
        }
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
          flashcards: allCards.length,
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
   * Baixa e restaura todos os dados salvos na nuvem para a sessão local usando merge seguro.
   */
  async downloadAndApplyFromCloud(userId: string): Promise<boolean> {
    try {
      const dataColRef = collection(db, 'users', userId, 'data');
      const snapshot = await getDocs(dataColRef);

      if (snapshot.empty) {
        return false;
      }

      const cloudMap: Record<string, any> = {};
      const cardChunksMap: Map<number, any[]> = new Map();

      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (!d) return;

        if (docSnap.id.startsWith('cardblocks_cards_')) {
          const idx = d.chunkIndex ?? parseInt(docSnap.id.replace('cardblocks_cards_', ''), 10);
          if (Array.isArray(d.cards)) {
            cardChunksMap.set(idx, d.cards);
          }
        } else if (d.payload) {
          cloudMap[docSnap.id] = d.payload;
        }
      });

      // 1. Restaurar Flashcards, Cadernos e Questões via Merge Seguro
      if (cloudMap['cardblocks']) {
        try {
          const meta = JSON.parse(cloudMap['cardblocks']);
          let assembledCards: any[] = [];

          if (cardChunksMap.size > 0) {
            const sortedIndices = Array.from(cardChunksMap.keys()).sort((a, b) => a - b);
            for (const idx of sortedIndices) {
              const chunk = cardChunksMap.get(idx) || [];
              assembledCards.push(...chunk);
            }
          } else if (Array.isArray(meta.cardsInline) && meta.cardsInline.length > 0) {
            assembledCards = meta.cardsInline;
          } else if (Array.isArray(meta.cards)) {
            assembledCards = meta.cards;
          }

          const cloudCardblocksData = {
            ...meta,
            cards: assembledCards,
          };

          // Usa mergeProfile para preservar dados e cards locais recém-importados
          useStore.getState().mergeProfile(cloudCardblocksData);
        } catch (e) {
          console.error("Erro ao aplicar cardblocks da nuvem", e);
        }
      }

      // 2. Restaurar Study Tracker com Smart Merge (Preserva todos os dados locais offline)
      if (cloudMap['study_tracker']) {
        try {
          const tracker = JSON.parse(cloudMap['study_tracker']);

          // A. Merge de Study Logs (Estatísticas e registros diários de questões e páginas)
          if (tracker.studyLogs) {
            try {
              const cloudLogs = JSON.parse(tracker.studyLogs || '[]');
              const localLogs = JSON.parse(localStorage.getItem('usmle_study_logs_v4') || '[]');
              const logMap = new Map<string, any>();

              const getLogKey = (log: any): string => {
                if (log && log.id) return String(log.id);
                return `${log?.date || ''}_${log?.resourceId || log?.resource || ''}_${log?.pageStart || ''}_${log?.pageEnd || ''}_${log?.questionsDone || ''}`;
              };

              localLogs.forEach((l: any) => {
                if (l) logMap.set(getLogKey(l), l);
              });
              cloudLogs.forEach((l: any) => {
                if (l) {
                  const key = getLogKey(l);
                  if (!logMap.has(key)) {
                    logMap.set(key, l);
                  } else {
                    const localLog = logMap.get(key);
                    logMap.set(key, {
                      ...l,
                      ...localLog,
                      notes: localLog.notes || l.notes,
                      correctCount: localLog.correctCount ?? l.correctCount,
                      incorrectCount: localLog.incorrectCount ?? l.incorrectCount,
                      questionsDone: localLog.questionsDone ?? l.questionsDone,
                    });
                  }
                }
              });

              const mergedLogs = Array.from(logMap.values()).sort((a, b) => {
                const dateA = new Date(a.date || 0).getTime();
                const dateB = new Date(b.date || 0).getTime();
                return dateA - dateB;
              });

              localStorage.setItem('usmle_study_logs_v4', JSON.stringify(mergedLogs));
            } catch (err) {
              console.warn("Erro ao fazer merge de logs de estudo", err);
            }
          }

          // B. Merge de Recursos de Estudo
          if (tracker.resources) {
            try {
              const cloudResources = JSON.parse(tracker.resources || '[]');
              const localResources = JSON.parse(localStorage.getItem('usmle_resources_v4') || '[]');
              const resMap = new Map<string, any>();

              localResources.forEach((r: any) => {
                if (r && (r.id || r.name)) resMap.set(r.id || r.name, r);
              });
              cloudResources.forEach((r: any) => {
                if (r && (r.id || r.name)) {
                  const key = r.id || r.name;
                  if (!resMap.has(key)) {
                    resMap.set(key, r);
                  } else {
                    const localRes = resMap.get(key);
                    resMap.set(key, {
                      ...r,
                      ...localRes,
                      completedPages: Math.max(localRes.completedPages || 0, r.completedPages || 0),
                      totalPages: localRes.totalPages || r.totalPages,
                    });
                  }
                }
              });

              localStorage.setItem('usmle_resources_v4', JSON.stringify(Array.from(resMap.values())));
            } catch (err) {
              console.warn("Erro ao fazer merge de recursos", err);
            }
          }

          // C. Merge de Datas Especiais e Folgas
          if (tracker.customDateMarks) {
            try {
              const cloudMarks = JSON.parse(tracker.customDateMarks || '{}');
              const localMarks = JSON.parse(localStorage.getItem('usmle_customDateMarks_v4') || '{}');
              localStorage.setItem('usmle_customDateMarks_v4', JSON.stringify({ ...cloudMarks, ...localMarks }));
            } catch (e) {}
          }
          if (tracker.specificDaysOff) {
            try {
              const cloudDays = JSON.parse(tracker.specificDaysOff || '[]');
              const localDays = JSON.parse(localStorage.getItem('usmle_specificDaysOff_v4') || '[]');
              const mergedDays = Array.from(new Set([...localDays, ...cloudDays]));
              localStorage.setItem('usmle_specificDaysOff_v4', JSON.stringify(mergedDays));
            } catch (e) {}
          }

          // D. Configurações gerais (mantém locais se já existirem)
          if (tracker.mode && !localStorage.getItem('usmle_mode_v4')) localStorage.setItem('usmle_mode_v4', tracker.mode);
          if (tracker.examDate && !localStorage.getItem('usmle_examDate_v4')) localStorage.setItem('usmle_examDate_v4', tracker.examDate);
          if (tracker.bufferDays && !localStorage.getItem('usmle_bufferDays_v4')) localStorage.setItem('usmle_bufferDays_v4', tracker.bufferDays);
          if (tracker.daysOff && !localStorage.getItem('usmle_daysOff_v4')) localStorage.setItem('usmle_daysOff_v4', tracker.daysOff);

          // Disparar evento para componentes ouvintes atualizarem
          window.dispatchEvent(new Event('usmle_logs_updated'));
          window.dispatchEvent(new Event('usmle_tracker_updated'));
        } catch (e) {
          console.error("Erro ao aplicar study_tracker da nuvem", e);
        }
      }

      // 3. Restaurar Métricas e Pacer com Merge Seguro
      if (cloudMap['timer_metrics']) {
        try {
          const metrics = JSON.parse(cloudMap['timer_metrics']);
          useTimerStore.setState(prev => {
            const mergedDailyNetTime = { ...(metrics.dailyNetTime || {}) };
            if (prev.dailyNetTime) {
              Object.keys(prev.dailyNetTime).forEach(dayKey => {
                mergedDailyNetTime[dayKey] = Math.max(
                  mergedDailyNetTime[dayKey] || 0,
                  prev.dailyNetTime[dayKey] || 0
                );
              });
            }

            return {
              ...prev,
              dailyNetTime: mergedDailyNetTime,
              studyDuration: prev.studyDuration || metrics.studyDuration,
              restDuration: prev.restDuration || metrics.restDuration,
              pacerTotalQuestions: prev.pacerTotalQuestions || metrics.pacerTotalQuestions,
              pacerTargetTimeSeconds: prev.pacerTargetTimeSeconds || metrics.pacerTargetTimeSeconds,
              pacerTargetReviewSeconds: prev.pacerTargetReviewSeconds || metrics.pacerTargetReviewSeconds,
              pacerQBankMode: prev.pacerQBankMode || metrics.pacerQBankMode,
              pacerTriggerButton: prev.pacerTriggerButton || metrics.pacerTriggerButton,
              pacerIsAdaptive: prev.pacerIsAdaptive ?? metrics.pacerIsAdaptive,
              pacerSoundEnabled: prev.pacerSoundEnabled ?? metrics.pacerSoundEnabled,
              pacerSoundSettings: prev.pacerSoundSettings || metrics.pacerSoundSettings,
            };
          });
        } catch (e) {
          console.error("Erro ao aplicar timer_metrics da nuvem", e);
        }
      }

      // 4. Restaurar Scores via Smart Merge
      if (cloudMap['scores']) {
        try {
          const scoresObj = JSON.parse(cloudMap['scores']);
          if (scoresObj.scores) {
            const cloudScores = JSON.parse(scoresObj.scores || '[]');
            const localScores = JSON.parse(localStorage.getItem('usmle_scores_v1') || '[]');
            const scoreMap = new Map<string, any>();

            const getScoreKey = (s: any): string => {
              if (s && s.id) return String(s.id);
              return `${s?.date || ''}_${s?.examType || s?.name || ''}_${s?.score || s?.percentage || ''}`;
            };

            localScores.forEach((s: any) => {
              if (s) scoreMap.set(getScoreKey(s), s);
            });
            cloudScores.forEach((s: any) => {
              if (s) {
                const key = getScoreKey(s);
                if (!scoreMap.has(key)) {
                  scoreMap.set(key, s);
                }
              }
            });

            const mergedScores = Array.from(scoreMap.values()).sort((a, b) => {
              const dateA = new Date(a.date || 0).getTime();
              const dateB = new Date(b.date || 0).getTime();
              return dateB - dateA;
            });

            localStorage.setItem('usmle_scores_v1', JSON.stringify(mergedScores));
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
