import React, { useState } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO, startOfMonth, endOfMonth, endOfWeek, isSameMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { StudyPlan, Resource, StudyLogEntry } from '../types';

interface StudyCalendarProps {
  plan: StudyPlan;
  resources: Resource[];
  studyLogs: StudyLogEntry[];
  onAddLog: (log: Omit<StudyLogEntry, 'id' | 'createdAt'>) => void;
}

export function StudyCalendar({ plan, resources, studyLogs, onAddLog }: StudyCalendarProps) {
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
          className={`p-2 border border-gray-100 flex items-center justify-center cursor-pointer transition-colors ${
            !isCurrentMonth ? 'text-gray-300' : isSelected ? 'bg-blue-600 text-white font-bold rounded-lg shadow-sm' : isToday ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
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
    // A task is active if the selected date is between its start and end date
    const start = task.startDate;
    const end = task.endDate;
    return selectedDate >= start && selectedDate <= end;
  });

  const handleToggleCheck = (task: any) => {
    // If it's not done for today, we add a log.
    // If it is done, we could theoretically delete the log, but onAddLog is provided. Let's just allow checking for now, or assume it's checked if a log exists.
    const isDone = studyLogs.some(log => log.date === selectedDateStr && log.resourceId === task.resourceId);
    if (!isDone) {
      onAddLog({
        date: selectedDateStr,
        resourceId: task.resourceId,
        resourceName: task.resourceName,
        resourceType: task.resourceType,
        amount: task.dailyAmount || 1, // fallback to 1 if no dailyAmount
        unit: task.unit,
        minutesSpent: task.dailyMinutes || 0,
      });
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Calendário de Atividades</h2>
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-800 capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
      
      <div className="mb-6">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="text-center text-xs font-bold text-gray-400">
              {d}
            </div>
          ))}
        </div>
        {rows}
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          Checklist do Dia - {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
        </h3>
        {activeTasks.length > 0 ? (
          <div className="flex flex-col gap-2">
            {activeTasks.map(task => {
              const isDone = studyLogs.some(log => log.date === selectedDateStr && log.resourceId === task.resourceId);
              return (
                <div key={task.resourceId} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleToggleCheck(task)}
                      className={`transition-colors ${isDone ? 'text-emerald-500' : 'text-gray-400 hover:text-blue-500'}`}
                    >
                      {isDone ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                    </button>
                    <div>
                      <div className={`font-semibold text-sm ${isDone ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {task.resourceName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {task.dailyAmount > 0 ? `${task.dailyAmount} ${task.unit} • ` : ''}{task.dailyMinutes} min
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            Nenhuma atividade programada para este dia.
          </div>
        )}
      </div>
    </div>
  );
}
