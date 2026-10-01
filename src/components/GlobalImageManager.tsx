import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Copy,
  Minimize2,
  Maximize2,
  Sparkles,
  Scissors,
  Check,
  ZoomIn,
  Move,
  Layers,
  FileText
} from 'lucide-react';
import { ImageOcclusionClozeModal } from './ImageOcclusionClozeModal';

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  targetImg: HTMLImageElement | null;
  isMiniaturized: boolean;
}

interface ResizeHandleState {
  active: boolean;
  img: HTMLImageElement | null;
  corner: 'nw' | 'ne' | 'se' | 'sw' | 'e' | 's' | null;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  aspectRatio: number;
}

export const GlobalImageManager: React.FC = () => {
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    targetImg: null,
    isMiniaturized: false
  });

  // Cloze Modal State
  const [clozeModalOpen, setClozeModalOpen] = useState(false);
  const [clozeModalImgUrl, setClozeModalImgUrl] = useState<string>('');
  const [activeEditorElement, setActiveEditorElement] = useState<HTMLElement | null>(null);

  // Hovered / Selected Image for Resizing
  const [hoveredImg, setHoveredImg] = useState<HTMLImageElement | null>(null);
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [imgRect, setImgRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [currentDimension, setCurrentDimension] = useState<{ width: number; height: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const resizeStateRef = useRef<ResizeHandleState>({
    active: false,
    img: null,
    corner: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    aspectRatio: 1
  });

  // Helper to show brief toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Update overlay bounding rect
  const updateOverlayRect = useCallback(() => {
    const target = selectedImg || hoveredImg;
    if (target && document.body.contains(target)) {
      const rect = target.getBoundingClientRect();
      // Only show if image is visible
      if (rect.width > 20 && rect.height > 20) {
        setImgRect({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        });
        setCurrentDimension({
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });
        return;
      }
    }
    if (!isResizing) {
      setImgRect(null);
      setCurrentDimension(null);
    }
  }, [selectedImg, hoveredImg, isResizing]);

  // Track scrolling / resizing to keep overlay aligned
  useEffect(() => {
    window.addEventListener('scroll', updateOverlayRect, true);
    window.addEventListener('resize', updateOverlayRect);
    return () => {
      window.removeEventListener('scroll', updateOverlayRect, true);
      window.removeEventListener('resize', updateOverlayRect);
    };
  }, [updateOverlayRect]);

  // Global mouse event listener for images
  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      if (isResizing) return;
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'IMG') {
        const img = target as HTMLImageElement;
        // Skip tiny icons or avatar badges
        const r = img.getBoundingClientRect();
        if (r.width > 40 && r.height > 40) {
          setHoveredImg(img);
        }
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      if (isResizing) return;
      const target = e.target as HTMLElement;
      const related = e.relatedTarget as HTMLElement;
      if (target && target.tagName === 'IMG') {
        if (!related || !related.closest?.('.image-resize-overlay')) {
          setHoveredImg(null);
        }
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Close context menu if clicked outside
      if (!target.closest('.image-custom-context-menu')) {
        setContextMenu(prev => ({ ...prev, isOpen: false }));
      }

      // Check if clicked a miniaturized image to toggle expand
      if (target && target.tagName === 'IMG') {
        const img = target as HTMLImageElement;
        if (img.getAttribute('data-miniaturized') === 'true') {
          toggleMiniaturizeImage(img, false);
          e.stopPropagation();
          e.preventDefault();
          return;
        }

        const r = img.getBoundingClientRect();
        if (r.width > 40 && r.height > 40) {
          setSelectedImg(img);
          return;
        }
      }

      if (!target.closest('.image-resize-overlay') && !target.closest('img')) {
        setSelectedImg(null);
      }
    };

    // Right click context menu on images
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'IMG') {
        e.preventDefault();
        e.stopPropagation();

        const img = target as HTMLImageElement;
        const isMini = img.getAttribute('data-miniaturized') === 'true';

        // Find nearest contentEditable container if any
        const editor = img.closest('[contenteditable="true"]') as HTMLElement | null;
        setActiveEditorElement(editor);

        // Calculate positioning within viewport
        const menuWidth = 230;
        const menuHeight = 180;
        let posX = e.clientX;
        let posY = e.clientY;

        if (posX + menuWidth > window.innerWidth) {
          posX = window.innerWidth - menuWidth - 10;
        }
        if (posY + menuHeight > window.innerHeight) {
          posY = window.innerHeight - menuHeight - 10;
        }

        setContextMenu({
          isOpen: true,
          x: posX,
          y: posY,
          targetImg: img,
          isMiniaturized: isMini
        });
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleClick);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isResizing]);

  // Update overlay rect when hovered/selected image changes
  useEffect(() => {
    updateOverlayRect();
  }, [hoveredImg, selectedImg, updateOverlayRect]);

  // Miniaturize toggle handler
  const toggleMiniaturizeImage = (img: HTMLImageElement, shouldMiniaturize: boolean) => {
    if (shouldMiniaturize) {
      // Save original dimensions in data attributes
      const currentWidth = img.style.width || `${img.naturalWidth || img.clientWidth}px`;
      const currentHeight = img.style.height || 'auto';
      img.setAttribute('data-original-width', currentWidth);
      img.setAttribute('data-original-height', currentHeight);
      img.setAttribute('data-miniaturized', 'true');

      // Apply miniaturized compact styles
      img.style.width = '100px';
      img.style.height = '68px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '8px';
      img.style.border = '2px solid #6366f1';
      img.style.cursor = 'zoom-in';
      img.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
      img.style.display = 'inline-block';
      img.style.margin = '4px';
      img.title = '🔍 Miniatura (Clique para re-expandir ao tamanho original)';

      showToast('🔍 Imagem miniaturizada! Clique nela para expandir.');
    } else {
      // Restore original dimensions
      const origWidth = img.getAttribute('data-original-width') || 'auto';
      const origHeight = img.getAttribute('data-original-height') || 'auto';
      img.removeAttribute('data-miniaturized');

      img.style.width = origWidth;
      img.style.height = origHeight;
      img.style.objectFit = 'contain';
      img.style.borderRadius = '12px';
      img.style.border = '';
      img.style.cursor = 'default';
      img.style.boxShadow = '';
      img.style.display = '';
      img.style.margin = '';
      img.title = '';

      showToast('✨ Imagem re-expandida ao tamanho original.');
    }

    // Trigger input event if inside contenteditable
    const editor = img.closest('[contenteditable="true"]');
    if (editor) {
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    setContextMenu(prev => ({ ...prev, isOpen: false }));
    updateOverlayRect();
  };

  // Copy Image handler
  const handleCopyImage = async (img: HTMLImageElement) => {
    try {
      // 1. Try to copy as actual image blob via canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.naturalWidth || img.clientWidth;
      canvas.height = img.naturalHeight || img.clientHeight;

      if (ctx) {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(async (blob) => {
          if (blob && navigator.clipboard && navigator.clipboard.write) {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
              ]);
              showToast('📋 Imagem copiada para a área de transferência!');
              setContextMenu(prev => ({ ...prev, isOpen: false }));
              return;
            } catch (err) {
              // Fallback to text copy
            }
          }
          // Fallback: copy image src URL or HTML
          await navigator.clipboard.writeText(img.src);
          showToast('📋 Link da imagem copiado com sucesso!');
          setContextMenu(prev => ({ ...prev, isOpen: false }));
        }, 'image/png');
      } else {
        await navigator.clipboard.writeText(img.src);
        showToast('📋 Imagem copiada!');
        setContextMenu(prev => ({ ...prev, isOpen: false }));
      }
    } catch (e) {
      await navigator.clipboard.writeText(img.src);
      showToast('📋 Link da imagem copiado!');
      setContextMenu(prev => ({ ...prev, isOpen: false }));
    }
  };

  // Open Cloze modal for the image
  const handleOpenClozeModal = (img: HTMLImageElement) => {
    setClozeModalImgUrl(img.src);
    setClozeModalOpen(true);
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  };

  // Drag Corner Resize logic
  const handleStartResize = (
    e: React.MouseEvent,
    corner: 'nw' | 'ne' | 'se' | 'sw' | 'e' | 's'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const target = selectedImg || hoveredImg;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const currentW = rect.width;
    const currentH = rect.height;
    const ratio = currentW / (currentH || 1);

    resizeStateRef.current = {
      active: true,
      img: target,
      corner,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: currentW,
      startHeight: currentH,
      aspectRatio: ratio
    };

    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const state = resizeStateRef.current;
      if (!state.active || !state.img) return;

      const deltaX = e.clientX - state.startX;
      const deltaY = e.clientY - state.startY;

      let newWidth = state.startWidth;

      if (state.corner === 'se' || state.corner === 'ne' || state.corner === 'e') {
        newWidth = Math.max(80, state.startWidth + deltaX);
      } else if (state.corner === 'sw' || state.corner === 'nw') {
        newWidth = Math.max(80, state.startWidth - deltaX);
      } else if (state.corner === 's') {
        const newHeight = Math.max(60, state.startHeight + deltaY);
        newWidth = newHeight * state.aspectRatio;
      }

      // Constrain to maximum parent width
      const parentW = state.img.parentElement?.clientWidth || window.innerWidth;
      newWidth = Math.min(newWidth, parentW);

      state.img.style.width = `${Math.round(newWidth)}px`;
      state.img.style.height = 'auto';
      state.img.style.maxWidth = '100%';

      setCurrentDimension({
        width: Math.round(newWidth),
        height: Math.round(newWidth / state.aspectRatio)
      });

      // Update overlay coordinates smoothly
      const r = state.img.getBoundingClientRect();
      setImgRect({
        top: r.top + window.scrollY,
        left: r.left + window.scrollX,
        width: r.width,
        height: r.height
      });
    };

    const handleMouseUp = () => {
      const state = resizeStateRef.current;
      if (state.active && state.img) {
        // Trigger save if in contenteditable
        const editor = state.img.closest('[contenteditable="true"]');
        if (editor) {
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }

        state.active = false;
        setIsResizing(false);
        updateOverlayRect();
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, updateOverlayRect]);

  const activeTarget = selectedImg || hoveredImg;

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-gray-900/95 dark:bg-white/95 text-white dark:text-gray-900 px-4 py-2.5 rounded-xl shadow-2xl border border-gray-700 dark:border-gray-200 text-xs font-medium flex items-center gap-2 animate-slide-up backdrop-blur-md">
          <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Resize Overlay with 4 Corner Handles + Edges */}
      {imgRect && activeTarget && (
        <div
          style={{
            top: `${imgRect.top}px`,
            left: `${imgRect.left}px`,
            width: `${imgRect.width}px`,
            height: `${imgRect.height}px`
          }}
          className={`image-resize-overlay fixed pointer-events-none z-[9000] border-2 transition-colors ${
            isResizing
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-indigo-400/80 hover:border-indigo-600'
          }`}
        >
          {/* Dimension Tooltip Badge */}
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white text-[10px] font-mono px-2 py-0.5 rounded-md shadow-md pointer-events-none whitespace-nowrap flex items-center gap-1.5">
            <Move className="w-2.5 h-2.5 text-indigo-400" />
            {currentDimension ? `${currentDimension.width} × ${currentDimension.height}px` : 'Redimensionar'}
          </div>

          {/* Top-Left Corner Handle */}
          <div
            onMouseDown={(e) => handleStartResize(e, 'nw')}
            className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform"
            title="Arraste para redimensionar"
          />

          {/* Top-Right Corner Handle */}
          <div
            onMouseDown={(e) => handleStartResize(e, 'ne')}
            className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform"
            title="Arraste para redimensionar"
          />

          {/* Bottom-Right Corner Handle */}
          <div
            onMouseDown={(e) => handleStartResize(e, 'se')}
            className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform"
            title="Arraste para redimensionar"
          />

          {/* Bottom-Left Corner Handle */}
          <div
            onMouseDown={(e) => handleStartResize(e, 'sw')}
            className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform"
            title="Arraste para redimensionar"
          />

          {/* Right Center Handle */}
          <div
            onMouseDown={(e) => handleStartResize(e, 'e')}
            className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-5 bg-white border-2 border-indigo-600 rounded-sm shadow-md cursor-ew-resize pointer-events-auto hover:scale-110 transition-transform"
            title="Ajustar largura"
          />

          {/* Bottom Center Handle */}
          <div
            onMouseDown={(e) => handleStartResize(e, 's')}
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-2.5 bg-white border-2 border-indigo-600 rounded-sm shadow-md cursor-ns-resize pointer-events-auto hover:scale-110 transition-transform"
            title="Ajustar altura"
          />
        </div>
      )}

      {/* Floating Right-Click Context Menu */}
      {contextMenu.isOpen && contextMenu.targetImg && (
        <div
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`
          }}
          className="image-custom-context-menu fixed z-[9999] w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-1.5 text-gray-800 dark:text-gray-200 animate-scale-in select-none"
        >
          <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800/80 mb-1">
            <span className="text-[10px] font-semibold tracking-wider text-gray-400 dark:text-gray-500 uppercase">
              Opções da Imagem
            </span>
          </div>

          {/* Copiar */}
          <button
            onClick={() => contextMenu.targetImg && handleCopyImage(contextMenu.targetImg)}
            className="w-full px-3 py-2 text-xs font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2.5 transition-colors cursor-pointer text-left"
          >
            <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
              <Copy className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">Copiar Imagem</div>
              <div className="text-[10px] text-gray-400">Salvar na área de transferência</div>
            </div>
          </button>

          {/* Miniaturizar / Expandir */}
          <button
            onClick={() => contextMenu.targetImg && toggleMiniaturizeImage(contextMenu.targetImg, !contextMenu.isMiniaturized)}
            className="w-full px-3 py-2 text-xs font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2.5 transition-colors cursor-pointer text-left"
          >
            <div className="p-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
              {contextMenu.isMiniaturized ? (
                <Maximize2 className="w-3.5 h-3.5" />
              ) : (
                <Minimize2 className="w-3.5 h-3.5" />
              )}
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                {contextMenu.isMiniaturized ? 'Expandir Imagem' : 'Miniaturizar'}
              </div>
              <div className="text-[10px] text-gray-400">
                {contextMenu.isMiniaturized ? 'Restaurar tamanho original' : 'Reduzir espaço na tela'}
              </div>
            </div>
          </button>

          {/* Adicionar Clozes */}
          <button
            onClick={() => contextMenu.targetImg && handleOpenClozeModal(contextMenu.targetImg)}
            className="w-full px-3 py-2 text-xs font-medium rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 flex items-center gap-2.5 transition-colors cursor-pointer text-left mt-0.5"
          >
            <div className="p-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-semibold">Adicionar Clozes</div>
              <div className="text-[10px] text-indigo-500/80 dark:text-indigo-400/80">Oclusão de imagem [c1, c2...]</div>
            </div>
          </button>
        </div>
      )}

      {/* Image Occlusion Cloze Modal */}
      <ImageOcclusionClozeModal
        isOpen={clozeModalOpen}
        onClose={() => setClozeModalOpen(false)}
        imageUrl={clozeModalImgUrl}
        onInsertIntoEditor={(html) => {
          if (activeEditorElement) {
            document.execCommand('insertHTML', false, html);
            activeEditorElement.dispatchEvent(new Event('input', { bubbles: true }));
            showToast('✨ Imagem com clozes inserida no editor!');
          }
        }}
      />
    </>
  );
};
