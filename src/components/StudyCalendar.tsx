import React, { useState } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO, startOfMonth, endOfMonth, endOfWeek, isSameMonth, subMonths, addMonths, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { StudyPlan, Resource, StudyLogEntry, ResourceScheduleCalculation } from '../types';

function getProjectedDailyVolume(
  task: ResourceScheduleCalculation,
  resourceDef: Resource,
  date: Date,
  plan: StudyPlan,
  daysOff: number[],
  resources: Resource[]
): { amount: number, minutes: number } {
  const d = startOfDay(date);
  const start = startOfDay(task.startDate);
  const end = startOfDay(task.endDate);

  if (d < start || d > end) return { amount: 0, minutes: 0 };

  if (task.frequency !== 'daily') {
    const isScheduled = task.scheduledDates?.some(sd => isSameDay(sd, d));
    if (isScheduled) {
      return { 
        amount: 1, 
        minutes: task.sessionDurationMinutes || resourceDef.minutesPerItem || 300 
      };
    }
    return { amount: 0, minutes: 0 };
  }

  // It's daily
  if (daysOff.includes(d.getDay())) return { amount: 0, minutes: 0 };

  // Check exclusivity
  const hasExclusive = plan.resourcesSchedule.some(other => {
    if (other.frequency !== 'daily' && other.scheduledDates) {
       const otherDef = resources.find(r => r.id === other.resourceId);
       const isExclusive = otherDef?.exclusiveStudyDay ?? (other.resourceType === 'nbme');
       if (isExclusive && other.scheduledDates.some(sd => isSameDay(sd, d))) {
         return true;
       }
    }
    return false;
  });
  if (hasExclusive) return { amount: 0, minutes: 0 };

  // Calculate volume
  if (resourceDef.allocationMode === 'fixed_time') {
    const mins = resourceDef.fixedDailyMinutes || 45;
    return { amount: mins, minutes: mins };
  }

  // item_target
  let amount = task.projectedDailyAmount || task.dailyAmount || 0;
  
  if (resourceDef.fixedVolumeByDayOfWeek && (resourceDef.fixedVolumeByDayOfWeek as any)[d.getDay()] != null) {
    amount = (resourceDef.fixedVolumeByDayOfWeek as any)[d.getDay()];
  } else if (resourceDef.fixedGlobalVolume != null) {
    amount = resourceDef.fixedGlobalVolume;
  }
  
  const minutes = Math.round(amount * (resourceDef.minutesPerItem || 2));
  return { amount, minutes };
}

interface StudyCalendarProps {
  plan: StudyPlan;
  resources: Resource[];
  studyLogs: StudyLogEntry[];
  daysOff: number[];
  onAddLog: (log: Omit<StudyLogEntry, 'id' | 'createdAt'>) => void;
}

