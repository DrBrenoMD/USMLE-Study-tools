/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Route, Routes, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import Home from "./pages/Home";
import StudyTracker from "./pages/StudyTracker";
import PacerPage from "./pages/Pacer";
import NBMECalculator from "./pages/NBMECalculator";
import ScorePredictor from "./pages/ScorePredictor";
import FlashcardsLobby from "./pages/FlashcardsLobby";
import FlashcardsEditor from "./pages/FlashcardsEditor";
import FlashcardsDashboard from "./pages/FlashcardsDashboard";
import { TopBarTimer } from "./components/TopBarTimer";
import { ChevronLeft, Palette, Menu } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { ThemeSelector, themes } from "./components/ThemeSelector";

function AppContent() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  
  const [activeTheme, setActiveTheme] = useState(() => {
    const saved = localStorage.getItem('app-theme-id');
    return themes.find(t => t.id === saved) || themes.find(t => t.id === 'dark-default');
  });
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    // Reset all theme classes first
    document.documentElement.className = '';
    // Add current theme class(es)
    if (activeTheme.class) {
      const classes = activeTheme.class.split(' ');
      classes.forEach(c => document.documentElement.classList.add(c));
    }
    localStorage.setItem('app-theme-id', activeTheme.id);
  }, [activeTheme]);

  return (
    <div className="min-h-screen bg-brand-bg-light dark:bg-brand-bg-dark flex flex-col font-sans transition-colors duration-200">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <ThemeSelector 
        isOpen={isThemeModalOpen} 
        onClose={() => setIsThemeModalOpen(false)} 
        currentTheme={activeTheme} 
        onSelectTheme={setActiveTheme} 
      />
      
      {/* Top Bar */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 h-14 flex items-center justify-between px-4 sm:px-6 transition-colors duration-200">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mr-1 sm:mr-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          {!isHome && (
            <Link to="/" className="hidden sm:block p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-gray-500 dark:text-gray-400 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
          )}
          <Link to="/" className="flex items-baseline gap-2 font-bold text-gray-900 dark:text-white text-lg">
            USMLE Study Tools
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:inline">By Breno, MD</span>
          </Link>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsThemeModalOpen(true)}
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Temas e Aparência"
          >
            <Palette className="w-4 h-4" />
          </button>
          <TopBarTimer />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tracker" element={<StudyTracker />} />
          <Route path="/pacer" element={<PacerPage />} />
          <Route path="/calculator" element={<NBMECalculator />} />
          <Route path="/predictor" element={<ScorePredictor />} />
          <Route path="/flashcards" element={<FlashcardsLobby />} />
          <Route path="/flashcards/editor" element={<FlashcardsEditor />} />
          <Route path="/flashcards/dashboard" element={<FlashcardsDashboard />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
