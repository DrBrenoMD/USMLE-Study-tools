import React, { useState } from 'react';
import { useStore, Flashcard } from '../store/useStore';
import { Eye, EyeOff, Layers, ExternalLink, Trash2, Zap } from 'lucide-react';
import { IsolatedHtml } from './IsolatedHtml';
import { sanitizeHtml } from '../lib/utils';

interface EmbeddedFlashcardBlockProps {
  cardId: string;
  onRemove?: () => void;
  onNavigateToDeck?: (deckId: string) => void;
}

export const EmbeddedFlashcardBlock: React.FC<EmbeddedFlashcardBlockProps> = ({
  cardId,
  onRemove,
  onNavigateToDeck
}) => {
  const { cards, decks } = useStore();
  const card = cards.find(c => c.id === cardId);
  const deck = card ? decks.find(d => d.id === card.deckId) : null;
  const [isRevealed, setIsRevealed] = useState(false);

  if (!card) {
    return (
      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/80 rounded-xl text-xs text-gray-500 flex items-center justify-between my-2">
        <span>⚡ Flashcard vinculado não encontrado ou excluído (ID: {cardId})</span>
        {onRemove && (
          <button onClick={onRemove} className="text-gray-400 hover:text-rose-500 p-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/40 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-4 my-3 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/40 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
              Flashcard Embutido
            </span>
            {deck && (
              <span className="text-[11px] text-blue-600 dark:text-blue-400 ml-2 font-medium">
                • {deck.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToDeck && deck && (
            <button
              onClick={() => onNavigateToDeck(deck.id)}
              className="text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
            >
              <span>Abrir no Baralho</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}

          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1 text-gray-400 hover:text-rose-500 rounded-lg transition-colors"
              title="Desvincular flashcard da nota"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Frente do Card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-blue-100 dark:border-blue-900/40 shadow-xs">
        <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1.5">
          Frente / Pergunta:
        </div>
        <IsolatedHtml html={card.front} className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed" />
      </div>

      {/* Botão de Revelar / Ocultar Verso */}
      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => setIsRevealed(!isRevealed)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
            isRevealed
              ? 'bg-gray-200 dark:bg-gray-750 text-gray-700 dark:text-gray-200 hover:bg-gray-300'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
          }`}
        >
          {isRevealed ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>Ocultar Verso</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>Revelar Verso da Resposta</span>
            </>
          )}
        </button>
      </div>

      {/* Verso do Card (Revelado) */}
      {isRevealed && (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-emerald-200 dark:border-emerald-900/50 shadow-xs animate-in fade-in zoom-in-95 duration-150">
          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5">
            Verso / Resposta & Explicação:
          </div>
          <IsolatedHtml html={card.back} className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed" />

          {card.details && (
            <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 italic">
              <b>Detalhes extras:</b> {card.details}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
