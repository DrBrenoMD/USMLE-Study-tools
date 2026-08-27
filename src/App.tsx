/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Route, Routes, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import Home from "./pages/Home";
import StudyTracker from "./pages/StudyTracker";
import PacerPage from "./pages/Pacer";
import NBMECalculator from "./pages/NBMECalculator";
import ScorePredictor from "./pages/ScorePredictor";
import FlashcardsLobby from "./pages/FlashcardsLobby";
import FlashcardsEditor from "./pages/FlashcardsEditor";
import FlashcardsDashboard from "./pages/FlashcardsDashboard";
import { QuestionPacer } from "./components/QuestionPacer";
import { Activity, X, ChevronLeft } from "lucide-react";

function AppContent() {
  const [isPacerFloating, setIsPacerFloating] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col font-sans">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 h-14 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          {!isHome && (
            <Link to="/" className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
          )}
          <Link to="/" className="flex items-baseline gap-2 font-bold text-gray-900 text-lg">
            USMLE Study Tools
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:inline">By Breno, MD</span>
          </Link>
        </div>
        
        <button 
          onClick={() => setIsPacerFloating(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-semibold transition-colors"
        >
          <Activity className="w-4 h-4" />
          <span className="hidden sm:inline">Pacer Rápido</span>
        </button>
      </header>

      {/* Floating Pacer Modal */}
      {isPacerFloating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-transparent animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsPacerFloating(false)}
              className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
               <QuestionPacer className="mt-0" />
            </div>
          </div>
        </div>
      )}

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
