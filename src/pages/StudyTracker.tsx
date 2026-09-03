import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Calendar as CalendarIcon,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Folder,
  HelpCircle,
  Layers,
  Link2,
  Plus,
  Repeat,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  Video,
  Zap,
  Activity,
  BarChart3,
  CalendarDays,
  RotateCcw,
  CheckCircle2,
  Lock,
  Download,
  Upload,
  Flag,
} from "lucide-react";
import { useStudyPlan } from "../hooks/useStudyPlan";
import { cn } from "../lib/utils";
import {
  AllocationMode,
  FrequencyType,
  Resource,
  ResourceType,
  RESOURCE_CATEGORIES,
  StudyLogEntry,
  StudyMode,
} from "../types";
import { StudyHeatmap } from "../components/StudyHeatmap";
import { DailyLogSection } from "../components/DailyLogSection";
import { StudyTimeline } from "../components/StudyTimeline";
import { StudyCalendar } from "../components/StudyCalendar";

const DAYS_OF_WEEK = [
  { id: 0, name: 'Dom', short: 'D' },
  { id: 1, name: 'Seg', short: 'S' },
  { id: 2, name: 'Ter', short: 'T' },
  { id: 3, name: 'Qua', short: 'Q' },
  { id: 4, name: 'Qui', short: 'Q' },
  { id: 5, name: 'Sex', short: 'S' },
  { id: 6, name: 'Sáb', short: 'S' },
];

export const getCategoryIcon = (type: ResourceType) => {
  switch (type) {
    case 'qbank':
      return CheckSquare;
    case 'book':
      return BookOpen;
    case 'video':
      return Video;
    case 'flashcard':
      return Layers;
    case 'nbme':
      return Award;
    default:
      return Folder;
  }
};

// Modelo limpo sem números de exemplo inventados
const CLEAN_STARTER_RESOURCES: Resource[] = [
  {
    id: 'res-qbank-1',
    name: 'Banco de Questões Principal (QBank)',
    type: 'qbank',
    total: 3500,
    completed: 0,
    unit: 'questões',
    minutesPerItem: 2.0,
    targetDailyPace: 40,
    allocationMode: 'item_target',
    frequency: 'daily',
    fixedDailyMinutes: 0,
    dependsOnId: null,
    exclusiveStudyDay: false,
    reviewDaysPerItem: 0,
  },
];

