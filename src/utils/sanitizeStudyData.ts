import { format } from 'date-fns';
import { useStore, Question } from '../cardblocks/store/useStore';

export interface SanitizeResult {
  fixedQuestionsCount: number;
  removedDuplicateAttempts: number;
  fixedLogsCount: number;
  originalLogAmount: number;
  correctedLogAmount: number;
}

/**
 * Sanitiza o estado de questões e logs do Heatmap/Estatísticas,
 * removendo tentativas duplicadas causadas por loops de sincronização da extensão
 * e garantindo que o número de questões registradas seja exatamente o número de questões únicas.
 */
export function sanitizeStudyData(): SanitizeResult {
  const state = useStore.getState();
  let fixedQuestionsCount = 0;
  let removedDuplicateAttempts = 0;

  // 1. Limpa tentativas duplicadas em cada questão
  const cleanQuestions: Question[] = state.questions.map(q => {
    if (!q.attempts || q.attempts.length <= 1) return q;

    const sorted = [...q.attempts].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const deduped: typeof q.attempts = [];

    sorted.forEach(att => {
      const prev = deduped[deduped.length - 1];
      if (!prev) {
        deduped.push(att);
        return;
      }

      const timeDiff = Math.abs((att.timestamp || 0) - (prev.timestamp || 0));
      const sameAnswer = att.selectedChoiceId === prev.selectedChoiceId && att.isCorrect === prev.isCorrect;

      // Se for a mesma resposta dentro de 15 minutos (ou mesmo timestamp), é duplicação de sincronização
      if (sameAnswer && timeDiff < 15 * 60 * 1000) {
        removedDuplicateAttempts++;
        deduped[deduped.length - 1] = {
          ...prev,
          resolutionTimeSeconds: Math.max(prev.resolutionTimeSeconds || 0, att.resolutionTimeSeconds || 0),
          reviewTimeSeconds: Math.max(prev.reviewTimeSeconds || 0, att.reviewTimeSeconds || 0),
          timestamp: Math.max(prev.timestamp || 0, att.timestamp || 0),
        };
      } else {
        deduped.push(att);
      }
    });

    if (deduped.length !== q.attempts.length) {
      fixedQuestionsCount++;
      return {
        ...q,
        attempts: deduped,
        resolutionTimeSeconds: deduped[deduped.length - 1]?.resolutionTimeSeconds || q.resolutionTimeSeconds,
        reviewTimeSeconds: deduped[deduped.length - 1]?.reviewTimeSeconds || q.reviewTimeSeconds,
      };
    }
    return q;
  });

  if (fixedQuestionsCount > 0) {
    useStore.setState({ questions: cleanQuestions });
  }

  // 2. Sanitiza sessões da Mesa de Estudos (studyDeskSessions)
  const cleanSessions = (state.studyDeskSessions || []).map(sess => {
    if (!sess.questionRecords || sess.questionRecords.length <= 1) return sess;

    const seenQids = new Set<string>();
    const dedupedRecords: typeof sess.questionRecords = [];

    // Prioriza o último registro de cada QID
    [...sess.questionRecords].reverse().forEach(rec => {
      const key = rec.qid || rec.questionId || '';
      if (!key || !seenQids.has(key)) {
        if (key) seenQids.add(key);
        dedupedRecords.unshift(rec);
      }
    });

    if (dedupedRecords.length !== sess.questionRecords.length) {
      const correctCount = dedupedRecords.filter(r => r.isCorrect).length;
      return {
        ...sess,
        completedQuestions: dedupedRecords.length,
        correctCount,
        incorrectCount: dedupedRecords.length - correctCount,
        questionRecords: dedupedRecords,
      };
    }
    return sess;
  });

  useStore.setState({ studyDeskSessions: cleanSessions });

  // 3. Sanitiza logs diários do Heatmap (usmle_study_logs_v4)
  let fixedLogsCount = 0;
  let originalLogAmount = 0;
  let correctedLogAmount = 0;

  try {
    const savedLogsStr = localStorage.getItem('usmle_study_logs_v4');
    if (savedLogsStr) {
      const logs: any[] = JSON.parse(savedLogsStr);
      let logsChanged = false;

      // Mapeia questões resolvidas reais por data
      const answeredByDate = new Map<string, { total: number; correct: number; qids: Set<string> }>();

      cleanQuestions.forEach(q => {
        if (!q.status || q.status === 'unused') return;
        const dStr = q.lastAnsweredAt ? format(new Date(q.lastAnsweredAt), 'yyyy-MM-dd') : null;
        if (!dStr) return;

        if (!answeredByDate.has(dStr)) {
          answeredByDate.set(dStr, { total: 0, correct: 0, qids: new Set() });
        }
        const data = answeredByDate.get(dStr)!;
        const qKey = (q.qid || q.id || '').trim();
        if (qKey && !data.qids.has(qKey)) {
          data.qids.add(qKey);
          data.total += 1;
          if (q.status === 'correct') data.correct += 1;
        }
      });

      // Mapeamento e desduplicação de logs redundantes e reparo de scorePercent zerado indevidamente
      const seenLogSignatures = new Set<string>();
      const dedupedLogs: any[] = [];

      logs.forEach(l => {
        if (!l.id || !l.date) return;

        // Repara scorePercent zerado se houver questões correspondentes com acertos registrados
        const dayData = answeredByDate.get(l.date);
        if (dayData && dayData.total > 0 && dayData.correct > 0 && (l.scorePercent === 0 || l.scorePercent === undefined)) {
          const realScorePercent = Math.round((dayData.correct / dayData.total) * 100);
          if (realScorePercent > 0) {
            l.scorePercent = realScorePercent;
            logsChanged = true;
            fixedLogsCount++;
          }
        }

        // Cria assinatura para identificar logs duplicados gerados por múltiplos eventos de finalização
        const sig = `${l.date}|${l.resourceId || l.resourceName}|${l.amount}|${l.scorePercent || 'none'}|${l.minutesSpent || 0}`;
        if (seenLogSignatures.has(sig) && l.notes && l.notes.includes('Registro Rápido')) {
          logsChanged = true;
          fixedLogsCount++;
          originalLogAmount += Number(l.amount) || 0;
          return;
        }

        seenLogSignatures.add(sig);
        dedupedLogs.push(l);
      });

      const updatedLogs = dedupedLogs;

      if (logsChanged) {
        localStorage.setItem('usmle_study_logs_v4', JSON.stringify(updatedLogs));
        window.dispatchEvent(new Event('usmle_logs_updated'));
      }
    }
  } catch (err) {
    console.error('Erro ao sanitizar study logs:', err);
  }

  return {
    fixedQuestionsCount,
    removedDuplicateAttempts,
    fixedLogsCount,
    originalLogAmount,
    correctedLogAmount,
  };
}
