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
  Plus,
  BookOpen,
  FolderTree,
  RotateCcw
} from 'lucide-react';
import { sanitizeHtml, renderCardText, cn } from '../lib/utils';
import { CardEditor } from '../components/CardEditor';
import { CardCreationModal } from '../components/CardCreationModal';
import { format } from 'date-fns';
import { extractCardQids } from '../../utils/qbankCardMatcher';

// Helpers para identificação de categorias de tags
const isIdTag = (t: string) => {
  const lower = t.trim().toLowerCase();
  return (
    lower.startsWith('qid:') ||
    lower.startsWith('qid-') ||
    lower.startsWith('id:') ||
    lower.startsWith('id-') ||
    /^(?:qid|id)[:\-_]?[0-9]+/i.test(lower) ||
    /^[0-9]{3,}$/.test(lower)
  );
};

const isSubjectTag = (t: string) => {
  const lower = t.trim().toLowerCase();
  return lower.startsWith('subject:') || lower.startsWith('subject-');
};

const isSystemTag = (t: string) => {
  const lower = t.trim().toLowerCase();
  return lower.startsWith('system:') || lower.startsWith('system-');
};

const formatTagName = (val: string) => {
  if (!val) return '';
  if (val.includes(' ') || /[A-Z]/.test(val)) return val;
  return val
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const getCardSubject = (c: Flashcard): { key: string; label: string } | null => {
  if (c.subject && c.subject.trim()) {
    return { key: c.subject.trim().toLowerCase(), label: c.subject.trim() };
  }
  if (c.subjective && c.subjective.trim()) {
    return { key: c.subjective.trim().toLowerCase(), label: c.subjective.trim() };
  }
  const tag = c.tags?.find(isSubjectTag);
  if (tag) {
    const raw = tag.replace(/^subject[:\-_]/i, '').trim();
    if (raw) return { key: raw.toLowerCase(), label: formatTagName(raw) };
  }
  return null;
};

const getCardSystem = (c: Flashcard): { key: string; label: string } | null => {
  if (c.system && c.system.trim()) {
    return { key: c.system.trim().toLowerCase(), label: c.system.trim() };
  }
  const tag = c.tags?.find(isSystemTag);
  if (tag) {
    const raw = tag.replace(/^system[:\-_]/i, '').trim();
    if (raw) return { key: raw.toLowerCase(), label: formatTagName(raw) };
  }
  return null;
};

export const BrowseView: React.FC<{ onNavigate: (p: Page) => void }> = ({ onNavigate }) => {
  const { decks, cards, deleteCard, bulkDeleteCards, bulkEditCards, updateCard } = useStore();

  const [selectedDeckId, setSelectedDeckId] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedSystem, setSelectedSystem] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedFlag, setSelectedFlag] = useState<string>('all');
  const [filterState, setFilterState] = useState<'all' | 'new' | 'due' | 'suspended'>('all');
  const [search, setSearch] = useState('');

  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);

  // Extrai tags gerais puras para o dropdown de tags (removendo tags com # do AnKing, IDs, subject e system para evitar poluição visual)
  const allGeneralTags = useMemo(() => {
    const set = new Set<string>();
    cards.forEach(c => {
      c.tags?.forEach(t => {
        const clean = t.trim();
        if (
          clean &&
          !clean.startsWith('#') &&
          !clean.startsWith('!') &&
          !isIdTag(clean) &&
          !isSubjectTag(clean) &&
          !isSystemTag(clean)
        ) {
          set.add(clean);
        }
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cards]);

  // Mapeamento hierárquico Subject -> Systems (as tags System são filhas das tags Subject)
  const { subjectList, systemsBySubject, allSystemsList } = useMemo(() => {
    const subjectsMap = new Map<string, { label: string; systems: Map<string, string>; count: number }>();
    const allSysMap = new Map<string, { label: string; count: number }>();

    cards.forEach(c => {
      const sub = getCardSubject(c);
      const sys = getCardSystem(c);

      if (sys) {
        const existing = allSysMap.get(sys.key);
        if (existing) {
          existing.count += 1;
        } else {
          allSysMap.set(sys.key, { label: sys.label, count: 1 });
        }
      }

      if (sub) {
        if (!subjectsMap.has(sub.key)) {
          subjectsMap.set(sub.key, { label: sub.label, systems: new Map(), count: 0 });
        }
        const subData = subjectsMap.get(sub.key)!;
        subData.count += 1;

        if (sys) {
          subData.systems.set(sys.key, sys.label);
        }
      }
    });

    const subjectList = Array.from(subjectsMap.entries()).map(([key, data]) => ({
      key,
      label: data.label,
      count: data.count,
      systemsCount: data.systems.size
    })).sort((a, b) => a.label.localeCompare(b.label));

    const systemsBySubject: Record<string, { key: string; label: string }[]> = {};
    subjectsMap.forEach((data, subKey) => {
      systemsBySubject[subKey] = Array.from(data.systems.entries()).map(([k, l]) => ({
        key: k,
        label: l
      })).sort((a, b) => a.label.localeCompare(b.label));
    });

    const allSystemsList = Array.from(allSysMap.entries()).map(([key, data]) => ({
      key,
      label: data.label,
      count: data.count
    })).sort((a, b) => a.label.localeCompare(b.label));

    return { subjectList, systemsBySubject, allSystemsList };
  }, [cards]);

  // Gerencia a mudança de Subject resetando ou preservando o System de acordo com a hierarquia
  const handleSubjectChange = (newSubjectKey: string) => {
    setSelectedSubject(newSubjectKey);
    if (newSubjectKey === 'all') {
      setSelectedSystem('all');
    } else {
      const available = systemsBySubject[newSubjectKey] || [];
      const stillValid = available.some(s => s.key === selectedSystem);
      if (!stillValid) {
        setSelectedSystem('all');
      }
    }
  };

  // Systems disponíveis para o Subject atualmente selecionado (Hierarquia Subject -> System)
  const availableSystems = useMemo(() => {
    if (selectedSubject === 'all') {
      return allSystemsList;
    }
    return systemsBySubject[selectedSubject] || [];
  }, [selectedSubject, allSystemsList, systemsBySubject]);

  const selectedSubjectObj = useMemo(() => {
    return subjectList.find(s => s.key === selectedSubject);
  }, [subjectList, selectedSubject]);

  // Filter cards
  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      if (selectedDeckId !== 'all' && c.deckId !== selectedDeckId) return false;
      if (selectedFlag !== 'all' && c.flag !== selectedFlag) return false;

      if (filterState === 'new' && c.repetition > 0) return false;
      if (filterState === 'due' && (c.repetition === 0 || c.nextReviewDate > Date.now())) return false;
      if (filterState === 'suspended' && !c.isSuspended) return false;

      // Filtro por Subject
      if (selectedSubject !== 'all') {
        const sub = getCardSubject(c);
        if (!sub || sub.key !== selectedSubject) return false;
      }

      // Filtro por System (filho de Subject)
      if (selectedSystem !== 'all') {
        const sys = getCardSystem(c);
        if (!sys || sys.key !== selectedSystem) return false;
      }

      // Filtro por Tags Gerais (sem tags de ID, subject ou system)
      if (selectedTag !== 'all' && !c.tags?.includes(selectedTag)) return false;

      // Barra de Pesquisa (IDs, Decks, Tags e Campos podem ser pesquisados diretamente aqui!)
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const cleanQueryId = query.replace(/^#|^qid:|^qid-|^id:|^id-/i, '').trim();

        const deckObj = decks.find(d => d.id === c.deckId);
        const deckNameText = (deckObj?.name || '').toLowerCase();
        const fText = (c.front || '').toLowerCase();
        const bText = (c.back || '').toLowerCase();
        const tText = (c.tags || []).join(' ').toLowerCase();
        const sText = (c.subject || c.subjective || '').toLowerCase();
        const sysText = (c.system || '').toLowerCase();
        const qidText = (c.questionId || '').toLowerCase();
        const stemText = (c.questionStem || '').toLowerCase();
        const choicesText = (c.questionChoices || '').toLowerCase();
        const expText = (c.explanation || '').toLowerCase();
        const objText = (c.educationalObjective || '').toLowerCase();
        const fieldsText = (c.fields || []).map(f => `${f.name} ${f.value}`).join(' ').toLowerCase();

        const matches =
          deckNameText.includes(query) ||
          fText.includes(query) ||
          bText.includes(query) ||
          tText.includes(query) ||
          sText.includes(query) ||
          sysText.includes(query) ||
          qidText.includes(query) ||
          (cleanQueryId && qidText.includes(cleanQueryId)) ||
          stemText.includes(query) ||
          choicesText.includes(query) ||
          expText.includes(query) ||
          objText.includes(query) ||
          fieldsText.includes(query);

        if (!matches) {
          return false;
        }
      }

      return true;
    });
  }, [cards, selectedDeckId, selectedSubject, selectedSystem, selectedTag, selectedFlag, filterState, search]);

  const hasActiveFilters = selectedDeckId !== 'all' || selectedSubject !== 'all' || selectedSystem !== 'all' || selectedTag !== 'all' || selectedFlag !== 'all' || filterState !== 'all' || search.trim() !== '';

  const handleResetFilters = () => {
    setSelectedDeckId('all');
    setSelectedSubject('all');
    setSelectedSystem('all');
    setSelectedTag('all');
    setSelectedFlag('all');
    setFilterState('all');
    setSearch('');
  };

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
        {/* Barra de Pesquisa Geral com suporte para Q-ID */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por texto, Q-ID (#4262), resposta ou tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filtro Baralho */}
        <select
          value={selectedDeckId}
          onChange={(e) => setSelectedDeckId(e.target.value)}
          className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 font-semibold"
          title="Filtrar por Baralho"
        >
          <option value="all">Todos os Baralhos</option>
          {decks.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {/* Filtro Dedicado de Subject */}
        {subjectList.length > 0 && (
          <div className="relative">
            <select
              value={selectedSubject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className={cn(
                "px-3 py-1.5 border rounded-xl text-xs font-semibold transition-colors",
                selectedSubject !== 'all'
                  ? "bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                  : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200"
              )}
              title="Filtrar por Subject (Matéria)"
            >
              <option value="all">Todos os Subjects ({subjectList.length})</option>
              {subjectList.map(s => (
                <option key={s.key} value={s.key}>
                  📚 {s.label} ({s.count})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filtro Dedicado de System (Filho de Subject) */}
        {(allSystemsList.length > 0 || availableSystems.length > 0) && (
          <div className="relative">
            <select
              value={selectedSystem}
              onChange={(e) => setSelectedSystem(e.target.value)}
              className={cn(
                "px-3 py-1.5 border rounded-xl text-xs font-semibold transition-colors",
                selectedSystem !== 'all'
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                  : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200"
              )}
              title={
                selectedSubject !== 'all'
                  ? `Sistemas de ${selectedSubjectObj?.label || 'Subject'}`
                  : "Filtrar por System (Sistema)"
              }
            >
              <option value="all">
                {selectedSubject !== 'all'
                  ? `Todos os Systems de ${selectedSubjectObj?.label} (${availableSystems.length})`
                  : `Todos os Systems (${availableSystems.length})`}
              </option>
              {availableSystems.map(sys => (
                <option key={sys.key} value={sys.key}>
                  🩺 {sys.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filtro de Tags Gerais (IDs, Subject e System foram removidos para despoluir) */}
        {allGeneralTags.length > 0 && (
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className={cn(
              "px-3 py-1.5 border rounded-xl text-xs font-semibold transition-colors",
              selectedTag !== 'all'
                ? "bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200"
            )}
            title="Filtrar por Tags Gerais"
          >
            <option value="all">Todas as Tags ({allGeneralTags.length})</option>
            {allGeneralTags.map(t => (
              <option key={t} value={t}>#{t}</option>
            ))}
          </select>
        )}

        {/* Filtro de Estado do Cartão */}
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

        {/* Botão para Limpar Filtros */}
        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-600 dark:hover:text-red-400 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl font-medium flex items-center gap-1 transition-colors"
            title="Limpar todos os filtros"
          >
            <RotateCcw className="w-3 h-3" />
            Limpar
          </button>
        )}
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
              const cardSub = getCardSubject(card);
              const cardSys = getCardSystem(card);
              const cardGeneralTags = (card.tags || []).filter(t => !isIdTag(t) && !isSubjectTag(t) && !isSystemTag(t));

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
                        {extractCardQids(card, deckName).map(qid => (
                          <span
                            key={qid}
                            className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/40"
                          >
                            QID: {qid}
                          </span>
                        ))}
                        {cardSub && (
                          <span className="text-[10px] bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 font-semibold px-1.5 py-0.5 rounded-md border border-purple-200 dark:border-purple-900/40">
                            📚 {cardSub.label}
                          </span>
                        )}
                        {cardSys && (
                          <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 font-semibold px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/40">
                            🩺 {cardSys.label}
                          </span>
                        )}
                        {cardGeneralTags.slice(0, 3).map(tag => (
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
