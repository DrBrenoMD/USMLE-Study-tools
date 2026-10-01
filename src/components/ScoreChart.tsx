import React, { useMemo, useState, useEffect } from 'react';
import { format, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { StudyLogEntry } from '../types';
import {
  ComposedChart,
  LineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  BarChart3,
  CheckSquare,
  Award,
  Clock,
  BookOpen,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  FolderTree,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Download,
  Wand2
} from 'lucide-react';
import { useStore, StudyDeskQuestionRecord, Question } from '../cardblocks/store/useStore';
import { cn } from '../lib/utils';
import { QuestionDrillDownModal } from './QuestionDrillDownModal';
import { GranularResetModal } from './GranularResetModal';
import { sanitizeStudyData } from '../utils/sanitizeStudyData';

interface ScoreChartProps {
  logs: StudyLogEntry[];
}

const PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ef4444', // red
  '#14b8a6', // teal
  '#6366f1', // indigo
];

export function ScoreChart({ logs }: ScoreChartProps) {
  // Configurações do Gráfico Geral (Não alterar)
  const [daysToShow, setDaysToShow] = useState<number>(30);

  // Seletor de Modo na Seção de Gráficos: 'general' (Geral de Sessões) | 'subject' (Novo Gráfico por Subject da Extensão)
  const [activeChartTab, setActiveChartTab] = useState<'general' | 'subject'>('general');

  // Filtro de Dias para o gráfico de Subject
  const [subjectDaysRange, setSubjectDaysRange] = useState<number>(30);

  // Legendas interativas do gráfico por Subject: Set de subjects desativados/ocultos
  const [hiddenSubjects, setHiddenSubjects] = useState<Set<string>>(new Set());

  // Estado para Drill-down Modal
  const [drillDownData, setDrillDownData] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    questions: Question[];
  }>({
    isOpen: false,
    title: '',
    questions: []
  });

  // Estado para Modal de Reset Granular
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetToast, setResetToast] = useState<string | null>(null);

  // Busca store
  const {
    questions,
    studyDeskSessions,
    resetExtensionStats,
    resetSubjectStats,
    resetSystemStats,
    upsertQuestionFromQBank,
    recordDeskQuestionAnswer
  } = useStore();

  // Helper para identificar questões que vieram da extensão do navegador
  const isExtensionQuestion = (q: Question): boolean => {
    return Boolean(
      q.isFromExtension === true ||
      q.source === 'extension' ||
      (q.tags && q.tags.some(t => {
        const lower = t.toLowerCase();
        return lower.includes('extensao') || lower.includes('extension') || lower.startsWith('qid:');
      }))
    );
  };

  // 1. Processa dados do GRÁFICO GERAL EXISTENTE (Não alterar - Fonte: logs de sessão)
  const { generalChartData, generalSummaryStats } = useMemo(() => {
    const qbankLogs = logs.filter(
      (l) => l.resourceType === 'qbank' || l.unit === 'questões' || l.unit === 'questoes'
    );

    const byDate = new Map<
      string,
      {
        totalAmount: number;
        scoredAmount: number;
        weightedScoreSum: number;
      }
    >();

    qbankLogs.forEach((log) => {
      if (!log.date) return;
      const existing = byDate.get(log.date) || {
        totalAmount: 0,
        scoredAmount: 0,
        weightedScoreSum: 0,
      };

      const amt = Number(log.amount) || 0;
      existing.totalAmount += amt;

      if (log.scorePercent !== undefined && log.scorePercent !== null) {
        const score = Number(log.scorePercent);
        existing.scoredAmount += amt;
        existing.weightedScoreSum += score * amt;
      }

      byDate.set(log.date, existing);
    });

    const today = startOfDay(new Date());
    const startDate = subDays(today, Math.max(1, daysToShow - 1));
    const allDaysInInterval = eachDayOfInterval({ start: startDate, end: today });

    let cumulativeTotalQuestions = 0;
    let cumulativeScoredQuestions = 0;
    let cumulativeWeightedScore = 0;
    let activeDaysCount = 0;

    const rawDailyData = allDaysInInterval.map((dayDate) => {
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const dateFormatted = format(dayDate, 'dd/MM');
      const stats = byDate.get(dateStr);

      const hasQuestions = Boolean(stats && stats.totalAmount > 0);
      const questionsCount = stats ? stats.totalAmount : 0;

      let avgScore: number | null = null;
      if (stats && stats.scoredAmount > 0) {
        avgScore = Math.round(stats.weightedScoreSum / stats.scoredAmount);
      }

      if (hasQuestions) {
        activeDaysCount++;
        cumulativeTotalQuestions += questionsCount;
        if (stats && stats.scoredAmount > 0) {
          cumulativeScoredQuestions += stats.scoredAmount;
          cumulativeWeightedScore += stats.weightedScoreSum;
        }
      }

      return {
        date: dayDate,
        dateStr,
        dateFormatted,
        questions: questionsCount,
        score: avgScore,
        hasQuestions,
      };
    });

    const finalData = rawDailyData.map((d, index, arr) => {
      if (!d.hasQuestions || d.score === null) {
        return {
          ...d,
          trend: null,
        };
      }

      const recentActiveDays: Array<{ score: number; questions: number }> = [];
      for (let i = index; i >= 0 && recentActiveDays.length < 4; i--) {
        const prev = arr[i];
        if (prev.hasQuestions && prev.score !== null) {
          recentActiveDays.push({ score: prev.score, questions: Math.max(1, prev.questions) });
        }
      }

      const totalWeight = recentActiveDays.reduce((sum, item) => sum + item.questions, 0);
      const weightedSum = recentActiveDays.reduce((sum, item) => sum + item.score * item.questions, 0);
      const trendScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : d.score;

      return {
        ...d,
        trend: trendScore,
      };
    });

    const overallAvgScore =
      cumulativeScoredQuestions > 0
        ? Math.round(cumulativeWeightedScore / cumulativeScoredQuestions)
        : null;

    const avgQuestionsPerActiveDay =
      activeDaysCount > 0 ? Math.round(cumulativeTotalQuestions / activeDaysCount) : 0;

    const summary = {
      totalQuestions: cumulativeTotalQuestions,
      overallAvgScore,
      activeDaysCount,
      totalDays: allDaysInInterval.length,
      avgQuestionsPerActiveDay,
    };

    return {
      generalChartData: finalData,
      generalSummaryStats: summary,
    };
  }, [logs, daysToShow]);

  // 2. FONTE DE DADOS RESTRITA: Coleta de registros EXCLUSIVAMENTE das questões da Extensão
  const extensionData = useMemo(() => {
    // Filtra questões puramente da extensão
    const extQuestions = questions.filter(isExtensionQuestion);

    // Mapeamento de registros de resolução das questões da extensão
    const records: Array<{
      qid: string;
      questionId?: string;
      questionObj: Question;
      isCorrect: boolean;
      subject: string;
      system: string;
      resolutionTimeSeconds: number;
      reviewTimeSeconds: number;
      answeredAt: number;
      dateStr: string;
    }> = [];

    // Prioriza tentativas reais registradas na questão
    extQuestions.forEach(q => {
      const subj = (q.subject || 'Geral').trim();
      const sys = (q.system || 'Sistema Geral').trim();

      if (q.attempts && q.attempts.length > 0) {
        q.attempts.forEach(att => {
          const tDate = att.timestamp ? new Date(att.timestamp) : new Date(q.lastAnsweredAt || Date.now());
          records.push({
            qid: q.qid || q.id,
            questionId: q.id,
            questionObj: q,
            isCorrect: att.isCorrect,
            subject: subj,
            system: sys,
            resolutionTimeSeconds: att.resolutionTimeSeconds || q.resolutionTimeSeconds || 60,
            reviewTimeSeconds: att.reviewTimeSeconds || q.reviewTimeSeconds || 100,
            answeredAt: tDate.getTime(),
            dateStr: format(tDate, 'yyyy-MM-dd')
          });
        });
      } else if (q.status && q.status !== 'unused') {
        const tDate = q.lastAnsweredAt ? new Date(q.lastAnsweredAt) : new Date(q.updatedAt || Date.now());
        records.push({
          qid: q.qid || q.id,
          questionId: q.id,
          questionObj: q,
          isCorrect: q.status === 'correct',
          subject: subj,
          system: sys,
          resolutionTimeSeconds: q.resolutionTimeSeconds || 60,
          reviewTimeSeconds: q.reviewTimeSeconds || 100,
          answeredAt: tDate.getTime(),
          dateStr: format(tDate, 'yyyy-MM-dd')
        });
      }
    });

    // Se nenhuma questão da extensão estiver salva ainda, busca se há sessões de desk com tag de extensão
    if (records.length === 0) {
      (studyDeskSessions || []).forEach(s => {
        (s.questionRecords || []).forEach(r => {
          if (r.isFromExtension) {
            const matchedQ = questions.find(q => q.qid === r.qid || q.id === r.questionId);
            if (matchedQ) {
              const tDate = new Date(r.answeredAt || s.startedAt);
              records.push({
                qid: r.qid,
                questionId: r.questionId,
                questionObj: matchedQ,
                isCorrect: r.isCorrect,
                subject: (r.subject || matchedQ.subject || 'Geral').trim(),
                system: (r.system || matchedQ.system || 'Sistema Geral').trim(),
                resolutionTimeSeconds: r.resolutionTimeSeconds,
                reviewTimeSeconds: r.reviewTimeSeconds,
                answeredAt: tDate.getTime(),
                dateStr: format(tDate, 'yyyy-MM-dd')
              });
            }
          }
        });
      });
    }

    return {
      extensionQuestions: extQuestions,
      records
    };
  }, [questions, studyDeskSessions]);

  // Lista única de Subjects e Systems capturados da extensão
  const { allSubjectsList, allSystemsList } = useMemo(() => {
    const subjSet = new Set<string>();
    const sysSet = new Set<string>();

    extensionData.records.forEach(r => {
      if (r.subject) subjSet.add(r.subject);
      if (r.system) sysSet.add(r.system);
    });

    extensionData.extensionQuestions.forEach(q => {
      if (q.subject) subjSet.add(q.subject.trim());
      if (q.system) sysSet.add(q.system.trim());
    });

    return {
      allSubjectsList: Array.from(subjSet).sort(),
      allSystemsList: Array.from(sysSet).sort()
    };
  }, [extensionData]);

  // 3. Processamento do NOVO GRÁFICO - Desempenho por Subject pelo Tempo
  const { subjectTimeSeriesData, subjectColorsMap } = useMemo(() => {
    const today = startOfDay(new Date());
    const startDate = subDays(today, Math.max(1, subjectDaysRange - 1));
    const allDaysInInterval = eachDayOfInterval({ start: startDate, end: today });

    // Mapeamento de cores estáveis para cada Subject
    const colorsMap: Record<string, string> = {};
    allSubjectsList.forEach((sub, idx) => {
      colorsMap[sub] = PALETTE[idx % PALETTE.length];
    });

    // Agrupamento de registros por data e por subject
    const byDateAndSubj = new Map<string, Map<string, { total: number; correct: number }>>();

    extensionData.records.forEach(r => {
      const dStr = r.dateStr;
      if (!byDateAndSubj.has(dStr)) {
        byDateAndSubj.set(dStr, new Map());
      }
      const dayMap = byDateAndSubj.get(dStr)!;
      const current = dayMap.get(r.subject) || { total: 0, correct: 0 };
      current.total += 1;
      if (r.isCorrect) current.correct += 1;
      dayMap.set(r.subject, current);
    });

    const seriesData = allDaysInInterval.map(dayDate => {
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const dateFormatted = format(dayDate, 'dd/MM');
      const dayMap = byDateAndSubj.get(dateStr);

      const entry: Record<string, any> = {
        dateStr,
        dateFormatted,
      };

      allSubjectsList.forEach(subj => {
        if (dayMap && dayMap.has(subj)) {
          const stats = dayMap.get(subj)!;
          const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null;
          entry[subj] = accuracy;
          entry[`${subj}_total`] = stats.total;
          entry[`${subj}_correct`] = stats.correct;
        } else {
          entry[subj] = null;
        }
      });

      return entry;
    });

    return {
      subjectTimeSeriesData: seriesData,
      subjectColorsMap: colorsMap
    };
  }, [allSubjectsList, extensionData, subjectDaysRange]);

  // 4. Processamento da NOVA SEÇÃO - System vs Subject (Hierarquia detalhada baseada em questões únicas)
  const systemVsSubjectData = useMemo(() => {
    // Mapa: Subject -> Map<System, { solveSum, revSum, questionsMap: Map<string, Question> }>
    const map = new Map<
      string,
      Map<
        string,
        {
          solveSum: number;
          revSum: number;
          questionsMap: Map<string, Question>;
        }
      >
    >();

    // Agrupa cada questão única pelo seu Subject e System
    extensionData.records.forEach(r => {
      const qKey = r.questionObj.id || r.questionObj.qid;
      const subj = (r.subject || 'Sem Matéria').trim();
      const sys = (r.system || 'Sistema Geral').trim();

      if (!map.has(subj)) {
        map.set(subj, new Map());
      }
      const sysMap = map.get(subj)!;
      if (!sysMap.has(sys)) {
        sysMap.set(sys, {
          solveSum: 0,
          revSum: 0,
          questionsMap: new Map()
        });
      }

      const item = sysMap.get(sys)!;
      // Garante que cada questão única seja contabilizada uma única vez por sistema
      if (!item.questionsMap.has(qKey)) {
        item.questionsMap.set(qKey, r.questionObj);
        item.solveSum += (r.resolutionTimeSeconds || 60);
        item.revSum += (r.reviewTimeSeconds || 90);
      }
    });

    // Formata em estrutura hierárquica ordenada garantindo consistência com o Drill-down
    const result = Array.from(map.entries()).map(([subjectName, sysMap]) => {
      let subjTotal = 0;
      let subjCorrect = 0;
      const subjQuestionsMap = new Map<string, Question>();

      const systems = Array.from(sysMap.entries()).map(([systemName, data]) => {
        const sysQuestions = Array.from(data.questionsMap.values());
        const total = sysQuestions.length;
        const correct = sysQuestions.filter(q => q.status === 'correct').length;
        const incorrect = total - correct;
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
        const avgSolve = total > 0 ? Math.round(data.solveSum / total) : 0;
        const avgRev = total > 0 ? Math.round(data.revSum / total) : 0;

        subjTotal += total;
        subjCorrect += correct;
        data.questionsMap.forEach((q, id) => subjQuestionsMap.set(id, q));

        return {
          systemName,
          total,
          correct,
          incorrect,
          accuracy,
          avgSolveTime: avgSolve,
          avgRevTime: avgRev,
          questions: sysQuestions
        };
      }).sort((a, b) => b.total - a.total);

      const subjAccuracy = subjTotal > 0 ? Math.round((subjCorrect / subjTotal) * 100) : 0;

      return {
        subjectName,
        total: subjTotal,
        correct: subjCorrect,
        incorrect: subjTotal - subjCorrect,
        accuracy: subjAccuracy,
        systems,
        questions: Array.from(subjQuestionsMap.values())
      };
    }).sort((a, b) => b.total - a.total);

    return result;
  }, [extensionData]);

  // Sanitização automática no mount para corrigir dados inflados antigos
  useEffect(() => {
    sanitizeStudyData();
  }, []);

  // Formatação de segundos
  const formatSec = (sec: number) => {
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m === 0) return `${rem}s`;
    return `${m}m ${rem.toString().padStart(2, '0')}s`;
  };

  // Toggle interativo de legendas no gráfico por Subject
  const toggleSubjectVisibility = (subjectName: string) => {
    setHiddenSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subjectName)) {
        next.delete(subjectName);
      } else {
        next.add(subjectName);
      }
      return next;
    });
  };

  // Abertura de Drill-down a partir do clique em data point ou linha
  const handleSubjectPointClick = (pointData: any, subjectName: string) => {
    if (!pointData || !subjectName) return;
    const dateStr = pointData.dateStr;
    const matchingRecords = extensionData.records.filter(
      r => r.subject === subjectName && (!dateStr || r.dateStr === dateStr)
    );
    const qList = Array.from(new Set(matchingRecords.map(r => r.questionObj)));

    setDrillDownData({
      isOpen: true,
      title: `Questões de ${subjectName}`,
      subtitle: dateStr ? `Resolvidas em ${format(new Date(dateStr), 'dd/MM/yyyy')} via extensão do navegador` : 'Capturadas via extensão',
      questions: qList.length > 0 ? qList : extensionData.extensionQuestions.filter(q => q.subject === subjectName)
    });
  };

  // Executores de Reset Granular
  const handleResetExtension = () => {
    resetExtensionStats();
    setResetToast('Estatísticas das questões da extensão foram resetadas com sucesso!');
    setTimeout(() => setResetToast(null), 3500);
  };

  const handleResetSubject = (subjectName: string) => {
    resetSubjectStats(subjectName);
    setResetToast(`Estatísticas do Subject "${subjectName}" foram resetadas!`);
    setTimeout(() => setResetToast(null), 3500);
  };

  const handleResetSystem = (systemName: string) => {
    resetSystemStats(systemName);
    setResetToast(`Estatísticas do System "${systemName}" foram resetadas!`);
    setTimeout(() => setResetToast(null), 3500);
  };

  const handleSanitizeAndRecalculate = () => {
    const res = sanitizeStudyData();
    if (res.fixedLogsCount > 0 || res.removedDuplicateAttempts > 0) {
      setResetToast(`Sincronização concluída! ${res.removedDuplicateAttempts} tentativas duplicadas foram removidas e ${res.fixedLogsCount} registros do Heatmap corrigidos para corresponderem às questões reais.`);
    } else {
      setResetToast('Todas as métricas e logs do Heatmap já estão 100% íntegros e sincronizados com as questões reais!');
    }
    setTimeout(() => setResetToast(null), 4500);
  };

  const handleResetGeneralLogs = () => {
    localStorage.removeItem('usmle_study_logs_v4');
    window.location.reload();
  };

  // Gerador de questões de amostra da extensão para testes/revisão imediata
  const handleSeedSampleExtensionData = () => {
    const samples = [
      { qid: 'EXT-101', subject: 'Cardiologia', system: 'Sistema Cardiovascular', text: 'Homem de 62 anos apresenta dor torácica retroesternal opressiva e elevação do segmento ST em DII, DIII e aVF.', isCorrect: true, solve: 58, rev: 110 },
      { qid: 'EXT-102', subject: 'Cardiologia', system: 'Sistema Cardiovascular', text: 'Mulher de 45 anos com sopro holossistólico em foco mitral irradiando para axila esquerda.', isCorrect: true, solve: 64, rev: 120 },
      { qid: 'EXT-103', subject: 'Cardiologia', system: 'Farmacologia Cardiovascular', text: 'Mecanismo de ação dos inibidores da ECA e efeito sobre a bradicinina e tosse seca.', isCorrect: false, solve: 72, rev: 140 },
      { qid: 'EXT-104', subject: 'Cardiologia', system: 'Farmacologia Cardiovascular', text: 'Uso de betabloqueadores em insuficiência cardíaca crônica com fração de ejeção reduzida.', isCorrect: true, solve: 52, rev: 90 },
      { qid: 'EXT-105', subject: 'Pneumologia', system: 'Sistema Respiratório', text: 'Paciente de 58 anos tabagista de longa data com dispneia progressiva e relação VEF1/CVF < 0.70.', isCorrect: true, solve: 65, rev: 115 },
      { qid: 'EXT-106', subject: 'Pneumologia', system: 'Sistema Respiratório', text: 'Quadro de pneumonia adquirida na comunidade com consolidação lobar direita por Streptococcus pneumoniae.', isCorrect: true, solve: 48, rev: 85 },
      { qid: 'EXT-107', subject: 'Pneumologia', system: 'Distúrbios Ventilatórios', text: 'Gasometria arterial revelando hipoxemia refratária com gradiente alvéolo-arterial aumentado no shunt intrapulmonar.', isCorrect: false, solve: 82, rev: 160 },
      { qid: 'EXT-108', subject: 'Gastroenterologia', system: 'Sistema Hepático & Biliar', text: 'Homem de 50 anos etilista crônico com ascite, circulação colateral e varizes esofágicas.', isCorrect: true, solve: 60, rev: 105 },
      { qid: 'EXT-109', subject: 'Gastroenterologia', system: 'Sistema Hepático & Biliar', text: 'Mecanismo fisiopatológico da encefalopatia hepática e manejo inicial com lactulose.', isCorrect: false, solve: 68, rev: 130 },
      { qid: 'EXT-110', subject: 'Gastroenterologia', system: 'Trato Gastrointestinal', text: 'Mulher jovem com diarreia crônica, dor abdominal e lesões ulceradas segmentares na ileocolonoscopia.', isCorrect: true, solve: 70, rev: 125 },
      { qid: 'EXT-111', subject: 'Infectologia', system: 'Imunológico & Infecto', text: 'Conduta frente a paciente com febre, rigidez de nuca e líquor túrbido com predomínio de polimorfonucleares.', isCorrect: true, solve: 55, rev: 95 },
      { qid: 'EXT-112', subject: 'Infectologia', system: 'Imunológico & Infecto', text: 'Tratamento empírico inicial de endocardite infecciosa em valva nativa aguda.', isCorrect: false, solve: 75, rev: 145 },
    ];

    samples.forEach(s => {
      const qId = upsertQuestionFromQBank({
        qid: s.qid,
        stem: s.text,
        text: s.text,
        subject: s.subject,
        system: s.system,
        isFromExtension: true,
        source: 'extension',
        tags: [`qid:${s.qid}`, 'origem:extensao', 'extension', s.subject.toLowerCase()],
        alternatives: [
          { id: 'alt-a', letter: 'A', text: 'Opção correta diagnosticada', isCorrect: true },
          { id: 'alt-b', letter: 'B', text: 'Opção incorreta alternativa', isCorrect: false }
        ]
      });

      recordDeskQuestionAnswer({
        qid: s.qid,
        questionId: qId,
        selectedChoiceId: s.isCorrect ? 'alt-a' : 'alt-b',
        correctChoiceId: 'alt-a',
        isCorrect: s.isCorrect,
        resolutionTimeSeconds: s.solve,
        reviewTimeSeconds: s.rev,
        subject: s.subject,
        system: s.system
      });
    });

    setResetToast('Amostra de 12 questões capturadas pela extensão foi injetada com sucesso para testes!');
    setTimeout(() => setResetToast(null), 4000);
  };

  return (
    <div className="space-y-8 mt-6">
      {/* Toast Feedback */}
      {resetToast && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-2xl flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{resetToast}</span>
          </div>
          <button onClick={() => setResetToast(null)} className="text-emerald-600 font-extrabold text-xs">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BLOCO SUPERIOR: SEÇÃO DE GRÁFICOS (GERAL vs NOVO GRÁFICO POR SUBJECT) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs flex flex-col gap-6">
        {/* Top Header com Seletor de Gráfico e Botões de Controle */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
                Painel de Desempenho & Métricas
              </h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Acompanhe o volume geral de questões e as estatísticas detalhadas de acertos por matéria e sistema.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Modo: Gráfico Geral (Não Alterar) vs Novo Gráfico por Subject */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setActiveChartTab('general')}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  activeChartTab === 'general'
                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <span>📅 Gráfico Geral (Sessões)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveChartTab('subject')}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  activeChartTab === 'subject'
                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>📈 Desempenho por Subject (Extensão)</span>
              </button>
            </div>

            {/* Intervalo de dias */}
            {activeChartTab === 'general' ? (
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold">
                {[7, 14, 30, 60, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDaysToShow(days)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                      daysToShow === days
                        ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 font-bold shadow-xs"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                    )}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold">
                {[7, 14, 30, 60, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setSubjectDaysRange(days)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                      subjectDaysRange === days
                        ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 font-bold shadow-xs"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                    )}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            )}

            {/* Botão de Sincronizar & Corrigir Métricas */}
            <button
              type="button"
              onClick={handleSanitizeAndRecalculate}
              className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Corrigir registros e recalcular métricas para corresponderem exatamente ao número de questões únicas"
            >
              <Wand2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Sincronizar & Corrigir Métricas</span>
            </button>

            {/* Botão de Reset Granular */}
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Resetar estatísticas individualmente"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Resetar Estatísticas</span>
            </button>
          </div>
        </div>

        {/* SUMMARY TILES */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs font-bold mb-1">
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{activeChartTab === 'general' ? 'Total (Logs Sessão)' : 'Total (Extensão)'}</span>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-blue-950 dark:text-blue-100">
              {activeChartTab === 'general' 
                ? generalSummaryStats.totalQuestions 
                : extensionData.extensionQuestions.filter(q => q.status && q.status !== 'unused').length || extensionData.extensionQuestions.length}
            </div>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {activeChartTab === 'general'
                ? `${generalSummaryStats.activeDaysCount} dias ativos`
                : `${extensionData.extensionQuestions.length} questões catalogadas`}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-1">
              <Award className="w-3.5 h-3.5" />
              <span>Taxa de Acertos</span>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-950 dark:text-emerald-100">
              {activeChartTab === 'general'
                ? (generalSummaryStats.overallAvgScore !== null ? `${generalSummaryStats.overallAvgScore}%` : '—')
                : (() => {
                    const answered = extensionData.extensionQuestions.filter(q => q.status && q.status !== 'unused');
                    if (answered.length === 0) return '—';
                    const correct = answered.filter(q => q.status === 'correct').length;
                    return `${Math.round((correct / answered.length) * 100)}%`;
                  })()}
            </div>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {activeChartTab === 'general' ? 'Média ponderada geral' : 'Exclusivo da extensão'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
            <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 text-xs font-bold mb-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Subjects Identificados</span>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-purple-950 dark:text-purple-100">
              {allSubjectsList.length}
            </div>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {allSystemsList.length} Sistemas vinculados
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-bold mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Tempo Médio / Questão</span>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-amber-950 dark:text-amber-100">
              {extensionData.records.length > 0
                ? formatSec(
                    extensionData.records.reduce((acc, r) => acc + r.resolutionTimeSeconds, 0) /
                      extensionData.records.length
                  )
                : formatSec(65)}
            </div>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">Alvo recomendado: 75s</span>
          </div>
        </div>

        {/* 1. RENDERIZAÇÃO DO MODO 1: GRÁFICO GERAL EXISTENTE (Não alterar) */}
        {activeChartTab === 'general' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500 pb-1">
              <span>Fonte: Banco de logs de sessão de estudo geral</span>
              <span className="font-semibold">Volume (Barras) • Acertos & Tendência (Linhas)</span>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={generalChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      const d = e.activePayload[0].payload;
                      const dayQuestions = questions.filter(q => {
                        if (!q.lastAnsweredAt) return false;
                        return format(new Date(q.lastAnsweredAt), 'yyyy-MM-dd') === d.dateStr;
                      });
                      if (dayQuestions.length > 0) {
                        setDrillDownData({
                          isOpen: true,
                          title: `Questões de ${d.dateFormatted}`,
                          subtitle: `Resolvidas na data ${d.dateStr}`,
                          questions: dayQuestions
                        });
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="dateFormatted" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    stroke="#3b82f6"
                    domain={[0, 'auto']}
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Questões', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#3b82f6' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#10b981"
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Acerto (%)', angle: 90, position: 'insideRight', fontSize: 10, fill: '#10b981' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      color: '#fff',
                      borderRadius: '12px',
                      border: 'none',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'Questões Resolvidas') return [`${value} questões`, name];
                      if (name === 'Taxa de Acertos') return [value !== null ? `${value}%` : 'Sem acertos', name];
                      if (name === 'Tendência (Média Móvel)') return [value !== null ? `${value}%` : '—', name];
                      return [value, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar yAxisId="left" dataKey="questions" name="Questões Resolvidas" fill="#3b82f6" opacity={0.8} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="score" name="Taxa de Acertos" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls={true} />
                  <Line yAxisId="right" type="monotone" dataKey="trend" name="Tendência (Média Móvel)" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="4 4" dot={false} connectNulls={true} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 2. RENDERIZAÇÃO DO MODO 2: NOVO GRÁFICO - DESEMPENHO POR SUBJECT PELO TEMPO */}
        {activeChartTab === 'subject' && (
          <div className="space-y-4">
            {/* Aviso de Fonte Restrita da Extensão */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-base">🔒</span>
                <div>
                  <span className="font-bold text-blue-950 dark:text-blue-200">
                    Fonte de Dados Restrita:
                  </span>
                  <span className="text-blue-800 dark:text-blue-300 ml-1">
                    Alimentado exclusivamente pelas questões capturadas pela extensão do navegador.
                  </span>
                </div>
              </div>

              {extensionData.records.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeedSampleExtensionData}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1 shrink-0 shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Carregar Amostra da Extensão</span>
                </button>
              )}
            </div>

            {allSubjectsList.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center mx-auto text-xl font-bold">
                  🧩
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Nenhuma questão capturada pela extensão ainda
                </h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  Resolva questões no seu Q-Bank com a extensão ativa para sincronizar automaticamente os Subjects e Systems, ou carregue dados de demonstração.
                </p>
                <button
                  type="button"
                  onClick={handleSeedSampleExtensionData}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Carregar Amostra de Teste da Extensão
                </button>
              </div>
            ) : (
              <>
                {/* Legendas Interativas Personalizadas (Clique para Filtrar) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-gray-500 font-semibold px-1">
                    <span>Clique em uma legenda para ocultar ou exibir a linha correspondente:</span>
                    <button
                      type="button"
                      onClick={() => setHiddenSubjects(new Set())}
                      className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      Exibir Todos
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {allSubjectsList.map(subj => {
                      const isHidden = hiddenSubjects.has(subj);
                      const color = subjectColorsMap[subj] || '#3b82f6';

                      return (
                        <button
                          key={subj}
                          type="button"
                          onClick={() => toggleSubjectVisibility(subj)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer",
                            isHidden
                              ? "bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-700 opacity-60 line-through"
                              : "bg-white dark:bg-gray-850 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-750 shadow-2xs hover:scale-105"
                          )}
                          title={`Clique para ${isHidden ? 'exibir' : 'ocultar'} a linha de ${subj}`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: isHidden ? '#9ca3af' : color }}
                          />
                          <span>{subj}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Gráfico de Linhas por Subject pelo Tempo */}
                <div className="h-80 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={subjectTimeSeriesData}
                      margin={{ top: 10, right: 15, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="dateFormatted" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          color: '#fff',
                          borderRadius: '12px',
                          border: 'none',
                          fontSize: '12px'
                        }}
                        formatter={(val: any, name: any) => {
                          if (val === null || val === undefined) return ['Sem questões', name];
                          return [`${val}% de acerto`, name];
                        }}
                      />
                      {allSubjectsList.map(subj => {
                        const color = subjectColorsMap[subj] || '#3b82f6';
                        return (
                          <Line
                            key={subj}
                            type="monotone"
                            dataKey={subj}
                            name={subj}
                            stroke={color}
                            strokeWidth={2.5}
                            dot={{ r: 4, cursor: 'pointer' }}
                            activeDot={{ r: 7, cursor: 'pointer' }}
                            connectNulls={true}
                            hide={hiddenSubjects.has(subj)}
                            onClick={(dataPoint: any) => {
                              if (dataPoint && dataPoint.payload) {
                                handleSubjectPointClick(dataPoint.payload, subj);
                              }
                            }}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-[11px] text-gray-400 text-center italic">
                  💡 Dica: Clique sobre qualquer ponto colorido no gráfico para abrir o Drill-down com a lista exata das questões!
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* BLOCO INFERIOR: NOVA SEÇÃO - SYSTEM VS SUBJECT (HIERARQUIA DETALHADA) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
                System vs Subject (Desempenho Hierárquico)
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Avaliação detalhada do desempenho de cada System dentro dos seus respectivos Subjects (exclusivo da extensão).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500">
              {systemVsSubjectData.length} Subjects • {allSystemsList.length} Sistemas
            </span>
          </div>
        </div>

        {systemVsSubjectData.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-xs">
            Nenhum dado de System e Subject capturado pela extensão ainda.
          </div>
        ) : (
          <div className="space-y-4">
            {systemVsSubjectData.map((subjItem) => {
              const subjColor = subjectColorsMap[subjItem.subjectName] || '#3b82f6';

              return (
                <div
                  key={subjItem.subjectName}
                  className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-850/60 overflow-hidden shadow-2xs"
                >
                  {/* Subject Header */}
                  <div className="p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-8 rounded-full shrink-0"
                        style={{ backgroundColor: subjColor }}
                      />
                      <div>
                        <h4 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                          <span>{subjItem.subjectName}</span>
                          <span className="text-xs font-semibold text-gray-400">
                            ({subjItem.systems.length} {subjItem.systems.length === 1 ? 'sistema' : 'sistemas'})
                          </span>
                        </h4>
                        <span className="text-xs text-gray-500">
                          Total acumulado: {subjItem.total} questões • {subjItem.correct} acertos
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Badge de Acerto Geral do Subject */}
                      <button
                        type="button"
                        onClick={() => {
                          setDrillDownData({
                            isOpen: true,
                            title: `Todas as Questões de ${subjItem.subjectName}`,
                            subtitle: `Total de ${subjItem.questions.length} questões capturadas pela extensão`,
                            questions: subjItem.questions
                          });
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-transform hover:scale-105 cursor-pointer",
                          subjItem.accuracy >= 70
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                            : subjItem.accuracy >= 55
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300"
                        )}
                        title="Clique para ver todas as questões deste Subject"
                      >
                        <span>{subjItem.accuracy}% Acerto Global</span>
                        <span className="text-[10px] underline">Ver ({subjItem.total})</span>
                      </button>
                    </div>
                  </div>

                  {/* Systems Breakdown Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100/70 dark:bg-gray-800/50 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-2.5 px-4">System (Sistema)</th>
                          <th className="py-2.5 px-3 text-center">Questões</th>
                          <th className="py-2.5 px-3 text-center">Acertos / Erros</th>
                          <th className="py-2.5 px-3 text-center">Taxa de Acertos (%)</th>
                          <th className="py-2.5 px-3 text-center">Média Resolução</th>
                          <th className="py-2.5 px-3 text-center">Média Revisão</th>
                          <th className="py-2.5 px-4 text-right">Drill-down</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200/60 dark:divide-gray-800">
                        {subjItem.systems.map((sys) => {
                          return (
                            <tr
                              key={sys.systemName}
                              onClick={() => {
                                setDrillDownData({
                                  isOpen: true,
                                  title: `${subjItem.subjectName} • ${sys.systemName}`,
                                  subtitle: `Exibindo as ${sys.questions.length} questões deste sistema`,
                                  questions: sys.questions
                                });
                              }}
                              className="hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                              title="Clique para navegar e abrir a lista exata destas questões"
                            >
                              <td className="py-3 px-4 font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                <span className="text-gray-400">🩺</span>
                                <span>{sys.systemName}</span>
                              </td>

                              <td className="py-3 px-3 text-center font-bold text-gray-800 dark:text-gray-200">
                                {sys.total}
                              </td>

                              <td className="py-3 px-3 text-center text-gray-600 dark:text-gray-400 font-medium">
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{sys.correct}</span>
                                <span className="mx-1">/</span>
                                <span className="text-rose-600 dark:text-rose-400 font-bold">{sys.incorrect}</span>
                              </td>

                              <td className="py-3 px-3 text-center">
                                <div className="inline-flex flex-col items-center gap-1 w-24">
                                  <span
                                    className={cn(
                                      "px-2.5 py-0.5 rounded-full text-[11px] font-extrabold",
                                      sys.accuracy >= 70
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                                        : sys.accuracy >= 55
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300"
                                    )}
                                  >
                                    {sys.accuracy}%
                                  </span>
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        sys.accuracy >= 70 ? "bg-emerald-500" : sys.accuracy >= 55 ? "bg-amber-500" : "bg-rose-500"
                                      )}
                                      style={{ width: `${sys.accuracy}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-3 text-center font-mono text-gray-700 dark:text-gray-300">
                                {formatSec(sys.avgSolveTime)}
                              </td>

                              <td className="py-3 px-3 text-center font-mono text-gray-700 dark:text-gray-300">
                                {formatSec(sys.avgRevTime)}
                              </td>

                              <td className="py-3 px-4 text-right">
                                <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 font-bold text-xs hover:bg-blue-100 inline-block">
                                  Abrir ➔
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE DRILL-DOWN PARA AS QUESTÕES EXATAS */}
      {/* ========================================================================= */}
      <QuestionDrillDownModal
        isOpen={drillDownData.isOpen}
        onClose={() => setDrillDownData(prev => ({ ...prev, isOpen: false }))}
        title={drillDownData.title}
        subtitle={drillDownData.subtitle}
        questions={drillDownData.questions}
      />

      {/* ========================================================================= */}
      {/* MODAL DE RESET GRANULAR */}
      {/* ========================================================================= */}
      <GranularResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        availableSubjects={allSubjectsList}
        availableSystems={allSystemsList}
        onResetExtensionOnly={handleResetExtension}
        onResetSubject={handleResetSubject}
        onResetSystem={handleResetSystem}
        onResetGeneralLogsOnly={handleResetGeneralLogs}
      />
    </div>
  );
}
