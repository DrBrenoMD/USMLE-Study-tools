import React, { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useStore, Flashcard } from '../store/useStore';
import { Page } from '../App';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  X,
  Upload,
  Eye,
  EyeOff,
  Download,
  Tag as TagIcon,
  Flag,
  Settings,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Play,
  RotateCcw,
  Image as ImageIcon
} from 'lucide-react';
import { sanitizeHtml, renderCardText } from '../lib/utils';
import { RichEditor } from '../components/RichEditor';
import { IsolatedHtml } from '../components/IsolatedHtml';
import { CardEditor } from '../components/CardEditor';
import Papa from 'papaparse';
import { useTranslation } from '../lib/i18n';

interface DeckViewProps {
  deckId: string;
  onNavigate: (page: Page) => void;
}

export function DeckView({ deckId, onNavigate }: DeckViewProps) {
  const {
    decks,
    cards,
    createCard,
    updateCard,
    deleteCard,
    importCardsCsv,
    exportDeckSet,
    importDeckSet,
    updateDeckSettings,
    settings: globalSettings
  } = useStore();

  const deck = decks.find(d => d.id === deckId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [details, setDetails] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [flag, setFlag] = useState<string>('');
  const [tagInput, setTagInput] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandAll, setExpandAll] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  
  // QBank integration fields (natively collapsed by default)
  const [isQBankFieldsOpen, setIsQBankFieldsOpen] = useState(false);
  const [questionId, setQuestionId] = useState('');
  const [questionStem, setQuestionStem] = useState('');
  const [questionChoices, setQuestionChoices] = useState('');
  const [explanation, setExplanation] = useState('');
  const [educationalObjective, setEducationalObjective] = useState('');
  const [questionImages, setQuestionImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');

  // Export menu & status
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const deckCards = cards.filter(c => c.deckId === deckId).sort((a, b) => b.createdAt - a.createdAt);
  const filteredDeckCards = deckCards.filter(c => 
    c.front.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.back.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.tags || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const dueCardsCount = deckCards.filter(c => c.nextReviewDate <= Date.now() && !c.isSuspended && !c.isBuried).length;

  if (!deck) {
    onNavigate({ type: 'home' });
    return null;
  }

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleUpdateDeckSettings = (key: string, value: any) => {
    updateDeckSettings(deck.id, { [key]: value });
  };

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!front.trim()) return;
    createCard({
      deckId,
      front: front.trim(),
      back: back.trim(),
      details: details.trim(),
      tags,
      flag: flag || undefined,
      questionId: questionId.trim() || undefined,
      questionStem: questionStem.trim() || undefined,
      questionChoices: questionChoices.trim() || undefined,
      explanation: explanation.trim() || undefined,
      educationalObjective: educationalObjective.trim() || undefined,
      questionImages: questionImages.length > 0 ? questionImages : undefined,
    });
    setFront('');
    setBack('');
    setDetails('');
    setTags([]);
    setFlag('');
    setTagInput('');
    setQuestionId('');
    setQuestionStem('');
    setQuestionChoices('');
    setExplanation('');
    setEducationalObjective('');
    setQuestionImages([]);
    setIsQBankFieldsOpen(false);
    showToast('Cartão adicionado com sucesso!');
  };

  const handleExportAnki = async () => {
    try {
      setIsExporting(true);
      showToast('Preparando pacote Anki (.apkg)...');
      const { exportToApkg } = await import('../lib/anki');
      await exportToApkg(deck, deckCards);
      showToast('Baralho Anki (.apkg) exportado com sucesso!');
    } catch (err: any) {
      console.error(err);
      showToast(`Erro ao exportar Anki: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleExportDeck = () => {
    const data = exportDeckSet(deckId);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baralho-${deck.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exportação de backup concluída com sucesso!');
    setShowExportMenu(false);
  };

  const handleUnifiedImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'apkg') {
        showToast('Processando arquivo Anki (.apkg)...');
        const { importFromApkg } = await import('../lib/anki');
        const { decksMap, parsedCards } = await importFromApkg(file);
        
        const cardsByDeckId: Record<string, Omit<Flashcard, 'id'|'deckId'>[]> = {};
        let importCount = 0;

        for (const c of parsedCards) {
          if (!cardsByDeckId[deckId]) cardsByDeckId[deckId] = [];
          cardsByDeckId[deckId].push({
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

        if (cardsByDeckId[deckId]?.length > 0) {
          useStore.getState().importApkgCards(deckId, cardsByDeckId[deckId] as any);
        }
        showToast(`${importCount} cartões importados do Anki com sucesso!`);
      } else if (ext === 'json') {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data && typeof data === 'object' && !Array.isArray(data) && data.decks && data.cards) {
           importDeckSet(text, deckId);
           showToast('Coleção de baralhos importada como sub-baralhos!');
        } else {
           const arr = Array.isArray(data) ? data : (data.cards || []);
           const newCards = arr.map((c: any) => ({
             front: c.front || c.question || '',
             back: c.back || c.answer || ''
           })).filter((c: any) => c.front || c.back);
           if (newCards.length > 0) {
             importCardsCsv(deckId, newCards);
             showToast(`${newCards.length} cartões importados!`);
           }
        }
      } else if (ext === 'csv') {
        Papa.parse(file, {
          complete: (results) => {
            const rows = results.data as string[][];
            const newCards: { front: string, back: string }[] = [];
            
            rows.forEach(row => {
              if (row.length >= 2 && row[0]?.trim() && row[1]?.trim()) {
                newCards.push({ front: row[0].trim(), back: row[1].trim() });
              }
            });
            
            if (newCards.length > 0) {
              importCardsCsv(deckId, newCards);
              showToast(`${newCards.length} cartões importados do CSV!`);
            } else {
              showToast('Nenhum cartão válido encontrado no CSV.', 'error');
            }
          },
          error: (error) => {
            showToast(`Erro ao ler CSV: ${error.message}`, 'error');
          }
        });
      }
    } catch (err: any) {
      showToast(`Erro ao importar: ${err.message}`, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-2xl border text-sm flex items-center justify-between shadow-md transition-all ${
          notification.type === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200'
            : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200'
        }`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header & Breadcrumb */}
      <div>
        <button 
          onClick={() => onNavigate({ type: 'home' })}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Todos os Baralhos</span>
        </button>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {deck.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
              <span className="px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 font-semibold">
                Total: {deckCards.length} cartões
              </span>
              {dueCardsCount > 0 ? (
                <span className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 font-bold">
                  {dueCardsCount} para revisar
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 font-semibold">
                  Tudo em dia ✓
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
             <input 
               type="file" 
               accept=".csv,.json,.apkg" 
               className="hidden" 
               ref={fileInputRef} 
               onChange={handleUnifiedImport} 
             />
             <button
               onClick={() => fileInputRef.current?.click()}
               className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors"
               title="Importar cartões"
             >
               <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
               <span>Importar</span>
             </button>

             <div className="relative">
               <button
                 onClick={() => setShowExportMenu(!showExportMenu)}
                 disabled={isExporting}
                 className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                 title="Exportar baralho"
               >
                 <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                 <span>{isExporting ? 'Exportando...' : 'Exportar'}</span>
                 <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
               </button>

               {showExportMenu && (
                 <div className="absolute right-0 mt-1.5 w-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-30 p-1.5 animate-in fade-in zoom-in-95 duration-100">
                   <button
                     onClick={handleExportAnki}
                     className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 text-gray-800 dark:text-gray-100 flex flex-col gap-0.5 cursor-pointer transition-colors"
                   >
                     <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                       <span>📦 Pacote Anki (.apkg)</span>
                       <span className="text-[10px] bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.2 rounded font-normal">Recomendado</span>
                     </span>
                     <span className="text-[11px] text-gray-500 dark:text-gray-400">
                       Compatível com Anki Desktop, AnkiDroid e AnkiMobile (sem cards únicos).
                     </span>
                   </button>

                   <div className="my-1 border-t border-gray-100 dark:border-gray-700" />

                   <button
                     onClick={handleExportDeck}
                     className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 flex flex-col gap-0.5 cursor-pointer transition-colors"
                   >
                     <span className="font-bold">📄 Arquivo de Backup (.json)</span>
                     <span className="text-[11px] text-gray-500 dark:text-gray-400">
                       Formato completo para backup e importação no app.
                     </span>
                   </button>
                 </div>
               )}
             </div>

             <button 
               onClick={() => setShowSettings(!showSettings)}
               className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors border ${
                 showSettings 
                   ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800' 
                   : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'
               }`}
             >
               <Settings className="w-4 h-4" />
               <span>Opções</span>
             </button>

             <button
               onClick={() => onNavigate({ type: 'study', deckId: deck.id })}
               disabled={dueCardsCount === 0}
               className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm shadow-blue-500/20 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1.5"
             >
               <Play className="w-3.5 h-3.5 fill-current" />
               <span>Estudar Agora</span>
             </button>
          </div>
        </div>
      </div>

      {/* Deck-Specific Settings Drawer */}
      {showSettings && (
        <div className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Configurações deste Baralho</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Estas configurações sobrepõem as opções globais apenas para este baralho.</p>
            </div>
            <button 
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Ordem dos Cartões
              </label>
              <select 
                value={deck?.settings?.cardOrder || globalSettings.cardOrder || 'newFirst'}
                onChange={(e) => handleUpdateDeckSettings('cardOrder', e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newFirst">Novos primeiro</option>
                <option value="reviewsFirst">Revisões primeiro</option>
                <option value="random">Aleatório</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Cartões por Bloco
              </label>
              <input 
                type="number" min="1" max="100"
                value={deck?.settings?.cardsPerBlock || globalSettings.cardsPerBlock}
                onChange={(e) => handleUpdateDeckSettings('cardsPerBlock', Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Intervalo Erro (minutos)
              </label>
              <input 
                type="number" step="1"
                value={deck?.settings?.againMinutes || globalSettings.againMinutes}
                onChange={(e) => handleUpdateDeckSettings('againMinutes', Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Multiplicador Difícil
              </label>
              <input 
                type="number" step="0.1"
                value={deck?.settings?.hardMultiplier || globalSettings.hardMultiplier}
                onChange={(e) => handleUpdateDeckSettings('hardMultiplier', Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Multiplicador Bom
              </label>
              <input 
                type="number" step="0.1"
                value={deck?.settings?.goodMultiplier || globalSettings.goodMultiplier}
                onChange={(e) => handleUpdateDeckSettings('goodMultiplier', Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Multiplicador Fácil
              </label>
              <input 
                type="number" step="0.1"
                value={deck?.settings?.easyMultiplier || globalSettings.easyMultiplier}
                onChange={(e) => handleUpdateDeckSettings('easyMultiplier', Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
               onClick={() => {
                 const newDecks = useStore.getState().decks.map(d => 
                   d.id === deck.id ? { ...d, settings: undefined } : d
                 );
                 useStore.setState({ decks: newDecks });
                 showToast("Configurações redefinidas para os padrões globais.");
               }}
               className="text-xs font-semibold text-gray-500 hover:text-rose-600 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrões Globais</span>
            </button>
          </div>
        </div>
      )}

      {/* Add New Card Section */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Criar Novo Cartão</h3>
          </div>
          <button 
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors"
          >
            {showPreview ? <><EyeOff className="w-3.5 h-3.5" /> Modo Edição</> : <><Eye className="w-3.5 h-3.5" /> Prévia Visual</>}
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Tags and Flag bar */}
          <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-200 dark:border-gray-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <TagIcon className="w-4 h-4 text-gray-400" />
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 text-xs font-semibold">
                  {tag}
                  <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-rose-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input 
                type="text" 
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    e.preventDefault();
                    const newTag = tagInput.trim().toLowerCase();
                    if (!tags.includes(newTag)) setTags([...tags, newTag]);
                    setTagInput('');
                  }
                }}
                placeholder="Adicionar tag (pressione Enter)..." 
                className="bg-transparent border-none text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-0 min-w-[140px]"
              />
            </div>

            <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-gray-700 pt-2 sm:pt-0 sm:pl-3">
              <Flag className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">Bandeira:</span>
              <div className="flex gap-1.5">
                {[
                  { value: '', label: 'Nenhuma', color: 'bg-gray-300 dark:bg-gray-600' },
                  { value: 'red', label: 'Vermelha', color: 'bg-red-500' },
                  { value: 'orange', label: 'Laranja', color: 'bg-orange-500' },
                  { value: 'green', label: 'Verde', color: 'bg-emerald-500' },
                  { value: 'blue', label: 'Azul', color: 'bg-blue-500' },
                  { value: 'purple', label: 'Roxa', color: 'bg-purple-500' },
                ].map(f => (
                  <button
                    key={f.value || 'none'}
                    type="button"
                    onClick={() => setFlag(f.value)}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${f.color} ${(flag || '') === f.value ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    title={f.label}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Frente (Pergunta ou Prompt)
              </label>
              {showPreview ? (
                 <div 
                   className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl min-h-[100px] text-gray-900 dark:text-gray-100"
                   dangerouslySetInnerHTML={{ __html: renderCardText(front) || '<span class="text-gray-400 italic">Vazio</span>' }}
                 />
              ) : (
                <RichEditor 
                  value={front} 
                  onChange={setFront} 
                  placeholder="Escreva a pergunta, cloze {{c1::palavra}} ou conteúdo frontal..."
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { if (front.trim()) handleCreate(e as any); } }}
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Verso (Resposta)
              </label>
              {showPreview ? (
                 <div 
                   className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl min-h-[100px] text-gray-900 dark:text-gray-100"
                   dangerouslySetInnerHTML={{ __html: renderCardText(back) || '<span class="text-gray-400 italic">Vazio</span>' }}
                 />
              ) : (
                <RichEditor 
                  value={back} 
                  onChange={setBack} 
                  placeholder="Conteúdo exibido ao revelar a resposta..."
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { if (front.trim()) handleCreate(e as any); } }}
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Detalhes ou Explicação Complementar (Opcional)
              </label>
              {showPreview ? (
                 <div 
                   className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl min-h-[80px] text-gray-900 dark:text-gray-100"
                   dangerouslySetInnerHTML={{ __html: renderCardText(details) || '<span class="text-gray-400 italic">Sem detalhes adicionais</span>' }}
                 />
              ) : (
                <RichEditor 
                  value={details} 
                  onChange={setDetails} 
                  placeholder="Explicação fisiopatológica, mnemônicos ou notas extras..."
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { if (front.trim()) handleCreate(e as any); } }}
                />
              )}
            </div>

            {/* QBank Integration Collapsible Section (natively collapsed by default) */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50/70 dark:bg-gray-800/40">
              <button
                type="button"
                onClick={() => setIsQBankFieldsOpen(!isQBankFieldsOpen)}
                className="w-full px-4 py-2.5 text-left font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between transition-colors cursor-pointer bg-gray-100/60 dark:bg-gray-800/80"
              >
                <span className="flex items-center gap-2">
                  <span>📋 Dados da Questão / Integração QBank (Opcional)</span>
                  {questionId && (
                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 text-[11px] font-mono normal-case">
                      ID: {questionId}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <span>{isQBankFieldsOpen ? 'Ocultar' : 'Expandir'}</span>
                  {isQBankFieldsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              {isQBankFieldsOpen && (
                <div className="p-4 space-y-3.5 border-t border-gray-200 dark:border-gray-700 text-sm animate-in fade-in">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Estes campos salvam metadados da questão (Question Id, Enunciado, Alternativas, Explicação, Educational Objective e Imagens) para integração com QBanks e extensão do navegador.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Question Id
                      </label>
                      <input
                        type="text"
                        value={questionId}
                        onChange={e => setQuestionId(e.target.value)}
                        placeholder="Ex: UW-1234, AMBOSS-5678"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs font-mono text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Educational Objective
                      </label>
                      <input
                        type="text"
                        value={educationalObjective}
                        onChange={e => setEducationalObjective(e.target.value)}
                        placeholder="Take-home message ou objetivo educacional..."
                        className="w-full bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/20 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Enunciado (Stem)
                    </label>
                    <textarea
                      rows={2}
                      value={questionStem}
                      onChange={e => setQuestionStem(e.target.value)}
                      placeholder="Texto do caso clínico / enunciado da questão..."
                      className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Alternativas
                    </label>
                    <textarea
                      rows={2}
                      value={questionChoices}
                      onChange={e => setQuestionChoices(e.target.value)}
                      placeholder="A) ...&#10;B) ...&#10;C) ..."
                      className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Explicação
                    </label>
                    <textarea
                      rows={2}
                      value={explanation}
                      onChange={e => setExplanation(e.target.value)}
                      placeholder="Explicação da resposta correta e distratores..."
                      className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Imagens da Questão
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newImageUrl}
                        onChange={e => setNewImageUrl(e.target.value)}
                        placeholder="Link da imagem (https://...)"
                        className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newImageUrl.trim()) {
                              setQuestionImages(prev => [...prev, newImageUrl.trim()]);
                              setNewImageUrl('');
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newImageUrl.trim()) {
                            setQuestionImages(prev => [...prev, newImageUrl.trim()]);
                            setNewImageUrl('');
                          }
                        }}
                        className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        Adicionar
                      </button>
                    </div>

                    {questionImages.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
                        {questionImages.map((img, idx) => (
                          <div key={idx} className="relative group border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden w-16 h-16 bg-gray-100 dark:bg-gray-800">
                            <img src={img} alt={`Anexo ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setQuestionImages(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-0.5 right-0.5 p-1 bg-rose-600 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-gray-400 hidden sm:inline">
              Dica: Pressione Ctrl+Enter para adicionar rapidamente.
            </span>
            <button 
              type="submit"
              disabled={!front.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-sm shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2 transition-all ml-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Cartão</span>
            </button>
          </div>
        </form>
      </div>

      {/* Cards List Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
            Cartões do Baralho ({filteredDeckCards.length})
          </h3>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar por termos ou tags..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
              />
            </div>
            <button 
              onClick={() => setExpandAll(!expandAll)}
              className="px-3.5 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors"
            >
              {expandAll ? 'Recolher Tudo' : 'Expandir Tudo'}
            </button>
          </div>
        </div>
        
        {deckCards.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Este baralho ainda não possui cartões.</p>
          </div>
        ) : filteredDeckCards.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum cartão corresponde à sua pesquisa.</p>
          </div>
        ) : (
          <Virtuoso
            useWindowScroll
            data={filteredDeckCards}
            itemContent={(_, card) => (
              <div className="mb-3">
                <CardRow 
                  key={card.id} 
                  card={card} 
                  onUpdate={(id, f, b, d, t, flag) => updateCard(id, f, b, d, t, flag)}
                  onDeleteRequest={(id) => setCardToDelete(id)}
                  expandAll={expandAll}
                />
              </div>
            )}
          />
        )}
      </div>

      {/* Delete Card Confirmation Modal */}
      {cardToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-1">
              Excluir este cartão?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Esta ação removerá permanentemente o flashcard do seu baralho.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setCardToDelete(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deleteCard(cardToDelete);
                  setCardToDelete(null);
                  showToast('Cartão excluído com sucesso.');
                }}
                className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CardRow: React.FC<{ 
  card: Flashcard, 
  onUpdate: (id: string, f: string, b: string, details?: string, tags?: string[], flag?: string) => void,
  onDeleteRequest: (id: string) => void,
  expandAll?: boolean
}> = ({ card, onUpdate, onDeleteRequest, expandAll = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isExpanded = expandAll || expanded;

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-gray-900 border-2 border-blue-400 dark:border-blue-600 p-5 rounded-2xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm font-bold text-blue-600 dark:text-blue-400">Editando Cartão</div>
        </div>
        <CardEditor 
          card={card} 
          onUpdate={(id, f, b, d, tags, flag) => {
            onUpdate(id, f, b, d, tags, flag);
          }} 
        />
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
          <button 
            onClick={() => setIsEditing(false)}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-semibold text-xs shadow-sm shadow-blue-500/20"
          >
            Concluir Edição
          </button>
        </div>
      </div>
    );
  }

  const now = Date.now();
  const isDue = card.nextReviewDate <= now;

  const FLAG_COLORS: Record<string, string> = {
    'red': 'bg-red-500',
    'orange': 'bg-orange-500',
    'green': 'bg-emerald-500',
    'blue': 'bg-blue-500',
    'purple': 'bg-purple-500',
  };

  return (
    <div 
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600 p-4 rounded-2xl flex flex-col sm:flex-row gap-4 cursor-pointer transition-all shadow-xs hover:shadow-md"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex-1 relative min-w-0">
        {card.flag && FLAG_COLORS[card.flag] && (
           <div className={`absolute top-0 right-0 w-3 h-3 rounded-full shadow-xs z-10 ${FLAG_COLORS[card.flag]}`} />
        )}
        {card.questionId && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
              QBank ID: {card.questionId}
            </span>
          </div>
        )}
        <IsolatedHtml 
          className={`w-full max-w-none text-gray-900 dark:text-gray-100 break-words ${!isExpanded ? 'line-clamp-2' : ''}`}
          layout="grid"
          frontHtml={sanitizeHtml(card.front)}
          showBack={true}
          backHtml={sanitizeHtml(card.back)}
          detailsHtml={isExpanded && card.details ? sanitizeHtml(card.details) : undefined}
        />
        {card.tags && card.tags.length > 0 && isExpanded && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            {card.tags.map(t => (
              <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
                {t}
              </span>
            ))}
          </div>
        )}
        {isExpanded && (card.questionId || card.questionStem || card.questionChoices || card.explanation || card.educationalObjective || (card.questionImages && card.questionImages.length > 0)) && (
          <details className="mt-3 border border-gray-200 dark:border-gray-700/80 rounded-xl p-3 bg-gray-50/60 dark:bg-gray-800/40 text-xs text-gray-800 dark:text-gray-200" onClick={e => e.stopPropagation()}>
            <summary className="font-bold text-blue-600 dark:text-blue-400 cursor-pointer select-none">
              📋 Dados da Questão {card.questionId ? `(ID: ${card.questionId})` : ''}
            </summary>
            <div className="mt-3 space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              {card.questionStem && (
                <div>
                  <span className="font-bold text-gray-900 dark:text-gray-100">Enunciado:</span>
                  <p className="mt-0.5 text-gray-600 dark:text-gray-300">{card.questionStem}</p>
                </div>
              )}
              {card.questionChoices && (
                <div>
                  <span className="font-bold text-gray-900 dark:text-gray-100">Alternativas:</span>
                  <div className="mt-0.5 font-mono text-[11px] whitespace-pre-wrap text-gray-600 dark:text-gray-300">{card.questionChoices}</div>
                </div>
              )}
              {card.explanation && (
                <div>
                  <span className="font-bold text-gray-900 dark:text-gray-100">Explicação:</span>
                  <p className="mt-0.5 text-gray-600 dark:text-gray-300">{card.explanation}</p>
                </div>
              )}
              {card.educationalObjective && (
                <div className="p-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-lg">
                  <span className="font-bold text-blue-700 dark:text-blue-300">Educational Objective:</span>
                  <p className="mt-0.5 text-blue-900 dark:text-blue-200 font-medium">{card.educationalObjective}</p>
                </div>
              )}
              {card.questionImages && card.questionImages.length > 0 && (
                <div>
                  <span className="font-bold text-gray-900 dark:text-gray-100">Imagens ({card.questionImages.length}):</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {card.questionImages.map((img, i) => (
                      <img key={i} src={img} alt={`Questão ${i + 1}`} className="max-h-24 rounded border border-gray-200 dark:border-gray-700" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        )}
      </div>

      <div className="flex items-center sm:items-end justify-between sm:flex-col gap-2 shrink-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsEditing(true)}
            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-xl transition-colors"
            title="Editar cartão"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onDeleteRequest(card.id)}
            className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
            title="Excluir cartão"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="text-right sm:text-center mt-auto">
          {isDue ? (
             <span className="inline-flex items-center px-2 py-0.5 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
               Para Revisar
             </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-xl text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700" title={new Date(card.nextReviewDate).toLocaleString()}>
               Agendado
             </span>
          )}
        </div>
      </div>
    </div>
  );
};
