import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export function useGlobalUndoRedo() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Ctrl (Windows/Linux) or Cmd (Mac) is pressed
      if (!e.ctrlKey && !e.metaKey) return;

      // Do not intercept if inside a regular text input/textarea/contenteditable where native text undo should handle single keystrokes
      const target = e.target as HTMLElement;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );

      // Handle Ctrl + Z (Undo) and Ctrl + Shift + Z / Ctrl + Y (Redo)
      if (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y') {
        const isRedo = (e.shiftKey && (e.key === 'z' || e.key === 'Z')) || (e.key === 'y' || e.key === 'Y');
        
        // If not typing in a raw text input (e.g. browsing cards, moving, editing questions, notes, cards at store level)
        if (!isInput) {
          e.preventDefault();
          try {
            const temporalState = (useStore as any).temporal?.getState?.();
            if (temporalState) {
              if (isRedo) {
                temporalState.redo();
                showUndoToast('↪️ Ação refeita (Redo)');
              } else {
                temporalState.undo();
                showUndoToast('↩️ Ação desfeita (Undo)');
              }
            }
          } catch (err) {
            console.error('Undo/Redo error:', err);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

function showUndoToast(message: string) {
  const existing = document.getElementById('global-undo-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'global-undo-toast';
  toast.className = 'fixed bottom-6 right-6 bg-gray-900/95 text-white dark:bg-white dark:text-gray-900 px-4 py-2 rounded-2xl shadow-2xl font-bold text-xs z-50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 border border-gray-700/50';
  toast.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 1800);
}
