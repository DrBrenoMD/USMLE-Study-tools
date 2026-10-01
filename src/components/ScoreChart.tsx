import React, { useMemo, useState, useEffect } from 'react';
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
  BarChart3,
  CheckSquare,
  Award,
  Clock,
  BookOpen,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  FolderTree,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Download,
  Wand2,
  Calendar,
  CalendarDays,
  Layers,
  Building2
} from 'lucide-react';
import { useStore, StudyDeskQuestionRecord, Question } from '../cardblocks/store/useStore';
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
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ef4444', // red
  '#14b8a6', // teal
  '#6366f1', // indigo
];

export function ScoreChart({ logs }: ScoreChartProps) {
  // Configurações do Gráfico Geral
  const [daysToShow, setDaysToShow] = useState<number>(30);

  // Seletor de Banco de Questões: 'all' (Todos os Bancos / Unificado) | bankId
  const [selectedBankId, setSelectedBankId] = useState<string>('all');

  // Modo de tratamento de revisões: 'original_date' (Preserva data de resolução original) | 'all_attempts' (Contabiliza na data feita)
  const [reviewHandlingMode, setReviewHandlingMode] = useState<'original_date' | 'all_attempts'>('original_date');

  // Seletor de Modo na Seção de Gráficos: 'general' (Geral de Sessões) | 'subject' (Gráfico por Subject da Extensão)
  const [activeChartTab, setActiveChartTab] = useState<'general' | 'subject'>('general');

  // Filtro de Dias para o gráfico de Subject
  const [subjectDaysRange, setSubjectDaysRange] = useState<number>(30);

  // Legendas interativas do gráfico por Subject: Set de subjects desativados/ocultos
  const [hiddenSubjects, setHiddenSubjects] = useState<Set<string>>(new Set());

  // Estado para Drill-down Modal
  const [drillDownData, setDrillDownData] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
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

  // Helper para testar se uma questão pertence ao banco selecionado
  const matchesBank = (q: Question): boolean => {
    if (selectedBankId === 'all') return true;
    if (q.bankId === selectedBankId) return true;
    const bankObj = questionBanks.find(b => b.id === selectedBankId);
    if (bankObj && q.tags?.some(t => t.toLowerCase().includes(bankObj.name.toLowerCase()))) return true;
    return false;
  };

  // 1. Processa dados do GRÁFICO GERAL (Com separação por banco ou unificado + Barras: % Acertos, Linha: Volume)
  const { generalChartData, generalSummaryStats } = useMemo(() => {
    // Filtra logs de sessão que correspondam a qbank e ao banco selecionado (se filtrado)
    const qbankLogs = logs.filter((l) => {
      const isQBank = l.resourceType === 'qbank' || l.unit === 'questões' || l.unit === 'questoes';
      if (!isQBank) return false;
      if (selectedBankId === 'all') return true;
      const bankObj = questionBanks.find(b => b.id === selectedBankId);
      const bankName = bankObj ? bankObj.name.toLowerCase() : '';
      return (
        l.resourceId === selectedBankId ||
        l.resourceName.toLowerCase().includes(selectedBankId.toLowerCase()) ||
        (bankName && l.resourceName.toLowerCase().includes(bankName))
      );
    });

    const byDate = new Map<
      string,
      {
        totalAmount: number;
        scoredAmount: number;
        weightedScoreSum: number;
        questionIds: Set<string>;
      }
    >();

    // Se temos logs manuais/sincronizados correspondentes
    qbankLogs.forEach((log) => {
      if (!log.date) return;
      const existing = byDate.get(log.date) || {
        totalAmount: 0,
        scoredAmount: 0,
        weightedScoreSum: 0,
        questionIds: new Set(),
      };

      const amt = Number(log.amount) || 0;
      existing.totalAmount += amt;

      if (log.scorePercent !== undefined && log.scorePercent !== null) {
        const score = Number(log.scorePercent);
        existing.scoredAmount += amt;
        existing.weightedScoreSum += score * amt;
      }

      byDate.set(log.date, existing);
    });

    // Se um banco específico foi selecionado e não tem logs dedicados na tabela geral,
    // calcula os pontos diários diretamente das questões do banco
    if (selectedBankId !== 'all' && qbankLogs.length === 0) {
      const bankQuestions = questions.filter(matchesBank);

      bankQuestions.forEach(q => {
        if (!q.attempts || q.attempts.length === 0) {
          if (q.lastAnsweredAt && q.status && q.status !== 'unused') {
            const dStr = format(new Date(q.lastAnsweredAt), 'yyyy-MM-dd');
            const existing = byDate.get(dStr) || {
              totalAmount: 0,
              scoredAmount: 0,
              weightedScoreSum: 0,
              questionIds: new Set(),
            };
            if (!existing.questionIds.has(q.id)) {
              existing.questionIds.add(q.id);
              existing.totalAmount += 1;
              existing.scoredAmount += 1;
              existing.weightedScoreSum += q.status === 'correct' ? 100 : 0;
              byDate.set(dStr, existing);
            }
          }
          return;
        }

        // Tratamento de Revisões:
        // 'original_date': atribui à primeira tentativa (data de resolução original) para não distorcer hoje
        // 'all_attempts': contabiliza cada tentativa na data em que foi realizada
        if (reviewHandlingMode === 'original_date') {
          const firstAtt = q.attempts[0];
          const t = firstAtt?.timestamp || q.lastAnsweredAt || q.createdAt || Date.now();
          const dStr = format(new Date(t), 'yyyy-MM-dd');
          const existing = byDate.get(dStr) || {
            totalAmount: 0,
            scoredAmount: 0,
            weightedScoreSum: 0,
            questionIds: new Set(),
          };
          if (!existing.questionIds.has(q.id)) {
            existing.questionIds.add(q.id);
            existing.totalAmount += 1;
            existing.scoredAmount += 1;
            existing.weightedScoreSum += (firstAtt ? firstAtt.isCorrect : q.status === 'correct') ? 100 : 0;
            byDate.set(dStr, existing);
          }
        } else {
          q.attempts.forEach(att => {
            const t = att.timestamp || q.lastAnsweredAt || Date.now();
            const dStr = format(new Date(t), 'yyyy-MM-dd');
            const existing = byDate.get(dStr) || {
              totalAmount: 0,
              scoredAmount: 0,
              weightedScoreSum: 0,
              questionIds: new Set(),
            };
            existing.totalAmount += 1;
            existing.scoredAmount += 1;
            existing.weightedScoreSum += att.isCorrect ? 100 : 0;
            byDate.set(dStr, existing);
          });
        }
      });
    }

    const today = startOfDay(new Date());
    const startDate = subDays(today, Math.max(1, daysToShow - 1));
    const allDaysInInterval = eachDayOfInterval({ start: startDate, end: today });

    let cumulativeTotalQuestions = 0;
    let cumulativeScoredQuestions = 0;
    let cumulativeWeightedScore = 0;
    let activeDaysCount = 0;

    const rawDailyData = allDaysInInterval.map((dayDate) => {
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const dateFormatted = format(dayDate, 'dd/MM');
      const stats = byDate.get(dateStr);

      const hasQuestions = Boolean(stats && stats.totalAmount > 0);
      const questionsCount = stats ? stats.totalAmount : 0;

      let avgScore: number | null = null;
      if (stats && stats.scoredAmount > 0) {
        avgScore = Math.round(stats.weightedScoreSum / stats.scoredAmount);
      }

      if (hasQuestions) {
        activeDaysCount++;
        cumulativeTotalQuestions += questionsCount;
        if (stats && stats.scoredAmount > 0) {
          cumulativeScoredQuestions += stats.scoredAmount;
          cumulativeWeightedScore += stats.weightedScoreSum;
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
        ? Math.round(cumulativeWeightedScore / cumulativeScoredQuestions)
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
    };
  }, [logs, questions, questionBanks, daysToShow, selectedBankId, reviewHandlingMode]);

  // 2. FONTE DE DADOS DA EXTENSÃO & BANCOS: Registros filtrados por banco e tratamento de revisões
  const extensionData = useMemo(() => {
    // Filtra questões puramente da extensão ou do banco selecionado
    const extQuestions = questions.filter(q => isExtensionQuestion(q) && matchesBank(q));

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

    // Prioriza tentativas reais registradas na questão
    extQuestions.forEach(q => {
      const subj = (q.subject || 'Geral').trim();
      const sys = (q.system || 'Sistema Geral').trim();

      if (q.attempts && q.attempts.length > 0) {
        if (reviewHandlingMode === 'original_date') {
          // Utiliza a 1ª tentativa ou consolida na data de resolução original
          const firstAtt = q.attempts[0];
          const lastAtt = q.attempts[q.attempts.length - 1];
          const tDate = firstAtt?.timestamp ? new Date(firstAtt.timestamp) : new Date(q.lastAnsweredAt || Date.now());
          
          records.push({
            qid: q.qid || q.id,
            questionId: q.id,
            questionObj: q,
            isCorrect: lastAtt ? lastAtt.isCorrect : (firstAtt?.isCorrect ?? (q.status === 'correct')),
            subject: subj,
            system: sys,
            resolutionTimeSeconds: lastAtt?.resolutionTimeSeconds || q.resolutionTimeSeconds || 60,
            reviewTimeSeconds: lastAtt?.reviewTimeSeconds || q.reviewTimeSeconds || 100,
            answeredAt: tDate.getTime(),
            dateStr: format(tDate, 'yyyy-MM-dd')
          });
        } else {
          q.attempts.forEach(att => {
            const tDate = att.timestamp ? new Date(att.timestamp) : new Date(q.lastAnsweredAt || Date.now());
            records.push({
              qid: q.qid || q.id,
              questionId: q.id,
              questionObj: q,
              isCorrect: att.isCorrect,
              subject: subj,
              system: sys,
              resolutionTimeSeconds: att.resolutionTimeSeconds || q.resolutionTimeSeconds || 60,
              reviewTimeSeconds: att.reviewTimeSeconds || q.reviewTimeSeconds || 100,
              answeredAt: tDate.getTime(),
              dateStr: format(tDate, 'yyyy-MM-dd')
            });
          });
        }
      } else if (q.status && q.status !== 'unused') {
        const tDate = q.lastAnsweredAt ? new Date(q.lastAnsweredAt) : new Date(q.updatedAt || Date.now());
        records.push({
          qid: q.qid || q.id,
          questionId: q.id,
          questionObj: q,
          isCorrect: q.status === 'correct',
          subject: subj,
          system: sys,
          resolutionTimeSeconds: q.resolutionTimeSeconds || 60,
          reviewTimeSeconds: q.reviewTimeSeconds || 100,
          answeredAt: tDate.getTime(),
          dateStr: format(tDate, 'yyyy-MM-dd')
        });
      }
    });

    // Se nenhuma questão da extensão estiver salva ainda, busca se há sessões de desk
    if (records.length === 0) {
      (studyDeskSessions || []).forEach(s => {
        (s.questionRecords || []).forEach(r => {
          if (r.isFromExtension) {
            const matchedQ = questions.find(q => q.qid === r.qid || q.id === r.questionId);
            if (matchedQ && matchesBank(matchedQ)) {
              const tDate = new Date(r.answeredAt || s.startedAt);
              records.push({
                qid: r.qid,
                questionId: r.questionId,
                questionObj: matchedQ,
                isCorrect: r.isCorrect,
                subject: (r.subject || matchedQ.subject || 'Geral').trim(),
                system: (r.system || matchedQ.system || 'Sistema Geral').trim(),
                resolutionTimeSeconds: r.resolutionTimeSeconds,
                reviewTimeSeconds: r.reviewTimeSeconds,
                answeredAt: tDate.getTime(),
                dateStr: format(tDate, 'yyyy-MM-dd')
              });
            }
          }
        });
      });
    }

    return {
      extensionQuestions: extQuestions,
      records
    };
  }, [questions, studyDeskSessions, selectedBankId, reviewHandlingMode]);

  // Lista única de Subjects e Systems capturados da extensão
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

  // 3. Processamento do GRÁFICO - Desempenho por Subject pelo Tempo
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

      allSubjectsList.forEach(subj => {
        if (dayMap && dayMap.has(subj)) {
          const stats = dayMap.get(subj)!;
          const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null;
          entry[subj] = accuracy;
          entry[`${subj}_total`] = stats.total;
          entry[`${subj}_correct`] = stats.correct;
        } else {
          entry[subj] = null;
        }
      });

      return entry;
    });

    return {
      subjectTimeSeriesData: seriesData,
      subjectColorsMap: colorsMap
    };
  }, [allSubjectsList, extensionData, subjectDaysRange]);

  // 4. Processamento da SEÇÃO - System vs Subject (Hierarquia detalhada baseada em questões únicas)
  const systemVsSubjectData = useMemo(() => {
    // Mapa: Subject -> Map<System, { solveSum, revSum, questionsMap: Map<string, Question> }>
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

    // Agrupa cada questão única pelo seu Subject e System
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

    // Converte em array estruturado e calcula médias precisas
    const subjectsArray = Array.from(map.entries()).map(([subjName, sysMap]) => {
      let subjTotalQuestions = 0;
      let subjCorrectCount = 0;
      let subjSolveSum = 0;
      let subjRevSum = 0;
      const subjAllQuestionsMap = new Map<string, Question>();

      const systemsArray = Array.from(sysMap.entries()).map(([sysName, data]) => {
        const uniqueQuestions = Array.from(data.questionsMap.values());
        const total = uniqueQuestions.length;
        const correct = uniqueQuestions.filter(q => q.status === 'correct').length;
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

  // Formatação de segundos
  const formatSec = (seconds: number): string => {
    const s = Math.max(0, Math.round(seconds));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m === 0) return `${rem}s`;
    return `${m}m ${rem}s`;
  };

  // Handlers para ações e reset
  const handleResetExtensionData = () => {
    resetExtensionStats();
    setResetToast('Todas as estatísticas de questões da extensão foram resetadas!');
    setTimeout(() => setResetToast(null), 3500);
  };

  const handleResetSubject = (subjectName: string) => {
    resetSubjectStats(subjectName);
    setResetToast(`Estatísticas da matéria "${subjectName}" foram resetadas!`);
    setTimeout(() => setResetToast(null), 3500);
  };

  const handleResetSystem = (systemName: string) => {
    resetSystemStats(systemName);
    setResetToast(`Estatísticas do System "${systemName}" foram resetadas!`);
    setTimeout(() => setResetToast(null), 3500);
  };

  const handleResetBank = (bankId: string) => {
    resetBankStats(bankId);
    const bankName = availableBanksList.find(b => b.id === bankId)?.name || bankId;
    setResetToast(`Estatísticas do Banco "${bankName}" foram resetadas!`);
    setTimeout(() => setResetToast(null), 3500);
  };

  const handleSanitizeAndRecalculate = () => {
    const res = sanitizeStudyData();
    if (res.fixedLogsCount > 0 || res.removedDuplicateAttempts > 0) {
      setResetToast(`Sincronização concluída! ${res.removedDuplicateAttempts} tentativas duplicadas foram removidas e ${res.fixedLogsCount} registros do Heatmap corrigidos para corresponderem às questões reais.`);
    } else {
      setResetToast('Todas as métricas e logs do Heatmap já estão 100% íntegros e sincronizados com as questões reais!');
    }
    setTimeout(() => setResetToast(null), 4500);
  };

  const handleResetGeneralLogs = () => {
    localStorage.removeItem('usmle_study_logs_v4');
    window.location.reload();
  };

  // Gerador de questões de amostra da extensão para testes/revisão imediata
  const handleSeedSampleExtensionData = () => {
    const samples = [
      { qid: 'EXT-101', subject: 'Cardiologia', system: 'Sistema Cardiovascular', text: 'Homem de 62 anos apresenta dor torácica retroesternal opressiva e elevação do segmento ST em DII, DIII e aVF.', isCorrect: true, solve: 58, rev: 110 },
      { qid: 'EXT-102', subject: 'Cardiologia', system: 'Sistema Cardiovascular', text: 'Mulher de 45 anos com sopro holossistólico em foco mitral irradiando para axila esquerda.', isCorrect: true, solve: 64, rev: 120 },
      { qid: 'EXT-103', subject: 'Cardiologia', system: 'Farmacologia Cardiovascular', text: 'Mecanismo de ação dos inibidores da ECA e efeito sobre a bradicinina e tosse seca.', isCorrect: false, solve: 72, rev: 140 },
      { qid: 'EXT-104', subject: 'Cardiologia', system: 'Farmacologia Cardiovascular', text: 'Uso de betabloqueadores em insuficiência cardíaca crônica com fração de ejeção reduzida.', isCorrect: true, solve: 52, rev: 90 },
      { qid: 'EXT-105', subject: 'Pneumologia', system: 'Sistema Respiratório', text: 'Paciente de 58 anos tabagista de longa data com dispneia progressiva e relação VEF1/CVF < 0.70.', isCorrect: true, solve: 65, rev: 115 },
      { qid: 'EXT-106', subject: 'Pneumologia', system: 'Sistema Respiratório', text: 'Quadro de pneumonia adquirida na comunidade com consolidação lobar direita por Streptococcus pneumoniae.', isCorrect: true, solve: 48, rev: 85 },
      { qid: 'EXT-107', subject: 'Pneumologia', system: 'Distúrbios Ventilatórios', text: 'Gasometria arterial revelando hipoxemia refratária com gradiente alvéolo-arterial aumentado no shunt intrapulmonar.', isCorrect: false, solve: 82, rev: 160 },
      { qid: 'EXT-108', subject: 'Gastroenterologia', system: 'Sistema Hepático & Biliar', text: 'Homem de 50 anos etilista crônico com ascite, circulação colateral e varizes esofágicas.', isCorrect: true, solve: 60, rev: 105 },
      { qid: 'EXT-109', subject: 'Gastroenterologia', system: 'Sistema Hepático & Biliar', text: 'Mecanismo fisiopatológico da encefalopatia hepática e manejo inicial com lactulose.', isCorrect: false, solve: 68, rev: 130 },
      { qid: 'EXT-110', subject: 'Gastroenterologia', system: 'Trato Gastrointestinal', text: 'Mulher jovem com diarreia crônica, dor abdominal e lesões ulceradas segmentares na ileocolonoscopia.', isCorrect: true, solve: 70, rev: 125 },
      { qid: 'EXT-111', subject: 'Infectologia', system: 'Imunológico & Infecto', text: 'Conduta frente a paciente com febre, rigidez de nuca e líquor túrbido com predomínio de polimorfonucleares.', isCorrect: true, solve: 55, rev: 95 },
      { qid: 'EXT-112', subject: 'Infectologia', system: 'Imunológico & Infecto', text: 'Tratamento empírico inicial de endocardite infecciosa em valva nativa aguda.', isCorrect: false, solve: 75, rev: 145 },
    ];

    samples.forEach(s => {
      const qId = upsertQuestionFromQBank({
        qid: s.qid,
        bankId: selectedBankId === 'all' ? 'uworld' : selectedBankId,
        stem: s.text,
        text: s.text,
        subject: s.subject,
        system: s.system,
        isFromExtension: true,
        source: 'extension',
        tags: [`qid:${s.qid}`, 'origem:extensao', 'extension', s.subject.toLowerCase()],
        alternatives: [
          { id: 'alt-a', letter: 'A', text: 'Opção correta diagnosticada', isCorrect: true },
          { id: 'alt-b', letter: 'B', text: 'Opção incorreta alternativa', isCorrect: false }
        ]
      });

      recordDeskQuestionAnswer({
        qid: s.qid,
        questionId: qId,
        selectedChoiceId: s.isCorrect ? 'alt-a' : 'alt-b',
        correctChoiceId: 'alt-a',
        isCorrect: s.isCorrect,
        resolutionTimeSeconds: s.solve,
        reviewTimeSeconds: s.rev,
        subject: s.subject,
        system: s.system
      });
    });

    setResetToast('Amostra de 12 questões capturadas pela extensão foi injetada com sucesso para testes!');
    setTimeout(() => setResetToast(null), 4000);
  };

  const selectedBankName = selectedBankId === 'all'
    ? 'Todos os Bancos (Unificado)'
    : (availableBanksList.find(b => b.id === selectedBankId)?.name || 'Banco Selecionado');

  return (
    <div className="space-y-8 mt-6">
      {/* Toast Feedback */}
      {resetToast && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-2xl flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{resetToast}</span>
          </div>
          <button onClick={() => setResetToast(null)} className="text-emerald-600 font-extrabold text-xs">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BLOCO SUPERIOR: SEÇÃO DE GRÁFICOS (GERAL vs NOVO GRÁFICO POR SUBJECT) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs flex flex-col gap-6">
        {/* Top Header com Seletor de Gráfico e Botões de Controle */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
                Painel de Desempenho & Métricas
              </h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Filtre por banco de questões ou veja dados unificados, com separação de acertos e volume.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Modo: Gráfico Geral vs Novo Gráfico por Subject */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700">
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
                title="Define como questões resolvidas em datas anteriores são contabilizadas quando revisadas"
              >
                <option value="original_date">Data Original (Sem poluir data atual)</option>
                <option value="all_attempts">Contabilizar todas as tentativas hoje</option>
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
              title="Abrir gerenciador para excluir ou transferir questões registradas na data errada"
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
                : extensionData.extensionQuestions.filter(q => q.status && q.status !== 'unused').length || extensionData.extensionQuestions.length}
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
              {activeChartTab === 'general' ? 'Média ponderada do período' : `${extensionData.records.filter(r => r.isCorrect).length} acertos registrados`}
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
                <span>Clique em uma data para inspecionar, corrigir ou excluir lançamentos</span>
              </div>
              <div className="flex items-center gap-3 font-semibold">
                <span className="text-emerald-600 dark:text-emerald-400">📊 Barras: Taxa de Acertos (%)</span>
                <span className="text-blue-600 dark:text-blue-400">📈 Linha: Volume de Questões</span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={generalChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      const d = e.activePayload[0].payload;
                      const dayQuestions = questions.filter(q => {
                        if (!q.lastAnsweredAt) return false;
                        const qDate = format(new Date(q.lastAnsweredAt), 'yyyy-MM-dd');
                        return qDate === d.dateStr && matchesBank(q);
                      });

                      if (dayQuestions.length > 0) {
                        setDrillDownData({
                          isOpen: true,
                          title: `Questões de ${d.dateFormatted}`,
                          subtitle: `Data: ${d.dateStr} • Banco: ${selectedBankName}`,
                          questions: dayQuestions
                        });
                      } else {
                        setDateForManager(d.dateStr);
                        setIsDateManagerOpen(true);
                      }
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
                  />

                  {/* LINHA: Volume de Questões */}
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="questions"
                    name="Volume de Questões"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#3b82f6' }}
                    activeDot={{ r: 6 }}
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
        {/* 2. RENDERIZAÇÃO DO MODO 2: NOVO GRÁFICO - DESEMPENHO POR SUBJECT PELO TEMPO */}
        {/* ========================================================================= */}
        {activeChartTab === 'subject' && (
          <div className="space-y-4">
            {/* Aviso de Fonte e Filtros */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-base">🔒</span>
                <div>
                  <span className="font-bold text-blue-950 dark:text-blue-200">
                    Fonte de Dados:
                  </span>
                  <span className="text-blue-800 dark:text-blue-300 ml-1">
                    Questões do banco {selectedBankName} com taxa de acertos por matéria.
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
                  Resolva questões usando a extensão do navegador ou clique no botão acima para injetar dados de teste.
                </p>
              </div>
            ) : (
              <>
                {/* Legendas Interativas de Subjects (Clique para ativar/ocultar) */}
                <div className="flex flex-wrap items-center gap-2 pt-1 pb-2">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Matérias:
                  </span>
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
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={subjectTimeSeriesData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
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
                        formatter={(value: any, name: string) => {
                          if (value === null) return ['Sem questões', name];
                          return [`${value}% de acerto`, name];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                      {allSubjectsList.map(subj => {
                        if (hiddenSubjects.has(subj)) return null;
                        return (
                          <Line
                            key={subj}
                            type="monotone"
                            dataKey={subj}
                            name={subj}
                            stroke={subjectColorsMap[subj] || '#3b82f6'}
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                            activeDot={{ r: 6 }}
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
              Filtro ativo: <strong>{selectedBankName}</strong> • Clique em qualquer linha para abrir o Drill-down de auditoria cirúrgica.
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
