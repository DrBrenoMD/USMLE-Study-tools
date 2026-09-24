import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home as DecksHome } from '../cardblocks/pages/Home';
import { DeckView } from '../cardblocks/pages/DeckView';
import { StudySession } from '../cardblocks/pages/StudySession';
import { SettingsView } from '../cardblocks/pages/SettingsView';
import { BrowseView } from '../cardblocks/pages/BrowseView';
import { HelpView } from '../cardblocks/pages/HelpView';

import { CardCreationModal } from '../cardblocks/components/CardCreationModal';
import { ToastContainer } from '../cardblocks/components/ToastContainer';
import { MouseInteractiveBackground } from '../components/MouseInteractiveBackground';
import { useTimerStore } from '../store/useTimerStore';
import { cn } from '../cardblocks/lib/utils';
import { Page } from '../cardblocks/App';

import {
  Layers,
  Search,
  HelpCircle,
  Settings,
  PlusCircle,
  Activity,
  Play,
  X,
  BookOpen,
} from 'lucide-react';

export type FlashcardPage = Page;

export default function FlashcardsUnifiedHub() {
  const location = useLocation();
  const navigate = useNavigate();

  // Modal states & imported data
  const [incomingImportData, setIncomingImportData] = useState<any>(null);
  const [isAddCardOpen, setIsAddCardOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('action') === 'create_card' || params.get('newCard') === 'true';
  });

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
    const tabParam = params.get('tab');

    if (tabParam === 'browse') return { type: 'browse' };
    if (tabParam === 'settings') return { type: 'settings' };
    if (tabParam === 'help') return { type: 'help' };

    return { type: 'home' };
  });

  // Sync state if route changes externally
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'browse') setPage({ type: 'browse' });
    if (params.get('action') === 'create_card' || params.get('newCard') === 'true') {
      setIsAddCardOpen(true);
    }
  }, [location.pathname, location.search]);

  // Listener Global para Mensagens da Extensão (BroadcastChannel, window.message e CustomEvents)
  useEffect(() => {
    // 1. Notifica e registra a URL atual para a extensão
    try {
      const currentAppUrl = window.location.origin + '/flashcards?tab=browse&action=create_card';
      window.postMessage({ type: 'USMLE_APP_URL_REGISTRATION', appUrl: currentAppUrl }, '*');
      localStorage.setItem('usmle_last_app_url', currentAppUrl);
    } catch (e) {}

    // Handler para processar dados de questão que chegam da extensão
    const handleIncomingData = (payload: any) => {
      if (!payload) return;
      setIncomingImportData(payload);
      setIsAddCardOpen(true);
    };

    // 2. BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('usmle_flashcards_sync');
      bc.onmessage = (event) => {
        if (event.data && (event.data.type === 'USMLE_GENERATE_FLASHCARD' || event.data.action === 'create_card_from_question')) {
          handleIncomingData(event.data.payload || event.data);
        }
      };
    } catch (e) {}

    // 3. window.postMessage
    const onWindowMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.type === 'USMLE_GENERATE_FLASHCARD' || event.data.action === 'create_card_from_question') {
        handleIncomingData(event.data.payload || event.data);
      }
    };
    window.addEventListener('message', onWindowMessage);

    // 4. CustomEvent
    const onCustomEvent = (e: any) => {
      if (e.detail) handleIncomingData(e.detail);
    };
    window.addEventListener('usmle_generate_flashcard' as any, onCustomEvent);

    // 5. Notificar opener se foi aberto via window.open
    if (window.opener) {
      try {
        window.opener.postMessage({ type: 'USMLE_FLASHCARD_TAB_READY' }, '*');
      } catch (e) {}
    }

    // 6. Consumir dados pendentes gravados no localStorage recentemente
    try {
      const stored = localStorage.getItem('pending_flashcard_import');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.questionId || parsed.questionStem)) {
          handleIncomingData(parsed);
          localStorage.removeItem('pending_flashcard_import');
        }
      }
    } catch (e) {}

    return () => {
      if (bc) bc.close();
      window.removeEventListener('message', onWindowMessage);
      window.removeEventListener('usmle_generate_flashcard' as any, onCustomEvent);
    };
  }, []);

  // Navigation tabs
  const isDecksActive = ['home', 'deck', 'study'].includes(page.type);
  const isBrowseActive = page.type === 'browse';

  return (
    <div className="flex-1 flex flex-col font-sans relative transition-colors duration-200 min-h-[calc(100vh-56px)] text-gray-900 dark:text-gray-100">
      <MouseInteractiveBackground />
      <ToastContainer />

      {/* Sub-Header & Navigation Bar */}
      <header className="w-full border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md sticky top-14 z-30 transition-colors shadow-xs">
        <div className="w-full px-2 sm:px-4 md:px-6 h-14 flex items-center justify-between gap-1 sm:gap-2">
          {/* Main Flashcard Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={() => setPage({ type: 'home' })}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0",
                isDecksActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
              title="Baralhos de Flashcards"
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>Baralhos</span>
            </button>

            <button
              onClick={() => setPage({ type: 'browse' })}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0",
                isBrowseActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
              title="Navegador de Cartões"
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span>Navegador</span>
            </button>

            <button
              onClick={() => navigate('/questions')}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all flex items-center gap-1.5 shrink-0"
              title="Banco de Questões USMLE"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0 text-blue-500" />
              <span>Banco de Questões</span>
            </button>
          </nav>

          {/* Right Action Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setIsAddCardOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Adicionar Flashcard rápido"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">+ Novo Cartão</span>
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
                  className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 ml-0.5 p-0.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer"
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
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
                title="Iniciar ritmo de 40 questões (72s/q)"
              >
                <Play className="w-3 h-3" />
                <span>Pacer 40Q</span>
              </button>
            )}

            <button
              onClick={() => setPage({ type: 'settings' })}
              className={cn(
                "p-1.5 rounded-xl transition-colors border cursor-pointer",
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
                "p-1.5 rounded-xl transition-colors border cursor-pointer",
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
            : page.type === 'study'
            ? "max-w-full p-0 sm:p-4"
            : "max-w-6xl"
        )}
      >
        {page.type === 'home' && <DecksHome onNavigate={setPage} />}
        {page.type === 'deck' && <DeckView deckId={page.deckId} onNavigate={setPage} />}
        {page.type === 'study' && <StudySession deckId={page.deckId} cardIds={page.cardIds} onNavigate={setPage} />}
        {page.type === 'settings' && <SettingsView onNavigate={setPage} />}
        {page.type === 'help' && <HelpView onNavigate={setPage} />}
        {page.type === 'browse' && (
          <BrowseView
            key={`browse-${page.date}-${page.deckId}`}
            onNavigate={setPage}
            initialDate={page.date}
            initialDeckId={page.deckId}
          />
        )}
      </main>

      {/* Global Quick Add Card Modal */}
      {isAddCardOpen && (
        <CardCreationModal 
          initialData={incomingImportData}
          onClose={() => {
            setIsAddCardOpen(false);
            setIncomingImportData(null);
          }} 
        />
      )}
    </div>
  );
}
