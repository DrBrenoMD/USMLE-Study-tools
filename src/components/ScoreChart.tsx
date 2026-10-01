import React, { useMemo, useState } from 'react';
import { format, parseISO, subDays, eachDayOfInterval, startOfDay, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StudyLogEntry } from '../types';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  CheckSquare,
  Award,
  Clock,
  Calendar,
  Layers,
  BookOpen,
  Filter,
  BarChart3,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { useStore } from '../cardblocks/store/useStore';
import { cn } from '../lib/utils';

interface ScoreChartProps {
  logs?: StudyLogEntry[];
}

export function ScoreChart({ logs = [] }: ScoreChartProps) {
  const [daysToShow, setDaysToShow] = useState<number>(30); // 7, 14, 30, 60, 90, or 0 (todos)

  const { questions, studyDeskSessions } = useStore();

  // Consolidação diária: logs do tracker + questões respondidas
  const { chartData, summaryStats, activeDaysList, hasAnyData } = useMemo(() => {
    // 1. Mapa de data (YYYY-MM-DD) -> estatísticas diárias
    const dailyMap = new Map<string, {
      totalQuestions: number;
      correctQuestions: number;
      hasExplicitScore: boolean;
      scoreWeightedSum: number;
      scoreWeightCount: number;
      totalMinutes: number;
      resources: Set<string>;
      notes: string[];
    }>();

    const getOrCreateDay = (dStr: string) => {
      let entry = dailyMap.get(dStr);
      if (!entry) {
        entry = {
          totalQuestions: 0,
          correctQuestions: 0,
          hasExplicitScore: false,
          scoreWeightedSum: 0,
          scoreWeightCount: 0,
          totalMinutes: 0,
          resources: new Set<string>(),
          notes: []
        };
        dailyMap.set(dStr, entry);
      }
      return entry;
    };

    // Processa logs do Study Tracker
    (logs || []).forEach(log => {
      if (!log.date) return;
      const entry = getOrCreateDay(log.date);

      if (log.resourceName) {
        entry.resources.add(log.resourceName);
      }
      if (log.notes && log.notes.trim()) {
        entry.notes.push(log.notes.trim());
      }
      entry.totalMinutes += log.minutesSpent || 0;

      const isQBankOrQuestions =
        log.resourceType === 'qbank' ||
        log.resourceType === 'nbme' ||
        (log.unit && log.unit.toLowerCase().includes('quest')) ||
        log.scorePercent !== undefined;

      const amount = Number(log.amount) || (log.minutesSpent ? Math.max(1, Math.round(log.minutesSpent / 2)) : 0);

      if (isQBankOrQuestions && amount > 0) {
        entry.totalQuestions += amount;

        if (log.scorePercent !== undefined && log.scorePercent !== null && !isNaN(Number(log.scorePercent))) {
          const score = Number(log.scorePercent);
          const correct = Math.round((amount * score) / 100);
          entry.correctQuestions += correct;
          entry.scoreWeightedSum += score * amount;
          entry.scoreWeightCount += amount;
          entry.hasExplicitScore = true;
        }
      }
    });

    // Processa questões resolvidas capturadas da extensão / Desk
    // Evita duplicar se já foi adicionado pelo log do mesmo dia
    const deskRecordsDateCount = new Map<string, { total: number; correct: number; minutes: number }>();
    (studyDeskSessions || []).forEach(s => {
      if (s.questionRecords && s.questionRecords.length > 0) {
        s.questionRecords.forEach(r => {
          if (!r.answeredAt) return;
          const dStr = format(new Date(r.answeredAt), 'yyyy-MM-dd');
          const cur = deskRecordsDateCount.get(dStr) || { total: 0, correct: 0, minutes: 0 };
          cur.total += 1;
          if (r.isCorrect) cur.correct += 1;
          cur.minutes += Math.round((r.resolutionTimeSeconds || 0) / 60);
          deskRecordsDateCount.set(dStr, cur);
        });
      }
    });

    (questions || []).forEach(q => {
      const isAnswered = q.status === 'correct' || q.status === 'incorrect';
      if (isAnswered && q.lastAnsweredAt) {
        const dStr = format(new Date(q.lastAnsweredAt), 'yyyy-MM-dd');
        const cur = deskRecordsDateCount.get(dStr) || { total: 0, correct: 0, minutes: 0 };
        // se já contamos pelo session, não soma duas vezes
        cur.total += 1;
        if (q.status === 'correct') cur.correct += 1;
        deskRecordsDateCount.set(dStr, cur);
      }
    });

    deskRecordsDateCount.forEach((val, dStr) => {
      const entry = getOrCreateDay(dStr);
      // Se não havia questões desse dia via logs manuais, usa as questões do QBank
      if (entry.totalQuestions === 0) {
        entry.totalQuestions = val.total;
        entry.correctQuestions = val.correct;
        entry.scoreWeightedSum = Math.round((val.correct / Math.max(1, val.total)) * 100) * val.total;
        entry.scoreWeightCount = val.total;
        entry.hasExplicitScore = true;
        entry.resources.add('QBank / Desk');
      }
    });

    // Determina o intervalo de datas
    const today = startOfDay(new Date());
    let intervalDays: Date[] = [];

    if (daysToShow > 0) {
      const startDate = subDays(today, daysToShow - 1);
      intervalDays = eachDayOfInterval({ start: startDate, end: today });
    } else {
      // Todos os dias: do dia mais antigo até hoje
      let minDateStr = format(today, 'yyyy-MM-dd');
      dailyMap.forEach((_, dStr) => {
        if (dStr < minDateStr) minDateStr = dStr;
      });
      const startDate = parseISO(minDateStr);
      intervalDays = eachDayOfInterval({ start: startDate, end: today });
    }

    let cumulativeTotalQuestions = 0;
    let cumulativeCorrectQuestions = 0;
    let activeDaysCount = 0;

    // 2. Mapeia dados diários para o gráfico
    const rawData = intervalDays.map(dayDate => {
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const dateFormatted = format(dayDate, 'dd/MM');
      const dayOfWeekShort = format(dayDate, 'EEE', { locale: ptBR });
      const stats = dailyMap.get(dateStr);

      const questionsCount = stats ? stats.totalQuestions : 0;
      let score: number | null = null;

      if (stats && stats.totalQuestions > 0) {
        if (stats.hasExplicitScore && stats.scoreWeightCount > 0) {
          score = Math.round(stats.scoreWeightedSum / stats.scoreWeightCount);
        } else if (stats.correctQuestions > 0) {
          score = Math.round((stats.correctQuestions / stats.totalQuestions) * 100);
        }
      }

      const hasQuestions = questionsCount > 0;

      if (hasQuestions) {
        activeDaysCount++;
        cumulativeTotalQuestions += questionsCount;
        if (score !== null) {
          cumulativeCorrectQuestions += Math.round((questionsCount * score) / 100);
        } else {
          cumulativeCorrectQuestions += stats ? stats.correctQuestions : 0;
        }
      }

      return {
        date: dayDate,
        dateStr,
        dateFormatted,
        dayOfWeekShort,
        questions: questionsCount,
        score,
        hasQuestions,
        minutes: stats ? stats.totalMinutes : 0,
        resources: stats ? Array.from(stats.resources) : [],
        notes: stats ? stats.notes : []
      };
    });

    // 3. Calcula Média Móvel (Tendência) ponderada apenas sobre dias com questões
    const processedData = rawData.map((day, idx, arr) => {
      if (!day.hasQuestions || day.score === null) {
        return {
          ...day,
          trend: null
        };
      }

      // Janela de até 4 dias ativos anteriores
      const activeWindow: Array<{ score: number; questions: number }> = [];
      for (let i = idx; i >= 0 && activeWindow.length < 4; i--) {
        const prev = arr[i];
        if (prev.hasQuestions && prev.score !== null) {
          activeWindow.push({ score: prev.score, questions: Math.max(1, prev.questions) });
        }
      }

      const totalWeight = activeWindow.reduce((s, it) => s + it.questions, 0);
      const weightedSum = activeWindow.reduce((s, it) => s + it.score * it.questions, 0);
      const trendScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : day.score;

      return {
        ...day,
        trend: trendScore
      };
    });

    // 4. Métricas consolidadas
    const overallAvgScore = cumulativeTotalQuestions > 0
      ? Math.round((cumulativeCorrectQuestions / cumulativeTotalQuestions) * 100)
      : null;

    const avgPerActiveDay = activeDaysCount > 0
      ? Math.round(cumulativeTotalQuestions / activeDaysCount)
      : 0;

    const summary = {
      totalQuestions: cumulativeTotalQuestions,
      overallAvgScore,
      activeDaysCount,
      avgPerActiveDay
    };

    const activeList = processedData
      .filter(d => d.hasQuestions)
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));

    return {
      chartData: processedData,
      summaryStats: summary,
      activeDaysList: activeList,
      hasAnyData: cumulativeTotalQuestions > 0 || activeList.length > 0
    };
  }, [logs, questions, studyDeskSessions, daysToShow]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs mt-6 flex flex-col gap-6">
      {/* Header com Título e Filtro de Dias */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
              Desempenho Geral / Histórico de Questões
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              Gráfico Geral
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Acompanhe seu volume diário de questões e evolução da taxa de acertos ao longo do tempo.
          </p>
        </div>

        {/* Filtros de Período (7d, 14d, 30d, 60d, 90d, Todos) */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
          {[
            { label: '7d', value: 7 },
            { label: '14d', value: 14 },
            { label: '30d', value: 30 },
            { label: '60d', value: 60 },
            { label: '90d', value: 90 },
            { label: 'Tudo', value: 0 }
          ].map((period) => (
            <button
              key={period.value}
              type="button"
              onClick={() => setDaysToShow(period.value)}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                daysToShow === period.value
                  ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 font-bold shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              )}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Total de Questões */}
        <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs font-bold mb-1">
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Total de Questões</span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-blue-950 dark:text-blue-100">
            {summaryStats.totalQuestions}
          </div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            No período selecionado
          </span>
        </div>

        {/* Card 2: Taxa Média de Acertos */}
        <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-1">
            <Award className="w-3.5 h-3.5" />
            <span>Taxa Média de Acertos</span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-950 dark:text-emerald-100">
            {summaryStats.overallAvgScore !== null ? `${summaryStats.overallAvgScore}%` : '—'}
          </div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {summaryStats.overallAvgScore !== null && summaryStats.overallAvgScore >= 70 ? '🎯 Meta atingida' : 'Média ponderada'}
          </span>
        </div>

        {/* Card 3: Dias Ativos */}
        <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 text-xs font-bold mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Dias de Prática</span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-indigo-950 dark:text-indigo-100">
            {summaryStats.activeDaysCount}
          </div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {daysToShow > 0 ? `Em ${daysToShow} dias` : 'Histórico completo'}
          </span>
        </div>

        {/* Card 4: Média por Dia Ativo */}
        <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
          <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 text-xs font-bold mb-1">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Média / Dia Ativo</span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-purple-950 dark:text-purple-100">
            {summaryStats.avgPerActiveDay}
          </div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            questões por dia de estudo
          </span>
        </div>
      </div>

      {/* Gráfico ComposedChart Geral */}
      {!hasAnyData ? (
        <div className="p-10 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 text-center flex flex-col items-center justify-center gap-3 bg-gray-50/50 dark:bg-gray-850/30">
          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-500">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
            Nenhum registro de questões encontrado
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md leading-relaxed">
            Registre suas sessões de QBank no formulário de Lançamento Rápido acima ou responda questões no Desk para visualizar seu volume diário e taxa de acertos aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="h-72 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
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
                    borderRadius: '10px',
                    border: 'none',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'Questões Resolvidas') return [`${value} questões`, name];
                    if (name === 'Taxa de Acertos') return [value !== null ? `${value}%` : 'Sem questões', name];
                    if (name === 'Tendência (Média Móvel)') return [value !== null ? `${value}%` : '—', name];
                    return [value, name];
                  }}
                  labelFormatter={(label: string, payload: any[]) => {
                    const item = payload?.[0]?.payload;
                    if (item?.dateStr) {
                      const [y, m, d] = item.dateStr.split('-');
                      return `${d}/${m}/${y} (${item.dayOfWeekShort || ''})`;
                    }
                    return label;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <ReferenceLine
                  yAxisId="right"
                  y={70}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{ value: 'Meta USMLE: 70%', fill: '#10b981', fontSize: 10, position: 'right' }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="questions"
                  name="Questões Resolvidas"
                  fill="#3b82f6"
                  opacity={0.85}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="score"
                  name="Taxa de Acertos"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="trend"
                  name="Tendência (Média Móvel)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={true}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela de Detalhamento dos Dias com Questões */}
          <div className="space-y-2.5 pt-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Detalhamento dos Dias com Questões:</span>
              </div>
              <span className="text-gray-400 font-medium">
                {activeDaysList.length} {activeDaysList.length === 1 ? 'dia ativo' : 'dias ativos'} no período
              </span>
            </div>

            {activeDaysList.length === 0 ? (
              <div className="p-6 rounded-xl border border-gray-100 dark:border-gray-800 text-center text-xs text-gray-400 bg-gray-50/50 dark:bg-gray-850/30">
                Nenhum registro de questões encontrado para este intervalo de tempo.
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Data</th>
                        <th className="p-3 text-center">Questões</th>
                        <th className="p-3 text-center">Taxa de Acertos</th>
                        <th className="p-3">Material / QBank</th>
                        <th className="p-3 text-center">Tempo Estudo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                      {activeDaysList.map((day) => {
                        const [y, m, d] = day.dateStr.split('-');
                        const formattedDate = `${d}/${m}/${y}`;
                        return (
                          <tr
                            key={day.dateStr}
                            className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
                          >
                            <td className="p-3 font-bold text-gray-900 dark:text-white flex items-center gap-2 whitespace-nowrap">
                              <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span>{formattedDate}</span>
                              <span className="text-[10px] text-gray-400 font-normal uppercase">({day.dayOfWeekShort})</span>
                            </td>
                            <td className="p-3 text-center font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                              {day.questions} {day.questions === 1 ? 'questão' : 'questões'}
                            </td>
                            <td className="p-3 text-center font-bold whitespace-nowrap">
                              {day.score !== null ? (
                                <span
                                  className={cn(
                                    "px-2.5 py-0.5 rounded-full text-xs font-black",
                                    day.score >= 70
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                      : day.score >= 50
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                      : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                  )}
                                >
                                  {day.score}%
                                </span>
                              ) : (
                                <span className="text-gray-400 text-[11px]">—</span>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {day.resources.length > 0 ? (
                                  day.resources.map((res, rIdx) => (
                                    <span
                                      key={rIdx}
                                      className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[11px] font-medium"
                                    >
                                      {res}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-gray-400 text-[11px]">QBank</span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-center font-mono text-gray-500 whitespace-nowrap">
                              {day.minutes > 0 ? (
                                day.minutes >= 60 ? (
                                  `${Math.floor(day.minutes / 60)}h ${day.minutes % 60 > 0 ? `${day.minutes % 60}m` : ''}`
                                ) : (
                                  `${day.minutes} min`
                                )
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
