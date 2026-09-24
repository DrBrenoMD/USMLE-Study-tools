import React, { useState } from 'react';
import { useStore, QuestionBank } from '../../store/useStore';
import {
  BookOpen,
  Plus,
  Play,
  RotateCcw,
  Trash2,
  BarChart3,
  Clock,
  Layers,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
  Settings,
  Sparkles,
  ArrowRight,
  Database
} from 'lucide-react';

interface BankSelectionViewProps {
  onSelectBank: (bankId: string) => void;
  onOpenStats: (bankId: string) => void;
  onOpenRepository: (bankId: string) => void;
}

export const BankSelectionView: React.FC<BankSelectionViewProps> = ({
  onSelectBank,
  onOpenStats,
  onOpenRepository,
}) => {
  const { questionBanks, questions, createQuestionBank, deleteQuestionBank, resetBankStats } = useStore();
  const [isCreating, setIsCreating] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankDesc, setBankDesc] = useState('');
  const [search, setSearch] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim()) return;
    const newId = createQuestionBank(bankName.trim(), bankDesc.trim());
    setBankName('');
    setBankDesc('');
    setIsCreating(false);
    onSelectBank(newId);
  };

  const getBankStats = (bankId: string) => {
    const bankQuestions = questions.filter(q => q.bankId === bankId);
    const total = bankQuestions.length;
    const used = bankQuestions.filter(q => q.status === 'correct' || q.status === 'incorrect').length;
    const correct = bankQuestions.filter(q => q.status === 'correct').length;
    const incorrect = bankQuestions.filter(q => q.status === 'incorrect').length;
    const unused = total - used;
    const accuracy = used > 0 ? Math.round((correct / used) * 100) : 0;

    let totalResTime = 0;
    let resCount = 0;
    bankQuestions.forEach(q => {
      if (q.resolutionTimeSeconds && q.resolutionTimeSeconds > 0) {
        totalResTime += q.resolutionTimeSeconds;
        resCount++;
      }
    });
    const avgResTime = resCount > 0 ? Math.round(totalResTime / resCount) : 0;

    // Subjects and Systems
    const subjects = new Set<string>();
    const systems = new Set<string>();
    bankQuestions.forEach(q => {
      if (q.subject) subjects.add(q.subject);
      if (q.system) systems.add(q.system);
    });

    return {
      total,
      used,
      correct,
      incorrect,
      unused,
      accuracy,
      avgResTime,
      subjectsCount: subjects.size,
      systemsCount: systems.size,
    };
  };

  const filteredBanks = questionBanks.filter(b => 
    b.name.toLowerCase().includes(search.toLowerCase()) || 
    (b.description && b.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-2 border border-blue-200 dark:border-blue-800/50">
            <Database className="w-3.5 h-3.5" />
            <span>Repositório de Questões Sincronizado</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Bancos de Questões (QBanks)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
            Escolha qual banco de questões deseja praticar ou analisar. Todas as questões visualizadas na extensão são importadas e organizadas por Matéria e Sistema.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Novo Banco</span>
          </button>
        </div>
      </div>

      {/* Modal de Criação */}
      {isCreating && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-6 shadow-xl space-y-4 animate-scale-up">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              Novo Banco de Questões
            </h3>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-bold"
            >
              Cancelar
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Nome do Banco *
              </label>
              <input
                type="text"
                placeholder="Ex: UWorld Step 1, Amboss Step 2 CK, QBankly..."
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Descrição ou Observações (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Questões para primeiro passe de estudo geral..."
                value={bankDesc}
                onChange={(e) => setBankDesc(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              Salvar Banco
            </button>
          </div>
        </form>
      )}

      {/* Search and Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar banco de questões..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-gray-500 font-semibold">
          {questionBanks.length} {questionBanks.length === 1 ? 'banco configurado' : 'bancos configurados'}
        </div>
      </div>

      {/* Grid de Bancos */}
      {filteredBanks.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs">
          <Database className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Nenhum banco encontrado</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            Crie seu primeiro banco ou conecte a extensão do Chrome para começar a importar questões automaticamente.
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 transition-colors"
          >
            + Criar Banco
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBanks.map((bank) => {
            const stats = getBankStats(bank.id);

            return (
              <div
                key={bank.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800/80 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onOpenStats(bank.id)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="Ver Estatísticas Detalhadas"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Resetar todas as estatísticas do banco "${bank.name}"? As questões voltarão para o status "Não feitas", mas nenhum conteúdo será apagado.`)) {
                            resetBankStats(bank.id);
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="Resetar Histórico e Estatísticas deste Banco"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      {questionBanks.length > 1 && (
                        <button
                          onClick={() => {
                            if (confirm(`Excluir permanentemente o banco "${bank.name}" e todas as suas ${stats.total} questões?`)) {
                              deleteQuestionBank(bank.id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          title="Excluir Banco"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {bank.name}
                  </h3>
                  {bank.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {bank.description}
                    </p>
                  )}

                  {/* Barra de Progresso */}
                  <div className="mt-5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-400 font-medium">Progresso</span>
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        {stats.used} / {stats.total} questões
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full transition-all"
                        style={{ width: `${stats.total > 0 ? (stats.correct / stats.total) * 100 : 0}%` }}
                        title={`Corretas: ${stats.correct}`}
                      />
                      <div
                        className="bg-rose-500 h-full transition-all"
                        style={{ width: `${stats.total > 0 ? (stats.incorrect / stats.total) * 100 : 0}%` }}
                        title={`Erradas: ${stats.incorrect}`}
                      />
                    </div>
                  </div>

                  {/* Cards de Métricas */}
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Acertos</div>
                      <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                        {stats.used > 0 ? `${stats.accuracy}%` : '--'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Tempo Médio</div>
                      <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                        {stats.avgResTime > 0 ? `${stats.avgResTime}s` : '--'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Não Feitas</div>
                      <div className="text-sm font-extrabold text-gray-700 dark:text-gray-300">
                        {stats.unused}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 text-[11px] text-gray-400">
                    <span>{stats.subjectsCount} matérias</span>
                    <span>•</span>
                    <span>{stats.systemsCount} sistemas</span>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="pt-6 border-t border-gray-100 dark:border-gray-800 mt-5 flex flex-col gap-2">
                  <button
                    onClick={() => onSelectBank(bank.id)}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 group/btn cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Iniciar Sessão / Criar Teste</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onOpenRepository(bank.id)}
                      className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Layers className="w-3 h-3" />
                      <span>Ver Questões</span>
                    </button>
                    <button
                      onClick={() => onOpenStats(bank.id)}
                      className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <BarChart3 className="w-3 h-3" />
                      <span>Estatísticas</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
