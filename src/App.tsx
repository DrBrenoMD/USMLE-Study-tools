/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Route, Routes, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import StudyTracker from "./pages/StudyTracker";
import PacerPage from "./pages/Pacer";
import NBMECalculator from "./pages/NBMECalculator";
import ScorePredictor from "./pages/ScorePredictor";
import FlashcardsLobby from "./pages/FlashcardsLobby";
import FlashcardsEditor from "./pages/FlashcardsEditor";
import FlashcardsDashboard from "./pages/FlashcardsDashboard";
import { TopBarTimer } from "./components/TopBarTimer";
import { ChevronLeft } from "lucide-react";

function AppContent() {
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
        
        <div className="flex items-center gap-3">
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
