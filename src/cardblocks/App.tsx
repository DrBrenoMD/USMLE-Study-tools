/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useStore } from './store/useStore';
import { Home } from './pages/Home';
import { DeckView } from './pages/DeckView';
import { StudySession } from './pages/StudySession';
import { SettingsView } from './pages/SettingsView';
import { BrowseView } from './pages/BrowseView';
import { QuestionBanksView } from './pages/QuestionBanksView';
import { QuestionBankDetail } from './pages/QuestionBankDetail';
import { QuestionEditor } from './pages/QuestionEditor';
import { NotebooksView } from './pages/NotebooksView';
import { NotebookCreator } from './pages/NotebookCreator';
import { NotebookSession } from './pages/NotebookSession';
import { DashboardView } from './pages/DashboardView';
import { NotepadView } from './pages/NotepadView';
import { LibraryView } from './pages/LibraryView';
import { HelpView } from './pages/HelpView';
import { BookOpen, Settings, Search, HelpCircle, Archive, ScrollText, PieChart, Edit3, Layers, LogIn, LogOut } from 'lucide-react';
import { cn } from './lib/utils';
import { useTranslation } from './lib/i18n';

export type Page = 
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
  | { type: 'browse'; date?: string; deckId?: string; browseType?: 'flashcards' | 'questions' };


export default function App() {
  const [page, setPage] = useState<Page>({ type: 'home' });
  const { t } = useTranslation();
  const theme = useStore(state => state.settings?.theme || 'ocean');
  const upsertQuestionFromQBank = useStore(state => state.upsertQuestionFromQBank);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = ['light', 'paty', 'rose', 'sepia'].includes(theme) ? 'light' : 'dark';
  }, [theme]);

  // Listener Global para Sincronização e Importação de Questões do Q-Bank
  useEffect(() => {
    const handleIncomingQuestion = (qData: any) => {
      if (!qData || !qData.questionId) return;
      const formatted = {
        qid: qData.questionId,
        stem: qData.questionStem || qData.text,
        text: qData.questionStem || qData.text,
        alternatives: qData.alternatives || [],
        explanation: qData.explanation || '',
        educationalObjective: qData.educationalObjective || '',
        subject: qData.subject || '',
        system: qData.system || '',
        images: qData.questionImages || qData.images || [],
        tags: qData.tags || [],
      };
      upsertQuestionFromQBank(formatted);
    };

    // 1. BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('usmle_qbank_sync');
      bc.onmessage = (event) => {
        if (event.data?.type === 'QBANK_QUESTION_SYNC' && event.data.question) {
          handleIncomingQuestion(event.data.question);
        }
      };
    } catch (e) {}

    // 2. CustomEvent
    const handleCustomEvent = (e: any) => {
      if (e.detail?.question) {
        handleIncomingQuestion(e.detail.question);
      }
    };
    window.addEventListener('usmle_import_question', handleCustomEvent);

    // 3. PostMessage
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'QBANK_QUESTION_SYNC' && e.data.question) {
        handleIncomingQuestion(e.data.question);
      }
    };
    window.addEventListener('message', handleMessage);

    // 4. Verificação de pendentes no localStorage
    try {
      const pending = localStorage.getItem('pending_question_import');
      if (pending) {
        const parsed = JSON.parse(pending);
        handleIncomingQuestion(parsed);
      }
    } catch (e) {}

    return () => {
      if (bc) bc.close();
      window.removeEventListener('usmle_import_question', handleCustomEvent);
      window.removeEventListener('message', handleMessage);
    };
  }, [upsertQuestionFromQBank]);

  // Handle errors
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-h-screen text-ui-text font-sans relative transition-colors duration-300">
      <div className="bg-gradient-fixed"></div>
      
      <header className="border-b border-ui-border bg-ui-surface backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setPage({ type: 'home' })}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
            >
              <div className="bg-primary/20 border border-primary/30 p-1.5 rounded-xl flex items-center justify-center relative overflow-hidden">
                <img src="/logo.png" alt="" className="w-6 h-6 object-cover" onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                  svg.setAttribute('viewBox', '0 0 24 24');
                  svg.setAttribute('fill', 'none');
                  svg.setAttribute('stroke', 'currentColor');
                  svg.setAttribute('stroke-width', '2');
                  svg.setAttribute('stroke-linecap', 'round');
                  svg.setAttribute('stroke-linejoin', 'round');
                  svg.classList.add('w-5', 'h-5', 'text-primary');
                  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                  path.setAttribute('d', 'M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z');
                  svg.appendChild(path);
                  (e.target as HTMLElement).parentElement?.appendChild(svg);
                }} />
              </div>
              <h1 className="font-semibold text-xl tracking-tight text-ui-text hidden sm:block">
                Cardblocks
              </h1>
            </button>

            <nav className="flex items-center gap-1 sm:gap-2 border-l border-ui-border pl-4 sm:pl-6">
               <button
                 onClick={() => setPage({ type: 'browse' })}
                 className={cn(
                   "px-2 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
                   page.type === 'browse' ? "bg-ui-surface-hover text-ui-text" : "text-ui-muted hover:text-ui-text hover:bg-ui-surface"
                 )}
               >
                 <Search className="w-4 h-4 hidden sm:block" /> {t.menu.browse}
               </button>
               <button
                 onClick={() => setPage({ type: 'home' })}
                 className={cn(
                   "px-2 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
                   page.type === 'home' || page.type === 'deck' || page.type === 'study' ? "bg-ui-surface-hover text-ui-text" : "text-ui-muted hover:text-ui-text hover:bg-ui-surface"
                 )}
               >
                 <Layers className="w-4 h-4 hidden sm:block" /> {t.home.decks}
               </button>
               <button
                 onClick={() => setPage({ type: 'library' })}
                 className={cn(
                   "px-2 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
                   ['library', 'banks', 'bank', 'question', 'notebooks', 'notebook', 'dashboard'].includes(page.type) ? "bg-ui-surface-hover text-ui-text" : "text-ui-muted hover:text-ui-text hover:bg-ui-surface"
                 )}
               >
                 <HelpCircle className="w-4 h-4 hidden sm:block" /> Questions
               </button>
               <button
                 onClick={() => setPage({ type: 'notepad' })}
                 className={cn(
                   "px-2 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 hidden md:flex",
                   page.type === 'notepad' ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20" : "text-ui-muted hover:text-amber-500 hover:bg-amber-500/10"
                 )}
               >
                 <Edit3 className="w-4 h-4" /> Notepad
               </button>
            </nav>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button 
              onClick={() => setPage({ type: 'help' })}
              className={cn(
                "p-2 rounded-full transition-colors",
                page.type === 'help' ? "bg-ui-surface-hover text-ui-text" : "text-ui-muted hover:text-ui-text hover:bg-ui-surface-hover"
              )}
              title={"Help"}
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setPage({ type: 'settings' })}
              className={cn(
                "p-2 rounded-full transition-colors",
                page.type === 'settings' ? "bg-ui-surface-hover text-ui-text" : "text-ui-muted hover:text-ui-text hover:bg-ui-surface-hover"
              )}
              title={t.menu.settings}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className={cn("mx-auto px-4 py-8", page.type === 'browse' ? "max-w-[95%] w-full" : "max-w-5xl")}>
        {page.type === 'home' && <Home onNavigate={setPage} />}
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
        {page.type === 'browse' && <BrowseView key={`browse-${page.date}-${page.deckId}`} onNavigate={setPage} initialDate={page.date} initialDeckId={page.deckId} initialBrowseType={page.browseType} />}
      </main>
    </div>
  );
}
