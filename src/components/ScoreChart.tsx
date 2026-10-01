import React, { useMemo, useState } from 'react';
import { format, parseISO, isAfter, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StudyLogEntry } from '../types';
import {
  ComposedChart,
  BarChart,
  LineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  ReferenceLine
} from 'recharts';
import {
  Filter,
  TrendingUp,
  CheckSquare,
  Calendar,
  Award,
  Clock,
  BookOpen,
  Activity,
  Layers,
  BarChart3,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  Eye,
  EyeOff,
  RotateCcw,
  HelpCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { useStore, StudyDeskQuestionRecord } from '../cardblocks/store/useStore';
import { cn } from '../lib/utils';
import { StatisticQuestionsModal, StatisticQuestionsFilter } from './StatisticQuestionsModal';
import { ResetStatsModal } from './ResetStatsModal';

export const SUBJECT_COLORS: Record<string, string> = {
  'Cardiologia': '#3b82f6',
  'Pneumologia': '#10b981',
  'Gastroenterologia': '#f59e0b',
  'Farmacologia': '#8b5cf6',
  'Infectologia': '#ec4899',
  'Nefrologia': '#06b6d4',
  'Pediatria': '#f97316',
  'Clínica Médica': '#6366f1',
  'Neurologia': '#e11d48',
  'Hematologia': '#a855f7',
  'Cirurgia': '#14b8a6',
  'Ginecologia & Obstetrícia': '#d946ef',
  'Psiquiatria': '#84cc16',
};

const FALLBACK_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#6366f1', '#e11d48', '#14b8a6',
  '#a855f7', '#d946ef', '#84cc16'
];

interface ScoreChartProps {
  logs?: StudyLogEntry[];
}

