import React, { useState, useMemo } from 'react';
import { useStore, Question } from '../../store/useStore';
import {
  ChevronLeft,
  RotateCcw,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
  ChevronDown,
  ChevronRight,
  Layers,
  BookOpen,
  Filter,
  Eye
} from 'lucide-react';

interface QuestionStatsViewProps {
  bankId: string;
  onBackToBanks: () => void;
  onPracticeQuestion?: (questionId: string) => void;
}

export const QuestionStatsView: React.FC<QuestionStatsViewProps> = ({
  bankId,
  onBackToBanks,
  onPracticeQuestion,
}) => {
  const { questionBanks, questions, resetQuestionStats, resetBankStats, cards } = useStore();
  const bank = questionBanks.find(b => b.id === bankId) || questionBanks[0];

  const bankQuestions = useMemo(() => {
    return questions.filter(q => q.bankId === bank?.id);
  }, [questions, bank]);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

  // Métricas Globais
  const globalStats = useMemo(() => {
    const total = bankQuestions.length;
    const correct = bankQuestions.filter(q => q.status === 'correct').length;
    const incorrect = bankQuestions.filter(q => q.status === 'incorrect').length;
    const used = correct + incorrect;
    const unused = total - used;
    const accuracy = used > 0 ? Math.round((correct / used) * 100) : 0;

    let totalResTime = 0;
    let resCount = 0;
    let totalRevTime = 0;
    let revCount = 0;

    bankQuestions.forEach(q => {
      if (q.resolutionTimeSeconds && q.resolutionTimeSeconds > 0) {
        totalResTime += q.resolutionTimeSeconds;
        resCount++;
      }
      if (q.reviewTimeSeconds && q.reviewTimeSeconds > 0) {
        totalRevTime += q.reviewTimeSeconds;
        revCount++;
      }
    });

    const avgResTime = resCount > 0 ? Math.round(totalResTime / resCount) : 0;
    const avgRevTime = revCount > 0 ? Math.round(totalRevTime / revCount) : 0;

    return { total, correct, incorrect, used, unused, accuracy, avgResTime, avgRevTime };
  }, [bankQuestions]);

  // Agrupamento por Subject e System
  const subjectBreakdown = useMemo(() => {
    const map = new Map<string, {
      total: number;
      correct: number;
      incorrect: number;
      resTimeSum: number;
      resTimeCount: number;
      revTimeSum: number;
      revTimeCount: number;
      systems: Map<string, {
        total: number;
        correct: number;
        incorrect: number;
        resTimeSum: number;
        resTimeCount: number;
        revTimeSum: number;
        revTimeCount: number;
      }>;
    }>();

    bankQuestions.forEach(q => {
      const sub = q.subject?.trim() || 'Geral';
      const sys = q.system?.trim() || 'Outros';

      if (!map.has(sub)) {
        map.set(sub, {
          total: 0,
          correct: 0,
          incorrect: 0,
          resTimeSum: 0,
          resTimeCount: 0,
          revTimeSum: 0,
          revTimeCount: 0,
          systems: new Map(),
        });
      }
      const sData = map.get(sub)!;
      sData.total++;
      if (q.status === 'correct') sData.correct++;
      if (q.status === 'incorrect') sData.incorrect++;
      if (q.resolutionTimeSeconds) {
        sData.resTimeSum += q.resolutionTimeSeconds;
        sData.resTimeCount++;
      }
      if (q.reviewTimeSeconds) {
        sData.revTimeSum += q.reviewTimeSeconds;
        sData.revTimeCount++;
      }

      if (!sData.systems.has(sys)) {
        sData.systems.set(sys, {
          total: 0,
          correct: 0,
          incorrect: 0,
          resTimeSum: 0,
          resTimeCount: 0,
          revTimeSum: 0,
          revTimeCount: 0,
        });
      }
      const sysData = sData.systems.get(sys)!;
      sysData.total++;
      if (q.status === 'correct') sysData.correct++;
      if (q.status === 'incorrect') sysData.incorrect++;
      if (q.resolutionTimeSeconds) {
        sysData.resTimeSum += q.resolutionTimeSeconds;
        sysData.resTimeCount++;
      }
      if (q.reviewTimeSeconds) {
        sysData.revTimeSum += q.reviewTimeSeconds;
        sysData.revTimeCount++;
      }
    });

    return Array.from(map.entries()).map(([subject, data]) => {
      const used = data.correct + data.incorrect;
      const accuracy = used > 0 ? Math.round((data.correct / used) * 100) : 0;
      const avgRes = data.resTimeCount > 0 ? Math.round(data.resTimeSum / data.resTimeCount) : 0;
      const avgRev = data.revTimeCount > 0 ? Math.round(data.revTimeSum / data.revTimeCount) : 0;

      const systemsList = Array.from(data.systems.entries()).map(([system, sysData]) => {
        const sysUsed = sysData.correct + sysData.incorrect;
        const sysAccuracy = sysUsed > 0 ? Math.round((sysData.correct / sysUsed) * 100) : 0;
        const sysAvgRes = sysData.resTimeCount > 0 ? Math.round(sysData.resTimeSum / sysData.resTimeCount) : 0;
        const sysAvgRev = sysData.revTimeCount > 0 ? Math.round(sysData.revTimeSum / sysData.revTimeCount) : 0;

        return {
          system,
          total: sysData.total,
          correct: sysData.correct,
          incorrect: sysData.incorrect,
          used: sysUsed,
          accuracy: sysAccuracy,
          avgRes,
          avgRev,
        };
      }).sort((a, b) => b.total - a.total);

      return {
        subject,
        total: data.total,
        correct: data.correct,
        incorrect: data.incorrect,
        used,
        accuracy,
        avgRes,
        avgRev,
        systems: systemsList,
      };
    }).sort((a, b) => b.total - a.total);
  }, [bankQuestions]);

  const toggleSubject = (sub: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(sub)) next.delete(sub);
      else next.add(sub);
      return next;
    });
  };

  // Filtragem de questões para a tabela detalhada
  const filteredQuestions = useMemo(() => {
    return bankQuestions.filter(q => {
      const matchesSearch =
        q.qid?.toLowerCase().includes(search.toLowerCase()) ||
        q.text?.toLowerCase().includes(search.toLowerCase()) ||
        q.subject?.toLowerCase().includes(search.toLowerCase()) ||
        q.system?.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (filterStatus === 'correct') return q.status === 'correct';
      if (filterStatus === 'incorrect') return q.status === 'incorrect';
      if (filterStatus === 'unused') return !q.status || q.status === 'unused';

      return true;
    });
  }, [bankQuestions, search, filterStatus]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToBanks}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                Estatísticas & Análise de Desempenho
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                {bank?.name}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Acompanhamento de acertos, tempos médios de resolução e revisão por Matéria e Sistema.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (confirm(`Deseja resetar todas as estatísticas do banco "${bank?.name}"? Todas as questões voltarão ao status "Não Feitas", mantendo as questões intactas.`)) {
              resetBankStats(bank.id);
            }
          }}
          className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-800 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Resetar Estatísticas do Banco</span>
        </button>
      </div>

      {/* Cards de Métricas Globais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Taxa de Acertos</div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {globalStats.used > 0 ? `${globalStats.accuracy}%` : '--'}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {globalStats.correct} certas / {globalStats.used} resolvidas
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tempo Médio / Questão</div>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-mono mt-1">
            {globalStats.avgResTime > 0 ? `${globalStats.avgResTime}s` : '--'}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Revisão média: {globalStats.avgRevTime > 0 ? `${globalStats.avgRevTime}s` : '--'}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Questões Realizadas</div>
          <div className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">
            {globalStats.used} / {globalStats.total}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {globalStats.unused} questões não feitas
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Erradas (Para Refazer)</div>
          <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
            {globalStats.incorrect}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {globalStats.total > 0 ? `${Math.round((globalStats.incorrect / globalStats.total) * 100)}% do banco` : '0%'}
          </div>
        </div>
      </div>

      {/* Tabela de Desempenho por Subject e System */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <span>Desempenho por Matéria (Subject) & Sistema (System)</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Clique em uma matéria para expandir o detalhamento dos sistemas.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3">Matéria / Sistema</th>
                <th className="py-2.5 px-3 text-center">Total</th>
                <th className="py-2.5 px-3 text-center">Feitas</th>
                <th className="py-2.5 px-3 text-center">Acertos (%)</th>
                <th className="py-2.5 px-3 text-center">Tempo Res.</th>
                <th className="py-2.5 px-3 text-center">Tempo Rev.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {subjectBreakdown.map(subItem => {
                const isExpanded = expandedSubjects.has(subItem.subject);

                return (
                  <React.Fragment key={subItem.subject}>
                    <tr
                      onClick={() => toggleSubject(subItem.subject)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer font-semibold transition-colors"
                    >
                      <td className="py-3 px-3 flex items-center gap-2 text-gray-900 dark:text-white">
                        <span className="p-0.5 text-gray-400">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </span>
                        <span className="text-sm font-bold">{subItem.subject}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">{subItem.total}</td>
                      <td className="py-3 px-3 text-center font-mono">{subItem.used}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`font-bold font-mono ${
                          subItem.accuracy >= 70 ? 'text-emerald-600 dark:text-emerald-400' : subItem.accuracy > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'
                        }`}>
                          {subItem.used > 0 ? `${subItem.accuracy}%` : '--'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-gray-600 dark:text-gray-300">
                        {subItem.avgRes > 0 ? `${subItem.avgRes}s` : '--'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-gray-600 dark:text-gray-300">
                        {subItem.avgRev > 0 ? `${subItem.avgRev}s` : '--'}
                      </td>
                    </tr>

                    {/* Sistemas Filhos */}
                    {isExpanded && subItem.systems.map(sys => (
                      <tr
                        key={sys.system}
                        className="bg-gray-50/60 dark:bg-gray-800/30 text-gray-700 dark:text-gray-300 text-xs"
                      >
                        <td className="py-2 px-3 pl-10 text-gray-600 dark:text-gray-400">
                          • {sys.system}
                        </td>
                        <td className="py-2 px-3 text-center font-mono">{sys.total}</td>
                        <td className="py-2 px-3 text-center font-mono">{sys.used}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold">
                          {sys.used > 0 ? (
                            <span className={sys.accuracy >= 70 ? 'text-emerald-600' : 'text-amber-600'}>
                              {sys.accuracy}%
                            </span>
                          ) : '--'}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-gray-500">
                          {sys.avgRes > 0 ? `${sys.avgRes}s` : '--'}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-gray-500">
                          {sys.avgRev > 0 ? `${sys.avgRev}s` : '--'}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela Individual de Questões com Busca e Reset */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>Repositório de Questões ({filteredQuestions.length})</span>
            </h3>
            <p className="text-xs text-gray-500">
              Gerencie cada questão individualmente e resete o status se desejar refazê-la.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por QID ou termo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold"
            >
              <option value="all">Todos os Status</option>
              <option value="correct">Certas</option>
              <option value="incorrect">Erradas</option>
              <option value="unused">Não Feitas</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-gray-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">QID</th>
                <th className="py-2.5 px-3">Enunciado</th>
                <th className="py-2.5 px-3">Subject / System</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Tempo Res.</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredQuestions.map(q => {
                const hasCards = cards.some(c => c.questionId === q.qid || (c.tags && c.tags.includes('qid:' + q.qid)));

                return (
                  <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      #{q.qid}
                    </td>
                    <td className="py-2.5 px-3 max-w-xs truncate text-gray-800 dark:text-gray-200">
                      {q.stem || q.text}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500">
                      <div>{q.subject || 'Geral'}</div>
                      <div className="text-[10px] text-gray-400">{q.system}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {q.status === 'correct' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Certa</span>
                        </span>
                      ) : q.status === 'incorrect' ? (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Errada</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">Não feita</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {q.resolutionTimeSeconds ? `${q.resolutionTimeSeconds}s` : '--'}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                      {(q.status === 'correct' || q.status === 'incorrect') && (
                        <button
                          onClick={() => resetQuestionStats(q.id)}
                          className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 text-[10px] font-bold"
                          title="Resetar status desta questão"
                        >
                          Resetar
                        </button>
                      )}
                      {hasCards && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          Card ✓
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
