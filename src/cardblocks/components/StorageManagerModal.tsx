import React, { useState, useEffect } from 'react';
import { 
  HardDrive, 
  Folder, 
  FolderCheck, 
  FolderPlus, 
  Database, 
  Cloud, 
  CloudOff, 
  Trash2, 
  Download, 
  Info, 
  CheckCircle2, 
  X, 
  RefreshCw,
  Layers,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { mediaStorage } from '../lib/mediaStorage';

interface StorageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StorageManagerModal: React.FC<StorageManagerModalProps> = ({ isOpen, onClose }) => {
  const { decks, cards, toggleDeckOffline, setDeckOffline } = useStore();

  const [dirInfo, setDirInfo] = useState<{ isConnected: boolean; name: string | null }>({ isConnected: false, name: null });
  const [storageEstimate, setStorageEstimate] = useState<{
    mediaCount: number;
    estimatedBytes: number;
    quotaBytes?: number;
    usageBytes?: number;
  }>({ mediaCount: 0, estimatedBytes: 0 });
  const [loadingDir, setLoadingDir] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const refreshInfo = async () => {
    setDirInfo(mediaStorage.getCustomDirectoryInfo());
    const est = await mediaStorage.getStorageUsage();
    setStorageEstimate(est);
  };

  useEffect(() => {
    if (isOpen) {
      refreshInfo();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalCards = cards.length;
  const offlineDecks = decks.filter(d => d.isOffline);
  const offlineDeckIds = new Set(offlineDecks.map(d => d.id));
  const offlineCards = cards.filter(c => offlineDeckIds.has(c.deckId));
  const onlineCards = totalCards - offlineCards.length;

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const handleSelectFolder = async () => {
    try {
      setLoadingDir(true);
      const res = await mediaStorage.selectCustomDirectory();
      if (res.success && res.name) {
        setStatusNotice({
          text: `Pasta "${res.name}" conectada com sucesso! O aplicativo lerá imagens e mídias diretamente dela.`,
          type: 'success'
        });
      } else if (res.error) {
        setStatusNotice({ text: res.error, type: 'error' });
      }
      refreshInfo();
    } catch (err: any) {
      setStatusNotice({ text: `Erro: ${err.message}`, type: 'error' });
    } finally {
      setLoadingDir(false);
    }
  };

  const handleDisconnectFolder = async () => {
    await mediaStorage.disconnectCustomDirectory();
    setStatusNotice({ text: 'Pasta personalizada desconectada.', type: 'info' });
    refreshInfo();
  };

  const handleClearCache = async () => {
    if (window.confirm('Tem certeza que deseja limpar o cache de mídias do IndexedDB? Os cards continuarão intactos.')) {
      await mediaStorage.clearMediaStorage();
      setStatusNotice({ text: 'Cache de mídia limpo com sucesso.', type: 'success' });
      refreshInfo();
    }
  };

  const handleExportBackup = () => {
    const state = useStore.getState();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cardblocks_all_offline_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setStatusNotice({ text: 'Backup exportado com sucesso.', type: 'success' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Armazenamento & Pastas Offline
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Gerencie baralhos offline, arquivos de mídia e pastas personalizadas no computador
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-gray-700 dark:text-gray-300">

          {statusNotice && (
            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-medium animate-fade-in ${
              statusNotice.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-300' :
              statusNotice.type === 'error' ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-800 dark:text-rose-300' :
              'bg-blue-50 dark:bg-blue-950/40 border-blue-300 text-blue-800 dark:text-blue-300'
            }`}>
              <span>{statusNotice.text}</span>
              <button onClick={() => setStatusNotice(null)} className="ml-2 font-bold opacity-70 hover:opacity-100">✕</button>
            </div>
          )}

          {/* Onde os arquivos ficam salvos */}
          <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold text-sm">
              <Info className="w-4 h-4" />
              Onde meus arquivos e decks offline ficam salvos?
            </div>
            <ul className="text-xs text-blue-900/80 dark:text-blue-200/80 space-y-1.5 list-disc pl-5">
              <li>
                <b>Flashcards, Tags e Dados:</b> Armazenados no <b>IndexedDB permanente do navegador</b> (<code className="font-mono bg-blue-100/70 dark:bg-blue-900/60 px-1 py-0.5 rounded">cardblocks_data</code>). Possui capacidade de até centenas de GBs no seu disco.
              </li>
              <li>
                <b>Decks Grandes (8GB+) & Offline:</b> Ficam mantidos no armazenamento local e <b>não sobrecarregam a nuvem</b>. Seus cards são sumarizados para a extensão sugerir em tempo real nas questões.
              </li>
              <li>
                <b>Pasta Personalizada no Computador:</b> Você pode vincular a pasta original do Anki (<code className="font-mono bg-blue-100/70 dark:bg-blue-900/60 px-1 py-0.5 rounded">collection.media</code>) para que as imagens sejam lidas direto do disco sem duplicar gigabytes!
              </li>
            </ul>
          </div>

          {/* Pasta Personalizável no Navegador (File System Access API) */}
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-800/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Folder className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Pasta Local de Mídia no Computador
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Conecte sua pasta <span className="font-mono text-xs font-semibold">collection.media</span> para carregar imagens instantaneamente direto do disco.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {dirInfo.isConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Conectada: {dirInfo.name}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    Não vinculada
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleSelectFolder}
                disabled={loadingDir}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <FolderPlus className="w-4 h-4" />
                {dirInfo.isConnected ? 'Alterar Pasta Selecionada' : 'Selecionar Pasta de Mídia (Ex: collection.media)'}
              </button>

              {dirInfo.isConnected && (
                <button
                  onClick={handleDisconnectFolder}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Desconectar Pasta
                </button>
              )}
            </div>
          </div>

          {/* Visão Geral do Armazenamento */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 flex flex-col">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Total de Cards</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white mt-1">{totalCards.toLocaleString()}</span>
              <span className="text-[10px] text-gray-400 mt-0.5">{onlineCards} na nuvem • {offlineCards.length} offline</span>
            </div>

            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 flex flex-col">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Decks Offline</span>
              <span className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">{offlineDecks.length}</span>
              <span className="text-[10px] text-gray-400 mt-0.5">{decks.length - offlineDecks.length} sincronizados</span>
            </div>

            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 flex flex-col">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Mídias em Cache</span>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">{storageEstimate.mediaCount}</span>
              <span className="text-[10px] text-gray-400 mt-0.5">no IndexedDB</span>
            </div>

            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 flex flex-col">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Uso no Disco</span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatBytes(storageEstimate.estimatedBytes)}</span>
              <span className="text-[10px] text-gray-400 mt-0.5">estimativa local</span>
            </div>
          </div>

          {/* Gerenciamento de Baralhos (Alternar Offline / Nuvem) */}
          <div className="space-y-3">
            <h4 className="font-bold text-gray-900 dark:text-white flex items-center justify-between">
              <span>Baralhos & Modo de Sincronização</span>
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">Clique para alternar</span>
            </h4>

            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800/80 max-h-52 overflow-y-auto">
              {decks.map(deck => {
                const deckCardCount = cards.filter(c => c.deckId === deck.id).length;
                return (
                  <div key={deck.id} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Layers className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm">
                          {deck.name}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {deckCardCount} cards {deck.isOffline ? '• Salvo localmente' : '• Sincronizado na nuvem'}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleDeckOffline(deck.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        deck.isOffline
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      }`}
                      title={deck.isOffline ? "Mudar para sincronizado na nuvem" : "Mudar para apenas offline"}
                    >
                      {deck.isOffline ? (
                        <>
                          <CloudOff className="w-3.5 h-3.5" />
                          <span>Apenas Offline</span>
                        </>
                      ) : (
                        <>
                          <Cloud className="w-3.5 h-3.5" />
                          <span>Sincronizado na Nuvem</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ações Rápidas de Manutenção */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleExportBackup}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4 text-gray-500" />
              Exportar Backup Completo (.JSON)
            </button>

            <button
              onClick={handleClearCache}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Limpar Cache de Mídias
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs cursor-pointer"
          >
            Concluído
          </button>
        </div>

      </div>
    </div>
  );
};
