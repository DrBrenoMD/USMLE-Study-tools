import React, { useState, useMemo } from 'react';
import { format, subDays, addDays, isSameDay, startOfWeek, endOfWeek, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Flame, Trophy, Clock, CheckCircle2, Calendar as CalendarIcon, Sparkles, Plus, Trash2, Filter, CheckSquare } from 'lucide-react';
import { StudyLogEntry, Resource, getCategoryIcon } from '../types';
import { cn } from '../lib/utils';
import { useTimerStore } from '../store/useTimerStore';

interface StudyHeatmapProps {
  logs: StudyLogEntry[];
  resources: Resource[];
  onAddLog: (log: Omit<StudyLogEntry, 'id' | 'createdAt'>) => void;
  onDeleteLog: (id: string) => void;
  onSelectDateForLog?: (dateStr: string) => void;
}

export function StudyHeatmap({ logs, resources, onAddLog, onDeleteLog, onSelectDateForLog }: StudyHeatmapProps) {
  const [selectedDateStr, setSelectedDateStr] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [filterResourceId, setFilterResourceId] = useState<string>('all');
  const [weeksToShow, setWeeksToShow] = useState<number>(18); // ~4.5 meses
  const { dailyNetTime } = useTimerStore();

  // Mapa de data (YYYY-MM-DD) -> Array de Logs
  const logsByDate = useMemo(() => {
    const map = new Map<string, StudyLogEntry[]>();
    logs.forEach(log => {
      const existing = map.get(log.date) || [];
      existing.push(log);
      map.set(log.date, existing);
    });
    return map;
  }, [logs]);

  // Cálculos de Sequência (Streak) e Totais
  const stats = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');

    let totalMinutes = 0;
    let totalItems = 0;
    const uniqueActiveDays = new Set<string>();

    logs.forEach(log => {
      totalMinutes += log.minutesSpent || 0;
      totalItems += log.amount || 0;
      uniqueActiveDays.add(log.date);
    });

    Object.entries(dailyNetTime).forEach(([dateStr, seconds]) => {
       const mins = Math.round(seconds / 60);
       if (mins > 0) {
         totalMinutes += mins;
         uniqueActiveDays.add(dateStr);
       }
    });

    // Calcular Sequência Atual (Current Streak)
    let currentStreak = 0;
    let checkDate = (uniqueActiveDays.has(todayStr) ? today : uniqueActiveDays.has(yesterdayStr) ? subDays(today, 1) : null);

    if (checkDate) {
      while (true) {
        const dStr = format(checkDate, 'yyyy-MM-dd');
        if (uniqueActiveDays.has(dStr)) {
          currentStreak++;
          checkDate = subDays(checkDate, 1);
        } else {
          break;
        }
      }
    }

    // Calcular Maior Sequência (Max Streak)
    const sortedDays = Array.from(uniqueActiveDays).sort();
    let maxStreak = 0;
    let tempStreak = 0;
    let prevDate: Date | null = null;

    sortedDays.forEach(dStr => {
      const d = parseISO(dStr);
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const diff = differenceInDays(d, prevDate);
        if (diff === 1) {
          tempStreak++;
        } else if (diff > 1) {
          tempStreak = 1;
        }
      }
      prevDate = d;
      if (tempStreak > maxStreak) {
        maxStreak = tempStreak;
      }
    });

    return {
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      totalItems,
      activeDaysCount: uniqueActiveDays.size,
      currentStreak,
      maxStreak: Math.max(maxStreak, currentStreak),
    };
  }, [logs, dailyNetTime]);

  // Gerar a matriz do calendário Heatmap (7 linhas para os dias da semana, colunas para as semanas)
  const heatmapGrid = useMemo(() => {
    const today = new Date();
    const endDate = endOfWeek(today, { weekStartsOn: 1 }); // Domingo como fim de semana
    const startDate = startOfWeek(subDays(endDate, (weeksToShow * 7) - 1), { weekStartsOn: 1 });

    const weeks: { days: { date: Date; dateStr: string; minutes: number; items: number; logs: StudyLogEntry[]; intensity: 0 | 1 | 2 | 3 | 4 }[] }[] = [];
    let currentDay = startDate;

    while (currentDay <= endDate) {
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const dStr = format(currentDay, 'yyyy-MM-dd');
        const dayLogs = logsByDate.get(dStr) || [];
        const filteredDayLogs = filterResourceId === 'all' 
          ? dayLogs 
          : dayLogs.filter(l => l.resourceId === filterResourceId);

        let minutes = filteredDayLogs.reduce((acc, l) => acc + (l.minutesSpent || 0), 0);
        
        // Add timer net time if no specific resource is filtered
        if (filterResourceId === 'all' && dailyNetTime[dStr]) {
          minutes += Math.round(dailyNetTime[dStr] / 60);
        }

        const items = filteredDayLogs.reduce((acc, l) => acc + (l.amount || 0), 0);

        let intensity: 0 | 1 | 2 | 3 | 4 = 0;
        if (minutes > 0) {
          if (minutes < 60) intensity = 1;
          else if (minutes < 150) intensity = 2;
          else if (minutes < 240) intensity = 3;
          else intensity = 4;
        }

        weekDays.push({
          date: currentDay,
          dateStr: dStr,
          minutes,
          items,
          logs: dayLogs,
          intensity,
        });

        currentDay = addDays(currentDay, 1);
      }
      weeks.push({ days: weekDays });
    }

    return weeks;
  }, [logsByDate, filterResourceId, weeksToShow, dailyNetTime]);

  // Logs do dia selecionado
  const selectedDayLogs = useMemo(() => {
    return logsByDate.get(selectedDateStr) || [];
  }, [logsByDate, selectedDateStr]);

  const selectedDayTotalMinutes = useMemo(() => {
    let total = selectedDayLogs.reduce((acc, l) => acc + (l.minutesSpent || 0), 0);
    if (filterResourceId === 'all' && dailyNetTime[selectedDateStr]) {
      total += Math.round(dailyNetTime[selectedDateStr] / 60);
    }
    return total;
  }, [selectedDayLogs, filterResourceId, selectedDateStr, dailyNetTime]);

  const getIntensityColor = (intensity: number) => {
    switch (intensity) {
      case 1:
        return 'bg-emerald-200 border-emerald-300';
      case 2:
        return 'bg-emerald-400 border-emerald-500';
      case 3:
        return 'bg-emerald-600 border-emerald-700 text-white';
      case 4:
        return 'bg-emerald-800 border-emerald-900 text-white shadow-xs';
      default:
        return 'bg-gray-100 border-gray-200/80 hover:border-gray-300';
    }
  };

  const dayLabels = ['Seg', '', 'Qua', '', 'Sex', '', 'Dom'];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col gap-6">
      
      {/* Header & Métricas de Streak */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Evolução & Heatmap de Estudo
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
              <Sparkles className="w-3 h-3" /> Tempo Real
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Registro diário de questões, páginas, flashcards e carga horária estudada.
          </p>
        </div>

        {/* Seletor de filtro por material */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={filterResourceId}
            onChange={(e) => setFilterResourceId(e.target.value)}
            className="text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Todos os Materiais</option>
            {resources.map(r => (
              <option key={r.id} value={r.id}>
                {r.name || r.type.toUpperCase()}
              </option>
            ))}
          </select>

          <select
            value={weeksToShow}
            onChange={(e) => setWeeksToShow(Number(e.target.value))}
            className="text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value={12}>Últimos 3 meses</option>
            <option value={18}>Últimos 4.5 meses</option>
            <option value={26}>Últimos 6 meses</option>
          </select>
        </div>
      </div>

      {/* Cartões de Estatísticas / Streak */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-orange-50/60 border border-orange-200/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold shadow-xs">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-orange-900">Sequência Atual</div>
            <div className="text-lg font-bold text-orange-700">
              {stats.currentStreak} <span className="text-xs font-medium">dias seguidos</span>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-amber-900">Melhor Sequência</div>
            <div className="text-lg font-bold text-amber-700">
              {stats.maxStreak} <span className="text-xs font-medium">dias</span>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-blue-900">Total Estudado</div>
            <div className="text-lg font-bold text-blue-700">
              {stats.totalHours} <span className="text-xs font-medium">horas</span>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-emerald-900">Dias com Estudo</div>
            <div className="text-lg font-bold text-emerald-700">
              {stats.activeDaysCount} <span className="text-xs font-medium">dias</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid do Heatmap */}
      <div className="flex flex-col gap-2 overflow-x-auto pb-2">
        <div className="flex gap-1.5 min-w-max">
          {/* Rótulos dos dias da semana */}
          <div className="flex flex-col gap-1.5 justify-between pr-2 text-[10px] font-semibold text-gray-400 select-none">
            {dayLabels.map((lbl, idx) => (
              <span key={idx} className="h-3.5 flex items-center leading-none">
                {lbl}
              </span>
            ))}
          </div>

          {/* Colunas de Semanas */}
          {heatmapGrid.map((week, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-1.5">
              {week.days.map((day) => {
                const isSelected = day.dateStr === selectedDateStr;
                const isToday = isSameDay(day.date, new Date());

                return (
                  <button
                    key={day.dateStr}
                    type="button"
                    onClick={() => {
                      setSelectedDateStr(day.dateStr);
                      if (onSelectDateForLog) onSelectDateForLog(day.dateStr);
                    }}
                    title={`${format(day.date, "EEEE, dd 'de' MMMM", { locale: ptBR })}: ${day.minutes} min estudados (${day.logs.length} registro(s))`}
                    className={cn(
                      "w-3.5 h-3.5 rounded-xs border transition-all relative group cursor-pointer",
                      getIntensityColor(day.intensity),
                      isSelected && "ring-2 ring-blue-500 ring-offset-1 z-10 scale-110",
                      isToday && !isSelected && "ring-1 ring-blue-400"
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Legenda de Intensidade */}
        <div className="flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-gray-100 flex-wrap gap-2">
          <span>Clique em qualquer dia do heatmap para ver detalhes ou lançar registros</span>
          <div className="flex items-center gap-1.5">
            <span>Menos</span>
            <div className="w-3 h-3 rounded-xs bg-gray-100 border border-gray-200"></div>
            <div className="w-3 h-3 rounded-xs bg-emerald-200 border border-emerald-300"></div>
            <div className="w-3 h-3 rounded-xs bg-emerald-400 border border-emerald-500"></div>
            <div className="w-3 h-3 rounded-xs bg-emerald-600 border border-emerald-700"></div>
            <div className="w-3 h-3 rounded-xs bg-emerald-800 border border-emerald-900"></div>
            <span>Mais</span>
          </div>
        </div>
      </div>

      {/* Painel do Dia Selecionado */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-gray-900">
              {format(parseISO(selectedDateStr), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            {isSameDay(parseISO(selectedDateStr), new Date()) && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded">
                Hoje
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {(() => {
              const qbankLogs = selectedDayLogs.filter(log => log.resourceType === 'qbank' || log.unit === 'questões');
              const totalQuestions = qbankLogs.reduce((acc, log) => acc + log.amount, 0);
              const totalAmountScored = qbankLogs.filter(l => l.scorePercent !== undefined).reduce((acc, log) => acc + log.amount, 0);
              const totalScoreWeighted = qbankLogs.filter(l => l.scorePercent !== undefined).reduce((acc, log) => acc + ((log.scorePercent || 0) * log.amount), 0);
              const avgScore = totalAmountScored > 0 ? Math.round(totalScoreWeighted / totalAmountScored) : 0;

              return totalQuestions > 0 ? (
                <div className="flex items-center gap-3 text-xs bg-white px-2 py-1 rounded-md border border-gray-200">
                  <div className="flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                    <span className="font-semibold text-gray-700">{totalQuestions} questões</span>
                  </div>
                  {totalAmountScored > 0 && (
                    <>
                      <div className="w-px h-3 bg-gray-200"></div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="font-semibold text-emerald-700">{avgScore}% acertos</span>
                      </div>
                    </>
                  )}
                </div>
              ) : null;
            })()}
            <div className="text-xs font-semibold text-gray-700 bg-white px-2 py-1 rounded-md border border-gray-200">
              Total do Dia: <span className="font-bold text-blue-600">{Math.floor(selectedDayTotalMinutes / 60)}h {selectedDayTotalMinutes % 60}m</span>
            </div>
          </div>
        </div>

        {selectedDayLogs.length === 0 ? (
          <div className="text-xs text-gray-400 py-3 text-center bg-white rounded-lg border border-dashed border-gray-200">
            Nenhum estudo registrado nesta data. Use o formulário abaixo para registrar suas questões e revisões do dia.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {selectedDayLogs.map((log) => {
              const Icon = getCategoryIcon(log.resourceType);
              return (
                <div key={log.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-gray-200 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{log.resourceName}</div>
                      <div className="text-[10px] text-gray-500">
                        {log.amount} {log.unit} • {log.minutesSpent} min
                        {log.scorePercent !== undefined && (
                          <span className="font-semibold text-emerald-600 ml-1">({log.scorePercent}% acertos)</span>
                        )}
                      </div>
                      {log.notes && (
                        <div className="text-[10px] text-gray-400 italic truncate max-w-[180px]">
                          {log.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteLog(log.id)}
                    className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors"
                    title="Excluir este lançamento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
