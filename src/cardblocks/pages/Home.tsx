import { useState, FormEvent, useRef, ChangeEvent, MouseEvent } from 'react';
import { useStore, Deck, Flashcard } from '../store/useStore';
import { Page } from '../App';
import {
  Plus,
  Trash2,
  Folder,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Upload,
  BookOpen,
  FolderPlus,
  Play,
  Settings2,
  X,
  AlertTriangle,
  Layers,
  Download
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Heatmap } from '../components/Heatmap';
import { useTranslation } from '../lib/i18n';

interface HomeProps {
  onNavigate: (page: Page) => void;
}

export function Home({ onNavigate }: HomeProps) {
  const { decks, cards, createDeck, deleteDeck, moveDeck, importApkgCards } = useStore();
  const [newDeckName, setNewDeckName] = useState('');
  const [expandedDecks, setExpandedDecks] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subdeckTarget, setSubdeckTarget] = useState<Deck | null>(null);
  const [subdeckName, setSubdeckName] = useState('');
  const [deckToDelete, setDeckToDelete] = useState<Deck | null>(null);
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const apkgInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const handleExportAnkiDeck = async (targetDeck: Deck, e: MouseEvent) => {
    e.stopPropagation();
    try {
      const deckCards = cards.filter(c => c.deckId === targetDeck.id);
      setImportNotice(`Gerando pacote Anki para "${targetDeck.name}"...`);
      const { exportToApkg } = await import('../lib/anki');
      await exportToApkg(targetDeck, deckCards);
      setImportNotice(`Baralho "${targetDeck.name}" exportado como Anki (.apkg) com sucesso!`);
    } catch (err: any) {
      console.error(err);
      setImportNotice(`Erro ao exportar Anki: ${err.message}`);
    }
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const ext = file.name.split('.').pop()?.toLowerCase();
      
      let parsedCards: any[] = [];
      let deckNamesByAnkiId: Record<string, string> = {};
      let fileName = file.name.replace(/\.[^/.]+$/, "");

      if (ext === 'apkg') {
        const { importFromApkg } = await import('../lib/anki');
        const res = await importFromApkg(file);
        parsedCards = res.parsedCards;
        fileName = res.fileName;
        const ankiDecks = Object.values(res.decksMap || {});
        for (const d of ankiDecks) {
          deckNamesByAnkiId[d.id] = d.name;
        }
      } else if (ext === 'json') {
        const text = await file.text();
        const data = JSON.parse(text);
        const arr = Array.isArray(data) ? data : (data.cards || []);
        parsedCards = arr.map((c: any) => ({
          front: c.front || c.question || '',
          back: c.back || c.answer || '',
          details: c.details,
          tags: Array.isArray(c.tags) ? c.tags : (c.tags ? c.tags.split(',') : []),
          questionId: c.questionId,
          questionStem: c.questionStem,
          questionChoices: c.questionChoices,
          explanation: c.explanation,
          educationalObjective: c.educationalObjective,
          questionImages: c.questionImages,
          originalDeckId: 'default'
        }));
        deckNamesByAnkiId['default'] = fileName;
      } else if (ext === 'csv') {
        const text = await file.text();
        const rows = text.split('\n');
        parsedCards = rows.map(r => {
          const cols = r.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          return {
            front: cols[0] || '',
            back: cols[1] || '',
            tags: cols[2] ? cols[2].split(' ') : [],
            originalDeckId: 'default'
          };
        }).filter(c => c.front || c.back);
        deckNamesByAnkiId['default'] = fileName;
      } else {
        throw new Error('Formato não suportado. Utilize .apkg, .json ou .csv');
      }
      
      const createdDecksByName: Record<string, string> = {};
      const { createDeck, importApkgCards, decks } = useStore.getState();

      const getOrCreateDeckByPath = (path: string): string => {
        if (createdDecksByName[path]) return createdDecksByName[path];
        
        let currentPath = '';
        let parentId: string | null = null;
        
        const parts = path.split('::');
        for (const part of parts) {
          currentPath = currentPath ? `${currentPath}::${part}` : part;
          
          if (!createdDecksByName[currentPath]) {
            const existing = decks.find(d => d.name === part && d.parentId === parentId);
            if (existing) {
              createdDecksByName[currentPath] = existing.id;
            } else {
              const newId = createDeck(part, parentId);
              createdDecksByName[currentPath] = newId;
            }
          }
          parentId = createdDecksByName[currentPath];
        }
        return createdDecksByName[path];
      };
      
      const defaultDeckId = getOrCreateDeckByPath(fileName || "Baralho Importado");
      const cardsByDeckId: Record<string, Omit<Flashcard, 'id'|'deckId'>[]> = {};
      let importCount = 0;

      for (const c of parsedCards) {
        const dName = deckNamesByAnkiId[c.originalDeckId];
        const targetDeckId = dName ? getOrCreateDeckByPath(dName) : defaultDeckId;
        
        if (!cardsByDeckId[targetDeckId]) {
          cardsByDeckId[targetDeckId] = [];
        }
        cardsByDeckId[targetDeckId].push({
          front: c.front,
          back: c.back,
          details: c.details,
          tags: c.tags,
          repetition: 0,
          interval: 0,
          easeFactor: 2.5,
          nextReviewDate: Date.now(),
          createdAt: Date.now(),
          isSuspended: false,
          isBuried: false,
          questionId: c.questionId,
          questionStem: c.questionStem,
          questionChoices: c.questionChoices,
          explanation: c.explanation,
          educationalObjective: c.educationalObjective,
          questionImages: c.questionImages,
        });
        importCount++;
      }

      for (const [deckId, cards] of Object.entries(cardsByDeckId)) {
        if (cards.length > 0) {
          importApkgCards(deckId, cards as any);
        }
      }
      
      setImportNotice(`Sucesso: ${importCount} flashcards importados com êxito!`);
      setTimeout(() => setImportNotice(null), 5000);
      setShowCreateModal(false);
    } catch (err: any) {
      setImportNotice(`Erro ao importar: ${err.message}`);
    } finally {
      if (apkgInputRef.current) apkgInputRef.current.value = '';
      setImporting(false);
    }
  };
  
  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    createDeck(newDeckName.trim(), null);
    setNewDeckName('');
    setShowCreateModal(false);
  };

  const handleCreateSubdeck = (e: FormEvent) => {
    e.preventDefault();
    if (!subdeckTarget || !subdeckName.trim()) return;
    createDeck(subdeckName.trim(), subdeckTarget.id);
    setExpandedDecks(prev => ({ ...prev, [subdeckTarget.id]: true }));
    setSubdeckName('');
    setSubdeckTarget(null);
  };

  const confirmDeleteDeck = () => {
    if (!deckToDelete) return;
    deleteDeck(deckToDelete.id);
    setDeckToDelete(null);
  };

  const getDueCardsCount = (deckId: string) => {
    const now = Date.now();
    const getSubdecks = (id: string): string[] => {
      const children = decks.filter(d => d.parentId === id).map(d => d.id);
      let all = [...children];
      children.forEach(child => all = [...all, ...getSubdecks(child)]);
      return all;
    };
    const allIds = [deckId, ...getSubdecks(deckId)];
    return cards.filter(c => allIds.includes(c.deckId) && c.nextReviewDate <= now && !c.isSuspended && !c.isBuried).length;
  };

  const getTotalCount = (deckId: string) => {
    const getSubdecks = (id: string): string[] => {
      const children = decks.filter(d => d.parentId === id).map(d => d.id);
      let all = [...children];
      children.forEach(child => all = [...all, ...getSubdecks(child)]);
      return all;
    };
    const allIds = [deckId, ...getSubdecks(deckId)];
    return cards.filter(c => allIds.includes(c.deckId)).length;
  };

  const toggleExpand = (id: string) => {
    setExpandedDecks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderDeckTree = (parentId: string | null = null, depth = 0) => {
    const levelDecks = decks.filter(d => (d.parentId || null) === parentId);
    
    return levelDecks.map(deck => {
      const dueCount = getDueCardsCount(deck.id);
      const totalCount = getTotalCount(deck.id);
      const hasChildren = decks.some(d => d.parentId === deck.id);
      const isExpanded = expandedDecks[deck.id];

      return (
        <div key={deck.id} className="w-full">
          <div 
             className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600/70 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative group shadow-xs hover:shadow-md transition-all duration-200"
             style={{ marginLeft: `${depth * 1.5}rem` }}
             draggable
             onDragStart={(e) => {
               e.dataTransfer.setData('deckId', deck.id);
               e.currentTarget.style.opacity = '0.5';
             }}
             onDragEnd={(e) => {
               e.currentTarget.style.opacity = '1';
             }}
             onDragOver={(e) => {
               e.preventDefault();
               e.dataTransfer.dropEffect = 'move';
             }}
             onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const sourceId = e.dataTransfer.getData('deckId');
                if (sourceId && sourceId !== deck.id) {
                  moveDeck(sourceId, deck.id);
                  setExpandedDecks(prev => ({ ...prev, [deck.id]: true }));
                }
             }}
          >
            <div className="flex items-center gap-3 overflow-hidden min-w-0">
               <div 
                 className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing p-0.5"
                 title="Arraste para organizar em hierarquias"
               >
                 <GripVertical className="w-4 h-4" />
               </div>

               {hasChildren ? (
                 <button 
                   onClick={(e) => { e.stopPropagation(); toggleExpand(deck.id) }} 
                   className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                 >
                   {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                 </button>
               ) : (
                 <div className="w-6 shrink-0" />
               )}

               <button 
                 onClick={(e) => { e.stopPropagation(); onNavigate({ type: 'browse', deckId: deck.id }) }}
                 className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                 title="Abrir no Navegador"
               >
                 <Folder className="w-4 h-4" />
               </button>

               <div className="min-w-0">
                 <h3 
                   onClick={() => onNavigate({ type: 'deck', deckId: deck.id })}
                   className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors" 
                   title={deck.name}
                 >
                   {deck.name}
                 </h3>
                 <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                   {hasChildren ? 'Baralho principal com subdivisões' : 'Baralho padrão'}
                 </span>
               </div>
            </div>
            
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 sm:ml-auto">
               <div className="flex items-center gap-1.5 text-xs mr-1">
                 {dueCount > 0 ? (
                   <span className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 font-bold whitespace-nowrap shadow-2xs">
                     {dueCount} para revisar
                   </span>
                 ) : (
                   <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 font-semibold whitespace-nowrap">
                     Em dia ✓
                   </span>
                 )}
                 <span className="px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 font-medium whitespace-nowrap">
                   {totalCount} cartões
                 </span>
               </div>
               
               <button 
                 onClick={(e) => {
                   e.stopPropagation();
                   setSubdeckTarget(deck);
                   setSubdeckName('');
                 }}
                 className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-xl transition-colors"
                 title="Adicionar Sub-baralho"
               >
                 <FolderPlus className="w-4 h-4" />
               </button>

               <button 
                 onClick={(e) => { e.stopPropagation(); onNavigate({ type: 'deck', deckId: deck.id }) }}
                 className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 border border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200 rounded-xl text-xs transition-colors flex items-center gap-1"
               >
                 <Settings2 className="w-3.5 h-3.5" />
                 <span>Gerenciar</span>
               </button>

               <button 
                 onClick={(e) => handleExportAnkiDeck(deck, e)}
                 className="px-2.5 py-1.5 bg-gray-50 hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-blue-950/40 border border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl text-xs transition-colors flex items-center gap-1"
                 title="Exportar no formato Anki (.apkg)"
               >
                 <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                 <span className="hidden md:inline">Anki</span>
               </button>

               <button 
                 onClick={(e) => { e.stopPropagation(); onNavigate({ type: 'study', deckId: deck.id }) }}
                 disabled={dueCount === 0}
                 className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-sm shadow-blue-500/20 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
               >
                 <Play className="w-3 h-3 fill-current" />
                 <span>Estudar</span>
               </button>
               
               <button 
                 onClick={(e) => {
                   e.stopPropagation();
                   setDeckToDelete(deck);
                 }}
                 className="text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all opacity-80 group-hover:opacity-100"
                 title="Excluir baralho"
               >
                 <Trash2 className="w-4 h-4" />
               </button>
            </div>
          </div>
          
          {hasChildren && isExpanded && (
            <div className="mt-2 space-y-2">
               {renderDeckTree(deck.id, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Import Notification Banner */}
      {importNotice && (
        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200 text-sm flex items-center justify-between shadow-xs">
          <span>{importNotice}</span>
          <button onClick={() => setImportNotice(null)} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Meus Baralhos & Decks
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
            Organize suas cartas de repetição espaçada SM-2. Crie sub-baralhos, arraste para hierarquias ou importe baralhos Anki (.apkg).
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={() => apkgInputRef.current?.click()}
            disabled={importing}
            className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-2xs"
          >
            <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{importing ? "Importando..." : "Importar Anki (.apkg)"}</span>
          </button>

          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm shadow-sm shadow-blue-500/20 flex items-center gap-2 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Novo Baralho</span>
          </button>

          <input 
            type="file" 
            accept=".apkg,.csv,.json" 
            className="hidden" 
            ref={apkgInputRef} 
            onChange={handleImportFile} 
          />
        </div>
      </div>

      {/* Main Deck Hierarchy Tree */}
      {decks.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl text-center py-16 px-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Nenhum baralho encontrado
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
            Comece criando o seu primeiro baralho ou importando seus decks do Anki (.apkg).
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm shadow-sm shadow-blue-500/20 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Primeiro Baralho</span>
          </button>
        </div>
      ) : (
        <div 
          className="flex flex-col gap-2.5 min-h-[50px] pb-4"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
             e.preventDefault();
             const sourceId = e.dataTransfer.getData('deckId');
             if (sourceId) {
               moveDeck(sourceId, null);
             }
          }}
        >
          {renderDeckTree(null, 0)}
        </div>
      )}
      
      {/* Activity Heatmap Component */}
      <Heatmap onNavigate={onNavigate} />

      {/* Create Deck Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Criar Novo Baralho</h3>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-5">
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                    Nome do Baralho
                  </label>
                  <input
                    type="text"
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                    placeholder="Ex: Farmacologia - Antibióticos"
                    autoFocus
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={!newDeckName.trim()}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-sm shadow-blue-500/20 disabled:opacity-50 transition-all"
                  >
                    Criar Baralho
                  </button>
                </div>
              </form>

              <div className="relative">
                 <div className="absolute inset-0 flex items-center">
                   <span className="w-full border-t border-gray-200 dark:border-gray-800"></span>
                 </div>
                 <div className="relative flex justify-center text-xs uppercase font-semibold">
                   <span className="bg-white dark:bg-gray-900 px-3 text-gray-400">Ou importe</span>
                 </div>
              </div>

              <div>
                <button
                  onClick={() => apkgInputRef.current?.click()}
                  disabled={importing}
                  className="w-full bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 px-4 py-3 rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{importing ? "Importando..." : "Importar Arquivo (.apkg, .csv, .json)"}</span>
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                  Suporta baralhos completos do Anki com tags, imagens e estruturas de subdecks.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subdeck Creator Modal */}
      {subdeckTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Criar Sub-baralho</h3>
              </div>
              <button 
                onClick={() => setSubdeckTarget(null)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubdeck} className="p-5 space-y-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Este sub-baralho será inserido dentro de <strong className="text-blue-600 dark:text-blue-400">{subdeckTarget.name}</strong>.
                </p>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Nome do Sub-baralho
                </label>
                <input
                  type="text"
                  value={subdeckName}
                  onChange={(e) => setSubdeckName(e.target.value)}
                  placeholder="Ex: Capítulo 1 - Introdução"
                  autoFocus
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSubdeckTarget(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={!subdeckName.trim()}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-sm shadow-blue-500/20 disabled:opacity-50 transition-all"
                >
                  Adicionar Sub-baralho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deckToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-1">
              Excluir Baralho "{deckToDelete.name}"?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Esta ação removerá este baralho e todas as suas cartas e sub-baralhos associados. Esta operação não pode ser desfeita.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeckToDelete(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteDeck}
                className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-sm shadow-rose-600/20 transition-all"
              >
                Sim, Excluir Baralho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