export function ScoreChart({ logs }: ScoreChartProps) {
  const [daysToShow, setDaysToShow] = useState<number>(30);
  const [chartViewMode, setChartViewMode] = useState<'chronological' | 'subject' | 'system'>('subject');
  const [selectedMetric, setSelectedMetric] = useState<'accuracy' | 'solveTime' | 'count'>('accuracy');
  const [subjectChartType, setSubjectChartType] = useState<'line' | 'bar'>('line');
  const [hiddenSubjects, setHiddenSubjects] = useState<Set<string>>(new Set());

  // Modais de detalhamento de questões e reset individual
  const [statModal, setStatModal] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    filter: StatisticQuestionsFilter;
  } | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [dataSourceMode, setDataSourceMode] = useState<'all' | 'questions' | 'logs'>('all');

  const {
    questions,
    studyDeskSessions,
    resetSubjectStats,
    resetSystemStats,
    resetDateStats
  } = useStore();

  // 1. Processa dados reais consolidados de resolução de questões e logs do tracker
  const {
    allRealRecords,
    chartData,
    activeDaysList,
    summaryStats,
    hasAnyData
  } = useMemo(() => {
    const records: StudyDeskQuestionRecord[] = [];

    // Extrai registros de sessões do Desk
    (studyDeskSessions || []).forEach(s => {
      if (s.questionRecords && s.questionRecords.length > 0) {
        records.push(...s.questionRecords);
      }
    });

    // Extrai questões respondidas do banco
    questions.forEach(q => {
      const isAnswered = q.status === 'correct' || q.status === 'incorrect' || (q.attempts && q.attempts.length > 0) || Boolean(q.lastAnsweredAt);
      if (isAnswered) {
        const alreadyIn = records.some(r => r.qid === q.qid || r.questionId === q.id);
        if (!alreadyIn) {
          // Determina a data real comprovada de resposta
          const realAnsweredAt = q.lastAnsweredAt || (q.attempts && q.attempts.length > 0 ? q.attempts[q.attempts.length - 1].timestamp : undefined);
          records.push({
            qid: q.qid || q.id,
            questionId: q.id,
            selectedChoiceId: q.selectedChoiceId,
            correctChoiceId: q.correctChoiceId,
            isCorrect: q.status === 'correct' || (q.attempts && q.attempts.length > 0 ? q.attempts[q.attempts.length - 1].isCorrect : false),
            resolutionTimeSeconds: q.resolutionTimeSeconds || 0,
            reviewTimeSeconds: q.reviewTimeSeconds || 0,
            subject: (q.subject || '').trim() || 'Geral',
            system: (q.system || '').trim() || 'Geral',
            answeredAt: realAnsweredAt, // NUNCA injeta Date.now() fictício!
          });
        }
      }
    });

    // Mapeamento consolidado por data real
    const byDate = new Map<string, { total: number; correct: number; solveSum: number; revSum: number; isFromLogs?: boolean }>();

    // Processa resoluções do QBank se não estiver no modo exclusivo de logs
    if (dataSourceMode !== 'logs') {
      records.forEach(r => {
        if (!r.answeredAt) return;
        const dateStr = format(new Date(r.answeredAt), 'yyyy-MM-dd');
        const cur = byDate.get(dateStr) || { total: 0, correct: 0, solveSum: 0, revSum: 0 };
        cur.total += 1;
        if (r.isCorrect) cur.correct += 1;
        cur.solveSum += (r.resolutionTimeSeconds || 0);
        cur.revSum += (r.reviewTimeSeconds || 0);
        byDate.set(dateStr, cur);
      });
    }

    // Processa logs do tracker se modo for 'all' ou 'logs'
    if (dataSourceMode !== 'questions' && logs && logs.length > 0) {
      logs.forEach(l => {
        if (!l.date) return;
        const dateStr = l.date;
        const cur = byDate.get(dateStr) || { total: 0, correct: 0, solveSum: 0, revSum: 0, isFromLogs: true };
        const amount = Number(l.amount) || (l.minutesSpent ? Math.max(1, Math.round(l.minutesSpent / 2)) : 1);
        
        if (cur.total === 0 || dataSourceMode === 'logs') {
          cur.total = amount;
          if (l.scorePercent !== undefined && l.scorePercent !== null && !isNaN(l.scorePercent)) {
            cur.correct = Math.round((amount * l.scorePercent) / 100);
          } else {
            cur.correct = Math.round(amount * 0.7);
          }
          cur.solveSum = (l.minutesSpent || 0) * 60;
          byDate.set(dateStr, cur);
        }
      });
    }

    const today = startOfDay(new Date());
    const startDate = subDays(today, Math.max(1, daysToShow - 1));
    const allDaysInInterval = eachDayOfInterval({ start: startDate, end: today });

    let cumulativeTotalQuestions = 0;
    let cumulativeCorrectQuestions = 0;
    let activeDaysCount = 0;

    const rawDailyData = allDaysInInterval.map(dayDate => {
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const dateFormatted = format(dayDate, 'dd/MM');
      const stats = byDate.get(dateStr);

      const hasQuestions = Boolean(stats && stats.total > 0);
      const questionsCount = stats ? stats.total : 0;
      const score = hasQuestions && stats ? Math.round((stats.correct / stats.total) * 100) : null;
      const avgSolveTime = hasQuestions && stats && stats.total > 0 ? Math.round(stats.solveSum / stats.total) : 0;

      if (hasQuestions && stats) {
        activeDaysCount++;
        cumulativeTotalQuestions += stats.total;
        cumulativeCorrectQuestions += stats.correct;
      }

      return {
        date: dayDate,
        dateStr,
        dateFormatted,
        questions: questionsCount,
        score,
        avgSolveTime,
        hasQuestions,
      };
    });

    // Média móvel real calculada apenas sobre dias em que houve questões
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

    const overallAvgScore = cumulativeTotalQuestions > 0
      ? Math.round((cumulativeCorrectQuestions / cumulativeTotalQuestions) * 100)
      : null;

    const avgQuestionsPerActiveDay = activeDaysCount > 0
      ? Math.round(cumulativeTotalQuestions / activeDaysCount)
      : 0;

    const summary = {
      totalQuestions: cumulativeTotalQuestions,
      overallAvgScore,
      activeDaysCount,
      totalDays: allDaysInInterval.length,
      avgQuestionsPerActiveDay,
    };

    const activeDays = rawDailyData
      .filter(d => d.hasQuestions && d.questions > 0)
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));

    return {
      allRealRecords: records,
      chartData: finalData,
      activeDaysList: activeDays,
      summaryStats: summary,
      hasAnyData: cumulativeTotalQuestions > 0 || records.length > 0,
    };
  }, [daysToShow, questions, studyDeskSessions, logs, dataSourceMode]);

  // 2. Processa dados reais por Subject e por System (ESTRITAMENTE SEM DADOS INVENTADOS)
  const { subjectBreakdown, systemBreakdown } = useMemo(() => {
    if (allRealRecords.length === 0) {
      return {
        subjectBreakdown: [],
        systemBreakdown: []
      };
    }

    const bySubj = new Map<string, { total: number; correct: number; solveSum: number; revSum: number }>();
    const bySys = new Map<string, { total: number; correct: number; solveSum: number; revSum: number }>();

    allRealRecords.forEach(r => {
      const subj = (r.subject || 'Sem Matéria Definida').trim();
      const sys = (r.system || 'Geral').trim();

      const subEntry = bySubj.get(subj) || { total: 0, correct: 0, solveSum: 0, revSum: 0 };
      subEntry.total += 1;
      if (r.isCorrect) subEntry.correct += 1;
      subEntry.solveSum += r.resolutionTimeSeconds || 0;
      subEntry.revSum += r.reviewTimeSeconds || 0;
      bySubj.set(subj, subEntry);

      const sysEntry = bySys.get(sys) || { total: 0, correct: 0, solveSum: 0, revSum: 0 };
      sysEntry.total += 1;
      if (r.isCorrect) sysEntry.correct += 1;
      sysEntry.solveSum += r.resolutionTimeSeconds || 0;
      sysEntry.revSum += r.reviewTimeSeconds || 0;
      bySys.set(sys, sysEntry);
    });

    const subjectBreakdown = Array.from(bySubj.entries()).map(([name, data]) => ({
      name,
      total: data.total,
      correct: data.correct,
      incorrect: data.total - data.correct,
      accuracy: Math.round((data.correct / data.total) * 100),
      avgSolveTime: data.total > 0 ? Math.round(data.solveSum / data.total) : 0,
      avgRevTime: data.total > 0 ? Math.round(data.revSum / data.total) : 0,
    })).sort((a, b) => b.total - a.total);

    const systemBreakdown = Array.from(bySys.entries()).map(([name, data]) => ({
      name,
      total: data.total,
      correct: data.correct,
      incorrect: data.total - data.correct,
      accuracy: Math.round((data.correct / data.total) * 100),
      avgSolveTime: data.total > 0 ? Math.round(data.solveSum / data.total) : 0,
      avgRevTime: data.total > 0 ? Math.round(data.revSum / data.total) : 0,
    })).sort((a, b) => b.total - a.total);

    return {
      subjectBreakdown,
      systemBreakdown,
    };
  }, [allRealRecords]);

  // 3. Processa dados multi-série dos Subjects ao longo do tempo (apenas dados reais capturados)
  const { multiSubjectTimelineData, availableSubjectsList } = useMemo(() => {
    const subjects = subjectBreakdown.map(s => s.name);
    if (subjects.length === 0 || allRealRecords.length === 0) {
      return {
        multiSubjectTimelineData: [],
        availableSubjectsList: [],
      };
    }

    const today = startOfDay(new Date());
    const startDate = subDays(today, Math.max(1, daysToShow - 1));
    const allDaysInInterval = eachDayOfInterval({ start: startDate, end: today });

    // Mapeamento diário real: dateStr -> subject -> stats
    const dailyMap = new Map<string, Map<string, { total: number; correct: number; solveSum: number }>>();

    allRealRecords.forEach(r => {
      if (!r.answeredAt) return;
      const dStr = format(new Date(r.answeredAt), 'yyyy-MM-dd');
      if (!dailyMap.has(dStr)) {
        dailyMap.set(dStr, new Map());
      }
      const sMap = dailyMap.get(dStr)!;
      const subj = (r.subject || 'Sem Matéria Definida').trim();
      const cur = sMap.get(subj) || { total: 0, correct: 0, solveSum: 0 };
      cur.total += 1;
      if (r.isCorrect) cur.correct += 1;
      cur.solveSum += (r.resolutionTimeSeconds || 0);
      sMap.set(subj, cur);
    });

    // Constrói linha do tempo estritamente baseada nas questões reais acumuladas ou pontuais
    const runningSubj: Record<string, { total: number; correct: number; solveSum: number }> = {};
    subjects.forEach(s => {
      runningSubj[s] = { total: 0, correct: 0, solveSum: 0 };
    });

    const timeline = allDaysInInterval.map(dayDate => {
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const dateFormatted = format(dayDate, 'dd/MM');
      const row: Record<string, any> = {
        dateStr,
        dateFormatted,
      };

      const daySubjs = dailyMap.get(dateStr);

      subjects.forEach(subj => {
        if (daySubjs && daySubjs.has(subj)) {
          const item = daySubjs.get(subj)!;
          runningSubj[subj].total += item.total;
          runningSubj[subj].correct += item.correct;
          runningSubj[subj].solveSum += item.solveSum;

          if (selectedMetric === 'accuracy') {
            row[subj] = Math.round((runningSubj[subj].correct / runningSubj[subj].total) * 100);
          } else if (selectedMetric === 'solveTime') {
            row[subj] = Math.round(item.solveSum / item.total);
          } else {
            row[subj] = item.total;
          }
        } else {
          // Se não houve questões respondidas nesse dia para essa matéria
          if (runningSubj[subj].total > 0) {
            // Mantém a precisão acumulada até agora
            row[subj] = selectedMetric === 'accuracy'
              ? Math.round((runningSubj[subj].correct / runningSubj[subj].total) * 100)
              : selectedMetric === 'count'
              ? 0
              : null;
          } else {
            // Matéria ainda não foi respondida nessa data
            row[subj] = null;
          }
        }
      });

      return row;
    });

    return {
      multiSubjectTimelineData: timeline,
      availableSubjectsList: subjects,
    };
  }, [allRealRecords, subjectBreakdown, daysToShow, selectedMetric]);

  const toggleSubjectFilter = (subjName: string) => {
    setHiddenSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subjName)) {
        next.delete(subjName);
      } else {
        if (next.size < availableSubjectsList.length - 1) {
          next.add(subjName);
        }
      }
      return next;
    });
  };

  const formatSec = (sec: number) => {
    if (!sec) return '—';
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m === 0) return `${rem}s`;
    return `${m}m ${rem.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs mt-6 flex flex-col gap-6">
      {/* Header com Switcher de Modo e Botão de Reset Individual */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
              Gráfico de Desempenho & Métricas
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              Dados 100% Reais
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Estatísticas geradas exclusivamente a partir das questões capturadas pela extensão e resolvidas por você.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão de Reset Granular de Estatísticas */}
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Abrir painel para zerar estatísticas com controle individual"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
            <span>Resetar Estatísticas</span>
          </button>

          {/* Abas de visualização */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => setChartViewMode('chronological')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                chartViewMode === 'chronological'
                  ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              )}
            >
              📅 Geral (Dias & Tendência)
            </button>
            <button
              onClick={() => setChartViewMode('subject')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                chartViewMode === 'subject'
                  ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              )}
            >
              <span>📚 Subjects (Gráfico Único)</span>
            </button>
            <button
              onClick={() => setChartViewMode('system')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                chartViewMode === 'system'
                  ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              )}
            >
              🩺 Por System
            </button>
          </div>

          {/* Fonte de Dados: Consolidado vs Questões vs Logs */}
          <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setDataSourceMode('all')}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                dataSourceMode === 'all'
                  ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 font-bold shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              )}
              title="Exibe dados consolidados de Questões capturadas e Logs de Estudo do Tracker"
            >
              ⚡ Geral
            </button>
            <button
              type="button"
              onClick={() => setDataSourceMode('questions')}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                dataSourceMode === 'questions'
                  ? "bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-300 font-bold shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              )}
              title="Exibe apenas questões reais capturadas pela extensão e resolvidas no Desk"
            >
              🎯 Questões
            </button>
            {logs && logs.length > 0 && (
              <button
                type="button"
                onClick={() => setDataSourceMode('logs')}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                  dataSourceMode === 'logs'
                    ? "bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-300 font-bold shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                )}
                title="Exibe apenas os logs manuais e automáticos registrados no Study Tracker"
              >
                📋 Logs
              </button>
            )}
          </div>

          {/* Metric Selector (for Subject/System views) */}
          {chartViewMode !== 'chronological' && (
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="text-xs bg-gray-100 dark:bg-gray-800 border-none rounded-xl px-3 py-1.5 font-bold text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="accuracy">🎯 Taxa de Acertos (%)</option>
              <option value="solveTime">⏱️ Tempo de Resolução (seg)</option>
              <option value="count">📊 Volume de Questões</option>
            </select>
          )}

          {chartViewMode !== 'system' && (
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold">
              {[7, 14, 30, 60, 90].map((days) => (
                <button
                  key={days}
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
          )}
        </div>
      </div>

      {/* SUMMARY STATS TILES (Clicáveis para inspecionar questões) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => {
            setStatModal({
              isOpen: true,
              title: 'Todas as Questões Respondidas',
              subtitle: 'Todas as questões capturadas pela extensão que possuem respostas computadas.',
              filter: {}
            });
          }}
          className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 hover:border-blue-300 transition-all cursor-pointer group"
          title="Clique para ver todas as questões respondidas"
        >
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-bold mb-1">
            <div className="flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Total de Questões</span>
            </div>
            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-blue-950 dark:text-blue-100">
            {chartViewMode === 'chronological' ? summaryStats.totalQuestions : allRealRecords.length}
          </div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
            <span>{summaryStats.activeDaysCount} dias com questões</span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold group-hover:underline">Ver questões →</span>
          </span>
        </div>

        <div
          onClick={() => {
            setStatModal({
              isOpen: true,
              title: 'Questões Corretas (Acertos)',
              subtitle: 'Lista de todas as questões respondidas corretamente.',
              filter: { status: 'correct' }
            });
          }}
          className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 hover:border-emerald-300 transition-all cursor-pointer group"
          title="Clique para ver apenas as questões acertadas"
        >
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-1">
            <div className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              <span>Taxa Média de Acerto</span>
            </div>
            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-950 dark:text-emerald-100">
            {summaryStats.overallAvgScore !== null ? `${summaryStats.overallAvgScore}%` : '—'}
          </div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
            <span>Média ponderada real</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold group-hover:underline">Ver acertos →</span>
          </span>
        </div>

        <div
          onClick={() => {
            setStatModal({
              isOpen: true,
              title: 'Questões Incorretas (Erros)',
              subtitle: 'Lista de todas as questões que precisam de revisão.',
              filter: { status: 'incorrect' }
            });
          }}
          className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 hover:border-rose-300 transition-all cursor-pointer group"
          title="Clique para ver as questões incorretas"
        >
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-bold mb-1">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Questões Incorretas</span>
            </div>
            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-rose-950 dark:text-rose-100">
            {allRealRecords.filter(r => !r.isCorrect).length}
          </div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
            <span>Para revisão ativa</span>
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold group-hover:underline">Ver erros →</span>
          </span>
        </div>

        <div
          onClick={() => {
            setStatModal({
              isOpen: true,
              title: 'Total de Matérias Registradas',
              subtitle: 'Subjects identificados a partir das questões capturadas.',
              filter: {}
            });
          }}
          className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 hover:border-purple-300 transition-all cursor-pointer group"
          title="Clique para ver o inventário completo"
        >
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 text-xs font-bold mb-1">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Matérias (Subjects)</span>
            </div>
            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-purple-950 dark:text-purple-100">
            {subjectBreakdown.length}
          </div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
            <span>{systemBreakdown.length} sistemas detectados</span>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold group-hover:underline">Explorar →</span>
          </span>
        </div>
      </div>

      {/* CASO NÃO HAJA DADOS REAIS AINDA: EMPTY STATE LIMPO */}
      {!hasAnyData && (
        <div className="p-10 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 text-center flex flex-col items-center justify-center gap-3 bg-gray-50/50 dark:bg-gray-850/30">
          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-500">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
            Nenhuma questão respondida ainda
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md leading-relaxed">
            O sistema agora não inventa nem simula dados. Conforme você capturar questões com a extensão e respondê-las, este gráfico exibirá com exatidão sua taxa real de acertos por matéria e por data.
          </p>
        </div>
      )}

      {/* RENDERIZAÇÃO DOS GRÁFICOS (APENAS QUANDO HOUVER DADOS REAIS) */}
      {hasAnyData && (
        <>
          {chartViewMode === 'chronological' ? (
            /* Modo 1: Histórico Geral Cronológico */
            <div className="space-y-3">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="dateFormatted" tick={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      stroke="#3b82f6"
                      domain={[0, 'auto']}
                      tick={{ fontSize: 11 }}
                      label={{ value: 'Questões', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#3b82f6' }}
                    />
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
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '12px',
                      }}
                      formatter={(value: any, name: string) => {
                        if (name === 'Questões Resolvidas') return [`${value} questões`, name];
                        if (name === 'Taxa de Acertos') return [value !== null ? `${value}%` : 'Sem questões', name];
                        if (name === 'Tendência (Média Móvel)') return [value !== null ? `${value}%` : '—', name];
                        return [value, name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar
                      yAxisId="left"
                      dataKey="questions"
                      name="Questões Resolvidas"
                      fill="#3b82f6"
                      opacity={0.85}
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={(data: any) => {
                        if (data && data.dateStr) {
                          setStatModal({
                            isOpen: true,
                            title: `Questões Resolvidas em ${data.dateFormatted}`,
                            subtitle: `Questões computadas na data ${data.dateStr}`,
                            filter: { dateStr: data.dateStr }
                          });
                        }
                      }}
                    />
                    <Line yAxisId="right" type="monotone" dataKey="score" name="Taxa de Acertos" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                    <Line yAxisId="right" type="monotone" dataKey="trend" name="Tendência (Média Móvel)" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="4 4" dot={false} connectNulls={true} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela de Dias em que Houve Resolução Real de Questões */}
              <div className="space-y-2.5 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Detalhamento dos Dias com Questões Resolvidas:</span>
                  </div>
                  <span className="text-gray-400">
                    {activeDaysList.length} {activeDaysList.length === 1 ? 'dia ativo' : 'dias ativos'} no período
                  </span>
                </div>

                {activeDaysList.length === 0 ? (
                  <div className="p-6 rounded-xl border border-gray-100 dark:border-gray-800 text-center text-xs text-gray-400 bg-gray-50/50 dark:bg-gray-850/30">
                    Nenhuma questão respondida nos últimos {daysToShow} dias. Conforme você resolver questões, os dias aparecerão aqui.
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="p-3">Data</th>
                          <th className="p-3 text-center">Questões Resolvidas</th>
                          <th className="p-3 text-center">Aproveitamento (%)</th>
                          <th className="p-3 text-center">Tempo Médio Resolução</th>
                          <th className="p-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                        {activeDaysList.map((day) => {
                          const [y, m, d] = day.dateStr.split('-');
                          const formattedDate = `${d}/${m}/${y}`;
                          return (
                            <tr
                              key={day.dateStr}
                              onClick={() => {
                                setStatModal({
                                  isOpen: true,
                                  title: `Questões Resolvidas em ${formattedDate}`,
                                  subtitle: `Exibindo as ${day.questions} questões computadas nesta data`,
                                  filter: { dateStr: day.dateStr }
                                });
                              }}
                              className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors cursor-pointer group"
                            >
                              <td className="p-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span>{formattedDate}</span>
                              </td>
                              <td className="p-3 text-center font-bold text-blue-600 dark:text-blue-400">
                                {day.questions} {day.questions === 1 ? 'questão' : 'questões'}
                              </td>
                              <td className="p-3 text-center font-bold">
                                <span className={cn(
                                  "px-2.5 py-0.5 rounded-full text-xs font-black",
                                  (day.score || 0) >= 70 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" :
                                  (day.score || 0) >= 50 ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" :
                                  "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                )}>
                                  {day.score !== null ? `${day.score}%` : '—'}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono text-gray-500">
                                {formatSec(day.avgSolveTime)}
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-1">
                                    <span>Ver {day.questions} Questões</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </span>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm(`Zerar o histórico das ${day.questions} questões respondidas em ${formattedDate}?`)) {
                                        resetDateStats(day.dateStr);
                                      }
                                    }}
                                    className="p-1 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                                    title={`Zerar histórico deste dia (${formattedDate})`}
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : chartViewMode === 'subject' ? (
            /* Modo 2: GRÁFICO ÚNICO COM TODOS OS SUBJECTS REAIS E LEGENDA FILTRÁVEL */
            <div className="space-y-5">
              {/* Sub-header com tipo de gráfico (Linhas vs Barras) e dica */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Formato:</span>
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setSubjectChartType('line')}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                        subjectChartType === 'line'
                          ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs"
                          : "text-gray-500 hover:text-gray-900"
                      )}
                    >
                      📈 Multi-Linhas (Evolução)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubjectChartType('bar')}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                        subjectChartType === 'bar'
                          ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs"
                          : "text-gray-500 hover:text-gray-900"
                      )}
                    >
                      📊 Barras Comparativas
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                  <span>💡</span>
                  <span>Clique nos itens da legenda para ocultar ou no nome da matéria para inspecionar as questões.</span>
                </div>
              </div>

              {/* O Gráfico Único */}
              <div className="h-72 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {subjectChartType === 'line' ? (
                    <LineChart
                      data={multiSubjectTimelineData}
                      margin={{ top: 15, right: 15, left: -20, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="dateFormatted" tick={{ fontSize: 11 }} />
                      <YAxis
                        domain={selectedMetric === 'accuracy' ? [0, 100] : [0, 'auto']}
                        tick={{ fontSize: 11 }}
                        label={{
                          value: selectedMetric === 'accuracy' ? 'Acertos (%)' : selectedMetric === 'count' ? 'Questões' : 'Tempo (s)',
                          angle: -90,
                          position: 'insideLeft',
                          fontSize: 10,
                          fill: '#94a3b8'
                        }}
                      />
                      {selectedMetric === 'accuracy' && (
                        <ReferenceLine
                          y={70}
                          stroke="#10b981"
                          strokeDasharray="4 4"
                          label={{ value: 'Meta USMLE: 70%', fill: '#10b981', fontSize: 10, position: 'right' }}
                        />
                      )}
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          color: '#fff',
                          borderRadius: '12px',
                          border: 'none',
                          fontSize: '12px',
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                        }}
                        formatter={(val: any, name: string) => {
                          if (selectedMetric === 'accuracy') return [`${val}%`, name];
                          if (selectedMetric === 'solveTime') return [`${val}s`, name];
                          return [`${val} questões`, name];
                        }}
                      />
                      {availableSubjectsList.map((subj, idx) => {
                        const isHidden = hiddenSubjects.has(subj);
                        const color = SUBJECT_COLORS[subj] || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
                        return (
                          <Line
                            key={subj}
                            type="monotone"
                            dataKey={subj}
                            name={subj}
                            stroke={color}
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                            activeDot={{ r: 6 }}
                            connectNulls={true}
                            hide={isHidden}
                          />
                        );
                      })}
                    </LineChart>
                  ) : (
                    <BarChart
                      data={subjectBreakdown.filter(s => !hiddenSubjects.has(s.name))}
                      margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11 }} domain={selectedMetric === 'accuracy' ? [0, 100] : [0, 'auto']} />
                      {selectedMetric === 'accuracy' && (
                        <ReferenceLine
                          y={70}
                          stroke="#10b981"
                          strokeDasharray="4 4"
                          label={{ value: 'Meta: 70%', fill: '#10b981', fontSize: 10, position: 'right' }}
                        />
                      )}
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          color: '#fff',
                          borderRadius: '8px',
                          border: 'none',
                          fontSize: '12px'
                        }}
                        formatter={(val: any) => {
                          if (selectedMetric === 'accuracy') return [`${val}%`, 'Taxa de Acertos'];
                          if (selectedMetric === 'solveTime') return [`${formatSec(Number(val))}`, 'Tempo Médio Resolução'];
                          return [`${val} questões`, 'Total de Questões'];
                        }}
                      />
                      <Bar
                        dataKey={
                          selectedMetric === 'accuracy' ? 'accuracy' :
                          selectedMetric === 'solveTime' ? 'avgSolveTime' : 'total'
                        }
                        radius={[6, 6, 0, 0]}
                        cursor="pointer"
                        onClick={(entry: any) => {
                          if (entry && entry.name) {
                            setStatModal({
                              isOpen: true,
                              title: `Questões de ${entry.name}`,
                              subtitle: `Todas as questões capturadas da matéria ${entry.name}`,
                              filter: { subject: entry.name }
                            });
                          }
                        }}
                      >
                        {subjectBreakdown.filter(s => !hiddenSubjects.has(s.name)).map((entry, index) => {
                          const color = SUBJECT_COLORS[entry.name] || FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Legenda Interativa com Filtro por Clique e Botão de Inspecionar Questões */}
              <div className="p-3.5 rounded-2xl bg-gray-50/80 dark:bg-gray-850/80 border border-gray-200/80 dark:border-gray-800 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 font-bold">
                    <Filter className="w-3.5 h-3.5 text-blue-600" />
                    <span>Legenda dos Subjects Reais (Clique para filtrar no gráfico):</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHiddenSubjects(new Set())}
                      className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                    >
                      Mostrar Todos
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (availableSubjectsList.length > 1) {
                          setHiddenSubjects(new Set(availableSubjectsList.slice(1)));
                        }
                      }}
                      className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                      Isolar Primeiro
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {availableSubjectsList.map((subj, idx) => {
                    const isHidden = hiddenSubjects.has(subj);
                    const color = SUBJECT_COLORS[subj] || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
                    const match = subjectBreakdown.find(s => s.name === subj);

                    return (
                      <div
                        key={subj}
                        className={cn(
                          "px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border select-none",
                          !isHidden
                            ? "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 shadow-2xs"
                            : "bg-gray-100 dark:bg-gray-900 border-dashed border-gray-300 dark:border-gray-800 opacity-40 text-gray-400"
                        )}
                      >
                        {/* Toggle visibility */}
                        <button
                          type="button"
                          onClick={() => toggleSubjectFilter(subj)}
                          className="flex items-center gap-1.5 cursor-pointer hover:opacity-80"
                          title={isHidden ? `Clique para reexibir ${subj}` : `Clique para ocultar ${subj}`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: isHidden ? '#9ca3af' : color }}
                          />
                          <span className={cn(isHidden && "line-through")}>{subj}</span>
                        </button>

                        {/* Open Questions of Subject */}
                        <button
                          type="button"
                          onClick={() => {
                            setStatModal({
                              isOpen: true,
                              title: `Questões de ${subj}`,
                              subtitle: `Visualizando as ${match?.total || 0} questões capturadas de ${subj}`,
                              filter: { subject: subj }
                            });
                          }}
                          className="ml-1 p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded text-blue-600 dark:text-blue-400 cursor-pointer"
                          title={`Ver questões reais de ${subj}`}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>

                        {match && (
                          <span className="text-[10px] font-normal px-1 rounded-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {selectedMetric === 'accuracy' ? `${match.accuracy}%` : selectedMetric === 'count' ? `${match.total}q` : `${match.avgSolveTime}s`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tabela Resumo dos Subjects (Linhas clicáveis para abrir questões) */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Subject / Matéria Real</th>
                      <th className="p-3 text-center">Questões</th>
                      <th className="p-3 text-center">Acertos (%)</th>
                      <th className="p-3 text-center">Tempo Médio Resolução</th>
                      <th className="p-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                    {subjectBreakdown.map((item, idx) => {
                      const isHidden = hiddenSubjects.has(item.name);
                      const color = SUBJECT_COLORS[item.name] || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
                      return (
                        <tr
                          key={idx}
                          onClick={() => {
                            setStatModal({
                              isOpen: true,
                              title: `Questões de ${item.name}`,
                              subtitle: `Lista de questões capturadas para a matéria ${item.name}`,
                              filter: { subject: item.name }
                            });
                          }}
                          className={cn(
                            "hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors cursor-pointer group",
                            isHidden && "opacity-50"
                          )}
                        >
                          <td className="p-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span>{item.name}</span>
                          </td>
                          <td className="p-3 text-center font-semibold">{item.total}</td>
                          <td className="p-3 text-center font-bold">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-xs font-black",
                              item.accuracy >= 70 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" :
                              item.accuracy >= 50 ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" :
                              "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                            )}>
                              {item.accuracy}%
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono">{formatSec(item.avgSolveTime)}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-1">
                                <span>Ver {item.total} Questões</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Zerar estatísticas da matéria "${item.name}"? As ${item.total} questões voltarão ao status inicial não respondidas.`)) {
                                    resetSubjectStats(item.name);
                                  }
                                }}
                                className="p-1 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                                title={`Zerar estatísticas da matéria ${item.name}`}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Modo 3: Por System */
            <div className="space-y-6">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={systemBreakdown}
                    margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11 }} domain={selectedMetric === 'accuracy' ? [0, 100] : [0, 'auto']} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        color: '#fff',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '12px'
                      }}
                      formatter={(val: any) => {
                        if (selectedMetric === 'accuracy') return [`${val}%`, 'Taxa de Acertos'];
                        if (selectedMetric === 'solveTime') return [`${formatSec(Number(val))}`, 'Tempo Médio Resolução'];
                        return [`${val} questões`, 'Total de Questões'];
                      }}
                    />
                    <Bar
                      dataKey={
                        selectedMetric === 'accuracy' ? 'accuracy' :
                        selectedMetric === 'solveTime' ? 'avgSolveTime' : 'total'
                      }
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={(entry: any) => {
                        if (entry && entry.name) {
                          setStatModal({
                            isOpen: true,
                            title: `Questões do Sistema ${entry.name}`,
                            subtitle: `Questões reais registradas neste sistema`,
                            filter: { system: entry.name }
                          });
                        }
                      }}
                    >
                      {systemBreakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            selectedMetric === 'accuracy'
                              ? entry.accuracy >= 70 ? '#10b981' : entry.accuracy >= 55 ? '#f59e0b' : '#ef4444'
                              : '#8b5cf6'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela de Sistemas (Linhas clicáveis para abrir questões) */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3">System / Sistema Real</th>
                      <th className="p-3 text-center">Questões</th>
                      <th className="p-3 text-center">Acertos (%)</th>
                      <th className="p-3 text-center">Tempo Médio Resolução</th>
                      <th className="p-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                    {systemBreakdown.map((item, idx) => (
                      <tr
                        key={idx}
                        onClick={() => {
                          setStatModal({
                            isOpen: true,
                            title: `Questões do Sistema ${item.name}`,
                            subtitle: `Lista de questões capturadas pertencentes ao sistema ${item.name}`,
                            filter: { system: item.name }
                          });
                        }}
                        className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors cursor-pointer group"
                      >
                        <td className="p-3 font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <span>🩺</span>
                          <span>{item.name}</span>
                        </td>
                        <td className="p-3 text-center font-semibold">{item.total}</td>
                        <td className="p-3 text-center font-bold">
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-xs font-black",
                            item.accuracy >= 70 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" :
                            item.accuracy >= 50 ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" :
                            "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                          )}>
                            {item.accuracy}%
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono">{formatSec(item.avgSolveTime)}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-1">
                              <span>Ver {item.total} Questões</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Zerar estatísticas do sistema "${item.name}"? As ${item.total} questões voltarão ao status inicial não respondidas.`)) {
                                  resetSystemStats(item.name);
                                }
                              }}
                              className="p-1 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                              title={`Zerar estatísticas do sistema ${item.name}`}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de Questões Associadas a Qualquer Estatística Clicada */}
      {statModal && (
        <StatisticQuestionsModal
          isOpen={statModal.isOpen}
          onClose={() => setStatModal(null)}
          title={statModal.title}
          subtitle={statModal.subtitle}
          filter={statModal.filter}
        />
      )}

      {/* Modal de Reset Individual de Estatísticas */}
      <ResetStatsModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
      />
    </div>
  );
}
