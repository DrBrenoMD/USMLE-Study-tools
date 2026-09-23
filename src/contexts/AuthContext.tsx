import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { 
  User, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { cloudSyncService, SyncResult } from '../services/cloudSyncService';

export type SyncState = 'idle' | 'saving' | 'synced' | 'downloading' | 'error';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  syncState: SyncState;
  lastSyncTime: Date | null;
  syncResultInfo: SyncResult['itemsSynced'] | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  syncNow: () => Promise<boolean>;
  restoreFromCloud: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const saved = localStorage.getItem('usmle_last_cloud_sync');
    return saved ? new Date(saved) : null;
  });
  const [syncResultInfo, setSyncResultInfo] = useState<SyncResult['itemsSynced'] | null>(null);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sincronizar dados para a nuvem
  const syncNow = useCallback(async (): Promise<boolean> => {
    if (!currentUser) return false;
    setSyncState('saving');
    try {
      const res = await cloudSyncService.uploadAllToCloud(currentUser.uid);
      setSyncState('synced');
      setLastSyncTime(res.timestamp);
      setSyncResultInfo(res.itemsSynced || null);
      localStorage.setItem('usmle_last_cloud_sync', res.timestamp.toISOString());
      return true;
    } catch (err) {
      console.error("Erro ao sincronizar com a nuvem:", err);
      setSyncState('error');
      return false;
    }
  }, [currentUser]);

  // Restaurar dados da nuvem
  const restoreFromCloud = useCallback(async (): Promise<boolean> => {
    if (!currentUser) return false;
    setSyncState('downloading');
    try {
      const success = await cloudSyncService.downloadAndApplyFromCloud(currentUser.uid);
      if (success) {
        const now = new Date();
        setSyncState('synced');
        setLastSyncTime(now);
        localStorage.setItem('usmle_last_cloud_sync', now.toISOString());
      } else {
        setSyncState('idle');
      }
      return success;
    } catch (err) {
      console.error("Erro ao restaurar da nuvem:", err);
      setSyncState('error');
      return false;
    }
  }, [currentUser]);

  // Login com Google via Popup
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Salvar/atualizar perfil do usuário no Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        lastLoginAt: new Date().toISOString(),
      }, { merge: true });

      // Verificar se o usuário já tem dados na nuvem
      const hasData = await cloudSyncService.hasCloudData(user.uid);
      if (hasData) {
        // Baixar dados da nuvem
        await cloudSyncService.downloadAndApplyFromCloud(user.uid);
        setSyncState('synced');
        const now = new Date();
        setLastSyncTime(now);
        localStorage.setItem('usmle_last_cloud_sync', now.toISOString());
      } else {
        // Primeiro login com dados locais prévios: fazer upload dos dados locais automaticamente
        const uploadRes = await cloudSyncService.uploadAllToCloud(user.uid);
        setSyncState('synced');
        setLastSyncTime(uploadRes.timestamp);
        setSyncResultInfo(uploadRes.itemsSynced || null);
        localStorage.setItem('usmle_last_cloud_sync', uploadRes.timestamp.toISOString());
      }
    } catch (err) {
      console.error("Falha na autenticação Google:", err);
      throw err;
    }
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setSyncState('idle');
    } catch (err) {
      console.error("Erro ao sair:", err);
    }
  };

  // Observador de estado de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(false);

      if (user) {
        // Se já está logado na inicialização, tenta sincronização inicial se necessário
        try {
          const hasData = await cloudSyncService.hasCloudData(user.uid);
          if (hasData) {
            await cloudSyncService.downloadAndApplyFromCloud(user.uid);
            setSyncState('synced');
            setLastSyncTime(new Date());
          }
        } catch (e) {
          console.warn("Sincronização inicial em background:", e);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Debounced auto-save quando eventos locais ocorrem
  useEffect(() => {
    if (!currentUser) return;

    const triggerDebouncedSync = () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        syncNow();
      }, 5000); // 5 segundos de inatividade após mudanças
    };

    window.addEventListener('usmle_logs_updated', triggerDebouncedSync);
    window.addEventListener('usmle_tracker_updated', triggerDebouncedSync);
    window.addEventListener('usmle_scores_updated', triggerDebouncedSync);

    return () => {
      window.removeEventListener('usmle_logs_updated', triggerDebouncedSync);
      window.removeEventListener('usmle_tracker_updated', triggerDebouncedSync);
      window.removeEventListener('usmle_scores_updated', triggerDebouncedSync);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [currentUser, syncNow]);

  return (
    <AuthContext.Provider value={{
      currentUser,
      loading,
      syncState,
      lastSyncTime,
      syncResultInfo,
      signInWithGoogle,
      logout,
      syncNow,
      restoreFromCloud,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
