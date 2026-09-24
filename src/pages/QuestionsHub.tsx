import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useStore } from '../cardblocks/store/useStore';
import { BankSelectionView } from '../cardblocks/pages/questions/BankSelectionView';
import { TestCreatorView, TestSessionConfig } from '../cardblocks/pages/questions/TestCreatorView';
import { QuestionSessionView } from '../cardblocks/pages/questions/QuestionSessionView';
import { QuestionStatsView } from '../cardblocks/pages/questions/QuestionStatsView';
import { QuestionRepositoryView } from '../cardblocks/pages/questions/QuestionRepositoryView';
import { CardCreationModal } from '../cardblocks/components/CardCreationModal';
import { MouseInteractiveBackground } from '../components/MouseInteractiveBackground';
import { useQBankSync } from '../hooks/useQBankSync';
import {
  BookOpen,
  Filter,
  BarChart3,
  Layers,
  Database,
  Play,
  RotateCcw,
  Sparkles,
  ChevronRight
} from 'lucide-react';

export type QuestionsViewTab = 'banks' | 'filter' | 'session' | 'stats' | 'repository';

export default function QuestionsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { questionBanks, questions } = useStore();

  // Ativa hook de sincronização em tempo real de questões capturadas pela extensão
  useQBankSync();

  const [activeTab, setActiveTab] = useState<QuestionsViewTab>('banks');
  const [selectedBankId, setSelectedBankId] = useState<string>(() => {
    return searchParams.get('bankId') || (questionBanks[0]?.id || '');
  });

  const [sessionConfig, setSessionConfig] = useState<TestSessionConfig | null>(null);
  const [cardCreatorData, setCardCreatorData] = useState<any>(null);

  // Manipulação de QID vindo por parâmetro de URL (ex: clique em "Ir até a questão" vindo de um Flashcard)
  useEffect(() => {
    const qidParam = searchParams.get('qid');
    const bankIdParam = searchParams.get('bankId');

    if (qidParam) {
      const cleanQid = qidParam.trim();
      const targetQ = questions.find(q => q.qid === cleanQid || q.id === cleanQid);
      if (targetQ) {
        setSelectedBankId(targetQ.bankId);
        setSessionConfig({
          bankId: targetQ.bankId,
          selectedQuestionIds: [targetQ.id],
          mode: 'tutored',
          order: 'sequential',
          pacerEnabled: true,
          pacerTargetSeconds: 72,
        });
        setActiveTab('session');
      }
    } else if (bankIdParam && questionBanks.some(b => b.id === bankIdParam)) {
      setSelectedBankId(bankIdParam);
    }
  }, [searchParams, questions, questionBanks]);

  // Sincroniza se selectedBankId mudar
  const currentBank = questionBanks.find(b => b.id === selectedBankId) || questionBanks[0];

  const handleSelectBank = (bankId: string) => {
    setSelectedBankId(bankId);
    setActiveTab('filter');
  };

  const handleStartSession = (config: TestSessionConfig) => {
    setSessionConfig(config);
    setActiveTab('session');
  };

  const handleOpenStats = (bankId: string) => {
    setSelectedBankId(bankId);
    setActiveTab('stats');
  };

  const handleOpenRepository = (bankId: string) => {
    setSelectedBankId(bankId);
    setActiveTab('repository');
  };

  return (
    <div className="relative min-h-screen bg-gray-50/50 dark:bg-gray-950/50 flex flex-col font-sans">
      <MouseInteractiveBackground />

      {/* Main Top Navigation / Subheader */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 sm:px-8 py-3 transition-colors">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <button
              onClick={() => setActiveTab('banks')}
              className={`font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'banks'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Bancos de Questões</span>
            </button>

            {currentBank && activeTab !== 'banks' && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                <button
                  onClick={() => setActiveTab('filter')}
                  className={`font-semibold transition-colors truncate max-w-[160px] sm:max-w-xs ${
                    activeTab === 'filter'
                      ? 'text-blue-600 dark:text-blue-400 font-bold'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                  }`}
                >
                  {currentBank.name}
                </button>
              </>
            )}

            {activeTab === 'session' && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  Sessão Ativa
                </span>
              </>
            )}

            {activeTab === 'stats' && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  Estatísticas Detalhadas
                </span>
              </>
            )}

            {activeTab === 'repository' && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  Repositório
                </span>
              </>
            )}
          </div>

          {/* Quick Sub-Tabs */}
          {currentBank && activeTab !== 'banks' && (
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/60 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setActiveTab('filter')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'filter'
                    ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Criar Teste</span>
              </button>

              <button
                onClick={() => setActiveTab('repository')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'repository'
                    ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Questões</span>
              </button>

              <button
                onClick={() => setActiveTab('stats')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'stats'
                    ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Estatísticas</span>
              </button>

              <button
                onClick={() => setActiveTab('banks')}
                className="px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                title="Trocar Banco de Questões"
              >
                <Database className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 relative z-10">
        {activeTab === 'banks' && (
          <BankSelectionView
            onSelectBank={handleSelectBank}
            onOpenStats={handleOpenStats}
            onOpenRepository={handleOpenRepository}
          />
        )}

        {activeTab === 'filter' && currentBank && (
          <TestCreatorView
            bankId={currentBank.id}
            onBackToBanks={() => setActiveTab('banks')}
            onStartSession={handleStartSession}
          />
        )}

        {activeTab === 'session' && sessionConfig && (
          <QuestionSessionView
            config={sessionConfig}
            onExitSession={() => setActiveTab('filter')}
            onOpenCardCreator={(qData) => setCardCreatorData(qData)}
          />
        )}

        {activeTab === 'stats' && currentBank && (
          <QuestionStatsView
            bankId={currentBank.id}
            onBackToBanks={() => setActiveTab('banks')}
            onPracticeQuestion={(qid) => {
              setSessionConfig({
                bankId: currentBank.id,
                selectedQuestionIds: [qid],
                mode: 'tutored',
                order: 'sequential',
                pacerEnabled: true,
                pacerTargetSeconds: 72,
              });
              setActiveTab('session');
            }}
          />
        )}

        {activeTab === 'repository' && currentBank && (
          <QuestionRepositoryView
            bankId={currentBank.id}
            onBackToBanks={() => setActiveTab('banks')}
            onOpenCardCreator={(qData) => setCardCreatorData(qData)}
          />
        )}
      </main>

      {/* Card Creation Modal quando acionado de uma questão */}
      {cardCreatorData && (
        <CardCreationModal
          onClose={() => setCardCreatorData(null)}
          initialData={cardCreatorData}
        />
      )}
    </div>
  );
}
