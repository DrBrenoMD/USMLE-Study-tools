import React, { useState, useEffect, useRef } from 'react';
import { useStore, Notebook, Question, QuestionAlternative } from '../store/useStore';
import { Page } from '../App';
import { ArrowLeft, Play, LayoutGrid, Timer, CheckCircle2, XCircle, ChevronRight, ChevronLeft, ListFilter, FileText, BookOpen, Activity, CheckSquare } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { sanitizeHtml } from '../lib/utils';
import { useTimerStore } from '../../store/useTimerStore';

import { CardCreationModal } from '../components/CardCreationModal';
import { NotepadModal } from '../components/NotepadModal';
import { Notebook as NotebookIcon, Edit3, Sparkles } from 'lucide-react';
import { AutoHighlighter } from '../components/AutoHighlighter';

const ExamTimer: React.FC<{ initialTimeLeft: number; onTimeUp: () => void; isPaused: boolean; onTick: (timeLeft: number) => void }> = ({ initialTimeLeft, onTimeUp, isPaused, onTick }) => {
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);

  useEffect(() => {
    if (!isPaused && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            onTimeUp();
            return 0;
          }
          const next = t - 1;
          onTick(next);
          return next;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isPaused, timeLeft, onTimeUp, onTick]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono font-bold text-sm transition-colors",
      timeLeft <= 10 ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-ui-surface text-ui-text border-ui-border"
    )}>
      <Timer className="w-4 h-4" />
      {formatTime(timeLeft)}
    </div>
  );
};

