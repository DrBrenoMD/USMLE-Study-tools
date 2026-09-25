import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Award, Zap, Brain, Target, CalendarDays, Activity, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { format, subDays, eachDayOfInterval, isSameDay, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { MultiSelectFilter } from './MultiSelectFilter';
import { Page } from '../App';

export const NotebookDashboard: React.FC<{ onNavigate?: (p: Page) => void }> = ({ onNavigate }) => {
  const { notebookHistory, questions } = useStore();

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedSubTopics, setSelectedSubTopics] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedDate(null);
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelectedDate(null);
      }
    };

    if (selectedDate) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedDate]);

  const filteredHistory = useMemo(() => {
     if (selectedSubjects.length === 0 && selectedAreas.length === 0 && selectedTopics.length === 0 && selectedSubTopics.length === 0 && selectedTags.length === 0) {
        return notebookHistory;
     }

     return notebookHistory.map(session => {
        if (!session.results) return session; // If no results mapping, skip filtering to avoid hiding old unmapped stats
        
        let validCorrect = 0;
        let validTotal = 0;

        for (const [qId, isCorrect] of Object.entries(session.results)) {
           const q = questions.find(x => x.id === qId);
           if (!q) continue;
           
           if (selectedSubjects.length > 0 && !selectedSubjects.includes(q.subject)) continue;
           if (selectedAreas.length > 0 && !selectedAreas.includes(q.area)) continue;
           if (selectedTopics.length > 0 && (!q.topic || !selectedTopics.includes(q.topic))) continue;
           if (selectedSubTopics.length > 0 && (!q.subTopic || !selectedSubTopics.includes(q.subTopic))) continue;
           if (selectedTags.length > 0 && !selectedTags.some(t => q.tags.includes(t))) continue;

           validTotal++;
           if (isCorrect) validCorrect++;
        }

        return {
           ...session,
           correct: validCorrect,
           total: validTotal,
        };
     }).filter(session => session.total > 0);
  }, [notebookHistory, questions, selectedSubjects, selectedAreas, selectedTopics, selectedSubTopics, selectedTags]);

  const stats = useMemo(() => {
    if (filteredHistory.length === 0) return { totalNotebooks: 0, avgScore: 0, totalQuestions: 0, totalCorrect: 0 };
    
    const totalQuestions = filteredHistory.reduce((acc, h) => acc + h.total, 0);
    const totalCorrect = filteredHistory.reduce((acc, h) => acc + h.correct, 0);
    const avgScore = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
    
    return {
      totalNotebooks: filteredHistory.length,
      avgScore: Math.round(avgScore),
      totalQuestions,
      totalCorrect,
    };
  }, [filteredHistory]);

  const [heatmapMonth, setHeatmapMonth] = useState(new Date());

  const heatmapData = useMemo(() => {
    const data: Record<string, { total: number, correct: number }> = {};
    filteredHistory.forEach(h => {
       const dateStr = format(new Date(h.completedAt), 'yyyy-MM-dd');
       if (!data[dateStr]) data[dateStr] = { total: 0, correct: 0 };
       data[dateStr].total += h.total;
       data[dateStr].correct += h.correct;
    });
    return data;
  }, [filteredHistory]);

  const { daysGrid, padStart } = useMemo(() => {
    const start = startOfMonth(heatmapMonth);
    const end = endOfMonth(heatmapMonth);
    const dates = eachDayOfInterval({ start, end });
    
    const padStart = start.getDay();
    
    return { daysGrid: dates, padStart };
  }, [heatmapMonth]);

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const getHeatmapColor = (count: number) => {
    if (count === 0) return "bg-ui-surface-hover/50 dark:bg-ui-border border border-ui-border text-transparent";
    if (count < 10) return "bg-emerald-200 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100";
    if (count < 30) return "bg-emerald-300 dark:bg-emerald-700 border border-emerald-400 dark:border-emerald-600 text-emerald-900 dark:text-emerald-100";
    if (count < 60) return "bg-emerald-400 dark:bg-emerald-600 border border-emerald-500 text-white";
    return "bg-emerald-500 dark:bg-emerald-500 border border-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.5)] text-white";
  };

  const selDayData = selectedDate ? heatmapData[selectedDate] : null;

  const selectedDateQuestions = useMemo(() => {
    if (!selectedDate) return [];
    
    const questionsForDay: { question: any, correct: boolean }[] = [];
    const seenQs = new Set();
    
    filteredHistory.forEach(h => {
       const dateStr = format(new Date(h.completedAt), 'yyyy-MM-dd');
       if (dateStr === selectedDate && h.results) {
         Object.keys(h.results).forEach(qId => {
           if (seenQs.has(qId)) return;
           const q = questions.find(q => q.id === qId);
           if (q) {
             questionsForDay.push({ question: q, correct: h.results![qId].isCorrect });
             seenQs.add(qId);
           }
         });
       }
    });
    return questionsForDay;
  }, [selectedDate, filteredHistory, questions]);

  // Get available generic filters
  const historyQuestions = notebookHistory.flatMap(h => h.results ? Object.keys(h.results).map(id => questions.find(q => q.id === id)).filter(Boolean) : []);
  const availableSubjects = Array.from(new Set(historyQuestions.map(q => q!.subject).filter(Boolean)));
  const availableSpecialties = Array.from(new Set(historyQuestions.filter(q => selectedSubjects.length === 0 || selectedSubjects.includes(q!.subject)).map(q => q!.specialty).filter(Boolean)));
  const availableAreas = Array.from(new Set(historyQuestions.filter(q => (selectedSubjects.length === 0 || selectedSubjects.includes(q!.subject)) && (selectedSpecialties.length === 0 || selectedSpecialties.includes(q!.specialty||''))).map(q => q!.area).filter(Boolean)));
  const availableTopics = Array.from(new Set(historyQuestions.filter(q => selectedAreas.length === 0 || selectedAreas.includes(q!.area)).map(q => q!.topic).filter(Boolean)));
  const availableSubTopics = Array.from(new Set(historyQuestions.filter(q => selectedTopics.length === 0 || selectedTopics.includes(q!.topic||'')).map(q => q!.subTopic).filter(Boolean)));
  const availableTags = Array.from(new Set(historyQuestions.flatMap(q => q!.tags).filter(Boolean))).filter(t => !t.trim().startsWith('#'));

  return (
    <div className="space-y-6 pt-4 mb-10">
      {(availableSubjects.length > 0 || availableSpecialties.length > 0 || availableAreas.length > 0 || availableTopics.length > 0) && (
        <div className="bg-ui-surface p-4 rounded-xl border border-ui-border space-y-3 shadow-sm">
          <h3 className="text-xs font-semibold text-ui-muted uppercase tracking-wider flex items-center gap-2"><Target className="w-4 h-4"/> Filter Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               <MultiSelectFilter label="Subject" placeholder="Select Subject..." options={availableSubjects as string[]} selectedValues={selectedSubjects} onChange={setSelectedSubjects} />
               <MultiSelectFilter label="Specialty" placeholder="Select Specialty..." options={availableSpecialties as string[]} selectedValues={selectedSpecialties} onChange={setSelectedSpecialties} />
               <MultiSelectFilter label="Area" placeholder="Select Area..." options={availableAreas as string[]} selectedValues={selectedAreas} onChange={setSelectedAreas} />
               <MultiSelectFilter label="Topic" placeholder="Select Topic..." options={availableTopics as string[]} selectedValues={selectedTopics} onChange={setSelectedTopics} />
               <MultiSelectFilter label="Sub-Topic" placeholder="Select Sub-topic..." options={availableSubTopics as string[]} selectedValues={selectedSubTopics} onChange={setSelectedSubTopics} />
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-ui-surface rounded-2xl p-5 border border-ui-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-bold text-ui-text">{stats.totalNotebooks}</div>
            <div className="text-sm font-medium text-ui-muted text-balance leading-tight">Notebooks Finished</div>
          </div>
        </motion.div>
        
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-ui-surface rounded-2xl p-5 border border-ui-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-bold text-ui-text">{stats.totalQuestions}</div>
            <div className="text-sm font-medium text-ui-muted text-balance leading-tight">Total Questions</div>
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-ui-surface rounded-2xl p-5 border border-ui-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-bold text-ui-text">{stats.avgScore}%</div>
            <div className="text-sm font-medium text-ui-muted text-balance leading-tight">Avg Accuracy</div>
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="bg-ui-surface rounded-2xl p-5 border border-ui-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-bold text-ui-text">{stats.totalCorrect}</div>
            <div className="text-sm font-medium text-ui-muted text-balance leading-tight">Total Correct</div>
          </div>
        </motion.div>
      </div>

      {/* Heatmap */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="bg-ui-surface rounded-2xl p-6 border border-ui-border shadow-sm relative">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-ui-muted" />
            <h3 className="font-semibold text-ui-text text-lg tracking-tight">Question Heatmap</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHeatmapMonth(prev => subMonths(prev, 1))}
              className="p-1.5 hover:bg-ui-surface-hover rounded-md text-ui-text transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-ui-text min-w-[120px] text-center capitalize">
              {format(heatmapMonth, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setHeatmapMonth(prev => addMonths(prev, 1))}
              className="p-1.5 hover:bg-ui-surface-hover rounded-md text-ui-text transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-2 sm:gap-3 relative w-full items-center">
           {dayNames.map(d => (
             <div key={d} className="text-center text-xs font-medium text-ui-muted pb-2">
               {d}
             </div>
           ))}
           
           {Array.from({ length: padStart }).map((_, i) => (
             <div key={`pad-${i}`} className="aspect-square rounded-xl border border-dashed border-ui-border bg-transparent" />
           ))}

           {daysGrid.map((date, i) => {
             const key = format(date, 'yyyy-MM-dd');
             const dataItem = heatmapData[key];
             const count = dataItem ? dataItem.total : 0;
             const isSel = key === selectedDate;
             const isToday = key === format(new Date(), 'yyyy-MM-dd');
             
             return (
               <div 
                 key={key}
                 onClick={() => setSelectedDate(isSel ? null : key)}
                 title={`${format(date, 'MMM do')}: ${count} questions`}
                 className={cn(
                   "flex flex-col items-center justify-between p-1 sm:p-2 aspect-square rounded-lg transition-all hover:scale-105 group cursor-pointer relative",
                   getHeatmapColor(count),
                   isSel && "ring-2 ring-primary ring-offset-2 ring-offset-ui-surface z-20 scale-110 shadow-lg",
                   isToday && !isSel && "ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-[#0f172a]"
                 )}
               >
                 <div className={cn("text-[10px] w-full text-right opacity-70", count === 0 && "text-ui-muted")}>
                   {date.getDate()}
                 </div>
                 <div className={cn("text-xs sm:text-sm mt-auto pb-1 mx-auto", count === 0 && "opacity-0")}>
                   {count > 0 ? count : ''}
                 </div>
               </div>
             );
           })}
        </div>

        {selectedDate && selDayData && (
          <div ref={containerRef} className="absolute inset-0 bg-ui-surface/95 backdrop-blur-sm z-30 p-6 rounded-2xl flex flex-col border border-ui-border animate-fade-in shadow-xl">
             <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-xl font-bold text-ui-text">
                    {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM do, yyyy')}
                  </h4>
                  <p className="text-ui-muted text-sm mt-1">
                    {selDayData.total} answered • {selDayData.total > 0 ? Math.round((selDayData.correct / selDayData.total) * 100) : 0}% correct
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      if (onNavigate) onNavigate({ type: 'browse', date: selectedDate, browseType: 'questions' } as any);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-ui-background hover:bg-ui-surface-hover text-ui-text rounded-lg transition-colors text-xs font-medium border border-ui-border"
                  >
                    <CalendarDays className="w-3.5 h-3.5" /> Browse Date
                  </button>
                  <button 
                    onClick={() => setSelectedDate(null)}
                    className="p-1.5 bg-ui-background hover:bg-ui-surface-hover rounded-full text-ui-muted hover:text-ui-text transition-colors border border-ui-border"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mt-4 space-y-2">
                {selectedDateQuestions.map(({ question, correct }, idx) => (
                  <div 
                    key={`${question.id}-${idx}`}
                    onClick={() => onNavigate && onNavigate({ type: 'question', questionId: question.id, bankId: question.bankId })}
                    className="bg-ui-background border border-ui-border p-3 rounded-xl flex items-center justify-between gap-4 cursor-pointer hover:bg-ui-surface-hover transition-colors"
                  >
                     <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                           <div className="text-[10px] text-primary font-semibold uppercase tracking-wider truncate">
                             {question.subject || 'No Subject'}
                           </div>
                           {(question.area || question.topic) && (
                             <>
                               <div className="w-1 h-1 rounded-full bg-ui-muted"></div>
                               <div className="text-[10px] text-ui-muted truncate">
                                 {question.area} {question.topic ? `> ${question.topic}` : ''}
                               </div>
                             </>
                           )}
                           <div className="ml-auto">
                              {correct ? (
                                <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-medium border border-emerald-500/20">Correct</div>
                              ) : (
                                <div className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-medium border border-red-500/20">Incorrect</div>
                              )}
                           </div>
                        </div>
                        <div className="text-sm font-medium text-ui-text line-clamp-2" dangerouslySetInnerHTML={{__html: question.content}} />
                     </div>
                     <ChevronRight className="w-4 h-4 text-ui-muted shrink-0" />
                  </div>
                ))}
                {selectedDateQuestions.length === 0 && (
                  <div className="text-center py-8 text-ui-muted text-sm">No questions found for this date.</div>
                )}
             </div>
          </div>
        )}
        <div className="mt-4 flex items-center justify-end gap-2 text-xs text-ui-muted font-medium">
           Less
           <div className="flex gap-1">
             <div className="w-3 h-3 rounded-sm bg-ui-surface-hover/50 dark:bg-ui-border border border-ui-border"></div>
             <div className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-800"></div>
             <div className="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-600 border border-emerald-500"></div>
             <div className="w-3 h-3 rounded-sm bg-emerald-500 border border-emerald-600"></div>
           </div>
           More
        </div>
      </motion.div>
    </div>
  );
}
