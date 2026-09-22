import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home as DecksHome } from '../cardblocks/pages/Home';
import { DeckView } from '../cardblocks/pages/DeckView';
import { StudySession } from '../cardblocks/pages/StudySession';
import { SettingsView } from '../cardblocks/pages/SettingsView';
import { BrowseView } from '../cardblocks/pages/BrowseView';
import { QuestionBanksView } from '../cardblocks/pages/QuestionBanksView';
import { QuestionBankDetail } from '../cardblocks/pages/QuestionBankDetail';
import { QuestionEditor } from '../cardblocks/pages/QuestionEditor';
import { NotebooksView } from '../cardblocks/pages/NotebooksView';
import { NotebookCreator } from '../cardblocks/pages/NotebookCreator';
import { NotebookSession } from '../cardblocks/pages/NotebookSession';
import { DashboardView } from '../cardblocks/pages/DashboardView';
import { NotepadView } from '../cardblocks/pages/NotepadView';
import { LibraryView } from '../cardblocks/pages/LibraryView';
import { HelpView } from '../cardblocks/pages/HelpView';
import FlashcardsLobby from './FlashcardsLobby';
import FlashcardsEditor from './FlashcardsEditor';
import FlashcardsDashboard from './FlashcardsDashboard';

import { CardCreationModal } from '../cardblocks/components/CardCreationModal';
import { NotepadModal } from '../cardblocks/components/NotepadModal';
import { ToastContainer } from '../cardblocks/components/ToastContainer';
import { MouseInteractiveBackground } from '../components/MouseInteractiveBackground';
import { useTimerStore } from '../store/useTimerStore';
import { cn } from '../cardblocks/lib/utils';

import {
  Layers,
  Search,
  HelpCircle,
  Edit3,
  Settings,
  BookOpen,
  PieChart,
  PlusCircle,
  FileSpreadsheet,
  StickyNote,
  Activity,
  Play,
  X,
  ChevronDown,
} from 'lucide-react';

export type FlashcardPage = 
  | { type: 'home' }
  | { type: 'deck'; deckId: string }
  | { type: 'study'; deckId?: string; cardIds?: string[] }
  | { type: 'settings' }
  | { type: 'help' }
  | { type: 'library' }
  | { type: 'banks' }
  | { type: 'bank'; bankId: string }
  | { type: 'question'; questionId?: string; bankId?: string }
  | { type: 'notebooks' }
  | { type: 'notebookCreator' }
  | { type: 'notebook'; notebookId: string }
  | { type: 'dashboard' }
  | { type: 'notepad' }
  | { type: 'browse'; date?: string; deckId?: string; browseType?: 'flashcards' | 'questions' }
  | { type: 'simulados' }
  | { type: 'simuladoEditor'; simName: string }
  | { type: 'simuladoDashboard'; simName: string };