export const NotebookSession: React.FC<{ notebookId: string, onNavigate: (p: Page) => void }> = ({ notebookId, onNavigate }) => {
  const { notebooks, questions, addNotebookHistory, createNote, createCard, decks, createDeck } = useStore();
  const notebook = notebooks.find(n => n.id === notebookId);
  const [sourceQuestionForCard, setSourceQuestionForCard] = useState<Question | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const {
    pacerIsActive,
    pacerCurrentQuestionTime,
    pacerTargetTimeSeconds,
    setPacerState,
    setTimerState,
    stopPacer,
    submitPacerQuestion,
    nextPacerQuestion,
    prevPacerQuestion,
    finishPacerSession,
    setShowQuickLog,
  } = useTimerStore();
  
  if (!notebook) {
    onNavigate({ type: 'library' });
    return null;
  }

  const notebookQuestions = notebook.questionIds
    .map(id => questions.find(q => q.id === id))
    .filter(Boolean) as Question[];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [checkedQuestions, setCheckedQuestions] = useState<Record<string, boolean>>({});
  const [examFinished, setExamFinished] = useState(false);
  const timeLeftRef = useRef((notebook.timeLimitPerQuestion || 0) * notebook.questionIds.length);
  
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>({});
  const lastEnterTime = useRef<number>(Date.now());

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const currentQ = notebookQuestions[currentIndex];

  useEffect(() => {
    if (!currentQ) return;
    lastEnterTime.current = Date.now();
    return () => {
      const elapsed = Math.round((Date.now() - lastEnterTime.current) / 1000);
      setTimeSpent(prev => ({ ...prev, [currentQ.id]: (prev[currentQ.id] || 0) + elapsed }));
    };
  }, [currentQ?.id]);

  useEffect(() => {
    if (examFinished && notebookQuestions.length > 0) {
      // For the final question, add its pending time manually
      const elapsed = Math.round((Date.now() - lastEnterTime.current) / 1000);
      
      setTimeSpent(finalTimeSpent => {
        const adjustedTimeSpent = { ...finalTimeSpent };
        if (currentQ) {
           adjustedTimeSpent[currentQ.id] = (adjustedTimeSpent[currentQ.id] || 0) + elapsed;
        }
        
        const results: Record<string, boolean> = {};
        const correctCount = notebookQuestions.filter(q => {
          const selectedId = selectedAnswers[q.id];
          const correctAlt = q.alternatives?.find(a => a.isCorrect);
          const isCorrect = selectedId === correctAlt?.id;
          results[q.id] = isCorrect;
          return isCorrect;
        }).length;
        
        addNotebookHistory({
          notebookId: notebook.id,
          completedAt: new Date().toISOString(),
          score: Math.round((correctCount / notebookQuestions.length) * 100),
          correct: correctCount,
          total: notebookQuestions.length,
          mode: notebook.mode,
          results,
          answers: selectedAnswers,
          timeSpentSeconds: adjustedTimeSpent,
        });
        
        return adjustedTimeSpent;
      });
    }
  }, [examFinished]); // Run when exam finishes

  const isTrainingChecked = notebook?.mode === 'training' && checkedQuestions[currentQ?.id];

  const handleTimeUp = () => {
    setExamFinished(true); // Se acabar o tempo do bloco, finaliza o exame/trino
  };

  const handleSelectAlternative = (altId: string) => {
    if (examFinished) return;
    if (notebook.mode === 'training' && checkedQuestions[currentQ.id]) return;
    
    setSelectedAnswers(prev => ({
      ...prev,
      [currentQ.id]: altId
    }));
  };

  const handleCheckOrNext = () => {
    if (notebook.mode === 'training') {
      if (!checkedQuestions[currentQ.id]) {
        setCheckedQuestions(prev => ({ ...prev, [currentQ.id]: true }));
        if (pacerIsActive) {
          submitPacerQuestion();
        }
      } else {
        handleNext();
      }
    } else {
      handleNext();
    }
  };

  const handleNext = () => {
    if (pacerIsActive) {
      submitPacerQuestion();
      nextPacerQuestion();
    }
    if (currentIndex < notebookQuestions.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      if (pacerIsActive) {
        finishPacerSession();
      }
      setExamFinished(true);
    }
  };
  
  const handlePrev = () => {
    if (pacerIsActive) {
      prevPacerQuestion();
    }
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
    }
  };

  if (notebookQuestions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in text-center pt-20">
        <LayoutGrid className="w-12 h-12 text-ui-muted mx-auto mb-4" />
        <h2 className="text-xl font-bold">This notebook has no questions</h2>
        <button 
          onClick={() => onNavigate({ type: 'library' })}
          className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl"
        >
          Go Back
        </button>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (examFinished) {
    const correctCount = notebookQuestions.filter(q => {
      const selectedId = selectedAnswers[q.id];
      const correctAlt = q.alternatives.find(a => a.isCorrect);
      return selectedId === correctAlt?.id;
    }).length;
    const answeredCount = Object.keys(selectedAnswers).length;

    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-fade-in pt-10">
        <div className="bg-ui-surface border border-ui-border rounded-xl p-8 text-center space-y-6 shadow-md">
          <BookOpen className="w-16 h-16 text-primary mx-auto opacity-80" />
          <div>
            <h2 className="text-3xl font-bold text-ui-text mb-2">Notebook Completed</h2>
            <p className="text-ui-muted">{notebook.name}</p>
          </div>
          
          <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto py-6 border-y border-ui-border">
            <div className="space-y-1">
              <div className="text-sm text-ui-muted uppercase tracking-wider font-semibold">Score</div>
              <div className="text-3xl font-bold text-emerald-500">
                {Math.round((correctCount / notebookQuestions.length) * 100)}%
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-ui-muted uppercase tracking-wider font-semibold">Correct</div>
              <div className="text-3xl font-bold text-ui-text">
                {correctCount} <span className="text-base text-ui-muted font-normal">/ {notebookQuestions.length}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-ui-muted uppercase tracking-wider font-semibold">Answered</div>
              <div className="text-3xl font-bold text-ui-text">
                {answeredCount} <span className="text-base text-ui-muted font-normal">/ {notebookQuestions.length}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <button 
              onClick={() => onNavigate({ type: 'library' })}
              className="px-6 py-3 bg-ui-surface-hover border border-ui-border text-ui-text font-semibold rounded-xl hover:bg-ui-border transition-all shadow-sm"
            >
              Exit
            </button>
            <button 
              onClick={() => {
                setExamFinished(false);
                setCurrentIndex(0);
                setSelectedAnswers({});
                setCheckedQuestions({});
              }}
              className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-sm"
            >
              Review Answers
            </button>
            <button 
              onClick={() => setShowQuickLog(true, notebookQuestions.length)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2"
              title="Registrar na Planilha Diária de Estudos"
            >
              <CheckSquare className="w-4 h-4" />
              Registrar no Estudo Diário
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AutoHighlighter className="max-w-4xl mx-auto space-y-6 pb-32 animate-fade-in relative min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between gap-4 sticky top-0 bg-ui-background/80 backdrop-blur-md z-10 py-3 border-b border-ui-border">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowExitConfirm(true)}
            className="p-2 -ml-2 rounded-full hover:bg-ui-surface text-ui-muted hover:text-ui-text transition-colors"
            title="Exit Session"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h2 className="text-lg font-bold tracking-tight text-ui-text truncate max-w-[200px] sm:max-w-xs block">
              {notebook.name}
            </h2>
            <div className="text-xs text-ui-muted font-medium">Question {currentIndex + 1} of {notebookQuestions.length}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          {pacerIsActive ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono font-bold text-sm bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-sm">
              <Activity className="w-4 h-4 text-rose-500 animate-pulse" />
              <span className="hidden sm:inline text-xs font-sans text-rose-300">Pacer:</span>
              <span>{pacerCurrentQuestionTime}s</span>
              <span className="text-xs opacity-75">/ {pacerTargetTimeSeconds}s</span>
              <button
                onClick={() => stopPacer()}
                className="text-rose-400 hover:text-white p-0.5 ml-1 rounded hover:bg-rose-500/20"
                title="Desativar Pacer"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setPacerState({
                  pacerIsActive: true,
                  pacerTotalQuestions: notebookQuestions.length,
                  pacerTargetTimeSeconds: notebook.timeLimitPerQuestion || 72,
                  pacerCurrentQuestionTime: 0,
                  pacerCompletedQuestionsTime: [],
                });
                setTimerState('running');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20 transition-colors shadow-sm"
              title="Sincronizar com Pacer USMLE"
            >
              <Activity className="w-3.5 h-3.5 text-rose-500" />
              <span>Ativar Pacer ({notebook.timeLimitPerQuestion || 72}s)</span>
            </button>
          )}

          {notebook.timeLimitPerQuestion && !isTrainingChecked && !pacerIsActive && (
            <ExamTimer 
              initialTimeLeft={(notebook.timeLimitPerQuestion || 0) * notebook.questionIds.length} 
              isPaused={examFinished || (notebook.mode === 'training' && checkedQuestions[currentQ.id])}
              onTimeUp={handleTimeUp}
              onTick={(t) => timeLeftRef.current = t}
            />
          )}
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2 flex-wrap">
            {currentQ.subject && <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs font-semibold">{currentQ.subject}</span>}
            {currentQ.area && <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-xs font-semibold">{currentQ.area}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotes(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-ui-surface hover:bg-ui-surface-hover text-ui-text font-bold rounded-lg transition-colors border border-ui-border text-xs"
            >
              <Edit3 className="w-4 h-4" />
              Notes
            </button>
            <button
              onClick={() => setSourceQuestionForCard(currentQ)}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 font-bold rounded-lg transition-colors border border-amber-500/20 text-xs"
            >
              Create Flashcard
            </button>
          </div>
        </div>

        <div 
          className="prose prose-sm dark:prose-invert max-w-none bg-ui-surface border border-ui-border rounded-xl p-6 shadow-sm leading-relaxed text-ui-text rich-content"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentQ.text) }}
        />

        <div className="space-y-3 mt-8">
          {currentQ.alternatives.map((alt) => {
            const isSelected = selectedAnswers[currentQ.id] === alt.id;
            let statusClass = "border-ui-border hover:border-primary/50 bg-ui-surface hover:bg-ui-surface-hover";
            
            if (isSelected) {
              statusClass = "border-primary bg-primary/10";
            }

            if (isTrainingChecked || (examFinished && true)) {
              if (alt.isCorrect) {
                statusClass = "border-green-500 bg-green-500/10 ring-1 ring-green-500";
              } else if (isSelected) {
                statusClass = "border-red-500 bg-red-500/10";
              } else {
                statusClass = "border-ui-border bg-ui-surface opacity-50";
              }
            }

            return (
              <button
                key={alt.id}
                onClick={() => handleSelectAlternative(alt.id)}
                disabled={isTrainingChecked}
                className={cn(
                  "w-full text-left p-4 rounded-xl border transition-all flex items-start gap-4",
                  statusClass
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border shrink-0 font-bold text-sm",
                  isTrainingChecked && alt.isCorrect ? "bg-green-500 text-white border-green-500" :
                  isTrainingChecked && isSelected && !alt.isCorrect ? "bg-red-500 text-white border-red-500" :
                  isSelected ? "bg-primary text-primary-foreground border-primary" : "border-ui-border text-ui-text"
                )}>
                  {alt.letter}
                </div>
                <div 
                  className="flex-1 mt-1 rich-content prose prose-sm dark:prose-invert max-w-none break-words"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(alt.text) }}
                />
                
                {isTrainingChecked && alt.isCorrect && (
                  <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0 mt-1" />
                )}
                {isTrainingChecked && isSelected && !alt.isCorrect && (
                  <XCircle className="w-6 h-6 text-red-500 shrink-0 mt-1" />
                )}
              </button>
            );
          })}
        </div>
        
        <AnimatePresence>
          {(isTrainingChecked || examFinished) && currentQ.explanation && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-6 border border-emerald-500/30 bg-emerald-500/5 rounded-xl overflow-hidden"
            >
              <div className="bg-emerald-500/10 px-4 py-2 border-b border-emerald-500/20 font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Explanation
              </div>
              <div 
                className="p-4 prose prose-sm dark:prose-invert max-w-none text-ui-text rich-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentQ.explanation) }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-4xl z-20">
        <div className="bg-ui-surface border border-ui-border rounded-2xl p-4 shadow-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
             <button
                onClick={() => setShowSidebar(!showSidebar)}
                className={cn("p-2 rounded-lg transition-colors border", showSidebar ? "bg-primary text-primary-foreground border-primary" : "text-ui-muted hover:bg-ui-surface-hover border-transparent")}
                title="Questions Index"
             >
                <ListFilter className="w-5 h-5" />
             </button>
             <div className="hidden sm:block text-sm font-medium text-ui-muted ml-2">
               {Object.keys(selectedAnswers).length} answered
             </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-ui-surface-hover text-ui-text font-semibold rounded-xl hover:bg-ui-border transition-all active:scale-95 disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            <button
              onClick={handleCheckOrNext}
              disabled={!checkedQuestions[currentQ.id] && !selectedAnswers[currentQ.id] && notebook.mode === 'training' && timeLeftRef.current > 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
            >
              {notebook.mode === 'training' && !checkedQuestions[currentQ.id] ? 'Check Answer' : 
               currentIndex === notebookQuestions.length - 1 ? 'Finish' : 'Next'}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      
      {sourceQuestionForCard && (
        <CardCreationModal 
          sourceQuestion={sourceQuestionForCard} 
          onClose={() => setSourceQuestionForCard(null)} 
        />
      )}
      
      {showNotes && (
        <NotepadModal
          targetId={currentQ.id}
          targetType="question"
          onClose={() => setShowNotes(false)}
        />
      )}

      {/* Sidebar for Navigation */}
      <AnimatePresence>
        {showExitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-ui-surface border border-ui-border rounded-xl shadow-2xl w-full max-w-sm p-6">
                <h3 className="text-xl font-bold mb-2">Exit Session?</h3>
                <p className="text-ui-muted mb-6">Are you sure you want to exit? Your progress in this session will not be saved.</p>
                <div className="flex gap-3 justify-end">
                   <button onClick={() => setShowExitConfirm(false)} className="px-4 py-2 text-sm font-medium hover:bg-ui-surface-hover rounded-lg transition-colors">Cancel</button>
                   <button onClick={() => onNavigate({ type: 'notebooks' })} className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Exit</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="fixed left-4 top-24 bottom-32 w-20 sm:w-64 bg-ui-surface border border-ui-border rounded-xl shadow-xl z-30 flex flex-col overflow-hidden"
          >
            <div className="p-3 border-b border-ui-border bg-ui-surface-hover font-semibold text-ui-text flex items-center justify-between">
              <span className="hidden sm:inline">Questions</span>
              <span className="sm:hidden">#</span>
              <button onClick={() => setShowSidebar(false)} className="p-1 rounded hover:bg-ui-border text-ui-muted">
                 <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
               <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                 {notebookQuestions.map((q, idx) => {
                   const isA = !!selectedAnswers[q.id];
                   const isC = checkedQuestions[q.id];
                   const isCurrent = idx === currentIndex;
                   
                   let statusColor = "bg-ui-background border-ui-border text-ui-muted hover:bg-ui-surface-hover";
                   if (isCurrent) statusColor = "bg-primary text-primary-foreground border-primary font-bold shadow";
                   else if (isC) {
                      const correctAlt = q.alternatives.find(a => a.isCorrect);
                      if (selectedAnswers[q.id] === correctAlt?.id) statusColor = "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/50";
                      else statusColor = "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/50";
                   } else if (isA) {
                      statusColor = "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/50";
                   }

                   return (
                     <button
                       key={q.id}
                       onClick={() => {
                          setCurrentIndex(idx);
                          // Optionally closing on mobile
                          if (window.innerWidth < 640) setShowSidebar(false);
                       }}
                       className={cn(
                         "h-10 border rounded flex items-center justify-center text-sm transition-colors relative",
                         statusColor
                       )}
                     >
                       {idx + 1}
                     </button>
                   );
                 })}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AutoHighlighter>
  );
};
