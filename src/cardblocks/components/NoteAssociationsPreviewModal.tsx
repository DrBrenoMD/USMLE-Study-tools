import React, { useState } from 'react';
import { useStore, Question, Flashcard } from '../store/useStore';
import {
  X,
  BookOpen,
  Layers,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Play,
  ArrowRight,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sanitizeHtml } from '../lib/utils';
import { notify } from '../lib/toast';

interface NoteAssociationsPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  questionIds?: string[];
  cardIds?: string[];
  onNavigateToStudy?: (cardIds: string[]) => void;
}

export const NoteAssociationsPreviewModal: React.FC<NoteAssociationsPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  questionIds = [],
  cardIds = [],
  onNavigateToStudy
}) => {
  const navigate = useNavigate();
  const { questions, cards, decks, bulkActivateAndScheduleForToday } = useStore();

  const [activeTab, setActiveTab] = useState<'questions' | 'cards'>(
    questionIds.length > 0 ? 'questions' : 'cards'
  );

  if (!isOpen) return null;

  // Match questions by ID or QID
  const matchedQuestions: Question[] = questionIds.map(qIdOrQid => {
    const found = questions.find(q => q.id === qIdOrQid || q.qid === qIdOrQid);
    if (found) return found;
    // Fallback stub if not in store yet
    return {
      id: qIdOrQid,
      qid: qIdOrQid,
      bankId: 'default',
      stem: `Questão Q-Bank QID #${qIdOrQid}`,
      text: `Questão Q-Bank QID #${qIdOrQid}`,
      alternatives: [],
      explanation: '',
      educationalObjective: '',
      subject: 'Clínica Geral',
      system: 'Geral',
      timesAnswered: 0,
      timesCorrect: 0,
      createdAt: Date.now()
    } as Question;
  });

  // Match cards by ID or associated question
  const matchedCards: Flashcard[] = cardIds.map(cId => {
    const found = cards.find(c => c.id === cId);
    if (found) return found;
    return null;
  }).filter(Boolean) as Flashcard[];

  // Also include any cards associated with the question IDs if cardIds is empty
  const allRelatedCards = matchedCards.length > 0 
    ? matchedCards 
    : cards.filter(c => 
        c.associatedQuestionIds?.some(qid => questionIds.includes(qid)) ||
        (c.sourceQuestionId && questionIds.includes(c.sourceQuestionId))
      );

  const handleOpenInDesk = (qid: string) => {
    onClose();
    navigate(`/desk?qid=${qid}`);
  };

  const handleOpenInHub = (qid: string) => {
    onClose();
    navigate(`/questions?qid=${qid}`);
  };

  const handleActivateAllCards = () => {
    const ids = allRelatedCards.map(c => c.id);
    if (ids.length > 0) {
      bulkActivateAndScheduleForToday(ids);
      notify(`Todos os ${ids.length} flashcards foram agendados para revisão hoje!`, 'success');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs animate-fade-in text-gray-900 dark:text-gray-100">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/80 dark:bg-gray-850/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
              {activeTab === 'questions' ? <BookOpen className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <span>{title}</span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Itens associados a esta anotação clínica
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('questions')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'questions'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Questões Q-Bank ({matchedQuestions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('cards')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'cards'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Flashcards ({allRelatedCards.length})</span>
            </button>
          </div>

          {activeTab === 'cards' && allRelatedCards.length > 0 && (
            <button
              onClick={handleActivateAllCards}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Ativar Todos Hoje</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: QUESTIONS */}
          {activeTab === 'questions' && (
            <div className="space-y-4">
              {matchedQuestions.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  Nenhuma questão vinculada a esta nota.
                </div>
              ) : (
                matchedQuestions.map((q, idx) => {
                  const attempts = q.attempts || [];
                  const hasStats = attempts.length > 0 || Boolean(q.status && q.status !== 'unused');
                  const correctAttempts = attempts.filter(a => a.isCorrect).length;
                  const totalAttempts = attempts.length;
                  const accuracy = totalAttempts > 0 
                    ? Math.round((correctAttempts / totalAttempts) * 100) 
                    : q.status === 'correct' ? 100 : q.status === 'incorrect' ? 0 : null;

                  return (
                    <div
                      key={q.id || idx}
                      className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850/50 space-y-3 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono font-bold text-xs">
                            QID #{q.qid || q.id}
                          </span>
                          {q.subject && (
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px]">
                              📚 {q.subject}
                            </span>
                          )}
                          {q.system && (
                            <span className="px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold text-[11px]">
                              🩺 {q.system}
                            </span>
                          )}
                        </div>

                        {accuracy !== null && (
                          <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                            accuracy >= 70 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            Taxa de Acerto: {accuracy}%
                          </span>
                        )}
                      </div>

                      <div
                        className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-3"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.stem || q.text || 'Sem texto') }}
                      />

                      {q.educationalObjective && (
                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-900 dark:text-amber-200">
                          <b>🎯 Objetivo:</b> {q.educationalObjective}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                        <button
                          onClick={() => handleOpenInHub(q.qid || q.id)}
                          className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Ver no Hub</span>
                        </button>
                        <button
                          onClick={() => handleOpenInDesk(q.qid || q.id)}
                          className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Abrir na Mesa de Estudos</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: FLASHCARDS */}
          {activeTab === 'cards' && (
            <div className="space-y-4">
              {allRelatedCards.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  Nenhum flashcard vinculado diretamente a esta nota.
                </div>
              ) : (
                allRelatedCards.map(c => {
                  const deck = decks.find(d => d.id === c.deckId);

                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850/50 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                          {deck ? deck.name : 'Baralho Padrão'}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          Repetições: {c.repetition} • Intervalo: {c.interval}d
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                          <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Frente</span>
                          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.front) }} />
                        </div>
                        <div className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                          <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Verso</span>
                          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.back) }} />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                        <button
                          onClick={() => {
                            onClose();
                            navigate(`/browse?cardId=${c.id}`);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Abrir no Navegador de Cards</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-xs cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
