import React, { useState, useMemo } from 'react';
import { useStore, Flashcard } from '../store/useStore';
import { Page } from '../App';
import {
  Search,
  Filter,
  Trash2,
  Edit2,
  ArrowLeft,
  Tag as TagIcon,
  Flag,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  Layers,
  ChevronRight,
  Plus
} from 'lucide-react';
import { sanitizeHtml, renderCardText, cn } from '../lib/utils';
import { CardEditor } from '../components/CardEditor';
import { CardCreationModal } from '../components/CardCreationModal';
import { format } from 'date-fns';

export const BrowseView: React.FC<{ onNavigate: (p: Page) => void }> = ({ onNavigate }) => {
  const { decks, cards, deleteCard, bulkDeleteCards, bulkEditCards, updateCard } = useStore();

  const [selectedDeckId, setSelectedDeckId] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedFlag, setSelectedFlag] = useState<string>('all');
  const [filterState, setFilterState] = useState<'all' | 'new' | 'due' | 'suspended'>('all');
  const [search, setSearch] = useState('');

  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    cards.forEach(c => c.tags?.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [cards]);

  // Filter cards
  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      if (selectedDeckId !== 'all' && c.deckId !== selectedDeckId) return false;
      if (selectedTag !== 'all' && !c.tags?.includes(selectedTag)) return false;
      if (selectedFlag !== 'all' && c.flag !== selectedFlag) return false;

      if (filterState === 'new' && c.repetition > 0) return false;
      if (filterState === 'due' && (c.repetition === 0 || c.nextReviewDate > Date.now())) return false;
      if (filterState === 'suspended' && !c.isSuspended) return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const fText = c.front.toLowerCase();
        const bText = c.back.toLowerCase();
        const tText = (c.tags || []).join(' ').toLowerCase();
        const sText = (c.subject || c.subjective || '').toLowerCase();
        const sysText = (c.system || '').toLowerCase();
        const qidText = (c.questionId || '').toLowerCase();
        if (!fText.includes(query) && !bText.includes(query) && !tText.includes(query) && !sText.includes(query) && !sysText.includes(query) && !qidText.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [cards, selectedDeckId, selectedTag, selectedFlag, filterState, search]);

  const activeCard = cards.find(c => c.id === activeCardId) || filteredCards[0] || null;

  const toggleSelectCard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCardIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedCardIds.length === filteredCards.length) {
      setSelectedCardIds([]);
    } else {
      setSelectedCardIds(filteredCards.map(c => c.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedCardIds.length === 0) return;
    if (confirm(`Excluir permanentemente ${selectedCardIds.length} cartões selecionados?`)) {
      bulkDeleteCards(selectedCardIds);
      setSelectedCardIds([]);
      if (activeCardId && selectedCardIds.includes(activeCardId)) {
        setActiveCardId(null);
      }
    }
  };

  const handleBulkSuspend = () => {
    if (selectedCardIds.length === 0) return;
    bulkEditCards(selectedCardIds, { isSuspended: true });
    setSelectedCardIds([]);
  };

  const handleBulkUnsuspend = () => {
    if (selectedCardIds.length === 0) return;
    bulkEditCards(selectedCardIds, { isSuspended: false });
    setSelectedCardIds([]);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-20 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate({ type: 'home' })}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Navegador de Cartões (Browse)
            </h2>
            <p className="text-xs text-gray-500">{filteredCards.length} de {cards.length} cartões encontrados</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedCardIds.length > 0 && (
            <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-300">
              <span>{selectedCardIds.length} selecionados</span>
              <button
                onClick={handleBulkSuspend}
                className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-100 text-xs"
              >
                Suspender
              </button>
              <button
                onClick={handleBulkUnsuspend}
                className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-100 text-xs"
              >
                Ativar
              </button>
              <button
                onClick={handleBulkDelete}
                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                title="Excluir selecionados"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={() => setIsAddCardOpen(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            + Novo Cartão
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl shadow-xs flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por texto, resposta ou tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={selectedDeckId}
          onChange={(e) => setSelectedDeckId(e.target.value)}
          className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 font-semibold"
        >
          <option value="all">Todos os Baralhos</option>
          {decks.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {allTags.length > 0 && (
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 font-semibold"
          >
            <option value="all">Todas as Tags</option>
            {allTags.map(t => (
              <option key={t} value={t}>#{t}</option>
            ))}
          </select>
        )}

        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value as any)}
          className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 font-semibold"
        >
          <option value="all">Todos os Estados</option>
          <option value="new">Novos</option>
          <option value="due">Pendentes (Due)</option>
          <option value="suspended">Suspensos</option>
        </select>
      </div>

      {/* Main Split Layout: Cards List (Left) + Detail Editor (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[500px]">
        {/* Table / List View */}
        <div className="lg:col-span-7 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs font-semibold text-gray-500 bg-gray-50/50 dark:bg-gray-800/30">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-gray-400 hover:text-blue-600 transition-colors"
                title="Selecionar todos os visíveis"
              >
                {selectedCardIds.length > 0 && selectedCardIds.length === filteredCards.length ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
              <span>Frente / Enunciado</span>
            </div>
            <span>Status / Baralho</span>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800 overflow-y-auto max-h-[600px] flex-1">
            {filteredCards.map((card) => {
              const isSelected = selectedCardIds.includes(card.id);
              const isActive = (activeCard?.id === card.id);
              const deckName = decks.find(d => d.id === card.deckId)?.name || 'Geral';

              return (
                <div
                  key={card.id}
                  onClick={() => setActiveCardId(card.id)}
                  className={cn(
                    "p-3.5 flex items-start justify-between gap-3 cursor-pointer transition-colors text-xs",
                    isActive
                      ? "bg-blue-50/60 dark:bg-blue-950/40"
                      : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                  )}
                >
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => toggleSelectCard(card.id, e)}
                      className="mt-0.5 text-gray-400 hover:text-blue-600 transition-colors shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderCardText(card.front, false)) }}
                      />
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {card.tags?.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-md"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="text-[11px] text-gray-500 font-medium">{deckName}</span>
                    {card.isSuspended ? (
                      <span className="text-[10px] bg-amber-50 dark:bg-amber-950/50 text-amber-600 px-1.5 py-0.5 rounded-md font-semibold">
                        Suspenso
                      </span>
                    ) : card.repetition === 0 ? (
                      <span className="text-[10px] bg-blue-50 dark:bg-blue-950/50 text-blue-600 px-1.5 py-0.5 rounded-md font-semibold">
                        Novo
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400">
                        {card.nextReviewDate <= Date.now() ? 'Pendente' : format(card.nextReviewDate, 'dd/MM')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredCards.length === 0 && (
              <div className="p-12 text-center text-gray-400 text-xs">
                Nenhum cartão encontrado com os filtros selecionados.
              </div>
            )}
          </div>
        </div>

        {/* Right Editor Preview Panel */}
        <div className="lg:col-span-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs flex flex-col">
          {activeCard ? (
            <div className="flex-1 flex flex-col space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Detalhes do Cartão
                </span>
                <button
                  onClick={() => {
                    if (confirm("Excluir este cartão permanentemente?")) {
                      deleteCard(activeCard.id);
                      setActiveCardId(null);
                    }
                  }}
                  className="p-1 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                  title="Excluir cartão"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1">
                <CardEditor
                  card={activeCard}
                  onUpdate={(id, f, b, d, tags, flag) => {
                    updateCard(id, { front: f, back: b, details: d, tags, flag });
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-gray-400 text-xs">
              Selecione um cartão para ver e editar detalhes.
            </div>
          )}
        </div>
      </div>

      {isAddCardOpen && (
        <CardCreationModal onClose={() => setIsAddCardOpen(false)} />
      )}
    </div>
  );
};