export default function StudyTracker() {
  const [activeTab, setActiveTab] = useState<'planner' | 'timeline' | 'heatmap'>('planner');

  // Recuperação de dados do localStorage ou padrões vazios/limpos
  const [mode, setMode] = useState<StudyMode>(() => {
    const saved = localStorage.getItem('usmle_mode_v4');
    return (saved as StudyMode) || 'by_date';
  });

  const [examDateStr, setExamDateStr] = useState<string>(() => {
    const saved = localStorage.getItem('usmle_examDate_v4');
    return saved || '';
  });

  const [bufferDays, setBufferDays] = useState<number>(() => {
    const saved = localStorage.getItem('usmle_bufferDays_v4');
    return saved !== null ? Number(saved) : 14;
  });

  const [daysOff, setDaysOff] = useState<number[]>(() => {
    const saved = localStorage.getItem('usmle_daysOff_v4');
    return saved ? JSON.parse(saved) : [0]; // Domingo como folga padrão
  });

  const [expandedSettingsId, setExpandedSettingsId] = useState<string | null>(null);
  const [activeLogDateStr, setActiveLogDateStr] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const [resources, setResources] = useState<Resource[]>(() => {
    const saved = localStorage.getItem('usmle_resources_v4');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Erro ao carregar resources", e);
      }
    }
    return CLEAN_STARTER_RESOURCES;
  });

  const [studyLogs, setStudyLogs] = useState<StudyLogEntry[]>(() => {
    const saved = localStorage.getItem('usmle_study_logs_v4');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Erro ao carregar logs", e);
      }
    }
    return []; // Vazio por padrão, sem registros falsos de exemplo
  });

  // Escuta atualizações de logs de outras janelas/componentes (como o QuestionPacer)
  useEffect(() => {
    const handleLogsUpdated = () => {
      const saved = localStorage.getItem('usmle_study_logs_v4');
      if (saved) {
        setStudyLogs(JSON.parse(saved));
      }
    };
    window.addEventListener('usmle_logs_updated', handleLogsUpdated);
    return () => window.removeEventListener('usmle_logs_updated', handleLogsUpdated);
  }, []);

  // Salvar no localStorage automaticamente
  useEffect(() => {
    localStorage.setItem('usmle_mode_v4', mode);
    localStorage.setItem('usmle_examDate_v4', examDateStr);
    localStorage.setItem('usmle_bufferDays_v4', String(bufferDays));
    localStorage.setItem('usmle_daysOff_v4', JSON.stringify(daysOff));
    localStorage.setItem('usmle_resources_v4', JSON.stringify(resources));
    localStorage.setItem('usmle_study_logs_v4', JSON.stringify(studyLogs));
  }, [mode, examDateStr, bufferDays, daysOff, resources, studyLogs]);

  const plan = useStudyPlan(resources, examDateStr, daysOff, mode, bufferDays);

  const toggleDayOff = (dayId: number) => {
    setDaysOff(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
    );
  };

  const addResource = (type: ResourceType = 'qbank') => {
    const meta = RESOURCE_CATEGORIES[type];
    const newId = 'res-' + Math.random().toString(36).substring(2, 9);
    setResources(prev => [
      ...prev,
      {
        id: newId,
        name: '',
        type: meta.type,
        total: meta.type === 'nbme' ? 7 : meta.type === 'video' ? 50 : meta.type === 'book' ? 500 : 1000,
        completed: 0,
        unit: meta.defaultUnit,
        minutesPerItem: meta.defaultMinutesPerItem,
        targetDailyPace: meta.type === 'qbank' ? 40 : meta.type === 'book' ? 20 : 1,
        allocationMode: meta.defaultAllocationMode,
        frequency: meta.defaultFrequency,
        fixedDailyMinutes: meta.defaultFixedDailyMinutes || (meta.type === 'flashcard' ? 60 : 45),
        dependsOnId: null,
        exclusiveStudyDay: meta.defaultExclusiveStudyDay ?? (type === 'nbme'),
        reviewDaysPerItem: meta.defaultReviewDaysPerItem ?? (type === 'nbme' ? 1 : 0),
      }
    ]);
    setExpandedSettingsId(newId);
  };

  const handleTypeChange = (id: string, newType: ResourceType) => {
    const meta = RESOURCE_CATEGORIES[newType];
    setResources(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        return {
          ...r,
          type: newType,
          unit: meta.defaultUnit,
          minutesPerItem: meta.defaultMinutesPerItem,
          allocationMode: meta.defaultAllocationMode,
          frequency: meta.defaultFrequency,
          fixedDailyMinutes: meta.defaultFixedDailyMinutes || r.fixedDailyMinutes || 45,
          exclusiveStudyDay: meta.defaultExclusiveStudyDay ?? (newType === 'nbme'),
          reviewDaysPerItem: meta.defaultReviewDaysPerItem ?? (newType === 'nbme' ? 1 : 0),
        };
      })
    );
  };

  const updateResource = (id: string, updates: Partial<Resource>) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const removeResource = (id: string) => {
    setResources(prev => {
      return prev
        .filter(r => r.id !== id)
        .map(r => r.dependsOnId === id ? { ...r, dependsOnId: null } : r);
    });
  };

  const handleAddLog = (newLog: Omit<StudyLogEntry, 'id' | 'createdAt'>, syncWithResource: boolean = true) => {
    const logId = 'log-' + Math.random().toString(36).substring(2, 9);
    const createdEntry: StudyLogEntry = {
      ...newLog,
      id: logId,
      createdAt: Date.now(),
    };

    setStudyLogs(prev => [createdEntry, ...prev]);

    if (syncWithResource && newLog.resourceId) {
      setResources(prev =>
        prev.map(r => {
          if (r.id === newLog.resourceId) {
            return {
              ...r,
              completed: Math.min(r.total || 999999, (r.completed || 0) + Number(newLog.amount)),
            };
          }
          return r;
        })
      );
    }
  };

  const handleDeleteLog = (id: string) => {
    setStudyLogs(prev => prev.filter(l => l.id !== id));
  };

  const handleClearAllData = () => {
    if (window.confirm("Deseja limpar todos os materiais e o histórico de estudos para começar do zero?")) {
      setResources([]);
      setStudyLogs([]);
      setExamDateStr('');
      setBufferDays(14);
      setDaysOff([0]);
      localStorage.removeItem('usmle_resources_v4');
      localStorage.removeItem('usmle_study_logs_v4');
      localStorage.removeItem('usmle_examDate_v4');
      localStorage.removeItem('usmle_resources_v3');
      localStorage.removeItem('usmle_study_logs_v3');
    }
  };

  // Exportar Backup Completo (JSON)
  const handleExportBackup = () => {
    const backupData = {
      version: 4,
      exportDate: new Date().toISOString(),
      mode,
      examDateStr,
      bufferDays,
      daysOff,
      resources,
      studyLogs,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement("a");
    const dateFormatted = format(new Date(), "yyyy-MM-dd_HHmm");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `breno_md_backup_${dateFormatted}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Importar Backup Completo (JSON)
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result === "string") {
          const parsed = JSON.parse(result);

          if (parsed.resources && Array.isArray(parsed.resources)) {
            setResources(parsed.resources);
          }
          if (parsed.studyLogs && Array.isArray(parsed.studyLogs)) {
            setStudyLogs(parsed.studyLogs);
          }
          if (parsed.mode) {
            setMode(parsed.mode);
          }
          if (parsed.examDateStr !== undefined) {
            setExamDateStr(parsed.examDateStr);
          }
          if (parsed.bufferDays !== undefined) {
            setBufferDays(Number(parsed.bufferDays));
          }
          if (parsed.daysOff && Array.isArray(parsed.daysOff)) {
            setDaysOff(parsed.daysOff);
          }

          alert("Backup restaurado com sucesso!");
        }
      } catch (err) {
        console.error("Erro ao importar backup:", err);
        alert("Erro ao ler o arquivo de backup. Certifique-se de que é um arquivo JSON válido do Breno Md.");
      }
    };

    fileReader.readAsText(file);
    // Reset file input value so same file can be selected again if needed
    e.target.value = "";
  };

  return (
    <div className="flex flex-col font-sans pb-20 text-gray-900 dark:text-gray-100">
      {/* Header Minimalista e Fluido */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200/80 dark:border-gray-700/80 pt-6 pb-4 shrink-0">
        <div className="w-full max-w-[1550px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Link 
              to="/" 
              className="p-2 rounded-xl hover:bg-gray-100 dark:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100 border border-gray-200/60 dark:border-gray-700/60"
              title="Voltar ao Início"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Breno Md
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                Planejador e rastreador de estudos para o USMLE & Residência Médica
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Download Backup */}
            <button
              type="button"
              onClick={handleExportBackup}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-pointer shadow-xs"
              title="Baixar cópia de segurança com materiais e histórico em arquivo JSON"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Baixar Backup</span>
            </button>

            {/* Upload Backup */}
            <label
              className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-pointer shadow-xs"
              title="Restaurar backup a partir de um arquivo JSON"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Importar Backup</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>

            {/* Limpar Dados */}
            <button
              type="button"
              onClick={handleClearAllData}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-red-200 hover:bg-red-50/50 transition-all cursor-pointer"
              title="Limpar todos os dados e começar do zero"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="w-full max-w-[1550px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 mt-4">
          <nav className="flex space-x-6 sm:space-x-8 border-b border-gray-100 dark:border-gray-800 text-xs sm:text-sm">
            <button
              type="button"
              onClick={() => setActiveTab('planner')}
              className={cn(
                "font-medium pb-3 transition-all flex items-center gap-2 cursor-pointer border-b-2",
                activeTab === 'planner'
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 font-semibold"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-800 dark:text-gray-200"
              )}
            >
              <CalendarDays className="w-4 h-4" />
              Planejamento & Metas
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={cn(
                "font-medium pb-3 transition-all flex items-center gap-2 cursor-pointer border-b-2",
                activeTab === 'timeline'
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 font-semibold"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-800 dark:text-gray-200"
              )}
            >
              <BarChart3 className="w-4 h-4" />
              Linha do Tempo & Fases
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('heatmap')}
              className={cn(
                "font-medium pb-3 transition-all flex items-center gap-2 cursor-pointer border-b-2",
                activeTab === 'heatmap'
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 font-semibold"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-800 dark:text-gray-200"
              )}
            >
              <Activity className="w-4 h-4" />
              Heatmap & Lançamentos
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Amplo */}
      <main className="w-full max-w-[1550px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 flex-1 flex flex-col gap-6">
        
        {/* ABA 1: PLANEJADOR & CRONOGRAMA */}
        {activeTab === 'planner' && (
          <div className="flex flex-col gap-6">
            
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
              {/* Coluna Esquerda: Configurações e Materiais */}
              <div className="xl:col-span-7 flex flex-col gap-6">
                
                {/* Configurações da Prova */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/90 dark:border-gray-700/90 p-5 sm:p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Configurações da Prova
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Defina a data limite ou o ritmo de estudo desejado.
                      </p>
                    </div>
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                      <button
                        onClick={() => setMode('by_date')}
                        className={cn(
                          "px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer",
                          mode === 'by_date' ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-gray-200"
                        )}
                      >
                        Por Data da Prova
                      </button>
                      <button
                        onClick={() => setMode('by_pace')}
                        className={cn(
                          "px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer",
                          mode === 'by_pace' ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-gray-200"
                        )}
                      >
                        Por Ritmo Diário
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">
                        Data Alvo da Prova (Exam Date)
                      </label>
                      <input 
                        type="date" 
                        value={examDateStr}
                        onChange={(e) => setExamDateStr(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white dark:bg-gray-900 transition-all"
                      />
                    </div>

                    {mode === 'by_date' ? (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 inline" />
                            Margem de Segurança (Buffer)
                          </label>
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{bufferDays} dias livres</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            min="0"
                            max="120"
                            value={bufferDays}
                            onChange={(e) => setBufferDays(Math.max(0, parseInt(e.target.value) || 0))}
                            placeholder="14"
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white dark:bg-gray-900 transition-all"
                          />
                          <div className="flex gap-1">
                            {[0, 7, 14, 21].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setBufferDays(preset)}
                                className={cn(
                                  "px-2 py-1.5 text-xs font-semibold rounded border transition-colors cursor-pointer",
                                  bufferDays === preset
                                    ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 text-blue-700 dark:text-blue-300"
                                    : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:bg-gray-800"
                                )}
                              >
                                {preset}d
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">
                          Modo Ritmo Livre
                        </label>
                        <div className="p-2 bg-blue-50/50 border border-blue-100 rounded-lg text-xs text-blue-800 dark:text-blue-200">
                          A data de término é estimada automaticamente a partir do ritmo fixado para cada material.
                        </div>
                      </div>
                    )}

                    <div className="sm:col-span-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold">
                          Dias de Folga Semanais (Off Days)
                        </label>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {daysOff.length === 0 ? "Sem dias de folga" : `${daysOff.length} dia(s) livre(s) por semana`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 max-w-sm">
                        {DAYS_OF_WEEK.map(day => {
                          const isOff = daysOff.includes(day.id);
                          return (
                            <button
                              key={day.id}
                              type="button"
                              onClick={() => toggleDayOff(day.id)}
                              title={isOff ? `${day.name} (Folga)` : `${day.name} (Dia de Estudo)`}
                              className={cn(
                                "flex-1 h-9 flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer",
                                isOff 
                                  ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:bg-gray-700" 
                                  : "bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 shadow-xs"
                              )}
                            >
                              <span>{day.short}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Materiais de Estudo & Fases */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/90 dark:border-gray-700/90 p-5 sm:p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-gray-800">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Materiais de Estudo & Fases
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Adicione QBanks, livros, vídeos, flashcards e simulados.
                      </p>
                    </div>

                    {/* Botões de Adição Rápida */}
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(RESOURCE_CATEGORIES) as ResourceType[]).map(type => {
                        const Icon = getCategoryIcon(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => addResource(type)}
                            className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:bg-blue-900/30 hover:text-blue-700 dark:text-blue-300 hover:border-blue-200 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                            title={`Adicionar ${RESOURCE_CATEGORIES[type].label}`}
                          >
                            <Icon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>+ {type === 'qbank' ? 'QBank' : type === 'book' ? 'Livro' : type === 'video' ? 'Vídeo' : type === 'flashcard' ? 'Flashcards' : type === 'nbme' ? 'Simulado' : 'Outro'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3.5">
                    {resources.map((resource) => {
                      const Icon = getCategoryIcon(resource.type);
                      const isExpanded = expandedSettingsId === resource.id;
                      const isDependent = Boolean(resource.dependsOnId);
                      const parentResource = resources.find(r => r.id === resource.dependsOnId);
                      const calc = plan.resourcesSchedule?.find(c => c.resourceId === resource.id);

                      const progressPercent = resource.total > 0 
                        ? Math.min(100, Math.round((resource.completed / resource.total) * 100))
                        : 0;
                      const remaining = Math.max(0, resource.total - resource.completed);

                      const availableDependencies = resources.filter(r => r.id !== resource.id);
                      const isExclusive = resource.exclusiveStudyDay ?? (resource.type === 'nbme');

                      return (
                        <div 
                          key={resource.id} 
                          className={cn(
                            "relative flex flex-col gap-3 p-4 rounded-xl border transition-all",
                            isDependent 
                              ? "bg-slate-50/60 border-slate-200 border-l-4 border-l-blue-500" 
                              : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600"
                          )}
                        >
                          {/* Header do Card */}
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <select
                                value={resource.type}
                                onChange={(e) => handleTypeChange(resource.id, e.target.value as ResourceType)}
                                className="text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                              >
                                {(Object.keys(RESOURCE_CATEGORIES) as ResourceType[]).map(t => (
                                  <option key={t} value={t}>
                                    {RESOURCE_CATEGORIES[t].label}
                                  </option>
                                ))}
                              </select>

                              {/* Badges indicativos */}
                              {resource.allocationMode === 'fixed_time' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 border border-purple-100 text-purple-700 text-[10px] font-semibold">
                                  <Timer className="w-3 h-3" /> {resource.fixedDailyMinutes || 60}m/dia fixo
                                </span>
                              )}

                              {resource.frequency !== 'daily' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold">
                                  <Repeat className="w-3 h-3" /> {resource.frequency === 'weekly' ? 'Semanal' : 'Periódico'}
                                </span>
                              )}

                              {isExclusive && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-semibold">
                                  <Award className="w-3 h-3" /> Dia Exclusivo ({1 + (resource.reviewDaysPerItem || 1)}d c/ correção)
                                </span>
                              )}

                              {isDependent && parentResource && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 border border-blue-100 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">
                                  <Link2 className="w-3 h-3" /> Após: {parentResource.name || 'Material anterior'}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedSettingsId(isExpanded ? null : resource.id)}
                                className={cn(
                                  "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors cursor-pointer",
                                  isExpanded ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:bg-gray-800"
                                )}
                                title="Configurações de dependência, frequência e medição"
                              >
                                <span>Avançado</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>

                              <button 
                                onClick={() => removeResource(resource.id)}
                                className="text-gray-400 dark:text-gray-500 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50 cursor-pointer"
                                title="Remover material"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Inputs Principais com Espaçamento Amplo */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                            <div className="sm:col-span-5">
                              <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">
                                Nome do Material
                              </label>
                              <input 
                                type="text" 
                                value={resource.name}
                                placeholder="Ex: UWorld Step 1, First Aid, Amboss..."
                                onChange={(e) => updateResource(resource.id, { name: e.target.value })}
                                className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white dark:bg-gray-900"
                              />
                            </div>
                            
                            {resource.allocationMode === 'fixed_time' ? (
                              <>
                                <div className="sm:col-span-4">
                                  <label className="block text-[10px] text-purple-700 uppercase font-semibold mb-1 flex items-center gap-1">
                                    <Timer className="w-3 h-3" /> Tempo Reservado Diário
                                  </label>
                                  <div className="flex items-center gap-1">
                                    <input 
                                      type="number" 
                                      value={resource.fixedDailyMinutes || ''}
                                      onChange={(e) => updateResource(resource.id, { fixedDailyMinutes: Number(e.target.value) })}
                                      placeholder="60"
                                      className="w-full px-3 py-1.5 bg-purple-50/40 border border-purple-200 rounded-lg text-sm font-bold text-purple-900 focus:outline-none focus:border-purple-400"
                                    />
                                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">min/dia</span>
                                  </div>
                                </div>

                                <div className="sm:col-span-3">
                                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">
                                    Concluído
                                  </label>
                                  <input 
                                    type="number" 
                                    value={resource.completed || ''}
                                    placeholder="0"
                                    onChange={(e) => updateResource(resource.id, { completed: Number(e.target.value) })}
                                    className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500"
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="sm:col-span-2">
                                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">
                                    Total ({resource.unit})
                                  </label>
                                  <input 
                                    type="number" 
                                    value={resource.total || ''}
                                    onChange={(e) => updateResource(resource.id, { total: Number(e.target.value) })}
                                    className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white dark:bg-gray-900"
                                  />
                                </div>

                                <div className="sm:col-span-2">
                                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">
                                    Concluído
                                  </label>
                                  <input 
                                    type="number" 
                                    value={resource.completed || ''}
                                    onChange={(e) => updateResource(resource.id, { completed: Number(e.target.value) })}
                                    className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white dark:bg-gray-900"
                                  />
                                </div>

                                <div className="sm:col-span-3">
                                  {mode === 'by_pace' ? (
                                    <div>
                                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">
                                        Meta Diária ({resource.unit}/dia)
                                      </label>
                                      <input 
                                        type="number" 
                                        value={resource.targetDailyPace || ''}
                                        onChange={(e) => updateResource(resource.id, { targetDailyPace: Number(e.target.value) })}
                                        className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500"
                                      />
                                    </div>
                                  ) : (
                                    <div>
                                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1 truncate" title="Tempo médio por item">
                                        Minutos por {resource.unit}
                                      </label>
                                      <input 
                                        type="number" 
                                        step="0.1"
                                        value={resource.minutesPerItem || ''}
                                        onChange={(e) => updateResource(resource.id, { minutesPerItem: Number(e.target.value) })}
                                        className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500"
                                      />
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>

                          {/* Progress Bar */}
                          {resource.total > 0 && resource.allocationMode !== 'fixed_time' && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden border border-gray-200/60 dark:border-gray-700/60">
                                <div 
                                  className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-300" 
                                  style={{ width: `${progressPercent}%` }}
                                ></div>
                              </div>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium shrink-0">
                                {progressPercent}% ({remaining} restantes)
                              </span>
                            </div>
                          )}

                          {/* Detalhamento de Cálculo (Visível se houver) */}
                          {calc && calc.calculationBreakdown && calc.calculationBreakdown.length > 0 && (
                            <details className="mt-3 mb-1 text-[10px] text-indigo-700 bg-indigo-50/70 p-2.5 rounded-lg border border-indigo-100">
                              <summary className="font-semibold cursor-pointer hover:text-indigo-900 flex items-center gap-1 select-none">
                                <BarChart3 className="w-4 h-4 text-indigo-500" /> Detalhamento de como o cálculo foi feito
                              </summary>
                              <ul className="mt-2 pl-5 list-disc space-y-1 text-indigo-600/90 font-medium">
                                {calc.calculationBreakdown.map((line, idx) => (
                                  <li key={idx}>{line}</li>
                                ))}
                              </ul>
                            </details>
                          )}

                          {/* Gaveta de Opções Avançadas */}
                          {isExpanded && (
                            <div className="mt-2 pt-3 border-t border-gray-200/80 dark:border-gray-700/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-50/80 p-3 rounded-lg">
                              
                              {/* 1. Dependência Sequencial e Data Limite */}
                              <div className="flex flex-col gap-3">
                                <div>
                                  <label className="block text-[10px] text-gray-600 dark:text-gray-400 uppercase font-bold mb-1 flex items-center gap-1">
                                    <Link2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                    Dependência
                                  </label>
                                  <select
                                    value={resource.dependsOnId || ''}
                                    onChange={(e) => updateResource(resource.id, { dependsOnId: e.target.value || null })}
                                    className="w-full text-xs font-medium text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                                  >
                                    <option value="">Nenhum (Início Imediato)</option>
                                    {availableDependencies.map(dep => (
                                      <option key={dep.id} value={dep.id}>
                                        Após: {dep.name || 'Material sem nome'}
                                      </option>
                                    ))}
                                  </select>
                                  <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-1">
                                    Inicia após terminar o pré-requisito.
                                  </p>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-gray-600 dark:text-gray-400 uppercase font-bold mb-1 flex items-center gap-1">
                                    <CalendarDays className="w-3 h-3 text-emerald-600" />
                                    Data de Início (Opcional)
                                  </label>
                                  <input
                                    type="date"
                                    value={resource.targetStartDate || ''}
                                    onChange={(e) => updateResource(resource.id, { targetStartDate: e.target.value || null })}
                                    className="w-full text-xs font-medium text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-1.5 mb-3 focus:outline-none focus:border-blue-500 cursor-pointer"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-gray-600 dark:text-gray-400 uppercase font-bold mb-1 flex items-center gap-1">
                                    <CalendarDays className="w-3 h-3 text-emerald-600" />
                                    Data Limite (Opcional)
                                  </label>
                                  <input
                                    type="date"
                                    value={resource.targetEndDate || ''}
                                    onChange={(e) => updateResource(resource.id, { targetEndDate: e.target.value || null })}
                                    className="w-full text-xs font-medium text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                                  />
                                </div>
                              </div>

                              {/* 2. Frequência */}
                              <div>
                                <label className="block text-[10px] text-gray-600 dark:text-gray-400 uppercase font-bold mb-1 flex items-center gap-1">
                                  <Repeat className="w-3 h-3 text-amber-600" />
                                  Frequência
                                </label>
                                <select
                                  value={resource.frequency}
                                  onChange={(e) => updateResource(resource.id, { frequency: e.target.value as FrequencyType })}
                                  className="w-full text-xs font-medium text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                                >
                                  <option value="daily">Diário (Dias de Estudo)</option>
                                  <option value="weekly">Semanal (ex: Simulados)</option>
                                  <option value="biweekly">Quinzenal</option>
                                  <option value="monthly">Mensal</option>
                                  <option value="sporadic">Esporádico</option>
                                </select>
                              </div>

                              {/* 3. Modo de Medição */}
                              <div>
                                <label className="block text-[10px] text-gray-600 dark:text-gray-400 uppercase font-bold mb-1 flex items-center gap-1">
                                  <Timer className="w-3 h-3 text-purple-600" />
                                  Tipo de Medição
                                </label>
                                <select
                                  value={resource.allocationMode}
                                  onChange={(e) => updateResource(resource.id, { allocationMode: e.target.value as AllocationMode })}
                                  className="w-full text-xs font-medium text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                                >
                                  <option value="item_target">Por Quantidade (QBank/Livro)</option>
                                  <option value="fixed_time">Tempo Fixo Reservado (Anki)</option>
                                </select>
                              </div>

                              {/* 4. Dias Exclusivos & Correção (NBME) */}
                              <div className="bg-white dark:bg-gray-900 p-2 rounded-md border border-gray-200 dark:border-gray-700">
                                <label className="block text-[10px] text-rose-800 uppercase font-bold mb-1 flex items-center gap-1">
                                  <Award className="w-3 h-3 text-rose-600" />
                                  Dia Exclusivo & Correção
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 font-medium mb-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isExclusive}
                                    onChange={(e) => updateResource(resource.id, { exclusiveStudyDay: e.target.checked })}
                                    className="w-3.5 h-3.5 text-rose-600 rounded"
                                  />
                                  <span>Dia 100% Exclusivo</span>
                                </label>
                                
                                {isExclusive && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <label className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                      + Dias Correção:
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="5"
                                      value={resource.reviewDaysPerItem ?? 1}
                                      onChange={(e) => updateResource(resource.id, { reviewDaysPerItem: Math.max(0, parseInt(e.target.value) || 0) })}
                                      className="w-12 px-1.5 py-0.5 text-xs font-bold bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded text-center"
                                    />
                                  </div>
                                )}
                              </div>

                            {/* 5. Metas Diárias Fixas por Dia da Semana (Avançado) */}
                            {resource.frequency === 'daily' && resource.allocationMode === 'item_target' && (
                              <div className="mt-3 pt-3 border-t border-gray-200/80 dark:border-gray-700/80">
                                <label className="block text-[10px] text-gray-600 dark:text-gray-400 uppercase font-bold mb-2 flex items-center gap-1">
                                  <CalendarDays className="w-3 h-3 text-indigo-600" />
                                  Fixar Volume de Estudo (Opcional)
                                </label>
                                <p className="text-[9px] text-gray-400 dark:text-gray-500 mb-2">
                                  Fixe um volume para a fonte inteira (Geral) ou para dias específicos. O restante do tempo será redistribuído mantendo a data da prova.
                                </p>
                                <div className="flex gap-2 flex-wrap items-end">
                                  <div className="flex flex-col items-center border-r border-gray-200 dark:border-gray-700 pr-3 mr-1">
                                    <span className="text-[10px] font-bold text-indigo-600 mb-1">Geral</span>
                                    <input
                                      type="number"
                                      placeholder="Auto"
                                      className="w-14 h-8 text-center text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 rounded focus:border-indigo-500 focus:outline-none placeholder:font-normal placeholder:text-indigo-300"
                                      value={resource.fixedGlobalVolume ?? ''}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? null : Number(e.target.value);
                                        updateResource(resource.id, { fixedGlobalVolume: val });
                                      }}
                                    />
                                  </div>
                                  {DAYS_OF_WEEK.map(day => (
                                    <div key={day.id} className="flex flex-col items-center">
                                      <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">{day.short}</span>
                                      <input
                                        type="number"
                                        placeholder="Auto"
                                        className="w-12 h-8 text-center text-xs font-bold text-indigo-900 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:border-indigo-500 focus:outline-none placeholder:font-normal placeholder:text-gray-400 dark:text-gray-500"
                                        value={resource.fixedVolumeByDayOfWeek?.[day.id] ?? ''}
                                        onChange={(e) => {
                                          const val = e.target.value === '' ? null : Number(e.target.value);
                                          const currentFixed = { ...(resource.fixedVolumeByDayOfWeek || {}) };
                                          if (val === null) {
                                            delete currentFixed[day.id];
                                          } else {
                                            currentFixed[day.id] = val;
                                          }
                                          updateResource(resource.id, { fixedVolumeByDayOfWeek: currentFixed });
                                        }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            </div>
                          )}
                        </div>
                      );
                    })}

                    {resources.length === 0 && (
                      <div className="text-center py-10 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900">
                        <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Nenhum material adicionado ainda.</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Clique nos botões acima para cadastrar seu QBank, Anki ou Simulados.</p>
                      </div>
                    )}
                  </div>
                </section>

              </div>

              {/* Coluna Direita: Projeções, Carga e Cronograma */}
              <div className="xl:col-span-5 flex flex-col gap-6">
                
                {/* Dashboard de Projeção */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/90 dark:border-gray-700/90 shadow-sm p-5 sm:p-6 overflow-hidden">
                  <div className="flex justify-between items-start mb-5 pb-3 border-b border-gray-100 dark:border-gray-800">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Projeção & Carga Horária
                      </h2>
                      {plan.isValid && plan.bufferDays > 0 && mode === 'by_date' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded bg-blue-50 dark:bg-blue-900/30 border border-blue-100 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">
                          <ShieldCheck className="w-3 h-3" /> {plan.bufferDays} dias de margem
                        </span>
                      )}
                    </div>

                    {plan.isValid && (
                      <div className="text-right">
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold">Carga Diária Média</div>
                        <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                          {Math.floor(plan.totalDailyMinutes / 60)}h {plan.totalDailyMinutes % 60}m <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">/ dia</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {!plan.isValid ? (
                    <div className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                      <HelpCircle className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
                      <span>{plan.message || "Preencha a data da prova ou as metas diárias para calcular a projeção."}</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold mb-1">
                            {mode === 'by_date' ? "Término dos Conteúdos" : "Término Previsto"}
                          </div>
                          <div className="text-sm sm:text-base font-bold text-blue-600 dark:text-blue-400">
                            {plan.estimatedEndDate ? format(plan.estimatedEndDate, "dd 'de' MMM, yyyy", { locale: ptBR }) : '-'}
                          </div>
                          {mode === 'by_date' && plan.bufferDays > 0 && (
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {plan.bufferDays}d livres antes da prova
                            </div>
                          )}
                        </div>

                        <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold mb-1">Dias de Estudo Diário</div>
                          <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">
                            {plan.effectiveDailyStudyDays} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">dias úteis</span>
                          </div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                            {plan.totalExclusiveDays > 0 
                              ? `(${plan.totalExclusiveDays}d para simulados+correção)` 
                              : `(${plan.studyDays} dias totais)`}
                          </div>
                        </div>
                        
                        {plan.daysToExamTotal !== undefined && (
                          <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                            <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold mb-1 flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3 text-red-400" /> Para a Prova
                            </div>
                            <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">
                              {plan.daysToExamTotal} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">dias totais</span>
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                              {plan.daysToExamStudy} dias úteis
                            </div>
                          </div>
                        )}

                        <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold mb-1 flex items-center gap-1">
                            <Flag className="w-3 h-3 text-green-500" /> Para o Prazo Limite
                          </div>
                          <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">
                            {plan.daysToDeadlineTotal} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">dias totais</span>
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                            {plan.daysToDeadlineStudy} dias úteis
                          </div>
                        </div>
                      </div>

                      {/* Detalhamento do Tempo */}
                      <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-2">
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">
                          Divisão da Carga Diária
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                            <Timer className="w-3.5 h-3.5 text-purple-600" /> Tempo Fixo Reservado (Anki/Revisão):
                          </span>
                          <span className="font-semibold text-purple-700">
                            {Math.floor(plan.fixedTimeboxMinutes / 60) > 0 ? `${Math.floor(plan.fixedTimeboxMinutes / 60)}h ` : ''}
                            {plan.fixedTimeboxMinutes % 60}m
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Conteúdo Ativo (QBank/Livros):
                          </span>
                          <span className="font-semibold text-blue-700 dark:text-blue-300">
                            {Math.floor(plan.variableContentMinutes / 60) > 0 ? `${Math.floor(plan.variableContentMinutes / 60)}h ` : ''}
                            {plan.variableContentMinutes % 60}m
                          </span>
                        </div>
                      </div>

                      {mode === 'by_date' && plan.examDate && (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-xs">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <div>
                              <div className="text-[10px] uppercase font-bold text-blue-900">Data Oficial da Prova</div>
                              <div className="text-xs font-semibold text-blue-800 dark:text-blue-200">
                                {format(plan.examDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                              </div>
                            </div>
                          </div>
                          {plan.bufferDays > 0 && (
                            <div className="text-right text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                              {plan.bufferDays}d de margem
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {/* Cronograma de Metas Diárias */}
                {plan.isValid && plan.dailyTasks.length > 0 && (
                  <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/90 dark:border-gray-700/90 shadow-sm p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Metas Diárias & Fases
                      </h2>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{plan.dailyTasks.length} matérias</span>
                    </div>

                    <div className="space-y-2.5">
                      {plan.dailyTasks.map((task, i) => {
                        const Icon = getCategoryIcon(task.resourceType);
                        const isCompleted = task.phaseStatus === 'completed';
                        const isQueued = task.phaseStatus === 'queued';
                        const isTimebox = task.isTimebox;
                        const isPeriodic = task.frequency !== 'daily';

                        return (
                          <div 
                            key={i} 
                            className={cn(
                              "flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition-all gap-2.5",
                              isCompleted
                                ? "bg-emerald-50/40 border-emerald-200/60"
                                : isQueued 
                                ? "bg-amber-50/20 border-dashed border-amber-200"
                                : isTimebox
                                  ? "bg-purple-50/30 border-purple-100"
                                  : isPeriodic
                                    ? "bg-rose-50/30 border-rose-100"
                                    : "bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:border-gray-700"
                            )}
                          >
                            <div className="flex items-start sm:items-center space-x-3 min-w-0">
                              <div className={cn(
                                "w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold shrink-0",
                                isCompleted
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                  : isQueued 
                                  ? "bg-amber-100/60 text-amber-700 border-amber-200" 
                                  : isTimebox
                                    ? "bg-purple-50 text-purple-600 border-purple-200"
                                    : isPeriodic
                                      ? "bg-rose-50 text-rose-600 border-rose-200"
                                      : "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 border-gray-200 dark:border-gray-700"
                              )}>
                                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 flex-wrap">
                                  <span>{task.resourceName || 'Material sem nome'}</span>
                                  {isCompleted ? (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-medium flex items-center gap-0.5">
                                      <CheckCircle2 className="w-2.5 h-2.5" /> 100% Concluído
                                    </span>
                                  ) : isQueued ? (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-medium flex items-center gap-0.5">
                                      <Lock className="w-2.5 h-2.5" /> Aguardando Fase
                                    </span>
                                  ) : (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-medium flex items-center gap-0.5">
                                      <Zap className="w-2.5 h-2.5" /> Ativo
                                    </span>
                                  )}
                                  {isTimebox && (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-normal">
                                      Tempo Fixo
                                    </span>
                                  )}
                                  {isPeriodic && (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded font-normal">
                                      {task.frequency === 'weekly' ? 'Semanal' : 'Periódico'}
                                    </span>
                                  )}
                                </div>
                                
                                {task.note && (
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                                    {task.note}
                                  </div>
                                )}
                                {task.calculationBreakdown && task.calculationBreakdown.length > 0 && (
                                  <details className="mt-2 text-[10px] text-gray-600 dark:text-gray-400 bg-white/60 dark:bg-gray-800/60 p-1.5 rounded border border-gray-100 dark:border-gray-800">
                                    <summary className="font-semibold cursor-pointer hover:text-blue-600 dark:text-blue-400 flex items-center gap-1 select-none">
                                      <BarChart3 className="w-3 h-3" /> Ver Detalhes do Cálculo
                                    </summary>
                                    <ul className="mt-1.5 pl-4 list-disc space-y-0.5 text-gray-500 dark:text-gray-400">
                                      {task.calculationBreakdown.map((line, idx) => (
                                        <li key={idx}>{line}</li>
                                      ))}
                                    </ul>
                                  </details>
                                )}
                              </div>
                            </div>

                            <div className="text-left sm:text-right shrink-0">
                              {isCompleted ? (
                                <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1 sm:justify-end">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Finalizado
                                </div>
                              ) : isQueued ? (
                                <div className="bg-amber-100/40 border border-amber-200/60 rounded-lg p-1.5 text-left sm:text-right">
                                  <div className="text-[9px] uppercase font-bold text-amber-800">
                                    Carga ao Iniciar:
                                  </div>
                                  <div className="text-xs font-bold text-amber-950">
                                    {task.projectedDailyAmount || task.amount} {task.unit}/dia
                                  </div>
                                  <div className="text-[10px] text-amber-700 font-medium flex items-center sm:justify-end gap-1">
                                    <Clock className="w-3 h-3" />
                                    ~{task.projectedDailyMinutes || task.estimatedMinutes} min/dia
                                  </div>
                                </div>
                              ) : isTimebox ? (
                                <>
                                  <div className="text-xs font-bold text-purple-900">
                                    {task.estimatedMinutes} min
                                  </div>
                                  <div className="text-[10px] text-purple-600">
                                    / dia reservado
                                  </div>
                                </>
                              ) : isPeriodic ? (
                                <>
                                  <div className="text-xs font-bold text-rose-900">
                                    1 sessão
                                  </div>
                                  <div className="text-[10px] text-rose-700">
                                    ~{Math.round(task.estimatedMinutes / 60)}h por exame
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                    {task.amount} <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{task.unit}</span>
                                  </div>
                                  <div className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center sm:justify-end gap-1">
                                    <Clock className="w-3 h-3" />
                                    {Math.floor(task.estimatedMinutes / 60) > 0 ? `${Math.floor(task.estimatedMinutes / 60)}h ` : ''}
                                    {task.estimatedMinutes % 60}m / dia
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Botão de Atalho para o Heatmap */}
                <button
                  type="button"
                  onClick={() => setActiveTab('heatmap')}
                  className="flex items-center justify-center gap-2 p-3 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 text-white rounded-xl shadow-xs text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Registrar Sessão de Estudo de Hoje
                </button>

              </div>
              
            </div>

            {/* Linha do Tempo Visual Minimalista (Posicionada abaixo da calculadora e materiais) */}
            {plan.isValid && resources.length > 0 && (
              <>
                <StudyTimeline
                  plan={plan}
                  resources={resources}
                  examDateStr={examDateStr}
                />
                <StudyCalendar 
                  plan={plan}
                  resources={resources}
                  studyLogs={studyLogs}
                  onAddLog={handleAddLog}
                />
              </>
            )}
          </div>
        )}

        {/* ABA 2: LINHA DO TEMPO DEDICADA EM TELA CHEIA */}
        {activeTab === 'timeline' && (
          <div className="flex flex-col gap-6">
            {plan.isValid && resources.length > 0 ? (
              <StudyTimeline
                plan={plan}
                resources={resources}
                examDateStr={examDateStr}
              />
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/90 dark:border-gray-700/90 p-8 text-center">
                <HelpCircle className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {plan.message || "Adicione seus materiais e defina a data da prova para gerar o cronograma visual de fases."}
                </p>
                <button
                  onClick={() => setActiveTab('planner')}
                  className="mt-3 px-4 py-2 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Ir para Planejamento
                </button>
              </div>
            )}
          </div>
        )}

        {/* ABA 3: HEATMAP & REGISTROS */}
        {activeTab === 'heatmap' && (
          <div className="flex flex-col gap-6">
            
            {/* Lançamento Rápido Diário */}
            <DailyLogSection
              resources={resources}
              activeDateStr={activeLogDateStr}
              onActiveDateChange={setActiveLogDateStr}
              onAddLog={handleAddLog}
            />

            {/* Heatmap Visual de Estudos */}
            <StudyHeatmap
              logs={studyLogs}
              resources={resources}
              onAddLog={handleAddLog}
              onDeleteLog={handleDeleteLog}
              onSelectDateForLog={setActiveLogDateStr}
            />

          </div>
        )}

      </main>
    </div>
  );
}
