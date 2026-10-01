import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Copy,
  Minimize2,
  Maximize2,
  Layers,
  RotateCcw,
  Check,
  X,
  Sparkles,
  Eye,
  Scissors
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ImageOcclusionTool } from './ImageOcclusionTool';

export interface ImageContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  targetImg: HTMLImageElement | null;
}

export function useImageInteractivity(containerRef: React.RefObject<HTMLElement | null>, onContentChange?: (newHtml: string) => void) {
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [contextMenu, setContextMenu] = useState<ImageContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    targetImg: null
  });
  const [showOcclusionModal, setShowOcclusionModal] = useState<boolean>(false);
  const [copiedFeedback, setCopiedFeedback] = useState<boolean>(false);

  // Resize Dragging State
  const [resizing, setResizing] = useState<{
    corner: 'nw' | 'ne' | 'se' | 'sw';
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    aspectRatio: number;
  } | null>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (contextMenu.isOpen) {
        setContextMenu(prev => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [contextMenu.isOpen]);

  // Handle right-click on images inside container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'IMG') {
        const img = target as HTMLImageElement;
        e.preventDefault();
        e.stopPropagation();
        setSelectedImg(img);
        setContextMenu({
          isOpen: true,
          x: Math.min(e.clientX, window.innerWidth - 220),
          y: Math.min(e.clientY, window.innerHeight - 200),
          targetImg: img
        });
      }
    };

    // Handle clicking image to select and show corner handles
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'IMG') {
        const img = target as HTMLImageElement;
        // If image is minimized thumbnail, clicking it expands it back!
        if (img.dataset.isMinimized === 'true' || img.classList.contains('minimized-img-thumbnail')) {
          img.dataset.isMinimized = 'false';
          img.classList.remove('minimized-img-thumbnail');
          img.style.width = img.dataset.originalWidth || '100%';
          img.style.maxWidth = '100%';
          img.style.cursor = 'default';
          img.title = '';
          if (onContentChange && container) {
            onContentChange(container.innerHTML);
          }
        } else {
          setSelectedImg(img);
        }
      } else {
        // If clicked outside resize handles and image, deselect
        if (!target.closest('.image-resize-handle') && !target.closest('.image-resize-box')) {
          setSelectedImg(null);
        }
      }
    };

    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('click', handleClick);
    };
  }, [containerRef, onContentChange]);

  // Corner resize dragging mouse move and up listeners
  useEffect(() => {
    if (!resizing || !selectedImg) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizing.startX;
      const deltaY = e.clientY - resizing.startY;

      let newWidth = resizing.startWidth;

      if (resizing.corner === 'se') {
        newWidth = Math.max(60, resizing.startWidth + deltaX);
      } else if (resizing.corner === 'sw') {
        newWidth = Math.max(60, resizing.startWidth - deltaX);
      } else if (resizing.corner === 'ne') {
        newWidth = Math.max(60, resizing.startWidth + deltaX);
      } else if (resizing.corner === 'nw') {
        newWidth = Math.max(60, resizing.startWidth - deltaX);
      }

      selectedImg.style.width = `${Math.round(newWidth)}px`;
      selectedImg.style.maxWidth = '100%';
      selectedImg.style.height = 'auto';
    };

    const handleMouseUp = () => {
      setResizing(null);
      if (onContentChange && containerRef.current) {
        onContentChange(containerRef.current.innerHTML);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, selectedImg, containerRef, onContentChange]);

  // Context Menu Actions
  const handleCopyImage = async () => {
    if (!contextMenu.targetImg) return;
    try {
      // Copy URL or HTML
      await navigator.clipboard.writeText(contextMenu.targetImg.src);
      setCopiedFeedback(true);
      setTimeout(() => {
        setCopiedFeedback(false);
        setContextMenu(prev => ({ ...prev, isOpen: false }));
      }, 1500);
    } catch (e) {
      console.error('Erro ao copiar imagem:', e);
    }
  };

  const handleToggleMiniaturize = () => {
    const img = contextMenu.targetImg;
    if (!img) return;

    const isCurrentlyMini = img.dataset.isMinimized === 'true' || img.classList.contains('minimized-img-thumbnail');

    if (isCurrentlyMini) {
      // Re-expand to original
      img.dataset.isMinimized = 'false';
      img.classList.remove('minimized-img-thumbnail');
      img.style.width = img.dataset.originalWidth || '100%';
      img.style.maxWidth = '100%';
      img.style.maxHeight = '';
      img.style.cursor = 'default';
      img.title = '';
    } else {
      // Miniaturize
      img.dataset.originalWidth = img.style.width || `${img.clientWidth}px`;
      img.dataset.isMinimized = 'true';
      img.classList.add('minimized-img-thumbnail');
      img.style.width = '120px';
      img.style.maxWidth = '120px';
      img.style.maxHeight = '90px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '8px';
      img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
      img.style.cursor = 'pointer';
      img.style.display = 'inline-block';
      img.style.margin = '4px';
      img.title = '🔍 Miniatura: Clique para re-expandir ao tamanho original';
    }

    setContextMenu(prev => ({ ...prev, isOpen: false }));
    if (onContentChange && containerRef.current) {
      onContentChange(containerRef.current.innerHTML);
    }
  };

  const handleOpenOcclusionTool = () => {
    setShowOcclusionModal(true);
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  };

  const handleResetSize = () => {
    const img = contextMenu.targetImg;
    if (!img) return;
    img.style.width = '100%';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.dataset.isMinimized = 'false';
    img.classList.remove('minimized-img-thumbnail');
    setContextMenu(prev => ({ ...prev, isOpen: false }));
    if (onContentChange && containerRef.current) {
      onContentChange(containerRef.current.innerHTML);
    }
  };

  const handleInsertOcclusion = (html: string) => {
    if (selectedImg && selectedImg.parentNode) {
      const tempWrapper = document.createElement('div');
      tempWrapper.innerHTML = html;
      const newElem = tempWrapper.firstElementChild;
      if (newElem) {
        selectedImg.parentNode.replaceChild(newElem, selectedImg);
      }
    }
    setShowOcclusionModal(false);
    if (onContentChange && containerRef.current) {
      onContentChange(containerRef.current.innerHTML);
    }
  };

  return {
    selectedImg,
    contextMenu,
    showOcclusionModal,
    copiedFeedback,
    resizing,
    setResizing,
    setSelectedImg,
    setShowOcclusionModal,
    handleCopyImage,
    handleToggleMiniaturize,
    handleOpenOcclusionTool,
    handleResetSize,
    handleInsertOcclusion
  };
}

