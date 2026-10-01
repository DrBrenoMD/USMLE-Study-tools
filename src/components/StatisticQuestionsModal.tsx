import React, { useState, useMemo } from 'react';
import { useStore, Question } from '../cardblocks/store/useStore';
import {
  X,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  BookOpen,
  Filter,
  ExternalLink,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronRight,
  Eye,
  Check,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, sanitizeHtml } from '../cardblocks/lib/utils';
import { useNavigate } from 'react-router-dom';

export interface StatisticQuestionsFilter {
  subject?: string;
  system?: string;
  dateStr?: string;
  status?: 'all' | 'correct' | 'incorrect';
}

interface StatisticQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  filter: StatisticQuestionsFilter;
  onNavigateToQuestion?: (questionId: string) => void;
}

export function StatisticQuestionsModal({
  isOpen,
  onClose,
  title,
  subtitle,
  filter,
  onNavigateToQuestion
}: StatisticQuestionsModalProps) {
  const navigate = useNavigate();
  const { questions, questionBanks, resetQuestionStats } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  // Busca e filtra questões estritamente reais do banco
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      // 1. Filtro por Subject (se especificado)
      if (filter.subject && filter.subject !== 'all' && filter.subject !== 'Todos os Subjects') {
        const qSubj = (q.subject || '').trim().toLowerCase();
        const targetSubj = filter.subject.trim().toLowerCase();
        if (qSubj !== targetSubj) return false;
      }

      // 2. Filtro por System (se especificado)
      if (filter.system && filter.system !== 'all') {
        const qSys = (q.system || '').trim().toLowerCase();
        const targetSys = filter.system.trim().toLowerCase();
        if (qSys !== targetSys) return false;
      }

      // 3. Filtro por Data (se especificado)
      if (filter.dateStr) {
        if (!q.lastAnsweredAt) return false;
        const qDateStr = format(new Date(q.lastAnsweredAt), 'yyyy-MM-dd');
        if (qDateStr !== filter.dateStr) return false;
      }

      // 4. Deve ser questão respondida/com estatística
      const isAnswered = q.status === 'correct' || q.status === 'incorrect' || (q.attempts && q.attempts.length > 0) || Boolean(q.lastAnsweredAt);
      if (!isAnswered) return false;

      // 5. Filtro interno por Status (Todas / Corretas / Incorretas)
      if (statusFilter === 'correct' && q.status !== 'correct') return false;
      if (statusFilter === 'incorrect' && q.status !== 'incorrect') return false;

      // 6. Busca textual por QID ou texto
      if (searchQuery.trim()) {
        const term = searchQuery.toLowerCase();
        const matchQid = (q.qid || '').toLowerCase().includes(term);
        const matchStem = (q.stem || q.text || '').toLowerCase().includes(term);
        const matchSubject = (q.subject || '').toLowerCase().includes(term);
        const matchSystem = (q.system || '').toLowerCase().includes(term);
        if (!matchQid && !matchStem && !matchSubject && !matchSystem) return false;
      }

      return true;
    });
  }, [questions, filter, statusFilter, searchQuery]);

  const statsCount = useMemo(() => {
    // Contagem dentro do universo filtrado por matéria/sistema/data
    const base = questions.filter(q => {
      if (filter.subject && filter.subject !== 'all' && filter.subject !== 'Todos os Subjects') {
        if ((q.subject || '').trim().toLowerCase() !== filter.subject.trim().toLowerCase()) return false;
      }
      if (filter.system && filter.system !== 'all') {
        if ((q.system || '').trim().toLowerCase() !== filter.system.trim().toLowerCase()) return false;
      }
      if (filter.dateStr) {
        if (!q.lastAnsweredAt) return false;
        if (format(new Date(q.lastAnsweredAt), 'yyyy-MM-dd') !== filter.dateStr) return false;
      }
      return q.status === 'correct' || q.status === 'incorrect' || (q.attempts && q.attempts.length > 0) || Boolean(q.lastAnsweredAt);
    });

    const correct = base.filter(q => q.status === 'correct').length;
    const incorrect = base.filter(q => q.status === 'incorrect').length;
    return {
      total: base.length,
      correct,
      incorrect,
    };
  }, [questions, filter]);

  if (!isOpen) return null;

  const formatSec = (sec?: number) => {
    if (!sec) return '—';
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m === 0) return `${rem}s`;
    return `${m}m ${rem}s`;
  };

  const handleResetSingle = (qId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Zerar o histórico e estatísticas desta questão específica? Ela voltará para o status "Não respondida".')) {
      resetQuestionStats(qId);
    }
  };

  const handleOpenInDesk = (qId: string) => {
    onClose();
    navigate(`/desk?qid=${qId}`);
  };

  const handleOpenInQBank = (qId: string) => {
    onClose();
    if (onNavigateToQuestion) {
      onNavigateToQuestion(qId);
    } else {
      navigate(`/questions?qid=${qId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header do Modal */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-4 bg-gray-50/70 dark:bg-gray-850/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                <BookOpen className="w-5 h-5" />
              </span>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">
                {title}
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {subtitle || 'Lista das questões capturadas pela extensão que compõem este indicador estatístico.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar de Filtro e Busca interna */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-xl transition-all cursor-pointer",
                statusFilter === 'all'
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              Todas ({statsCount.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('correct')}
              className={cn(
                "px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer",
                statusFilter === 'correct'
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Acertos ({statsCount.correct})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('incorrect')}
              className={cn(
                "px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer",
                statusFilter === 'incorrect'
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              )}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Erros ({statsCount.incorrect})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por QID ou texto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Lista de Questões Reais */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {filteredQuestions.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
              <div className="p-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400">
                <HelpCircle className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-sm text-gray-700 dark:text-gray-300">
                Nenhuma questão encontrada com estes critérios
              </h4>
              <p className="text-xs text-gray-500 max-w-md">
                As questões aparecem aqui quando são capturadas pela extensão e respondidas no Desk ou no Q-Bank.
              </p>
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const bank = questionBanks.find(b => b.id === q.bankId);
              const isExpanded = expandedQuestionId === q.id;
              const isCorrect = q.status === 'correct';
              const correctAlt = q.alternatives.find(a => a.isCorrect);
              const userSelectedAlt = q.alternatives.find(a => a.id === q.selectedChoiceId);

              return (
                <div
                  key={q.id}
                  className={cn(
                    "p-4 rounded-2xl border transition-all bg-white dark:bg-gray-850",
                    isCorrect
                      ? "border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-400"
                      : "border-rose-200 dark:border-rose-900/60 hover:border-rose-400"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Badges bar */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-mono font-black px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-750 text-gray-800 dark:text-gray-200">
                          QID #{q.qid || q.id.substring(0, 6)}
                        </span>

                        <span className={cn(
                          "px-2 py-0.5 rounded-lg font-bold flex items-center gap-1",
                          isCorrect
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        )}>
                          {isCorrect ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          <span>{isCorrect ? 'Correta' : 'Incorreta'}</span>
                        </span>

                        {q.subject && (
                          <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold">
                            📚 {q.subject}
                          </span>
                        )}

                        {q.system && (
                          <span className="px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold">
                            🩺 {q.system}
                          </span>
                        )}

                        {bank && (
                          <span className="text-[11px] text-gray-400 truncate">
                            {bank.name}
                          </span>
                        )}

                        {q.lastAnsweredAt && (
                          <span className="text-[11px] text-gray-400 font-mono ml-auto">
                            Respondida em {format(new Date(q.lastAnsweredAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        )}
                      </div>

                      {/* Stem Text Preview */}
                      <p className="text-xs sm:text-sm text-gray-900 dark:text-gray-100 line-clamp-2 font-medium leading-relaxed">
                        {q.stem || q.text}
                      </p>

                      {/* Time stats */}
                      <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400 font-mono pt-1">
                        <span>Tempo Resolução: <b>{formatSec(q.resolutionTimeSeconds)}</b></span>
                        {q.reviewTimeSeconds ? <span>• Tempo Revisão: <b>{formatSec(q.reviewTimeSeconds)}</b></span> : null}
                        {userSelectedAlt && (
                          <span>• Marcada: <b>{userSelectedAlt.letter}</b></span>
                        )}
                        {correctAlt && (
                          <span>• Gabarito: <b className="text-emerald-600">{correctAlt.letter}</b></span>
                        )}
                      </div>
                    </div>

                    {/* Actions on question */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors flex items-center gap-1 cursor-pointer"
                        title={isExpanded ? 'Recolher detalhes' : 'Ver alternativas e explicação'}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{isExpanded ? 'Recolher' : 'Detalhes'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenInDesk(q.qid || q.id)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                        title="Abrir no Study Desk (Mesa de Estudos)"
                      >
                        <Layers className="w-3.5 h-3.5 text-purple-600" />
                        <span>Study Desk</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenInQBank(q.qid || q.id)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                        title="Abrir no Banco de Questões"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                        <span>Banco</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleResetSingle(q.id, e)}
                        className="p-1.5 rounded-xl text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                        title="Zerar estatísticas desta questão"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details: Alternatives & Explanation */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3 animate-in fade-in duration-150">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Alternativas & Gabarito:
                      </div>

                      <div className="space-y-2">
                        {q.alternatives.map((alt) => {
                          const isCorrectChoice = alt.isCorrect;
                          const isUserChoice = alt.id === q.selectedChoiceId;

                          return (
                            <div
                              key={alt.id}
                              className={cn(
                                "p-2.5 rounded-xl border text-xs flex items-start gap-2.5 transition-colors",
                                isCorrectChoice
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 font-semibold"
                                  : isUserChoice
                                  ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100"
                                  : "bg-gray-50/50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                              )}
                            >
                              <span className={cn(
                                "w-5 h-5 rounded-md flex items-center justify-center font-bold shrink-0 text-[11px]",
                                isCorrectChoice ? "bg-emerald-600 text-white" : isUserChoice ? "bg-rose-600 text-white" : "bg-gray-200 dark:bg-gray-700"
                              )}>
                                {alt.letter}
                              </span>

                              <div className="flex-1">
                                <span>{alt.text}</span>
                                {isCorrectChoice && (
                                  <span className="ml-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    ✓ Resposta Correta
                                  </span>
                                )}
                                {isUserChoice && !isCorrectChoice && (
                                  <span className="ml-2 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                    ✗ Sua Escolha
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl space-y-1 text-xs">
                          <b className="text-blue-700 dark:text-blue-300 block">Explicação:</b>
                          <div
                            className="prose dark:prose-invert max-w-none text-xs text-gray-800 dark:text-gray-200"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.explanation) }}
                          />
                        </div>
                      )}

                      {q.educationalObjective && (
                        <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-xl text-xs text-amber-900 dark:text-amber-200">
                          <b className="block mb-0.5">🎯 Objetivo Educacional:</b>
                          <span>{q.educationalObjective}</span>
                        </div>
                      )}

                      {/* Question Navigation Bar inside Expanded view */}
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                        <span className="text-[11px] text-gray-400 font-mono">
                          ID: {q.id} {q.qid ? `• QID: ${q.qid}` : ''}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenInDesk(q.qid || q.id)}
                            className="px-3 py-1.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Abrir no Study Desk</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenInQBank(q.qid || q.id)}
                            className="px-3 py-1.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Abrir no Banco</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-850/60 flex items-center justify-between text-xs text-gray-500">
          <span>
            Exibindo <b>{filteredQuestions.length}</b> de <b>{statsCount.total}</b> questões capturadas
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl font-bold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-90 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
