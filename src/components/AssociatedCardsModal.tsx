import React from 'react';
import { X, Layers, ExternalLink, Tag, CheckCircle2 } from 'lucide-react';
import { Flashcard } from '../cardblocks/store/useStore';
import { useNavigate } from 'react-router-dom';

interface AssociatedCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  qid: string;
  cards: Flashcard[];
}

export const AssociatedCardsModal: React.FC<AssociatedCardsModalProps> = ({
  isOpen,
  onClose,
  qid,
  cards,
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

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
                {cards.length} {cards.length === 1 ? 'cartão encontrado' : 'cartões encontrados'} com este identificador único.
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

        {/* List of cards */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {cards.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              Nenhum flashcard associado a esta questão no momento.
            </div>
          ) : (
            cards.map((card, idx) => (
              <div
                key={card.id}
                className="p-4 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 space-y-3 hover:border-emerald-200 dark:hover:border-emerald-900/60 transition-colors"
              >
                <div className="flex items-center justify-between text-xs border-b border-gray-200/60 dark:border-gray-800 pb-2">
                  <span className="font-bold text-gray-500 uppercase tracking-wider">
                    Cartão #{idx + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">
                      Repetições: {card.repetition || 0}
                    </span>
                    <button
                      onClick={() => {
                        onClose();
                        navigate(`/flashcards?tab=browse&search=${encodeURIComponent(qid)}`);
                      }}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <span>Abrir no Navegador</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Front */}
                <div>
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Frente:
                  </div>
                  <div
                    className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-900 dark:text-gray-100 prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: card.front || '<i class="text-gray-400">Sem conteúdo frontal</i>' }}
                  />
                </div>

                {/* Back */}
                <div>
                  <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
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
            ))
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