export function ImageInteractiveOverlay({
  containerRef,
  selectedImg,
  contextMenu,
  showOcclusionModal,
  copiedFeedback,
  onStartResize,
  onCopyImage,
  onToggleMiniaturize,
  onOpenOcclusionTool,
  onResetSize,
  onInsertOcclusion,
  onCloseOcclusionModal
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  selectedImg: HTMLImageElement | null;
  contextMenu: ImageContextMenuState;
  showOcclusionModal: boolean;
  copiedFeedback: boolean;
  onStartResize: (corner: 'nw' | 'ne' | 'se' | 'sw', e: React.MouseEvent) => void;
  onCopyImage: () => void;
  onToggleMiniaturize: () => void;
  onOpenOcclusionTool: () => void;
  onResetSize: () => void;
  onInsertOcclusion: (html: string) => void;
  onCloseOcclusionModal: () => void;
}) {
  const [imgRect, setImgRect] = useState<DOMRect | null>(null);

  // Track position of selected image relative to viewport
  useEffect(() => {
    if (!selectedImg) {
      setImgRect(null);
      return;
    }

    const updateRect = () => {
      setImgRect(selectedImg.getBoundingClientRect());
    };

    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [selectedImg]);

  return (
    <>
      {/* 4 Corner Resize Handles when an image is selected */}
      {selectedImg && imgRect && (
        <div
          className="fixed pointer-events-none z-40 border-2 border-blue-500 rounded-lg shadow-sm"
          style={{
            top: imgRect.top,
            left: imgRect.left,
            width: imgRect.width,
            height: imgRect.height
          }}
        >
          {/* Top Left Corner */}
          <div
            onMouseDown={(e) => onStartResize('nw', e)}
            className="image-resize-handle pointer-events-auto absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-nwse-resize hover:scale-125 transition-transform"
            title="Arraste a quina para redimensionar"
          />

          {/* Top Right Corner */}
          <div
            onMouseDown={(e) => onStartResize('ne', e)}
            className="image-resize-handle pointer-events-auto absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-nesw-resize hover:scale-125 transition-transform"
            title="Arraste a quina para redimensionar"
          />

          {/* Bottom Left Corner */}
          <div
            onMouseDown={(e) => onStartResize('sw', e)}
            className="image-resize-handle pointer-events-auto absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-nesw-resize hover:scale-125 transition-transform"
            title="Arraste a quina para redimensionar"
          />

          {/* Bottom Right Corner */}
          <div
            onMouseDown={(e) => onStartResize('se', e)}
            className="image-resize-handle pointer-events-auto absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-nwse-resize hover:scale-125 transition-transform"
            title="Arraste a quina para redimensionar"
          />

          {/* Mini helper badge */}
          <div className="absolute top-2 right-2 pointer-events-auto bg-gray-900/85 text-white text-[10px] font-mono px-2 py-0.5 rounded-md shadow-xs backdrop-blur-xs">
            {Math.round(imgRect.width)}px
          </div>
        </div>
      )}

      {/* Right Click Context Menu for Images */}
      {contextMenu.isOpen && contextMenu.targetImg && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-850 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-1.5 min-w-[210px] text-xs font-semibold animate-in fade-in zoom-in-95 duration-150"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span>Opções da Imagem</span>
            <span className="font-mono text-blue-500">{Math.round(contextMenu.targetImg.clientWidth)}px</span>
          </div>

          <button
            onClick={onCopyImage}
            className="w-full px-3.5 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-300 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            {copiedFeedback ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
            <span>{copiedFeedback ? 'Copiado para o Clipboard!' : 'Copiar Imagem / URL'}</span>
          </button>

          <button
            onClick={onToggleMiniaturize}
            className="w-full px-3.5 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-300 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            {contextMenu.targetImg.dataset.isMinimized === 'true' || contextMenu.targetImg.classList.contains('minimized-img-thumbnail') ? (
              <>
                <Maximize2 className="w-4 h-4 text-blue-500" />
                <span>Re-expandir Imagem (Tamanho Normal)</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-4 h-4 text-amber-500" />
                <span>Miniaturizar (Ocupar Menos Espaço)</span>
              </>
            )}
          </button>

          <button
            onClick={onOpenOcclusionTool}
            className="w-full px-3.5 py-2 text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Layers className="w-4 h-4 text-indigo-500" />
            <span>Adicionar Clozes (Image Occlusion)</span>
          </button>

          <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

          <button
            onClick={onResetSize}
            className="w-full px-3.5 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-gray-400" />
            <span>Redefinir Tamanho Padrão (100%)</span>
          </button>
        </div>
      )}

      {/* Image Occlusion Modal */}
      {showOcclusionModal && (
        <ImageOcclusionTool
          initialUrl={selectedImg?.src || contextMenu.targetImg?.src || ''}
          onInsert={onInsertOcclusion}
          onCancel={onCloseOcclusionModal}
        />
      )}
    </>
  );
}
