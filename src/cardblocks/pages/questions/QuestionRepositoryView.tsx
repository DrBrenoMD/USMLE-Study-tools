import React, { useState, useMemo } from 'react';
import { useStore, Question } from '../../store/useStore';
import {
  ChevronLeft,
  Search,
  Layers,
  Sparkles,
  BookOpen,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Trash2,
  Eye,
  Plus,
  Upload,
  Activity
} from 'lucide-react';
import { AssociatedCardsModal } from '../../../components/AssociatedCardsModal';
import { ImportBankModal } from '../../components/ImportBankModal';
import { QBankDiagnosticModal } from '../../components/QBankDiagnosticModal';
import { RichContentRenderer } from '../../components/RichContentRenderer';

interface QuestionRepositoryViewProps {
  bankId: string;
  onBackToBanks: () => void;
  onOpenCardCreator: (questionData: any) => void;
}

export const QuestionRepositoryView: React.FC<QuestionRepositoryViewProps> = ({
  bankId,
  onBackToBanks,
  onOpenCardCreator,
}) => {
  const { questionBanks, questions, deleteQuestion, resetQuestionStats, cards } = useStore();
  const bank = questionBanks.find(b => b.id === bankId) || questionBanks[0];

  const bankQuestions = useMemo(() => {
    return questions.filter(q => q.bankId === bank?.id);
  }, [questions, bank]);

  const [search, setSearch] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedSystem, setSelectedSystem] = useState<string>('all');
  const [activeModalQid, setActiveModalQid] = useState<string | null>(null);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    bankQuestions.forEach(q => {
      if (q.subject) set.add(q.subject);
    });
    return Array.from(set).sort();
  }, [bankQuestions]);

  const systems = useMemo(() => {
    const set = new Set<string>();
    bankQuestions.forEach(q => {
      if (selectedSubject === 'all' || q.subject === selectedSubject) {
        if (q.system) set.add(q.system);
      }
    });
    return Array.from(set).sort();
  }, [bankQuestions, selectedSubject]);

  const filtered = useMemo(() => {
    return bankQuestions.filter(q => {
      const matchSearch =
        (q.qid && q.qid.toLowerCase().includes(search.toLowerCase())) ||
        (q.text && q.text.toLowerCase().includes(search.toLowerCase())) ||
        (q.stem && q.stem.toLowerCase().includes(search.toLowerCase())) ||
        (q.educationalObjective && q.educationalObjective.toLowerCase().includes(search.toLowerCase()));

      if (!matchSearch) return false;
      if (selectedSubject !== 'all' && q.subject !== selectedSubject) return false;
      if (selectedSystem !== 'all' && q.system !== selectedSystem) return false;

      return true;
    });
  }, [bankQuestions, search, selectedSubject, selectedSystem]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToBanks}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                Repositório de Questões
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                {bank?.name}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {bankQuestions.length} questões armazenadas com identificador único QID.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDiagnosticOpen(true)}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Diagnóstico de sincronização com a extensão"
          >
            <Activity className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Diagnóstico</span>
          </button>
          <button
            onClick={() => setIsImporting(true)}
            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar Questões</span>
          </button>
        </div>
      </div>

      {/* Modal de Diagnóstico */}
      {isDiagnosticOpen && (
        <QBankDiagnosticModal onClose={() => setIsDiagnosticOpen(false)} />
      )}

      {/* Modal de Importação */}
      {isImporting && (
        <ImportBankModal 
          defaultBankId={bank?.id} 
          onClose={() => setIsImporting(false)} 
        />
      )}

      {/* Filtros e Busca */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por QID, enunciado ou educational objective..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={selectedSubject}
          onChange={(e) => {
            setSelectedSubject(e.target.value);
            setSelectedSystem('all');
          }}
          className="w-full md:w-auto px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
        >
          <option value="all">Todas as Matérias (Subjects)</option>
          {subjects.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={selectedSystem}
          onChange={(e) => setSelectedSystem(e.target.value)}
          className="w-full md:w-auto px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
        >
          <option value="all">Todos os Sistemas (Systems)</option>
          {systems.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Lista de Questões */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs text-xs text-gray-400">
            Nenhuma questão encontrada com os filtros selecionados.
          </div>
        ) : (
          filtered.map(q => {
            const isExpanded = expandedQuestionId === q.id;
            const matchingCards = cards.filter(c => {
              const qidStr = (q.qid || '').toString().trim();
              if (!qidStr) return false;
              return (
                c.questionId === qidStr ||
                c.questionId === `qid:${qidStr}` ||
                (c.tags && c.tags.includes(`qid:${qidStr}`))
              );
            });

            return (
              <div
                key={q.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs space-y-3 hover:border-blue-200 dark:hover:border-blue-900/60 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      QID: #{q.qid}
                    </span>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {q.subject || 'Geral'}
                    </span>
                    {q.system && (
                      <>
                        <span className="text-gray-300 dark:text-gray-700">•</span>
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          {q.system}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status badge */}
                    {q.status === 'correct' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Acerto</span>
                      </span>
                    ) : q.status === 'incorrect' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full">
                        <XCircle className="w-3 h-3" />
                        <span>Erro</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                        Não Feita
                      </span>
                    )}

                    {/* Card Link Badge / Button */}
                    {matchingCards.length > 0 ? (
                      <button
                        onClick={() => setActiveModalQid(q.qid)}
                        className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <Layers className="w-3 h-3" />
                        <span>{matchingCards.length} Card(s)</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          onOpenCardCreator({
                            questionId: q.qid,
                            questionStem: q.stem || q.text,
                            questionChoices: q.alternatives.map(a => `${a.letter || ''}. ${a.text}`).join('\n'),
                            explanation: q.explanation,
                            educationalObjective: q.educationalObjective,
                            subject: q.subject,
                            system: q.system,
                            questionImages: q.images,
                            tags: [`qid:${q.qid}`, 'qbank-sync'],
                          });
                        }}
                        className="px-2.5 py-1 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Criar Card</span>
                      </button>
                    )}

                    <button
                      onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Enunciado Prévio */}
                <div className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 line-clamp-2">
                  <RichContentRenderer content={q.stem || q.text} />
                </div>

                {/* Detalhes Expandidos */}
                {isExpanded && (
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3 text-xs">
                    {/* Stem completo */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl">
                      <RichContentRenderer content={q.stem || q.text} />
                    </div>

                    {/* Alternativas */}
                    {q.alternatives && q.alternatives.length > 0 && (
                      <div className="space-y-1">
                        <div className="font-bold text-gray-400 uppercase text-[10px]">Alternativas:</div>
                        {q.alternatives.map((alt, i) => (
                          <div
                            key={alt.id}
                            className={`p-2 rounded-lg border text-xs flex items-start justify-between gap-2 ${
                              alt.isCorrect
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-200 font-bold'
                                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                            }`}
                          >
                            <div className="flex items-start gap-1.5 flex-1">
                              <span className="font-bold shrink-0">{alt.letter || String.fromCharCode(65 + i)}.</span>
                              <div className="flex-1">
                                <RichContentRenderer content={alt.text} />
                              </div>
                            </div>
                            {alt.isCorrect && <span className="text-[10px] text-emerald-600 font-extrabold uppercase shrink-0">Correta</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Educational Objective */}
                    {q.educationalObjective && (
                      <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-100">
                        <div className="font-bold mb-1">Educational Objective:</div>
                        <RichContentRenderer content={q.educationalObjective} />
                      </div>
                    )}

                    {/* Explicação */}
                    {q.explanation && (
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-gray-700 dark:text-gray-300 max-h-64 overflow-y-auto">
                        <div className="font-bold mb-1">Explicação:</div>
                        <RichContentRenderer content={q.explanation} />
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => resetQuestionStats(q.id)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Resetar Estatísticas</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Excluir permanentemente a questão #${q.qid}?`)) {
                            deleteQuestion(q.id);
                          }
                        }}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Excluir Questão</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Cards Associados */}
      {activeModalQid && (
        <AssociatedCardsModal
          isOpen={true}
          onClose={() => setActiveModalQid(null)}
          qid={activeModalQid}
          cards={cards.filter(c => {
            const qidStr = (activeModalQid || '').toString().trim();
            return (
              c.questionId === qidStr ||
              c.questionId === `qid:${qidStr}` ||
              (c.tags && c.tags.includes(`qid:${qidStr}`))
            );
          })}
        />
      )}
    </div>
  );
};