export default function FlashcardsUnifiedHub() {
  const location = useLocation();
  const navigate = useNavigate();

  // Modal states
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);

  // Global Study Tools Timer & Pacer Store
  const pacerIsActive = useTimerStore((s) => s.pacerIsActive);
  const pacerTotalQuestions = useTimerStore((s) => s.pacerTotalQuestions);
  const pacerCompletedQuestionsTime = useTimerStore((s) => s.pacerCompletedQuestionsTime);
  const pacerCurrentQuestionTime = useTimerStore((s) => s.pacerCurrentQuestionTime);
  const stopPacer = useTimerStore((s) => s.stopPacer);
  const setPacerState = useTimerStore((s) => s.setPacerState);
  const timerState = useTimerStore((s) => s.timerState);
  const timeLeft = useTimerStore((s) => s.timeLeft);
  const studyDuration = useTimerStore((s) => s.studyDuration);
  const timerElapsedSeconds = Math.max(0, studyDuration - timeLeft);

  // Initial page based on current route/search
  const [page, setPage] = useState<FlashcardPage>(() => {
    const params = new URLSearchParams(window.location.search);
    const simParam = params.get('sim');
    const tabParam = params.get('tab');

    if (window.location.pathname.includes('/editor') && simParam) {
      return { type: 'simuladoEditor', simName: simParam };
    }
    if (window.location.pathname.includes('/dashboard') && simParam) {
      return { type: 'simuladoDashboard', simName: simParam };
    }
    if (tabParam === 'simulados' || window.location.pathname.includes('/simulados')) {
      return { type: 'simulados' };
    }
    if (tabParam === 'browse') return { type: 'browse' };
    if (tabParam === 'banks') return { type: 'banks' };
    if (tabParam === 'notebooks') return { type: 'notebooks' };
    if (tabParam === 'notepad') return { type: 'notepad' };
    if (tabParam === 'dashboard') return { type: 'dashboard' };
    if (tabParam === 'settings') return { type: 'settings' };

    return { type: 'home' };
  });

  // Sync state if route changes externally
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const simParam = params.get('sim');
    if (location.pathname.includes('/editor') && simParam) {
      setPage({ type: 'simuladoEditor', simName: simParam });
    } else if (location.pathname.includes('/dashboard') && simParam) {
      setPage({ type: 'simuladoDashboard', simName: simParam });
    }
  }, [location.pathname, location.search]);

  // Navigation tabs
  const isDecksActive = ['home', 'deck', 'study'].includes(page.type);
  const isBrowseActive = page.type === 'browse';
  const isBanksActive = ['library', 'banks', 'bank', 'question'].includes(page.type);
  const isNotebooksActive = ['notebooks', 'notebookCreator', 'notebook'].includes(page.type);
  const isSimuladosActive = ['simulados', 'simuladoEditor', 'simuladoDashboard'].includes(page.type);
  const isNotepadActive = page.type === 'notepad';
  const isStatsActive = page.type === 'dashboard';

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex-1 flex flex-col font-sans relative transition-colors duration-200 min-h-[calc(100vh-56px)] text-gray-900 dark:text-gray-100">
      <MouseInteractiveBackground />
      <ToastContainer />

      {/* Sub-Header & Navigation Bar */}
      <header className="w-full border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md sticky top-14 z-30 transition-colors shadow-xs">
        <div className="w-full px-2 sm:px-4 md:px-6 h-14 flex items-center justify-between gap-1 sm:gap-2">
          {/* Main Module Tabs */}
          <nav className="flex items-center gap-0.5 sm:gap-1.5 shrink-0 overflow-visible">
            <button
              onClick={() => setPage({ type: 'home' })}
              className={cn(
                "px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 sm:gap-1.5 shrink-0",
                isDecksActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
              title="Baralhos de Flashcards"
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Baralhos</span>
            </button>

            <button
              onClick={() => setPage({ type: 'browse' })}
              className={cn(
                "px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 sm:gap-1.5 shrink-0",
                isBrowseActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
              title="Navegador de Cartões"
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Navegador</span>
            </button>

            <button
              onClick={() => setPage({ type: 'banks' })}
              className={cn(
                "px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 sm:gap-1.5 shrink-0",
                isBanksActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
              title="Bancos de Questões (QBanks)"
            >
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">QBanks</span>
            </button>

            <button
              onClick={() => setPage({ type: 'notebooks' })}
              className={cn(
                "px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 sm:gap-1.5 shrink-0",
                isNotebooksActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
              title="Cadernos de Questões (Notebooks)"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Cadernos</span>
            </button>

            {/* Dropdown Menu for Secondary Items */}
            <div className="relative shrink-0" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className={cn(
                  "px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 border shrink-0",
                  (isSimuladosActive || isNotepadActive || isStatsActive)
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : isMoreMenuOpen
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-700"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 border-transparent"
                )}
                title="Mais ferramentas e recursos"
              >
                <span className="hidden sm:inline">
                  {isSimuladosActive
                    ? 'Simulados'
                    : isNotepadActive
                    ? 'Notepad'
                    : isStatsActive
                    ? 'Estatísticas'
                    : 'Mais'}
                </span>
                <span className="sm:hidden">
                  {isSimuladosActive ? (
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  ) : isNotepadActive ? (
                    <StickyNote className="w-3.5 h-3.5" />
                  ) : isStatsActive ? (
                    <PieChart className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>
                <ChevronDown className={cn("hidden sm:inline w-3 h-3 transition-transform duration-150", isMoreMenuOpen ? "rotate-180" : "")} />
              </button>

              {isMoreMenuOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl p-1.5 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      setPage({ type: 'simulados' });
                      setIsMoreMenuOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors text-left",
                      isSimuladosActive
                        ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Simulados & Blocos</span>
                  </button>

                  <button
                    onClick={() => {
                      setPage({ type: 'notepad' });
                      setIsMoreMenuOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors text-left",
                      isNotepadActive
                        ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                  >
                    <StickyNote className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>Bloco de Notas (Notepad)</span>
                  </button>

                  <button
                    onClick={() => {
                      setPage({ type: 'dashboard' });
                      setIsMoreMenuOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors text-left",
                      isStatsActive
                        ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                  >
                    <PieChart className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <span>Estatísticas & Análise</span>
                  </button>
                </div>
              )}
            </div>
          </nav>

          {/* Right Action Tools */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={() => setIsAddCardOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
              title="Adicionar Flashcard rápido"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">+ Novo Cartão</span>
            </button>

            <button
              onClick={() => setIsQuickNoteOpen(true)}
              className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition-colors hidden sm:block border border-transparent hover:border-amber-200 dark:hover:border-amber-900/50"
              title="Anotação Rápida / Scratchpad"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            {/* Unified USMLE Timer / Pacer Status */}
            {pacerIsActive ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-mono font-bold shadow-xs">
                <Activity className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                <span className="hidden md:inline text-[11px] font-sans font-semibold text-rose-700 dark:text-rose-300">Pacer:</span>
                <span>Q{pacerCompletedQuestionsTime.length + 1}/{pacerTotalQuestions}</span>
                <span className="text-[11px] opacity-80">({pacerCurrentQuestionTime}s)</span>
                <button
                  onClick={() => stopPacer()}
                  className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 ml-0.5 p-0.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
                  title="Parar Pacer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : timerState === 'running' ? (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-mono font-bold shadow-xs">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[11px] font-sans font-semibold">Tempo:</span>
                <span>{Math.floor(timerElapsedSeconds / 60)}m {timerElapsedSeconds % 60}s</span>
              </div>
            ) : (
              <button
                onClick={() => setPacerState({ pacerTotalQuestions: 40, pacerTargetTimeSeconds: 72, pacerIsActive: true, pacerCompletedQuestionsTime: [] })}
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors border border-gray-200 dark:border-gray-700"
                title="Iniciar ritmo de 40 questões (72s/q)"
              >
                <Play className="w-3 h-3" />
                <span>Pacer 40Q</span>
              </button>
            )}

            <button
              onClick={() => setPage({ type: 'settings' })}
              className={cn(
                "p-1.5 rounded-xl transition-colors border",
                page.type === 'settings'
                  ? "bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-700"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 border-transparent"
              )}
              title="Configurações (SM-2, Atalhos, Backup)"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setPage({ type: 'help' })}
              className={cn(
                "p-1.5 rounded-xl transition-colors border",
                page.type === 'help'
                  ? "bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-700"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 border-transparent"
              )}
              title="Guia e Atalhos"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main
        className={cn(
          "flex-1 px-4 sm:px-6 lg:px-8 py-6 mx-auto w-full relative z-10",
          page.type === 'browse'
            ? "max-w-[98%]"
            : page.type === 'simuladoEditor' || page.type === 'study'
            ? "max-w-full p-0 sm:p-4"
            : "max-w-6xl"
        )}
      >
        {/* Cardblocks Views */}
        {page.type === 'home' && <DecksHome onNavigate={setPage} />}
        {page.type === 'deck' && <DeckView deckId={page.deckId} onNavigate={setPage} />}
        {page.type === 'study' && <StudySession deckId={page.deckId} cardIds={page.cardIds} onNavigate={setPage} />}
        {page.type === 'settings' && <SettingsView onNavigate={setPage} />}
        {page.type === 'help' && <HelpView onNavigate={setPage} />}
        {page.type === 'library' && <LibraryView onNavigate={setPage} />}
        {page.type === 'banks' && <QuestionBanksView onNavigate={setPage} />}
        {page.type === 'notebooks' && <NotebooksView onNavigate={setPage} />}
        {page.type === 'notebookCreator' && <NotebookCreator onNavigate={setPage} />}
        {page.type === 'notebook' && <NotebookSession notebookId={page.notebookId} onNavigate={setPage} />}
        {page.type === 'dashboard' && <DashboardView onNavigate={setPage} />}
        {page.type === 'notepad' && <NotepadView onNavigate={setPage} />}
        {page.type === 'bank' && <QuestionBankDetail bankId={page.bankId} onNavigate={setPage} />}
        {page.type === 'question' && <QuestionEditor questionId={page.questionId} bankId={page.bankId} onNavigate={setPage} />}
        {page.type === 'browse' && (
          <BrowseView
            key={`browse-${page.date}-${page.deckId}`}
            onNavigate={setPage}
            initialDate={page.date}
            initialDeckId={page.deckId}
            initialBrowseType={page.browseType}
          />
        )}

        {/* Simulado Corrector Views */}
        {page.type === 'simulados' && <FlashcardsLobby onNavigate={setPage} />}
        {page.type === 'simuladoEditor' && (
          <FlashcardsEditor simName={page.simName} onNavigate={setPage} />
        )}
        {page.type === 'simuladoDashboard' && (
          <FlashcardsDashboard simName={page.simName} onNavigate={setPage} />
        )}
      </main>

      {/* Global Quick Add Card Modal */}
      {isAddCardOpen && (
        <CardCreationModal onClose={() => setIsAddCardOpen(false)} />
      )}

      {/* Global Quick Note Modal */}
      {isQuickNoteOpen && (
        <NotepadModal
          onClose={() => setIsQuickNoteOpen(false)}
          targetId="quick-global-note"
          targetType="standalone"
        />
      )}
    </div>
  );
}