export function StudyCalendar({ plan, resources, studyLogs, daysOff, onAddLog }: StudyCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "d";
  const rows = [];
  let days = [];
  let day = startDate;
  let formattedDate = "";

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat);
      const cloneDay = day;
      const isSelected = isSameDay(day, selectedDate);
      const isCurrentMonth = isSameMonth(day, monthStart);
      const isToday = isSameDay(day, new Date());
      
      days.push(
        <div
          key={day.toString()}
          onClick={() => setSelectedDate(cloneDay)}
          className={`p-2 border border-gray-100 dark:border-gray-800 flex items-center justify-center cursor-pointer transition-colors ${
            !isCurrentMonth ? 'text-gray-300' : isSelected ? 'bg-blue-600 dark:bg-blue-500 text-white font-bold rounded-lg shadow-sm' : isToday ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-800/50'
          }`}
        >
          <span>{formattedDate}</span>
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div className="grid grid-cols-7 gap-1 mb-1" key={day.toString()}>
        {days}
      </div>
    );
    days = [];
  }

  // Find active tasks for the selected date
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const activeTasks = plan.resourcesSchedule.filter(task => {
    const selDay = startOfDay(selectedDate);
    const start = startOfDay(task.startDate);
    const end = startOfDay(task.endDate);

    if (selDay < start || selDay > end) return false;

    if (task.frequency === 'daily') {
      if (daysOff.includes(selectedDate.getDay())) return false;
      
      const hasExclusive = plan.resourcesSchedule.some(other => {
        if (other.frequency !== 'daily' && other.scheduledDates) {
           const resourceDef = resources.find(r => r.id === other.resourceId);
           const isExclusive = resourceDef?.exclusiveStudyDay ?? (other.resourceType === 'nbme');
           if (isExclusive && other.scheduledDates.some(d => isSameDay(d, selDay))) {
             return true;
           }
        }
        return false;
      });
      if (hasExclusive) return false;

      return true;
    } else {
      return task.scheduledDates?.some(d => isSameDay(d, selDay));
    }
  });

  const handleToggleCheck = (task: any, volToday: { amount: number, minutes: number }) => {
    // If it's not done for today, we add a log.
    // If it is done, we could theoretically delete the log, but onAddLog is provided. Let's just allow checking for now, or assume it's checked if a log exists.
    const isDone = studyLogs.some(log => log.date === selectedDateStr && log.resourceId === task.resourceId);
    if (!isDone) {
      onAddLog({
        date: selectedDateStr,
        resourceId: task.resourceId,
        resourceName: task.resourceName,
        resourceType: task.resourceType,
        amount: volToday.amount || 1, // fallback to 1 if no dailyAmount
        unit: task.unit,
        minutesSpent: volToday.minutes || 0,
      });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Calendário de Atividades</h2>
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 dark:bg-gray-800 rounded">
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="font-semibold text-gray-800 dark:text-gray-200 capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 dark:bg-gray-800 rounded">
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
      
      <div className="mb-6">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="text-center text-xs font-bold text-gray-400 dark:text-gray-500">
              {d}
            </div>
          ))}
        </div>
        {rows}
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
          Checklist do Dia - {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
        </h3>
        {activeTasks.length > 0 ? (
          <div className="flex flex-col gap-2">
            {activeTasks.map(task => {
              const isDone = studyLogs.some(log => log.date === selectedDateStr && log.resourceId === task.resourceId);
              
              const resourceDef = resources.find(r => r.id === task.resourceId);
              const completedUntilDay = studyLogs
                .filter(log => log.resourceId === task.resourceId && log.date <= selectedDateStr)
                .reduce((acc, log) => acc + (log.amount || 0), 0);
              
              // 1. Calculate Today's Volume for this specific date
              const volToday = resourceDef ? getProjectedDailyVolume(task, resourceDef, selectedDate, plan, daysOff, resources) : { amount: task.dailyAmount, minutes: task.dailyMinutes };
              
              // 2. Calculate Projected Progress until this date
              let projectedTotal = resourceDef?.completed || 0;
              const todayDate = startOfDay(new Date());
              const selDay = startOfDay(selectedDate);
              
              if (selDay > todayDate && resourceDef) {
                let cur = addDays(todayDate, 1);
                while (cur <= selDay) {
                  const v = getProjectedDailyVolume(task, resourceDef, cur, plan, daysOff, resources);
                  projectedTotal += v.amount;
                  cur = addDays(cur, 1);
                }
              } else if (selDay < todayDate) {
                // In the past, the projected goal is just what was actually completed
                projectedTotal = completedUntilDay; 
              }

              if (resourceDef && resourceDef.total > 0) {
                projectedTotal = Math.min(resourceDef.total, projectedTotal);
              }

              let progressPercent = 0;
              let projectedPercent = 0;
              let progressText = "";
              
              if (resourceDef && resourceDef.total > 0) {
                progressPercent = Math.min(100, Math.round((completedUntilDay / resourceDef.total) * 100));
                projectedPercent = Math.min(100, Math.round((projectedTotal / resourceDef.total) * 100));
                const remaining = Math.max(0, resourceDef.total - completedUntilDay);
                
                if (isSameDay(selDay, todayDate)) {
                   progressText = `Progresso: ${completedUntilDay} / ${resourceDef.total} ${task.unit} (${remaining} restantes)`;
                } else if (selDay > todayDate) {
                   progressText = `Projetado: ${projectedTotal} | Atual: ${completedUntilDay} / ${resourceDef.total} ${task.unit}`;
                } else {
                   progressText = `Concluído: ${completedUntilDay} / ${resourceDef.total} ${task.unit}`;
                }
              }

              return (
                <div key={task.resourceId} className="flex flex-col p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleToggleCheck(task, volToday)}
                        className={`transition-colors ${isDone ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500 hover:text-blue-500'}`}
                      >
                        {isDone ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                      </button>
                      <div>
                        <div className={`font-semibold text-sm ${isDone ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                          {task.resourceName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {volToday.amount > 0 ? `${volToday.amount} ${task.unit} • ` : ''}{volToday.minutes} min
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {progressText && (
                    <div className="ml-9 mt-1">
                      <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">
                        <span>{progressText}</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                        {selDay > todayDate && (
                           <div 
                             className="absolute top-0 left-0 h-full bg-blue-200 dark:bg-blue-900/50 transition-all duration-500"
                             style={{ width: `${projectedPercent}%` }}
                             title={`Projetado: ${projectedPercent}%`}
                           />
                        )}
                        <div 
                          className="absolute top-0 left-0 h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            Nenhuma atividade programada para este dia.
          </div>
        )}
      </div>
    </div>
  );
}
