import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  Database,
  Archive,
  CheckCircle2,
  AlertTriangle,
  FileText,
  BookOpen,
  Layers,
  BarChart2,
  Image as ImageIcon,
  Clock,
  Sparkles,
  RefreshCw,
  HardDrive,
  Info
} from 'lucide-react';
import { useStore } from '../cardblocks/store/useStore';
import { mediaStorage } from '../cardblocks/lib/mediaStorage';
import {
  downloadFullBackup,
  inspectBackupFile,
  restoreFullBackup,
  BackupInspection,
  FullBackupManifest
} from '../services/fullBackupService';

interface FullBackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'backup' | 'restore';
}

export function FullBackupRestoreModal({
  isOpen,
  onClose,
  defaultTab = 'backup'
}: FullBackupRestoreModalProps) {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>(defaultTab);

  // Status de processamento
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estatísticas atuais locais
  const [currentStats, setCurrentStats] = useState({
    questions: 0,
    questionBanks: 0,
    decks: 0,
    cards: 0,
    notebooks: 0,
    notes: 0,
    studyLogs: 0,
    resources: 0,
    scores: 0,
    mediaFiles: 0,
    estimatedBytes: 0
  });

  // Estado de arquivo para restauração
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<BackupInspection | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [confirmReplace, setConfirmReplace] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setErrorMessage(null);
      setSuccessMessage(null);
      setSelectedFile(null);
      setInspection(null);
      setIsProcessing(false);
      loadCurrentStats();
    }
  }, [isOpen, defaultTab]);

  const loadCurrentStats = async () => {
    try {
      const state = useStore.getState();
      const storageInfo = await mediaStorage.getStorageUsage();

      const studyLogs = JSON.parse(localStorage.getItem('usmle_study_logs_v4') || '[]');
      const resources = JSON.parse(localStorage.getItem('usmle_resources_v4') || '[]');
      const scores = JSON.parse(localStorage.getItem('usmle_scores_v1') || '[]');

      setCurrentStats({
        questions: state.questions?.length || 0,
        questionBanks: state.questionBanks?.length || 0,
        decks: state.decks?.length || 0,
        cards: state.cards?.length || 0,
        notebooks: state.notebooks?.length || 0,
        notes: state.notes?.length || 0,
        studyLogs: studyLogs.length,
        resources: resources.length,
        scores: scores.length,
        mediaFiles: storageInfo.mediaCount || 0,
        estimatedBytes: storageInfo.estimatedBytes || 0
      });
    } catch (e) {
      console.warn('Erro ao carregar estatísticas:', e);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Handler de Geração e Download de Backup
  const handleGenerateBackup = async () => {
    setIsProcessing(true);
    setProgressPct(0);
    setProgressStatus('Iniciando coleta de dados...');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await downloadFullBackup((pct, msg) => {
        setProgressPct(pct);
        setProgressStatus(msg);
      });

      setSuccessMessage(`Backup "${result.filename}" gerado e baixado com sucesso!`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao gerar arquivo de backup.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler de Seleção de Arquivo para Restaurar
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsProcessing(true);
    setProgressPct(20);
    setProgressStatus('Inspecionando arquivo de backup...');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const insp = await inspectBackupFile(file, (pct, msg) => {
        setProgressPct(pct);
        setProgressStatus(msg);
      });

      setInspection(insp);
      if (!insp.isValid) {
        setErrorMessage(insp.error || 'Arquivo de backup inválido.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao analisar arquivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler de Execução da Restauração
  const handleExecuteRestore = async () => {
    if (!inspection || !inspection.isValid) return;

    setIsProcessing(true);
    setProgressPct(0);
    setProgressStatus('Iniciando restauração dos dados...');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await restoreFullBackup(inspection, {
        mode: restoreMode,
        onProgress: (pct, msg) => {
          setProgressPct(pct);
          setProgressStatus(msg);
        }
      });

      if (res.success) {
        setSuccessMessage(res.message);
        await loadCurrentStats();
        setInspection(null);
        setSelectedFile(null);
      } else {
        setErrorMessage(res.error || res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro crítico durante a restauração.');
    } finally {
      setIsProcessing(false);
      setConfirmReplace(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <Archive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>Backup & Restauração Completa</span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full">
                  100% Offline & Mídias
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Exporte ou importe tudo: questões, cadernos, flashcards, cronogramas, métricas e imagens em um único arquivo (.usmlebak).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/40 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('backup');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'backup'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Fazer Backup (Exportar Tudo)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('restore');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'restore'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Restaurar Backup (Upload)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Mensagens de Sucesso ou Erro */}
          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-800 dark:text-emerald-200 font-medium">
                {successMessage}
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800 dark:text-rose-200 font-medium">
                {errorMessage}
              </div>
            </div>
          )}

          {/* Barra de Progresso durante processamento */}
          {isProcessing && (
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-200">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  {progressStatus || 'Processando...'}
                </span>
                <span>{progressPct}%</span>
              </div>
              <div className="w-full bg-blue-200/60 dark:bg-blue-900/60 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* TAB 1: FAZER BACKUP */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              
              {/* Visão geral do que está sendo empacotado */}
              <div>
                <h3 className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-blue-500" />
                  Dados que serão incluídos no Backup Completo
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl">
                    <div className="text-gray-400 dark:text-gray-500 text-[11px] font-semibold flex items-center gap-1 mb-1">
                      <BookOpen className="w-3.5 h-3.5 text-blue-500" /> Questões
                    </div>
                    <div className="text-lg font-extrabold text-gray-900 dark:text-white">
                      {currentStats.questions}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {currentStats.questionBanks} banco(s)
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl">
                    <div className="text-gray-400 dark:text-gray-500 text-[11px] font-semibold flex items-center gap-1 mb-1">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" /> Flashcards
                    </div>
                    <div className="text-lg font-extrabold text-gray-900 dark:text-white">
                      {currentStats.cards}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {currentStats.decks} baralho(s)
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl">
                    <div className="text-gray-400 dark:text-gray-500 text-[11px] font-semibold flex items-center gap-1 mb-1">
                      <FileText className="w-3.5 h-3.5 text-emerald-500" /> Cadernos & Notas
                    </div>
                    <div className="text-lg font-extrabold text-gray-900 dark:text-white">
                      {currentStats.notes}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {currentStats.notebooks} caderno(s)
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl">
                    <div className="text-gray-400 dark:text-gray-500 text-[11px] font-semibold flex items-center gap-1 mb-1">
                      <BarChart2 className="w-3.5 h-3.5 text-purple-500" /> Cronogramas & Logs
                    </div>
                    <div className="text-lg font-extrabold text-gray-900 dark:text-white">
                      {currentStats.studyLogs}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {currentStats.resources} materiais / {currentStats.scores} scores
                    </div>
                  </div>
                </div>

                {/* Arquivos de Mídia e Imagens */}
                <div className="mt-3 p-3.5 bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white">
                        Imagens, Diagramas & Áudios Integrados
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        {currentStats.mediaFiles} arquivo(s) de mídia anexados ({formatBytes(currentStats.estimatedBytes)})
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-md">
                    Inclusão Total
                  </span>
                </div>
              </div>

              {/* Botão de Ação para Baixar */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGenerateBackup}
                  disabled={isProcessing}
                  className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-5 h-5" />
                  <span>Gerar e Baixar Backup Completo (.usmlebak)</span>
                </button>
                <p className="text-center text-[11px] text-gray-400 mt-2">
                  Gera um único arquivo compactado protegido contendo tudo pronto para ser guardado ou transferido para outro dispositivo.
                </p>
              </div>

            </div>
          )}

          {/* TAB 2: RESTAURAR BACKUP */}
          {activeTab === 'restore' && (
            <div className="space-y-6">
              
              {/* Input File / Dropzone */}
              {!inspection ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".usmlebak,.zip,.json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-8 text-center cursor-pointer bg-gray-50/50 dark:bg-gray-800/30 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition-all space-y-3"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        Clique para selecionar o arquivo de backup
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Suporta arquivos <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-[10px]">.usmlebak</code> ou <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-[10px]">.zip</code>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Prévia e Detalhes do Arquivo Carregado */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                          {inspection.filename}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <span>{formatBytes(inspection.fileSizeBytes)}</span>
                          <span>•</span>
                          <span>Criado em: {new Date(inspection.manifest?.createdAt || '').toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setInspection(null);
                        setSelectedFile(null);
                      }}
                      className="text-xs text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 font-semibold cursor-pointer"
                    >
                      Trocar arquivo
                    </button>
                  </div>

                  {/* Resumo do Conteúdo Encontrado */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">
                      Conteúdo Identificado no Backup:
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
                        <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                          {inspection.manifest?.counts.questions || 0} Questões
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {inspection.manifest?.counts.questionBanks || 0} Bancos
                        </div>
                      </div>

                      <div className="p-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {inspection.manifest?.counts.cards || 0} Flashcards
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {inspection.manifest?.counts.decks || 0} Baralhos
                        </div>
                      </div>

                      <div className="p-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {inspection.manifest?.counts.notes || 0} Notas
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {inspection.manifest?.counts.notebooks || 0} Cadernos
                        </div>
                      </div>

                      <div className="p-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
                        <div className="text-xs font-bold text-purple-600 dark:text-purple-400">
                          {inspection.manifest?.counts.mediaFiles || inspection.mediaCount} Mídias
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Imagens & Áudios
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Escolha do Modo de Restauração */}
                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300">
                      Modo de Restauração:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      
                      <div
                        onClick={() => setRestoreMode('replace')}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                          restoreMode === 'replace'
                            ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="radio"
                            name="restoreMode"
                            checked={restoreMode === 'replace'}
                            onChange={() => setRestoreMode('replace')}
                            className="text-blue-600"
                          />
                          <span className="text-xs font-bold text-gray-900 dark:text-white">
                            Substituir Tudo (Recomendado)
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 pl-5">
                          Limpa o estado atual e restaura a base de dados exatamente como gravada no backup.
                        </p>
                      </div>

                      <div
                        onClick={() => setRestoreMode('merge')}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                          restoreMode === 'merge'
                            ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="radio"
                            name="restoreMode"
                            checked={restoreMode === 'merge'}
                            onChange={() => setRestoreMode('merge')}
                            className="text-blue-600"
                          />
                          <span className="text-xs font-bold text-gray-900 dark:text-white">
                            Mesclar com Dados Atuais
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 pl-5">
                          Preserva o que você já tem e adiciona as novas questões, flashcards e notas do arquivo.
                        </p>
                      </div>

                    </div>
                  </div>

                  {/* Confirmação de Substituição se for Replace */}
                  {restoreMode === 'replace' && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800 dark:text-amber-200">
                        <span className="font-bold">Aviso:</span> O modo de substituição irá sobrescrever os dados locais pelo conteúdo do arquivo de backup.
                      </div>
                    </div>
                  )}

                  {/* Botão de Ação para Restaurar */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleExecuteRestore}
                      disabled={isProcessing}
                      className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-5 h-5" />
                      <span>Confirmar e Restaurar Dados</span>
                    </button>
                  </div>

                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span>Todos os dados são salvos localmente e sob seu controle.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
