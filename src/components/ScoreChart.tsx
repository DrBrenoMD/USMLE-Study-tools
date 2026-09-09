import React, { useMemo, useState } from 'react';
import { format, parseISO, isAfter, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StudyLogEntry } from '../types';
import { ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Filter } from 'lucide-react';

interface ScoreChartProps {
  logs: StudyLogEntry[];
}

export function ScoreChart({ logs }: ScoreChartProps) {
  const [daysToShow, setDaysToShow] = useState<number>(90);

  const chartData = useMemo(() => {
    // We only care about logs that have scorePercent and are qbank
    const qbankLogs = logs.filter(l => (l.resourceType === 'qbank' || l.unit === 'questões') && l.scorePercent !== undefined);
    
    // Group by date
    const byDate = new Map<string, { totalAmount: number; totalScoreWeighted: number }>();
    
    qbankLogs.forEach(log => {
      const existing = byDate.get(log.date) || { totalAmount: 0, totalScoreWeighted: 0 };
      existing.totalAmount += (log.amount || 0);
      existing.totalScoreWeighted += ((log.scorePercent || 0) * (log.amount || 0));
      byDate.set(log.date, existing);
    });

    const cutoffDate = subDays(new Date(), daysToShow); 

    const data = Array.from(byDate.entries())
      .filter(([dateStr]) => isAfter(parseISO(dateStr), cutoffDate))
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateStr, stats]) => {
        const avgScore = stats.totalAmount > 0 ? Math.round(stats.totalScoreWeighted / stats.totalAmount) : 0;
        return {
          dateStr,
          dateFormatted: format(parseISO(dateStr), 'dd/MM'),
          score: avgScore,
          questions: stats.totalAmount
        };
      });

    // Calculate a 3-day moving average for the trendline
    const dataWithTrend = data.map((d, i, arr) => {
      const start = Math.max(0, i - 2);
      const subset = arr.slice(start, i + 1);
      const trendScore = subset.reduce((sum, item) => sum + item.score, 0) / subset.length;
      return {
        ...d,
        trend: Math.round(trendScore)
      };
    });

    return dataWithTrend;
  }, [logs, daysToShow]);

  if (chartData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm mt-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
            Desempenho Tridimensional
          </h2>
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
        <div className="text-xs text-gray-400 dark:text-gray-500 py-6 text-center">
          Faça questões e registre suas porcentagens de acerto para visualizar sua evolução no gráfico.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm mt-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Desempenho Tridimensional
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Volume de questões, Acertos (%) e Linha de Tendência
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

      <div className="h-72 w-full">
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
              dy={10}
            />
            
            {/* Eixo Esquerdo: Porcentagens (0 a 100%) */}
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
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickFormatter={(val) => `${val}q`}
            />

            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
              labelFormatter={(label) => `Data: ${label}`}
              formatter={(value: number, name: string) => {
                if (name === 'Acertos (%)') return [`${value}%`, name];
                if (name === 'Tendência (%)') return [`${value}%`, name];
                if (name === 'Volume (Questões)') return [`${value} questões`, name];
                return [value, name];
              }}
            />
            
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

            {/* Volume (Área Fundo) */}
            <Area 
              yAxisId="right"
              type="monotone" 
              dataKey="questions" 
              name="Volume (Questões)"
              fill="#93c5fd" 
              stroke="#60a5fa" 
              fillOpacity={0.3} 
            />

            {/* Acertos (Barras) */}
            <Bar 
              yAxisId="left"
              dataKey="score" 
              name="Acertos (%)"
              barSize={24} 
              fill="#3b82f6" 
              radius={[4, 4, 0, 0]}
            />

            {/* Tendência (Linha) */}
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="trend" 
              name="Tendência (%)"
              stroke="#f59e0b" 
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
