import React, { useState, useMemo } from 'react';
import { useStore, Question } from '../../store/useStore';
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Filter,
  Layers,
  Clock,
  Sparkles,
  Shuffle,
  ListOrdered,
  Activity,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Play,
  CheckSquare,
  Square,
  AlertCircle
} from 'lucide-react';

export type QuestionStatusFilter = 'all' | 'unused' | 'used' | 'incorrect' | 'correct';
export type TestMode = 'tutored' | 'timed';
export type QuestionOrder = 'sequential' | 'random';

export interface TestSessionConfig {
  bankId: string;
  selectedQuestionIds: string[];
  mode: TestMode;
  order: QuestionOrder;
  pacerEnabled: boolean;
  pacerTargetSeconds: number;
}

interface TestCreatorViewProps {
  bankId: string;
  onBackToBanks: () => void;
  onStartSession: (config: TestSessionConfig) => void;
}

export const TestCreatorView: React.FC<TestCreatorViewProps> = ({
  bankId,
  onBackToBanks,
  onStartSession,
}) => {
  const { questionBanks, questions } = useStore();
  const bank = questionBanks.find(b => b.id === bankId) || questionBanks[0];

  const bankQuestions = useMemo(() => {
    return questions.filter(q => q.bankId === bank?.id);
  }, [questions, bank]);

  // Hierarquia: Subject -> Systems
  const subjectHierarchy = useMemo(() => {
    const map = new Map<string, { total: number; systems: Map<string, number> }>();

    bankQuestions.forEach(q => {
      const sub = q.subject?.trim() || 'Geral';
      const sys = q.system?.trim() || 'Outros';

      if (!map.has(sub)) {
        map.set(sub, { total: 0, systems: new Map() });
      }
      const subData = map.get(sub)!;
      subData.total += 1;
      subData.systems.set(sys, (subData.systems.get(sys) || 0) + 1);
    });

    return Array.from(map.entries()).map(([subject, data]) => ({
      subject,
      total: data.total,
      systems: Array.from(data.systems.entries()).map(([system, count]) => ({
        system,
        count,
      })),
    })).sort((a, b) => b.total - a.total);
  }, [bankQuestions]);

  // Estados de seleção
  const [selectedHierarchy, setSelectedHierarchy] = useState<Record<string, Set<string>>>(() => {
    // Inicialmente seleciona todos os subjects e systems
    const initial: Record<string, Set<string>> = {};
    subjectHierarchy.forEach(item => {
      initial[item.subject] = new Set(item.systems.map(s => s.system));
    });
    return initial;
  });

  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(() => {
    return new Set(subjectHierarchy.slice(0, 3).map(s => s.subject));
  });

  const [statusFilter, setStatusFilter] = useState<QuestionStatusFilter>('all');
  const [mode, setMode] = useState<TestMode>('tutored');
  const [order, setOrder] = useState<QuestionOrder>('random');
  const [questionCount, setQuestionCount] = useState<number>(40);
  const [pacerEnabled, setPacerEnabled] = useState<boolean>(true);
  const [pacerSeconds, setPacerSeconds] = useState<number>(72);

  // Toggle Subject
  const toggleSubject = (subject: string, allSystems: string[]) => {
    setSelectedHierarchy(prev => {
      const current = prev[subject] || new Set();
      const updated = { ...prev };
      if (current.size === allSystems.length) {
        // Se todos selecionados, remove todos
        delete updated[subject];
      } else {
        // Senão seleciona todos
        updated[subject] = new Set(allSystems);
      }
      return updated;
    });
  };

  // Toggle System
  const toggleSystem = (subject: string, system: string) => {
    setSelectedHierarchy(prev => {
      const current = new Set(prev[subject] || []);
      if (current.has(system)) {
        current.delete(system);
      } else {
        current.add(system);
      }
      const updated = { ...prev };
      if (current.size === 0) {
        delete updated[subject];
      } else {
        updated[subject] = current;
      }
      return updated;
    });
  };

  const selectAll = () => {
    const all: Record<string, Set<string>> = {};
    subjectHierarchy.forEach(item => {
      all[item.subject] = new Set(item.systems.map(s => s.system));
    });
    setSelectedHierarchy(all);
  };

  const deselectAll = () => {
    setSelectedHierarchy({});
  };

  const toggleExpand = (sub: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(sub)) next.delete(sub);
      else next.add(sub);
      return next;
    });
  };

  // Filtragem das questões disponíveis de acordo com os critérios
  const eligibleQuestions = useMemo(() => {
    return bankQuestions.filter(q => {
      const sub = q.subject?.trim() || 'Geral';
      const sys = q.system?.trim() || 'Outros';

      // 1. Hierarquia Subject & System
      const systemsInSub = selectedHierarchy[sub];
      if (!systemsInSub || !systemsInSub.has(sys)) {
        return false;
      }

      // 2. Status
      const qStatus = q.status || 'unused';
      if (statusFilter === 'unused') return qStatus === 'unused';
      if (statusFilter === 'used') return qStatus === 'correct' || qStatus === 'incorrect';
      if (statusFilter === 'incorrect') return qStatus === 'incorrect';
      if (statusFilter === 'correct') return qStatus === 'correct';

      return true; // 'all'
    });
  }, [bankQuestions, selectedHierarchy, statusFilter]);

  // Contadores por status para os botões de filtro
  const statusCounts = useMemo(() => {
    const counts = { all: 0, unused: 0, used: 0, incorrect: 0, correct: 0 };
    bankQuestions.forEach(q => {
      const sub = q.subject?.trim() || 'Geral';
      const sys = q.system?.trim() || 'Outros';
      const systemsInSub = selectedHierarchy[sub];
      if (!systemsInSub || !systemsInSub.has(sys)) return;

      counts.all++;
      const s = q.status || 'unused';
      if (s === 'unused') counts.unused++;
      else if (s === 'correct') {
        counts.used++;
        counts.correct++;
      } else if (s === 'incorrect') {
        counts.used++;
        counts.incorrect++;
      }
    });
    return counts;
  }, [bankQuestions, selectedHierarchy]);

  const handleStart = () => {
    if (eligibleQuestions.length === 0) return;

    let selected = [...eligibleQuestions];
    if (order === 'random') {
      selected = selected.sort(() => Math.random() - 0.5);
    } else {
      selected = selected.sort((a, b) => (Number(a.qid) || 0) - (Number(b.qid) || 0));
    }

    const countToTake = Math.min(questionCount, selected.length);
    const finalIds = selected.slice(0, countToTake).map(q => q.id);

    onStartSession({
      bankId: bank.id,
      selectedQuestionIds: finalIds,
      mode,
      order,
      pacerEnabled,
      pacerTargetSeconds: pacerSeconds,
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
        <button
          onClick={onBackToBanks}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Voltar para Bancos</span>
        </button>
        <div className="text-right">
          <span className="text-xs font-medium text-gray-400">Banco Selecionado:</span>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{bank?.name}</h2>
        </div>
      </div>

      {bankQuestions.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs space-y-3">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Este banco ainda não possui questões</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Navegue pelas questões do seu Q-Bank com a extensão USMLE ativa para que as questões sejam importadas automaticamente para este repositório!
          </p>
          <button
            onClick={onBackToBanks}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500"
          >
            Voltar aos Bancos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna Esquerda: Hierarquia de Matérias (Subject) e Sistemas (System) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <span>1. Matérias e Sistemas (Subject & System)</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Selecione os temas desejados para a sessão de estudo.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={selectAll}
                    className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                  >
                    Marcar Todos
                  </button>
                  <span className="text-gray-300 dark:text-gray-700">•</span>
                  <button
                    onClick={deselectAll}
                    className="text-gray-500 font-semibold hover:underline"
                  >
                    Desmarcar
                  </button>
                </div>
              </div>

              {/* Lista Hierárquica */}
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {subjectHierarchy.map(subItem => {
                  const allSystemsList = subItem.systems.map(s => s.system);
                  const selectedSystemsInSub = selectedHierarchy[subItem.subject] || new Set();
                  const isAllSelected = selectedSystemsInSub.size === allSystemsList.length;
                  const isPartiallySelected = selectedSystemsInSub.size > 0 && !isAllSelected;
                  const isExpanded = expandedSubjects.has(subItem.subject);

                  return (
                    <div
                      key={subItem.subject}
                      className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-gray-800/20"
                    >
                      {/* Linha Pai: Subject */}
                      <div className="px-3.5 py-2.5 flex items-center justify-between bg-white dark:bg-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => toggleSubject(subItem.subject, allSystemsList)}
                            className="text-blue-600 dark:text-blue-400 focus:outline-none"
                          >
                            {isAllSelected ? (
                              <CheckSquare className="w-4 h-4 fill-blue-600 text-white" />
                            ) : isPartiallySelected ? (
                              <div className="w-4 h-4 rounded-xs border-2 border-blue-600 bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center">
                                <div className="w-2 h-0.5 bg-blue-600 dark:bg-blue-300" />
                              </div>
                            ) : (
                              <Square className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                          <span
                            onClick={() => toggleExpand(subItem.subject)}
                            className="text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer select-none"
                          >
                            {subItem.subject}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-gray-400">
                            {selectedSystemsInSub.size}/{allSystemsList.length} sistemas ({subItem.total} q)
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleExpand(subItem.subject)}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Linhas Filhas: Systems */}
                      {isExpanded && (
                        <div className="p-3 pl-8 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-gray-100 dark:border-gray-800/80 bg-gray-50/80 dark:bg-gray-900/40">
                          {subItem.systems.map(sysItem => {
                            const isChecked = selectedSystemsInSub.has(sysItem.system);
                            return (
                              <label
                                key={sysItem.system}
                                className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/60 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors text-xs"
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleSystem(subItem.subject, sysItem.system)}
                                    className="rounded-sm text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                  />
                                  <span className="truncate text-gray-700 dark:text-gray-300 font-medium">
                                    {sysItem.system}
                                  </span>
                                </div>
                                <span className="font-mono text-[10px] text-gray-400 font-bold shrink-0 ml-1">
                                  {sysItem.count}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Filtro de Status, Modo, Quantidade e Pacer */}
          <div className="lg:col-span-5 space-y-4">
            {/* Status Filter */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>2. Status das Questões</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                    statusFilter === 'all'
                      ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs'
                      : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span>Todas</span>
                  <span className="font-mono font-bold text-[11px]">{statusCounts.all}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('unused')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                    statusFilter === 'unused'
                      ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs'
                      : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span>Não feitas</span>
                  <span className="font-mono font-bold text-[11px]">{statusCounts.unused}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('used')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                    statusFilter === 'used'
                      ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs'
                      : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span>Feitas</span>
                  <span className="font-mono font-bold text-[11px]">{statusCounts.used}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('incorrect')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                    statusFilter === 'incorrect'
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-700 dark:text-rose-300 shadow-xs'
                      : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span>Erradas</span>
                  <span className="font-mono font-bold text-[11px] text-rose-600 dark:text-rose-400">{statusCounts.incorrect}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('correct')}
                  className={`col-span-2 p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                    statusFilter === 'correct'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span>Certas / Acertos</span>
                  <span className="font-mono font-bold text-[11px] text-emerald-600 dark:text-emerald-400">{statusCounts.correct}</span>
                </button>
              </div>
            </div>

            {/* Configurações da Sessão */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>3. Modo e Quantidade</span>
              </h3>

              {/* Modo: Tutored vs Timed */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Modo de Resolução
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('tutored')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      mode === 'tutored'
                        ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-500 shadow-xs'
                        : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="text-xs font-bold text-gray-900 dark:text-white">Tutored</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">
                      Gabarito e explicação imediata após cada envio
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('timed')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      mode === 'timed'
                        ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-500 shadow-xs'
                        : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="text-xs font-bold text-gray-900 dark:text-white">Timed</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">
                      Cronômetro de exame e revisão ao finalizar
                    </div>
                  </button>
                </div>
              </div>

              {/* Ordem: Sequencial vs Randômico */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Ordem das Questões
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrder('random')}
                    className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      order === 'random'
                        ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-500 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Randômico</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrder('sequential')}
                    className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      order === 'sequential'
                        ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-500 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                    <span>Sequencial</span>
                  </button>
                </div>
              </div>

              {/* Quantidade */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  <span>Quantidade de Questões</span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono font-bold">
                    Máx: {eligibleQuestions.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, eligibleQuestions.length)}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Math.max(1, Math.min(eligibleQuestions.length, Number(e.target.value) || 1)))}
                    className="w-24 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-center font-bold font-mono text-sm"
                  />
                  <div className="flex items-center gap-1 flex-1">
                    {[10, 20, 40].map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setQuestionCount(Math.min(cnt, eligibleQuestions.length))}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                          questionCount === cnt
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setQuestionCount(eligibleQuestions.length)}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      title="Selecionar todas as questões elegíveis"
                    >
                      Max
                    </button>
                  </div>
                </div>
              </div>

              {/* Pacer Integrado */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pacerEnabled}
                      onChange={(e) => setPacerEnabled(e.target.checked)}
                      className="rounded-sm text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-rose-500" />
                        <span>Question Pacer Integrado</span>
                      </div>
                      <div className="text-[10px] text-gray-500">Ritmo de tempo por questão</div>
                    </div>
                  </label>

                  {pacerEnabled && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={30}
                        max={300}
                        value={pacerSeconds}
                        onChange={(e) => setPacerSeconds(Number(e.target.value) || 72)}
                        className="w-16 px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono font-bold text-center"
                      />
                      <span className="text-[11px] text-gray-400 font-bold">s/q</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Launch Banner */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-100">Questões Disponíveis:</span>
                <span className="text-xl font-extrabold font-mono">{eligibleQuestions.length}</span>
              </div>
              <p className="text-xs text-blue-100/90 leading-relaxed">
                Você irá iniciar um bloco de{' '}
                <b className="text-white underline">{Math.min(questionCount, eligibleQuestions.length)} questões</b> no modo{' '}
                <b className="text-white capitalize">{mode}</b>.
              </p>
              <button
                type="button"
                onClick={handleStart}
                disabled={eligibleQuestions.length === 0}
                className="w-full py-3 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-blue-700" />
                <span>Iniciar Teste</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
