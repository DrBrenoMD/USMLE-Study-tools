import React, { useMemo, useState } from 'react';
import { useStore, StudyDeskQuestionRecord } from '../cardblocks/store/useStore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import {
  Layers,
  Award,
  AlertTriangle,
  Clock,
  BookOpen,
  Filter,
  CheckCircle2,
  TrendingUp,
  Activity,
  ChevronRight,
  Flame,
  Table,
  BarChart3,
  Stethoscope,
  HelpCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SystemPerformance {
  systemName: string;
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  avgSolveTime: number;
  avgRevTime: number;
}

interface SubjectPerformanceData {
  subjectName: string;
  total: number;
  correct: number;
  accuracy: number;
  avgSolveTime: number;
  avgRevTime: number;
  systems: SystemPerformance[];
}

export function SubjectSystemsBreakdown() {
  const { questions, studyDeskSessions } = useStore();
  const [selectedSubject, setSelectedSubject] = useState<string>('Cardiologia');
  const [selectedMetric, setSelectedMetric] = useState<'accuracy' | 'count' | 'solveTime' | 'reviewTime'>('accuracy');
  const [showMatrixView, setShowMatrixView] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // 1. Processa e agrega todos os registros reais combinados com baseline médico representativo
  const { subjectPerformanceList, allUniqueSystems, allUniqueSubjects, overallStats } = useMemo(() => {
    const records: Array<{
      subject: string;
      system: string;
      isCorrect: boolean;
      solveTime: number;
      revTime: number;
    }> = [];

    // Carrega sessões reais gravadas
    (studyDeskSessions || []).forEach(s => {
      if (s.questionRecords) {
        s.questionRecords.forEach(r => {
          if (r.subject && r.system) {
            records.push({
              subject: r.subject.trim(),
              system: r.system.trim(),
              isCorrect: Boolean(r.isCorrect),
              solveTime: r.resolutionTimeSeconds || 65,
              revTime: r.reviewTimeSeconds || 115,
            });
          }
        });
      }
    });

    // Carrega questões do banco respondidas
    (questions || []).forEach(q => {
      if (q.status && q.status !== 'unused' && q.subject && q.system) {
        records.push({
          subject: q.subject.trim(),
          system: q.system.trim(),
          isCorrect: q.status === 'correct',
          solveTime: q.resolutionTimeSeconds || 65,
          revTime: q.reviewTimeSeconds || 115,
        });
      }
    });

    // Se houver poucos dados ainda, injeta seeds padrão estruturadas por subject e system
    const defaultSeeds = [
      // Cardiologia
      { subject: 'Cardiologia', system: 'Cardiovascular', total: 28, correct: 22, solveTime: 65, revTime: 110 },
      { subject: 'Cardiologia', system: 'Farmacologia Cardiovascular', total: 18, correct: 13, solveTime: 58, revTime: 95 },
      { subject: 'Cardiologia', system: 'Renal & Hemodinâmica', total: 12, correct: 7, solveTime: 72, revTime: 125 },
      { subject: 'Cardiologia', system: 'Fisiologia & Eletrofisiologia', total: 15, correct: 12, solveTime: 62, revTime: 105 },

      // Farmacologia
      { subject: 'Farmacologia', system: 'Cardiovascular', total: 20, correct: 16, solveTime: 55, revTime: 90 },
      { subject: 'Farmacologia', system: 'Sistema Nervoso (SNC)', total: 18, correct: 10, solveTime: 68, revTime: 115 },
      { subject: 'Farmacologia', system: 'Renal & Diuréticos', total: 14, correct: 6, solveTime: 75, revTime: 130 },
      { subject: 'Farmacologia', system: 'Imunológico & Infecto', total: 22, correct: 17, solveTime: 59, revTime: 95 },
      { subject: 'Farmacologia', system: 'Gastrointestinal', total: 12, correct: 10, solveTime: 52, revTime: 85 },
      { subject: 'Farmacologia', system: 'Endócrino', total: 15, correct: 11, solveTime: 60, revTime: 100 },

      // Pneumologia
      { subject: 'Pneumologia', system: 'Respiratório', total: 24, correct: 17, solveTime: 70, revTime: 120 },
      { subject: 'Pneumologia', system: 'Imunológico & Infecto', total: 16, correct: 13, solveTime: 64, revTime: 105 },
      { subject: 'Pneumologia', system: 'Farmacologia Respiratória', total: 12, correct: 9, solveTime: 56, revTime: 92 },
      { subject: 'Pneumologia', system: 'Fisiologia Ventilatória', total: 10, correct: 5, solveTime: 82, revTime: 140 },

      // Gastroenterologia
      { subject: 'Gastroenterologia', system: 'Gastrointestinal', total: 26, correct: 19, solveTime: 66, revTime: 115 },
      { subject: 'Gastroenterologia', system: 'Imunológico & Infecto', total: 15, correct: 12, solveTime: 60, revTime: 100 },
      { subject: 'Gastroenterologia', system: 'Farmacologia TGI', total: 10, correct: 8, solveTime: 54, revTime: 88 },
      { subject: 'Gastroenterologia', system: 'Hepático & Vias Biliares', total: 16, correct: 9, solveTime: 74, revTime: 130 },

      // Infectologia
      { subject: 'Infectologia', system: 'Imunológico & Infecto', total: 30, correct: 23, solveTime: 62, revTime: 105 },
      { subject: 'Infectologia', system: 'Respiratório', total: 14, correct: 11, solveTime: 65, revTime: 110 },
      { subject: 'Infectologia', system: 'Sistema Nervoso (SNC)', total: 12, correct: 7, solveTime: 76, revTime: 135 },
      { subject: 'Infectologia', system: 'Gastrointestinal', total: 10, correct: 8, solveTime: 58, revTime: 95 },

      // Nefrologia
      { subject: 'Nefrologia', system: 'Renal & Urinário', total: 25, correct: 15, solveTime: 78, revTime: 138 },
      { subject: 'Nefrologia', system: 'Cardiovascular & Hipertensão', total: 14, correct: 10, solveTime: 68, revTime: 115 },
      { subject: 'Nefrologia', system: 'Distúrbios Hidroeletrolíticos', total: 16, correct: 8, solveTime: 85, revTime: 145 },
      { subject: 'Nefrologia', system: 'Farmacologia Renal', total: 12, correct: 6, solveTime: 70, revTime: 120 },

      // Pediatria
      { subject: 'Pediatria', system: 'Neonatologia & Puericultura', total: 18, correct: 14, solveTime: 58, revTime: 92 },
      { subject: 'Pediatria', system: 'Doenças Infecciosas Pediátricas', total: 14, correct: 11, solveTime: 60, revTime: 98 },
      { subject: 'Pediatria', system: 'Respiratório & Asma', total: 12, correct: 9, solveTime: 64, revTime: 105 },
      { subject: 'Pediatria', system: 'Genética & Malformações', total: 10, correct: 4, solveTime: 80, revTime: 140 },
    ];

    if (records.length < 20) {
      defaultSeeds.forEach(seed => {
        for (let i = 0; i < seed.total; i++) {
          records.push({
            subject: seed.subject,
            system: seed.system,
            isCorrect: i < seed.correct,
            solveTime: seed.solveTime + (i % 3) * 2,
            revTime: seed.revTime + (i % 4) * 4,
          });
        }
      });
    }

    // Agrupamento por Subject e por System
    const subjectMap = new Map<string, Map<string, { total: number; correct: number; solveSum: number; revSum: number }>>();
    const uniqueSystemsSet = new Set<string>();

    records.forEach(r => {
      uniqueSystemsSet.add(r.system);
      if (!subjectMap.has(r.subject)) {
        subjectMap.set(r.subject, new Map());
      }
      const sysMap = subjectMap.get(r.subject)!;
      const cur = sysMap.get(r.system) || { total: 0, correct: 0, solveSum: 0, revSum: 0 };
      cur.total += 1;
      if (r.isCorrect) cur.correct += 1;
      cur.solveSum += r.solveTime;
      cur.revSum += r.revTime;
      sysMap.set(r.system, cur);
    });

    const subjectList: SubjectPerformanceData[] = Array.from(subjectMap.entries()).map(([subjName, sysMap]) => {
      let subjTotal = 0;
      let subjCorrect = 0;
      let subjSolveSum = 0;
      let subjRevSum = 0;

      const systems: SystemPerformance[] = Array.from(sysMap.entries()).map(([sysName, data]) => {
        subjTotal += data.total;
        subjCorrect += data.correct;
        subjSolveSum += data.solveSum;
        subjRevSum += data.revSum;

        return {
          systemName: sysName,
          total: data.total,
          correct: data.correct,
          incorrect: data.total - data.correct,
          accuracy: Math.round((data.correct / data.total) * 100),
          avgSolveTime: Math.round(data.solveSum / data.total),
          avgRevTime: Math.round(data.revSum / data.total),
        };
      }).sort((a, b) => b.total - a.total);

      return {
        subjectName: subjName,
        total: subjTotal,
        correct: subjCorrect,
        accuracy: subjTotal > 0 ? Math.round((subjCorrect / subjTotal) * 100) : 0,
        avgSolveTime: subjTotal > 0 ? Math.round(subjSolveSum / subjTotal) : 0,
        avgRevTime: subjTotal > 0 ? Math.round(subjRevSum / subjTotal) : 0,
        systems,
      };
    }).sort((a, b) => b.total - a.total);

    const uniqueSubjects = subjectList.map(s => s.subjectName);
    const uniqueSystems = Array.from(uniqueSystemsSet).sort();

    // Encontra sistema mais forte e mais fraco geral
    const allSystemsFlattened = subjectList.flatMap(s => s.systems);
    const sortedByAcc = [...allSystemsFlattened].sort((a, b) => b.accuracy - a.accuracy);
    const bestSystem = sortedByAcc[0];
    const weakestSystem = sortedByAcc[sortedByAcc.length - 1];

    return {
      subjectPerformanceList: subjectList,
      allUniqueSystems: uniqueSystems,
      allUniqueSubjects: uniqueSubjects,
      overallStats: {
        totalSubjects: uniqueSubjects.length,
        totalSystems: uniqueSystems.length,
        totalRecords: records.length,
        bestSystem,
        weakestSystem,
      }
    };
  }, [questions, studyDeskSessions]);

  // Se o subject selecionado não estiver na lista, seleciona o primeiro
  const currentSubjectData = useMemo(() => {
    return subjectPerformanceList.find(s => s.subjectName === selectedSubject) || subjectPerformanceList[0];
  }, [subjectPerformanceList, selectedSubject]);

  const filteredSystems = useMemo(() => {
    if (!currentSubjectData) return [];
    if (!searchFilter.trim()) return currentSubjectData.systems;
    const term = searchFilter.toLowerCase();
    return currentSubjectData.systems.filter(s => s.systemName.toLowerCase().includes(term));
  }, [currentSubjectData, searchFilter]);

  const formatSec = (sec: number) => {
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m === 0) return `${rem}s`;
    return `${m}m ${rem.toString().padStart(2, '0')}s`;
  };

  const getSystemIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('cardio') || lower.includes('hemodin')) return '❤️';
    if (lower.includes('resp') || lower.includes('ventil')) return '🫁';
    if (lower.includes('gastro') || lower.includes('tgi') || lower.includes('hepát')) return '🩺';
    if (lower.includes('renal') || lower.includes('hidroelet') || lower.includes('urin')) return '🧪';
    if (lower.includes('infect') || lower.includes('imun')) return '🦠';
    if (lower.includes('nervos') || lower.includes('snc') || lower.includes('neuro')) return '🧠';
    if (lower.includes('farmac')) return '💊';
    if (lower.includes('neonat') || lower.includes('pediat')) return '👶';
    if (lower.includes('endócr') || lower.includes('diabet')) return '🧬';
    return '🔬';
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs mt-6 flex flex-col gap-6">
      {/* Header da Seção */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Desempenho dos Sistemas dentro dos Subjects</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                  Matriz Cruzada
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Avalie o rendimento detalhado de cada Sistema orgânico dentro de cada Matéria/Subject. Identifique lacunas e prioridades de revisão.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle Matrix / Chart View */}
          <button
            type="button"
            onClick={() => setShowMatrixView(!showMatrixView)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border",
              showMatrixView
                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200"
            )}
          >
            {showMatrixView ? <BarChart3 className="w-3.5 h-3.5" /> : <Table className="w-3.5 h-3.5 text-purple-600" />}
            <span>{showMatrixView ? 'Ver Gráficos do Subject' : 'Matriz Completa (Todos Subjects)'}</span>
          </button>

          {/* Metric Selector */}
          {!showMatrixView && (
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="text-xs bg-gray-100 dark:bg-gray-800 border-none rounded-xl px-3 py-1.5 font-bold text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="accuracy">🎯 Taxa de Acertos (%)</option>
              <option value="count">📊 Volume de Questões</option>
              <option value="solveTime">⏱️ Tempo de Resolução</option>
              <option value="reviewTime">📖 Tempo de Revisão</option>
            </select>
          )}
        </div>
      </div>

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
          <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 block mb-0.5">Matérias Mapeadas</span>
          <div className="text-xl sm:text-2xl font-extrabold text-purple-950 dark:text-purple-100">
            {overallStats.totalSubjects} Subjects
          </div>
          <span className="text-[10px] text-gray-500">{overallStats.totalSystems} Sistemas avaliados</span>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">Maior Aproveitamento</span>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-950 dark:text-emerald-100 truncate">
            {overallStats.bestSystem ? `${overallStats.bestSystem.accuracy}%` : '85%'}
          </div>
          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold truncate block">
            {overallStats.bestSystem?.systemName || 'Gastrointestinal'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 block mb-0.5">Ponto Crítico Prioritário</span>
          <div className="text-xl sm:text-2xl font-extrabold text-rose-950 dark:text-rose-100 truncate">
            {overallStats.weakestSystem ? `${overallStats.weakestSystem.accuracy}%` : '42%'}
          </div>
          <span className="text-[10px] text-rose-700 dark:text-rose-400 font-semibold truncate block">
            {overallStats.weakestSystem?.systemName || 'Renal & Diuréticos'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 block mb-0.5">Meta USMLE Recomendada</span>
          <div className="text-xl sm:text-2xl font-extrabold text-blue-950 dark:text-blue-100">
            ≥ 70%
          </div>
          <span className="text-[10px] text-gray-500">Linha de corte de segurança</span>
        </div>
      </div>

      {/* MODO 1: GRÁFICOS E CARDS POR SUBJECT SELECIONADO */}
      {!showMatrixView ? (
        <div className="space-y-6">
          {/* Seletor de Subjects em formato de Carrossel de Pílulas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Selecione o Subject para ver seus Sistemas:
              </span>
              <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold">
                {currentSubjectData?.systems.length || 0} Sistemas neste Subject
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {subjectPerformanceList.map(subj => {
                const isSelected = subj.subjectName === selectedSubject;
                return (
                  <button
                    key={subj.subjectName}
                    type="button"
                    onClick={() => setSelectedSubject(subj.subjectName)}
                    className={cn(
                      "px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 cursor-pointer border",
                      isSelected
                        ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/25 scale-[1.02]"
                        : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <span>{getSystemIcon(subj.subjectName)}</span>
                    <span>{subj.subjectName}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[10px] font-black",
                      isSelected
                        ? "bg-white/20 text-white"
                        : subj.accuracy >= 70 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : subj.accuracy >= 50 ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    )}>
                      {subj.accuracy}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Gráfico de Barras dos Sistemas no Subject Selecionado */}
          <div className="p-4 rounded-2xl bg-gray-50/70 dark:bg-gray-850/60 border border-gray-200/80 dark:border-gray-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>{getSystemIcon(selectedSubject)}</span>
                <span>Sistemas dentro de <b>{selectedSubject}</b></span>
                <span className="text-xs font-normal text-gray-500">
                  ({selectedMetric === 'accuracy' ? 'Taxa de Acertos %' : selectedMetric === 'count' ? 'Volume de Questões' : selectedMetric === 'solveTime' ? 'Tempo de Resolução' : 'Tempo de Revisão'})
                </span>
              </h3>

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> ≥ 70% Domínio Forte
                </span>
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 50-69% Atenção
                </span>
                <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> &lt; 50% Crítico
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredSystems}
                  margin={{ top: 15, right: 10, left: -20, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="systemName" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    domain={selectedMetric === 'accuracy' ? [0, 100] : [0, 'auto']}
                  />
                  {selectedMetric === 'accuracy' && (
                    <ReferenceLine
                      y={70}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{ value: 'Meta: 70%', position: 'right', fill: '#10b981', fontSize: 10 }}
                    />
                  )}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      color: '#fff',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px'
                    }}
                    formatter={(val: any) => {
                      if (selectedMetric === 'accuracy') return [`${val}%`, 'Taxa de Acertos'];
                      if (selectedMetric === 'solveTime') return [`${formatSec(Number(val))}`, 'Tempo Resolução'];
                      if (selectedMetric === 'reviewTime') return [`${formatSec(Number(val))}`, 'Tempo Revisão'];
                      return [`${val} questões`, 'Total de Questões'];
                    }}
                  />
                  <Bar
                    dataKey={
                      selectedMetric === 'accuracy' ? 'accuracy' :
                      selectedMetric === 'solveTime' ? 'avgSolveTime' :
                      selectedMetric === 'reviewTime' ? 'avgRevTime' : 'total'
                    }
                    radius={[6, 6, 0, 0]}
                  >
                    {filteredSystems.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          selectedMetric === 'accuracy'
                            ? entry.accuracy >= 70 ? '#10b981' : entry.accuracy >= 50 ? '#f59e0b' : '#ef4444'
                            : '#8b5cf6'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cards Detalhados dos Sistemas com Recomendações Clínicas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Diagnóstico de Cada Sistema em {selectedSubject}:
              </h4>
              <span className="text-xs text-gray-400">
                Total do Subject: <b>{currentSubjectData?.correct}/{currentSubjectData?.total} acertos ({currentSubjectData?.accuracy}%)</b>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredSystems.map((sys) => {
                const isStrong = sys.accuracy >= 70;
                const isMedium = sys.accuracy >= 50 && sys.accuracy < 70;
                const isCritical = sys.accuracy < 50;

                return (
                  <div
                    key={sys.systemName}
                    className={cn(
                      "p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 bg-white dark:bg-gray-850",
                      isStrong
                        ? "border-emerald-200/80 dark:border-emerald-900/50 hover:border-emerald-400"
                        : isMedium
                        ? "border-amber-200/80 dark:border-amber-900/50 hover:border-amber-400"
                        : "border-rose-200/80 dark:border-rose-900/50 hover:border-rose-400"
                    )}
                  >
                    <div>
                      {/* Top Line: System Icon, Name, and Status Badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getSystemIcon(sys.systemName)}</span>
                          <div>
                            <h5 className="font-extrabold text-sm text-gray-900 dark:text-white leading-tight">
                              {sys.systemName}
                            </h5>
                            <span className="text-[10px] text-gray-500">em {selectedSubject}</span>
                          </div>
                        </div>

                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-black shrink-0",
                          isStrong ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                          isMedium ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                          "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        )}>
                          {sys.accuracy}%
                        </span>
                      </div>

                      {/* Progress Bar with Target Marker */}
                      <div className="space-y-1 my-3">
                        <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden relative">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isStrong ? "bg-emerald-500" : isMedium ? "bg-amber-500" : "bg-rose-500"
                            )}
                            style={{ width: `${Math.min(100, sys.accuracy)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 font-semibold">
                          <span>{sys.correct} de {sys.total} acertos</span>
                          <span>{sys.incorrect} erros</span>
                        </div>
                      </div>

                      {/* Speed Metrics */}
                      <div className="grid grid-cols-2 gap-2 text-xs py-2 px-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 font-mono">
                        <div>
                          <span className="text-[10px] text-gray-400 block font-sans">Resolução:</span>
                          <span className="font-bold text-gray-800 dark:text-gray-200">{formatSec(sys.avgSolveTime)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block font-sans">Revisão:</span>
                          <span className="font-bold text-gray-800 dark:text-gray-200">{formatSec(sys.avgRevTime)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Clinical Feedback / Insight Pill */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px]">
                      {isStrong ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Domínio Sólido (Manter revisões espaçadas)</span>
                        </span>
                      ) : isMedium ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5" />
                          <span>Zona de Atenção (Reforçar questões médias)</span>
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Ponto Crítico (Priorizar notas e flashcards)</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* MODO 2: VISÃO EM MATRIZ CRUZADA (SUBJECTS × SYSTEMS) */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Tabela Cruzada Completa (Todos os Subjects e seus Sistemas):
            </h4>
            <span className="text-xs text-gray-400">
              Células coloridas por precisão (% de acertos)
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 font-bold border-b border-gray-200 dark:border-gray-700">
                  <th className="p-3 sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 min-w-[160px]">
                    Matéria (Subject)
                  </th>
                  <th className="p-3 text-center min-w-[90px]">Total Geral</th>
                  <th className="p-3 text-center min-w-[90px]">Acerto Geral</th>
                  {allUniqueSystems.map(sys => (
                    <th key={sys} className="p-3 text-center min-w-[120px] font-semibold">
                      <div className="flex items-center justify-center gap-1">
                        <span>{getSystemIcon(sys)}</span>
                        <span className="truncate max-w-[110px]" title={sys}>{sys}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                {subjectPerformanceList.map(subj => (
                  <tr key={subj.subjectName} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                    <td className="p-3 font-bold text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-900 z-10 flex items-center gap-1.5 border-r border-gray-100 dark:border-gray-800">
                      <span>{getSystemIcon(subj.subjectName)}</span>
                      <span>{subj.subjectName}</span>
                    </td>
                    <td className="p-3 text-center font-semibold text-gray-600 dark:text-gray-300">
                      {subj.total}
                    </td>
                    <td className="p-3 text-center font-bold">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-black",
                        subj.accuracy >= 70 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                        subj.accuracy >= 50 ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                        "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      )}>
                        {subj.accuracy}%
                      </span>
                    </td>

                    {/* Células de cada System */}
                    {allUniqueSystems.map(sysName => {
                      const matchedSys = subj.systems.find(s => s.systemName === sysName);
                      if (!matchedSys) {
                        return (
                          <td key={sysName} className="p-3 text-center text-gray-300 dark:text-gray-600">
                            —
                          </td>
                        );
                      }

                      const isStrong = matchedSys.accuracy >= 70;
                      const isMedium = matchedSys.accuracy >= 50 && matchedSys.accuracy < 70;

                      return (
                        <td key={sysName} className="p-2.5 text-center">
                          <div className={cn(
                            "py-1 px-1.5 rounded-xl flex flex-col items-center justify-center transition-transform hover:scale-105 cursor-default",
                            isStrong
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : isMedium
                              ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                          )}>
                            <span className="font-extrabold text-xs">{matchedSys.accuracy}%</span>
                            <span className="text-[10px] text-gray-400 font-sans">{matchedSys.correct}/{matchedSys.total}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
