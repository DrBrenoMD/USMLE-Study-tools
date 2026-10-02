import React, { useMemo, useState } from 'react';
import { format, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { StudyLogEntry } from '../types';
import {
  ComposedChart,
  LineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  CheckSquare,
  Award,
  Clock,
  BookOpen,
  RotateCcw,
  Sparkles,
  ChevronDown,
  FolderTree,
  Filter,
  Wand2,
  Calendar,
  Layers,
  Building2,
  HelpCircle
} from 'lucide-react';
import { useStore, Question } from '../cardblocks/store/useStore';
import { cn } from '../lib/utils';
import { QuestionDrillDownModal } from './QuestionDrillDownModal';
import { GranularResetModal } from './GranularResetModal';
import { DateRecordsManagerModal } from './DateRecordsManagerModal';
import { sanitizeStudyData } from '../utils/sanitizeStudyData';

interface ScoreChartProps {
  logs: StudyLogEntry[];
}

const PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ef4444', // red
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#84cc16', // lime
  '#a855f7', // violet
];

export function ScoreChart({ logs }: ScoreChartProps) {
  // Configurações do Gráfico Geral
  const [daysToShow, setDaysToShow] = useState<number>(30);

  // Seletor de Banco de Questões: 'all' (Todos os Bancos / Unificado) | bankId
  const [selectedBankId, setSelectedBankId] = useState<string>('all');

  // Modo de tratamento de revisões:
  // 'original_date': 1 registro por questão na data original em que foi feita
  // 'latest_date': 1 registro por questão na data mais recente de resolução
  // 'all_attempts': volume total de todas as tentativas/revisões feitas
  const [reviewHandlingMode, setReviewHandlingMode] = useState<'original_date' | 'latest_date' | 'all_attempts'>('original_date');

  // Seletor de Modo na Seção de Gráficos: 'general' (Geral de Sessões) | 'subject' (Gráfico por Subject da Extensão)
  const [activeChartTab, setActiveChartTab] = useState<'general' | 'subject'>('general');

  // Filtro de Dias para o gráfico de Subject
  const [subjectDaysRange, setSubjectDaysRange] = useState<number>(30);

  // Legendas interativas do gráfico por Subject: Set de subjects desativados/ocultos
  const [hiddenSubjects, setHiddenSubjects] = useState<Set<string>>(new Set());
  const [showDailyAverageLine, setShowDailyAverageLine] = useState<boolean>(true);

  // Estado para Drill-down Modal
  const [drillDownData, setDrillDownData] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    dateStr?: string;
    questions: Question[];
  }>({
    isOpen: false,
    title: '',
    questions: []
  });

  // Estado para Modal de Gerenciamento de Registros por Data
  const [isDateManagerOpen, setIsDateManagerOpen] = useState(false);
  const [dateForManager, setDateForManager] = useState<string | undefined>(undefined);

  // Estado para Modal de Reset Granular
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetToast, setResetToast] = useState<string | null>(null);

  // Busca store
  const {
    questions,
    questionBanks,
    studyDeskSessions,
    resetBankStats,
    resetExtensionStats,
    resetSubjectStats,
    resetSystemStats,
    upsertQuestionFromQBank,
    recordDeskQuestionAnswer
  } = useStore();

  // Lista de bancos de questões disponíveis (com dados ou cadastrados)
  const availableBanksList = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();

    // 1. Bancos cadastrados no store
    (questionBanks || []).forEach(b => {
      map.set(b.id, { id: b.id, name: b.name });
    });

    // 2. Bancos detectados nas questões
    questions.forEach(q => {
      if (q.bankId && !map.has(q.bankId)) {
        map.set(q.bankId, { id: q.bankId, name: q.bankId });
      }
    });

    // Se nenhum banco cadastrado, adiciona bancos padrão populares
    if (map.size === 0) {
      map.set('uworld', { id: 'uworld', name: 'UWorld Step 1' });
      map.set('amboss', { id: 'amboss', name: 'Amboss' });
      map.set('usmle_rx', { id: 'usmle_rx', name: 'USMLE-Rx' });
    }

    return Array.from(map.values());
  }, [questionBanks, questions]);

  // Helper para identificar questões que vieram da extensão do navegador
  const isExtensionQuestion = (q: Question): boolean => {
    return Boolean(
      q.isFromExtension === true ||
      q.source === 'extension' ||
      (q.tags && q.tags.some(t => {
        const lower = t.toLowerCase();
        return lower.includes('extensao') || lower.includes('extension') || lower.startsWith('qid:');
      }))
    );
  };

  // Helper universal para testar se uma questão pertence ao banco selecionado
  const matchesBank = (q: Question): boolean => {
    if (selectedBankId === 'all') return true;
    const target = selectedBankId.trim().toLowerCase();
    const qb = (q.bankId || '').trim().toLowerCase();
    if (qb && (qb === target || qb.includes(target) || target.includes(qb))) return true;

    const bankObj = questionBanks.find(b => b.id.toLowerCase() === target || b.name.toLowerCase() === target);
    if (bankObj) {
      if (qb === bankObj.id.toLowerCase() || qb === bankObj.name.toLowerCase()) return true;
      if (q.tags?.some(t => t.toLowerCase().includes(bankObj.name.toLowerCase()) || t.toLowerCase().includes(bankObj.id.toLowerCase()))) return true;
    }
    if (q.tags?.some(t => t.toLowerCase() === target || t.toLowerCase().includes(target))) return true;
    if (q.source && q.source.toLowerCase().includes(target)) return true;
    return false;
  };

  // Helper universal para testar se um StudyLogEntry pertence ao banco selecionado
  const matchesBankLog = (log: StudyLogEntry): boolean => {
    if (selectedBankId === 'all') return true;
    const target = selectedBankId.trim().toLowerCase();
    const rId = (log.resourceId || '').trim().toLowerCase();
    const rName = (log.resourceName || '').trim().toLowerCase();

    if (rId === target || rName === target || rName.includes(target) || target.includes(rName)) return true;
    const bankObj = questionBanks.find(b => b.id.toLowerCase() === target || b.name.toLowerCase() === target);
    if (bankObj) {
      const bId = bankObj.id.toLowerCase();
      const bName = bankObj.name.toLowerCase();
      if (rId === bId || rName.includes(bName) || bName.includes(rName)) return true;
    }
    return false;
  };

  // Helper universal de determinação de acerto da questão
  const isQuestionCorrect = (q: Question, att?: any): boolean => {
    if (att && typeof att.isCorrect === 'boolean') return att.isCorrect;
    if (att && (att.isCorrect === 'true' || att.isCorrect === 1 || att.isCorrect === '1' || att.isCorrect === 'correct')) return true;
    if (typeof q.status === 'string') {
      const s = q.status.toLowerCase().trim();
      if (s === 'correct' || s === 'right' || s === 'acertou' || s === 'correta') return true;
      if (s === 'incorrect' || s === 'wrong' || s === 'errou' || s === 'incorreta') return false;
    }
    if ((q as any).isCorrect === true || (q as any).isCorrect === 'true' || (q as any).isCorrect === 1 || (q as any).isCorrect === '1' || (q as any).isCorrect === 'correct') return true;
    if ((q as any).result === 'correct' || (q as any).userResult === 'correct' || (q as any).correct === true) return true;
    if (q.selectedChoiceId && Array.isArray(q.alternatives) && q.alternatives.length > 0) {
      const selectedAlt = q.alternatives.find(a => 
        a.id === q.selectedChoiceId || 
        (a.letter && a.letter.toUpperCase() === q.selectedChoiceId?.toUpperCase()) ||
        (a.text && q.selectedChoiceId && a.text.trim().toLowerCase() === q.selectedChoiceId.trim().toLowerCase())
      );
      if (selectedAlt && selectedAlt.isCorrect) return true;
    }
    if (q.attempts && q.attempts.length > 0) {
      if (att) {
        return Boolean((att as any).isCorrect === true || (att as any).isCorrect === 'true' || (att as any).isCorrect === 1 || (att as any).isCorrect === '1' || (att as any).isCorrect === 'correct');
      }
      const last = q.attempts[q.attempts.length - 1];
      if (typeof last?.isCorrect === 'boolean') return last.isCorrect;
      return q.attempts.some(a => (a as any).isCorrect === true || (a as any).isCorrect === 'true' || (a as any).isCorrect === 1 || (a as any).isCorrect === '1' || (a as any).isCorrect === 'correct');
    }
    return false;
  };

  // 1. Processa dados do GRÁFICO GERAL (Com separação por banco ou unificado + Barras: % Acertos, Linha: Volume)
  const { generalChartData, generalSummaryStats, questionsByDateMap } = useMemo(() => {
    const byDate = new Map<
      string,
      {
        totalAmount: number;
        correctCount: number;
        scoredAmount: number;
        questionsList: Question[];
      }
    >();

    const getOrInitDate = (dStr: string) => {
      let existing = byDate.get(dStr);
      if (!existing) {
        existing = {
          totalAmount: 0,
          correctCount: 0,
          scoredAmount: 0,
          questionsList: []
        };
        byDate.set(dStr, existing);
      }
      return existing;
    };

    // Coleta questões individuais relevantes de acordo com o banco selecionado
    const relevantQuestions = questions.filter(matchesBank);

    // Mapeamento temporário de questões individuais por data
    const questionsByDay = new Map<string, { total: number; scored: number; correct: number; list: Question[] }>();

    const getOrInitQuestionsDay = (dStr: string) => {
      let existing = questionsByDay.get(dStr);
      if (!existing) {
        existing = { total: 0, scored: 0, correct: 0, list: [] };
        questionsByDay.set(dStr, existing);
      }
      return existing;
    };

    if (relevantQuestions.length > 0) {
      relevantQuestions.forEach((q) => {
        const hasAttempts = Array.isArray(q.attempts) && q.attempts.length > 0;
        const isAnswered = hasAttempts || (q.status && q.status !== 'unused') || Boolean(q.lastAnsweredAt) || (q as any).isCorrect !== undefined;

        if (!isAnswered) return;

        // Limpa tentativas duplicadas com timestamps idênticos ou com menos de 3s de diferença
        const cleanedAttempts = hasAttempts
          ? q.attempts!.filter((att, idx, arr) => {
              if (idx === 0) return true;
              return Math.abs((att.timestamp || 0) - (arr[idx - 1].timestamp || 0)) > 3000;
            })
          : [];

        if (reviewHandlingMode === 'original_date') {
          const firstAtt = cleanedAttempts.length > 0 ? cleanedAttempts[0] : null;
          const t = firstAtt?.timestamp || q.createdAt || q.lastAnsweredAt || Date.now();
          const dStr = format(new Date(t), 'yyyy-MM-dd');
          const entry = getOrInitQuestionsDay(dStr);

          if (!entry.list.some(item => item.id === q.id || (item.qid && item.qid === q.qid))) {
            const isCorr = isQuestionCorrect(q, firstAtt);
            entry.total += 1;
            entry.scored += 1;
            entry.correct += isCorr ? 1 : 0;
            entry.list.push(q);
          }
        } else if (reviewHandlingMode === 'latest_date') {
          const lastAtt = cleanedAttempts.length > 0 ? cleanedAttempts[cleanedAttempts.length - 1] : null;
          const t = lastAtt?.timestamp || q.lastAnsweredAt || q.updatedAt || q.createdAt || Date.now();
          const dStr = format(new Date(t), 'yyyy-MM-dd');
          const entry = getOrInitQuestionsDay(dStr);

          if (!entry.list.some(item => item.id === q.id || (item.qid && item.qid === q.qid))) {
            const isCorr = isQuestionCorrect(q, lastAtt);
            entry.total += 1;
            entry.scored += 1;
            entry.correct += isCorr ? 1 : 0;
            entry.list.push(q);
          }
        } else {
          if (cleanedAttempts.length > 0) {
            const dayAttMap = new Map<string, typeof cleanedAttempts[0]>();
            cleanedAttempts.forEach(att => {
              const t = att.timestamp || q.lastAnsweredAt || Date.now();
              const dStr = format(new Date(t), 'yyyy-MM-dd');
              dayAttMap.set(dStr, att);
            });

            dayAttMap.forEach((att, dStr) => {
              const entry = getOrInitQuestionsDay(dStr);
              const isCorr = Boolean(att.isCorrect);

              entry.total += 1;
              entry.scored += 1;
              entry.correct += isCorr ? 1 : 0;
              if (!entry.list.some(item => item.id === q.id || (item.qid && item.qid === q.qid))) {
                entry.list.push(q);
              }
            });
          } else {
            const t = q.lastAnsweredAt || q.createdAt || Date.now();
            const dStr = format(new Date(t), 'yyyy-MM-dd');
            const entry = getOrInitQuestionsDay(dStr);
            const isCorr = isQuestionCorrect(q);

            entry.total += 1;
            entry.scored += 1;
            entry.correct += isCorr ? 1 : 0;
            if (!entry.list.some(item => item.id === q.id || (item.qid && item.qid === q.qid))) {
              entry.list.push(q);
            }
          }
        }
      });
    }

    // Mapeamento de logs de estudo diários por data (somatório de todos os blocos/testes do dia)
    const logsByDay = new Map<string, { totalAmount: number; scoredAmount: number; correctCount: number }>();

    logs.forEach((log) => {
      if (!log.date) return;
      const isQBank = log.resourceType === 'qbank' || log.unit === 'questões' || log.unit === 'questoes';
      if (!isQBank) return;
      if (!matchesBankLog(log)) return;

      const amt = Number(log.amount) || 0;
      if (amt <= 0) return;

      let dayLog = logsByDay.get(log.date);
      if (!dayLog) {
        dayLog = { totalAmount: 0, scoredAmount: 0, correctCount: 0 };
        logsByDay.set(log.date, dayLog);
      }

      dayLog.totalAmount += amt;
      if (log.scorePercent !== undefined && log.scorePercent !== null) {
        const pct = Number(log.scorePercent) || 0;
        dayLog.scoredAmount += amt;
        dayLog.correctCount += Math.round((pct / 100) * amt);
      }
    });

    // Unifica datas de ambas as fontes (sem redundância e sem disparidade)
    const allKnownDates = new Set<string>([...questionsByDay.keys(), ...logsByDay.keys()]);

    allKnownDates.forEach((dStr) => {
      const qData = questionsByDay.get(dStr);
      const lData = logsByDay.get(dStr);
      const entry = getOrInitDate(dStr);

      const lTotal = lData ? lData.totalAmount : 0;
      const lScored = lData ? lData.scoredAmount : 0;
      const lCorrect = lData ? lData.correctCount : 0;

      const qTotal = qData ? qData.total : 0;
      const qScored = qData ? qData.scored : 0;
      const qCorrect = qData ? qData.correct : 0;

      if (qData && qData.list) {
        entry.questionsList = qData.list;
      }

      // O volume do dia é o total real consolidado dos blocos/testes ou o máximo das questões registradas
      if (lTotal > 0) {
        const consolidatedTotal = Math.max(lTotal, qTotal);
        entry.totalAmount = consolidatedTotal;

        // Se temos questões individuais com avaliação (qScored > 0) e elas trazem acertos ou o log está zerado
        if (qScored > 0 && (qCorrect > 0 || lScored === 0 || lCorrect === 0)) {
          const qAccuracyRatio = qCorrect / qScored;
          entry.scoredAmount = consolidatedTotal;
          entry.correctCount = Math.round(qAccuracyRatio * consolidatedTotal);
        } else if (lScored > 0) {
          // Utiliza a taxa média ponderada dos blocos de teste registrados no dia
          const logAccuracyRatio = lCorrect / lScored;
          entry.scoredAmount = consolidatedTotal;
          entry.correctCount = Math.round(logAccuracyRatio * consolidatedTotal);
        } else if (qScored > 0) {
          const qAccuracyRatio = qCorrect / qScored;
          entry.scoredAmount = consolidatedTotal;
          entry.correctCount = Math.round(qAccuracyRatio * consolidatedTotal);
        } else {
          entry.scoredAmount = 0;
          entry.correctCount = 0;
        }
      } else {
        // Sem logs de blocos: utiliza diretamente os registros das questões individuais
        entry.totalAmount = qTotal;
        entry.scoredAmount = qScored;
        entry.correctCount = qCorrect;
      }
    });

    const today = startOfDay(new Date());
    const startDate = subDays(today, Math.max(1, daysToShow - 1));
    const allDaysInInterval = eachDayOfInterval({ start: startDate, end: today });

    let cumulativeTotalQuestions = 0;
    let cumulativeScoredQuestions = 0;
    let cumulativeCorrectCount = 0;
    let activeDaysCount = 0;

    const rawDailyData = allDaysInInterval.map((dayDate) => {
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const dateFormatted = format(dayDate, 'dd/MM');
      const stats = byDate.get(dateStr);

      const hasQuestions = Boolean(stats && stats.totalAmount > 0);
      const questionsCount = stats ? stats.totalAmount : 0;

      let avgScore: number | null = null;
      if (stats && stats.scoredAmount > 0) {
        avgScore = Math.round((stats.correctCount / stats.scoredAmount) * 100);
      }

      if (hasQuestions) {
        activeDaysCount++;
        cumulativeTotalQuestions += questionsCount;
        if (stats && stats.scoredAmount > 0) {
          cumulativeScoredQuestions += stats.scoredAmount;
          cumulativeCorrectCount += stats.correctCount;
        }
      }

      return {
        date: dayDate,
        dateStr,
        dateFormatted,
        questions: questionsCount,
        score: avgScore,
        hasQuestions,
      };
    });

    const finalData = rawDailyData.map((d, index, arr) => {
      if (!d.hasQuestions || d.score === null) {
        return {
          ...d,
          trend: null,
        };
      }

      const recentActiveDays: Array<{ score: number; questions: number }> = [];
      for (let i = index; i >= 0 && recentActiveDays.length < 4; i--) {
        const prev = arr[i];
        if (prev.hasQuestions && prev.score !== null) {
          recentActiveDays.push({ score: prev.score, questions: Math.max(1, prev.questions) });
        }
      }

      const totalWeight = recentActiveDays.reduce((sum, item) => sum + item.questions, 0);
      const weightedSum = recentActiveDays.reduce((sum, item) => sum + item.score * item.questions, 0);
      const trendScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : d.score;

      return {
        ...d,
        trend: trendScore,
      };
    });

    const overallAvgScore =
      cumulativeScoredQuestions > 0
        ? Math.round((cumulativeCorrectCount / cumulativeScoredQuestions) * 100)
        : null;

    const avgQuestionsPerActiveDay =
      activeDaysCount > 0 ? Math.round(cumulativeTotalQuestions / activeDaysCount) : 0;

    const summary = {
      totalQuestions: cumulativeTotalQuestions,
      overallAvgScore,
      activeDaysCount,
      totalDays: allDaysInInterval.length,
      avgQuestionsPerActiveDay,
    };

    return {
      generalChartData: finalData,
      generalSummaryStats: summary,
      questionsByDateMap: byDate
    };
  }, [logs, questions, questionBanks, daysToShow, selectedBankId, reviewHandlingMode]);

  // 2. FONTE DE DADOS DA EXTENSÃO & BANCOS: Registros filtrados por banco e tratamento de revisões
  const extensionData = useMemo(() => {
    // Filtra questões do banco selecionado
    const extQuestions = questions.filter(q => matchesBank(q));

    // Mapeamento de registros de resolução das questões
    const records: Array<{
      qid: string;
      questionId?: string;
      questionObj: Question;
      isCorrect: boolean;
      subject: string;
      system: string;
      resolutionTimeSeconds: number;
      reviewTimeSeconds: number;
      answeredAt: number;
      dateStr: string;
    }> = [];

    extQuestions.forEach(q => {
      const subj = (q.subject || 'Geral').trim();
      const sys = (q.system || 'Sistema Geral').trim();
      const hasAttempts = Array.isArray(q.attempts) && q.attempts.length > 0;
      const cleanedAttempts = hasAttempts
        ? q.attempts!.filter((att, idx, arr) => {
            if (idx === 0) return true;
            return Math.abs((att.timestamp || 0) - (arr[idx - 1].timestamp || 0)) > 3000;
          })
        : [];

      if (cleanedAttempts.length > 0) {
        if (reviewHandlingMode === 'original_date') {
          const firstAtt = cleanedAttempts[0];
          const tDate = firstAtt?.timestamp ? new Date(firstAtt.timestamp) : new Date(q.createdAt || q.lastAnsweredAt || Date.now());
          const isCorr = isQuestionCorrect(q, firstAtt);

          records.push({
            qid: q.qid || q.id,
            questionId: q.id,
            questionObj: q,
            isCorrect: isCorr,
            subject: subj,
            system: sys,
            resolutionTimeSeconds: firstAtt?.resolutionTimeSeconds || q.resolutionTimeSeconds || 60,
            reviewTimeSeconds: firstAtt?.reviewTimeSeconds || q.reviewTimeSeconds || 100,
            answeredAt: tDate.getTime(),
            dateStr: format(tDate, 'yyyy-MM-dd')
          });
        } else if (reviewHandlingMode === 'latest_date') {
          const lastAtt = cleanedAttempts[cleanedAttempts.length - 1];
          const tDate = lastAtt?.timestamp ? new Date(lastAtt.timestamp) : new Date(q.lastAnsweredAt || q.updatedAt || Date.now());
          const isCorr = isQuestionCorrect(q, lastAtt);

          records.push({
            qid: q.qid || q.id,
            questionId: q.id,
            questionObj: q,
            isCorrect: isCorr,
            subject: subj,
            system: sys,
            resolutionTimeSeconds: lastAtt?.resolutionTimeSeconds || q.resolutionTimeSeconds || 60,
            reviewTimeSeconds: lastAtt?.reviewTimeSeconds || q.reviewTimeSeconds || 100,
            answeredAt: tDate.getTime(),
            dateStr: format(tDate, 'yyyy-MM-dd')
          });
        } else {
          // Agrupa por dia para não inflacionar tentativas redundantes
          const dayAttMap = new Map<string, typeof cleanedAttempts[0]>();
          cleanedAttempts.forEach(att => {
            const t = att.timestamp || q.lastAnsweredAt || Date.now();
            const dStr = format(new Date(t), 'yyyy-MM-dd');
            dayAttMap.set(dStr, att);
          });

          dayAttMap.forEach((att, dStr) => {
            const tDate = att.timestamp ? new Date(att.timestamp) : new Date(dStr);
            records.push({
              qid: q.qid || q.id,
              questionId: q.id,
              questionObj: q,
              isCorrect: Boolean(att.isCorrect),
              subject: subj,
              system: sys,
              resolutionTimeSeconds: att.resolutionTimeSeconds || q.resolutionTimeSeconds || 60,
              reviewTimeSeconds: att.reviewTimeSeconds || q.reviewTimeSeconds || 100,
              answeredAt: tDate.getTime(),
              dateStr: dStr
            });
          });
        }
      } else if (q.status && q.status !== 'unused') {
        const tDate = q.lastAnsweredAt ? new Date(q.lastAnsweredAt) : new Date(q.updatedAt || q.createdAt || Date.now());
        records.push({
          qid: q.qid || q.id,
          questionId: q.id,
          questionObj: q,
          isCorrect: isQuestionCorrect(q),
          subject: subj,
          system: sys,
          resolutionTimeSeconds: q.resolutionTimeSeconds || 60,
          reviewTimeSeconds: q.reviewTimeSeconds || 100,
          answeredAt: tDate.getTime(),
          dateStr: format(tDate, 'yyyy-MM-dd')
        });
      }
    });

    return {
      extensionQuestions: extQuestions,
      records
    };
  }, [questions, selectedBankId, reviewHandlingMode]);

  // Lista única de Subjects e Systems capturados
  const { allSubjectsList, allSystemsList } = useMemo(() => {
    const subjSet = new Set<string>();
    const sysSet = new Set<string>();

    extensionData.records.forEach(r => {
      if (r.subject) subjSet.add(r.subject);
      if (r.system) sysSet.add(r.system);
    });

    extensionData.extensionQuestions.forEach(q => {
      if (q.subject) subjSet.add(q.subject.trim());
      if (q.system) sysSet.add(q.system.trim());
    });

    return {
      allSubjectsList: Array.from(subjSet).sort(),
      allSystemsList: Array.from(sysSet).sort()
    };
  }, [extensionData]);

  // 3. Processamento do GRÁFICO - Desempenho por Subject pelo Tempo + LINHA DE MÉDIA PONDERADA DO DIA
  const { subjectTimeSeriesData, subjectColorsMap } = useMemo(() => {
    const today = startOfDay(new Date());
    const startDate = subDays(today, Math.max(1, subjectDaysRange - 1));
    const allDaysInInterval = eachDayOfInterval({ start: startDate, end: today });

    // Mapeamento de cores estáveis para cada Subject
    const colorsMap: Record<string, string> = {};
    allSubjectsList.forEach((sub, idx) => {
      colorsMap[sub] = PALETTE[idx % PALETTE.length];
    });

    // Agrupamento de registros por data e por subject
    const byDateAndSubj = new Map<string, Map<string, { total: number; correct: number }>>();

    extensionData.records.forEach(r => {
      const dStr = r.dateStr;
      if (!byDateAndSubj.has(dStr)) {
        byDateAndSubj.set(dStr, new Map());
      }
      const dayMap = byDateAndSubj.get(dStr)!;
      const current = dayMap.get(r.subject) || { total: 0, correct: 0 };
      current.total += 1;
      if (r.isCorrect) current.correct += 1;
      dayMap.set(r.subject, current);
    });

    const seriesData = allDaysInInterval.map(dayDate => {
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const dateFormatted = format(dayDate, 'dd/MM');
      const dayMap = byDateAndSubj.get(dateStr);

      const entry: Record<string, any> = {
        dateStr,
        dateFormatted,
      };

      let dayTotalQuestionsAcrossSubjects = 0;
      let dayTotalCorrectAcrossSubjects = 0;

      allSubjectsList.forEach(subj => {
        if (dayMap && dayMap.has(subj)) {
          const stats = dayMap.get(subj)!;
          const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null;
          entry[subj] = accuracy;
          entry[`${subj}_total`] = stats.total;
          entry[`${subj}_correct`] = stats.correct;

          dayTotalQuestionsAcrossSubjects += stats.total;
          dayTotalCorrectAcrossSubjects += stats.correct;
        } else {
          entry[subj] = null;
        }
      });

      // Média Ponderada Diária considerando o volume específico de cada subject naquele dia
      const dailyWeightedAverage = dayTotalQuestionsAcrossSubjects > 0
        ? Math.round((dayTotalCorrectAcrossSubjects / dayTotalQuestionsAcrossSubjects) * 100)
        : null;

      entry['__daily_avg__'] = dailyWeightedAverage;
      entry['__daily_total__'] = dayTotalQuestionsAcrossSubjects;
      entry['__daily_correct__'] = dayTotalCorrectAcrossSubjects;

      return entry;
    });

    return {
      subjectTimeSeriesData: seriesData,
      subjectColorsMap: colorsMap
    };
  }, [allSubjectsList, extensionData, subjectDaysRange]);

  // 4. Processamento da SEÇÃO - System vs Subject
  const systemVsSubjectData = useMemo(() => {
    const map = new Map<
      string,
      Map<
        string,
        {
          solveSum: number;
          revSum: number;
          questionsMap: Map<string, Question>;
        }
      >
    >();

    extensionData.records.forEach(r => {
      const qKey = r.questionObj.id || r.questionObj.qid;
      const subj = (r.subject || 'Sem Matéria').trim();
      const sys = (r.system || 'Sem Sistema').trim();

      if (!map.has(subj)) {
        map.set(subj, new Map());
      }
      const sysMap = map.get(subj)!;

      if (!sysMap.has(sys)) {
        sysMap.set(sys, {
          solveSum: 0,
          revSum: 0,
          questionsMap: new Map(),
        });
      }

      const item = sysMap.get(sys)!;
      item.solveSum += r.resolutionTimeSeconds;
      item.revSum += r.reviewTimeSeconds;
      item.questionsMap.set(qKey, r.questionObj);
    });

    const subjectsArray = Array.from(map.entries()).map(([subjName, sysMap]) => {
      let subjTotalQuestions = 0;
      let subjCorrectCount = 0;
      let subjSolveSum = 0;
      let subjRevSum = 0;
      const subjAllQuestionsMap = new Map<string, Question>();

      const systemsArray = Array.from(sysMap.entries()).map(([sysName, data]) => {
        const uniqueQuestions = Array.from(data.questionsMap.values());
        const total = uniqueQuestions.length;
        const correct = uniqueQuestions.filter(q => isQuestionCorrect(q)).length;
        const incorrect = total - correct;
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
        const avgSolve = total > 0 ? Math.round(data.solveSum / total) : 60;
        const avgRev = total > 0 ? Math.round(data.revSum / total) : 90;

        subjTotalQuestions += total;
        subjCorrectCount += correct;
        subjSolveSum += data.solveSum;
        subjRevSum += data.revSum;
        uniqueQuestions.forEach(q => subjAllQuestionsMap.set(q.id || q.qid, q));

        return {
          systemName: sysName,
          total,
          correct,
          incorrect,
          accuracy,
          avgSolveTime: avgSolve,
          avgReviewTime: avgRev,
          questions: uniqueQuestions
        };
      });

      systemsArray.sort((a, b) => b.total - a.total);

      const subjUniqueQuestions = Array.from(subjAllQuestionsMap.values());
      const subjAccuracy = subjTotalQuestions > 0 ? Math.round((subjCorrectCount / subjTotalQuestions) * 100) : 0;
      const subjAvgSolve = subjTotalQuestions > 0 ? Math.round(subjSolveSum / Math.max(1, subjTotalQuestions)) : 60;
      const subjAvgRev = subjTotalQuestions > 0 ? Math.round(subjRevSum / Math.max(1, subjTotalQuestions)) : 90;

      return {
        subjectName: subjName,
        total: subjTotalQuestions,
        correct: subjCorrectCount,
        incorrect: subjTotalQuestions - subjCorrectCount,
        accuracy: subjAccuracy,
        avgSolveTime: subjAvgSolve,
        avgReviewTime: subjAvgRev,
        systems: systemsArray,
        allQuestions: subjUniqueQuestions
      };
    });

    subjectsArray.sort((a, b) => b.total - a.total);
    return subjectsArray;
  }, [extensionData]);

  // Handler para clique em qualquer ponto, barra ou linha do gráfico
  const handleChartPointClick = (dateStr: string, dateFormatted?: string, specificSubject?: string) => {
    if (!dateStr) return;

    // Busca questões da data a partir do mapa ou filtra as questões
    const dateEntry = questionsByDateMap.get(dateStr);
    let matchedQuestions: Question[] = [];

    if (dateEntry && dateEntry.questionsList && dateEntry.questionsList.length > 0) {
      matchedQuestions = [...dateEntry.questionsList];
    } else {
      matchedQuestions = questions.filter(q => {
        if (!matchesBank(q)) return false;
        const hasAtt = q.attempts?.some(a => {
          const aDate = format(new Date(a.timestamp), 'yyyy-MM-dd');
          return aDate === dateStr;
        });
        const qDate = q.lastAnsweredAt ? format(new Date(q.lastAnsweredAt), 'yyyy-MM-dd') : null;
        return hasAtt || qDate === dateStr;
      });
    }

    if (specificSubject) {
      matchedQuestions = matchedQuestions.filter(q => (q.subject || 'Geral').trim().toLowerCase() === specificSubject.trim().toLowerCase());
    }

    const displayDate = dateFormatted || dateStr;
    const bankName = selectedBankId === 'all' ? 'Todos os Bancos' : (availableBanksList.find(b => b.id === selectedBankId)?.name || selectedBankId);

    if (matchedQuestions.length > 0) {
      const totalDaily = dateEntry?.totalAmount || matchedQuestions.length;
      const subtitleText = totalDaily > matchedQuestions.length
        ? `${totalDaily} questões resolvidas no dia (${matchedQuestions.length} com detalhes completos de revisão) • Banco: ${bankName}${specificSubject ? ` • Matéria: ${specificSubject}` : ''}`
        : `${matchedQuestions.length} questões registradas • Banco: ${bankName}${specificSubject ? ` • Matéria: ${specificSubject}` : ''}`;

      setDrillDownData({
        isOpen: true,
        title: `Questões de ${displayDate}`,
        subtitle: subtitleText,
        dateStr,
        questions: matchedQuestions
      });
    } else {
      setDateForManager(dateStr);
      setIsDateManagerOpen(true);
    }
  };

  const handleResetSubject = (subject: string) => {
    resetSubjectStats(subject);
    setResetToast(`Estatísticas da matéria "${subject}" foram resetadas.`);
    setTimeout(() => setResetToast(null), 3000);
  };

  const handleResetSystem = (system: string) => {
    resetSystemStats(system);
    setResetToast(`Estatísticas do sistema "${system}" foram resetadas.`);
    setTimeout(() => setResetToast(null), 3000);
  };

  const handleResetBank = (bankId: string) => {
    resetBankStats(bankId);
    setResetToast(`Estatísticas do banco foram resetadas com sucesso.`);
    setTimeout(() => setResetToast(null), 3000);
  };

  const handleResetExtensionData = () => {
    resetExtensionStats();
    setResetToast(`Dados da extensão foram resetados com sucesso.`);
    setTimeout(() => setResetToast(null), 3000);
  };

  const handleResetGeneralLogs = () => {
    try {
      localStorage.removeItem('usmle_study_logs_v4');
      window.dispatchEvent(new Event('usmle_logs_updated'));
      setResetToast(`Logs de estudo foram resetados.`);
      setTimeout(() => setResetToast(null), 3000);
    } catch (e) {}
  };

  const handleSanitizeAndRecalculate = () => {
    const res = sanitizeStudyData();
    if (res.fixedQuestionsCount > 0 || res.fixedLogsCount > 0 || res.removedDuplicateAttempts > 0) {
      setResetToast(`✓ Sincronização concluída: ${res.fixedQuestionsCount} questões calibradas, ${res.removedDuplicateAttempts} duplicatas removidas e ${res.fixedLogsCount} logs sincronizados!`);
    } else {
      setResetToast(`✓ Todas as métricas e registros já estão 100% calibrados e consistentes.`);
    }
    setTimeout(() => setResetToast(null), 3500);
  };

  const handleSeedSampleExtensionData = () => {
    const sampleSubjects = ['Cardiologia', 'Pneumologia', 'Infectologia', 'Farmacologia', 'Gastroenterologia'];
    const sampleSystems = ['Cardiovascular', 'Respiratório', 'Imunológico', 'Autônomo', 'Digestório'];
    const now = Date.now();

    for (let i = 1; i <= 15; i++) {
      const isCorr = Math.random() > 0.35;
      const sub = sampleSubjects[i % sampleSubjects.length];
      const sys = sampleSystems[i % sampleSystems.length];
      const qid = `DEMO-EXT-${1000 + i}`;
      const dayOffset = (i % 7);
      const fakeAnsweredAt = now - (dayOffset * 86400000);

      upsertQuestionFromQBank({
        id: `q-demo-${i}`,
        qid,
        bankId: selectedBankId === 'all' ? 'uworld' : selectedBankId,
        text: `Questão demonstrativa ${qid}: Paciente com queixas clínicas em ${sub}...`,
        stem: `Paciente do sexo masculino, 45 anos, apresenta quadro compatível com afecção do sistema ${sys}...`,
        subject: sub,
        system: sys,
        status: isCorr ? 'correct' : 'incorrect',
        isFromExtension: true,
        source: 'extension',
        resolutionTimeSeconds: Math.floor(45 + Math.random() * 40),
        reviewTimeSeconds: Math.floor(60 + Math.random() * 60),
        lastAnsweredAt: fakeAnsweredAt,
        alternatives: [
          { id: 'alt-a', letter: 'A', text: 'Opção A (Diagnóstico diferencial)', isCorrect: isCorr },
          { id: 'alt-b', letter: 'B', text: 'Opção B (Conduta terapêutica)', isCorrect: !isCorr },
          { id: 'alt-c', letter: 'C', text: 'Opção C (Fisiopatologia)', isCorrect: false },
          { id: 'alt-d', letter: 'D', text: 'Opção D (Exame complementar)', isCorrect: false }
        ],
        attempts: [
          {
            timestamp: fakeAnsweredAt,
            isCorrect: isCorr,
            resolutionTimeSeconds: 55,
            reviewTimeSeconds: 70,
            selectedChoiceId: isCorr ? 'alt-a' : 'alt-b'
          }
        ]
      });

      recordDeskQuestionAnswer({
        qid,
        questionId: `q-demo-${i}`,
        isCorrect: isCorr,
        resolutionTimeSeconds: 55,
        reviewTimeSeconds: 70,
        subject: sub,
        system: sys,
      });
    }

    setResetToast('✓ Amostra de questões da extensão injetada com sucesso!');
    setTimeout(() => setResetToast(null), 3000);
  };

  const formatSec = (sec: number) => {
    if (!sec || isNaN(sec)) return '0s';
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m === 0) return `${rem}s`;
    return `${m}m ${rem}s`;
  };

  const selectedBankName = selectedBankId === 'all'
    ? 'Todos os Bancos (Unificado)'
    : (availableBanksList.find(b => b.id === selectedBankId)?.name || selectedBankId);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {resetToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white dark:bg-white dark:text-gray-900 px-4 py-3 rounded-2xl shadow-xl border border-gray-700 dark:border-gray-200 text-xs font-bold flex items-center gap-2 animate-slide-up">
          <Sparkles className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{resetToast}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PAINEL PRINCIPAL: GRÁFICOS & PERFORMANCE */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs flex flex-col gap-6">
        
        {/* Header do Card com Seletor de Modo e Filtros Rápidos */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold text-xs">
                Performance
              </span>
              <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">
                Painel de Desempenho & Métricas
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Filtre por banco de questões ou veja dados unificados, com taxa real de acertos, volume e média diária ponderada.
            </p>
          </div>

          {/* Abas Superiores do Gráfico */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveChartTab('general')}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  activeChartTab === 'general'
                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <span>📅 Gráfico Geral (Sessões & Bancos)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveChartTab('subject')}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  activeChartTab === 'subject'
                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>📈 Desempenho por Subject (Extensão)</span>
              </button>
            </div>

            {/* Intervalo de dias */}
            {activeChartTab === 'general' ? (
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold">
                {[7, 14, 30, 60, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDaysToShow(days)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                      daysToShow === days
                        ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 font-bold shadow-xs"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                    )}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold">
                {[7, 14, 30, 60, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setSubjectDaysRange(days)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                      subjectDaysRange === days
                        ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 font-bold shadow-xs"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                    )}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            )}

            {/* Botão de Sincronizar & Corrigir Métricas */}
            <button
              type="button"
              onClick={handleSanitizeAndRecalculate}
              className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Corrigir registros e recalcular métricas para corresponderem exatamente ao número de questões únicas"
            >
              <Wand2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Sincronizar & Corrigir</span>
            </button>

            {/* Botão de Reset Granular */}
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Resetar estatísticas individualmente"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Resetar</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BARRA DE FILTRO POR BANCO DE QUESTÕES & TRATAMENTO DE REVISÕES */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mr-1">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Banco de Questões:</span>
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedBankId('all')}
                className={cn(
                  "px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5",
                  selectedBankId === 'all'
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                )}
              >
                <span>🌐 Todos os Bancos (Unificado)</span>
              </button>

              {availableBanksList.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBankId(b.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5",
                    selectedBankId === b.id
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                  )}
                >
                  <Layers className="w-3 h-3 opacity-70" />
                  <span>{b.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Tratamento de Questões Revisadas de Outras Datas */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-gray-700 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600">
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">Revisões:</span>
              <select
                value={reviewHandlingMode}
                onChange={(e) => setReviewHandlingMode(e.target.value as any)}
                className="bg-transparent text-[11px] font-bold text-blue-600 dark:text-blue-400 focus:outline-none cursor-pointer"
                title="Define como questões resolvidas em datas anteriores são contabilizadas"
              >
                <option value="original_date">Data Original (Questões Únicas)</option>
                <option value="latest_date">Data Mais Recente (Questões Únicas)</option>
                <option value="all_attempts">Todas as Tentativas & Revisões</option>
              </select>
            </div>

            {/* Botão de Abrir Gerenciador de Registros por Data */}
            <button
              type="button"
              onClick={() => {
                setDateForManager(undefined);
                setIsDateManagerOpen(true);
              }}
              className="px-3 py-1.5 bg-white hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Abrir gerenciador para inspecionar, excluir ou transferir questões por data"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Gerenciar / Excluir por Data</span>
            </button>
          </div>
        </div>

        {/* SUMMARY TILES */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs font-bold mb-1">
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{activeChartTab === 'general' ? 'Total de Questões' : 'Total (Extensão)'}</span>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-blue-950 dark:text-blue-100">
              {activeChartTab === 'general' 
                ? generalSummaryStats.totalQuestions 
                : extensionData.records.length}
            </div>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {activeChartTab === 'general'
                ? `${generalSummaryStats.activeDaysCount} dias ativos (${selectedBankName})`
                : `${extensionData.extensionQuestions.length} questões catalogadas`}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-1">
              <Award className="w-3.5 h-3.5" />
              <span>Taxa Geral de Acertos</span>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-950 dark:text-emerald-100">
              {activeChartTab === 'general'
                ? (generalSummaryStats.overallAvgScore !== null ? `${generalSummaryStats.overallAvgScore}%` : '—')
                : (extensionData.records.length > 0 
                    ? `${Math.round((extensionData.records.filter(r => r.isCorrect).length / extensionData.records.length) * 100)}%` 
                    : '—')}
            </div>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {activeChartTab === 'general' 
                ? 'Média ponderada do período' 
                : `${extensionData.records.filter(r => r.isCorrect).length} acertos registrados`}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
            <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 text-xs font-bold mb-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Subjects Identificados</span>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-purple-950 dark:text-purple-100">
              {allSubjectsList.length}
            </div>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {allSystemsList.length} Sistemas vinculados
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-bold mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Tempo Médio / Questão</span>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-amber-950 dark:text-amber-100">
              {extensionData.records.length > 0
                ? formatSec(
                    extensionData.records.reduce((acc, r) => acc + r.resolutionTimeSeconds, 0) /
                      extensionData.records.length
                  )
                : formatSec(65)}
            </div>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">Alvo recomendado: 75s</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 1. RENDERIZAÇÃO DO MODO 1: GRÁFICO GERAL (BARRAS = % ACERTOS, LINHA = VOLUME) */}
        {/* ========================================================================= */}
        {activeChartTab === 'general' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-500 pb-1 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Banco: {selectedBankName}</span>
                <span>•</span>
                <span className="text-blue-600 dark:text-blue-400 font-medium">👉 Clique em qualquer barra ou ponto para abrir e gerenciar as questões daquele dia</span>
              </div>
              <div className="flex items-center gap-3 font-semibold">
                <span className="text-emerald-600 dark:text-emerald-400">📊 Barras: Taxa de Acertos (%)</span>
                <span className="text-blue-600 dark:text-blue-400">📈 Linha: Volume de Questões</span>
              </div>
            </div>

            <div className="h-76 w-full cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={generalChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      const d = e.activePayload[0].payload;
                      handleChartPointClick(d.dateStr, d.dateFormatted);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="dateFormatted" tick={{ fontSize: 11 }} />

                  {/* Eixo Esquerdo: Volume de Questões */}
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    stroke="#3b82f6"
                    domain={[0, 'auto']}
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Questões', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#3b82f6' }}
                  />

                  {/* Eixo Direito: Taxa de Acertos (%) */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#10b981"
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Acerto (%)', angle: 90, position: 'insideRight', fontSize: 10, fill: '#10b981' }}
                  />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      color: '#fff',
                      borderRadius: '12px',
                      border: 'none',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'Taxa de Acertos (%)') return [value !== null ? `${value}%` : 'Sem dados de acerto', name];
                      if (name === 'Volume de Questões') return [`${value} questões resolvidas`, name];
                      if (name === 'Tendência (Média Móvel %)') return [value !== null ? `${value}%` : '—', name];
                      return [value, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                  {/* BARRAS: Porcentagem de Acertos (%) */}
                  <Bar
                    yAxisId="right"
                    dataKey="score"
                    name="Taxa de Acertos (%)"
                    fill="#10b981"
                    opacity={0.85}
                    radius={[4, 4, 0, 0]}
                    onClick={(data: any) => {
                      if (data && data.dateStr) handleChartPointClick(data.dateStr, data.dateFormatted);
                    }}
                    className="cursor-pointer hover:opacity-100 transition-opacity"
                  />

                  {/* LINHA: Volume de Questões */}
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="questions"
                    name="Volume de Questões"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    onClick={(data: any) => {
                      if (data && data.dateStr) handleChartPointClick(data.dateStr, data.dateFormatted);
                    }}
                    dot={{ r: 4, fill: '#3b82f6', cursor: 'pointer' }}
                    activeDot={{ r: 7, cursor: 'pointer' }}
                  />

                  {/* LINHA: Tendência (Média Móvel) */}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="trend"
                    name="Tendência (Média Móvel %)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls={true}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. RENDERIZAÇÃO DO MODO 2: DESEMPENHO POR SUBJECT + MÉDIA PONDERADA DIÁRIA */}
        {/* ========================================================================= */}
        {activeChartTab === 'subject' && (
          <div className="space-y-4">
            {/* Aviso de Fonte e Filtros */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-base">📊</span>
                <div>
                  <span className="font-bold text-blue-950 dark:text-blue-200">
                    Desempenho por Matéria (Subject) & Média Geral Diária:
                  </span>
                  <span className="text-blue-800 dark:text-blue-300 ml-1">
                    Cada linha reflete a % de acerto da matéria. A linha dourada tracejada exibe a média ponderada diária geral de todos os subjects.
                  </span>
                </div>
              </div>

              {extensionData.records.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeedSampleExtensionData}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1 shrink-0 shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Carregar Amostra da Extensão</span>
                </button>
              )}
            </div>

            {allSubjectsList.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center mx-auto text-xl font-bold">
                  🧩
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Nenhuma questão registrada para o banco selecionado
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Resolva questões usando a extensão do navegador ou clique no botão acima para carregar uma amostra de teste.
                </p>
              </div>
            ) : (
              <>
                {/* Legendas Interativas de Subjects (Clique para ativar/ocultar) */}
                <div className="flex flex-wrap items-center gap-2 pt-1 pb-2">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Filtros:
                  </span>

                  {/* Toggle da Linha de Média Ponderada Diária */}
                  <button
                    type="button"
                    onClick={() => setShowDailyAverageLine(!showDailyAverageLine)}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs",
                      !showDailyAverageLine
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 opacity-60 line-through"
                        : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-300" />
                    <span>⭐ Média Ponderada Diária</span>
                  </button>

                  {allSubjectsList.map(subj => {
                    const isHidden = hiddenSubjects.has(subj);
                    const color = subjectColorsMap[subj] || '#3b82f6';
                    return (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => {
                          const next = new Set(hiddenSubjects);
                          if (next.has(subj)) next.delete(subj);
                          else next.add(subj);
                          setHiddenSubjects(next);
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs",
                          isHidden
                            ? "bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 opacity-60 line-through"
                            : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700"
                        )}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: isHidden ? '#9ca3af' : color }}
                        />
                        <span>{subj}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Container do Gráfico Multi-Linhas por Subject */}
                <div className="h-80 w-full cursor-pointer">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={subjectTimeSeriesData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      onClick={(e: any) => {
                        if (e && e.activePayload && e.activePayload[0]) {
                          const d = e.activePayload[0].payload;
                          const rawKey = e.activePayload[0].dataKey;
                          const clickedSubject = (rawKey && rawKey !== '__daily_avg__') ? String(rawKey) : undefined;
                          handleChartPointClick(d.dateStr, d.dateFormatted, clickedSubject);
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="dateFormatted" tick={{ fontSize: 11 }} />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11 }}
                        label={{ value: '% Acerto', angle: -90, position: 'insideLeft', fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          color: '#fff',
                          borderRadius: '12px',
                          border: 'none',
                          fontSize: '12px',
                        }}
                        formatter={(value: any, name: string, item: any) => {
                          if (name === '⭐ Média Ponderada Diária (Geral)') {
                            if (value === null) return ['Sem resoluções neste dia', name];
                            const total = item.payload?.__daily_total__ || 0;
                            const correct = item.payload?.__daily_correct__ || 0;
                            return [`${value}% (${correct}/${total} acertos totais no dia)`, name];
                          }
                          if (value === null) return ['Sem questões', name];
                          const total = item.payload?.[`${name}_total`];
                          const correct = item.payload?.[`${name}_correct`];
                          const detail = total ? ` (${correct}/${total} questões)` : '';
                          return [`${value}% de acerto${detail}`, name];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                      {/* LINHA DE MÉDIA PONDERADA DIÁRIA GERAL */}
                      {showDailyAverageLine && (
                        <Line
                          type="monotone"
                          dataKey="__daily_avg__"
                          name="⭐ Média Ponderada Diária (Geral)"
                          stroke="#f59e0b"
                          strokeWidth={3.5}
                          strokeDasharray="6 3"
                          dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#ffffff', cursor: 'pointer' }}
                          activeDot={{ r: 7, cursor: 'pointer' }}
                          connectNulls={true}
                        />
                      )}

                      {/* Linhas de cada Subject */}
                      {allSubjectsList.map(subj => {
                        if (hiddenSubjects.has(subj)) return null;
                        return (
                          <Line
                            key={subj}
                            type="monotone"
                            dataKey={subj}
                            name={subj}
                            stroke={subjectColorsMap[subj] || '#3b82f6'}
                            strokeWidth={2.2}
                            dot={{ r: 3.5, cursor: 'pointer' }}
                            activeDot={{ r: 6, cursor: 'pointer' }}
                            connectNulls={true}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* BLOCO INFERIOR: HIERARQUIA SYSTEM VS SUBJECT & AUDITORIA CIRÚRGICA */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
                Análise Hierárquica por Matéria (Subject) & Sistema (System)
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Filtro ativo: <strong>{selectedBankName}</strong> • Clique em qualquer linha para abrir o Drill-down de visualização e gerenciamento.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              {systemVsSubjectData.length} Matérias Catalogadas
            </span>
          </div>
        </div>

        {systemVsSubjectData.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            Nenhuma questão registrada para esta matéria ou banco.
          </div>
        ) : (
          <div className="space-y-4">
            {systemVsSubjectData.map((subjItem) => {
              return (
                <div
                  key={subjItem.subjectName}
                  className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-gray-50/40 dark:bg-gray-800/30"
                >
                  {/* Subject Header Row */}
                  <div className="p-4 bg-white dark:bg-gray-850 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-extrabold flex items-center justify-center text-sm">
                        {subjItem.subjectName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">
                          {subjItem.subjectName}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>{subjItem.total} questões</span>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{subjItem.correct} acertos</span>
                          <span>•</span>
                          <span className="text-rose-500 font-bold">{subjItem.incorrect} erros</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Badge de Acerto */}
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                          {subjItem.accuracy}%
                        </div>
                        <div className="text-[10px] text-gray-400 uppercase font-semibold">Taxa de Acerto</div>
                      </div>

                      {/* Botão de Drill-Down do Subject */}
                      <button
                        type="button"
                        onClick={() => {
                          setDrillDownData({
                            isOpen: true,
                            title: `Matéria: ${subjItem.subjectName}`,
                            subtitle: `${subjItem.total} questões catalogadas no banco ${selectedBankName}`,
                            questions: subjItem.allQuestions
                          });
                        }}
                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/80 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        title="Ver todas as questões desta matéria"
                      >
                        <span>Drill-Down</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Systems Table under Subject */}
                  <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                    {subjItem.systems.map((sys) => (
                      <div
                        key={sys.systemName}
                        onClick={() => {
                          setDrillDownData({
                            isOpen: true,
                            title: `Sistema: ${sys.systemName}`,
                            subtitle: `Matéria: ${subjItem.subjectName} • ${sys.total} questões`,
                            questions: sys.questions
                          });
                        }}
                        className="p-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-2 h-2 rounded-full bg-purple-500 group-hover:scale-125 transition-transform" />
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {sys.systemName}
                          </span>
                        </div>

                        <div className="flex items-center gap-6 text-gray-600 dark:text-gray-300">
                          <div>
                            <span className="font-bold text-gray-900 dark:text-white">{sys.total}</span>
                            <span className="text-[10px] text-gray-400 ml-1">q.</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-600 font-bold">{sys.correct}✓</span>
                            <span className="text-rose-500 font-bold">{sys.incorrect}✗</span>
                          </div>

                          <div className="w-16 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                            {sys.accuracy}%
                          </div>

                          <div className="text-[11px] text-gray-400 font-mono hidden sm:block">
                            {formatSec(sys.avgSolveTime)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE DRILL-DOWN DE QUESTÕES */}
      {/* ========================================================================= */}
      <QuestionDrillDownModal
        isOpen={drillDownData.isOpen}
        onClose={() => setDrillDownData(prev => ({ ...prev, isOpen: false }))}
        title={drillDownData.title}
        subtitle={drillDownData.subtitle}
        dateStr={drillDownData.dateStr}
        questions={drillDownData.questions}
      />

      {/* ========================================================================= */}
      {/* MODAL DE GERENCIAMENTO DE REGISTROS POR DATA CIRÚRGICO */}
      {/* ========================================================================= */}
      <DateRecordsManagerModal
        isOpen={isDateManagerOpen}
        onClose={() => setIsDateManagerOpen(false)}
        initialDate={dateForManager}
        onDateRecordsChanged={() => {
          setResetToast('Registros de data atualizados com sucesso!');
          setTimeout(() => setResetToast(null), 3000);
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL DE RESET GRANULAR */}
      {/* ========================================================================= */}
      <GranularResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        availableSubjects={allSubjectsList}
        availableSystems={allSystemsList}
        availableBanks={availableBanksList}
        onResetExtensionOnly={handleResetExtensionData}
        onResetSubject={handleResetSubject}
        onResetSystem={handleResetSystem}
        onResetBank={handleResetBank}
        onResetGeneralLogsOnly={handleResetGeneralLogs}
        onOpenDateManager={() => {
          setIsResetModalOpen(false);
          setIsDateManagerOpen(true);
        }}
      />
    </div>
  );
}
