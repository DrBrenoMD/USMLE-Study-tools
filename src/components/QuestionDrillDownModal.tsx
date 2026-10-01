import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  CheckCircle2,
  XCircle,
  ExternalLink,
  BookOpen,
  Clock,
  Layers,
  Search,
  Filter,
  ArrowUpRight,
  Eye,
  CheckSquare
} from 'lucide-react';
import { Question } from '../cardblocks/store/useStore';
import { cn } from '../lib/utils';

interface QuestionDrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  questions: Question[];
}

export const QuestionDrillDownModal: React.FC<QuestionDrillDownModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  questions
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedQid, setExpandedQid] = useState<string | null>(null);

  if (!isOpen) return null;

  const total = questions.length;
  const correctCount = questions.filter(q => q.status === 'correct').length;
  const incorrectCount = questions.filter(q => q.status === 'incorrect').length;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const filteredQuestions = questions.filter(q => {
    if (filterMode === 'correct' && q.status !== 'correct') return false;
    if (filterMode === 'incorrect' && q.status !== 'incorrect') return false;
    if (searchQuery.trim()) {
      const qterm = searchQuery.toLowerCase();
      const matchQid = (q.qid || q.id || '').toLowerCase().includes(qterm);
      const matchText = (q.text || q.stem || '').toLowerCase().includes(qterm);
      const matchSub = (q.subject || '').toLowerCase().includes(qterm);
      const matchSys = (q.system || '').toLowerCase().includes(qterm);
      return matchQid || matchText || matchSub || matchSys;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold text-xs">
                Drill-down
              </span>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
                {title}
              </h3>
            </div>
            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {subtitle}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="self-end sm:self-auto p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Summary & Filters */}
        <div className="px-5 py-3.5 bg-gray-50/50 dark:bg-gray-850/50 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
          {/* Quick Counter Chips */}
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300">
              Total: {total}
            </span>
            <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {correctCount} Acertos
            </span>
            <span className="px-2.5 py-1 bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 rounded-lg text-xs font-bold flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              {incorrectCount} Erros
            </span>
            <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 rounded-lg text-xs font-bold">
              {accuracy}% Acerto
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-200 dark:bg-gray-700 p-0.5 rounded-xl text-xs font-bold">
              <button
                onClick={() => setFilterMode('all')}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-all",
                  filterMode === 'all'
                    ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs"
                    : "text-gray-600 dark:text-gray-300"
                )}
              >
                Todas ({total})
              </button>
              <button
                onClick={() => setFilterMode('correct')}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-all",
                  filterMode === 'correct'
                    ? "bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-2xs"
                    : "text-gray-600 dark:text-gray-300"
                )}
              >
                Acertos ({correctCount})
              </button>
              <button
                onClick={() => setFilterMode('incorrect')}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-all",
                  filterMode === 'incorrect'
                    ? "bg-white dark:bg-gray-900 text-rose-600 dark:text-rose-400 shadow-2xs"
                    : "text-gray-600 dark:text-gray-300"
                )}
              >
                Erros ({incorrectCount})
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-5 pt-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por QID ou termo no enunciado..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Questions List */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {filteredQuestions.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs">
              Nenhuma questão encontrada com os filtros aplicados.
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const isCorrect = q.status === 'correct';
              const isExpanded = expandedQid === q.id || expandedQid === q.qid;
              const cleanStem = (q.stem || q.text || '').replace(/<[^>]+>/g, '');

              return (
                <div
                  key={q.id || q.qid}
                  className="p-4 bg-gray-50/80 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700/80 space-y-3 transition-colors hover:border-blue-300 dark:hover:border-blue-700"
                >
                  {/* Top Bar of Card */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md font-mono text-xs font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300">
                        QID: {q.qid || q.id}
                      </span>

                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-md text-xs font-bold flex items-center gap-1",
                          isCorrect
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300"
                        )}
                      >
                        {isCorrect ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Acertou</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            <span>Errou</span>
                          </>
                        )}
                      </span>

                      {q.subject && (
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                          • {q.subject}
                        </span>
                      )}

                      {q.system && (
                        <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                          / {q.system}
                        </span>
                      )}
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setExpandedQid(isExpanded ? null : (q.id || q.qid))}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>{isExpanded ? 'Recolher' : 'Ver Detalhes'}</span>
                      </button>

                      <a
                        href={`/questions?qid=${q.qid || q.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 shadow-xs transition-colors"
                      >
                        <span>Abrir</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Question Stem */}
                  <p className={cn("text-xs text-gray-800 dark:text-gray-200 leading-relaxed font-medium", !isExpanded && "line-clamp-2")}>
                    {cleanStem || 'Sem enunciado disponível.'}
                  </p>

                  {/* Expanded Details: Alternatives & Explanation */}
                  {isExpanded && (
                    <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700 animate-in fade-in">
                      {q.alternatives && q.alternatives.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                            Alternativas:
                          </span>
                          <div className="grid grid-cols-1 gap-1.5">
                            {q.alternatives.map((alt) => {
                              const isStudentSelected = q.selectedChoiceId === alt.id;
                              const isGabarito = alt.isCorrect;

                              return (
                                <div
                                  key={alt.id}
                                  className={cn(
                                    "p-2.5 rounded-xl border text-xs flex items-start gap-2",
                                    isGabarito
                                      ? "bg-emerald-50/70 border-emerald-300 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200 font-bold"
                                      : isStudentSelected
                                      ? "bg-rose-50/70 border-rose-300 text-rose-950 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200"
                                      : "bg-white dark:bg-gray-850 border-gray-200 dark:border-gray-750 text-gray-700 dark:text-gray-300"
                                  )}
                                >
                                  <span className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 bg-black/5 dark:bg-white/10">
                                    {alt.letter || '•'}
                                  </span>
                                  <div className="flex-1">
                                    <span>{alt.text.replace(/<[^>]+>/g, '')}</span>
                                    {isGabarito && (
                                      <span className="ml-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                        (Gabarito Correto)
                                      </span>
                                    )}
                                    {isStudentSelected && !isGabarito && (
                                      <span className="ml-2 text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                                        (Sua Escolha)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Educational Objective or Explanation */}
                      {(q.educationalObjective || q.explanation) && (
                        <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/50 text-xs text-blue-950 dark:text-blue-200 space-y-1">
                          <b>Objetivo Educacional / Explicação:</b>
                          <p className="leading-relaxed">
                            {(q.educationalObjective || q.explanation || '').replace(/<[^>]+>/g, '')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50/80 dark:bg-gray-850 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
          <span>{filteredQuestions.length} de {questions.length} questões exibidas</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-650 text-gray-800 dark:text-gray-200 rounded-xl font-bold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
};
