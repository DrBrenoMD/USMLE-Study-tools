import React from 'react';
import { X, Layers, ExternalLink, Tag, CheckCircle2, Play, Calendar, Zap, AlertCircle } from 'lucide-react';
import { Flashcard, useStore } from '../cardblocks/store/useStore';
import { useNavigate } from 'react-router-dom';
import { findCardsForQuestion } from '../utils/qbankCardMatcher';
import { notify } from '../cardblocks/lib/toast';

interface AssociatedCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  qid: string;
  cards?: Flashcard[];
}

export const AssociatedCardsModal: React.FC<AssociatedCardsModalProps> = ({
  isOpen,
  onClose,
  qid,
  cards: propCards,
}) => {
  const navigate = useNavigate();
  const allCards = useStore(state => state.cards);
  const decks = useStore(state => state.decks);
  const activateAndScheduleForToday = useStore(state => state.activateAndScheduleForToday);
  const unsuspendCard = useStore(state => state.unsuspendCard);
  const scheduleCardForToday = useStore(state => state.scheduleCardForToday);
  const associateCardWithQuestion = useStore(state => state.associateCardWithQuestion);
  const bulkActivateAndScheduleForToday = useStore(state => state.bulkActivateAndScheduleForToday);

  if (!isOpen) return null;

  // Retrieve matching cards using the high-performance matcher that handles AnKing & created tags
  const matchedCards = findCardsForQuestion(allCards, qid);
  const displayCards = matchedCards.length > 0 ? matchedCards : (propCards || []);

  const decksMap = new Map(decks.map(d => [d.id, d.name]));
  const now = Date.now();

  const handleActivateAll = () => {
    const ids = displayCards.map(c => c.id);
    bulkActivateAndScheduleForToday(ids, qid);
    notify(`Todos os ${ids.length} flashcards foram ativados e agendados para revisão hoje!`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Flashcards Associados à Questão
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold">
                  QID: #{qid}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {displayCards.length} {displayCards.length === 1 ? 'cartão identificado' : 'cartões identificados'} (AnKing e/ou criados).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Action Bar */}
        {displayCards.length > 0 && (
          <div className="px-5 py-2.5 bg-blue-50/60 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40 flex items-center justify-between gap-3">
            <div className="text-xs text-blue-800 dark:text-blue-300 font-medium">
              Ações em lote para esta questão:
            </div>
            <button
              onClick={handleActivateAll}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Ativar Todos e Revisar Hoje</span>
            </button>
          </div>
        )}

        {/* List of cards */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {displayCards.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              Nenhum flashcard associado a esta questão no momento.
            </div>
          ) : (
            displayCards.map((card, idx) => {
              const isDue = (card.nextReviewDate || 0) <= now && !card.isSuspended;
              const isSuspended = Boolean(card.isSuspended);
              const deckName = decksMap.get(card.deckId) || 'Baralho';

              return (
                <div
                  key={card.id}
                  className={`p-4 rounded-xl border transition-colors space-y-3 ${
                    isSuspended
                      ? 'bg-rose-50/20 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/40'
                      : isDue
                      ? 'bg-amber-50/20 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/40'
                      : 'bg-gray-50/80 dark:bg-gray-800/40 border-gray-200 dark:border-gray-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-gray-200/60 dark:border-gray-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[11px]">
                        Cartão #{idx + 1}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-200 dark:bg-gray-700 font-semibold text-gray-600 dark:text-gray-300">
                        {deckName}
                      </span>
                      {isSuspended ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-900/60">
                          Inativo (Suspenso)
                        </span>
                      ) : isDue ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-900/60">
                          Para Revisar Hoje
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-900/60">
                          Agendado ({new Date(card.nextReviewDate).toLocaleDateString()})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Quick 1-click combo */}
                      <button
                        onClick={() => {
                          activateAndScheduleForToday(card.id, qid);
                          notify('Cartão ativado, agendado para hoje e associado!', 'success');
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
                        title="Ativar se inativo, agendar para a fila de hoje e associar à questão"
                      >
                        <Zap className="w-3 h-3 fill-current" />
                        <span>Ativar & Revisar Hoje</span>
                      </button>

                      {isSuspended ? (
                        <button
                          onClick={() => {
                            unsuspendCard(card.id);
                            notify('Cartão ativado!', 'info');
                          }}
                          className="px-2 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold"
                        >
                          Ativar
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            scheduleCardForToday(card.id);
                            notify('Cartão agendado para revisão hoje!', 'info');
                          }}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold"
                        >
                          Revisar Hoje
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onClose();
                          navigate(`/flashcards?tab=browse&search=${encodeURIComponent(qid)}`);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"
                        title="Abrir no Navegador"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Front */}
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Frente:
                    </div>
                    <div
                      className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-900 dark:text-gray-100 prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: card.front || '<i class="text-gray-400">Sem conteúdo frontal</i>' }}
                    />
                  </div>

                  {/* Back */}
                  <div>
                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
                      Verso:
                    </div>
                    <div
                      className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 text-sm text-gray-800 dark:text-gray-200 prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: card.back || '<i class="text-gray-400">Sem conteúdo no verso</i>' }}
                    />
                  </div>

                  {/* Tags */}
                  {card.tags && card.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {card.tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-200 dark:bg-gray-800 text-[10px] font-medium text-gray-700 dark:text-gray-300"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
