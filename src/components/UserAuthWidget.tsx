import { useState, useRef, useEffect } from 'react';
import { 
  Cloud, 
  CheckCircle2, 
  RefreshCw, 
  LogOut, 
  LogIn, 
  DownloadCloud, 
  UploadCloud, 
  Layers, 
  CalendarDays, 
  BarChart2, 
  ShieldCheck,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function UserAuthWidget() {
  const { 
    currentUser, 
    loading, 
    syncState, 
    lastSyncTime, 
    syncResultInfo, 
    signInWithGoogle, 
    logout, 
    syncNow, 
    restoreFromCloud 
  } = useAuth();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleSignIn = async () => {
    try {
      setIsActionLoading(true);
      setLoginError(null);
      await signInWithGoogle();
      setIsLoginModalOpen(false);
      setFeedbackMsg('Login realizado com sucesso! Seus dados foram sincronizados.');
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (e: any) {
      console.error("Firebase Auth Error:", e);
      const code = e?.code || '';
      let msg = 'Não foi possível concluir o login com o Google.';
      if (code === 'auth/unauthorized-domain') {
        msg = `Domínio não autorizado (${window.location.hostname}). Adicione este domínio no Firebase Console > Authentication > Settings > Authorized domains.`;
      } else if (code === 'auth/operation-not-allowed') {
        msg = 'O provedor Google ainda não está ativado no Firebase. Ative-o em Authentication > Sign-in method.';
      } else if (code === 'auth/popup-closed-by-user') {
        msg = 'A janela do Google foi fechada antes de finalizar.';
      } else if (code === 'auth/popup-blocked') {
        msg = 'O navegador bloqueou a janela pop-up do Google. Permita pop-ups para este site.';
      } else if (e?.message) {
        msg = `Erro (${code || 'Auth'}): ${e.message}`;
      }
      setLoginError(msg);
      setFeedbackMsg(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleManualSync = async () => {
    setIsActionLoading(true);
    const ok = await syncNow();
    setIsActionLoading(false);
    if (ok) {
      setFeedbackMsg('Dados salvos na nuvem com sucesso!');
    } else {
      setFeedbackMsg('Erro ao salvar na nuvem. Verifique sua conexão.');
    }
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleManualRestore = async () => {
    if (!window.confirm('Deseja baixar e restaurar os dados salvos na nuvem? Os dados locais serão atualizados com a versão mais recente da nuvem.')) {
      return;
    }
    setIsActionLoading(true);
    const ok = await restoreFromCloud();
    setIsActionLoading(false);
    if (ok) {
      setFeedbackMsg('Dados restaurados da nuvem com sucesso!');
    } else {
      setFeedbackMsg('Nenhum dado encontrado na nuvem para restaurar.');
    }
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 animate-pulse">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      </div>
    );
  }

  // Usuário deslogado
  if (!currentUser) {
    return (
      <>
        <button
          onClick={() => setIsLoginModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all cursor-pointer shadow-xs active:scale-95"
          title="Fazer Login e Salvar na Nuvem"
        >
          <Cloud className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Salvar na Nuvem</span>
          <span className="sm:hidden">Entrar</span>
        </button>

        {/* Modal de Apresentação e Login */}
        {isLoginModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">Salvar Dados na Nuvem</h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Sincronize seu estudo entre qualquer dispositivo</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsLoginModalOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 flex flex-col gap-4">
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  Conecte sua conta para garantir que todos os seus registros de estudo fiquem salvos em tempo real com backup automático:
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                    <Layers className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="font-medium text-gray-700 dark:text-gray-300 text-[11px]">Flashcards & Cadernos</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                    <CalendarDays className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="font-medium text-gray-700 dark:text-gray-300 text-[11px]">Planejamento & Logs</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                    <BarChart2 className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="font-medium text-gray-700 dark:text-gray-300 text-[11px]">Scores & Métricas</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                    <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="font-medium text-gray-700 dark:text-gray-300 text-[11px]">Preferências & Temas</span>
                  </div>
                </div>

                {loginError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs">
                    <p className="font-semibold mb-0.5">Aviso de Login:</p>
                    <p className="text-[11px] leading-relaxed">{loginError}</p>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={handleSignIn}
                    disabled={isActionLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isActionLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>Continuar com o Google</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[10px] text-center text-gray-400 dark:text-gray-500">
                  Login seguro via Firebase Authentication. Seus dados nunca são compartilhados.
                </p>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Usuário autenticado
  return (
    <div className="relative" ref={menuRef}>
      {/* Botão de Status / Avatar no Header */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center gap-2 p-1.5 pr-2.5 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors cursor-pointer border border-gray-200 dark:border-gray-700"
        title="Perfil e Sincronização na Nuvem"
      >
        {currentUser.photoURL ? (
          <img 
            src={currentUser.photoURL} 
            alt={currentUser.displayName || 'Avatar'} 
            className="w-6 h-6 rounded-full object-cover border border-white dark:border-gray-900" 
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
            {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {syncState === 'saving' || syncState === 'downloading' || isActionLoading ? (
            <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
          ) : syncState === 'error' ? (
            <span className="w-2 h-2 rounded-full bg-rose-500" title="Erro na sincronização" />
          ) : (
            <Cloud className="w-3.5 h-3.5 text-emerald-500" title="Nuvem Sincronizada" />
          )}
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 max-w-[100px] truncate hidden md:inline">
            {currentUser.displayName?.split(' ')[0] || 'Conta'}
          </span>
        </div>
      </button>

      {/* Menu / Dropdown de Detalhes da Nuvem */}
      {isMenuOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-4 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-3">
          {/* Header do Usuário */}
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
            {currentUser.photoURL ? (
              <img 
                src={currentUser.photoURL} 
                alt="Avatar" 
                className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700" 
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-base flex items-center justify-center">
                {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
                {currentUser.displayName || 'Estudante USMLE'}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {currentUser.email}
              </span>
            </div>
          </div>

          {/* Feedback de ação */}
          {feedbackMsg && (
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-medium border border-blue-200 dark:border-blue-800/80 animate-in fade-in">
              {feedbackMsg}
            </div>
          )}

          {/* Status da Sincronização */}
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Status da Nuvem:</span>
              {syncState === 'saving' || isActionLoading ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Salvando...
                </span>
              ) : syncState === 'downloading' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Baixando...
                </span>
              ) : syncState === 'error' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  Falha na sincronização
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> Sincronizado
                </span>
              )}
            </div>

            {lastSyncTime && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                Último backup: {formatDistanceToNow(lastSyncTime, { addSuffix: true, locale: ptBR })}
              </span>
            )}

            {syncResultInfo && (
              <div className="mt-1 pt-2 border-t border-gray-200/60 dark:border-gray-700/60 grid grid-cols-2 gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                <span>🗂️ {syncResultInfo.flashcards} flashcards</span>
                <span>📓 {syncResultInfo.notebooks} cadernos</span>
                <span>📝 {syncResultInfo.studyLogs} logs de estudo</span>
                <span>📈 {syncResultInfo.scores} scores</span>
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={handleManualSync}
              disabled={isActionLoading}
              className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Sincronizar Agora (Salvar)</span>
            </button>

            <button
              onClick={handleManualRestore}
              disabled={isActionLoading}
              className="w-full py-2 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Restaurar Dados da Nuvem</span>
            </button>

            <button
              onClick={() => {
                logout();
                setIsMenuOpen(false);
              }}
              className="w-full py-2 px-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
