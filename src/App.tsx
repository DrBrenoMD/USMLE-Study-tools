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
import { ChevronLeft, Moon, Sun } from "lucide-react";

function AppContent() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#191d2d] flex flex-col font-sans transition-colors duration-200">
      {/* Top Bar */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 h-14 flex items-center justify-between px-4 sm:px-6 transition-colors duration-200">
        <div className="flex items-center gap-4">
          {!isHome && (
            <Link to="/" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-gray-500 dark:text-gray-400 transition-colors">
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
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Alternar Tema"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
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
