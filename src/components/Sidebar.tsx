import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BarChart2, Activity, Calculator, LineChart, Layers, X, BookOpen, Chrome, Cloud, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { currentUser, syncState, syncNow, signInWithGoogle } = useAuth();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const navItems = [
    { name: 'Início', path: '/', icon: Home },
    { name: 'Study Tracker', path: '/tracker', icon: BarChart2 },
    { name: 'Pacer de Questões', path: '/pacer', icon: Activity },
    { name: 'Extensão Chrome', path: '/extensao', icon: Chrome },
    { name: 'Calculadora NBME', path: '/calculator', icon: Calculator },
    { name: 'Score Predictor', path: '/predictor', icon: LineChart },
    { name: 'Flashcards', path: '/flashcards', icon: Layers },
    { name: 'Banco de Questões', path: '/questions', icon: BookOpen },
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-50 transition-opacity" />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-full w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50 transform transition-transform duration-300 ease-in-out shadow-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white text-lg">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-500" />
            <span>Navegação</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${
                  isActive 
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600 dark:text-blue-500' : ''}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          {currentUser ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Nuvem Conectada</span>
                </div>
                {syncState === 'saving' ? (
                  <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                )}
              </div>
              <button
                onClick={() => syncNow()}
                className="w-full py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Fazer Backup Agora</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                onClose();
                signInWithGoogle();
              }}
              className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Salvar na Nuvem (Login)</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
