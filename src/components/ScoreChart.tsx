import React, { useMemo, useState } from 'react';
import { format, parseISO, isAfter, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StudyLogEntry } from '../types';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Filter, TrendingUp, CheckSquare, Calendar, Award } from 'lucide-react';

interface ScoreChartProps {
  logs: StudyLogEntry[];
}

export function ScoreChart({ logs }: ScoreChartProps) {
  const [daysToShow, setDaysToShow] = useState<number>(30);

  // Processa dados completos do gráfico incluindo dias com zero questões
  const { chartData, summaryStats, hasAnyData } = useMemo(() => {
    // 1. Filtra todos os logs relacionados a questões
    const qbankLogs = logs.filter(
      (l) => l.resourceType === 'qbank' || l.unit === 'questões' || l.unit === 'questoes'
    );

    // 2. Agrupa logs por data (YYYY-MM-DD)
    const byDate = new Map<
      string,
      {
        totalAmount: number;
        scoredAmount: number;
        weightedScoreSum: number;
      }
    >();

    qbankLogs.forEach((log) => {
      if (!log.date) return;
      const existing = byDate.get(log.date) || {
        totalAmount: 0,
        scoredAmount: 0,
        weightedScoreSum: 0,
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

    const today = startOfDay(new Date());
    const startDate = subDays(today, Math.max(1, daysToShow - 1));

    // 3. Gera TODOS os dias do intervalo cronológico (incluindo dias vazios)
    const allDaysInInterval = eachDayOfInterval({ start: startDate, end: today });

    let cumulativeTotalQuestions = 0;
    let cumulativeScoredQuestions = 0;
    let cumulativeWeightedScore = 0;
    let activeDaysCount = 0;

    // Primeiro passo: constrói a lista bruta de cada dia
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
        score: avgScore, // null se não houve questões com acerto registrado
        hasQuestions,
      };
    });

    // 4. Calcula a linha de tendência (Média Móvel ponderada) EXCLUSIVAMENTE sobre os dias ativos
    // Dias sem questões NÃO puxam a média para baixo e NÃO distorcem a tendência
    const finalData = rawDailyData.map((d, index, arr) => {
      if (!d.hasQuestions || d.score === null) {
        return {
          ...d,
          trend: null, // Deixamos null para Recharts conectar suavemente com connectNulls={true}
        };
      }

      // Procura até 4 dias ativos anteriores recentes (com questões e score válidos)
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

    // 5. Métricas de resumo do período selecionado (excluindo dias vazios no cálculo de média de acertos)
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

    const hasData = cumulativeTotalQuestions > 0 || qbankLogs.length > 0;

    return {
      chartData: finalData,
      summaryStats: summary,
      hasAnyData: hasData,
    };
  }, [logs, daysToShow]);

  if (!hasAnyData) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm mt-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Desempenho de Questões & Tendência
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Exibe a linha contínua de todos os dias e acertos reais.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            <select
              value={daysToShow}
              onChange={(e) => setDaysToShow(Number(e.target.value))}
              className="text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={15}>Últimos 15 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={60}>Últimos 60 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={180}>Últimos 6 meses</option>
              <option value={365}>Último ano</option>
            </select>
          </div>
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 py-8 text-center border border-dashed border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-800/20">
          Faça questões no QBank e registre os blocos com porcentagem para visualizar o gráfico contínuo com evolução e ritmo.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm mt-6 flex flex-col gap-5">
      {/* Header do Gráfico com Filtro de Período */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Desempenho de Questões & Tendência
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Exibe todos os dias do calendário. Dias sem questões não reduzem a média nem distorcem a tendência.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          <select
            value={daysToShow}
            onChange={(e) => setDaysToShow(Number(e.target.value))}
            className="text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={15}>Últimos 15 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={60}>Últimos 60 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={180}>Últimos 6 meses</option>
            <option value={365}>Último ano</option>
          </select>
        </div>
      </div>

      {/* Cards de Métricas Reais do Período */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/40 flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1">
            <Award className="w-3 h-3 text-blue-600" /> Média de Acertos
          </span>
          <span className="text-lg sm:text-xl font-black text-blue-700 dark:text-blue-400 tabular-nums">
            {summaryStats.overallAvgScore !== null ? `${summaryStats.overallAvgScore}%` : '---'}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            Apenas dias com questões
          </span>
        </div>

        <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1">
            <CheckSquare className="w-3 h-3 text-indigo-600" /> Volume no Período
          </span>
          <span className="text-lg sm:text-xl font-black text-indigo-700 dark:text-indigo-400 tabular-nums">
            {summaryStats.totalQuestions} <span className="text-xs font-semibold text-indigo-500">questões</span>
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            Total realizado
          </span>
        </div>

        <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3 text-emerald-600" /> Dias com Questões
          </span>
          <span className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
            {summaryStats.activeDaysCount} <span className="text-xs font-semibold text-emerald-600">/ {summaryStats.totalDays}d</span>
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            {summaryStats.totalDays > 0 ? `${Math.round((summaryStats.activeDaysCount / summaryStats.totalDays) * 100)}% de constância` : ''}
          </span>
        </div>

        <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/40 flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-amber-600" /> Média / Dia Ativo
          </span>
          <span className="text-lg sm:text-xl font-black text-amber-700 dark:text-amber-400 tabular-nums">
            {summaryStats.avgQuestionsPerActiveDay} <span className="text-xs font-semibold text-amber-600">q/dia</span>
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            Quando realizou questões
          </span>
        </div>
      </div>

      {/* Gráfico Recharts */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-gray-800" />
            <XAxis 
              dataKey="dateFormatted" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#9ca3af' }} 
              interval="preserveStartEnd"
              minTickGap={18}
              dy={10}
            />
            
            {/* Eixo Esquerdo: Porcentagens de Acerto (0 - 100%) */}
            <YAxis 
              yAxisId="left"
              domain={[0, 100]} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickFormatter={(val) => `${val}%`}
            />

            {/* Eixo Direito: Volume de Questões */}
            <YAxis 
              yAxisId="right"
              orientation="right"
              domain={[0, (dataMax) => Math.max(20, Math.ceil((dataMax || 40) * 1.15))]}
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickFormatter={(val) => `${val}q`}
            />

            <Tooltip 
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                color: '#f8fafc',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                fontSize: '12px',
                padding: '10px 14px'
              }}
              labelFormatter={(label, items) => {
                const item = items && items[0] ? (items[0].payload as any) : null;
                const dateStr = item ? item.dateStr : label;
                return `📅 ${dateStr} (${label})`;
              }}
              formatter={(value: any, name: string, item: any) => {
                const payload = item?.payload;
                if (name === 'Acertos (%)') {
                  if (value === null || value === undefined || (payload && !payload.hasQuestions)) {
                    return ['Sem questões neste dia (média preservada)', 'Acertos'];
                  }
                  return [`${value}%`, 'Acertos'];
                }
                if (name === 'Tendência (%)') {
                  if (value === null || value === undefined) {
                    return ['Preservada da última sessão ativa', 'Tendência'];
                  }
                  return [`${value}%`, 'Tendência'];
                }
                if (name === 'Volume (Questões)') {
                  if (!value || value === 0) {
                    return ['0 questões realizadas', 'Volume'];
                  }
                  return [`${value} questões`, 'Volume'];
                }
                return [value, name];
              }}
            />
            
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

            {/* Acertos (Barras azuis) - só desenha quando score não é null */}
            <Bar 
              yAxisId="left"
              dataKey="score" 
              name="Acertos (%)"
              barSize={Math.max(4, Math.min(24, Math.floor(450 / Math.max(1, chartData.length))))} 
              fill="#3b82f6" 
              radius={[4, 4, 0, 0]}
            />

            {/* Volume de Questões (Linha tracejada azul) */}
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="questions" 
              name="Volume (Questões)"
              stroke="#60a5fa" 
              strokeWidth={2}
              strokeDasharray="3 3"
              dot={{ r: 3, fill: '#60a5fa' }}
              activeDot={{ r: 5 }}
            />

            {/* Linha de Tendência Suave conectando os dias ativos sem cair em 0 */}
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="trend" 
              name="Tendência (%)"
              stroke="#f59e0b" 
              strokeWidth={3}
              dot={{ r: 3, fill: '#f59e0b' }}
              connectNulls={true}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
